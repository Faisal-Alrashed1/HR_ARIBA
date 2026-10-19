// Turbopack/webpack loader: makes lib/ico-runtime.js the JSX runtime of their files (their vite.config.js alias),
// so the emoji in their screens render as Tabler icons exactly as in their build. Scoped to src/port by next.config.ts.
module.exports = function icoLoader(source) {
  if (this.resourcePath.includes('/next/ico/') || this.resourcePath.endsWith('/lib/ico-runtime.js')) return source;
  return '/** @jsxImportSource @/port/next/ico */\n' + source;
};
