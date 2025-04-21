import * as vscode from 'vscode';
import { Logger, LogLevel } from './utils/logger';
import { SlidevChatParticipant } from './slidevChatParticipant';
import { SlidevCli } from './utils/slidevCli';
import { SessionManager } from './utils/sessionManager';

// Initialize logger
const logger = Logger.getInstance();

export function activate(context: vscode.ExtensionContext) {
  // Load log level from configuration
  Logger.loadLogLevelFromConfig();
    
  // Register a configuration change listener
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('slidev-copilot.logLevel')) {
        logger.info('Log level configuration changed, updating...');
        Logger.loadLogLevelFromConfig();
      }
    })
  );
    
  // Show the output channel automatically to see logs during debugging
  logger.show();
    
  logger.info('🚀 Activating Slidev Copilot extension...');
    
  try {
    // Log extension context details for debugging
    logger.debug('Extension path:', context.extensionPath);
    logger.debug('Extension ID:', context.extension.id);
    logger.debug('Extension version:', context.extension.packageJSON.version);
        
    // Log VSCode version information
    logger.debug('VSCode version:', vscode.version);
    logger.debug('VSCode API version:', `${vscode.version}`);
        
    // Initialize SessionManager
    logger.debug('Initializing SessionManager...');
    const sessionManager = SessionManager.getInstance();
    sessionManager.initialize(context);
    logger.debug('SessionManager initialized');
        
    // Initialize Slidev CLI
    const slidevCli = new SlidevCli(context);
    context.subscriptions.push({ dispose: () => slidevCli.dispose() });
        
    // Create and initialize the Slidev Copilot chat participant
    logger.info('Registering Slidev Copilot chat participant...');
    const chatParticipant = new SlidevChatParticipant(context);
    chatParticipant.initialize();
    logger.info('Slidev Copilot chat participant registered successfully');
        
    // Register commands
    logger.info('Registering command handlers...');
    context.subscriptions.push(
      vscode.commands.registerCommand('slidev-copilot.previewSlides', async (sessionId: string, content: string) => {
        await slidevCli.startSlidevServer(sessionId, content);
      }),
      vscode.commands.registerCommand('slidev-copilot.exportSlides', async (sessionId: string, content: string) => {
        try {
          // Let user choose where to save the PDF
          const outputPath = await slidevCli.getExportPath(sessionId);
          
          // Store the selected path in the session manager
          sessionManager.updateExportPath(sessionId, outputPath);
          
          vscode.window.showInformationMessage(`Exporting presentation to PDF at: ${outputPath}. Please wait...`);
          
          // Start the export process
          await slidevCli.exportToPdf(sessionId, content);
          
          // Monitor for the completion of the export process
          const checkFileExistsAndNotify = async () => {
            try {
              // Check if the file exists and has content
              const stat = await vscode.workspace.fs.stat(vscode.Uri.file(outputPath));
              if (stat.size > 0) {
                // File exists and has content, show the success message with Open button
                vscode.window.showInformationMessage(`Presentation exported to ${outputPath}`, 'Open').then(action => {
                  if (action === 'Open') {
                    vscode.env.openExternal(vscode.Uri.file(outputPath));
                  }
                });
                return true; // Export complete
              }
            } catch (err) {
              // File doesn't exist yet or other error
              logger.debug(`Waiting for export to complete: ${err}`);
            }
            return false; // Export not complete yet
          };
          
          // Check immediately, then poll every second
          if (!(await checkFileExistsAndNotify())) {
            const interval = setInterval(async () => {
              if (await checkFileExistsAndNotify()) {
                clearInterval(interval);
              }
            }, 1000);
            
            // Set a timeout of 3 minutes to prevent infinite polling
            setTimeout(() => {
              clearInterval(interval);
              logger.warn('PDF export timeout reached');
            }, 3 * 60 * 1000);
          }
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to export presentation: ${error}`);
        }
      }),
      vscode.commands.registerCommand('slidev-copilot.saveSlides', async (filePath: string) => {
        logger.debug('Save command triggered with file path:', filePath);
                
        const uri = await vscode.window.showSaveDialog({
          filters: {
            'Markdown': ['md']
          },
          title: 'Save Slidev Presentation',
          defaultUri: vscode.Uri.file(filePath)
        });
                
        if (uri) {
          try {
            logger.debug('Saving file to:', uri.fsPath);
            const tempFileUri = vscode.Uri.file(filePath);
            const content = await vscode.workspace.fs.readFile(tempFileUri);
            await vscode.workspace.fs.writeFile(uri, content);
            await vscode.commands.executeCommand('vscode.open', uri);
            vscode.window.showInformationMessage('Slidev presentation saved successfully!');
            logger.info('Slidev presentation saved successfully to:', uri.fsPath);
          } catch (error) {
            logger.error('Error saving file:', error);
            vscode.window.showErrorMessage(`Failed to save file: ${error instanceof Error ? error.message : String(error)}`);
          }
        } else {
          logger.debug('Save dialog canceled by user');
        }
      })
    );
    
    // Periodically clean up old sessions - Use SessionManager's built-in cleanup
    // The SessionManager already handles periodic cleanup, so we don't need to duplicate it here
    logger.info('Session cleanup is handled by SessionManager');
    
    // Log successful activation
    logger.info('✅ Slidev Copilot extension activated successfully');
  } catch (error) {
    logger.error('❌ Error activating Slidev Copilot extension:', error);
    throw error; // Rethrow to let VSCode handle it
  }
}

export function deactivate() {
  logger.info('Deactivating Slidev Copilot extension...');
  // Perform any cleanup
  logger.dispose();
}