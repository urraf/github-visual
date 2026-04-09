/**
 * aiAnalysis.js — AI Analysis panel (Groq LLM)
 */

import { streamAnalysis } from '../api/groq.js';
import { getStored, showToast, escapeHtml } from '../utils/helpers.js';

let analysisAbortController = null;

/**
 * Create the AI analysis panel.
 */
export function createAnalysisPanel(repoData) {
  const panel = document.createElement('div');
  panel.className = 'analysis-panel';
  panel.id = 'analysis-panel';

  const apiKey = getStored('groq_key');

  panel.innerHTML = `
    <div class="panel-header">
      <span class="panel-title">🤖 AI Analysis</span>
      <button class="panel-action" id="collapse-analysis" title="Close">✕</button>
    </div>
    <div class="analysis-content" id="analysis-content">
      ${apiKey ? createLoadingState() : createSetupPrompt()}
    </div>
    <div class="analysis-actions" id="analysis-actions" style="${apiKey ? '' : 'display:none'}">
      <button class="analysis-action-btn primary" id="btn-regenerate">
        ↻ Regenerate
      </button>
      <button class="analysis-action-btn secondary" id="btn-download-md">
        ↓ Markdown
      </button>
    </div>
  `;

  const collapseBtn = panel.querySelector('#collapse-analysis');
  collapseBtn.addEventListener('click', () => {
    panel.classList.toggle('collapsed');
  });

  // Regenerate
  panel.querySelector('#btn-regenerate')?.addEventListener('click', () => {
    runAnalysis(panel, repoData);
  });

  // Download as Markdown
  panel.querySelector('#btn-download-md')?.addEventListener('click', () => {
    downloadAnalysis(repoData);
  });

  // Auto-start analysis if key is available
  if (apiKey) {
    setTimeout(() => runAnalysis(panel, repoData), 500);
  }

  return panel;
}

function createSetupPrompt() {
  return `
    <div class="ai-setup-prompt">
      <div style="font-size:2.5rem;opacity:0.5">🤖</div>
      <h4 style="color:var(--text-primary)">AI Analysis</h4>
      <p>Add your free Groq API key in Settings to get AI-powered analysis of this repository.</p>
      <p style="font-size:0.75rem">Get a free key at <a href="https://console.groq.com" target="_blank">console.groq.com</a></p>
      <button class="ai-setup-btn" onclick="document.getElementById('settings-btn')?.click()">
        ⚙️ Open Settings
      </button>
    </div>
  `;
}

function createLoadingState() {
  return `
    <div class="ai-setup-prompt">
      <div class="spinner large"></div>
      <h4 style="color:var(--text-primary)">Analyzing Repository…</h4>
      <p>Sending structure to Llama 3.3 70B via Groq</p>
    </div>
  `;
}

/**
 * Run the AI analysis.
 */
async function runAnalysis(panel, repoData) {
  const apiKey = getStored('groq_key');
  if (!apiKey) {
    const content = panel.querySelector('#analysis-content');
    content.innerHTML = createSetupPrompt();
    panel.querySelector('#analysis-actions').style.display = 'none';
    return;
  }

  const content = panel.querySelector('#analysis-content');
  content.innerHTML = createLoadingState();
  panel.querySelector('#analysis-actions').style.display = '';

  try {
    const { tree, readme, repoInfo } = repoData;
    const repoName = `${repoInfo.owner.login}/${repoInfo.name}`;

    let fullText = '';
    content.innerHTML = `<div id="ai-output" class="analysis-section" style="background:transparent;border:none;padding:0"></div>`;
    const outputEl = content.querySelector('#ai-output');

    await streamAnalysis(apiKey, repoName, tree, readme, (chunk, accumulated) => {
      fullText = accumulated;
      outputEl.innerHTML = renderMarkdown(accumulated) + '<span class="ai-cursor"></span>';
      content.scrollTop = content.scrollHeight;
    });

    // Final render without cursor
    outputEl.innerHTML = renderMarkdown(fullText);

    // Store for download
    panel._analysisText = fullText;
  } catch (err) {
    content.innerHTML = `
      <div class="error-message">
        <div class="error-icon">⚠️</div>
        <h3>Analysis Failed</h3>
        <p>${escapeHtml(err.message)}</p>
        <button onclick="document.getElementById('btn-regenerate')?.click()">Try Again</button>
      </div>
    `;
    showToast(err.message, 'error');
  }
}

/**
 * Download analysis as Markdown.
 */
function downloadAnalysis(repoData) {
  const panel = document.getElementById('analysis-panel');
  const text = panel?._analysisText;
  if (!text) {
    showToast('No analysis to download yet.', 'info');
    return;
  }

  const repoName = `${repoData.repoInfo.owner.login}-${repoData.repoInfo.name}`;
  const blob = new Blob([text], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${repoName}-analysis.md`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Basic Markdown → HTML renderer.
 * Supports headings, bold, code, lists, and paragraphs.
 */
function renderMarkdown(text) {
  if (!text) return '';

  let html = text
    // Escape HTML first
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Headings
    .replace(/^### (.+)$/gm, '<h4 style="margin-top:16px;margin-bottom:8px;font-size:0.85rem;color:var(--text-primary)">$1</h4>')
    .replace(/^## (.+)$/gm, '</div><div class="analysis-section"><h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 style="font-size:1.1rem;margin-bottom:12px">$1</h2>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text-primary)">$1</strong>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Bullet lists
    .replace(/^[*-] (.+)$/gm, '<li>$1</li>')
    // Numbered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Group consecutive <li> into <ul>
    .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
    // Line breaks → paragraphs
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');

  // Wrap in section
  html = `<div class="analysis-section">${html}</div>`;

  // Clean up empty sections
  html = html.replace(/<div class="analysis-section"><\/div>/g, '');
  // Remove first empty closeing div
  html = html.replace(/^<\/div>/, '');

  return html;
}

/**
 * Refresh the analysis panel after settings change.
 */
export function refreshAnalysisPanel(repoData) {
  const panel = document.getElementById('analysis-panel');
  if (panel) {
    runAnalysis(panel, repoData);
  }
}
