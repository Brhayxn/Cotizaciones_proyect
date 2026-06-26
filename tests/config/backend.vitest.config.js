const { defineConfig } = require('vitest/config');
const path = require('path');

module.exports = defineConfig({
  root: path.resolve(__dirname, '../..'),
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/backend/**/*.test.js'],
    setupFiles: ['./tests/setup/backend.js'],
    fileParallelism: false,
    sequence: { concurrent: false }
  }
});
