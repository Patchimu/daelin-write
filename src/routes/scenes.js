const express = require('express');
const router = express.Router();
const { findProjectDataBySceneId, findProjectDataByChapterId, saveProjectData } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

router.get('/:id', (req, res) => {
  const data = findProjectDataBySceneId(req.params.id);
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data.scenes.find(s => s.id === req.params.id));
});

router.post('/', (req, res) => {
  const { chapter_id, title, summary = '' } = req.body;
  const data = findProjectDataByChapterId(chapter_id);
  if (!data) return res.status(404).json({ error: 'Chapter not found' });
  const id = uuidv4();
  const position = data.scenes.filter(s => s.chapter_id === chapter_id).length;
  data.scenes.push({ id, chapter_id, title, summary, content: '', position, word_count: 0 });
  saveProjectData(data.project.id, data);
  res.json({ id, title, summary });
});

router.put('/:id', (req, res) => {
  const { title, summary, content } = req.body;
  const wc = content ? content.trim().split(/\s+/).filter(Boolean).length : 0;
  const data = findProjectDataBySceneId(req.params.id);
  if (!data) return res.status(404).json({ error: 'Not found' });
  const scene = data.scenes.find(s => s.id === req.params.id);
  Object.assign(scene, { title, summary, content, word_count: wc });
  data.project.updated_at = new Date().toISOString();
  saveProjectData(data.project.id, data);
  res.json({ success: true, word_count: wc });
});

router.delete('/:id', (req, res) => {
  const data = findProjectDataBySceneId(req.params.id);
  if (!data) return res.status(404).json({ error: 'Not found' });
  data.scenes = data.scenes.filter(s => s.id !== req.params.id);
  saveProjectData(data.project.id, data);
  res.json({ success: true });
});

module.exports = router;
