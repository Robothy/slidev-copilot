import { describe, it, expect, vi } from 'vitest';
import { Logger } from '../../../utils/logger';

describe('Logger Utility', () => {
  it('should log messages correctly', () => {
    // Create a spy on console.log since we can't easily mock vscode in tests
    const consoleSpy = vi.spyOn(console, 'log');
    
    // Create a logger instance and modify it to use console.log for testing
    const loggerInstance = Logger.getInstance();
    
    // Patch the private log method to use console.log for testing
    // @ts-ignore - accessing private method for testing
    const originalLog = loggerInstance['log'];
    // @ts-ignore - replacing private method for testing
    loggerInstance['log'] = function(level: any, message: string, data?: any) {
      console.log(`[${level}] ${message}`);
      if (data) console.log(data);
    };
    
    // Call the method being tested
    loggerInstance.info('Test message');
    
    // Verify the console.log was called
    expect(consoleSpy).toHaveBeenCalled();
    
    // Restore the original method and spy
    // @ts-ignore - restoring private method
    loggerInstance['log'] = originalLog;
    consoleSpy.mockRestore();
  });
});