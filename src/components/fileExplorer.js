/**
 * fileExplorer.js — File tree sidebar (VS Code-style)
 */

import { getFileIcon } from '../utils/colors.js';
import { formatSize, escapeHtml } from '../utils/helpers.js';
import { fetchFileContent } from '../api/github.js';

let filePreviewEl = null;

/**
 * Create the file explorer panel.
 */
export function createFileExplorer(fileTree, owner, repo, onFileSelect) {
  const panel = document.createElement('div');
  panel.className = 'explorer-panel';
  panel.id = 'explorer-panel';

  panel.innerHTML = `
    <div class="panel-header">
      <span class="panel-title">📂 Explorer</span>
      <button class="panel-action" id="collapse-explorer" title="Close">✕</button>
    </div>
    <div class="file-tree" id="file-tree"></div>
  `;

  const treeContainer = panel.querySelector('#file-tree');
  const collapseBtn = panel.querySelector('#collapse-explorer');

  // Build tree recursively
  renderTreeNode(treeContainer, fileTree, owner, repo, 0, onFileSelect);

  collapseBtn.addEventListener('click', () => {
    panel.classList.toggle('collapsed');
  });

  return panel;
}

/**
 * Recursively render a tree node and its children.
 */
function renderTreeNode(container, node, owner, repo, depth, onFileSelect) {
  // Sort: directories first, then alphabetical
  const children = Object.values(node.children || {});
  const sorted = children.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  for (const child of sorted) {
    const item = document.createElement('div');
    item.style.paddingLeft = `${depth * 12}px`;

    if (child.isDir) {
      // Directory item
      const dirEl = document.createElement('div');
      dirEl.className = 'tree-item';
      dirEl.innerHTML = `
        <span class="tree-toggle">▶</span>
        <span class="tree-icon">${getFileIcon('directory', child.name)}</span>
        <span class="tree-name">${escapeHtml(child.name)}</span>
      `;

      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'tree-children';
      childrenContainer.style.display = 'none';

      let expanded = false;
      let childrenRendered = false;

      dirEl.addEventListener('click', () => {
        expanded = !expanded;
        childrenContainer.style.display = expanded ? 'block' : 'none';
        dirEl.querySelector('.tree-toggle').className = `tree-toggle ${expanded ? 'expanded' : ''}`;

        // Lazy render children on first expand
        if (expanded && !childrenRendered) {
          renderTreeNode(childrenContainer, child, owner, repo, depth + 1, onFileSelect);
          childrenRendered = true;
        }
      });

      // Auto-expand first level
      if (depth === 0) {
        expanded = true;
        childrenContainer.style.display = 'block';
        dirEl.querySelector('.tree-toggle').className = 'tree-toggle expanded';
        renderTreeNode(childrenContainer, child, owner, repo, depth + 1, onFileSelect);
        childrenRendered = true;
      }

      item.appendChild(dirEl);
      item.appendChild(childrenContainer);
    } else {
      // File item
      const fileEl = document.createElement('div');
      fileEl.className = 'tree-item';
      fileEl.innerHTML = `
        <span class="tree-toggle" style="visibility:hidden">▶</span>
        <span class="tree-icon">${getFileIcon(child.type, child.name)}</span>
        <span class="tree-name">${escapeHtml(child.name)}</span>
        ${child.size ? `<span class="tree-size">${formatSize(child.size)}</span>` : ''}
      `;

      fileEl.addEventListener('click', async () => {
        // Highlight selected
        container.querySelectorAll('.tree-item.selected').forEach(el => el.classList.remove('selected'));
        fileEl.classList.add('selected');

        if (onFileSelect) onFileSelect(child);

        // Show file preview if small enough
        if (child.size && child.size < 200000) {
          showFilePreview(child.path, owner, repo);
        }
      });

      item.appendChild(fileEl);
    }

    container.appendChild(item);
  }
}

/**
 * Show a file preview overlay.
 */
async function showFilePreview(path, owner, repo) {
  closeFilePreview();

  const preview = document.createElement('div');
  preview.className = 'file-preview-panel glass';
  preview.id = 'file-preview';
  preview.innerHTML = `
    <div class="file-preview-header">
      <span class="file-preview-name">${escapeHtml(path)}</span>
      <button class="panel-action" id="close-preview">✕</button>
    </div>
    <div class="file-preview-content">
      <div class="skeleton" style="height:200px;width:100%"></div>
    </div>
  `;

  document.body.appendChild(preview);
  filePreviewEl = preview;

  preview.querySelector('#close-preview').addEventListener('click', closeFilePreview);

  // Fetch content
  try {
    const content = await fetchFileContent(owner, repo, path);
    if (content && preview.isConnected) {
      const contentDiv = preview.querySelector('.file-preview-content');
      const lines = content.split('\n');
      const html = lines
        .slice(0, 500)
        .map((line, i) =>
          `<span class="line-number">${i + 1}</span>${escapeHtml(line)}`
        )
        .join('\n');

      contentDiv.innerHTML = `<pre>${html}${lines.length > 500 ? '\n\n... (truncated) ...' : ''}</pre>`;
    }
  } catch (err) {
    const contentDiv = preview.querySelector('.file-preview-content');
    if (contentDiv) {
      contentDiv.innerHTML = `<div class="error-message"><p>Could not load file content.</p></div>`;
    }
  }
}

/**
 * Close the file preview overlay.
 */
export function closeFilePreview() {
  if (filePreviewEl) {
    filePreviewEl.remove();
    filePreviewEl = null;
  }
}
