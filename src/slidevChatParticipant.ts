import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from './utils/logger';
import { SessionManager } from './utils/sessionManager';
import { SlidevChatRequestParser } from './model/SlidevChatRequestParser';
import { SlidevChatController } from './slidevChatController';

/**
 * Handles the registration and setup of the Slidev Chat participant
 * with VS Code's chat interface
 */
export class SlidevChatParticipant {
  private readonly logger: Logger;
  private readonly sessionManager: SessionManager;
  private readonly requestParser: SlidevChatRequestParser;
  private readonly chatController: SlidevChatController;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.logger = Logger.getInstance();
    this.sessionManager = SessionManager.getInstance();
    this.requestParser = new SlidevChatRequestParser();
    this.chatController = new SlidevChatController(context);
    this.context = context;
        
    this.logger.debug('Creating Slidev Copilot chat participant...');
  }

  /**
   * Initializes and registers the chat participant with VS Code
   */
  public initialize(): void {
    try {
      this.logger.debug('Initializing Slidev chat participant...');
      
      // Define the chat handler according to VS Code API
      const handler = async (
        request: vscode.ChatRequest, 
        context: vscode.ChatContext, 
        stream: vscode.ChatResponseStream, 
        token: vscode.CancellationToken
      ) => {
        // Delegate to the controller to handle the chat request
        await this.chatController.handleChatRequest(request, context, stream, token);
      };
            
      this.logger.debug('Registering chat participant with VS Code API');
            
      try {
        // Register the chat participant with the proper VS Code API
        const participant = vscode.chat.createChatParticipant('slidev-copilot', handler);
                
        // Set the icon path
        const iconPath = path.join(this.context.extensionPath, 'media', 'icon.svg');
        this.logger.debug('Setting icon path:', iconPath);
                
        if (fs.existsSync(iconPath)) {
          participant.iconPath = vscode.Uri.file(iconPath);
          this.logger.debug('Icon path set successfully');
        } else {
          this.logger.warn('Icon file not found at path:', iconPath);
        }
                
        // Add participant to subscriptions for proper disposal
        this.context.subscriptions.push(participant);
        this.logger.info('Chat participant registered successfully');
      } catch (error) {
        this.logger.error('Failed to register chat participant:', error);
        throw error;
      }
    } catch (error) {
      this.logger.error('Error in SlidevChatParticipant initialization:', error);
      throw error;
    }
  }
}