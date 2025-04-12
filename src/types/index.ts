import * as vscode from 'vscode';

/**
 * Options for generating Slidev markdown
 */
export interface SlidevGenerationOptions {
    /**
     * The model to use for generation
     */
    model?: string;
    
    /**
     * The temperature to use for generation (0.0 - 1.0)
     */
    temperature?: number;
}

/**
 * Metadata for Slidev presentations
 */
export interface SlidevPresentationMetadata {
    title: string;
    theme: string;
    tempFilePath: string;
}