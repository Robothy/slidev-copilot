import { describe, it, expect, beforeAll } from 'vitest';
import * as vscode from 'vscode';

describe('Extension Test Suite', () => {
  beforeAll(() => {
    vscode.window.showInformationMessage('Starting the extension test suite');
  });

  it('Extension should be present', () => {
    // The extension ID is usually in format "publisher.name" 
    // Since we're in development mode, we can check for the extension by checking
    // if any extension with the name part of the ID is loaded
    const extension = vscode.extensions.all.find(ext => 
      ext.id.toLowerCase().includes('slidev-copilot'));
    expect(extension).toBeDefined();
    expect(extension).not.toBeNull();
  });
});