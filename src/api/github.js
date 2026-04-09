/**
 * github.js — GitHub REST API integration
 */

const BASE_URL = 'https://api.github.com';

let rateLimitRemaining = null;
let rateLimitReset = null;

/**
 * Get the current rate limit info.
 */
export function getRateLimit() {
  return { remaining: rateLimitRemaining, reset: rateLimitReset };
}

/**
 * Make a GitHub API request.
 */
async function ghFetch(path, token = null) {
  const headers = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { headers });

  // Track rate limit
  rateLimitRemaining = parseInt(res.headers.get('X-RateLimit-Remaining') ?? '60', 10);
  const resetTimestamp = res.headers.get('X-RateLimit-Reset');
  if (resetTimestamp) {
    rateLimitReset = new Date(parseInt(resetTimestamp, 10) * 1000);
  }

  if (res.status === 403 && rateLimitRemaining === 0) {
    const resetTime = rateLimitReset ? rateLimitReset.toLocaleTimeString() : 'soon';
    throw new Error(`GitHub API rate limit exceeded. Resets at ${resetTime}. Add a GitHub token in settings for 5,000 requests/hour.`);
  }

  if (res.status === 404) {
    throw new Error('Repository not found. Make sure the URL is correct and the repository is public.');
  }

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * Fetch repository metadata.
 */
export async function fetchRepoInfo(owner, repo, token = null) {
  return ghFetch(`/repos/${owner}/${repo}`, token);
}

/**
 * Fetch the full file tree recursively.
 * Tries `main` first, then `master`, then the default branch.
 */
export async function fetchRepoTree(owner, repo, token = null, defaultBranch = 'main') {
  const branches = [defaultBranch, 'main', 'master'];
  const tried = new Set();

  for (const branch of branches) {
    if (tried.has(branch)) continue;
    tried.add(branch);

    try {
      const data = await ghFetch(
        `/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
        token
      );
      return data;
    } catch (err) {
      if (err.message.includes('rate limit')) throw err;
      // Try next branch
    }
  }

  throw new Error('Could not fetch repository tree. The repository may be empty or use an unusual branch name.');
}

/**
 * Fetch the README file content (base64 decoded).
 */
export async function fetchReadme(owner, repo, token = null) {
  try {
    const data = await ghFetch(`/repos/${owner}/${repo}/readme`, token);
    if (data.content) {
      return atob(data.content.replace(/\n/g, ''));
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch the language breakdown.
 */
export async function fetchLanguages(owner, repo, token = null) {
  try {
    return await ghFetch(`/repos/${owner}/${repo}/languages`, token);
  } catch {
    return {};
  }
}

/**
 * Fetch a file's raw content by its path.
 */
export async function fetchFileContent(owner, repo, path, token = null) {
  try {
    const data = await ghFetch(`/repos/${owner}/${repo}/contents/${path}`, token);
    if (data.content) {
      return atob(data.content.replace(/\n/g, ''));
    }
    if (data.download_url) {
      const res = await fetch(data.download_url);
      return await res.text();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch all data needed for a repo analysis.
 * Returns { repoInfo, tree, readme, languages }.
 */
export async function fetchAllRepoData(owner, repo, onProgress = () => {}) {
  const token = localStorage.getItem('repoverse_github_token') || null;

  onProgress('Fetching repository info...', 10);
  const repoInfo = await fetchRepoInfo(owner, repo, token);

  onProgress('Fetching file tree...', 30);
  const treeData = await fetchRepoTree(owner, repo, token, repoInfo.default_branch);

  // Check if tree is truncated (large repos)
  if (treeData.truncated) {
    console.warn('Repository tree is truncated (>100,000 files). Some files may not be shown.');
  }

  onProgress('Fetching README...', 60);
  const readme = await fetchReadme(owner, repo, token);

  onProgress('Fetching languages...', 80);
  const languages = await fetchLanguages(owner, repo, token);

  onProgress('Processing data...', 90);

  return {
    repoInfo,
    tree: treeData.tree || [],
    truncated: treeData.truncated || false,
    readme,
    languages,
  };
}
