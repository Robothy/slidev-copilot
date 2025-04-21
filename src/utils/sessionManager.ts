import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Logger } from './logger';

/**
 * Interface representing a chat session
 */
export interface ChatSession {
  id: string;
  createdAt: Date;
  lastActiveAt: Date;
  lastPresentationPath?: string;
  slidevProjectPath?: string; // Add project path to store where Slidev project is located
}

/**
 * Interface for the stored session data format
 */
interface StoredSessionData {
  createdAt: string;
  lastActiveAt: string;
  lastPresentationPath?: string;
  slidevProjectPath?: string; // Add project path for storage
}

/**
 * Manager for chat sessions that persists session data
 */
export class SessionManager {
  private static instance: SessionManager;
  private sessions: Map<string, ChatSession>;
  private context?: vscode.ExtensionContext;
  private logger: Logger;

  // Session TTL: 30 days in milliseconds
  private readonly SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

  // Storage key for persisting sessions
  private readonly STORAGE_KEY = 'slidev-copilot-sessions';

  // Marker for embedding session ID in responses
  public readonly SESSION_ID_MARKER = '<!-- session-id:';

  // Track the export paths for PDFs by session ID
  private exportPaths = new Map<string, string>();

  private constructor() {
    this.sessions = new Map<string, ChatSession>();
    this.logger = Logger.getInstance();
    this.logger.debug('SessionManager initialized');
  }

  /**
   * Gets the singleton instance of the SessionManager
   */
  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * Initializes the SessionManager with an extension context for persistence
   * Should be called during extension activation
   */
  public initialize(context: vscode.ExtensionContext): void {
    this.context = context;
    this.loadSessions();
    this.logger.debug('SessionManager initialized with context');

    // Set up a periodic cleanup task
    const cleanupInterval = setInterval(() => this.cleanupSessions(), 12 * 60 * 60 * 1000); // Run every 12 hours
    context.subscriptions.push({ dispose: () => clearInterval(cleanupInterval) });
  }

  /**
   * Creates a new session for a new conversation
   */
  public createNewSession(): ChatSession {
    const sessionId = this.generateUniqueSessionId();
    this.logger.debug(`Creating new session with ID: ${sessionId}`);

    const now = new Date();
    const newSession: ChatSession = {
      id: sessionId,
      createdAt: now,
      lastActiveAt: now
    };

    this.sessions.set(sessionId, newSession);
    this.persistSessions();

    return newSession;
  }

  /**
   * Generates a unique session ID
   */
  private generateUniqueSessionId(): string {
    // Generate a timestamp-based ID with random component to ensure uniqueness
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(8).toString('hex');
    const dataToHash = `session:${timestamp}:${randomBytes}`;

    return crypto.createHash('sha256').update(dataToHash).digest('hex').substring(0, 24);
  }

  /**
   * Format a hidden session ID marker for embedding in chat responses
   */
  public formatSessionIdMarker(sessionId: string): string {
    return `${this.SESSION_ID_MARKER}${sessionId} -->`;
  }

  /**
   * Extract a session ID from chat history
   */
  public extractSessionIdFromHistory(history?: vscode.ChatContext['history']): string | null {
    try {
      if (!history || history.length === 0) {
        return null;
      }

      // Look for session ID marker in any response from our provider
      for (const turn of history) {
        if (turn instanceof vscode.ChatResponseTurn && turn.participant === 'slidev-copilot') {
          // Get the full text of the response
          let responseText = '';
          for (const part of turn.response) {
            if (part instanceof vscode.ChatResponseMarkdownPart) {
              responseText += part.value.value;
            } else if (typeof part === 'string') {
              responseText += part;
            }
          }

          // Extract session ID from the marker
          const match = responseText.match(
            new RegExp(`${this.SESSION_ID_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([a-f0-9]+)\\s*-->`)
          );

          if (match && match[1]) {
            this.logger.debug(`Found session ID in history: ${match[1]}`);
            return match[1];
          }
        }
      }

      return null;
    } catch (error) {
      this.logger.error('Error extracting session ID from history:', error);
      return null;
    }
  }

