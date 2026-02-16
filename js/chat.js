import { CONFIG } from './config.js';
import { navigate } from './app.js';

let currentAgent = null;
let currentSession = null;

export function renderChat(container, session, agent) {
  currentAgent = agent;
  currentSession = session;

  // Check agent mode
  const isEvaluateOnly = agent.mode === 'evaluate-only';

  if (isEvaluateOnly) {
    renderEvaluateOnly(container, agent);
  } else {
    renderChatMode(container, session, agent);
  }
}

// ----------------------
// Evaluate-Only Mode
// ----------------------
function renderEvaluateOnly(container, agent) {
  const acceptedTypes = agent.features?.fileUpload?.acceptedTypes?.join(',') || 'application/pdf';

  container.innerHTML = `
    <div class="chat-view">
      <div class="chat-header">
        <button class="btn-back" id="backBtn">&larr; Back</button>
        <h2>${agent.icon} ${agent.name}</h2>
      </div>
      <div class="evaluate-container" id="evaluateContainer">
        <div class="evaluate-prompt" id="evaluatePrompt">
          <p>Upload PDF to evaluate.</p>
        </div>
        <div class="evaluate-result" id="evaluateResult" style="display:none;"></div>
      </div>
      <div class="evaluate-input">
        <input type="file" id="fileInput" accept="${acceptedTypes}">
        <button class="btn-send" id="evaluateBtn">Evaluate</button>
      </div>
    </div>
  `;

  document.getElementById('backBtn').addEventListener('click', () => {
    navigate('dashboard');
  });

  document.getElementById('evaluateBtn').addEventListener('click', submitEvaluation);
}

async function submitEvaluation() {
  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files[0];

  if (!file) {
    return;
  }

  // Validate file type
  const uploadConfig = currentAgent.features?.fileUpload;
  if (uploadConfig?.acceptedTypes && uploadConfig.acceptedTypes.length > 0) {
    if (!uploadConfig.acceptedTypes.includes(file.type)) {
      const resultDiv = document.getElementById('evaluateResult');
      resultDiv.style.display = 'block';
      resultDiv.innerHTML = '<p class="evaluate-error">Please upload a PDF file.</p>';
      return;
    }
  }

  // Clear previous result
  const prompt = document.getElementById('evaluatePrompt');
  const resultDiv = document.getElementById('evaluateResult');
  prompt.style.display = 'none';
  resultDiv.style.display = 'block';
  resultDiv.innerHTML = '<div class="message-thinking">Evaluating<span class="thinking-dots"></span></div>';

  // Disable controls
  const evaluateBtn = document.getElementById('evaluateBtn');
  fileInput.disabled = true;
  evaluateBtn.disabled = true;

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('agentId', currentAgent.id);
    formData.append('endpoint', uploadConfig?.endpoint || 'evaluate');

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
    resultDiv.innerHTML = marked.parse(data.response);

  } catch (error) {
    resultDiv.innerHTML = '<p class="evaluate-error">Evaluation failed. Please try again.</p>';
    console.error('Evaluation error:', error);
  }

  // Re-enable controls and clear file input for next upload
  fileInput.disabled = false;
  evaluateBtn.disabled = false;
  fileInput.value = '';
}

// ----------------------
// Chat Mode (existing behavior)
// ----------------------
function renderChatMode(container, session, agent) {
  const fileUploadEnabled = agent.features?.fileUpload?.enabled || false;
  const uploadButtonHTML = fileUploadEnabled
    ? `<input type="file" id="fileInput" accept="${agent.features.fileUpload.acceptedTypes?.join(',') || '*'}" style="display:none;">
       <button class="btn-attach" id="attachBtn">${agent.features.fileUpload.buttonLabel || '📎 Upload File'}</button>`
    : '';

  container.innerHTML = `
    <div class="chat-view">
      <div class="chat-header">
        <button class="btn-back" id="backBtn">&larr; Back</button>
        <h2>${agent.icon} ${agent.name}</h2>
      </div>
      <div class="chat-messages" id="chatMessages"></div>
      <div class="chat-input">
        ${uploadButtonHTML}
        <input type="text" id="messageInput" placeholder="Type a message..." autocomplete="off">
        <button class="btn-send" id="sendBtn">Send</button>
      </div>
    </div>
  `;

  document.getElementById('backBtn').addEventListener('click', () => {
    navigate('dashboard');
  });

  document.getElementById('sendBtn').addEventListener('click', sendMessage);

  document.getElementById('messageInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  if (fileUploadEnabled) {
    document.getElementById('attachBtn').addEventListener('click', () => {
      document.getElementById('fileInput').click();
    });

    document.getElementById('fileInput').addEventListener('change', handleFileUpload);
  }

  document.getElementById('messageInput').focus();
}

async function sendMessage() {
  const input = document.getElementById('messageInput');
  const message = input.value.trim();
  if (!message) return;

  addMessage('user', message);
  input.value = '';

  input.disabled = true;
  document.getElementById('sendBtn').disabled = true;

  const thinkingId = addThinking();

  try {
    const response = await fetch(`${CONFIG.PROXY_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${currentSession.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: message,
        agentId: currentAgent.id
      })
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
    addMessage('system', 'Unable to reach agent. Please try again.');
    console.error('Chat error:', error);
  }

  input.disabled = false;
  document.getElementById('sendBtn').disabled = false;
  input.focus();
}

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
      addMessage('system', `Please upload a valid file type: ${uploadConfig.acceptedTypes.join(', ')}`);
      return;
    }
  }

  addMessage('user', `📄 Uploaded: ${file.name}`);

  const input = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const attachBtn = document.getElementById('attachBtn');

  input.disabled = true;
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

  input.disabled = false;
  sendBtn.disabled = false;
  attachBtn.disabled = false;

  event.target.value = '';
}

function addMessage(role, text) {
  const messages = document.getElementById('chatMessages');
  const div = document.createElement('div');
  const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  div.id = id;
  div.className = `message message-${role}`;

  if (role === 'agent') {
    div.innerHTML = marked.parse(text);
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