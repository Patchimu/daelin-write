const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { v4: uuidv4 } = require('uuid');

router.get('/', (req, res) => {
  const templates = db.get('prompt_templates').filter(t => !t.project_id).sortBy(t => t.is_default ? 0 : 1).value();
  res.json(templates);
});

router.post('/', (req, res) => {
  const { name, system_prompt, user_prompt } = req.body;
  const id = uuidv4();
  db.get('prompt_templates').push({ id, name, system_prompt, user_prompt, is_default: false, project_id: null }).write();
  res.json({ id, name, system_prompt, user_prompt });
});

router.put('/:id', (req, res) => {
  db.get('prompt_templates').find({ id: req.params.id }).assign(req.body).write();
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.get('prompt_templates').remove({ id: req.params.id }).write();
  res.json({ success: true });
});

module.exports = router;
