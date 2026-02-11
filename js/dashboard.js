import { CONFIG } from './config.js';
import { navigate } from './app.js';

export async function renderDashboard(container, session) {
  container.innerHTML = `
    <div class="dashboard-view">
      <div class="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <span class="user-info">${session.user.email}</span>
        </div>
        <button class="btn-logout" id="logoutBtn">Logout</button>
      </div>
      <div class="agents-grid" id="agents-grid">
        <div class="loading-agents">Loading agents...</div>
      </div>
    </div>
  `;

  document.getElementById('logoutBtn').addEventListener('click', () => {
    navigate('login');
  });

  await loadAgents(session);
}

async function loadAgents(session) {
  const grid = document.getElementById('agents-grid');

  try {
    const response = await fetch(`${CONFIG.PROXY_URL}/api/agents`, {
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

    const agents = await response.json();

    if (agents.length === 0) {
      grid.innerHTML = '<div class="no-agents">No agents assigned to your account.</div>';
      return;
    }

    grid.innerHTML = '';

    agents.forEach(agent => {
      const card = document.createElement('div');
      card.className = 'agent-card';
      card.innerHTML = `
        <h3>${agent.icon} ${agent.name}</h3>
        <p>${agent.description}</p>
      `;
      card.addEventListener('click', () => {
        navigate('chat', { agent });
      });
      grid.appendChild(card);
    });

  } catch (error) {
    grid.innerHTML = '<div class="no-agents">Unable to load agents. Please try again.</div>';
    console.error('Failed to load agents:', error);
  }
}