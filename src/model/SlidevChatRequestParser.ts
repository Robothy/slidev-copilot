import * as vscode from 'vscode';
import { SlidevChatRequest } from './SlidevChatRequest';
import { SessionManager } from '../utils/sessionManager';
import { Logger } from '../utils/logger';

/**
 * Parser class for converting VS Code chat requests into structured SlidevChatRequest objects
 * This handles session detection, management and request normalization
 */
export class SlidevChatRequestParser {
  private readonly logger: Logger;
  private readonly sessionManager: SessionManager;

  constructor() {
    this.logger = Logger.getInstance();
    this.sessionManager = SessionManager.getInstance();
  }

  /**
   * Parse a VS Code chat request into a structured SlidevChatRequest
   * Handles session management and request normalization
   * 
   * @param request The original VS Code chat request
   * @param context The VS Code chat context
   * @returns A structured SlidevChatRequest object with appropriate session ID
   */
  public parse(request: vscode.ChatRequest, context: vscode.ChatContext): SlidevChatRequest {
    this.logger.debug('Parsing chat request...');
    
    // Determine if this is a new conversation or a continuation
    let sessionId: string;
    let isNewSession = false;
    
    // Look for an existing session ID in the history
    const existingSessionId = this.sessionManager.extractSessionIdFromHistory(context.history);
    
    if (existingSessionId) {
      // This is a continuation of an existing conversation
      this.logger.debug(`Found existing session ID in history: ${existingSessionId}`);
      const existingSession = this.sessionManager.getSessionById(existingSessionId);
      
      if (existingSession) {
        sessionId = existingSessionId;
        
        // Log if we have a presentation path for this session
        if (existingSession.lastPresentationPath) {
          this.logger.debug(`Session has previous presentation path: ${existingSession.lastPresentationPath}`);
        }
      } else {
        // Session ID found but not in our storage - create new session
        this.logger.warn(`Session ID ${existingSessionId} found in history but not in storage, creating new session`);
        const newSession = this.sessionManager.createNewSession();
        sessionId = newSession.id;
        isNewSession = true;
      }
    } else {
      // This is a new conversation
      this.logger.debug('No session ID found in history, creating new session');
      const newSession = this.sessionManager.createNewSession();
      sessionId = newSession.id;
      isNewSession = true;
    }
    
    // Log if references are included
    if (request.references && request.references.length > 0) {
      this.logger.debug('Request contains references:', request.references.length);
    }
    
    // Check if model is available
    if (!request.model) {
      this.logger.error('No language model available in the request');
      throw new Error('No language model available in the request');
    }
    
    // Create and return the structured SlidevChatRequest
    return {
      sessionId,
      isNewSession,
      chatHistory: context.history,
      references: request.references,
      model: request.model,
      prompt: request.prompt
    };
  }
  
  /**
   * Retrieves the presentation path for a session if available
   * 
   * @param sessionId The session ID to check
   * @returns The presentation path if available, undefined otherwise
   */
  public getPresentationPath(sessionId: string): string | undefined {
    return this.sessionManager.getLastPresentationPath(sessionId);
  }
  
  /**
   * Updates the presentation path for a session
   * 
   * @param sessionId The session ID to update
   * @param presentationPath The new presentation path
   */
  public updatePresentationPath(sessionId: string, presentationPath: string): void {
    this.sessionManager.updatePresentationPath(sessionId, presentationPath);
  }
  
  /**
   * Gets the session ID marker formatted for embedding in responses
   * 
   * @param sessionId The session ID to format
   * @returns A formatted session ID marker
   */
  public formatSessionIdMarker(sessionId: string): string {
    return this.sessionManager.formatSessionIdMarker(sessionId);
  }
}