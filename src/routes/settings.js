const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => res.json(db.get('settings').value()));

router.post('/', (req, res) => {
  const current = db.get('settings').value();
  db.set('settings', { ...current, ...req.body }).write();
  res.json({ success: true });
});

module.exports = router;
