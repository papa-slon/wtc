/** Token values for inline/JS use (charts, etc.). CSS variables live in theme.css. */
export const tokens = {
  bg: '#050a12',
  panel: '#0b1423',
  text: '#f1f5f9',
  muted: '#94a3b8',
  dim: '#64748b',
  gold: '#d5a94f',
  gold2: '#f2d78f',
  cyan: '#69e2ff',
  green: '#54d6a1',
  red: '#ff6b74',
  amber: '#f5c451',
} as const;

export const chartColors = [tokens.cyan, tokens.gold, tokens.green, tokens.red, tokens.gold2] as const;
