import * as path from 'path';
import * as cp from 'child_process';
import * as test from '@vscode/test-electron';

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // Download VS Code, unzip it and run the integration test
    const vscodeExecutablePath = await test.downloadAndUnzipVSCode();
    
    const vitestPath = path.resolve(extensionDevelopmentPath, 'node_modules', '.bin', 'vitest');
    
    // Run Vitest in the VS Code environment
    const testProcess = cp.spawn(vitestPath, ['run'], {
      shell: true,
      env: { 
        ...process.env,
        VSCODE_EXECUTABLE_PATH: vscodeExecutablePath,
        EXTENSION_DEVELOPMENT_PATH: extensionDevelopmentPath
      },
      stdio: 'inherit'
    });
    
    testProcess.on('close', (code) => {
      if (code !== 0) {
        process.exit(code || 1);
      }
      process.exit(0);
    });

  } catch (err) {
    console.error('Failed to run tests', err);
    process.exit(1);
  }
}

main();