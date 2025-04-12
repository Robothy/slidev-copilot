import * as vscode from 'vscode';
import { Logger, LogLevel } from './utils/logger';
import { SlidevChatParticipant } from './chatProvider';

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
        
        // Log registration of chat participant
        logger.info('Registering Slidev Copilot chat participant...');
        const chatParticipant = new SlidevChatParticipant(context);
        logger.info('Slidev Copilot chat participant registered successfully');
        
        // Log registration of save command
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
        logger.info('Save command registered successfully');
        
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