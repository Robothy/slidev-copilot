// filepath: c:\Code\slidev-copilot\src\test\suite\SlidevChatRequestParser.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SlidevChatRequestParser } from '../../model/SlidevChatRequestParser';

// Mock session manager specifically for each test
const mockExtractSessionIdFromHistory = vi.fn();
const mockGetSessionById = vi.fn();
const mockCreateNewSession = vi.fn();
const mockGetLastPresentationPath = vi.fn();
const mockUpdatePresentationPath = vi.fn();
const mockFormatSessionIdMarker = vi.fn();

// Create mocks for dependencies
vi.mock('../../utils/sessionManager', () => {
  return {
    SessionManager: {
      getInstance: vi.fn(() => ({
        extractSessionIdFromHistory: mockExtractSessionIdFromHistory,
        getSessionById: mockGetSessionById,
        createNewSession: mockCreateNewSession,
        getLastPresentationPath: mockGetLastPresentationPath,
        updatePresentationPath: mockUpdatePresentationPath,
        formatSessionIdMarker: mockFormatSessionIdMarker
      }))
    }
  };
});

// Mock logger
const mockLoggerDebug = vi.fn();
const mockLoggerInfo = vi.fn();
const mockLoggerWarn = vi.fn();
const mockLoggerError = vi.fn();

vi.mock('../../utils/logger', () => {
  return {
    Logger: {
      getInstance: vi.fn(() => ({
        debug: mockLoggerDebug,
        info: mockLoggerInfo,
        warn: mockLoggerWarn,
        error: mockLoggerError
      }))
    }
  };
});

// Create mock VSCode types
const createMockChatRequest = (prompt = 'test prompt', model = { name: 'test-model', vendor: 'test-vendor' }) => {
  return {
    prompt,
    model,
    references: []
  };
};

const createMockChatContext = (history = []) => {
  return {
    history
  };
};

