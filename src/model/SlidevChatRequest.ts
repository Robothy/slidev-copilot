import * as vscode from 'vscode';

/**
 * Represents a user's request to Slidev Copilot
 */
export interface SlidevChatRequest {
  /**
   * The session ID to associate with this request
   */
  sessionId: string;
  
  /**
   * Whether this is a new session
   */
  isNewSession: boolean;

  /**
   * The chat history from VS Code context
   */
  chatHistory?: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>;
  
  /**
   * Any references that were included in the original request
   */
  references?: readonly vscode.ChatPromptReference[];
  
  /**
   * The language model to use for generation
   */
  model: vscode.LanguageModelChat;
  
  /**
   * The user's prompt text
   */
  prompt: string;
}