// Their Vite config aliases react/jsx-runtime to lib/ico-runtime.js (emoji → Tabler icons). Here the same file is the
// JSX import source of every file under src/port only (next.config.ts adds the pragma with ico-loader.cjs).
export { Fragment, jsx, jsxs } from '../../lib/ico-runtime.js';
