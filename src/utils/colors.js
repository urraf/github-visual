/**
 * colors.js — File type → color mapping for 3D nodes
 */

export const nodeColors = {
  root:      '#a855f7',
  directory: '#3b82f6',
  source:    '#22c55e',
  config:    '#eab308',
  docs:      '#f97316',
  other:     '#6b7280',
};

export const nodeColorsRGB = {
  root:      [168, 85, 247],
  directory: [59, 130, 246],
  source:    [34, 197, 94],
  config:    [234, 179, 8],
  docs:      [249, 115, 22],
  other:     [107, 114, 128],
};

/**
 * Get color for a node based on its type.
 */
export function getNodeColor(type) {
  return nodeColors[type] || nodeColors.other;
}

/**
 * Get a lighter version of a color for glow effects.
 */
export function getNodeGlowColor(type, alpha = 0.4) {
  const rgb = nodeColorsRGB[type] || nodeColorsRGB.other;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

/**
 * Generate link color based on depth.
 */
export function getLinkColor(depth, maxDepth = 10) {
  const intensity = Math.max(0.05, 0.25 - (depth / maxDepth) * 0.2);
  return `rgba(255, 255, 255, ${intensity})`;
}

/**
 * Language colors for the stats bar.
 */
export const languageColors = {
  JavaScript:  '#f1e05a',
  TypeScript:  '#3178c6',
  Python:      '#3572A5',
  Java:        '#b07219',
  Go:          '#00ADD8',
  Rust:        '#dea584',
  Ruby:        '#701516',
  PHP:         '#4F5D95',
  'C++':       '#f34b7d',
  C:           '#555555',
  'C#':        '#178600',
  Swift:       '#F05138',
  Kotlin:      '#A97BFF',
  Dart:        '#00B4AB',
  Scala:       '#c22d40',
  Shell:       '#89e051',
  HTML:        '#e34c26',
  CSS:         '#563d7c',
  SCSS:        '#c6538c',
  Vue:         '#41b883',
  Svelte:      '#ff3e00',
  Lua:         '#000080',
  R:           '#198CE7',
  Julia:       '#a270ba',
  Elixir:      '#6e4a7e',
  Haskell:     '#5e5086',
  Clojure:     '#db5855',
  Erlang:      '#B83998',
  Dockerfile:  '#384d54',
  Makefile:    '#427819',
  Markdown:    '#083fa1',
};

/**
 * Get a color for a language, falling back to a generated color.
 */
export function getLanguageColor(language) {
  if (languageColors[language]) return languageColors[language];
  // Generate a deterministic color from the language name
  let hash = 0;
  for (let i = 0; i < language.length; i++) {
    hash = language.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 55%)`;
}

/**
 * Get an emoji/icon for a file type category.
 */
export function getFileIcon(type, name) {
  if (type === 'directory') return '📁';
  if (type === 'root') return '📦';

  const ext = name?.split('.').pop()?.toLowerCase();
  const iconMap = {
    js: '🟨', jsx: '⚛️', ts: '🔷', tsx: '⚛️',
    py: '🐍', go: '🔵', rs: '🦀', rb: '💎',
    java: '☕', c: '©️', cpp: '➕', cs: '🟪',
    swift: '🍊', kt: '🟣', html: '🌐', css: '🎨',
    scss: '🎨', json: '📋', yaml: '📋', yml: '📋',
    toml: '📋', xml: '📋', md: '📝', txt: '📄',
    svg: '🖼️', png: '🖼️', jpg: '🖼️', gif: '🖼️',
    sh: '⚙️', bash: '⚙️', dockerfile: '🐳',
    sql: '🗃️', graphql: '◆', proto: '📡',
    lock: '🔒', env: '🔐',
  };

  return iconMap[ext] || '📄';
}
