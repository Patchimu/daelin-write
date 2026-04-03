const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, '../../data');
const PROJECTS_DIR = path.join(DATA_DIR, 'projects');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const OLD_DB_FILE = path.join(__dirname, '../../daelin-write.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR, { recursive: true });

// ── SETTINGS ──

function getSettings() {
  if (!fs.existsSync(SETTINGS_FILE)) return { settings: {}, prompt_templates: [] };
  return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
}

function saveSettings(data) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
}

// ── PROJECTS ──

function projectFile(id) {
  return path.join(PROJECTS_DIR, `${id}.json`);
}

function getProjectData(id) {
  const file = projectFile(id);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveProjectData(id, data) {
  fs.writeFileSync(projectFile(id), JSON.stringify(data, null, 2));
}

function deleteProjectData(id) {
  const file = projectFile(id);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

function listProjects() {
  return fs.readdirSync(PROJECTS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, f), 'utf8')).project; }
      catch { return null; }
    })
    .filter(Boolean);
}

// ── SEARCH HELPERS ──

function _allProjectFiles() {
  return fs.readdirSync(PROJECTS_DIR).filter(f => f.endsWith('.json'));
}

function findProjectDataByChapterId(chapterId) {
  for (const f of _allProjectFiles()) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, f), 'utf8'));
      if ((data.chapters || []).find(c => c.id === chapterId)) return data;
    } catch {}
  }
  return null;
}

function findProjectDataBySceneId(sceneId) {
  for (const f of _allProjectFiles()) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, f), 'utf8'));
      if ((data.scenes || []).find(s => s.id === sceneId)) return data;
    } catch {}
  }
  return null;
}

function findProjectDataByCodexId(codexId) {
  for (const f of _allProjectFiles()) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, f), 'utf8'));
      if ((data.codex || []).find(e => e.id === codexId)) return data;
    } catch {}
  }
  return null;
}

// ── MIGRATION from daelin-write.json ──

if (!fs.existsSync(SETTINGS_FILE) && fs.existsSync(OLD_DB_FILE)) {
  const old = JSON.parse(fs.readFileSync(OLD_DB_FILE, 'utf8'));

  saveSettings({
    settings: old.settings || {},
    prompt_templates: old.prompt_templates || []
  });

  for (const project of (old.projects || [])) {
    const chapters = (old.chapters || []).filter(c => c.project_id === project.id);
    const chapterIds = new Set(chapters.map(c => c.id));
    const scenes = (old.scenes || []).filter(s => chapterIds.has(s.chapter_id));
    const codex = (old.codex || []).filter(e => e.project_id === project.id);
    const chat_messages = (old.chat_messages || []).filter(m => m.project_id === project.id);
    saveProjectData(project.id, { project, chapters, scenes, codex, chat_messages });
  }

  console.log(`✦ Migrated ${(old.projects || []).length} projects to data/`);
}

// ── DEFAULTS (fresh install) ──

if (!fs.existsSync(SETTINGS_FILE)) {
  saveSettings({ settings: {}, prompt_templates: [] });
}

const _s = getSettings();
if (_s.prompt_templates.length === 0) {
  const UP = 'CONTEXTO DO PROJETO:\n{style_notes}\n\nPERSONAGENS PRESENTES:\n{characters}\n\nLOCAL:\n{location}\n\nRESUMO DO CAPÍTULO ANTERIOR:\n{prev_chapter_summary}\n\nRESUMO DO CAPÍTULO ATUAL:\n{chapter_summary}\n\nCENA ANTERIOR:\n{previous_scene}\n\nSUMÁRIO DESTA CENA:\n{scene_summary}\n\nEscreva a cena completa seguindo o sumário acima.';
  _s.prompt_templates.push(
    { id: uuidv4(), project_id: null, name: 'Geração Padrão', is_default: true,
      system_prompt: 'Você é um assistente de escrita criativa especializado em romances. Escreva com prosa fluida e envolvente. Siga EXATAMENTE o sumário fornecido. Mantenha consistência com os personagens e o mundo estabelecidos no contexto.',
      user_prompt: UP },
    { id: uuidv4(), project_id: null, name: 'Humanizado (Anti-AI)', is_default: false,
      system_prompt: 'Você é um escritor humano com voz própria. Varie o tamanho das frases, use voz ativa, evite clichês de IA como "de repente", "seus olhos se arregalaram", "ela percebeu que", "o ar ficou pesado". Escreva como um ser humano que sente as cenas.',
      user_prompt: UP.replace('Escreva a cena completa seguindo o sumário acima.', 'Escreva a cena. Seja humano.') }
  );
  saveSettings(_s);
}

// ── TEMPLATE MIGRATION (add chapter context vars to existing templates) ──

const _s2 = getSettings();
let _changed = false;
const UP2 = 'CONTEXTO DO PROJETO:\n{style_notes}\n\nPERSONAGENS PRESENTES:\n{characters}\n\nLOCAL:\n{location}\n\nRESUMO DO CAPÍTULO ANTERIOR:\n{prev_chapter_summary}\n\nRESUMO DO CAPÍTULO ATUAL:\n{chapter_summary}\n\nCENA ANTERIOR:\n{previous_scene}\n\nSUMÁRIO DESTA CENA:\n{scene_summary}\n\nEscreva a cena completa seguindo o sumário acima.';
const UP2H = UP2.replace('Escreva a cena completa seguindo o sumário acima.', 'Escreva a cena. Seja humano.');
for (const t of _s2.prompt_templates) {
  if (t.name === 'Geração Padrão' && !t.user_prompt.includes('{chapter_summary}')) { t.user_prompt = UP2; _changed = true; }
  if (t.name === 'Humanizado (Anti-AI)' && !t.user_prompt.includes('{chapter_summary}')) { t.user_prompt = UP2H; _changed = true; }
}
if (_changed) saveSettings(_s2);

module.exports = {
  getSettings, saveSettings,
  getProjectData, saveProjectData, deleteProjectData, listProjects,
  findProjectDataByChapterId, findProjectDataBySceneId, findProjectDataByCodexId,
};
