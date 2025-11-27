// postcss.config.js (ESM because "type": "module" in package.json)

/** @type {import('postcss-load-config').Config} */
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
