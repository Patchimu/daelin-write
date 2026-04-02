// ── STATE ──
let state = {
  projects: [],
  currentProject: null,
  currentScene: null,
  templates: [],
  currentTemplate: null,
  saveTimer: null,
  chatHistory: [],
};

// ── INIT ──
async function init() {
  await loadProjects();
  await loadTemplates();
}

// ── NAVIGATION ──
function showHome() {
  document.getElementById('home-page').style.display = 'flex';
  document.getElementById('editor-page').style.display = 'none';
  document.getElementById('topbar-actions').style.display = 'none';
  document.getElementById('topbar-home-actions').style.display = 'flex';
  document.getElementById('topbar-project-title').textContent = '';
  state.currentProject = null;
  state.currentScene = null;
  loadProjects();
}

function showEditor(project) {
  state.currentProject = project;
  document.getElementById('home-page').style.display = 'none';
  document.getElementById('editor-page').style.display = 'flex';
  document.getElementById('topbar-actions').style.display = 'flex';
  document.getElementById('topbar-home-actions').style.display = 'none';
  document.getElementById('topbar-project-title').textContent = project.title;
  renderSidebar();
  renderRightCodex();
}

// ── PROJECTS ──
async function loadProjects() {
  const res = await fetch('/api/projects');
  state.projects = await res.json();
  renderProjectsGrid();
}

function renderProjectsGrid() {
  const grid = document.getElementById('projects-grid');
  grid.innerHTML = `<div class="new-project-card" onclick="showNewProjectModal()">
    <span style="font-size:24px">+</span>
    <span>Novo Projeto</span>
  </div>`;

  state.projects.forEach(p => {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.onclick = () => openProject(p.id);
    card.innerHTML = `
      <div class="project-type">${p.type === 'saga' ? 'Saga' : 'Romance'}</div>
      <h3>${p.title}</h3>
      <div class="project-meta">
        <span>${p.chapter_count || 0} capítulos</span>
        <span>${p.scene_count || 0} cenas</span>
        <span>${(p.word_count || 0).toLocaleString()} palavras</span>
      </div>
    `;
    grid.appendChild(card);
  });
}

async function openProject(id) {
  const res = await fetch(`/api/projects/${id}`);
  const project = await res.json();
  showEditor(project);
}

async function createProject() {
  const title = document.getElementById('new-title').value.trim();
  if (!title) return notify('Digite um título', 'error');
  const type = document.getElementById('new-type').value;
  const style_notes = document.getElementById('new-style').value;
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, type, style_notes })
  });
  const p = await res.json();
  closeModal('modal-new-project');
  await openProject(p.id);
  notify('Projeto criado!', 'success');
}

let importMode = 'md';

