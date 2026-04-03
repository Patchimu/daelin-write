const express = require('express');
const router = express.Router();
const { getSettings, saveSettings } = require('../db/database');

router.get('/', (req, res) => {
  const { settings } = getSettings();
  res.json(settings || {});
});

router.post('/', (req, res) => {
  const data = getSettings();
  data.settings = { ...(data.settings || {}), ...req.body };
  saveSettings(data);
  res.json({ success: true });
});

module.exports = router;
