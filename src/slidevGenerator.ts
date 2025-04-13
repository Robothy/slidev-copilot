import * as vscode from 'vscode';
import { Logger } from './utils/logger';
import { PromptBuilder } from './utils/promptBuilder';

export class SlidevGenerator {
  private readonly logger: Logger;
  private readonly promptBuilder: PromptBuilder;

  constructor() {
    this.logger = Logger.getInstance();
    this.promptBuilder = new PromptBuilder();
  }

  async generateSlidevMarkdown(
    userPrompt: string,
    context: vscode.ChatContext,
    model: vscode.LanguageModelChat,
    token: vscode.CancellationToken,
    request?: vscode.ChatRequest
  ): Promise<{ content: string; summary: string; isValid: boolean }> {
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
                
        // Validate the response content
        const isValidMarkdown = this.isValidSlidevMarkdown(markdownContent);
        this.logger.debug(`Response validation status: ${isValidMarkdown ? 'valid' : 'invalid'} Slidev markdown`);

        // Check if the response contains a summary section
        const summaryMatch = markdownContent.match(/--- Summary ---\s+([\s\S]+?)(?:\s*$|--- End)/i);
        let summary = '';
        let processedMarkdown = markdownContent;
                
        if (summaryMatch) {
          summary = summaryMatch[1].trim().replace(/```(?:markdown|md)?$|```$/, '').trim();
          this.logger.debug('Extracted summary from response: ', summary);
                    
          // Remove the summary section from the markdown if needed
          // This is optional - you might want to keep it depending on your requirements
          processedMarkdown = markdownContent.replace(/--- Summary ---\s+([\s\S]+?)(?:\s*$|--- End)/i, '').trim();
        }

        // Process the markdown content if it's valid
        if (isValidMarkdown) {
          // Extract just the Slidev markdown content from the response if needed
          const markdownMatch = processedMarkdown.match(/--- Slidev Markdown Content Below ---\s+([\s\S]+?)--- End of Slidev Markdown Content ---/i);
          if (markdownMatch) {
            processedMarkdown = markdownMatch[1].trim();
            this.logger.debug('Extracted Slidev markdown content from response');
          }

          // Process the response to ensure it's valid Slidev markdown
          const finalContent = this.processMarkdownResponse(processedMarkdown);
          return { 
            content: finalContent, 
            summary: summary, 
            isValid: true 
          };
        } else {
          this.logger.warn('Received invalid Slidev markdown from language model');
          return { 
            content: markdownContent,
            summary: summary,
            isValid: false 
          };
        }

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

  /**
     * Validates if the content is valid Slidev markdown
     */
  private isValidSlidevMarkdown(content: string): boolean {
    // Check if content exists and is a string
    if (!content || typeof content !== 'string') {
      this.logger.warn('Content is empty or not a string');
      return false;
    }
        
    // Check for minimum required length
    if (content.length < 50) {
      this.logger.warn('Content is too short to be valid Slidev markdown');
      return false;
    }
        
    // Check for frontmatter (required for Slidev)
    const hasFrontmatter = /^---\s*\n(?:.*\n)+?---\s*\n/m.test(content);
    if (!hasFrontmatter) {
      this.logger.warn('Content lacks required Slidev frontmatter');
      return false;
    }
        
    // Check for slide delimiters
    const hasSlideDelimiters = /\n---\s*\n/.test(content);
    if (!hasSlideDelimiters) {
      this.logger.warn('Content lacks required slide delimiters');
      return false;
    }
        
    // Content passes basic validation checks
    return true;
  }

  private processMarkdownResponse(response: string): string {
    this.logger.debug('Processing markdown response, length:', response.length);

    // Process the markdown response to ensure it's valid Slidev markdown
    let markdown = response;

    // Clean up the response to remove any code block markers if the AI returned them
    if (markdown.startsWith('```markdown') || markdown.startsWith('```md')) {
      this.logger.debug('Removing markdown code block markers');
      markdown = markdown.replace(/^```(?:markdown|md)?\s*\n/, '').replace(/\n```\s*$/, '');
    }

    // Ensure it starts with a valid Slidev frontmatter if not already present
    if (!markdown.startsWith('---')) {
      this.logger.debug('Adding frontmatter to markdown');
      markdown = `---\ntheme: default\nhighlight: github\n---\n\n${markdown}`;
    }

    // Ensure proper slide separators are present
    this.logger.debug('Checking and fixing slide delimiters');
    markdown = this.ensureSlideDelimiters(markdown);

    this.logger.debug('Markdown processing complete, final length:', markdown.length);
    return markdown;
  }

  private ensureSlideDelimiters(markdown: string): string {
    // Split the content into slides using the common slide separator patterns
    const slideDelimiters = [
      /^---$/m,           // Standard Slidev separator
      /^<!--\s*slide\s*-->$/im, // HTML comment slide separator
      /^# /m              // Header-based separator (common in Markdown presentations)
    ];

    // Check if any delimiter is found
    const hasDelimiters = slideDelimiters.some(delimiter => delimiter.test(markdown));
    this.logger.debug('Slide delimiters found in markdown:', hasDelimiters);

    if (!hasDelimiters) {
      this.logger.debug('No slide delimiters found, adding them based on headers');
      // If no delimiters found, add them based on headers
      const lines = markdown.split('\n');
      const result = [];
      let inSlide = false;

      for (const line of lines) {
        // If we find a header, add a separator before it
        if (/^#\s+.+$/.test(line) && inSlide) {
          this.logger.trace('Adding slide delimiter before header:', line);
          result.push('---');
          result.push(line);
          inSlide = true;
        } else {
          result.push(line);
          inSlide = true;
        }
      }

      markdown = result.join('\n');
      this.logger.debug('Added slide delimiters, new length:', markdown.length);
    }

    return markdown;
  }
}