/**
 * main.js — RepoVerse Entry Point
 */

import './styles/index.css';
import './styles/landing.css';
import './styles/dashboard.css';
import './styles/components.css';

import { createLandingPage, showLoadingOverlay, updateLoadingProgress, hideLoadingOverlay } from './components/landing.js';
import { createSettingsButton, showSettings } from './components/settings.js';
import { fetchAllRepoData, getRateLimit } from './api/github.js';
import { parseGitHubUrl, buildGraphData, buildFileTree } from './utils/parser.js';
import { initGraph, createGraphControls, createGraphSearch, destroyGraph } from './components/graph3d.js';
import { createFileExplorer } from './components/fileExplorer.js';
import { createAnalysisPanel, refreshAnalysisPanel } from './components/aiAnalysis.js';
import { createStatsBar } from './components/statsBar.js';
import { showToast, decodeRepoFromUrl, encodeRepoInUrl } from './utils/helpers.js';
import { getNodeColor } from './utils/colors.js';

const app = document.getElementById('app');
let currentRepoData = null;

/**
 * Initialize the app.
 */
function init() {
  // Check for repo in URL params
  const urlRepo = decodeRepoFromUrl();
  if (urlRepo) {
    showLanding();
    analyzeRepo(`${urlRepo.owner}/${urlRepo.repo}`);
  } else {
    showLanding();
  }
}

/**
 * Show the landing page.
 */
function showLanding() {
  destroyGraph();
  currentRepoData = null;
  app.innerHTML = '';

  const landing = createLandingPage(analyzeRepo);
  app.appendChild(landing);

  // Add settings button
  const settingsBtn = createSettingsButton();
  document.body.appendChild(settingsBtn);
}

/**
 * Analyze a repository URL/shorthand.
 */
async function analyzeRepo(input) {
  const parsed = parseGitHubUrl(input);
  if (!parsed) {
    showToast('Invalid GitHub URL. Use formats like: owner/repo, github.com/owner/repo, or full URL', 'error');
    return;
  }

  const { owner, repo } = parsed;

  // Show loading overlay
  showLoadingOverlay();

  try {
    const repoData = await fetchAllRepoData(owner, repo, (text, percent) => {
      updateLoadingProgress(text, percent);
    });

    // Check for truncated repos
    if (repoData.truncated) {
      showToast(`Large repository — showing first ${repoData.tree.length} items. Some files may be omitted.`, 'info', 6000);
    }

    currentRepoData = repoData;

    // Update URL
    encodeRepoInUrl(owner, repo);

    updateLoadingProgress('Building visualization...', 95);

    // Small delay for visual feedback
    await new Promise(r => setTimeout(r, 300));

    hideLoadingOverlay();
    showDashboard(owner, repo, repoData);
  } catch (err) {
    hideLoadingOverlay();
    showToast(err.message, 'error', 6000);
    console.error('Analysis failed:', err);
  }
}

/**
 * Show the analysis dashboard.
 */
function showDashboard(owner, repo, repoData) {
  app.innerHTML = '';

  const { repoInfo, tree, readme, languages } = repoData;

  // Build graph data
  const graphData = buildGraphData(tree, `${owner}/${repo}`);

  // Build file tree
  const fileTree = buildFileTree(tree);

  // Create dashboard layout
  const dashboard = document.createElement('div');
  dashboard.className = 'dashboard fade-in';
  dashboard.id = 'dashboard';

  // ===== Header =====
  const header = createHeader(owner, repo, repoInfo);
  dashboard.appendChild(header);

  // ===== File Explorer =====
  const explorer = createFileExplorer(fileTree, owner, repo, (file) => {
    // When a file is selected in explorer, we could highlight it on graph
  });
  dashboard.appendChild(explorer);

  // ===== 3D Graph Panel =====
  const graphPanel = document.createElement('div');
  graphPanel.className = 'graph-panel';
  graphPanel.id = 'graph-panel';

  const graphContainer = document.createElement('div');
  graphContainer.className = 'graph-container';
  graphContainer.id = 'graph-container';
  graphPanel.appendChild(graphContainer);

  // Node detail tooltip
  const nodeDetail = document.createElement('div');
  nodeDetail.className = 'node-detail glass';
  nodeDetail.id = 'node-detail';
  nodeDetail.style.display = 'none';
  graphPanel.appendChild(nodeDetail);

  // Graph search
  const graphSearch = createGraphSearch();
  graphPanel.appendChild(graphSearch);

  // Graph controls
  const graphControls = createGraphControls(graphData);
  graphPanel.appendChild(graphControls);

  dashboard.appendChild(graphPanel);

  // ===== AI Analysis Panel =====
  const analysisPanel = createAnalysisPanel(repoData);
  dashboard.appendChild(analysisPanel);

  // ===== Stats Bar =====
  const statsBar = createStatsBar(repoInfo, tree, languages);
  dashboard.appendChild(statsBar);

  app.appendChild(dashboard);

  // Remove any existing settings button from body
  document.querySelector('.settings-btn')?.remove();

  // Initialize 3D graph after DOM is rendered
  requestAnimationFrame(() => {
    setTimeout(() => {
      const container = document.getElementById('graph-container');
      if (container) {
        initGraph(container, graphData, (node) => {
          updateNodeDetail(node);
        });
      }
    }, 100);
  });
}

