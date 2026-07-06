import { CONFIG } from './config.js';
import { navigate } from './app.js';

/** @typedef {import('./types.js').Session} Session */
/** @typedef {import('./types.js').Agent} Agent */
/** @typedef {import('./types.js').ModelConfig} ModelConfig */
/** @typedef {import('./types.js').MessageMeta} MessageMeta */

// ----------------------
// Model state
// ----------------------

/** @type {Record<string, ModelConfig>} */
let models = {};

/** @type {string} */
let defaultModel = '';

/** @type {Agent|null} */
let currentAgent = null;

/** @type {Session|null} */
let currentSession = null;

/** @type {string} */
let selectedModel = '';

/** @type {string|null} */
let selectedEffort = null;

/** @type {boolean} */
let thinkingEnabled = false;

// ----------------------
// Entry point
// ----------------------

/**
 * @param {HTMLElement} container
 * @param {Session} session
 * @param {Agent} agent
 */
export async function renderChat(container, session, agent) {
  currentAgent = agent;
  currentSession = session;

  const mode = agent.mode || 'chat';

  if (mode === 'upload') {
    renderUploadMode(container, agent);
    return;
  }

  try {
    const response = await fetch(`${CONFIG.PROXY_URL}/api/models?agentId=${agent.id}`, {
      headers: {
        'Authorization': `Bearer ${session.token}`
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        navigate('login');
        return;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    models = data.models;
    defaultModel = data.default;
    selectedModel = defaultModel;

  } catch (error) {
    console.error('Failed to load models:', error);
    models = {};
    defaultModel = '';
    selectedModel = '';
  }

  renderChatMode(container, session, agent);
}

// ----------------------
// Upload Mode
// ----------------------

/**
 * @param {HTMLElement} container
 * @param {Agent} agent
 */
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

  const backBtn = document.getElementById('backBtn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      navigate('dashboard');
    });
  }

  const uploadBtn = document.getElementById('uploadBtn');
  if (uploadBtn) {
    uploadBtn.addEventListener('click', submitUpload);
  }
}

/** @returns {Promise<void>} */
async function submitUpload() {
  const fileInput = /** @type {HTMLInputElement|null} */ (document.getElementById('fileInput'));
  if (!fileInput) return;

  const file = fileInput.files?.[0];
  if (!file) return;
  if (!currentAgent || !currentSession) return;

  const uploadConfig = currentAgent.features?.fileUpload || {};

  if (uploadConfig.acceptedTypes && uploadConfig.acceptedTypes.length > 0) {
    if (!uploadConfig.acceptedTypes.includes(file.type)) {
      const resultDiv = document.getElementById('uploadResult');
      if (resultDiv) {
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '<p class="upload-error">Invalid file type.</p>';
      }
      return;
    }
  }

  const prompt = document.getElementById('uploadPrompt');
  const resultDiv = document.getElementById('uploadResult');
  const agentMessages = currentAgent.messages || {};

  if (prompt) {
    prompt.style.display = 'none';
  }
  if (resultDiv) {
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `<div class="message-thinking">${agentMessages.loading || 'Processing'}<span class="thinking-dots"></span></div>`;
  }

  const uploadBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('uploadBtn'));
  fileInput.disabled = true;
  if (uploadBtn) {
    uploadBtn.disabled = true;
  }

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

    if (resultDiv) {
      resultDiv.innerHTML = html;
    }

  } catch (error) {
    const errorMessages = currentAgent?.messages || {};
    if (resultDiv) {
      resultDiv.innerHTML = `<p class="upload-error">${errorMessages.error || 'Processing failed. Please try again.'}</p>`;
    }
    console.error('Upload error:', error);
  }

  fileInput.disabled = false;
  if (uploadBtn) {
    uploadBtn.disabled = false;
  }
  fileInput.value = '';
}

// ----------------------
// Chat Mode
// ----------------------

/**
 * @param {HTMLElement} container
 * @param {Session} session
 * @param {Agent} agent
 */
