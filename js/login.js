import { CONFIG } from './config.js';
import { navigate, setSession } from './app.js';

let client;

export function renderLogin(container) {
  container.innerHTML = `
    <div class="login-view">
      <div class="login-box">
        <h1>oravec.io</h1>
        <p>Sign in to access your dashboard</p>
        <img id="loginButton" class="btn-login-img" src="/img/google-signin.png" alt="Sign in with Google">
      </div>
    </div>
  `;

  document.getElementById('loginButton').addEventListener('click', () => {
    if (client) {
      client.requestCode();
    }
  });

  initLogin();
}

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

async function handleAuthResponse(response) {
  if (!response.code) return;

  try {
    const result = await fetch(`${CONFIG.PROXY_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: response.code })
    });

    if (!result.ok) return;

    const data = await result.json();
    setSession(data.session_token, data.user);
    navigate('dashboard');

  } catch (error) {
    console.error('Login error:', error);
  }
}