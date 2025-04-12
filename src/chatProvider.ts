import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { SlidevGenerator } from './slidevGenerator';
import { Logger } from './utils/logger';

export class SlidevChatParticipant {
    private readonly slidevGenerator: SlidevGenerator;
    private readonly logger: Logger;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.slidevGenerator = new SlidevGenerator();
        this.logger = Logger.getInstance();
        
        // Create a reference to this for use in the handler
        const self = this;
        
        this.logger.debug('Creating Slidev Copilot chat participant...');
        
        try {
            // Define the chat handler according to VS Code API
            const handler = async (
                request: vscode.ChatRequest, 
                context: vscode.ChatContext, 
                stream: vscode.ChatResponseStream, 
                token: vscode.CancellationToken
            ) => {
                try {
                    this.logger.debug('Received chat request:', request.prompt);
                    this.logger.debug('Chat context history length:', context.history?.length || 0);
                    
                    // Report initial progress
                    stream.markdown('🎬 Generating your Slidev presentation...\n\n');
                    this.logger.info('Started generating Slidev presentation');
                    
                    if (!request.model) {
                        this.logger.error('No language model available in the request');
                        stream.markdown('❌ Error: No language model available. Please make sure you have access to a language model and try again.');
                        return;
                    }
                    
                    this.logger.info(`Using language model: ${request.model.name} (${request.model.vendor})`);

                    // Generate Slidev markdown using the model from the request
                    const slidevMarkdown = await self.slidevGenerator.generateSlidevMarkdown(
                        request.prompt,
                        context,
                        request.model,
                        token
                    );

                    if (token.isCancellationRequested) {
                        this.logger.info('Operation cancelled by user');
                        stream.markdown('Operation cancelled.');
                        return;
                    }

                    // Save to temp file
                    const tempFilePath = await self.saveTempMarkdown(slidevMarkdown);
                    this.logger.info('Saved temporary markdown file at:', tempFilePath);
                    
                    // Return response with markdown preview and save button
                    this.logger.debug('Returning response with preview');
                    stream.markdown(`I've generated a Slidev presentation based on your requirements. Here's a preview:\n\n\`\`\`markdown\n${slidevMarkdown.substring(0, 500)}${slidevMarkdown.length > 500 ? '...' : ''}\n\`\`\``);
                    
                    // Add save button as a command
                    this.logger.debug('Adding save button to response');
                    stream.button({
                        command: 'slidev-copilot.saveSlides',
                        title: '💾 Save Presentation',
                        arguments: [tempFilePath]
                    });
                    
                    this.logger.info('Successfully completed chat request');
                } catch (error) {
                    this.logger.error('Error handling chat request:', error);
                    stream.markdown(`Error generating Slidev presentation: ${error instanceof Error ? error.message : String(error)}`);
                }
            };
            
            this.logger.debug('Registering chat participant with VS Code API');
            
            try {
                // Register the chat participant with the proper VS Code API
                const participant = vscode.chat.createChatParticipant('slidev-copilot', handler);
                
                // Set the icon path
                const iconPath = path.join(context.extensionPath, 'media', 'slidev-icon.svg');
                this.logger.debug('Setting icon path:', iconPath);
                
                if (fs.existsSync(iconPath)) {
                    participant.iconPath = vscode.Uri.file(iconPath);
                    this.logger.debug('Icon path set successfully');
                } else {
                    this.logger.warn('Icon file not found at path:', iconPath);
                }
                
                // Add participant to subscriptions for proper disposal
                context.subscriptions.push(participant);
                this.logger.info('Chat participant registered successfully');
            } catch (error) {
                this.logger.error('Failed to register chat participant:', error);
                throw error;
            }
        } catch (error) {
            this.logger.error('Error in SlidevChatParticipant constructor:', error);
            throw error;
        }
    }

    private async saveTempMarkdown(markdown: string): Promise<string> {
        this.logger.debug('Saving markdown to temporary file...');
        
        try {
            const tempDir = path.join(os.tmpdir(), 'slidev-copilot');
            this.logger.debug('Temp directory path:', tempDir);
            
            // Create temp directory if it doesn't exist
            if (!fs.existsSync(tempDir)) {
                this.logger.debug('Temp directory does not exist, creating it');
                fs.mkdirSync(tempDir, { recursive: true });
            }
            
            // Create a unique filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const tempFilePath = path.join(tempDir, `slidev-${timestamp}.md`);
            this.logger.debug('Generated temp file path:', tempFilePath);
            
            // Write the markdown content to the temp file
            fs.writeFileSync(tempFilePath, markdown);
            this.logger.info('Successfully wrote markdown to temp file');
            
            return tempFilePath;
        } catch (error) {
            this.logger.error('Failed to save markdown to temp file:', error);
            throw new Error(`Failed to save markdown to temp file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}