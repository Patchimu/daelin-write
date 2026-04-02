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

const NEW_USER_PROMPT_PADRAO = 'CONTEXTO DO PROJETO:\n{style_notes}\n\nPERSONAGENS PRESENTES:\n{characters}\n\nLOCAL:\n{location}\n\nRESUMO DO CAPÍTULO ANTERIOR:\n{prev_chapter_summary}\n\nRESUMO DO CAPÍTULO ATUAL:\n{chapter_summary}\n\nCENA ANTERIOR:\n{previous_scene}\n\nSUMÁRIO DESTA CENA:\n{scene_summary}\n\nEscreva a cena completa seguindo o sumário acima.';
const NEW_USER_PROMPT_HUMANO = 'CONTEXTO DO PROJETO:\n{style_notes}\n\nPERSONAGENS PRESENTES:\n{characters}\n\nLOCAL:\n{location}\n\nRESUMO DO CAPÍTULO ANTERIOR:\n{prev_chapter_summary}\n\nRESUMO DO CAPÍTULO ATUAL:\n{chapter_summary}\n\nCENA ANTERIOR:\n{previous_scene}\n\nSUMÁRIO DESTA CENA:\n{scene_summary}\n\nEscreva a cena. Seja humano.';

if (db.get('prompt_templates').value().length === 0) {
  db.get('prompt_templates').push({
    id: uuidv4(),
    project_id: null,
    name: 'Geração Padrão',
    is_default: true,
    system_prompt: 'Você é um assistente de escrita criativa especializado em romances. Escreva com prosa fluida e envolvente. Siga EXATAMENTE o sumário fornecido. Mantenha consistência com os personagens e o mundo estabelecidos no contexto.',
    user_prompt: NEW_USER_PROMPT_PADRAO
  }).push({
    id: uuidv4(),
    project_id: null,
    name: 'Humanizado (Anti-AI)',
    is_default: false,
    system_prompt: 'Você é um escritor humano com voz própria. Varie o tamanho das frases, use voz ativa, evite clichês de IA como "de repente", "seus olhos se arregalaram", "ela percebeu que", "o ar ficou pesado". Escreva como um ser humano que sente as cenas.',
    user_prompt: NEW_USER_PROMPT_HUMANO
  }).write();
} else {
  // Migrate existing templates to include chapter context variables
  const padrao = db.get('prompt_templates').find({ name: 'Geração Padrão' }).value();
  if (padrao && !padrao.user_prompt.includes('{chapter_summary}')) {
    db.get('prompt_templates').find({ name: 'Geração Padrão' }).assign({ user_prompt: NEW_USER_PROMPT_PADRAO }).write();
  }
  const humano = db.get('prompt_templates').find({ name: 'Humanizado (Anti-AI)' }).value();
  if (humano && !humano.user_prompt.includes('{chapter_summary}')) {
    db.get('prompt_templates').find({ name: 'Humanizado (Anti-AI)' }).assign({ user_prompt: NEW_USER_PROMPT_HUMANO }).write();
  }
}

module.exports = db;