  /**
   * Get a session by ID
   */
  public getSessionById(sessionId: string): ChatSession | null {
    if (this.sessions.has(sessionId)) {
      const session = this.sessions.get(sessionId);
      // Safety check to ensure session exists
      if (session) {
        // Update last active time
        session.lastActiveAt = new Date();
        return session;
      }
    }
    return null;
  }

  /**
   * Updates the presentation path for a session
   */
  public updatePresentationPath(sessionId: string, presentationPath: string): void {
    if (this.sessions.has(sessionId)) {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.lastPresentationPath = presentationPath;
        session.lastActiveAt = new Date();
        this.persistSessions();
        this.logger.debug(`Updated session ${sessionId} with presentation path: ${presentationPath}`);
      }
    } else {
      this.logger.warn(`Attempted to update non-existent session: ${sessionId}`);
    }
  }

  /**
   * Updates the Slidev project path for a session
   */
  public updateSlidevProjectPath(sessionId: string, projectPath: string): void {
    if (this.sessions.has(sessionId)) {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.slidevProjectPath = projectPath;
        session.lastActiveAt = new Date();
        this.persistSessions();
        this.logger.debug(`Updated session ${sessionId} with Slidev project path: ${projectPath}`);
      }
    } else {
      this.logger.warn(`Attempted to update non-existent session: ${sessionId}`);
    }
  }

  /**
   * Gets the Slidev project path for a session if available
   */
  public getSlidevProjectPath(sessionId: string): string | undefined {
    return this.sessions.get(sessionId)?.slidevProjectPath;
  }

  /**
   * Gets the last presentation content for a session by reading from file
   */
  public getLastPresentationContent(sessionId: string): string | null {
    const session = this.sessions.get(sessionId);

    if (!session || !session.lastPresentationPath) {
      return null;
    }

    // Read content directly from file
    try {
      if (fs.existsSync(session.lastPresentationPath)) {
        return fs.readFileSync(session.lastPresentationPath, 'utf8');
      }
    } catch (error) {
      this.logger.error(`Error reading presentation from ${session.lastPresentationPath}:`, error);
    }

    return null;
  }

  /**
   * Gets the last presentation path for a session if available
   */
  public getLastPresentationPath(sessionId: string): string | undefined {
    return this.sessions.get(sessionId)?.lastPresentationPath;
  }

  /**
   * Store the export path for a specific session
   * @param sessionId The session ID
   * @param path The export path
   */
  updateExportPath(sessionId: string, path: string): void {
    this.exportPaths.set(sessionId, path);
    this.logger.debug(`Updated export path for session ${sessionId}: ${path}`);
  }

  /**
   * Get the export path for a specific session
   * @param sessionId The session ID
   * @returns The export path or undefined if not set
   */
  getExportPath(sessionId: string): string | undefined {
    return this.exportPaths.get(sessionId);
  }

  /**
   * Loads sessions from extension storage
   */
  private loadSessions(): void {
    if (!this.context) {
      this.logger.warn('Cannot load sessions: Extension context not initialized');
      return;
    }

    try {
      const storedSessionsData = this.context.globalState.get<Record<string, StoredSessionData>>(this.STORAGE_KEY);

      if (storedSessionsData) {
        this.logger.debug('Loading sessions from storage');

        // Clear current sessions before loading
        this.sessions.clear();

        // Convert and load each session
        Object.entries(storedSessionsData).forEach(([id, data]) => {
          if (data) {
            // Reconstruct dates from ISO strings
            const session: ChatSession = {
              id: id,
              createdAt: new Date(data.createdAt),
              lastActiveAt: new Date(data.lastActiveAt),
              lastPresentationPath: data.lastPresentationPath,
              slidevProjectPath: data.slidevProjectPath
            };

            this.sessions.set(id, session);
          }
        });

        this.logger.debug(`Loaded ${this.sessions.size} sessions from storage`);
      } else {
        this.logger.debug('No saved sessions found in storage');
      }
    } catch (error) {
      this.logger.error('Error loading sessions from storage:', error);
    }
  }

  /**
   * Persists sessions to extension storage
   */
  private persistSessions(): void {
    if (!this.context) {
      this.logger.warn('Cannot persist sessions: Extension context not initialized');
      return;
    }

    try {
      const sessionsToStore: Record<string, StoredSessionData> = {};

      // Convert sessions to a plain object for storage
      this.sessions.forEach((session, id) => {
        sessionsToStore[id] = {
          createdAt: session.createdAt.toISOString(),
          lastActiveAt: session.lastActiveAt.toISOString(),
          lastPresentationPath: session.lastPresentationPath,
          slidevProjectPath: session.slidevProjectPath
        };
      });

      // Save to extension storage
      this.context.globalState.update(this.STORAGE_KEY, sessionsToStore);
      this.logger.debug(`Persisted ${this.sessions.size} sessions to storage`);
    } catch (error) {
      this.logger.error('Error persisting sessions to storage:', error);
    }
  }

  /**
   * Cleans up sessions older than the TTL (30 days)
   */
  public cleanupSessions(): void {
    const now = Date.now();
    let cleanedCount = 0;
    const deletedSessionIds: string[] = [];

    for (const [id, session] of this.sessions.entries()) {
      const sessionAge = now - session.lastActiveAt.getTime();

      if (sessionAge > this.SESSION_TTL_MS) {
        // Store the session ID and project path for cleanup
        if (session.slidevProjectPath && fs.existsSync(session.slidevProjectPath)) {
          deletedSessionIds.push(id);
        }
        
        this.sessions.delete(id);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.info(`Cleaned up ${cleanedCount} expired sessions`);
      this.persistSessions();
      
      // Delete session project directories
      this.deleteSessionProjects(deletedSessionIds);
    }
  }

  /**
   * Gets all active session IDs for cleanup purposes
   */
  public getActiveSessionIds(): string[] {
    // Return all session IDs that haven't expired yet
    const now = Date.now();
    const activeSessionIds: string[] = [];
    
    for (const [id, session] of this.sessions.entries()) {
      const sessionAge = now - session.lastActiveAt.getTime();
      
      // Consider sessions active if they're within the TTL
      if (sessionAge <= this.SESSION_TTL_MS) {
        activeSessionIds.push(id);
      }
    }
    
    this.logger.debug(`Found ${activeSessionIds.length} active sessions`);
    return activeSessionIds;
  }

  /**
   * Delete session project directories for the given session IDs
   */
  private deleteSessionProjects(sessionIds: string[]): void {
    if (sessionIds.length === 0) {
      return;
    }
    
    this.logger.info(`Deleting project directories for ${sessionIds.length} sessions`);
    
    try {
      // Get the .slidev directory path
      const tempDir = path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || path.join(os.tmpdir(), 'slidev-copilot'), '.slidev');
      if (!fs.existsSync(tempDir)) {
        return;
      }
      
      // Get all directories in the .slidev folder
      const entries = fs.readdirSync(tempDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Look for directories matching our sessions
          for (const sessionId of sessionIds) {
            // Check both old format (session-{id}) and new format (slidev-{timestamp}-{id})
            if (entry.name === `session-${sessionId}` || 
                (entry.name.startsWith('slidev-') && entry.name.endsWith(`-${sessionId.substring(0, 8)}`))) {
              const dirPath = path.join(tempDir, entry.name);
              try {
                this.deleteDirectory(dirPath);
                this.logger.info(`Deleted session project directory: ${dirPath}`);
              } catch (error) {
                this.logger.error(`Failed to delete session project directory: ${dirPath}`, error);
              }
            }
          }
        }
      }
    } catch (error) {
      this.logger.error('Error during project directory cleanup:', error);
    }
  }

  /**
   * Helper to delete a directory recursively
   */
  private deleteDirectory(directoryPath: string): void {
    if (fs.existsSync(directoryPath)) {
      const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(directoryPath, entry.name);
        
        if (entry.isDirectory()) {
          this.deleteDirectory(fullPath);
        } else {
          fs.unlinkSync(fullPath);
        }
      }
      
      fs.rmdirSync(directoryPath);
    }
  }
}