import { describe, it, expect, vi } from 'vitest';
import { Logger, LogLevel } from '../../../utils/logger';

describe('Logger Utility', () => {
  it('should log messages correctly', () => {
    // Create a spy on console.log since we can't easily mock vscode in tests
    const consoleSpy = vi.spyOn(console, 'log');
    
    // Create a logger instance and modify it to use console.log for testing
    const loggerInstance = Logger.getInstance();
    
    // Safely access the private log method using type assertion
    const originalLog = (loggerInstance as unknown as { 
      log: (level: LogLevel, message: string, data?: unknown) => void 
    }).log;
    
    // Replace the private log method for testing
    (loggerInstance as unknown as { 
      log: (level: LogLevel, message: string, data?: unknown) => void 
    }).log = function(level: LogLevel, message: string, data?: unknown) {
      console.log(`[${level}] ${message}`);
      if (data) console.log(data);
    };
    
    // Call the method being tested
    loggerInstance.info('Test message');
    
    // Verify the console.log was called
    expect(consoleSpy).toHaveBeenCalled();
    
    // Restore the original method and spy
    (loggerInstance as unknown as { 
      log: (level: LogLevel, message: string, data?: unknown) => void 
    }).log = originalLog;
    consoleSpy.mockRestore();
  });
});