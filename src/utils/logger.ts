import * as vscode from 'vscode';

/**
 * Log levels
 */
export enum LogLevel {
    Debug = 0,
    Info = 1,
    Warning = 2,
    Error = 3,
    Trace = 4
}

/**
 * Logger utility class for Slidev Copilot extension
 */
export class Logger {
  private static outputChannel: vscode.OutputChannel;
  private static _instance: Logger;
  private static _enabled = true;
  private static _level: LogLevel = LogLevel.Info;

  private constructor() {
    Logger.outputChannel = vscode.window.createOutputChannel('Slidev Copilot');
  }

  /**
     * Get the singleton instance of the Logger
     */
  public static getInstance(): Logger {
    if (!Logger._instance) {
      Logger._instance = new Logger();
    }
    return Logger._instance;
  }

  /**
     * Set the logging level
     */
  public static setLevel(level: LogLevel): void {
    Logger._level = level;
  }

  /**
     * Enable or disable logging
     */
  public static setEnabled(enabled: boolean): void {
    Logger._enabled = enabled;
  }

  /**
     * Show the output channel
     */
  public show(): void {
    Logger.outputChannel.show();
  }

  /**
     * Log a trace message
     */
  public trace(message: string, data?: any): void {
    this.log(LogLevel.Trace, message, data);
  }

  /**
     * Log a debug message
     */
  public debug(message: string, data?: any): void {
    this.log(LogLevel.Debug, message, data);
  }

  /**
     * Log an info message
     */
  public info(message: string, data?: any): void {
    this.log(LogLevel.Info, message, data);
  }

  /**
     * Log a warning message
     */
  public warn(message: string, data?: any): void {
    this.log(LogLevel.Warning, message, data);
  }

  /**
     * Log an error message
     */
  public error(message: string, error?: any): void {
    this.log(LogLevel.Error, message, error);
        
    if (error && error instanceof Error) {
      this.log(LogLevel.Error, `Stack trace: ${error.stack || 'No stack trace available'}`);
    }
  }

  /**
     * Log a message with the specified level
     */
  private log(level: LogLevel, message: string, data?: any): void {
    if (!Logger._enabled || level < Logger._level) {
      return;
    }

    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] [${LogLevel[level]}] ${message}`;

    // If additional data is provided, add it to the log message
    if (data !== undefined) {
      if (typeof data === 'object') {
        try {
          const dataString = JSON.stringify(data, null, 2);
          logMessage += `\n${dataString}`;
        } catch (err) {
          logMessage += `\n[Circular or Non-Serializable Data]`;
        }
      } else {
        logMessage += `\n${data}`;
      }
    }

    Logger.outputChannel.appendLine(logMessage);
  }

  /**
     * Dispose of the output channel
     */
  public dispose(): void {
    Logger.outputChannel.dispose();
  }
}