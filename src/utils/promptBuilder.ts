import * as vscode from 'vscode';
import { Logger } from './logger';
import { renderPrompt } from '@vscode/prompt-tsx';
import { SlidevPrompt } from '../prompt/SlidevPrompt';

/**
 * A builder class for creating structured prompts for Slidev generation
 */
export class PromptBuilder {
  private readonly logger = Logger.getInstance();

  /**
   * Builds a prompt for Slidev generation using @vscode/prompt-tsx components
   */
  async buildSlidevPrompt(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    model: vscode.LanguageModelChat
  ): Promise<vscode.LanguageModelChatMessage[]> {
    this.logger.debug('Building Slidev prompt using prompt-tsx components');
    
    try {
      // Use renderPrompt to convert our TSX component tree into chat messages
      const { messages } = await renderPrompt(
        SlidevPrompt, 
        {
          userRequest: request.prompt,
          history: context.history,
          references: request.references
        },
        {
          modelMaxPromptTokens: model.maxInputTokens,
        },
        model
      );
      
      this.logger.debug('Successfully rendered prompt-tsx component, messages:', messages.length);
      return messages;
    } catch (error) {
      this.logger.error('Error building prompt with prompt-tsx:', error);
      
      // Fallback to a simple prompt if building fails
      return [
        vscode.LanguageModelChatMessage.User(
          `Create a Slidev presentation about: ${request.prompt}\n\nInclude proper frontmatter, clear slide separators (---), and well-organized content. After the presentation, provide a brief summary of what you created.`
        )
      ];
    }
  }
}