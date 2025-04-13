import * as vscode from 'vscode';
import { Logger, LogLevel } from './utils/logger';
import { SlidevChatParticipant } from './chatProvider';
import { SlidevCli } from './utils/slidevCli';
import { SessionManager } from './utils/sessionManager';

// Initialize logger
const logger = Logger.getInstance();

export function activate(context: vscode.ExtensionContext) {
  // Set to Debug level for more verbose logging during troubleshooting
  Logger.setLevel(LogLevel.Debug);
    
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
    const slidevCli = new SlidevCli();
    context.subscriptions.push({ dispose: () => slidevCli.dispose() });
        
    // Check Slidev installation when the extension activates
    slidevCli.checkSlidevInstallation().then(isInstalled => {
      logger.info('Slidev installation status:', isInstalled ? 'installed' : 'not installed');
    }).catch(error => {
      logger.error('Error checking Slidev installation:', error);
    });
        
    // Log registration of chat participant
    logger.info('Registering Slidev Copilot chat participant...');
    new SlidevChatParticipant(context);
    logger.info('Slidev Copilot chat participant registered successfully');
        
    // Register save command
    logger.info('Registering save command...');
    context.subscriptions.push(
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
        
    // Register preview command
    logger.info('Registering preview command...');
    context.subscriptions.push(
      vscode.commands.registerCommand('slidev-copilot.previewSlides', async (filePath: string) => {
        logger.debug('Preview command triggered with file path:', filePath);
                
        try {
          await slidevCli.startSlidevServer(filePath);
        } catch (error) {
          logger.error('Error starting Slidev server:', error);
          vscode.window.showErrorMessage(`Failed to start Slidev server: ${error instanceof Error ? error.message : String(error)}`);
        }
      })
    );
        
    // Register export command
    logger.info('Registering export command...');
    context.subscriptions.push(
      vscode.commands.registerCommand('slidev-copilot.exportSlides', async (filePath: string) => {
        logger.debug('Export command triggered with file path:', filePath);
                
        try {
          await slidevCli.exportToPdf(filePath);
        } catch (error) {
          logger.error('Error exporting to PDF:', error);
          vscode.window.showErrorMessage(`Failed to export to PDF: ${error instanceof Error ? error.message : String(error)}`);
        }
      })
    );
        
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