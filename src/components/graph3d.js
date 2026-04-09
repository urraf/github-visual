/**
 * graph3d.js — Enhanced 3D Force Graph visualization
 * Features: text labels, color legend, path highlighting, filters, layouts, hover tooltips
 */

import ForceGraph3D from '3d-force-graph';
import { getNodeColor, getNodeGlowColor, nodeColors } from '../utils/colors.js';
import { filterByDepth } from '../utils/parser.js';
import { debounce, formatSize } from '../utils/helpers.js';
import * as THREE from 'three';

let graphInstance = null;
let fullGraphData = null;
let currentMaxDepth = 20;
let highlightNodes = new Set();
let highlightLinks = new Set();
let pathHighlightNodes = new Set();
let pathHighlightLinks = new Set();
let selectedNode = null;
let showLabels = true;
let labelDetail = 'smart'; // 'all', 'smart', 'none'
let activeFilters = new Set(['root', 'directory', 'source', 'config', 'docs', 'other']);
let hoverNode = null;

// Cache for text sprites
const spriteCache = new Map();

/**
 * Create a text sprite for node labels.
 */
function createTextSprite(text, color = '#ffffff', fontSize = 28, maxWidth = 180) {
  const key = `${text}_${color}_${fontSize}`;
  if (spriteCache.has(key)) return spriteCache.get(key).clone();

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const padding = 8;

  canvas.width = 512;
  canvas.height = 64;

  ctx.font = `600 ${fontSize}px 'Space Grotesk', sans-serif`;

  // Truncate text if too long
  let displayText = text;
  let metrics = ctx.measureText(displayText);
  if (metrics.width > maxWidth * 2) {
    while (ctx.measureText(displayText + '…').width > maxWidth * 2 && displayText.length > 3) {
      displayText = displayText.slice(0, -1);
    }
    displayText += '…';
  }
  metrics = ctx.measureText(displayText);

  const w = metrics.width + padding * 2;
  const h = fontSize + padding * 2;
  canvas.width = Math.min(512, Math.ceil(w));
  canvas.height = Math.ceil(h);

  // Background pill
  ctx.fillStyle = 'rgba(10, 10, 26, 0.75)';
  const radius = h / 2;
  ctx.beginPath();
  ctx.roundRect(0, 0, canvas.width, canvas.height, radius);
  ctx.fill();

  // Border
  ctx.strokeStyle = `${color}44`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(0.5, 0.5, canvas.width - 1, canvas.height - 1, radius);
  ctx.stroke();

  // Text
  ctx.font = `600 ${fontSize}px 'Space Grotesk', sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(displayText, canvas.width / 2, canvas.height / 2 + 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const sprite = new THREE.Sprite(spriteMat);
  const aspect = canvas.width / canvas.height;
  const scale = 12;
  sprite.scale.set(scale * aspect, scale, 1);

  spriteCache.set(key, sprite);
  return sprite.clone();
}

/**
 * Determine if a node should show its label based on current detail level.
 */
function shouldShowLabel(node) {
  if (labelDetail === 'none') return false;
  if (labelDetail === 'all') return true;
  // 'smart' mode: show root, directories at depth <= 2, and hovered/selected/highlighted
  if (node.type === 'root') return true;
  if (node.type === 'directory' && node.depth <= 2) return true;
  if (highlightNodes.has(node)) return true;
  if (pathHighlightNodes.has(node)) return true;
  if (selectedNode === node) return true;
  if (hoverNode === node) return true;
  // Show nodes with many children
  if (node.children && node.children.length > 5) return true;
  return false;
}

/**
 * Find the path from root to a given node.
 */
function findPathToRoot(node, graphData) {
  const pathNodes = new Set();
  const pathLinks = new Set();
  const links = graphData.links;

  let current = node;
  pathNodes.add(current);

  // Walk up the tree via links
  const visited = new Set();
  while (current && current.type !== 'root' && !visited.has(current.id)) {
    visited.add(current.id);
    let found = false;
    for (const link of links) {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      if (targetId === current.id) {
        pathLinks.add(link);
        const sourceNode = typeof link.source === 'object'
          ? link.source
          : graphData.nodes.find(n => n.id === sourceId);
        if (sourceNode) {
          pathNodes.add(sourceNode);
          current = sourceNode;
          found = true;
          break;
        }
      }
    }
    if (!found) break;
  }

  return { pathNodes, pathLinks };
}

/**
 * Initialize the 3D graph in the given container.
 */
export function initGraph(container, graphData, onNodeClick, onNodeHover) {
  fullGraphData = graphData;
  spriteCache.clear();

  // Clean up any existing graph
  if (graphInstance) {
    graphInstance._destructor?.();
    graphInstance = null;
  }

  container.innerHTML = '';

  const filteredData = getFilteredData();

  graphInstance = ForceGraph3D()(container)
    .graphData(filteredData)
    .backgroundColor('#0a0a1a')
    .showNavInfo(false)
    .width(container.clientWidth)
    .height(container.clientHeight)

    // Node appearance
    .nodeRelSize(1)
    .nodeVal(n => n.size || 4)
    .nodeColor(n => {
      if (pathHighlightNodes.has(n)) return '#ffffff';
      if (highlightNodes.has(n)) return '#ffffff';
      return getNodeColor(n.type);
    })
    .nodeOpacity(0.92)
    .nodeLabel(() => '') // We use custom hover tooltip instead

    // Custom 3D objects for nodes with text labels
    .nodeThreeObject(node => {
      const group = new THREE.Group();
      const size = Math.max(1.5, (node.size || 4) * 0.6);
      const color = getNodeColor(node.type);
      const isHighlighted = highlightNodes.has(node) || pathHighlightNodes.has(node);
      const dimmed = highlightNodes.size > 0 && !isHighlighted && !pathHighlightNodes.has(node);

      // Main sphere
      const geometry = new THREE.SphereGeometry(size, 20, 14);
      const material = new THREE.MeshPhongMaterial({
        color: new THREE.Color(isHighlighted ? '#ffffff' : color),
        transparent: true,
        opacity: dimmed ? 0.15 : 0.92,
        shininess: 40,
        emissive: new THREE.Color(color),
        emissiveIntensity: isHighlighted ? 0.4 : 0.05,
      });
      const sphere = new THREE.Mesh(geometry, material);
      group.add(sphere);

      // Glow ring for root and directories
      if (node.type === 'root' || (node.type === 'directory' && node.depth <= 1)) {
        const ringGeo = new THREE.RingGeometry(size * 1.3, size * 1.6, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(color),
          transparent: true,
          opacity: isHighlighted ? 0.35 : 0.12,
          side: THREE.DoubleSide,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        group.add(ring);
      }

      // Selection ring
      if (selectedNode === node) {
        const selGeo = new THREE.RingGeometry(size * 1.8, size * 2.1, 32);
        const selMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color('#8b5cf6'),
          transparent: true,
          opacity: 0.6,
          side: THREE.DoubleSide,
        });
        const selRing = new THREE.Mesh(selGeo, selMat);
        group.add(selRing);
      }

      // Outer glow
      const glowGeo = new THREE.SphereGeometry(size * 2.0, 16, 12);
      const glowMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: dimmed ? 0.01 : (isHighlighted ? 0.1 : 0.03),
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      group.add(glow);

      // Text label
      if (shouldShowLabel(node)) {
        const labelColor = isHighlighted ? '#ffffff' : color;
        const fSize = node.type === 'root' ? 36 : (node.type === 'directory' ? 28 : 24);
        const sprite = createTextSprite(node.name, labelColor, fSize);
        sprite.position.set(0, size + 8, 0);
        group.add(sprite);
      }

      return group;
    })

    // Link appearance
    .linkWidth(link => {
      if (pathHighlightLinks.has(link)) return 2.5;
      if (highlightLinks.has(link)) return 1.5;
      return 0.3;
    })
    .linkColor(link => {
      if (pathHighlightLinks.has(link)) return 'rgba(139, 92, 246, 0.9)';
      if (highlightLinks.has(link)) return 'rgba(139, 92, 246, 0.5)';
      const dimmed = highlightNodes.size > 0 || pathHighlightNodes.size > 0;
      const depth = typeof link.source === 'object' ? (link.source.depth || 0) : 0;
      const alpha = dimmed
        ? 0.02
        : Math.max(0.04, 0.12 - depth * 0.012);
      return `rgba(255, 255, 255, ${alpha})`;
    })
    .linkOpacity(0.7)
    .linkDirectionalParticles(link => {
      if (pathHighlightLinks.has(link)) return 6;
      if (highlightLinks.has(link)) return 3;
      return 0;
    })
    .linkDirectionalParticleWidth(link => pathHighlightLinks.has(link) ? 2.0 : 1.2)
    .linkDirectionalParticleSpeed(0.006)
    .linkDirectionalParticleColor(link =>
      pathHighlightLinks.has(link) ? 'rgba(168, 85, 247, 0.8)' : 'rgba(139, 92, 246, 0.5)'
    )

    // Forces - better spread
    .d3AlphaDecay(0.02)
    .d3VelocityDecay(0.3)

    // Interactions
    .onNodeClick(node => {
      selectedNode = node;
      highlightNodes.clear();
      highlightLinks.clear();
      pathHighlightNodes.clear();
      pathHighlightLinks.clear();
      highlightNodes.add(node);

      // Highlight connected nodes and links (immediate neighbors)
      const gd = graphInstance.graphData();
      gd.links.forEach(link => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        if (sourceId === node.id || targetId === node.id) {
          highlightLinks.add(link);
          const neighbor = sourceId === node.id
            ? (typeof link.target === 'object' ? link.target : gd.nodes.find(n => n.id === link.target))
            : (typeof link.source === 'object' ? link.source : gd.nodes.find(n => n.id === link.source));
          if (neighbor) highlightNodes.add(neighbor);
        }
      });

      // Highlight path from root to this node
      const { pathNodes, pathLinks } = findPathToRoot(node, gd);
      pathNodes.forEach(n => pathHighlightNodes.add(n));
      pathLinks.forEach(l => pathHighlightLinks.add(l));

      refreshGraphVisuals();

      // Smooth zoom to node
      const distance = 60;
      const distRatio = 1 + distance / Math.hypot(node.x || 1, node.y || 1, node.z || 1);
      graphInstance.cameraPosition(
        { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
        node,
        1200
      );

      if (onNodeClick) onNodeClick(node);
    })

    .onNodeHover(node => {
      hoverNode = node;
      container.style.cursor = node ? 'pointer' : 'default';

      // Update hover tooltip
      updateHoverTooltip(container, node);

      if (onNodeHover) onNodeHover(node);

      // Refresh to show/hide smart labels on hover
      if (labelDetail === 'smart') {
        refreshGraphVisuals();
      }
    })

    .onBackgroundClick(() => {
      selectedNode = null;
      hoverNode = null;
      highlightNodes.clear();
      highlightLinks.clear();
      pathHighlightNodes.clear();
      pathHighlightLinks.clear();
      refreshGraphVisuals();
      hideHoverTooltip(container);
      if (onNodeClick) onNodeClick(null);
    });

  // Tweak default forces using the built-in d3Force API
  graphInstance.d3Force('charge').strength(-30);
  graphInstance.d3Force('link')
    .distance(link => {
      const source = typeof link.source === 'object' ? link.source : null;
      if (!source) return 30;
      return source.type === 'root' ? 60 : (source.type === 'directory' ? 35 : 20);
    });

  // Add lights
  const scene = graphInstance.scene();
  scene.add(new THREE.AmbientLight(0x404060, 2.0));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
  dirLight.position.set(100, 150, 100);
  scene.add(dirLight);
  const dirLight2 = new THREE.DirectionalLight(0x6366f1, 0.3);
  dirLight2.position.set(-100, -50, -100);
  scene.add(dirLight2);

  // Initial camera animation
  setTimeout(() => {
    graphInstance.cameraPosition(
      { x: 0, y: 80, z: 300 },
      { x: 0, y: 0, z: 0 },
      2500
    );
  }, 200);

  // Handle resize
  const handleResize = debounce(() => {
    if (graphInstance && container.clientWidth && container.clientHeight) {
      graphInstance.width(container.clientWidth);
      graphInstance.height(container.clientHeight);
    }
  }, 200);

  window.addEventListener('resize', handleResize);

  return graphInstance;
}

/**
 * Refresh graph visuals (colors, labels, widths) without re-laying out.
 */
function refreshGraphVisuals() {
  if (!graphInstance) return;
  graphInstance
    .nodeColor(graphInstance.nodeColor())
    .nodeThreeObject(graphInstance.nodeThreeObject())
    .linkWidth(graphInstance.linkWidth())
    .linkColor(graphInstance.linkColor())
    .linkDirectionalParticles(graphInstance.linkDirectionalParticles());
}

/**
 * Create and show the hover tooltip near the cursor.
 */
let tooltipEl = null;

function updateHoverTooltip(container, node) {
  if (!node) {
    hideHoverTooltip(container);
    return;
  }

  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'graph-hover-tooltip';
    tooltipEl.id = 'graph-hover-tooltip';
    container.closest('.graph-panel')?.appendChild(tooltipEl);
  }

  const color = getNodeColor(node.type);
  const typeLabels = {
    root: 'Root', directory: 'Folder', source: 'Source Code',
    config: 'Config', docs: 'Documentation', other: 'File',
  };

  tooltipEl.style.display = 'block';
  tooltipEl.innerHTML = `
    <div class="tooltip-header">
      <span class="tooltip-dot" style="background:${color}"></span>
      <span class="tooltip-name">${node.name}</span>
    </div>
    <div class="tooltip-path">${node.path || '/'}</div>
    <div class="tooltip-meta">
      <span class="tooltip-type" style="color:${color}">${typeLabels[node.type] || 'File'}</span>
      ${node.fileSize ? `<span>•</span><span>${formatSize(node.fileSize)}</span>` : ''}
      ${node.children?.length ? `<span>•</span><span>${node.children.length} items</span>` : ''}
      <span>•</span><span>Depth ${node.depth}</span>
    </div>
  `;

  // Position tooltip via mouse tracking
  const panel = container.closest('.graph-panel');
  const handleMouseMove = (e) => {
    const rect = panel.getBoundingClientRect();
    const x = e.clientX - rect.left + 16;
    const y = e.clientY - rect.top + 16;
    tooltipEl.style.left = `${Math.min(x, rect.width - 280)}px`;
    tooltipEl.style.top = `${Math.min(y, rect.height - 100)}px`;
  };
  panel._tooltipHandler = handleMouseMove;
  panel.addEventListener('mousemove', handleMouseMove);
}

function hideHoverTooltip(container) {
  if (tooltipEl) {
    tooltipEl.style.display = 'none';
  }
  const panel = container.closest?.('.graph-panel') || container;
  if (panel._tooltipHandler) {
    panel.removeEventListener('mousemove', panel._tooltipHandler);
    panel._tooltipHandler = null;
  }
}

/**
 * Get filtered graph data based on depth and file type filters.
 */
function getFilteredData() {
  if (!fullGraphData) return { nodes: [], links: [] };
  const depthFiltered = filterByDepth(fullGraphData, currentMaxDepth);

  // Apply type filters
  const nodes = depthFiltered.nodes.filter(n => activeFilters.has(n.type));
  const nodeIds = new Set(nodes.map(n => n.id));
  const links = depthFiltered.links.filter(l => {
    const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
    const targetId = typeof l.target === 'object' ? l.target.id : l.target;
    return nodeIds.has(sourceId) && nodeIds.has(targetId);
  });

  return { nodes, links };
}

/**
 * Update the depth filter.
 */
export function setGraphDepth(maxDepth) {
  if (!graphInstance || !fullGraphData) return;
  currentMaxDepth = maxDepth;
  graphInstance.graphData(getFilteredData());
}

/**
 * Toggle a file type filter.
 */
export function toggleFilter(type) {
  if (activeFilters.has(type)) {
    activeFilters.delete(type);
  } else {
    activeFilters.add(type);
  }
  if (graphInstance) {
    graphInstance.graphData(getFilteredData());
  }
}

/**
 * Set label detail level.
 */
export function setLabelDetail(level) {
  labelDetail = level;
  if (graphInstance) {
    refreshGraphVisuals();
  }
}

/**
 * Search/highlight nodes by name.
 */
export function searchNodes(query) {
  if (!graphInstance || !fullGraphData) return [];

  const q = query.toLowerCase().trim();
  if (!q) {
    highlightNodes.clear();
    highlightLinks.clear();
    pathHighlightNodes.clear();
    pathHighlightLinks.clear();
    refreshGraphVisuals();
    return [];
  }

  const gd = graphInstance.graphData();
  const matches = gd.nodes.filter(n =>
    n.name.toLowerCase().includes(q) || n.path?.toLowerCase().includes(q)
  );

  highlightNodes.clear();
  highlightLinks.clear();
  pathHighlightNodes.clear();
  pathHighlightLinks.clear();
  matches.forEach(n => highlightNodes.add(n));
  refreshGraphVisuals();

  // Zoom to first match
  if (matches.length > 0) {
    const node = matches[0];
    const distance = 70;
    const distRatio = 1 + distance / Math.hypot(node.x || 1, node.y || 1, node.z || 1);
    graphInstance.cameraPosition(
      { x: (node.x || 0) * distRatio, y: (node.y || 0) * distRatio, z: (node.z || 0) * distRatio },
      node,
      1000
    );
  }

  return matches;
}

/**
 * Zoom to fit all nodes in view.
 */
export function zoomToFit() {
  if (!graphInstance) return;
  graphInstance.zoomToFit(800, 40);
}

/**
 * Focus camera on a specific node (used from file explorer).
 */
export function focusOnNode(path) {
  if (!graphInstance) return;
  const gd = graphInstance.graphData();
  const node = gd.nodes.find(n => n.path === path || n.id === path);
  if (node) {
    selectedNode = node;
    highlightNodes.clear();
    highlightLinks.clear();
    pathHighlightNodes.clear();
    pathHighlightLinks.clear();
    highlightNodes.add(node);

    const { pathNodes, pathLinks } = findPathToRoot(node, gd);
    pathNodes.forEach(n => pathHighlightNodes.add(n));
    pathLinks.forEach(l => pathHighlightLinks.add(l));

    refreshGraphVisuals();

    const distance = 60;
    const distRatio = 1 + distance / Math.hypot(node.x || 1, node.y || 1, node.z || 1);
    graphInstance.cameraPosition(
      { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
      node,
      1200
    );
  }
}

/**
 * Create the enhanced graph controls UI.
 */
export function createGraphControls(graphData) {
  const maxDepth = Math.max(...graphData.nodes.map(n => n.depth), 1);
  const nodeCount = graphData.nodes.length;
  const linkCount = graphData.links.length;

  const controls = document.createElement('div');
  controls.className = 'graph-controls-panel';
  controls.id = 'graph-controls-panel';

  controls.innerHTML = `
    <!-- Top-left: Legend -->
    <div class="graph-legend glass" id="graph-legend">
      <div class="legend-title">Node Types</div>
      <div class="legend-items">
        <label class="legend-item" data-type="root">
          <span class="legend-dot" style="background:${nodeColors.root}"></span>
          <span>Root</span>
        </label>
        <label class="legend-item" data-type="directory">
          <input type="checkbox" checked data-filter="directory" />
          <span class="legend-dot" style="background:${nodeColors.directory}"></span>
          <span>Directories</span>
        </label>
        <label class="legend-item" data-type="source">
          <input type="checkbox" checked data-filter="source" />
          <span class="legend-dot" style="background:${nodeColors.source}"></span>
          <span>Source Code</span>
        </label>
        <label class="legend-item" data-type="config">
          <input type="checkbox" checked data-filter="config" />
          <span class="legend-dot" style="background:${nodeColors.config}"></span>
          <span>Config Files</span>
        </label>
        <label class="legend-item" data-type="docs">
          <input type="checkbox" checked data-filter="docs" />
          <span class="legend-dot" style="background:${nodeColors.docs}"></span>
          <span>Documentation</span>
        </label>
        <label class="legend-item" data-type="other">
          <input type="checkbox" checked data-filter="other" />
          <span class="legend-dot" style="background:${nodeColors.other}"></span>
          <span>Other</span>
        </label>
      </div>
      <div class="legend-count">${nodeCount} nodes · ${linkCount} links</div>
    </div>

    <!-- Bottom: Controls bar -->
    <div class="graph-controls glass">
      <div class="depth-slider-group">
        <label>Depth</label>
        <input type="range" class="depth-slider" id="depth-slider"
          min="1" max="${Math.min(maxDepth, 20)}" value="${Math.min(maxDepth, 20)}" />
        <span id="depth-value" class="control-value">${Math.min(maxDepth, 20)}</span>
      </div>

      <div class="controls-divider"></div>

      <div class="label-toggle-group">
        <label>Labels</label>
        <div class="toggle-pills">
          <button class="pill-btn" data-label="none" title="Hide all labels">Off</button>
          <button class="pill-btn active" data-label="smart" title="Show labels on key nodes">Smart</button>
          <button class="pill-btn" data-label="all" title="Show all labels">All</button>
        </div>
      </div>

      <div class="controls-divider"></div>

      <button class="graph-control-btn" id="btn-zoom-fit" title="Zoom to Fit All Nodes">⊞ Fit</button>
      <button class="graph-control-btn" id="btn-reset-camera" title="Reset Camera">⟲ Reset</button>
      <button class="graph-control-btn" id="btn-screenshot" title="Export Screenshot">📷</button>
    </div>

    <!-- Breadcrumb path (shown on node select) -->
    <div class="graph-breadcrumb glass" id="graph-breadcrumb" style="display:none"></div>
  `;

  // Filter checkboxes
  controls.querySelectorAll('[data-filter]').forEach(cb => {
    cb.addEventListener('change', () => {
      toggleFilter(cb.dataset.filter);
      // Update count
      const gd = graphInstance?.graphData();
      if (gd) {
        controls.querySelector('.legend-count').textContent =
          `${gd.nodes.length} nodes · ${gd.links.length} links`;
      }
    });
  });

  // Depth slider
  const slider = controls.querySelector('#depth-slider');
  const depthVal = controls.querySelector('#depth-value');
  slider.addEventListener('input', () => {
    const val = parseInt(slider.value);
    depthVal.textContent = val;
    setGraphDepth(val);
    // Update count
    const gd = graphInstance?.graphData();
    if (gd) {
      controls.querySelector('.legend-count').textContent =
        `${gd.nodes.length} nodes · ${gd.links.length} links`;
    }
  });

  // Label toggles
  controls.querySelectorAll('.pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      controls.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setLabelDetail(btn.dataset.label);
    });
  });

  // Zoom to fit
  controls.querySelector('#btn-zoom-fit').addEventListener('click', zoomToFit);

  // Reset camera
  controls.querySelector('#btn-reset-camera').addEventListener('click', () => {
    if (graphInstance) {
      selectedNode = null;
      highlightNodes.clear();
      highlightLinks.clear();
      pathHighlightNodes.clear();
      pathHighlightLinks.clear();
      refreshGraphVisuals();
      graphInstance.cameraPosition({ x: 0, y: 80, z: 300 }, { x: 0, y: 0, z: 0 }, 1200);
      controls.querySelector('#graph-breadcrumb').style.display = 'none';
    }
  });

  // Screenshot
  controls.querySelector('#btn-screenshot').addEventListener('click', () => {
    if (graphInstance) {
      const renderer = graphInstance.renderer();
      const canvas = renderer.domElement;
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'repoverse-graph.png';
        a.click();
        URL.revokeObjectURL(url);
      });
    }
  });

  return controls;
}

/**
 * Update the breadcrumb path display.
 */
export function updateBreadcrumb(node) {
  const el = document.getElementById('graph-breadcrumb');
  if (!el) return;

  if (!node) {
    el.style.display = 'none';
    return;
  }

  const parts = (node.path || node.name).split('/');
  const color = getNodeColor(node.type);

  el.style.display = 'flex';
  el.innerHTML = parts.map((part, i) => {
    const isLast = i === parts.length - 1;
    return `<span class="breadcrumb-segment ${isLast ? 'current' : ''}" ${isLast ? `style="color:${color}"` : ''}>${part}</span>`;
  }).join('<span class="breadcrumb-sep">›</span>');
}

/**
 * Create search bar overlay with results count.
 */
export function createGraphSearch() {
  const search = document.createElement('div');
  search.className = 'graph-search';
  search.innerHTML = `
    <span class="graph-search-icon">⌕</span>
    <input type="text" placeholder="Search files & folders…" id="graph-search-input" />
    <span class="search-results-count" id="search-results-count" style="display:none"></span>
  `;

  const input = search.querySelector('input');
  const countEl = search.querySelector('#search-results-count');

  input.addEventListener('input', debounce(() => {
    const results = searchNodes(input.value);
    if (input.value.trim()) {
      countEl.style.display = 'inline';
      countEl.textContent = `${results.length} found`;
      countEl.style.color = results.length > 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)';
    } else {
      countEl.style.display = 'none';
    }
  }, 250));

  // Clear on escape
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = '';
      searchNodes('');
      countEl.style.display = 'none';
      input.blur();
    }
  });

  return search;
}

/**
 * Cleanup graph instance.
 */
export function destroyGraph() {
  if (graphInstance) {
    graphInstance._destructor?.();
    graphInstance = null;
  }
  fullGraphData = null;
  highlightNodes.clear();
  highlightLinks.clear();
  pathHighlightNodes.clear();
  pathHighlightLinks.clear();
  selectedNode = null;
  hoverNode = null;
  spriteCache.clear();
  tooltipEl = null;
}
