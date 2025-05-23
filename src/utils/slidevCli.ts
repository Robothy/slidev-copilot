import * as vscode from 'vscode';
import * as fs from 'fs';
import * as cp from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as net from 'net';
import { Logger } from './logger';
import { SessionManager } from './sessionManager';

/**
 * Class that handles Slidev CLI operations using per-session projects
 */
export class SlidevCli {
  private readonly logger: Logger;
  private slidevTerminal: vscode.Terminal | undefined;
  private extensionPath: string;
  private templateProjectPath: string;
  private sessionManager: SessionManager;
  
  // Track the current running server information
  private activeServer: {
    sessionId: string;
    port: number;
    projectPath: string;
    browserUrl: string;
    startTime: Date;
  } | null = null;
  
  // Default port for Slidev
  private readonly DEFAULT_PORT = 3030;
    
  constructor(context: vscode.ExtensionContext) {
    this.logger = Logger.getInstance();
    this.extensionPath = context.extensionPath;
    this.templateProjectPath = path.join(this.extensionPath, 'resources', 'slidev-template');
    this.sessionManager = SessionManager.getInstance();
    
    // Ensure the template project exists
    this.initializeTemplateProject();
  }
    
  /**
   * Initialize the template Slidev project for reuse
   */
  private initializeTemplateProject(): void {
    this.logger.info('Initializing template Slidev project');
    
    // Create the resources directory if it doesn't exist
    const resourcesDir = path.join(this.extensionPath, 'resources');
    if (!fs.existsSync(resourcesDir)) {
      fs.mkdirSync(resourcesDir, { recursive: true });
    }
    
    // Check if the template project directory exists with dependencies
    const nodeModulesPath = path.join(this.templateProjectPath, 'node_modules');
    const slidevCliPath = path.join(nodeModulesPath, '@slidev', 'cli');
    
    if (!fs.existsSync(this.templateProjectPath)) {
      // Template directory doesn't exist, create minimal structure
      fs.mkdirSync(this.templateProjectPath, { recursive: true });
      this.createMinimalTemplateProject();
    } else if (!fs.existsSync(slidevCliPath)) {
      // Template exists but dependencies are missing
      this.logger.info('Template exists but node_modules missing or incomplete. Installing dependencies...');
      vscode.window.showInformationMessage('Setting up Slidev dependencies in the background.');
      this.installDependenciesAsync(this.templateProjectPath);
    } else {
      this.logger.debug('Using pre-packaged template project with dependencies');
    }
  }
  
  /**
   * Create a minimal template project structure if not pre-packaged
   */
  private createMinimalTemplateProject(): void {
    this.logger.info('Creating minimal template project structure');
    
    // Create a package.json file
    const packageJson = {
      "name": "slidev-template",
      "private": true,
      "type": "module",
      "scripts": {
        "dev": "slidev",
        "build": "slidev build",
        "export": "slidev export"
      },
      "dependencies": {
        "@slidev/cli": "^0.42.0",
        "@slidev/theme-default": "^0.21.2",
        "@slidev/theme-seriph": "^0.21.3"
      },
      "devDependencies": {
        "playwright-chromium": "^1.40.0"  // Pre-install for PDF export
      }
    };
    
    fs.writeFileSync(
      path.join(this.templateProjectPath, 'package.json'), 
      JSON.stringify(packageJson, null, 2)
    );
    
    // Create empty folders for assets and components
    fs.mkdirSync(path.join(this.templateProjectPath, 'assets'), { recursive: true });
    fs.mkdirSync(path.join(this.templateProjectPath, 'components'), { recursive: true });
    
    // Create a basic .gitignore
    fs.writeFileSync(
      path.join(this.templateProjectPath, '.gitignore'),
      'node_modules\n.DS_Store\ndist\n*.local\n.remote-assets\ncomponents.d.ts'
    );
    
    // Install dependencies in the template project - ASYNCHRONOUSLY
    this.logger.info('Installing dependencies in template project');
    vscode.window.showInformationMessage('Setting up Slidev template in the background. This will only happen once.');
    
    // Run npm install in a separate process WITHOUT waiting for it to complete
    this.installDependenciesAsync(this.templateProjectPath);
  }
  
