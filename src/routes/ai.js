const express = require('express');
const router = express.Router();
const { getSettings, getProjectData, saveProjectData, findProjectDataBySceneId } = require('../db/database');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');

function fillTemplate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] || '');
}

router.post('/generate', async (req, res) => {
  const { settings } = getSettings();
  if (!settings.api_key) return res.status(400).json({ error: 'API key não configurada. Vá em Configurações.' });

  const { scene_id, custom_system, custom_user } = req.body;
  const pData = findProjectDataBySceneId(scene_id);
  if (!pData) return res.status(404).json({ error: 'Cena não encontrada' });

  const scene = pData.scenes.find(s => s.id === scene_id);
  const chapter = pData.chapters.find(c => c.id === scene.chapter_id);
  const project = pData.project;
  const codex = pData.codex || [];

  const prevScene = (pData.scenes || [])
    .filter(s => s.chapter_id === scene.chapter_id && s.position < scene.position)
    .sort((a, b) => b.position - a.position)[0];

  const prevChapter = (pData.chapters || [])
    .filter(c => c.position < chapter.position)
    .sort((a, b) => b.position - a.position)[0];

  const characters = codex.filter(e => e.type === 'character').map(c => `${c.name}: ${c.description}`).join('\n') || 'Não definido';
  const location = codex.filter(e => e.type === 'location').map(l => `${l.name}: ${l.description}`).join('\n') || 'Não definido';

  const vars = {
    style_notes: project.style_notes || '',
    characters,
    location,
    previous_scene: prevScene?.content ? prevScene.content.slice(-600) : 'Esta é a primeira cena.',
    scene_summary: scene.summary || scene.title,
    chapter_summary: chapter.summary || '',
    prev_chapter_summary: prevChapter?.summary || 'Este é o primeiro capítulo.',
  };

  const langInstruction = 'Detecte o idioma do sumário da cena e escreva toda a cena nesse mesmo idioma.';
  const systemPrompt = [custom_system, langInstruction].filter(Boolean).join('\n');
  const userPrompt = fillTemplate(custom_user || '', vars);

  const connector = settings.connector || 'openai';
  const model = settings.model || 'gpt-4o';
  const apiKey = settings.api_key;

  try {
    let text = '';
    if (connector === 'claude') {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: model || 'claude-opus-4-6', max_tokens: 2000, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] })
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error.message);
      text = d.content[0].text;
    } else {
      const url = connector === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }] })
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error.message || JSON.stringify(d.error));
      text = d.choices[0].message.content;
    }
    res.json({ text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/chat', async (req, res) => {
  const { settings } = getSettings();
  if (!settings.api_key) return res.status(400).json({ error: 'API key não configurada.' });

  const { project_id, message } = req.body;
  const pData = getProjectData(project_id);
  if (!pData) return res.status(404).json({ error: 'Projeto não encontrado' });

  const project = pData.project;
  const codex = pData.codex || [];
  const history = (pData.chat_messages || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const codexSummary = codex.map(e => `[${e.type}] ${e.name}: ${e.description}`).join('\n');
  const systemPrompt = `Você é um assistente especializado no projeto "${project.title}".\nContexto: ${project.style_notes || ''}\nCodex:\n${codexSummary || 'Vazio.'}`;

  pData.chat_messages = pData.chat_messages || [];
  pData.chat_messages.push({ id: uuidv4(), project_id, role: 'user', content: message, created_at: new Date().toISOString() });

  const messages = [...history.map(m => ({ role: m.role, content: m.content })), { role: 'user', content: message }];
  const connector = settings.connector || 'openai';
  const model = settings.model || 'gpt-4o';
  const apiKey = settings.api_key;

  try {
    let reply = '';
    if (connector === 'claude') {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: model || 'claude-opus-4-6', max_tokens: 1000, system: systemPrompt, messages })
      });
      const d = await r.json();
      reply = d.content[0].text;
    } else {
      const url = connector === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, ...messages] })
      });
      const d = await r.json();
      reply = d.choices[0].message.content;
    }

    pData.chat_messages.push({ id: uuidv4(), project_id, role: 'assistant', content: reply, created_at: new Date().toISOString() });
    saveProjectData(project_id, pData);
    res.json({ reply });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
