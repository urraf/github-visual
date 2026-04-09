/**
 * helpers.js — Shared utility functions
 */

/**
 * Format a number with commas (e.g., 1234 → "1,234").
 */
export function formatNumber(num) {
  if (num == null) return '0';
  return num.toLocaleString('en-US');
}

/**
 * Format file size in human-readable form.
 */
export function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${sizes[i]}`;
}

/**
 * Format a date string into a relative or absolute date.
 */
export function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / 86400000);

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

/**
 * Show a toast notification.
 */
export function showToast(message, type = 'info', duration = 4000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Debounce a function.
 */
export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Animate a number counting up.
 */
export function animateCount(element, target, duration = 800) {
  const start = 0;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (target - start) * eased);
    element.textContent = formatNumber(current);
    if (progress < 1) requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}

/**
 * Escape HTML to prevent XSS.
 */
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Sleep for a given number of milliseconds.
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Store/retrieve values from localStorage with a prefix.
 */
const STORAGE_PREFIX = 'repoverse_';

export function getStored(key) {
  try {
    return localStorage.getItem(STORAGE_PREFIX + key);
  } catch {
    return null;
  }
}

export function setStored(key, value) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, value);
  } catch {
    // localStorage may be full or unavailable
  }
}

/**
 * Encode repo info in URL query params for sharing.
 */
export function encodeRepoInUrl(owner, repo) {
  const url = new URL(window.location.href);
  url.searchParams.set('repo', `${owner}/${repo}`);
  window.history.replaceState(null, '', url.toString());
}

/**
 * Decode repo info from URL query params.
 */
export function decodeRepoFromUrl() {
  const url = new URL(window.location.href);
  const repoParam = url.searchParams.get('repo');
  if (repoParam && repoParam.includes('/')) {
    const [owner, repo] = repoParam.split('/');
    return { owner, repo };
  }
  return null;
}
