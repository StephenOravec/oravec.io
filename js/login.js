import { CONFIG } from './config.js';
import { navigate, setSession } from './app.js';

/** @type {{ requestCode: () => void } | undefined} */
let client;

/**
 * @param {HTMLElement} container
 * @returns {void}
 */
export function renderLogin(container) {
  container.innerHTML = `
    <div class="login-view">
      <div class="login-box">
        <h1>oravec.io</h1>
        <p>AI Agent Dashboard</p>
        <img id="loginButton" class="btn-login-img" src="/img/google-signin.png" alt="Sign in with Google">
      </div>
    </div>
  `;

  const loginButton = document.getElementById('loginButton');
  if (loginButton) {
    loginButton.addEventListener('click', () => {
      if (client) {
        client.requestCode();
      }
    });
  }

  initLogin();
}

/** @returns {void} */
export function initLogin() {
  if (window.google?.accounts?.oauth2) {
    client = google.accounts.oauth2.initCodeClient({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      scope: 'openid email profile',
      ux_mode: 'popup',
      callback: handleAuthResponse
    });
    return;
  }

  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.onload = () => {
    client = google.accounts.oauth2.initCodeClient({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      scope: 'openid email profile',
      ux_mode: 'popup',
      callback: handleAuthResponse
    });
  };
  document.head.appendChild(script);
}

/**
 * @param {{ code?: string }} response
 * @returns {Promise<void>}
 */
async function handleAuthResponse(response) {
  if (!response.code) return;

  const loginBtn = document.getElementById('loginButton');
  const status = document.createElement('p');
  status.className = 'login-status';
  status.textContent = 'Verifying...';

  if (loginBtn) {
    loginBtn.after(status);
  }

  try {
    const result = await fetch(`${CONFIG.PROXY_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: response.code })
    });

    if (!result.ok) {
      if (loginBtn) {
        loginBtn.classList.add('btn-login-disabled');
      }
      status.className = 'login-error';
      status.textContent = 'Unauthorized';
      return;
    }

    const data = await result.json();
    setSession(data.session_token);
    navigate('dashboard');

  } catch (error) {
    if (loginBtn) {
      loginBtn.classList.add('btn-login-disabled');
    }
    status.className = 'login-error';
    status.textContent = 'Unauthorized';
    console.error('Login error:', error);
  }
}