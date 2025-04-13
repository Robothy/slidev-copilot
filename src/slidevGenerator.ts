import * as vscode from 'vscode';
import { Logger } from './utils/logger';
import { PromptBuilder } from './utils/promptBuilder';
import { ChatResponseParser } from './model/SlidevChatResponseParser';
import { SlidevChatResponse } from './model/SlidevChatResponse';

export class SlidevGenerator {
  private readonly logger: Logger;
  private readonly promptBuilder: PromptBuilder;
  private readonly responseParser: ChatResponseParser;

  constructor() {
    this.logger = Logger.getInstance();
    this.promptBuilder = new PromptBuilder();
    this.responseParser = new ChatResponseParser();
  }

  async generateSlidevMarkdown(
    userPrompt: string,
    context: vscode.ChatContext,
    model: vscode.LanguageModelChat,
    token: vscode.CancellationToken,
    request?: vscode.ChatRequest
  ): Promise<SlidevChatResponse> {
    try {
      this.logger.debug('Starting Slidev markdown generation');
      this.logger.debug('User prompt:', userPrompt);

      this.logger.info(`Using model: ${model.name} (Vendor: ${model.vendor}, Family: ${model.family})`);

      try {
        // Use the new PromptBuilder to create structured prompts
        let messages: vscode.LanguageModelChatMessage[];

        if (request) {
          // If request is provided, use it to build a structured prompt with references
          this.logger.debug('Building structured prompt with references');
          messages = await this.promptBuilder.buildSlidevPrompt(request, context, model);
        } else {
          // Fallback to using just the user prompt if request is not provided
          this.logger.debug('Building simple prompt without references');
          messages = [
            vscode.LanguageModelChatMessage.User(
              `Create a Slidev presentation about: ${userPrompt}\n\nInclude proper frontmatter, clear slide separators (---), and well-organized content. After the presentation, provide a brief summary of what you created.`
            )
          ];
        }

        // Send the request to the model
        this.logger.debug(`Sending request to the model with ${messages.length} messages`);

        let fullPrompt = '';
        for (const message of messages) {
          fullPrompt += message.content.map(c => {
            if (c instanceof vscode.LanguageModelTextPart) {
              return c.value;
            } else if (c instanceof vscode.LanguageModelToolCallPart) {
              return c.name;
            } else if (c instanceof vscode.LanguageModelToolResultPart) {
              return c.callId;
            }
          }).join('\n\n') + '\n\n';
        }
        this.logger.debug('Full prompt sent to the model:', fullPrompt);

        const response = await model.sendRequest(messages, {}, token);

        if (token.isCancellationRequested) {
          this.logger.info('Operation cancelled');
          throw new Error('Operation was cancelled');
        }

        this.logger.info('Successfully received response from the model');
        let markdownContent = '';

        // Extract the text from the response
        for await (const fragment of response.text) {
          markdownContent += fragment;
        }
        
        // Use the ChatResponseParser to parse and validate the response
        const chatResponse = this.responseParser.parse(markdownContent);
        this.logger.debug(`Response validation status: ${chatResponse.isValid ? 'valid' : 'invalid'} Slidev markdown`);
        
        return chatResponse;
      } catch (error) {
        this.logger.error('Error sending request to language model:', error);

        if (error instanceof vscode.LanguageModelError) {
          this.logger.error(`Language model error: ${error.message}, Code: ${error.code}`);

          if (error.code === 'no-permissions') {
            throw new Error('Permission to use the language model was denied. Please authorize access and try again.');
          } else if (error.code === 'blocked') {
            throw new Error('Request was blocked due to content filtering or quota limits.');
          }
        }
                
        // Forward the error instead of generating fallback content
        throw error;
      }
    } catch (error) {
      this.logger.error('Error in Slidev generation:', error);
      throw error;
    }
  }

  private async getContextText(context: vscode.ChatContext): Promise<string> {
    try {
      // Extract relevant information from the chat context
      let contextText = '';

      // Process history from context if available
      if (context.history && Array.isArray(context.history)) {
        this.logger.debug('Processing chat history, items:', context.history.length);

        for (const message of context.history) {
          if (typeof message === 'object') {
            // Pull content from various possible message formats
            let content = '';
            let participantId = '';

            if ('participant' in message) {
              participantId = String(message.participant);
              this.logger.trace('Message from participant:', participantId);
            }

            // Skip messages from our own participant
            if (participantId === 'slidev-copilot') {
              this.logger.trace('Skipping message from slidev-copilot');
              continue;
            }

            if ('prompt' in message && typeof message.prompt === 'string') {
              content = message.prompt;
            } else if ('response' in message && typeof message.response === 'string') {
              content = message.response;
            }

            if (content) {
              this.logger.trace('Adding content to context, length:', content.length);
              contextText += `${content}\n\n`;
            }
          }
        }
      } else {
        this.logger.debug('No chat history available or not an array');
      }

      this.logger.debug('Extracted context text, total length:', contextText.length);
      return contextText;
    } catch (error) {
      this.logger.error('Error extracting context text:', error);
      return '';
    }
  }
}