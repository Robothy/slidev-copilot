import * as vscode from 'vscode';
import * as fs from 'fs';
import * as cp from 'child_process';
import { Logger } from './logger';

/**
 * Class that handles Slidev CLI operations
 */
export class SlidevCli {
  private readonly logger: Logger;
  private slidevTerminal: vscode.Terminal | undefined;
  private isNpmInstalled = false;
    
  constructor() {
    this.logger = Logger.getInstance();
  }
    
  /**
     * Check if Slidev is installed globally or in the project
     */
  async checkSlidevInstallation(): Promise<boolean> {
    this.logger.debug('Checking Slidev installation...');
        
    try {
      // Check if npm is available
      this.logger.debug('Checking npm availability...');
      await this.runCommand('npm --version');
      this.isNpmInstalled = true;
      this.logger.debug('npm is available');

      // Try to check if Slidev is installed globally
      try {
        this.logger.debug('Checking if Slidev is installed globally...');
        await this.runCommand('npx --no slidev --version');
        this.logger.info('Slidev is already installed globally');
        return true;
      } catch (error) {
        this.logger.info('Slidev is not installed globally, will install on demand');
        return false;
      }
    } catch (error) {
      this.logger.error('npm is not available:', error);
      this.isNpmInstalled = false;
      return false;
    }
  }
    
  /**
     * Start a Slidev server for the given markdown file
     */
  async startSlidevServer(markdownPath: string): Promise<void> {
    this.logger.info('Starting Slidev server for file:', markdownPath);
        
    if (!fs.existsSync(markdownPath)) {
      throw new Error(`Markdown file not found: ${markdownPath}`);
    }
        
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
        
    if (!this.isNpmInstalled) {
      // Show error message if npm is not installed
      vscode.window.showErrorMessage('npm is required to run Slidev but was not found. Please install npm and try again.');
      return;
    }
        
    // Run Slidev in the terminal
    const command = `npx --yes slidev "${markdownPath}" --open`;
    this.slidevTerminal.sendText(command);
    this.logger.info('Sent command to terminal:', command);
        
    // Show notification
    vscode.window.showInformationMessage('Starting Slidev server. A browser window should open shortly.');
  }
    
  /**
     * Export the presentation to PDF
     */
  async exportToPdf(markdownPath: string): Promise<void> {
    this.logger.info('Exporting presentation to PDF:', markdownPath);
        
    if (!fs.existsSync(markdownPath)) {
      throw new Error(`Markdown file not found: ${markdownPath}`);
    }
        
    // Create a new terminal for export
    const exportTerminal = vscode.window.createTerminal('Slidev Export');
    this.logger.debug('Created Slidev export terminal');
        
    // Make the terminal visible
    exportTerminal.show();
        
    if (!this.isNpmInstalled) {
      // Show error message if npm is not installed
      vscode.window.showErrorMessage('npm is required to export slides but was not found. Please install npm and try again.');
      return;
    }
        
    // Get output path
    const outputPath = markdownPath.replace(/\.md$/, '.pdf');
        
    // Run Slidev export in the terminal
    const command = `npx --yes slidev export "${markdownPath}" --output "${outputPath}"`;
    exportTerminal.sendText(command);
    this.logger.info('Sent export command to terminal:', command);
        
    // Show notification
    vscode.window.showInformationMessage(`Exporting presentation to PDF: ${outputPath}`);
  }
    
  /**
     * Run a command and return its output
     */
  private runCommand(command: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      cp.exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
                
        if (stderr) {
          this.logger.warn(`Command stderr: ${stderr}`);
        }
                
        resolve(stdout.trim());
      });
    });
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
}