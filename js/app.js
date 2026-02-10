import { CONFIG } from './config.js';
import { initLogin, renderLogin } from './login.js';
import { renderDashboard } from './dashboard.js';
import { renderChat } from './chat.js';

const app = document.getElementById('app');

// Session state
let session = {
  token: null,
  user: null
};

// Navigation
export function navigate(view, data = {}) {
  switch (view) {
    case 'login':
      session.token = null;
      session.user = null;
      localStorage.removeItem('session_token');
      renderLogin(app);
      break;
    case 'dashboard':
      renderDashboard(app, session);
      break;
    case 'chat':
      renderChat(app, session, data.agent);
      break;
  }
}

export function getSession() {
  return session;
}

export function setSession(token, user) {
  session.token = token;
  session.user = user;
  localStorage.setItem('session_token', token);
}

// On load, check for existing session
async function init() {
  const savedToken = localStorage.getItem('session_token');

  if (savedToken) {
    try {
      const response = await fetch(`${CONFIG.PROXY_URL}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: savedToken })
      });

      if (response.ok) {
        const data = await response.json();
        session.token = savedToken;
        session.user = data.user;
        navigate('dashboard');
        return;
      }
    } catch (error) {
      console.error('Session validation failed:', error);
    }

    localStorage.removeItem('session_token');
  }

  renderLogin(app);
  initLogin();
}

init();