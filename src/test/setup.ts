// This file is run before each test file
// It can be used to set up global test environment for VS Code extension testing

import { vi } from 'vitest';

// Mock VS Code API with all required functionality for our tests
vi.mock('vscode', async () => {
  const outputChannels = new Map();
  
  return {
    window: {
      showInformationMessage: vi.fn(),
      showErrorMessage: vi.fn(),
      createOutputChannel: vi.fn((name) => {
        if (!outputChannels.has(name)) {
          outputChannels.set(name, {
            name,
            append: vi.fn(),
            appendLine: vi.fn(),
            clear: vi.fn(),
            show: vi.fn(),
            hide: vi.fn(),
            dispose: vi.fn()
          });
        }
        return outputChannels.get(name);
      }),
    },
    workspace: {
      getConfiguration: vi.fn().mockReturnValue({
        get: vi.fn(),
        update: vi.fn(),
      }),
    },
    Uri: {
      file: vi.fn((path) => ({ path })),
    },
    extensions: {
      all: [
        { id: 'test.slidev-copilot' }
      ]
    },
    LogLevel: {
      Debug: 0,
      Error: 3,
      Info: 1,
      Off: 4,
      Trace: 0,
      Warning: 2
    }
  };
});