function switchImportTab(mode, btn) {
  importMode = mode;
  document.getElementById('import-tab-md').style.display = mode === 'md' ? 'block' : 'none';
  document.getElementById('import-tab-json').style.display = mode === 'json' ? 'block' : 'none';
  btn.closest('.type-toggle').querySelectorAll('button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

async function importProject() {
  if (importMode === 'md') {
    await importOutline();
  } else {
    await importJSON();
  }
}

async function importOutline() {
  const markdown = document.getElementById('import-md').value.trim();
  if (!markdown) return notify('Cole o conteúdo do outline.md', 'error');
  try {
    const res = await fetch('/api/projects/import-outline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown })
    });
    const result = await res.json();
    if (result.error) return notify(result.error, 'error');
    closeModal('modal-import');
    await openProject(result.project_id);
    notify('Outline importado!', 'success');
  } catch (e) {
    notify('Erro ao importar: ' + e.message, 'error');
  }
}

async function importJSON() {
  const raw = document.getElementById('import-json').value.trim();
  let data;
  try { data = JSON.parse(raw); } catch { return notify('JSON inválido', 'error'); }
  try {
    const res = await fetch('/api/projects/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    closeModal('modal-import');
    await openProject(result.project_id);
    notify('Projeto importado!', 'success');
  } catch (e) {
    notify('Erro ao importar: ' + e.message, 'error');
  }
}

// ── SIDEBAR ──
function renderSidebar() {
  const tree = document.getElementById('sidebar-tree');
  tree.innerHTML = '';
  const p = state.currentProject;
  const chapters = p.chapters || (p.volumes ? p.volumes.flatMap(v => v.chapters) : []);

  const totalWords = chapters.flatMap(c => c.scenes || []).reduce((s, sc) => s + (sc.word_count || 0), 0);
  document.getElementById('project-word-count').textContent = `${totalWords.toLocaleString()} palavras no total`;

  chapters.forEach(ch => {
    const chDiv = document.createElement('div');
    chDiv.className = 'tree-chapter';

    const header = document.createElement('div');
    header.className = 'tree-chapter-header open';
    header.innerHTML = `<span class="chevron">▶</span> ${ch.title}
      <button class="btn-icon" style="margin-left:auto; font-size:12px" onclick="showAddSceneModal('${ch.id}', event)" title="Nova cena">+</button>`;
    header.onclick = (e) => {
      if (e.target.tagName === 'BUTTON') return;
      header.classList.toggle('open');
    };

    const scenesDiv = document.createElement('div');
    scenesDiv.className = 'tree-scenes';

    (ch.scenes || []).forEach(sc => {
      const scDiv = document.createElement('div');
      scDiv.className = `tree-scene ${state.currentScene?.id === sc.id ? 'active' : ''}`;
      scDiv.dataset.sceneId = sc.id;
      scDiv.innerHTML = `<span>${sc.title}</span><span class="wc">${sc.word_count ? sc.word_count + 'p' : ''}</span>`;
      scDiv.onclick = () => loadScene(sc.id);
      scenesDiv.appendChild(scDiv);
    });

    chDiv.appendChild(header);
    chDiv.appendChild(scenesDiv);
    tree.appendChild(chDiv);
  });
}

// ── SCENE ──
async function loadScene(sceneId) {
  const res = await fetch(`/api/scenes/${sceneId}`);
  const scene = await res.json();
  state.currentScene = scene;

  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('scene-editor').style.display = 'block';
  document.getElementById('editor-toolbar').style.display = 'flex';

  document.getElementById('scene-title-input').value = scene.title;
  document.getElementById('scene-editor').value = scene.content || '';
  updateWordCount();

  // Summary in right panel
  document.getElementById('scene-summary-display').textContent = scene.summary || 'Sem sumário';

  // Mark active in sidebar
  document.querySelectorAll('.tree-scene').forEach(el => {
    el.classList.toggle('active', el.dataset.sceneId === sceneId);
  });

  // Load template
  loadTemplate();
}

function scheduleSceneSave() {
  updateWordCount();
  setSaveStatus('saving');
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(saveCurrentScene, 1200);
}

async function saveCurrentScene() {
  if (!state.currentScene) return;
  const title = document.getElementById('scene-title-input').value;
  const content = document.getElementById('scene-editor').value;
  const summary = state.currentScene.summary;
  await fetch(`/api/scenes/${state.currentScene.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, summary, content })
  });
  setSaveStatus('saved');
  // Update word count in sidebar
  const wc = content.trim().split(/\s+/).filter(Boolean).length;
  state.currentScene.word_count = wc;
  const scEl = document.querySelector(`[data-scene-id="${state.currentScene.id}"] .wc`);
  if (scEl) scEl.textContent = wc + 'p';
}

function updateWordCount() {
  const text = document.getElementById('scene-editor').value;
  const wc = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  document.getElementById('word-count').textContent = `${wc} palavras`;
}

function setSaveStatus(status) {
  const el = document.getElementById('save-status');
  el.className = status;
  el.textContent = status === 'saving' ? 'salvando...' : status === 'saved' ? '✓ salvo' : '';
  if (status === 'saved') setTimeout(() => { el.textContent = ''; el.className = ''; }, 2000);
}

// ── CHAPTERS / SCENES ──
async function addChapter() {
  const title = document.getElementById('new-chapter-title').value.trim();
  if (!title) return;
  await fetch(`/api/projects/${state.currentProject.id}/chapters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title })
  });
  closeModal('modal-add-chapter');
  const res = await fetch(`/api/projects/${state.currentProject.id}`);
  state.currentProject = await res.json();
  renderSidebar();
  notify('Capítulo adicionado', 'success');
}

function showAddSceneModal(chapterId, event) {
  event.stopPropagation();
  document.getElementById('new-scene-chapter-id').value = chapterId;
  document.getElementById('new-scene-title').value = '';
  document.getElementById('new-scene-summary').value = '';
  openModal('modal-add-scene');
}

async function addScene() {
  const chapter_id = document.getElementById('new-scene-chapter-id').value;
  const title = document.getElementById('new-scene-title').value.trim();
  const summary = document.getElementById('new-scene-summary').value;
  if (!title) return;
  await fetch('/api/scenes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chapter_id, title, summary })
  });
  closeModal('modal-add-scene');
  const res = await fetch(`/api/projects/${state.currentProject.id}`);
  state.currentProject = await res.json();
  renderSidebar();
  notify('Cena adicionada', 'success');
}

