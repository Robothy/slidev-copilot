import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Starting the extension test suite');

  test('Extension should be present', () => {
    // The extension ID is usually in format "publisher.name" 
    // Since we're in development mode, we can check for the extension by checking
    // if any extension with the name part of the ID is loaded
    const extension = vscode.extensions.all.find(ext => 
      ext.id.toLowerCase().includes('slidev-copilot'));
    assert.ok(extension, 'The Slidev Copilot extension was not found');
  });

});