function renderChatMode(container, session, agent) {
  selectedModel = defaultModel;
  selectedEffort = null;
  thinkingEnabled = false;

  const modelOptions = Object.entries(models)
    .map(([id, config]) =>
      `<option value="${id}"${id === selectedModel ? ' selected' : ''}>${config.display_name}</option>`
    ).join('');

  const fileUploadEnabled = agent.features?.fileUpload?.enabled || false;
  const uploadButtonHTML = fileUploadEnabled
    ? `<input type="file" id="fileInput" accept="${agent.features?.fileUpload?.acceptedTypes?.join(',') || '*'}" style="display:none;">
       <button class="btn-attach" id="attachBtn">${agent.features?.fileUpload?.buttonLabel || '📎'}</button>`
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

        <div class="sidebar-section sidebar-history-note" id="historyNote"></div>

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
  const backBtn = document.getElementById('backBtn');
  if (backBtn) {
    backBtn.addEventListener('click', () => navigate('dashboard'));
  }

  // Sidebar toggle (mobile)
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebarClose = document.getElementById('sidebarClose');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => toggleSidebar(true));
  }
  if (sidebarClose) {
    sidebarClose.addEventListener('click', () => toggleSidebar(false));
  }
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => toggleSidebar(false));
  }

  // Model selector
  const modelSelect = document.getElementById('modelSelect');
  if (modelSelect) {
    modelSelect.addEventListener('change', (e) => {
      const target = /** @type {HTMLSelectElement} */ (e.target);
      selectedModel = target.value;
      updateModelControls();
    });
  }

  // Effort selector
  const effortSelect = document.getElementById('effortSelect');
  if (effortSelect) {
    effortSelect.addEventListener('change', (e) => {
      const target = /** @type {HTMLSelectElement} */ (e.target);
      selectedEffort = target.value;
    });
  }

  // Thinking toggle
  const thinkingToggle = document.getElementById('thinkingToggle');
  if (thinkingToggle) {
    thinkingToggle.addEventListener('change', (e) => {
      const target = /** @type {HTMLInputElement} */ (e.target);
      thinkingEnabled = target.checked;
    });
  }

  // Send button
  const sendBtn = document.getElementById('sendBtn');
  if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
  }

  // Textarea
  setupTextarea();

  // File upload in chat mode
  if (fileUploadEnabled) {
    const attachBtn = document.getElementById('attachBtn');
    const fileInput = document.getElementById('fileInput');
    if (attachBtn && fileInput) {
      attachBtn.addEventListener('click', () => {
        fileInput.click();
      });
      fileInput.addEventListener('change', handleFileUpload);
    }
  }

  // Initialize controls for default model
  updateModelControls();

  // Load conversation history
  loadHistory();

  const messageInput = document.getElementById('messageInput');
  if (messageInput) {
    messageInput.focus();
  }
}

// ----------------------
// History loading
// ----------------------

/** @returns {Promise<void>} */
async function loadHistory() {
  if (!currentAgent || !currentSession) return;

  try {
    const response = await fetch(
      `${CONFIG.PROXY_URL}/api/history?agentId=${currentAgent.id}`,
      {
        headers: {
          'Authorization': `Bearer ${currentSession.token}`
        }
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        navigate('login');
        return;
      }
      console.error('Failed to load history:', response.status);
      return;
    }

    const data = await response.json();
    const messages = data.messages;

    if (!messages || messages.length === 0) return;

    const firstSeq = messages[0].seq;
    const lastSeq = messages[messages.length - 1].seq;

    for (const msg of messages) {
      if (msg.role === 'assistant') {
        /** @type {MessageMeta|null} */
        const meta = msg.metadata ? {
          display_name: msg.metadata.display_name || null,
          effort: msg.metadata.effort || null,
          thinking: msg.metadata.thinking || false,
          fallback: msg.metadata.fallback || false,
        } : null;
        addMessage('agent', msg.content, meta, msg.seq);
      } else {
        addMessage('user', msg.content, null, msg.seq);
      }
    }

    const historyNote = document.getElementById('historyNote');
    if (historyNote) {
      historyNote.textContent = `Last ${messages.length} messages loaded for reference: sequence ${firstSeq}–${lastSeq}.`;
    }

  } catch (error) {
    console.error('History load error:', error);
  }
}

// ----------------------
// Sidebar helpers
// ----------------------

