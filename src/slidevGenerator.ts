import * as vscode from 'vscode';
import { Logger } from './utils/logger';
import { PromptBuilder } from './utils/promptBuilder';
import { ChatResponseParser } from './model/SlidevChatResponseParser';
import { SlidevChatResponse } from './model/SlidevChatResponse';
import { send } from 'process';

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

        let markdownContent = await this.sendModelRequest(model, messages, token);

        if (token.isCancellationRequested) {
          this.logger.info('Operation cancelled');
          throw new Error('Operation was cancelled');
        }

        this.logger.info('Successfully received response from the model');




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

  /**
   * Sends a request to the language model, with fallback to gpt4o if the original model isn't supported
   */
  private async sendModelRequest(
    model: vscode.LanguageModelChat,
    messages: vscode.LanguageModelChatMessage[],
    token: vscode.CancellationToken
  ): Promise<string> {
    try {
      const response = await model.sendRequest(messages, {}, token);
      let markdownContent = '';
      for await (const fragment of response.text) {
        markdownContent += fragment;
      }
      return markdownContent;
    } catch (error) {
      if (String(error).includes('model_not_supported') && model.name !== "gpt-4o") {
        this.logger.warn(`Model ${model.name} not supported, falling back to gpt-4o`);
        const gpt4o  = await vscode.lm.selectChatModels({vendor: 'copilot', family: 'gpt-4o'}).then(models => models[0]);
        return this.sendModelRequest(gpt4o, messages, token);
      }
      this.logger.error('Error sending request to language model:', error);
      throw error;
    }
  }
}