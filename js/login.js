import { CONFIG } from './config.js';
import { navigate, setSession } from './app.js';

export function renderLogin(container) {
  container.innerHTML = `
    <div class="login-view">
      <div class="login-box">
        <h1>oravec.io</h1>
        <p>Sign in to access your dashboard</p>
        <div id="signin-placeholder"></div>
        <p id="login-status"></p>
      </div>
    </div>
  `;
}

export function initLogin() {
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.onload = () => {
    setupGoogleSignIn();
  };
  document.head.appendChild(script);
}

function setupGoogleSignIn() {
  google.accounts.id.initialize({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    callback: handleCredentialResponse
  });

  // Create container dynamically so Google can't auto-render into it
  const container = document.getElementById('signin-placeholder');
  const signinDiv = document.createElement('div');
  signinDiv.id = 'g_id_signin';
  container.appendChild(signinDiv);

  google.accounts.id.renderButton(
    signinDiv,
    {
      theme: 'filled_black',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular',
      width: 280
    }
  );
}

async function handleCredentialResponse(response) {
  const status = document.getElementById('login-status');
  status.textContent = 'Verifying...';

  try {
    const result = await fetch(`${CONFIG.PROXY_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential })
    });

    if (!result.ok) {
      const error = await result.json();
      status.textContent = error.detail || 'Unauthorized';
      return;
    }

    const data = await result.json();
    setSession(data.session_token, data.user);
    navigate('dashboard');

  } catch (error) {
    status.textContent = 'Connection error. Please try again.';
    console.error('Login error:', error);
  }
}