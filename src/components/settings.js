/**
 * settings.js — Settings modal for API keys
 */

import { getStored, setStored, showToast } from '../utils/helpers.js';

let currentOnSave = null;

/**
 * Create and show the settings modal.
 */
export function showSettings(onSave = null) {
  currentOnSave = onSave;

  // Remove existing modal if any
  const existing = document.getElementById('settings-modal');
  if (existing) existing.remove();

  const groqKey = getStored('groq_key') || '';
  const ghToken = getStored('github_token') || '';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'settings-modal';

  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>⚙️ Settings</h2>
        <button class="modal-close" id="modal-close">✕</button>
      </div>
      <div class="modal-body">
        <div class="modal-section">
          <label for="groq-key-input">Groq API Key</label>
          <input type="password" class="modal-input" id="groq-key-input"
            placeholder="gsk_..." value="${groqKey}" />
          <p class="help-text">
            Free at <a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a>
            — powers AI analysis using Llama 3.3 70B
          </p>
        </div>
        <div class="modal-section">
          <label for="gh-token-input">GitHub Token <span style="color:var(--text-dim)">(optional)</span></label>
          <input type="password" class="modal-input" id="gh-token-input"
            placeholder="ghp_..." value="${ghToken}" />
          <p class="help-text">
            Increases API rate limit from 60 to 5,000 requests/hour.
            <a href="https://github.com/settings/tokens" target="_blank">Generate token</a>
            (no permissions needed for public repos)
          </p>
        </div>
      </div>
      <div class="modal-footer">
        <button class="modal-btn ghost" id="modal-cancel">Cancel</button>
        <button class="modal-btn primary" id="modal-save">Save</button>
      </div>
    </div>
  `;

  // Close handlers
  const close = () => overlay.remove();

  overlay.querySelector('#modal-close').addEventListener('click', close);
  overlay.querySelector('#modal-cancel').addEventListener('click', close);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  // Save handler
  overlay.querySelector('#modal-save').addEventListener('click', () => {
    const newGroqKey = overlay.querySelector('#groq-key-input').value.trim();
    const newGhToken = overlay.querySelector('#gh-token-input').value.trim();

    setStored('groq_key', newGroqKey);
    setStored('github_token', newGhToken);

    // Also store github token without prefix for the github module
    if (newGhToken) {
      localStorage.setItem('repoverse_github_token', newGhToken);
    } else {
      localStorage.removeItem('repoverse_github_token');
    }

    showToast('Settings saved!', 'success');
    close();

    if (currentOnSave) currentOnSave();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', function handler(e) {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', handler);
    }
  });

  document.body.appendChild(overlay);
}

/**
 * Create the settings gear button.
 */
export function createSettingsButton(onSave = null) {
  const btn = document.createElement('button');
  btn.className = 'settings-btn glass';
  btn.id = 'settings-btn';
  btn.title = 'Settings';
  btn.textContent = '⚙️';
  btn.addEventListener('click', () => showSettings(onSave));
  return btn;
}