/**
 * Create the dashboard header.
 */
function createHeader(owner, repo, repoInfo) {
  const header = document.createElement('div');
  header.className = 'dash-header';

  const rateLimit = getRateLimit();
  const rlClass = rateLimit.remaining != null && rateLimit.remaining < 10 ? 'danger' :
                   rateLimit.remaining != null && rateLimit.remaining < 30 ? 'warn' : '';

  header.innerHTML = `
    <div class="dash-header-left">
      <div class="dash-logo" id="back-to-home" title="Back to Home">
        <div class="dash-logo-icon">◈</div>
        <span class="dash-logo-text">RepoVerse</span>
      </div>
      <div class="header-divider"></div>
      <div class="repo-info">
        <span class="repo-name-header">${owner}/${repo}</span>
        <a class="repo-link" href="${repoInfo.html_url}" target="_blank" rel="noopener">
          ↗ GitHub
        </a>
      </div>
    </div>
    <div class="dash-header-right">
      <div class="rate-limit-badge ${rlClass}" title="GitHub API rate limit remaining">
        ⚡ ${rateLimit.remaining ?? '—'} API calls left
      </div>
      <button class="header-btn" id="toggle-explorer" title="Toggle File Explorer">📂</button>
      <button class="header-btn" id="toggle-analysis" title="Toggle AI Analysis">🤖</button>
      <button class="header-btn" id="settings-btn" title="Settings">⚙️</button>
    </div>
  `;

  // Back to home
  header.querySelector('#back-to-home').addEventListener('click', () => {
    // Clear URL params
    const url = new URL(window.location.href);
    url.searchParams.delete('repo');
    window.history.replaceState(null, '', url.toString());
    showLanding();
  });

  // Toggle panels
  header.querySelector('#toggle-explorer').addEventListener('click', () => {
    const panel = document.getElementById('explorer-panel');
    if (panel) {
      panel.classList.toggle('collapsed');
      panel.classList.toggle('open');
    }
  });

  header.querySelector('#toggle-analysis').addEventListener('click', () => {
    const panel = document.getElementById('analysis-panel');
    if (panel) {
      panel.classList.toggle('collapsed');
      panel.classList.toggle('open');
    }
  });

  // Settings
  header.querySelector('#settings-btn').addEventListener('click', () => {
    showSettings(() => {
      if (currentRepoData) {
        refreshAnalysisPanel(currentRepoData);
      }
    });
  });

  return header;
}

/**
 * Update the node detail panel.
 */
function updateNodeDetail(node) {
  const detail = document.getElementById('node-detail');
  if (!detail) return;

  if (!node) {
    detail.style.display = 'none';
    return;
  }

  const color = getNodeColor(node.type);
  const typeLabels = {
    root: 'Root',
    directory: 'Directory',
    source: 'Source',
    config: 'Config',
    docs: 'Documentation',
    other: 'Other',
  };

  detail.style.display = 'block';
  detail.innerHTML = `
    <h4>
      <span class="node-type-badge" style="background:${color}22;color:${color}">${typeLabels[node.type] || 'File'}</span>
      ${node.name}
    </h4>
    <p>${node.path || node.name}</p>
    ${node.fileSize ? `<p style="margin-top:4px;color:var(--text-tertiary)">Size: ${(node.fileSize / 1024).toFixed(1)} KB</p>` : ''}
    ${node.children?.length ? `<p style="margin-top:2px;color:var(--text-tertiary)">${node.children.length} children</p>` : ''}
  `;
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + K → focus search
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    const searchInput = document.getElementById('graph-search-input');
    if (searchInput) searchInput.focus();
  }

  // Escape → close modals/previews
  if (e.key === 'Escape') {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.remove();

    const preview = document.getElementById('file-preview');
    if (preview) preview.remove();
  }
});

// Initialize app
init();
