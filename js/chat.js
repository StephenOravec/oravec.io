import { CONFIG } from './config.js';
import { navigate } from './app.js';

let currentAgent = null;
let currentSession = null;

export function renderChat(container, session, agent) {
  currentAgent = agent;
  currentSession = session;

  // Check if this agent supports file upload
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

  // Only add file upload handlers if enabled for this agent
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

  // Disable input while waiting
  input.disabled = true;
  document.getElementById('sendBtn').disabled = true;

  // Show thinking indicator
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

  // Re-enable input
  input.disabled = false;
  document.getElementById('sendBtn').disabled = false;
  input.focus();
}

async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Get agent's file upload config
  const uploadConfig = currentAgent.features?.fileUpload;
  
  if (!uploadConfig?.enabled) {
    addMessage('system', 'File upload not supported for this agent.');
    return;
  }

  // Validate file type if specified
  if (uploadConfig.acceptedTypes && uploadConfig.acceptedTypes.length > 0) {
    if (!uploadConfig.acceptedTypes.includes(file.type)) {
      addMessage('system', `Please upload a valid file type: ${uploadConfig.acceptedTypes.join(', ')}`);
      return;
    }
  }

  addMessage('user', `📄 Uploaded: ${file.name}`);

  // Disable input while processing
  const input = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const attachBtn = document.getElementById('attachBtn');
  
  input.disabled = true;
  sendBtn.disabled = true;
  attachBtn.disabled = true;

  // Show thinking indicator
  const thinkingId = addThinking();

  try {
    // Create FormData for file upload
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

  // Re-enable input
  input.disabled = false;
  sendBtn.disabled = false;
  attachBtn.disabled = false;
  
  // Clear file input
  event.target.value = '';
}

function addMessage(role, text) {
  const messages = document.getElementById('chatMessages');
  const div = document.createElement('div');
  const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  div.id = id;
  div.className = `message message-${role}`;
  div.textContent = text;
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