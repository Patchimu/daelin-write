const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { v4: uuidv4 } = require('uuid');

function getProjectFull(id) {
  const p = db.get('projects').find({ id }).value();
  if (!p) return null;
  const chapters = db.get('chapters').filter({ project_id: id }).sortBy('position').value();
  for (const ch of chapters) {
    ch.scenes = db.get('scenes').filter({ chapter_id: ch.id }).sortBy('position').map(s => ({
      id: s.id, title: s.title, summary: s.summary, position: s.position, word_count: s.word_count || 0
    })).value();
  }
  p.chapters = chapters;
  p.codex = db.get('codex').filter({ project_id: id }).value();
  return p;
}

router.get('/', (req, res) => {
  const projects = db.get('projects').value().map(p => {
    const chapters = db.get('chapters').filter({ project_id: p.id }).value();
    const scenes = chapters.flatMap(c => db.get('scenes').filter({ chapter_id: c.id }).value());
    return {
      ...p,
      chapter_count: chapters.length,
      scene_count: scenes.length,
      word_count: scenes.reduce((s, sc) => s + (sc.word_count || 0), 0)
    };
  }).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  res.json(projects);
});

router.get('/:id', (req, res) => {
  const p = getProjectFull(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json(p);
});

router.post('/', (req, res) => {
  const { title, type = 'novel', style_notes = '' } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const id = uuidv4();
  const now = new Date().toISOString();
  db.get('projects').push({ id, title, type, style_notes, created_at: now, updated_at: now }).write();
  res.json({ id, title, type });
});

function parseOutlineMarkdown(markdown) {
  const lines = markdown.split('\n');
  let title = 'Importado';
  const chapters = [];
  let currentChapter = null;
  let inScenes = false;
  let summaryBuffer = [];

  function finalizeChapter() {
    if (currentChapter) {
      currentChapter.summary = summaryBuffer.join(' ').trim();
      chapters.push(currentChapter);
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^# [^#]/.test(trimmed)) {
      title = trimmed.slice(2).trim();
    } else if (/^## /.test(trimmed)) {
      finalizeChapter();
      currentChapter = { title: trimmed.slice(3).trim(), summary: '', scenes: [] };
      inScenes = false;
      summaryBuffer = [];
    } else if (/^\*\*[Cc]enas?\*\*$/.test(trimmed) || /^\*\*[Ss]cenes?\*\*$/.test(trimmed)) {
      inScenes = true;
    } else if (currentChapter && inScenes && /^[Ss]cene \d+:/i.test(trimmed)) {
      const colonIdx = trimmed.indexOf(':');
      const description = trimmed.slice(colonIdx + 1).trim();
      const match = trimmed.match(/^[Ss]cene (\d+):/i);
      currentChapter.scenes.push({ title: `Cena ${match[1]}`, summary: description });
    } else if (currentChapter && !inScenes && trimmed) {
      summaryBuffer.push(trimmed);
    }
  }
  finalizeChapter();
  return { title, chapters };
}

router.post('/import-outline', (req, res) => {
  const { markdown, project_type = 'novel', style_notes = '' } = req.body;
  if (!markdown) return res.status(400).json({ error: 'Markdown vazio' });

  const { title, chapters } = parseOutlineMarkdown(markdown);
  const projectId = uuidv4();
  const now = new Date().toISOString();
  db.get('projects').push({ id: projectId, title, type: project_type, style_notes, created_at: now, updated_at: now }).write();

  chapters.forEach((ch, ci) => {
    const chId = uuidv4();
    db.get('chapters').push({ id: chId, project_id: projectId, title: ch.title, summary: ch.summary || '', position: ci }).write();
    ch.scenes.forEach((sc, si) => {
      db.get('scenes').push({ id: uuidv4(), chapter_id: chId, title: sc.title, summary: sc.summary || '', content: '', position: si, word_count: 0 }).write();
    });
  });

  res.json({ success: true, project_id: projectId });
});

router.post('/import', (req, res) => {
  const data = req.body;
  const projectId = uuidv4();
  const now = new Date().toISOString();
  db.get('projects').push({
    id: projectId, title: data.title || 'Importado', type: data.type || 'novel',
    style_notes: data.style_notes || '', created_at: now, updated_at: now
  }).write();

  (data.chapters || []).forEach((ch, ci) => {
    const chId = uuidv4();
    db.get('chapters').push({ id: chId, project_id: projectId, title: ch.title, position: ci }).write();
    (ch.scenes || []).forEach((sc, si) => {
      db.get('scenes').push({ id: uuidv4(), chapter_id: chId, title: sc.title, summary: sc.summary || '', content: '', position: si, word_count: 0 }).write();
    });
  });

  (data.codex || []).forEach(e => {
    db.get('codex').push({ id: uuidv4(), project_id: projectId, type: e.type || 'character', name: e.name, description: e.description || '' }).write();
  });

  res.json({ success: true, project_id: projectId });
});

router.put('/:id', (req, res) => {
  const { title, style_notes } = req.body;
  db.get('projects').find({ id: req.params.id }).assign({ title, style_notes, updated_at: new Date().toISOString() }).write();
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  const id = req.params.id;
  db.get('chapters').filter({ project_id: id }).value().forEach(ch => {
    db.get('scenes').remove({ chapter_id: ch.id }).write();
  });
  db.get('chapters').remove({ project_id: id }).write();
  db.get('codex').remove({ project_id: id }).write();
  db.get('chat_messages').remove({ project_id: id }).write();
  db.get('projects').remove({ id }).write();
  res.json({ success: true });
});

router.post('/:id/chapters', (req, res) => {
  const { title } = req.body;
  const chapters = db.get('chapters').filter({ project_id: req.params.id }).value();
  const id = uuidv4();
  db.get('chapters').push({ id, project_id: req.params.id, title, position: chapters.length }).write();
  db.get('projects').find({ id: req.params.id }).assign({ updated_at: new Date().toISOString() }).write();
  res.json({ id, title });
});

module.exports = router;
