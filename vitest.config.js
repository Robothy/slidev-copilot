"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
  return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("vitest/config");
const path_1 = __importDefault(require("path"));
exports.default = (0, config_1.defineConfig)({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/src/test/suite/**/*.test.ts'],
    // Needed for VS Code extension testing
    setupFiles: ['src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path_1.default.resolve(__dirname, './src'),
    },
  },
});
//# sourceMappingURL=vitest.config.js.map