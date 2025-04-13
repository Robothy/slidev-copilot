import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { SlidevGenerator } from './slidevGenerator';
import { Logger } from './utils/logger';
import { SessionManager } from './utils/sessionManager';
import { SlidevChatResponse } from './model/SlidevChatResponse';

export class SlidevChatParticipant {
  private readonly slidevGenerator: SlidevGenerator;
  private readonly logger: Logger;
  private readonly sessionManager: SessionManager;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.slidevGenerator = new SlidevGenerator();
    this.logger = Logger.getInstance();
    this.sessionManager = SessionManager.getInstance();
        
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
                    
          // Determine if this is a new conversation or a continuation
          let session: { id: string, isNew?: boolean };
                    
          // Look for an existing session ID in the history
          const existingSessionId = this.sessionManager.extractSessionIdFromHistory(context.history);
                    
          if (existingSessionId) {
            // This is a continuation of an existing conversation
            this.logger.debug(`Found existing session ID in history: ${existingSessionId}`);
            const existingSession = this.sessionManager.getSessionById(existingSessionId);
                        
            if (existingSession) {
              session = { id: existingSessionId };
              // Log if we have a presentation path for this session
              if (existingSession.lastPresentationPath) {
                this.logger.debug(`Session has previous presentation path: ${existingSession.lastPresentationPath}`);
              }
            } else {
              // Session ID found but not in our storage - create new session
              this.logger.warn(`Session ID ${existingSessionId} found in history but not in storage, creating new session`);
              const newSession = this.sessionManager.createNewSession();
              session = { id: newSession.id, isNew: true };
            }
          } else {
            // This is a new conversation
            this.logger.debug('No session ID found in history, creating new session');
            const newSession = this.sessionManager.createNewSession();
            session = { id: newSession.id, isNew: true };
          }
                    
          if (request.references && request.references.length > 0) {
            this.logger.debug('Request contains references:', request.references.length);
          }
                    
          // Report initial progress
          this.logger.info('Started generating Slidev presentation');
                    
          if (!request.model) {
            this.logger.error('No language model available in the request');
            stream.markdown('❌ Error: No language model available. Please choose another model and try again.');
            return;
          }
                    
          this.logger.info(`Using language model: ${request.model.name} (${request.model.vendor})`);

          // Generate Slidev markdown using the model from the request
          // Pass the entire request object to use references in prompt generation
          const slidevResult: SlidevChatResponse = await this.slidevGenerator.generateSlidevMarkdown(
            request.prompt,
            context,
            request.model,
            token,
            request // Pass the entire request object
          );


          if (token.isCancellationRequested) {
            this.logger.info('Operation cancelled by user');
            stream.markdown('Operation cancelled.');
            return;
          }

          // Handle ChatResponse object returned by SlidevGenerator
          if (slidevResult.isValid) {
            // Save to temp file for valid content
            const tempFilePath = await this.saveTempMarkdown(slidevResult.content);
            this.logger.info('Saved temporary markdown file at:', tempFilePath);
                        
            // Update session with the presentation path and content
            this.sessionManager.updatePresentationPath(session.id, tempFilePath);
            this.logger.debug(`Updated session ${session.id} with presentation path: ${tempFilePath}`);
                        
            // Generate the session ID marker (hidden in the response)
            const sessionIdMarker = this.sessionManager.formatSessionIdMarker(session.id);
                        
            // Return response with complete markdown and summary
            this.logger.debug('Returning response with complete content');
            stream.markdown(`${slidevResult.summary}\n\n`);

            if (!existingSessionId) {
              // If this is a new session, include the session ID marker in the response
              stream.markdown(`${sessionIdMarker}\n\n\n`);
            }

            stream.anchor(vscode.Uri.file(tempFilePath), 'Open in Editor');
                        
            // Add save button as a command
            this.logger.debug('Adding save button to response');
            stream.button({
              command: 'slidev-copilot.saveSlides',
              title: '💾 Save',
              arguments: [tempFilePath]
            });
                        
            // Add button to preview in Slidev
            this.logger.debug('Adding button to preview in Slidev');
            stream.button({
              command: 'slidev-copilot.previewSlides',
              title: '▶️ Preview',
              arguments: [tempFilePath]
            });
          } else {
            // Handle invalid content - don't render buttons
            this.logger.warn('Invalid Slidev markdown received from language model');
                        
            // Still include the session ID marker even for invalid responses
            const sessionIdMarker = this.sessionManager.formatSessionIdMarker(session.id);
                        
            stream.markdown(`❌ The language model didn't produce valid Slidev markdown content. Here's what was returned:\n\n\`\`\`\n${slidevResult.content}\n\`\`\`\n\nPlease try again with a more specific request or different wording.\n\n${sessionIdMarker}`);
          }
                    
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
        const iconPath = path.join(context.extensionPath, 'media', 'icon.svg');
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