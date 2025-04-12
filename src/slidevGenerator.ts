import * as vscode from 'vscode';
import { Logger } from './utils/logger';
import { getEnhancedPrompt } from './utils/promptUtils';

export class SlidevGenerator {
    private readonly logger: Logger;

    constructor() {
        this.logger = Logger.getInstance();
    }
    
    async generateSlidevMarkdown(
        userPrompt: string,
        context: vscode.ChatContext,
        model: vscode.LanguageModelChat,
        token: vscode.CancellationToken
    ): Promise<string> {
        try {
            this.logger.debug('Starting Slidev markdown generation');
            this.logger.debug('User prompt:', userPrompt);
            
            this.logger.info(`Using model: ${model.name} (Vendor: ${model.vendor}, Family: ${model.family})`);

            // Get the chat context and augment the prompt with Slidev syntax information
            this.logger.debug('Extracting context from chat history');
            const contextText = await this.getContextText(context);
            this.logger.debug('Context text length:', contextText.length);
            
            // Use the simpler approach with promptUtils instead of Prompt TSX
            this.logger.debug('Creating enhanced prompt with Slidev syntax information');
            const enhancedPrompt = getEnhancedPrompt(userPrompt, contextText);
            this.logger.debug('Enhanced prompt created');

            // Create messages for the language model
            const messages = [
                vscode.LanguageModelChatMessage.User(enhancedPrompt)
            ];

            try {
                // Send the request to the model
                this.logger.debug('Sending request to the model');
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
                
                // Process the response to ensure it's valid Slidev markdown
                return this.processMarkdownResponse(markdownContent);
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
                
                // If we get here, return a fallback template
                return this.generateFallbackTemplate(userPrompt);
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
                            // @ts-ignore - The structure might vary
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

    private generateFallbackTemplate(userPrompt: string): string {
        this.logger.info('Generating fallback template');
        
        // Extract potential title from the user prompt
        let title = 'Generated Slidev Presentation';
        const titleMatch = userPrompt.match(/(?:presentation|slides?|talk)\s+(?:about|on|for)\s+(['"]?)([^'"]+)\1/i);
        if (titleMatch) {
            title = titleMatch[2];
            this.logger.debug('Extracted title from prompt:', title);
        }
        
        // Create a simple template based on the user prompt
        const template = `---
theme: default
highlight: github
lineNumbers: false
drawings:
  persist: false
transition: slide-left
title: ${title}
---

# ${title}

Generated with Slidev Copilot

---
layout: image-right
image: https://source.unsplash.com/collection/94734566/1920x1080
---

# Key Points

- This is a fallback template because no language model was available
- Your prompt: "${userPrompt}"
- Slidev is a slides maker and presenter designed for developers
- You can edit this markdown to create your presentation

---
layout: two-cols
---

# Slidev Features

- 📝 **Text-based** - Focus on the content with Markdown
- 🎨 **Themable** - Theme can be shared and used with npm packages
- 🧑‍💻 **Developer Friendly** - Code highlighting, live coding with autocompletion

::right::

# More Features

- 🤹 **Interactive** - Embedding Vue components to enhance your expressions
- 🎥 **Recording** - Built-in recording and camera view
- 📤 **Portable** - Export into PDF, PNGs, or even a hostable SPA

---
layout: center
class: "text-center"
---

# Learn More

[Documentation](https://sli.dev) · [GitHub](https://github.com/slidevjs/slidev)`;

        this.logger.debug('Generated fallback template, length:', template.length);
        return template;
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
            let result = [];
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