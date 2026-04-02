const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { v4: uuidv4 } = require('uuid');

router.get('/:projectId', (req, res) => {
  res.json(db.get('codex').filter({ project_id: req.params.projectId }).sortBy(['type','name']).value());
});

router.post('/', (req, res) => {
  const { project_id, type, name, description } = req.body;
  const id = uuidv4();
  db.get('codex').push({ id, project_id, type: type || 'character', name, description: description || '' }).write();
  res.json({ id, type, name, description });
});

router.put('/:id', (req, res) => {
  db.get('codex').find({ id: req.params.id }).assign(req.body).write();
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.get('codex').remove({ id: req.params.id }).write();
  res.json({ success: true });
});

module.exports = router;
