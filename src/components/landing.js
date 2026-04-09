/**
 * landing.js — Landing page component
 */

export function createLandingPage(onAnalyze) {
  const container = document.createElement('div');
  container.className = 'landing-page';
  container.id = 'landing-page';

  // Background layers
  container.innerHTML = `
    <div class="landing-bg"></div>
    <div class="landing-grid"></div>
    <div class="particles-container" id="particles"></div>

    <div class="landing-content">
      <div class="landing-logo">
        <div class="logo-icon">◈</div>
        <h1 class="landing-title">RepoVerse</h1>
        <p class="landing-subtitle">
          Explore any GitHub repository in immersive 3D. Visualize file structures,
          understand architecture, and get AI-powered insights — all in your browser.
        </p>
      </div>

      <div class="input-group">
        <div class="input-wrapper">
          <span class="input-icon">⌕</span>
          <input
            type="text"
            class="repo-input"
            id="repo-url-input"
            placeholder="Paste any GitHub repo URL…  e.g. facebook/react"
            autocomplete="off"
            spellcheck="false"
          />
          <button class="analyze-btn" id="analyze-btn">
            <span>Analyze</span>
          </button>
        </div>
      </div>

      <div class="example-repos">
        <span class="example-repos-label">Try an example</span>
        <button class="repo-chip" data-repo="facebook/react">facebook/react</button>
        <button class="repo-chip" data-repo="vuejs/core">vuejs/core</button>
        <button class="repo-chip" data-repo="expressjs/express">expressjs/express</button>
        <button class="repo-chip" data-repo="denoland/deno">denoland/deno</button>
        <button class="repo-chip" data-repo="sveltejs/svelte">sveltejs/svelte</button>
        <button class="repo-chip" data-repo="tailwindlabs/tailwindcss">tailwindlabs/tailwindcss</button>
      </div>
    </div>

    <div class="landing-footer">
      <span>No backend • 100% browser-side</span>
      <span>•</span>
      <span>GitHub API • Groq AI</span>
    </div>
  `;

  // Initialize particles
  requestAnimationFrame(() => createParticles(container.querySelector('#particles')));

  // Event handlers
  const input = container.querySelector('#repo-url-input');
  const btn = container.querySelector('#analyze-btn');

  btn.addEventListener('click', () => {
    if (input.value.trim()) onAnalyze(input.value.trim());
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      onAnalyze(input.value.trim());
    }
  });

  // Example chips
  container.querySelectorAll('.repo-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const repo = chip.dataset.repo;
      input.value = repo;
      input.focus();
      // Small delay so user sees what was selected
      setTimeout(() => onAnalyze(repo), 200);
    });
  });

  // Auto-focus input
  setTimeout(() => input.focus(), 500);

  return container;
}

/**
 * Create floating particle elements.
 */
function createParticles(container) {
  if (!container) return;
  const count = 30;
  for (let i = 0; i < count; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    const x = Math.random() * 100;
    const duration = 8 + Math.random() * 12;
    const delay = Math.random() * duration;
    const size = 1 + Math.random() * 3;
    const colors = [
      `rgba(139, 92, 246, ${0.2 + Math.random() * 0.3})`,
      `rgba(0, 212, 255, ${0.2 + Math.random() * 0.3})`,
      `rgba(16, 185, 129, ${0.1 + Math.random() * 0.2})`,
    ];

    particle.style.cssText = `
      left: ${x}%;
      width: ${size}px;
      height: ${size}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      animation-duration: ${duration}s;
      animation-delay: -${delay}s;
    `;
    container.appendChild(particle);
  }
}

/**
 * Show loading overlay.
 */
export function showLoadingOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay fade-in';
  overlay.id = 'loading-overlay';

  overlay.innerHTML = `
    <div class="spinner large"></div>
    <div class="loading-text" id="loading-text">Initializing...</div>
    <div class="loading-progress">
      <div class="loading-progress-bar" id="loading-progress-bar" style="width: 0%"></div>
    </div>
    <div class="loading-steps">
      <div class="loading-step active" id="step-info">● Fetching repository info</div>
      <div class="loading-step" id="step-tree">○ Fetching file tree</div>
      <div class="loading-step" id="step-readme">○ Fetching README</div>
      <div class="loading-step" id="step-langs">○ Fetching languages</div>
      <div class="loading-step" id="step-process">○ Building visualization</div>
    </div>
  `;

  document.body.appendChild(overlay);
  return overlay;
}

/**
 * Update loading progress.
 */
export function updateLoadingProgress(text, percent) {
  const loadingText = document.getElementById('loading-text');
  const progressBar = document.getElementById('loading-progress-bar');

  if (loadingText) loadingText.textContent = text;
  if (progressBar) progressBar.style.width = `${percent}%`;

  // Update step indicators
  const steps = ['step-info', 'step-tree', 'step-readme', 'step-langs', 'step-process'];
  const thresholds = [10, 30, 60, 80, 90];

  steps.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (percent >= thresholds[i]) {
      el.className = 'loading-step done';
      el.textContent = el.textContent.replace('○', '✓').replace('●', '✓');
    } else if (percent >= (thresholds[i - 1] || 0)) {
      el.className = 'loading-step active';
      el.textContent = el.textContent.replace('○', '●');
    }
  });
}

/**
 * Remove loading overlay.
 */
export function hideLoadingOverlay() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s ease';
    setTimeout(() => overlay.remove(), 300);
  }
}
