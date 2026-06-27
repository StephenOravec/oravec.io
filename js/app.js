import { CONFIG } from './config.js';
import { renderLogin } from './login.js';
import { renderDashboard } from './dashboard.js';
import { renderChat } from './chat.js';

/** @typedef {import('./types.js').Session} Session */
/** @typedef {import('./types.js').Agent} Agent */


const app = /** @type {HTMLElement} */ (document.getElementById('app'));
if (!app) {
  throw new Error('Missing #app element');
}

/** @type {{ token: string | null }} */
let session = {
  token: null
};

/**
 * @param {'login' | 'dashboard' | 'chat'} view
 * @param {{ agent?: Agent }} [data]
 * @returns {void}
 */
export function navigate(view, data = {}) {
  switch (view) {
    case 'login':
      session.token = null;
      localStorage.removeItem('session_token');
      renderLogin(app);
      break;
    case 'dashboard':
      if (!session.token) {
        renderLogin(app);
        return;
      }
      renderDashboard(app, /** @type {Session} */ (session));
      break;
    case 'chat':
      if (!session.token || !data?.agent) {
        renderLogin(app);
        return;
      }
      renderChat(app, /** @type {Session} */ (session), data.agent);
      break;
  }
}

/**
 * @param {string} token
 * @returns {void}
 */
export function setSession(token) {
  session.token = token;
  localStorage.setItem('session_token', token);
}

/** @returns {Promise<void>} */
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
        session.token = savedToken;
        navigate('dashboard');
        return;
      }
    } catch (error) {
      console.error('Session validation failed:', error);
    }

    localStorage.removeItem('session_token');
  }

  renderLogin(app);
}

init();