// ── AI GENERATION ──
async function loadTemplates() {
  const res = await fetch('/api/templates');
  state.templates = await res.json();
  const sel = document.getElementById('template-select');
  sel.innerHTML = state.templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  if (state.templates.length) loadTemplate();
}

function loadTemplate() {
  const sel = document.getElementById('template-select');
  const id = sel.value;
  const tmpl = state.templates.find(t => t.id === id);
  if (tmpl) {
    document.getElementById('custom-system').value = tmpl.system_prompt;
    document.getElementById('custom-user').value = tmpl.user_prompt;
    state.currentTemplate = tmpl;
  }
}

function togglePromptEditor() {
  const area = document.getElementById('prompt-editor-area');
  area.classList.toggle('visible');
  document.getElementById('prompt-preview-toggle').textContent = area.classList.contains('visible') ? 'ocultar prompt' : 'editar prompt';
}

async function generateScene() {
  if (!state.currentScene) return notify('Selecione uma cena primeiro', 'error');
  const overlay = document.getElementById('generating-overlay');
  overlay.classList.add('visible');
  document.getElementById('btn-generate').disabled = true;

  try {
    const res = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scene_id: state.currentScene.id,
        custom_system: document.getElementById('custom-system').value,
        custom_user: document.getElementById('custom-user').value,
      })
    });
    const data = await res.json();
    if (data.error) return notify(data.error, 'error');

    const editor = document.getElementById('scene-editor');
    if (editor.value.trim()) {
      editor.value += '\n\n---\n\n' + data.text;
    } else {
      editor.value = data.text;
    }
    scheduleSceneSave();
    notify('Cena gerada!', 'success');
  } catch (e) {
    notify('Erro ao gerar: ' + e.message, 'error');
  } finally {
    overlay.classList.remove('visible');
    document.getElementById('btn-generate').disabled = false;
  }
}

async function saveCurrentTemplate() {
  const name = prompt('Nome do template:', state.currentTemplate?.name || 'Meu Template');
  if (!name) return;
  const system_prompt = document.getElementById('custom-system').value;
  const user_prompt = document.getElementById('custom-user').value;
  await fetch('/api/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, system_prompt, user_prompt })
  });
  await loadTemplates();
  notify('Template salvo!', 'success');
}

function resetPrompt() {
  loadTemplate();
  notify('Prompt resetado', 'success');
}

// ── CHAT ──
async function sendChat() {
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if (!msg || !state.currentProject) return;
  input.value = '';

  addChatMessage('user', msg);

  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: state.currentProject.id, message: msg })
    });
    const data = await res.json();
    if (data.error) return addChatMessage('assistant', '⚠ ' + data.error);
    addChatMessage('assistant', data.reply);
  } catch (e) {
    addChatMessage('assistant', '⚠ Erro: ' + e.message);
  }
}

function addChatMessage(role, content) {
  const msgs = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;
  div.textContent = content;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function chatKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
}

function clearChat() {
  document.getElementById('chat-messages').innerHTML = '';
}

// ── CODEX ──
function renderRightCodex() {
  if (!state.currentProject) return;
  const codex = state.currentProject.codex || [];
  const container = document.getElementById('right-codex');
  container.innerHTML = codex.length ? codex.map(e => `
    <div class="codex-entry">
      <div class="codex-entry-type">${typeLabel(e.type)}</div>
      <div class="codex-entry-name">${e.name}</div>
      <div class="codex-entry-desc">${e.description || ''}</div>
    </div>
  `).join('') : '<div style="padding:16px; color:var(--text3); font-size:12px">Codex vazio. Adicione entradas.</div>';
}

function typeLabel(t) {
  return { character: 'Personagem', location: 'Local', lore: 'Lore', object: 'Objeto' }[t] || t;
}

async function showCodexModal() {
  if (!state.currentProject) return;
  const res = await fetch(`/api/codex/${state.currentProject.id}`);
  const entries = await res.json();
  const list = document.getElementById('codex-list');
  list.innerHTML = entries.map(e => `
    <div style="display:flex; justify-content:space-between; align-items:start; padding:10px 0; border-bottom:1px solid var(--border)">
      <div>
        <div style="font-size:10px; color:var(--accent2); text-transform:uppercase; letter-spacing:0.08em">${typeLabel(e.type)}</div>
        <div style="font-size:13px; font-weight:500; margin-top:2px">${e.name}</div>
        <div style="font-size:12px; color:var(--text2); margin-top:3px">${e.description || ''}</div>
      </div>
      <button class="btn-icon" onclick="deleteCodexEntry('${e.id}')">✕</button>
    </div>
  `).join('') || '<div style="color:var(--text3); font-size:12px; padding-bottom:12px">Nenhuma entrada ainda.</div>';
  openModal('modal-codex');
}

