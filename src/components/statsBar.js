/**
 * statsBar.js — Stats dashboard bar
 */

import { formatNumber, formatDate, animateCount, formatSize } from '../utils/helpers.js';
import { getLanguageColor } from '../utils/colors.js';

/**
 * Create the stats bar at the bottom.
 */
export function createStatsBar(repoInfo, tree, languages) {
  const bar = document.createElement('div');
  bar.className = 'stats-bar';
  bar.id = 'stats-bar';

  const files = tree.filter(i => i.type === 'blob');
  const dirs = tree.filter(i => i.type === 'tree');
  const totalBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);
  const estimatedLOC = Math.round(totalBytes / 40); // Rough estimate

  // Language bars
  const totalLangBytes = Object.values(languages).reduce((s, v) => s + v, 0);
  const langEntries = Object.entries(languages).sort((a, b) => b[1] - a[1]);

  const langBarsHtml = langEntries.length > 0
    ? `<div class="language-bars">
        ${langEntries.map(([lang, bytes]) => {
          const pct = (bytes / totalLangBytes * 100).toFixed(1);
          return `<div class="language-bar" style="flex:${bytes};background:${getLanguageColor(lang)}" title="${lang}: ${pct}%">
            <div class="language-tooltip">${lang}: ${pct}%</div>
          </div>`;
        }).join('')}
      </div>`
    : '';

  const langLabelsHtml = langEntries.slice(0, 5).map(([lang, bytes]) => {
    const pct = (bytes / totalLangBytes * 100).toFixed(1);
    return `<span class="stat-item" style="gap:4px">
      <span style="width:8px;height:8px;border-radius:50%;background:${getLanguageColor(lang)};display:inline-block"></span>
      <span class="stat-label">${lang}</span>
      <span class="stat-value" style="font-size:0.75rem">${pct}%</span>
    </span>`;
  }).join('');

  bar.innerHTML = `
    <div class="stat-item">
      <span class="stat-icon">⭐</span>
      <span class="stat-value" data-count="${repoInfo.stargazers_count}">0</span>
      <span class="stat-label">Stars</span>
    </div>
    <div class="stat-divider"></div>

    <div class="stat-item">
      <span class="stat-icon">🍴</span>
      <span class="stat-value" data-count="${repoInfo.forks_count}">0</span>
      <span class="stat-label">Forks</span>
    </div>
    <div class="stat-divider"></div>

    <div class="stat-item">
      <span class="stat-icon">📝</span>
      <span class="stat-value" data-count="${files.length}">0</span>
      <span class="stat-label">Files</span>
    </div>
    <div class="stat-divider"></div>

    <div class="stat-item">
      <span class="stat-icon">📁</span>
      <span class="stat-value" data-count="${dirs.length}">0</span>
      <span class="stat-label">Dirs</span>
    </div>
    <div class="stat-divider"></div>

    <div class="stat-item">
      <span class="stat-icon">📏</span>
      <span class="stat-value" data-count="${estimatedLOC}">0</span>
      <span class="stat-label">~LOC</span>
    </div>
    <div class="stat-divider"></div>

    <div class="stat-item">
      <span class="stat-icon">💾</span>
      <span class="stat-value">${formatSize(totalBytes)}</span>
      <span class="stat-label">Code</span>
    </div>
    <div class="stat-divider"></div>

    ${langBarsHtml}
    ${langLabelsHtml}

    <div style="margin-left:auto;display:flex;align-items:center;gap:var(--space-md)">
      ${repoInfo.license ? `
        <div class="stat-item">
          <span class="stat-icon">📜</span>
          <span class="stat-label">${repoInfo.license.spdx_id || 'License'}</span>
        </div>
        <div class="stat-divider"></div>
      ` : ''}

      <div class="stat-item">
        <span class="stat-icon">📅</span>
        <span class="stat-label">${formatDate(repoInfo.updated_at)}</span>
      </div>

      ${repoInfo.owner?.avatar_url ? `
        <div class="stat-item">
          <img src="${repoInfo.owner.avatar_url}" alt="${repoInfo.owner.login}"
            style="width:22px;height:22px;border-radius:50%;border:1px solid var(--border-subtle)" />
          <span class="stat-label">${repoInfo.owner.login}</span>
        </div>
      ` : ''}
    </div>
  `;

  // Animate numbers after render
  requestAnimationFrame(() => {
    bar.querySelectorAll('[data-count]').forEach(el => {
      const target = parseInt(el.dataset.count, 10);
      if (!isNaN(target)) animateCount(el, target);
    });
  });

  return bar;
}