  /**
   * Install dependencies asynchronously without blocking the UI thread
   */
  private installDependenciesAsync(projectPath: string): void {
    // Create a new terminal for installation
    const installTerminal = vscode.window.createTerminal('Slidev Setup');
    
    // Show the terminal first to activate it, then run commands
    installTerminal.show(true); // true = preserve focus
    
    // Run npm install in the terminal
    installTerminal.sendText(`cd "${projectPath}"`);
    installTerminal.sendText(`npm install && echo "SLIDEV_INSTALL_COMPLETE"`);
    
    // Hide the terminal to avoid UI clutter
    setTimeout(() => {
      installTerminal.hide();
    }, 1000);
    
    // Create a timeout to handle case where terminal close event isn't triggered
    const maxWaitTime = 5 * 60 * 1000; // 5 minutes
    const timeout = setTimeout(() => {
      this.logger.info('Dependency installation timeout reached, assuming completion');
      vscode.window.showInformationMessage('Slidev template setup completed.');
      disposable.dispose();
    }, maxWaitTime);
    
    // Listen for terminal close event to report completion
    const disposable = vscode.window.onDidCloseTerminal(terminal => {
      if (terminal === installTerminal) {
        clearTimeout(timeout);
        this.logger.info('Dependency installation completed.');
        vscode.window.showInformationMessage('Slidev template setup completed successfully.');
        disposable.dispose();
      }
    });
  }
  
  /**
   * Get or create a session project for the given session ID
   */
  async getSessionProject(sessionId: string, markdownContent?: string): Promise<string> {
    // Check if we already have a project for this session
    const existingProjectPath = this.sessionManager.getSlidevProjectPath(sessionId);
    if (existingProjectPath && fs.existsSync(existingProjectPath)) {
      this.logger.debug(`Using existing session project at: ${existingProjectPath}`);
      
      // If markdown content is provided, update the slides
      if (markdownContent) {
        this.updateProjectSlides(existingProjectPath, markdownContent);
      }
      
      return existingProjectPath;
    }
    
    // Create a new project for this session
    const projectPath = await this.createSessionProject(sessionId, markdownContent);
    this.sessionManager.updateSlidevProjectPath(sessionId, projectPath);
    return projectPath;
  }
  
  /**
   * Create a new session project by copying the template
   */
  private async createSessionProject(sessionId: string, markdownContent?: string): Promise<string> {
    this.logger.info(`Creating new session project for session: ${sessionId}`);
    
    try {
      // Create a folder in the temp directory
      const tempDir = path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || path.join(os.tmpdir(), 'slidev-copilot'), '.slidev');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Create a timestamp-based folder name for better readability
      const timestamp = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+/, '');
      const sessionDir = path.join(tempDir, `slidev-${timestamp}-${sessionId.substring(0, 8)}`);
      
      if (fs.existsSync(sessionDir)) {
        // Clean up any existing directory with the same name
        this.deleteDirectory(sessionDir);
      }
      
      fs.mkdirSync(sessionDir, { recursive: true });
      
      // Copy the template project to this folder efficiently
      // First copy basic project files but exclude node_modules
      const entries = fs.readdirSync(this.templateProjectPath, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(this.templateProjectPath, entry.name);
        const destPath = path.join(sessionDir, entry.name);
        
        // Skip node_modules - we'll handle it with a symlink/junction for efficiency
        if (entry.name === 'node_modules') {
          continue;
        }
        
        if (entry.isDirectory()) {
          // Recursively copy directories
          this.copyDirectory(srcPath, destPath);
        } else {
          // Copy files
          fs.copyFileSync(srcPath, destPath);
        }
      }
      
      // Now handle node_modules - create a symbolic link or junction on Windows
      // This makes creating new sessions much faster as we don't copy large node_modules folders
      const srcNodeModules = path.join(this.templateProjectPath, 'node_modules');
      const destNodeModules = path.join(sessionDir, 'node_modules');
      
