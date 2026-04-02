const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '../../daelin-write.json');
const adapter = new FileSync(DB_PATH);
const db = low(adapter);

db.defaults({
  projects: [],
  volumes: [],
  chapters: [],
  scenes: [],
  codex: [],
  prompt_templates: [],
  chat_messages: [],
  settings: {}
}).write();

if (db.get('prompt_templates').value().length === 0) {
  db.get('prompt_templates').push({
    id: uuidv4(),
    project_id: null,
    name: 'Geração Padrão',
    is_default: true,
    system_prompt: 'Você é um assistente de escrita criativa especializado em romances. Escreva com prosa fluida e envolvente. Siga EXATAMENTE o sumário fornecido. Mantenha consistência com os personagens e o mundo estabelecidos no contexto.',
    user_prompt: 'CONTEXTO DO PROJETO:\n{style_notes}\n\nPERSONAGENS PRESENTES:\n{characters}\n\nLOCAL:\n{location}\n\nCENA ANTERIOR (resumo):\n{previous_scene}\n\nSUMÁRIO DESTA CENA:\n{scene_summary}\n\nEscreva a cena completa seguindo o sumário acima.'
  }).push({
    id: uuidv4(),
    project_id: null,
    name: 'Humanizado (Anti-AI)',
    is_default: false,
    system_prompt: 'Você é um escritor humano com voz própria. Varie o tamanho das frases, use voz ativa, evite clichês de IA como "de repente", "seus olhos se arregalaram", "ela percebeu que", "o ar ficou pesado". Escreva como um ser humano que sente as cenas.',
    user_prompt: 'CONTEXTO DO PROJETO:\n{style_notes}\n\nPERSONAGENS PRESENTES:\n{characters}\n\nLOCAL:\n{location}\n\nCENA ANTERIOR (resumo):\n{previous_scene}\n\nSUMÁRIO DESTA CENA:\n{scene_summary}\n\nEscreva a cena. Seja humano.'
  }).write();
}

module.exports = db;