async function addCodexEntry() {
  const type = document.getElementById('new-codex-type').value;
  const name = document.getElementById('new-codex-name').value.trim();
  const description = document.getElementById('new-codex-desc').value;
  if (!name) return notify('Digite um nome', 'error');
  await fetch('/api/codex', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: state.currentProject.id, type, name, description })
  });
  document.getElementById('new-codex-name').value = '';
  document.getElementById('new-codex-desc').value = '';
  // Refresh
  const res = await fetch(`/api/projects/${state.currentProject.id}`);
  state.currentProject = await res.json();
  renderRightCodex();
  showCodexModal();
  notify('Entrada adicionada', 'success');
}

async function deleteCodexEntry(id) {
  if (!confirm('Remover esta entrada?')) return;
  await fetch(`/api/codex/${id}`, { method: 'DELETE' });
  const res = await fetch(`/api/projects/${state.currentProject.id}`);
  state.currentProject = await res.json();
  renderRightCodex();
  showCodexModal();
}

// ── SETTINGS ──
async function showSettingsModal() {
  const res = await fetch('/api/settings');
  const s = await res.json();
  document.getElementById('settings-connector').value = s.connector || 'openai';
  document.getElementById('settings-api-key').value = s.api_key || '';
  document.getElementById('settings-model').value = s.model || '';
  updateModelPlaceholder();
  openModal('modal-settings');
}

function updateModelPlaceholder() {
  const conn = document.getElementById('settings-connector').value;
  const hints = {
    openai: 'gpt-4o — ou cole ID do fine-tune: ft:gpt-3.5-turbo:...',
    claude: 'claude-opus-4-6',
    openrouter: 'openai/gpt-4o, anthropic/claude-opus-4-6...'
  };
  document.getElementById('settings-model').placeholder = hints[conn] || 'modelo';
}

async function saveSettings() {
  const connector = document.getElementById('settings-connector').value;
  const api_key = document.getElementById('settings-api-key').value;
  const model = document.getElementById('settings-model').value;
  await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ connector, api_key, model })
  });
  closeModal('modal-settings');
  notify('Configurações salvas!', 'success');
}

// ── EXPORT ──
async function exportProject(format) {
  if (!state.currentProject) return;
  const res = await fetch(`/api/projects/${state.currentProject.id}`);
  const p = await res.json();
  const chapters = p.chapters || (p.volumes ? p.volumes.flatMap(v => v.chapters) : []);

  let content = `${p.title}\n${'='.repeat(p.title.length)}\n\n`;
  for (const ch of chapters) {
    content += `\n## ${ch.title}\n\n`;
    for (const sc of ch.scenes || []) {
      const scRes = await fetch(`/api/scenes/${sc.id}`);
      const scData = await scRes.json();
      content += `### ${sc.title}\n\n${scData.content || ''}\n\n`;
    }
  }

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${p.title}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
  closeModal('modal-export');
  notify('Exportado!', 'success');
}

// ── RIGHT PANEL TABS ──
function switchRightTab(tab) {
  document.querySelectorAll('.right-tab').forEach((el, i) => {
    const tabs = ['generate', 'context'];
    el.classList.toggle('active', tabs[i] === tab);
  });
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
}

// ── MODALS ──
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function showNewProjectModal() {
  document.getElementById('new-title').value = '';
  document.getElementById('new-style').value = '';
  document.getElementById('new-type').value = 'novel';
  document.querySelectorAll('.type-toggle button').forEach((b, i) => b.classList.toggle('active', i === 0));
  openModal('modal-new-project');
}
function showImportModal() {
  importMode = 'md';
  document.getElementById('import-tab-md').style.display = 'block';
  document.getElementById('import-tab-json').style.display = 'none';
  document.querySelectorAll('#modal-import .type-toggle button').forEach((b, i) => b.classList.toggle('active', i === 0));
  openModal('modal-import');
}
function showAddChapterModal() { document.getElementById('new-chapter-title').value = ''; openModal('modal-add-chapter'); }
function showExportModal() { openModal('modal-export'); }

function setType(type, btn) {
  document.getElementById('new-type').value = type;
  btn.closest('.type-toggle').querySelectorAll('button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.style.display = 'none';
  });
});

// ── NOTIFICATIONS ──
function notify(msg, type = 'info') {
  const el = document.getElementById('notification');
  el.textContent = msg;
  el.className = `show ${type}`;
  setTimeout(() => el.className = '', 3000);
}

// ── START ──
init();
