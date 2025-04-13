import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { SlidevGenerator } from './slidevGenerator';
import { Logger } from './utils/logger';
import { SlidevChatResponse } from './model/SlidevChatResponse';
import { SlidevChatRequest } from './model/SlidevChatRequest';
import { SlidevChatRequestParser } from './model/SlidevChatRequestParser';

/**
 * Controller responsible for processing chat requests and generating slidev presentations
 * Implements the ChatRequestHandler interface from VS Code API
 */
export class SlidevChatController {
  private readonly slidevGenerator: SlidevGenerator;
  private readonly logger: Logger;
  private readonly requestParser: SlidevChatRequestParser;

  constructor() {
    this.slidevGenerator = new SlidevGenerator();
    this.logger = Logger.getInstance();
    this.requestParser = new SlidevChatRequestParser();
    this.logger.debug('SlidevChatController initialized');
  }

  /**
   * Process a chat request and generate a slidev presentation
   * This implements the ChatRequestHandler signature from VS Code API
   */
  public async handleChatRequest(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<vscode.ChatResult | void> {
    try {
      this.logger.debug('Processing chat request:', request.prompt);
      this.logger.debug('Chat context history length:', context.history?.length || 0);
      
      // Parse the chat request into a structured SlidevChatRequest
      let slidevRequest: SlidevChatRequest;
      try {
        slidevRequest = this.requestParser.parse(request, context);
      } catch (error) {
        this.logger.error('Failed to parse chat request:', error);
        stream.markdown('❌ Error: Failed to process your request. Please try again.');
        return {
          errorDetails: {
            message: 'Failed to parse chat request'
          }
        };
      }
      
      // Report initial progress
      stream.progress('Generating your Slidev presentation...');
      this.logger.info('Started generating Slidev presentation');
      this.logger.info(`Using language model: ${slidevRequest.model.name} (${slidevRequest.model.vendor})`);
      
      // Generate Slidev markdown using the model from the request
      const slidevResult: SlidevChatResponse = await this.slidevGenerator.generateSlidevMarkdown(
        slidevRequest.prompt,
        context,
        slidevRequest.model,
        token,
        request // Pass the original request for backward compatibility
      );

      if (token.isCancellationRequested) {
        this.logger.info('Operation cancelled by user');
        stream.markdown('Operation cancelled.');
        return;
      }

      await this.handleSlidevResponse(slidevResult, slidevRequest, stream);
      
      this.logger.info('Successfully completed chat request');
      return {
        metadata: {
          isValid: slidevResult.isValid,
          sessionId: slidevRequest.sessionId
        }
      };
    } catch (error) {
      this.logger.error('Error handling chat request:', error);
      stream.markdown(`Error generating Slidev presentation: ${error instanceof Error ? error.message : String(error)}`);
      return {
        errorDetails: {
          message: `Error generating Slidev presentation: ${error instanceof Error ? error.message : String(error)}`
        }
      };
    }
  }

  /**
   * Handle the response from the slidev generator
   */
  private async handleSlidevResponse(
    slidevResult: SlidevChatResponse,
    slidevRequest: SlidevChatRequest,
    stream: vscode.ChatResponseStream
  ): Promise<void> {
    // Handle ChatResponse object returned by SlidevGenerator
    if (slidevResult.isValid) {
      // Save to temp file for valid content
      const tempFilePath = await this.saveTempMarkdown(slidevResult.content);
      this.logger.info('Saved temporary markdown file at:', tempFilePath);
                  
      // Update session with the presentation path and content
      this.requestParser.updatePresentationPath(slidevRequest.sessionId, tempFilePath);
      this.logger.debug(`Updated session ${slidevRequest.sessionId} with presentation path: ${tempFilePath}`);
                  
      // Generate the session ID marker (hidden in the response)
      const sessionIdMarker = this.requestParser.formatSessionIdMarker(slidevRequest.sessionId);
                  
      // Return response with complete markdown and summary
      this.logger.debug('Returning response with complete content');
      stream.markdown(`${slidevResult.summary}\n\n`);

      if (slidevRequest.isNewSession) {
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
      const sessionIdMarker = this.requestParser.formatSessionIdMarker(slidevRequest.sessionId);
                  
      stream.markdown(`❌ The language model didn't produce valid Slidev markdown content. Here's what was returned:\n\n\`\`\`\n${slidevResult.content}\n\`\`\`\n\nPlease try again with a more specific request or different wording.\n\n${sessionIdMarker}`);
    }
  }

  /**
   * Save markdown content to a temporary file
   */
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