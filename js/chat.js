import { CONFIG } from './config.js';
import { navigate } from './app.js';

// ----------------------
// Model config (mirrors bot's MODELS dict — moves to config later)
// ----------------------
const MODELS = {
  "claude-haiku-4-5-20251001": {
    displayName: "Haiku 4.5",
    effortLevels: null,
    thinkingType: "extended",
  },
  "claude-sonnet-4-6": {
    displayName: "Sonnet 4.6",
    effortLevels: ["low", "medium", "high", "max"],
    thinkingType: "adaptive",
  },
  "claude-opus-4-6": {
    displayName: "Opus 4.6",
    effortLevels: ["low", "medium", "high", "max"],
    thinkingType: "adaptive",
  },
  "claude-opus-4-7": {
    displayName: "Opus 4.7",
    effortLevels: ["low", "medium", "high", "xhigh", "max"],
    thinkingType: "adaptive",
  },
  "claude-opus-4-8": {
    displayName: "Opus 4.8",
    effortLevels: ["low", "medium", "high", "xhigh", "max"],
    thinkingType: "adaptive",
  },
};

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

// ----------------------
// State
// ----------------------
let currentAgent = null;
let currentSession = null;
let selectedModel = DEFAULT_MODEL;
let selectedEffort = null;
let thinkingEnabled = false;

// ----------------------
// Entry point
// ----------------------
export function renderChat(container, session, agent) {
  currentAgent = agent;
  currentSession = session;

  const mode = agent.mode || 'chat';

  if (mode === 'upload') {
    renderUploadMode(container, agent);
  } else {
    renderChatMode(container, session, agent);
  }
}

// ----------------------
// Upload Mode (unchanged)
// ----------------------
function renderUploadMode(container, agent) {
  const uploadConfig = agent.features?.fileUpload || {};
  const acceptedTypes = uploadConfig.acceptedTypes?.join(',') || '*';
  const buttonLabel = uploadConfig.buttonLabel || 'Upload';

  container.innerHTML = `
    <div class="chat-view">
      <div class="chat-header">
        <button class="btn-back" id="backBtn">&larr; Back</button>
        <h2>${agent.icon} ${agent.name}</h2>
      </div>
      <div class="upload-container" id="uploadContainer">
        <div class="upload-prompt" id="uploadPrompt">
          <p>${agent.description || 'Upload a file to begin.'}</p>
        </div>
        <div class="upload-result" id="uploadResult" style="display:none;"></div>
      </div>
      <div class="upload-input">
        <input type="file" id="fileInput" accept="${acceptedTypes}">
        <button class="btn-send" id="uploadBtn">${buttonLabel}</button>
      </div>
    </div>
  `;

  document.getElementById('backBtn').addEventListener('click', () => {
    navigate('dashboard');
  });

  document.getElementById('uploadBtn').addEventListener('click', submitUpload);
}

async function submitUpload() {
  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files[0];

  if (!file) return;

  const uploadConfig = currentAgent.features?.fileUpload || {};

  if (uploadConfig.acceptedTypes && uploadConfig.acceptedTypes.length > 0) {
    if (!uploadConfig.acceptedTypes.includes(file.type)) {
      const resultDiv = document.getElementById('uploadResult');
      resultDiv.style.display = 'block';
      resultDiv.innerHTML = '<p class="upload-error">Invalid file type.</p>';
      return;
    }
  }

  const prompt = document.getElementById('uploadPrompt');
  const resultDiv = document.getElementById('uploadResult');
  const messages = currentAgent.messages || {};
  prompt.style.display = 'none';
  resultDiv.style.display = 'block';
  resultDiv.innerHTML = `<div class="message-thinking">${messages.loading || 'Processing'}<span class="thinking-dots"></span></div>`;

  const uploadBtn = document.getElementById('uploadBtn');
  fileInput.disabled = true;
  uploadBtn.disabled = true;

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('agentId', currentAgent.id);
    formData.append('endpoint', uploadConfig.endpoint || 'upload');

    const response = await fetch(`${CONFIG.PROXY_URL}/api/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${currentSession.token}`
      },
      body: formData
    });

    if (!response.ok) {
      if (response.status === 401) {
        navigate('login');
        return;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    let html = '';

    if (data.format_report) {
      const reportLabel = uploadConfig.reportLabel || 'Report';
      html += '<div class="upload-report"><h3>' + reportLabel + '</h3><pre>'
            + data.format_report
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
            + '</pre></div>';
    }

    if (data.response) {
      html += '<div class="upload-response">'
            + marked.parse(data.response)
            + '</div>';
    }

    if (!html) {
      html = '<p>No response received.</p>';
    }

    resultDiv.innerHTML = html;

  } catch (error) {
    const messages = currentAgent.messages || {};
    resultDiv.innerHTML = `<p class="upload-error">${messages.error || 'Processing failed. Please try again.'}</p>`;
    console.error('Upload error:', error);
  }

  fileInput.disabled = false;
  uploadBtn.disabled = false;
  fileInput.value = '';
}

