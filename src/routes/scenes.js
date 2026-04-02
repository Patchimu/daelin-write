const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { v4: uuidv4 } = require('uuid');

router.get('/:id', (req, res) => {
  const scene = db.get('scenes').find({ id: req.params.id }).value();
  if (!scene) return res.status(404).json({ error: 'Not found' });
  res.json(scene);
});

router.post('/', (req, res) => {
  const { chapter_id, title, summary = '' } = req.body;
  const scenes = db.get('scenes').filter({ chapter_id }).value();
  const id = uuidv4();
  db.get('scenes').push({ id, chapter_id, title, summary, content: '', position: scenes.length, word_count: 0 }).write();
  res.json({ id, title, summary });
});

router.put('/:id', (req, res) => {
  const { title, summary, content } = req.body;
  const wc = content ? content.trim().split(/\s+/).filter(Boolean).length : 0;
  db.get('scenes').find({ id: req.params.id }).assign({ title, summary, content, word_count: wc }).write();
  const scene = db.get('scenes').find({ id: req.params.id }).value();
  const ch = db.get('chapters').find({ id: scene.chapter_id }).value();
  if (ch) db.get('projects').find({ id: ch.project_id }).assign({ updated_at: new Date().toISOString() }).write();
  res.json({ success: true, word_count: wc });
});

router.delete('/:id', (req, res) => {
  db.get('scenes').remove({ id: req.params.id }).write();
  res.json({ success: true });
});

module.exports = router;
