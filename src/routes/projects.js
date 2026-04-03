const express = require('express');
const router = express.Router();
const { getProjectData, saveProjectData, deleteProjectData, listProjects } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

function getProjectFull(id) {
  const data = getProjectData(id);
  if (!data) return null;
  const chapters = (data.chapters || []).sort((a, b) => a.position - b.position);
  for (const ch of chapters) {
    ch.scenes = (data.scenes || [])
      .filter(s => s.chapter_id === ch.id)
      .sort((a, b) => a.position - b.position)
      .map(s => ({ id: s.id, title: s.title, summary: s.summary, position: s.position, word_count: s.word_count || 0 }));
  }
  return { ...data.project, chapters, codex: data.codex || [] };
}

router.get('/', (req, res) => {
  const projects = listProjects().map(p => {
    const data = getProjectData(p.id);
    const scenes = data.scenes || [];
    return {
      ...p,
      chapter_count: (data.chapters || []).length,
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
  const project = { id, title, type, style_notes, created_at: now, updated_at: now };
  saveProjectData(id, { project, chapters: [], scenes: [], codex: [], chat_messages: [] });
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

  const { title, chapters: parsedChapters } = parseOutlineMarkdown(markdown);
  const projectId = uuidv4();
  const now = new Date().toISOString();
  const project = { id: projectId, title, type: project_type, style_notes, created_at: now, updated_at: now };
  const chapters = [];
  const scenes = [];

  parsedChapters.forEach((ch, ci) => {
    const chId = uuidv4();
    chapters.push({ id: chId, project_id: projectId, title: ch.title, summary: ch.summary || '', position: ci });
    ch.scenes.forEach((sc, si) => {
      scenes.push({ id: uuidv4(), chapter_id: chId, title: sc.title, summary: sc.summary || '', content: '', position: si, word_count: 0 });
    });
  });

  saveProjectData(projectId, { project, chapters, scenes, codex: [], chat_messages: [] });
  res.json({ success: true, project_id: projectId });
});

router.post('/import', (req, res) => {
  const data = req.body;
  const projectId = uuidv4();
  const now = new Date().toISOString();
  const project = { id: projectId, title: data.title || 'Importado', type: data.type || 'novel', style_notes: data.style_notes || '', created_at: now, updated_at: now };
  const chapters = [];
  const scenes = [];

  (data.chapters || []).forEach((ch, ci) => {
    const chId = uuidv4();
    chapters.push({ id: chId, project_id: projectId, title: ch.title, summary: ch.summary || '', position: ci });
    (ch.scenes || []).forEach((sc, si) => {
      scenes.push({ id: uuidv4(), chapter_id: chId, title: sc.title, summary: sc.summary || '', content: '', position: si, word_count: 0 });
    });
  });

  const codex = (data.codex || []).map(e => ({ id: uuidv4(), project_id: projectId, type: e.type || 'character', name: e.name, description: e.description || '' }));

  saveProjectData(projectId, { project, chapters, scenes, codex, chat_messages: [] });
  res.json({ success: true, project_id: projectId });
});

router.put('/:id', (req, res) => {
  const data = getProjectData(req.params.id);
  if (!data) return res.status(404).json({ error: 'Not found' });
  const { title, style_notes } = req.body;
  Object.assign(data.project, { title, style_notes, updated_at: new Date().toISOString() });
  saveProjectData(req.params.id, data);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  deleteProjectData(req.params.id);
  res.json({ success: true });
});

router.post('/:id/chapters', (req, res) => {
  const { title, summary = '' } = req.body;
  const data = getProjectData(req.params.id);
  if (!data) return res.status(404).json({ error: 'Not found' });
  const id = uuidv4();
  data.chapters.push({ id, project_id: req.params.id, title, summary, position: data.chapters.length });
  data.project.updated_at = new Date().toISOString();
  saveProjectData(req.params.id, data);
  res.json({ id, title });
});

module.exports = router;