/**
 * @param {string} str
 * @returns {string}
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** @returns {void} */
function updateModelControls() {
  const model = models[selectedModel];
  const effortSection = document.getElementById('effortSection');
  const effortSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('effortSelect'));

  if (!effortSection || !effortSelect) return;

  if (model && model.effort_levels) {
    effortSection.style.display = '';
    const previousEffort = selectedEffort;

    effortSelect.innerHTML = model.effort_levels
      .map(level => `<option value="${level}">${capitalize(level)}</option>`)
      .join('');

    if (previousEffort && model.effort_levels.includes(previousEffort)) {
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

/**
 * @param {boolean} open
 * @returns {void}
 */
function toggleSidebar(open) {
  const sidebar = document.getElementById('chatSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar) {
    sidebar.classList.toggle('open', open);
  }
  if (overlay) {
    overlay.classList.toggle('open', open);
  }
}

/** @returns {void} */
function setupTextarea() {
  const textarea = /** @type {HTMLTextAreaElement|null} */ (document.getElementById('messageInput'));
  if (!textarea) return;

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

/** @returns {Promise<void>} */
async function sendMessage() {
  const textarea = /** @type {HTMLTextAreaElement|null} */ (document.getElementById('messageInput'));
  const sendBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('sendBtn'));
  if (!textarea || !currentAgent || !currentSession) return;

  const message = textarea.value.trim();
  if (!message) return;

  // Seq not yet known — will be assigned by backend
  addMessage('user', message);
  textarea.value = '';
  textarea.style.height = 'auto';

  textarea.disabled = true;
  if (sendBtn) {
    sendBtn.disabled = true;
  }

  const thinkingId = addThinking();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);
  const startTime = Date.now();

  console.log(`[${new Date().toISOString()}] Sending to ${currentAgent.id}, model: ${selectedModel}, effort: ${selectedEffort}, thinking: ${thinkingEnabled}`);

  try {
    /** @type {Record<string, string|boolean>} */
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
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    console.log(`[${new Date().toISOString()}] Response received: ${response.status} (${Date.now() - startTime}ms)`);

    removeMessage(thinkingId);

    if (!response.ok) {
      if (response.status === 401) {
        navigate('login');
        return;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    // Update the user message with its actual seq
    const userSeq = data.seq;
    const assistantSeq = data.seq + 1;
    updateLastUserSeq(userSeq);

    /** @type {MessageMeta} */
    const meta = {
      display_name: data.display_name || null,
      effort: data.effort || null,
      thinking: data.thinking || false,
      fallback: data.fallback || false,
    };

    addMessage('agent', data.response, meta, assistantSeq);

  } catch (error) {
    clearTimeout(timeoutId);
    removeMessage(thinkingId);

    const elapsed = Date.now() - startTime;

    if (error instanceof Error && error.name === 'AbortError') {
      console.log(`[${new Date().toISOString()}] Request timed out after ${elapsed}ms`);
      addMessage('system', 'The agent took too long to respond. It may be starting up — please try again in a moment.');
    } else {
      console.log(`[${new Date().toISOString()}] Request failed after ${elapsed}ms`);
      addMessage('system', 'Unable to reach agent. Please try again.');
    }
    console.error('Chat error:', error);
  }

  textarea.disabled = false;
  if (sendBtn) {
    sendBtn.disabled = false;
  }
  textarea.focus();
}

// ----------------------
// File upload in chat mode
// ----------------------

/**
 * @param {Event} event
 * @returns {Promise<void>}
 */
async function handleFileUpload(event) {
  const target = /** @type {HTMLInputElement} */ (event.target);
  const file = target.files?.[0];
  if (!file) return;
  if (!currentAgent || !currentSession) return;

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

  const textarea = /** @type {HTMLTextAreaElement|null} */ (document.getElementById('messageInput'));
  const sendBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('sendBtn'));
  const attachBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('attachBtn'));

  if (textarea) textarea.disabled = true;
  if (sendBtn) sendBtn.disabled = true;
  if (attachBtn) attachBtn.disabled = true;

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

  if (textarea) textarea.disabled = false;
  if (sendBtn) sendBtn.disabled = false;
  if (attachBtn) attachBtn.disabled = false;

  target.value = '';
}

// ----------------------
// Message helpers
// ----------------------

/**
 * @param {string} role
 * @param {string} text
 * @param {MessageMeta|null} [meta]
 * @param {number|null} [seq]
 * @returns {string}
 */
function addMessage(role, text, meta = null, seq = null) {
  const messages = document.getElementById('chatMessages');
  if (!messages) return '';

  const div = document.createElement('div');
  const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  div.id = id;
  div.className = `message message-${role}`;

  // Seq label
  if (seq !== null) {
    const seqSpan = document.createElement('span');
    seqSpan.className = 'message-seq';
    seqSpan.textContent = `#${seq}`;
    div.appendChild(seqSpan);
  }

  if (role === 'agent') {
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = marked.parse(text);
    div.appendChild(contentDiv);

    if (meta) {
      const metaDiv = document.createElement('div');
      metaDiv.className = 'message-meta';
      /** @type {string[]} */
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
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = text;
    div.appendChild(contentDiv);
  }

  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return id;
}

/**
 * Update the last user message's seq after the backend assigns it.
 * @param {number} seq
 * @returns {void}
 */
function updateLastUserSeq(seq) {
  const messages = document.getElementById('chatMessages');
  if (!messages) return;

  const userMessages = messages.querySelectorAll('.message-user');
  const lastUser = userMessages[userMessages.length - 1];
  if (!lastUser) return;

  let seqSpan = lastUser.querySelector('.message-seq');
  if (!seqSpan) {
    seqSpan = document.createElement('span');
    seqSpan.className = 'message-seq';
    lastUser.insertBefore(seqSpan, lastUser.firstChild);
  }
  seqSpan.textContent = `#${seq}`;
}

/** @returns {string} */
function addThinking() {
  const messages = document.getElementById('chatMessages');
  if (!messages) return '';

  const div = document.createElement('div');
  const id = `msg-thinking-${Date.now()}`;
  div.id = id;
  div.className = 'message message-thinking';
  div.innerHTML = 'Thinking<span class="thinking-dots"></span>';
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return id;
}

/**
 * @param {string} id
 * @returns {void}
 */
function removeMessage(id) {
  const msg = document.getElementById(id);
  if (msg) msg.remove();
}