// ----------------------
// Chat Mode
// ----------------------
function renderChatMode(container, session, agent) {
  selectedModel = DEFAULT_MODEL;
  selectedEffort = null;
  thinkingEnabled = false;

  const modelOptions = Object.entries(MODELS)
    .map(([id, config]) =>
      `<option value="${id}"${id === selectedModel ? ' selected' : ''}>${config.displayName}</option>`
    ).join('');

  const fileUploadEnabled = agent.features?.fileUpload?.enabled || false;
  const uploadButtonHTML = fileUploadEnabled
    ? `<input type="file" id="fileInput" accept="${agent.features.fileUpload.acceptedTypes?.join(',') || '*'}" style="display:none;">
       <button class="btn-attach" id="attachBtn">${agent.features.fileUpload.buttonLabel || '📎'}</button>`
    : '';

  container.innerHTML = `
    <div class="chat-view">
      <div class="sidebar-overlay" id="sidebarOverlay"></div>

      <aside class="chat-sidebar" id="chatSidebar">
        <div class="sidebar-header">
          <button class="btn-sidebar-close" id="sidebarClose">&times;</button>
        </div>
        <h2 class="sidebar-agent-name">${agent.icon || ''} ${agent.name}</h2>

        <div class="sidebar-section">
          <label for="modelSelect" class="sidebar-label">Model</label>
          <select id="modelSelect" class="sidebar-select">${modelOptions}</select>
        </div>

        <div class="sidebar-section" id="effortSection" style="display: none;">
          <label for="effortSelect" class="sidebar-label">Effort</label>
          <select id="effortSelect" class="sidebar-select"></select>
        </div>

        <div class="sidebar-section" id="thinkingSection">
          <label class="sidebar-toggle-label">
            <input type="checkbox" id="thinkingToggle"> Deep Reasoning
          </label>
        </div>

        <button class="btn-end-chat" id="backBtn">End Chat</button>
      </aside>

      <div class="chat-main">
        <div class="chat-main-header">
          <button class="btn-sidebar-toggle" id="sidebarToggle">&#9776;</button>
          <span class="chat-main-agent-name">${agent.icon || ''} ${agent.name}</span>
        </div>
        <div class="chat-messages" id="chatMessages"></div>
        <div class="chat-input">
          <textarea id="messageInput" placeholder="Type a message..." rows="1"></textarea>
          <div class="chat-input-actions">
            ${uploadButtonHTML}
            <button class="btn-send" id="sendBtn">Send</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // End chat (navigates to dashboard)
  document.getElementById('backBtn').addEventListener('click', () => navigate('dashboard'));

  // Sidebar toggle (mobile)
  document.getElementById('sidebarToggle').addEventListener('click', () => toggleSidebar(true));
  document.getElementById('sidebarClose').addEventListener('click', () => toggleSidebar(false));
  document.getElementById('sidebarOverlay').addEventListener('click', () => toggleSidebar(false));

  // Model selector
  document.getElementById('modelSelect').addEventListener('change', (e) => {
    selectedModel = e.target.value;
    updateModelControls();
  });

  // Effort selector
  document.getElementById('effortSelect').addEventListener('change', (e) => {
    selectedEffort = e.target.value;
  });

  // Thinking toggle
  document.getElementById('thinkingToggle').addEventListener('change', (e) => {
    thinkingEnabled = e.target.checked;
  });

  // Send button
  document.getElementById('sendBtn').addEventListener('click', sendMessage);

  // Textarea
  setupTextarea();

  // File upload in chat mode
  if (fileUploadEnabled) {
    document.getElementById('attachBtn').addEventListener('click', () => {
      document.getElementById('fileInput').click();
    });
    document.getElementById('fileInput').addEventListener('change', handleFileUpload);
  }

  // Initialize controls for default model
  updateModelControls();

  document.getElementById('messageInput').focus();
}

// ----------------------
// Sidebar helpers
// ----------------------
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function updateModelControls() {
  const model = MODELS[selectedModel];
  const effortSection = document.getElementById('effortSection');
  const effortSelect = document.getElementById('effortSelect');

  if (model && model.effortLevels) {
    effortSection.style.display = '';
    const previousEffort = selectedEffort;

    effortSelect.innerHTML = model.effortLevels
      .map(level => `<option value="${level}">${capitalize(level)}</option>`)
      .join('');

    if (previousEffort && model.effortLevels.includes(previousEffort)) {
      effortSelect.value = previousEffort;
      selectedEffort = previousEffort;
    } else {
      effortSelect.value = 'low';
      selectedEffort = 'low';
    }
  } else {
    effortSection.style.display = 'none';
    selectedEffort = null;
  }
}

function toggleSidebar(open) {
  document.getElementById('chatSidebar').classList.toggle('open', open);
  document.getElementById('sidebarOverlay').classList.toggle('open', open);
}

function setupTextarea() {
  const textarea = document.getElementById('messageInput');
  const maxHeight = 200;

  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.overflow = 'hidden';
    if (textarea.scrollHeight > maxHeight) {
      textarea.style.height = maxHeight + 'px';
      textarea.style.overflow = 'auto';
    } else {
      textarea.style.height = textarea.scrollHeight + 'px';
    }
  });

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

// ----------------------
// Send message
// ----------------------
async function sendMessage() {
  const textarea = document.getElementById('messageInput');
  const message = textarea.value.trim();
  if (!message) return;

  addMessage('user', message);
  textarea.value = '';
  textarea.style.height = 'auto';

  textarea.disabled = true;
  document.getElementById('sendBtn').disabled = true;

  const thinkingId = addThinking();

  try {
    const payload = {
      message: message,
      agentId: currentAgent.id,
      model: selectedModel,
    };

    if (selectedEffort) {
      payload.effort = selectedEffort;
    }
    if (thinkingEnabled) {
      payload.thinking = true;
    }

    const response = await fetch(`${CONFIG.PROXY_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${currentSession.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    removeMessage(thinkingId);

    if (!response.ok) {
      if (response.status === 401) {
        navigate('login');
        return;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    const meta = {
      display_name: data.display_name || null,
      effort: data.effort || null,
      thinking: data.thinking || false,
      fallback: data.fallback || false,
    };

    addMessage('agent', data.response, meta);

  } catch (error) {
    removeMessage(thinkingId);
    addMessage('system', 'Unable to reach agent. Please try again.');
    console.error('Chat error:', error);
  }

  textarea.disabled = false;
  document.getElementById('sendBtn').disabled = false;
  textarea.focus();
}

// ----------------------
// File upload in chat mode (unchanged)
// ----------------------
async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const uploadConfig = currentAgent.features?.fileUpload;

  if (!uploadConfig?.enabled) {
    addMessage('system', 'File upload not supported for this agent.');
    return;
  }

  if (uploadConfig.acceptedTypes && uploadConfig.acceptedTypes.length > 0) {
    if (!uploadConfig.acceptedTypes.includes(file.type)) {
      addMessage('system', 'Invalid file type.');
      return;
    }
  }

  addMessage('user', `📄 Uploaded: ${file.name}`);

  const textarea = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const attachBtn = document.getElementById('attachBtn');

  textarea.disabled = true;
  sendBtn.disabled = true;
  attachBtn.disabled = true;

  const thinkingId = addThinking();

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('agentId', currentAgent.id);
    formData.append('endpoint', uploadConfig.endpoint || 'upload');

    const response = await fetch(`${CONFIG.PROXY_URL}/api/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${currentSession.token}`
      },
      body: formData
    });

    removeMessage(thinkingId);

    if (!response.ok) {
      if (response.status === 401) {
        navigate('login');
        return;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    addMessage('agent', data.response);

  } catch (error) {
    removeMessage(thinkingId);
    addMessage('system', 'Unable to process file. Please try again.');
    console.error('Upload error:', error);
  }

  textarea.disabled = false;
  sendBtn.disabled = false;
  attachBtn.disabled = false;

  event.target.value = '';
}

// ----------------------
// Message helpers
// ----------------------
function addMessage(role, text, meta = null) {
  const messages = document.getElementById('chatMessages');
  const div = document.createElement('div');
  const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  div.id = id;
  div.className = `message message-${role}`;

  if (role === 'agent') {
    div.innerHTML = marked.parse(text);

    if (meta) {
      const metaDiv = document.createElement('div');
      metaDiv.className = 'message-meta';
      const parts = [];
      if (meta.display_name) parts.push(meta.display_name);
      if (meta.effort) parts.push(capitalize(meta.effort));
      if (meta.thinking) parts.push('Deep Reasoning');
      if (meta.fallback) parts.push('Fallback');
      if (parts.length) {
        metaDiv.textContent = parts.join(' · ');
        div.appendChild(metaDiv);
      }
    }
  } else {
    div.textContent = text;
  }

  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return id;
}

function addThinking() {
  const messages = document.getElementById('chatMessages');
  const div = document.createElement('div');
  const id = `msg-thinking-${Date.now()}`;
  div.id = id;
  div.className = 'message message-thinking';
  div.innerHTML = 'Thinking<span class="thinking-dots"></span>';
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return id;
}

function removeMessage(id) {
  const msg = document.getElementById(id);
  if (msg) msg.remove();
}