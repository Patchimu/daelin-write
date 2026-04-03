const express = require('express');
const router = express.Router();
const { getSettings, saveSettings } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

router.get('/', (req, res) => {
  const { prompt_templates } = getSettings();
  const templates = (prompt_templates || [])
    .filter(t => !t.project_id)
    .sort((a, b) => (a.is_default ? 0 : 1) - (b.is_default ? 0 : 1));
  res.json(templates);
});

router.post('/', (req, res) => {
  const { name, system_prompt, user_prompt } = req.body;
  const id = uuidv4();
  const data = getSettings();
  data.prompt_templates.push({ id, name, system_prompt, user_prompt, is_default: false, project_id: null });
  saveSettings(data);
  res.json({ id, name, system_prompt, user_prompt });
});

router.put('/:id', (req, res) => {
  const data = getSettings();
  const t = data.prompt_templates.find(t => t.id === req.params.id);
  if (t) Object.assign(t, req.body);
  saveSettings(data);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  const data = getSettings();
  data.prompt_templates = data.prompt_templates.filter(t => t.id !== req.params.id);
  saveSettings(data);
  res.json({ success: true });
});

module.exports = router;