describe('SlidevChatRequestParser Tests', () => {
  let parser: SlidevChatRequestParser;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    
    // Reset mock implementations
    mockExtractSessionIdFromHistory.mockReset();
    mockGetSessionById.mockReset();
    mockCreateNewSession.mockReset();
    mockGetLastPresentationPath.mockReset();
    mockUpdatePresentationPath.mockReset();
    mockFormatSessionIdMarker.mockReset();
    
    mockLoggerDebug.mockReset();
    mockLoggerInfo.mockReset();
    mockLoggerWarn.mockReset();
    mockLoggerError.mockReset();
    
    // Create a new parser instance for each test
    parser = new SlidevChatRequestParser();
  });

  it('Should create a request with new session when no existing session ID is found', () => {
    // Arrange
    const mockRequest = createMockChatRequest();
    const mockContext = createMockChatContext();
    const newSessionId = 'new-session-123';
    
    // Set up mocks with proper return values
    mockExtractSessionIdFromHistory.mockReturnValue(null);
    mockCreateNewSession.mockReturnValue({ id: newSessionId });

    // Act
    const result = parser.parse(mockRequest as any, mockContext as any);

    // Assert
    expect(mockExtractSessionIdFromHistory).toHaveBeenCalledWith(mockContext.history);
    expect(mockCreateNewSession).toHaveBeenCalled();
    expect(result).toMatchObject({
      sessionId: newSessionId,
      isNewSession: true,
      prompt: mockRequest.prompt,
      model: mockRequest.model,
      references: mockRequest.references
    });
    
    // Verify logger was called
    expect(mockLoggerDebug).toHaveBeenCalledWith('Parsing chat request...');
    expect(mockLoggerDebug).toHaveBeenCalledWith('No session ID found in history, creating new session');
  });

  it('Should create a request with existing session when session ID is found and valid', () => {
    // Arrange
    const mockRequest = createMockChatRequest();
    const mockContext = createMockChatContext();
    const existingSessionId = 'existing-session-456';
    const existingSession = { 
      id: existingSessionId, 
      createdAt: new Date(), 
      lastActiveAt: new Date() 
    };
    
    // Set up mocks with proper return values
    mockExtractSessionIdFromHistory.mockReturnValue(existingSessionId);
    mockGetSessionById.mockReturnValue(existingSession);

    // Act
    const result = parser.parse(mockRequest as any, mockContext as any);

    // Assert
    expect(mockExtractSessionIdFromHistory).toHaveBeenCalledWith(mockContext.history);
    expect(mockGetSessionById).toHaveBeenCalledWith(existingSessionId);
    expect(mockCreateNewSession).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      sessionId: existingSessionId,
      isNewSession: false,
      prompt: mockRequest.prompt,
      model: mockRequest.model
    });
    
    // Verify logger was called
    expect(mockLoggerDebug).toHaveBeenCalledWith(`Found existing session ID in history: ${existingSessionId}`);
  });

  it('Should create a new session when an invalid session ID is found in history', () => {
    // Arrange
    const mockRequest = createMockChatRequest();
    const mockContext = createMockChatContext();
    const invalidSessionId = 'invalid-session-789';
    const newSessionId = 'new-session-999';
    
    // Set up mocks with proper return values
    mockExtractSessionIdFromHistory.mockReturnValue(invalidSessionId);
    mockGetSessionById.mockReturnValue(null); // Session not found in storage
    mockCreateNewSession.mockReturnValue({ id: newSessionId });

    // Act
    const result = parser.parse(mockRequest as any, mockContext as any);

    // Assert
    expect(mockExtractSessionIdFromHistory).toHaveBeenCalledWith(mockContext.history);
    expect(mockGetSessionById).toHaveBeenCalledWith(invalidSessionId);
    expect(mockCreateNewSession).toHaveBeenCalled();
    expect(result).toMatchObject({
      sessionId: newSessionId,
      isNewSession: true,
      prompt: mockRequest.prompt,
      model: mockRequest.model
    });
    
    // Verify logger was called
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      `Session ID ${invalidSessionId} found in history but not in storage, creating new session`
    );
  });

  it('Should include existing presentation path in logs if available', () => {
    // Arrange
    const mockRequest = createMockChatRequest();
    const mockContext = createMockChatContext();
    const existingSessionId = 'existing-session-456';
    const presentationPath = '/path/to/presentation.md';
    const existingSession = { 
      id: existingSessionId, 
      createdAt: new Date(), 
      lastActiveAt: new Date(),
      lastPresentationPath: presentationPath
    };
    
    // Set up mocks with proper return values
    mockExtractSessionIdFromHistory.mockReturnValue(existingSessionId);
    mockGetSessionById.mockReturnValue(existingSession);

    // Act
    parser.parse(mockRequest as any, mockContext as any);

    // Assert
    // Verify logger was called with presentation path
    expect(mockLoggerDebug).toHaveBeenCalledWith(
      `Session has previous presentation path: ${presentationPath}`
    );
  });

  it('Should log when references are included in the request', () => {
    // Arrange
    const references = [{ id: 'ref1', value: 'reference content' }];
    const mockRequest = {
      ...createMockChatRequest(),
      references
    };
    const mockContext = createMockChatContext();
    const newSessionId = 'new-session-123';
    
    // Set up mocks with proper return values
    mockExtractSessionIdFromHistory.mockReturnValue(null);
    mockCreateNewSession.mockReturnValue({ id: newSessionId });

    // Act
    const result = parser.parse(mockRequest as any, mockContext as any);

    // Assert
    expect(result.references).toBe(references);
    expect(mockLoggerDebug).toHaveBeenCalledWith('Request contains references:', references.length);
  });

  it('Should throw an error if no language model is available', () => {
    // Arrange
    const mockRequest = {
      prompt: 'test prompt',
      model: undefined,
      references: []
    };
    const mockContext = createMockChatContext();
    
    // Set up mocks with proper return values
    mockExtractSessionIdFromHistory.mockReturnValue('existing-id');
    mockGetSessionById.mockReturnValue({ id: 'existing-id' });

    // Act & Assert
    expect(() => parser.parse(mockRequest as any, mockContext as any))
      .toThrow('No language model available in the request');
    expect(mockLoggerError).toHaveBeenCalledWith('No language model available in the request');
  });

  it('Should correctly get and update presentation paths', () => {
    // Arrange
    const sessionId = 'test-session-123';
    const presentationPath = '/path/to/slides.md';
    
    mockGetLastPresentationPath.mockReturnValue(presentationPath);
    
    // Act - Call the methods directly
    parser.getPresentationPath(sessionId);
    parser.updatePresentationPath(sessionId, presentationPath);

    // Assert
    expect(mockGetLastPresentationPath).toHaveBeenCalledWith(sessionId);
    expect(mockUpdatePresentationPath).toHaveBeenCalledWith(sessionId, presentationPath);
  });

  it('Should correctly format session ID marker', () => {
    // Arrange
    const sessionId = 'test-session-123';
    const expectedMarker = `<!-- session-id:${sessionId} -->`;
    
    // Set up mock to return expected marker
    mockFormatSessionIdMarker.mockReturnValue(expectedMarker);
    
    // Act
    const result = parser.formatSessionIdMarker(sessionId);

    // Assert
    expect(mockFormatSessionIdMarker).toHaveBeenCalledWith(sessionId);
    expect(result).toBe(expectedMarker);
  });
});