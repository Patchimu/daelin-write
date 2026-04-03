const express = require('express');
const router = express.Router();
const { getProjectData, saveProjectData, findProjectDataByCodexId } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

router.get('/:projectId', (req, res) => {
  const data = getProjectData(req.params.projectId);
  if (!data) return res.json([]);
  const codex = (data.codex || []).sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.name.localeCompare(b.name);
  });
  res.json(codex);
});

router.post('/', (req, res) => {
  const { project_id, type, name, description } = req.body;
  const data = getProjectData(project_id);
  if (!data) return res.status(404).json({ error: 'Project not found' });
  const id = uuidv4();
  data.codex.push({ id, project_id, type: type || 'character', name, description: description || '' });
  saveProjectData(project_id, data);
  res.json({ id, type, name, description });
});

router.put('/:id', (req, res) => {
  const data = findProjectDataByCodexId(req.params.id);
  if (!data) return res.status(404).json({ error: 'Not found' });
  const entry = data.codex.find(e => e.id === req.params.id);
  Object.assign(entry, req.body);
  saveProjectData(data.project.id, data);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  const data = findProjectDataByCodexId(req.params.id);
  if (!data) return res.status(404).json({ error: 'Not found' });
  data.codex = data.codex.filter(e => e.id !== req.params.id);
  saveProjectData(data.project.id, data);
  res.json({ success: true });
});

module.exports = router;
