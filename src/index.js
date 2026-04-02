const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/projects', require('./routes/projects'));
app.use('/api/scenes', require('./routes/scenes'));
app.use('/api/codex', require('./routes/codex'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/templates', require('./routes/templates'));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n✦ Daelin Write rodando em http://localhost:${PORT}\n`);
});