      if (fs.existsSync(srcNodeModules)) {
        try {
          // On Windows, use junction which doesn't require special permissions
          if (os.platform() === 'win32') {
            this.logger.debug('Creating junction for node_modules on Windows');
            // Windows requires absolute paths for junctions
            cp.execSync(`mklink /J "${destNodeModules}" "${srcNodeModules}"`);
          } else {
            // On Unix systems, create a symbolic link
            this.logger.debug('Creating symlink for node_modules on Unix');
            fs.symlinkSync(srcNodeModules, destNodeModules, 'dir');
          }
          this.logger.info('Successfully linked node_modules from template');
        } catch (error) {
          // If linking fails, fall back to a copy but log the warning
          this.logger.warn('Failed to create link for node_modules, falling back to copy:', error);
          this.copyDirectory(srcNodeModules, destNodeModules);
        }
      } else {
        this.logger.warn('No node_modules found in template, dependencies may need to be installed');
      }
      
      // Create Vite configuration to allow access to linked node_modules
      await this.createViteConfig(sessionDir);
      
      // If markdown content is provided, create a slides file
      if (markdownContent) {
        this.updateProjectSlides(sessionDir, markdownContent);
      }
      
      this.logger.info(`Created session project at: ${sessionDir}`);
      return sessionDir;
    } catch (error) {
      this.logger.error('Failed to create session project:', error);
      throw new Error(`Failed to create session project: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Update the slides in a project with new content
   */
  private updateProjectSlides(projectPath: string, markdownContent: string): void {
    try {
      const slidesPath = path.join(projectPath, 'slides.md');
      fs.writeFileSync(slidesPath, markdownContent);
      this.logger.debug(`Updated slides at: ${slidesPath}`);
    } catch (error) {
      this.logger.error('Failed to update slides:', error);
      throw new Error(`Failed to update slides: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Find an available port starting from the given port number
   * @param startPort The port to start checking from
   * @returns Promise resolving to an available port
   */
  private async findAvailablePort(startPort: number = this.DEFAULT_PORT): Promise<number> {
    this.logger.debug(`Looking for available port starting from ${startPort}`);
    
    const isPortAvailable = (port: number): Promise<boolean> => {
      return new Promise(resolve => {
        const server = net.createServer();
        
        server.once('error', () => {
          // Error means port is not available
          resolve(false);
        });
        
        server.once('listening', () => {
          // Clean up the server so it closes and can be reused
          server.close();
          resolve(true);
        });
        
        // Try to listen on the port
        server.listen(port);
      });
    };
    
    // Start checking from the startPort
    let port = startPort;
    const maxPort = startPort + 10; // Try up to 10 ports to avoid infinite loop
    
    while (port < maxPort) {
      const available = await isPortAvailable(port);
      if (available) {
        this.logger.debug(`Found available port: ${port}`);
        return port;
      }
      port++;
    }
    
    // If we get here, we couldn't find an available port in the range
    this.logger.warn(`Could not find available port in range ${startPort}-${maxPort-1}, returning default port`);
    return this.DEFAULT_PORT;
  }
  
  /**
   * Stop the currently running Slidev server if one exists
   */
  private async stopActiveSlidevServer(): Promise<void> {
    if (!this.activeServer) {
      this.logger.debug('No active Slidev server to stop');
      return;
    }
    
    this.logger.info(`Stopping active Slidev server for session ${this.activeServer.sessionId} on port ${this.activeServer.port}`);
    
    // Dispose the terminal if it exists
    if (this.slidevTerminal) {
      this.slidevTerminal.dispose();
      this.slidevTerminal = undefined;
    }
    
    // On Windows, we need to manually kill processes that might be using the port
    if (os.platform() === 'win32') {
      try {
        // Find and kill processes using the port
        const command = `FOR /F "tokens=5" %p IN ('netstat -ano ^| findstr :${this.activeServer.port}') DO taskkill /F /PID %p`;
        cp.execSync(command);
        this.logger.debug(`Executed command to kill processes on port ${this.activeServer.port}`);
      } catch (error) {
        // This is not critical, so just log it
        this.logger.warn(`Failed to kill processes on port ${this.activeServer.port}:`, error);
      }
    } else {
      // For Unix-like OS, we can use the simpler lsof command
      try {
        cp.execSync(`lsof -i :${this.activeServer.port} -t | xargs kill -9`);
        this.logger.debug(`Executed command to kill processes on port ${this.activeServer.port}`);
      } catch (error) {
        // This is not critical, so just log it
        this.logger.warn(`Failed to kill processes on port ${this.activeServer.port}:`, error);
      }
    }
    
    // Clear the active server reference
    this.activeServer = null;
    
    // Add a small delay to make sure the port is released
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  /**
   * Open the browser to the Slidev presentation
   * @param port The port to open
   */
  private async openSlidevInBrowser(port: number): Promise<void> {
    const url = `http://localhost:${port}`;
    this.logger.info(`Opening Slidev in browser at ${url}`);
    
    // Use VS Code's openExternal to open the URL in the default browser
    await vscode.env.openExternal(vscode.Uri.parse(url));
  }

  /**
   * Start a Slidev server for the given session
   * @param sessionId The session ID
   * @param markdownContent The markdown content for the slides
   */
  async startSlidevServer(sessionId: string, markdownContent: string): Promise<void> {
    this.logger.info(`Starting Slidev server for session: ${sessionId}`);
    
    try {
      // Get or create a project for this session
      const projectPath = await this.getSessionProject(sessionId, markdownContent);
      
      // Check if we're already running a server for this session
      if (this.activeServer && this.activeServer.sessionId === sessionId) {
        this.logger.info(`Server already running for session ${sessionId}, updating slides and refreshing`);
        
        // Just update the slides and open the browser
        this.updateProjectSlides(projectPath, markdownContent);
        await this.openSlidevInBrowser(this.activeServer.port);
        
        // Notify the user
        vscode.window.showInformationMessage('Slides updated. Refreshing browser to show changes.');
        return;
      }
      
      // If there's a different session active, stop it first
      if (this.activeServer && this.activeServer.sessionId !== sessionId) {
        this.logger.info(`Stopping server for session ${this.activeServer.sessionId} to start one for ${sessionId}`);
        await this.stopActiveSlidevServer();
      }
      
      // Find an available port
      const port = await this.findAvailablePort();
      
      // If we already have a terminal, dispose it
      if (this.slidevTerminal) {
        this.logger.debug('Disposing existing Slidev terminal');
        this.slidevTerminal.dispose();
        this.slidevTerminal = undefined;
      }
      
      // Create a new terminal for Slidev
      this.slidevTerminal = vscode.window.createTerminal('Slidev');
      this.logger.debug('Created Slidev terminal');
      
      // Make the terminal visible
      this.slidevTerminal.show();
      
      // Change to the project directory and start Slidev
      this.slidevTerminal.sendText(`cd "${projectPath}"`);
      this.slidevTerminal.sendText(`npx slidev slides.md --port ${port} --open`);
      
      // Update our tracking of the active server
      this.activeServer = {
        sessionId,
        port,
        projectPath,
        browserUrl: `http://localhost:${port}`,
        startTime: new Date()
      };
      
      // Show notification
      vscode.window.showInformationMessage(`Starting Slidev server on port ${port}. A browser window should open shortly.`);
      
    } catch (error) {
      this.logger.error('Failed to start Slidev server:', error);
      vscode.window.showErrorMessage(`Failed to start Slidev server: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Get the path where the PDF will be exported for the given session
   * Shows a save dialog to let the user choose the export location
   */
  async getExportPath(sessionId: string): Promise<string> {
    // Get project for this session (without markdown content)
    const projectPath = await this.getSessionProject(sessionId);
    
    // Default output path (will be used as suggestion)
    const defaultOutputPath = path.join(projectPath, 'presentation.pdf');
    
    // Show save dialog to let user choose where to save the PDF
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(defaultOutputPath),
      filters: {
        'PDF': ['pdf']
      },
      title: 'Choose where to save the PDF presentation'
    });
    
    // If user canceled the dialog, use the default path
    if (!uri) {
      this.logger.debug(`User canceled save dialog, using default path: ${defaultOutputPath}`);
      return defaultOutputPath;
    }
    
    const outputPath = uri.fsPath;
    this.logger.debug(`User selected PDF export path: ${outputPath}`);
    return outputPath;
  }
  
  /**
   * Export the presentation to PDF for the given session
   */
  async exportToPdf(sessionId: string, markdownContent: string): Promise<string> {
    this.logger.info(`Exporting presentation to PDF for session: ${sessionId}`);
    
    try {
      // Get or create a project for this session
      const projectPath = await this.getSessionProject(sessionId, markdownContent);
      
      // Get the output path that was selected by the user via getExportPath
      // Note: The outputPath is now passed in from the command handler
      const outputPath = this.sessionManager.getExportPath(sessionId);
      if (!outputPath) {
        throw new Error("Export path not available. Please select a location to save the PDF.");
      }
      
      // Make sure the output directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Create a new terminal for export
      const exportTerminal = vscode.window.createTerminal('Slidev Export');
      this.logger.debug('Created Slidev export terminal');
      
      // Make the terminal visible
      exportTerminal.show();
      
      // Set up a listener to close the terminal once export is complete
      // Instead of using onDidWriteTerminalData (which doesn't exist),
      // we'll set up a file watcher to detect when the PDF is created
      const watcher = fs.watch(outputDir, (eventType, filename) => {
        if (filename && path.basename(outputPath) === filename && fs.existsSync(outputPath)) {
          this.logger.debug('PDF export detected via file watcher');
          
          // Give a small delay before closing to ensure the process is complete
          setTimeout(() => {
            exportTerminal.dispose();
            watcher.close(); // Stop watching once we've detected the file
          }, 2000); // 2-second delay
        }
      });
      
      // Also listen for terminal close events to clean up the watcher
      const terminalCloseListener = vscode.window.onDidCloseTerminal(terminal => {
        if (terminal === exportTerminal) {
          watcher.close();
          terminalCloseListener.dispose();
        }
      });
      
      exportTerminal.sendText(`cd "${projectPath}"`);
      
      // Run the export command with the chosen output path
      exportTerminal.sendText(`npx slidev export slides.md --output "${outputPath}"`);
      
      return outputPath;
    } catch (error) {
      this.logger.error('Failed to export PDF:', error);
      throw new Error(`Failed to export PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Get the path to the slides markdown file for a session
   */
  getSessionSlidesPath(sessionId: string): string | undefined {
    const projectPath = this.sessionManager.getSlidevProjectPath(sessionId);
    if (!projectPath) {
      return undefined;
    }
    
    return path.join(projectPath, 'slides.md');
  }
  
  /**
   * Helper to copy a directory recursively
   */
  private copyDirectory(source: string, destination: string): void {
    // Create the destination directory
    if (!fs.existsSync(destination)) {
      fs.mkdirSync(destination, { recursive: true });
    }
    
    // Get all entries in the source directory
    const entries = fs.readdirSync(source, { withFileTypes: true });
    
    // Copy each entry
    for (const entry of entries) {
      const srcPath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);
      
      if (entry.isDirectory()) {
        // Recursively copy directories
        this.copyDirectory(srcPath, destPath);
      } else {
        // Copy files
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
  
  /**
   * Helper to delete a directory recursively
   */
  private deleteDirectory(directoryPath: string): void {
    if (fs.existsSync(directoryPath)) {
      const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(directoryPath, entry.name);
        
        if (entry.isDirectory()) {
          this.deleteDirectory(fullPath);
        } else {
          fs.unlinkSync(fullPath);
        }
      }
      
      fs.rmdirSync(directoryPath);
    }
  }
  
  /**
   * Dispose resources
   */
  dispose(): void {
    if (this.slidevTerminal) {
      this.slidevTerminal.dispose();
      this.slidevTerminal = undefined;
    }
  }

  /**
   * Create a Vite config file to allow access to the template node_modules
   */
  private async createViteConfig(projectPath: string): Promise<void> {
    const viteConfigPath = path.join(projectPath, 'vite.config.js');
    const viteConfigContent = `
      import { defineConfig } from 'vite';

      export default defineConfig({
        server: {
          fs: {
            allow: [
              // Allow the template project path which contains node_modules
              '${this.templateProjectPath.replace(/\\/g, '\\\\')}',
              // Allow the session project path
              '${projectPath.replace(/\\/g, '\\\\')}',
              // Add the root directory containing the node_modules
              '${path.dirname(this.templateProjectPath).replace(/\\/g, '\\\\')}'
            ]
          }
        }
      });
    `;
    fs.writeFileSync(viteConfigPath, viteConfigContent);
    this.logger.debug(`Created Vite config at: ${viteConfigPath}`);
  }
}