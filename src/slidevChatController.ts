import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { SlidevGenerator } from './slidevGenerator';
import { Logger } from './utils/logger';
import { SlidevChatResponse } from './model/SlidevChatResponse';
import { SlidevChatRequest } from './model/SlidevChatRequest';
import { SlidevChatRequestParser } from './model/SlidevChatRequestParser';
import { SlidevCli } from './utils/slidevCli';

/**
 * Controller responsible for processing chat requests and generating slidev presentations
 * Implements the ChatRequestHandler interface from VS Code API
 */
export class SlidevChatController {
  private readonly slidevGenerator: SlidevGenerator;
  private readonly logger: Logger;
  private readonly requestParser: SlidevChatRequestParser;
  private readonly slidevCli: SlidevCli;

  constructor(context: vscode.ExtensionContext) {
    this.slidevGenerator = new SlidevGenerator();
    this.logger = Logger.getInstance();
    this.requestParser = new SlidevChatRequestParser();
    this.slidevCli = new SlidevCli(context);
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
      try {
        // Update the session project with the new content
        const projectPath = await this.slidevCli.getSessionProject(slidevRequest.sessionId, slidevResult.content);
        const slidesPath = path.join(projectPath, 'slides.md');
        
        this.logger.info('Saved slides in session project at:', slidesPath);
                  
        // Update session with the presentation path
        this.requestParser.updatePresentationPath(slidevRequest.sessionId, slidesPath);
        this.logger.debug(`Updated session ${slidevRequest.sessionId} with presentation path: ${slidesPath}`);
                  
        // Generate the session ID marker (hidden in the response)
        const sessionIdMarker = this.requestParser.formatSessionIdMarker(slidevRequest.sessionId);
                  
        // Return response with complete markdown and summary
        this.logger.debug('Returning response with complete content');
        stream.markdown(`${slidevResult.summary}\n\n`);

        if (slidevRequest.isNewSession) {
          // If this is a new session, include the session ID marker in the response
          stream.markdown(`${sessionIdMarker}\n\n\n`);
        }

        stream.anchor(vscode.Uri.file(slidesPath), 'Open in Editor');
                  
        // Add save button as a command
        this.logger.debug('Adding save button to response');
        stream.button({
          command: 'slidev-copilot.saveSlides',
          title: '💾 Save',
          arguments: [slidesPath]
        });
                  
        // Add button to preview in Slidev
        this.logger.debug('Adding button to preview in Slidev');
        stream.button({
          command: 'slidev-copilot.previewSlides',
          title: '▶️ Preview',
          arguments: [slidevRequest.sessionId, slidevResult.content]
        });
        
        // Add button to export to PDF
        this.logger.debug('Adding button to export to PDF');
        stream.button({
          command: 'slidev-copilot.exportSlides',
          title: '📄 Export PDF',
          arguments: [slidevRequest.sessionId, slidevResult.content]
        });
      } catch (error) {
        this.logger.error('Error handling valid Slidev response:', error);
        stream.markdown(`❌ Error preparing Slidev project: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      // Handle invalid content - don't render buttons
      this.logger.warn('Invalid Slidev markdown received from language model');
                  
      // Still include the session ID marker even for invalid responses
      const sessionIdMarker = this.requestParser.formatSessionIdMarker(slidevRequest.sessionId);
                  
      stream.markdown(`❌ The language model didn't produce valid Slidev markdown content. Here's what was returned:\n\n\`\`\`\n${slidevResult.content}\n\`\`\`\n\nPlease try again with a more specific request or different wording.\n\n${sessionIdMarker}`);
    }
  }
}