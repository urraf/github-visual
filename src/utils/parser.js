/**
 * parser.js — URL parsing and tree‑building utilities
 */

/**
 * Parse a GitHub URL/shorthand into { owner, repo }
 * Supports:
 *  - https://github.com/owner/repo
 *  - http://github.com/owner/repo
 *  - github.com/owner/repo
 *  - owner/repo
 */
export function parseGitHubUrl(input) {
  if (!input || typeof input !== 'string') return null;

  let cleaned = input.trim().replace(/\/+$/, '');

  // Remove protocol and domain
  cleaned = cleaned
    .replace(/^https?:\/\//i, '')
    .replace(/^(www\.)?github\.com\//i, '');

  // Remove .git suffix
  cleaned = cleaned.replace(/\.git$/i, '');

  // Remove any trailing paths after owner/repo (like /tree/main/...)
  const parts = cleaned.split('/');
  if (parts.length < 2) return null;

  const owner = parts[0];
  const repo = parts[1];

  if (!owner || !repo) return null;
  // Basic validation
  if (!/^[a-zA-Z0-9_.-]+$/.test(owner) || !/^[a-zA-Z0-9_.-]+$/.test(repo)) return null;

  return { owner, repo };
}

/**
 * Build a hierarchical tree from the flat GitHub API tree array.
 * Each tree entry has { path, type, size, sha }.
 * Returns { nodes[], links[] } for the force graph.
 */
export function buildGraphData(treeItems, repoName) {
  const nodes = [];
  const links = [];
  const nodeMap = new Map();

  // Root node
  const rootId = repoName;
  nodes.push({
    id: rootId,
    name: repoName,
    path: '',
    type: 'root',
    depth: 0,
    size: 30,
    children: [],
  });
  nodeMap.set('', nodes[0]);

  // Sort items so directories come before files, and by path
  const sorted = [...treeItems].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'tree' ? -1 : 1;
    return a.path.localeCompare(b.path);
  });

  for (const item of sorted) {
    const parts = item.path.split('/');
    const name = parts[parts.length - 1];
    const parentPath = parts.slice(0, -1).join('/');
    const depth = parts.length;
    const isDir = item.type === 'tree';

    const node = {
      id: item.path,
      name,
      path: item.path,
      type: isDir ? 'directory' : getFileCategory(name),
      depth,
      fileSize: item.size || 0,
      sha: item.sha,
      size: isDir ? Math.max(8, 15 - depth * 2) : Math.max(3, Math.min(12, Math.log2((item.size || 100) + 1))),
      children: [],
    };

    nodes.push(node);
    nodeMap.set(item.path, node);

    // Ensure parent exists
    let parent = nodeMap.get(parentPath);
    if (!parent) {
      // Create implicit parent directories
      let currentPath = '';
      for (let i = 0; i < parts.length - 1; i++) {
        const nextPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
        if (!nodeMap.has(nextPath)) {
          const implicitDir = {
            id: nextPath,
            name: parts[i],
            path: nextPath,
            type: 'directory',
            depth: i + 1,
            size: Math.max(8, 15 - (i + 1) * 2),
            children: [],
          };
          nodes.push(implicitDir);
          nodeMap.set(nextPath, implicitDir);
          const implicitParent = nodeMap.get(currentPath) || nodeMap.get('');
          implicitParent.children.push(implicitDir);
          links.push({
            source: implicitParent.id || rootId,
            target: nextPath,
          });
        }
        currentPath = nextPath;
      }
      parent = nodeMap.get(parentPath);
    }

    if (parent) {
      parent.children.push(node);
    }

    links.push({
      source: parent ? parent.id : rootId,
      target: item.path,
    });
  }

  return { nodes, links, nodeMap };
}

/**
 * Categorize a file by its extension.
 */
function getFileCategory(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const sourceExts = ['js', 'jsx', 'ts', 'tsx', 'py', 'go', 'rs', 'rb', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'swift', 'kt', 'scala', 'php', 'vue', 'svelte', 'dart', 'lua', 'r', 'jl', 'ex', 'exs', 'hs', 'clj', 'erl', 'elm', 'ml', 'zig', 'nim', 'v', 'sol', 'move'];
  const configExts = ['json', 'yaml', 'yml', 'toml', 'xml', 'ini', 'cfg', 'env', 'config', 'lock', 'rc', 'editorconfig', 'prettierrc', 'eslintrc', 'babelrc'];
  const docExts = ['md', 'txt', 'rst', 'adoc', 'org', 'wiki', 'rtf'];

  if (sourceExts.includes(ext)) return 'source';
  if (configExts.includes(ext)) return 'config';
  if (docExts.includes(ext)) return 'docs';
  if (['css', 'scss', 'sass', 'less', 'styl'].includes(ext)) return 'source';
  if (['html', 'htm', 'ejs', 'pug', 'hbs'].includes(ext)) return 'source';
  if (['sh', 'bash', 'zsh', 'fish', 'bat', 'ps1', 'cmd'].includes(ext)) return 'source';
  if (['sql', 'graphql', 'gql', 'proto'].includes(ext)) return 'source';
  if (['Dockerfile', 'Makefile', 'Rakefile', 'Gemfile', 'Procfile'].includes(filename)) return 'config';
  if (filename.startsWith('.')) return 'config';

  return 'other';
}

/**
 * Build a hierarchical tree structure for the file explorer.
 */
export function buildFileTree(treeItems) {
  const root = { name: '/', children: {}, isDir: true };

  for (const item of treeItems) {
    const parts = item.path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (!current.children[part]) {
        current.children[part] = {
          name: part,
          path: item.path,
          children: {},
          isDir: !isLast || item.type === 'tree',
          size: item.size || 0,
          sha: item.sha,
          type: isLast ? getFileCategory(part) : 'directory',
        };
      }
      current = current.children[part];
    }
  }

  return root;
}

/**
 * Filter graph data by depth.
 */
export function filterByDepth(graphData, maxDepth) {
  const nodes = graphData.nodes.filter(n => n.depth <= maxDepth);
  const nodeIds = new Set(nodes.map(n => n.id));
  const links = graphData.links.filter(l => {
    const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
    const targetId = typeof l.target === 'object' ? l.target.id : l.target;
    return nodeIds.has(sourceId) && nodeIds.has(targetId);
  });
  return { nodes, links };
}
