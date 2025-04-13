import { Logger } from '../utils/logger';
import { SlidevChatResponse } from './SlidevChatResponse';

/**
 * Parser for AI-generated chat responses that extracts and validates Slidev markdown
 */
export class ChatResponseParser {
  private readonly logger: Logger;

  constructor() {
    this.logger = Logger.getInstance();
  }

  /**
   * Parse a raw response from the language model into a structured ChatResponse
   * @param markdownContent The raw markdown content from the language model
   * @returns A ChatResponse object with parsed content, summary, and validation status
   */
  public parse(markdownContent: string): SlidevChatResponse {
    try {
      this.logger.debug('Parsing AI response, length:', markdownContent.length);

      // Validate the response content
      const isValidMarkdown = this.isValidSlidevMarkdown(markdownContent);
      this.logger.debug(`Response validation status: ${isValidMarkdown ? 'valid' : 'invalid'} Slidev markdown`);

      // Check if the response contains a summary section
      const summaryMatch = markdownContent.match(/--- Summary ---\s+([\s\S]+?)(?:\s*$|--- End)/i);
      let summary = '';
      let processedMarkdown = markdownContent;
            
      if (summaryMatch) {
        summary = summaryMatch[1].trim().replace(/```(?:markdown|md)?$|```$/, '').trim();
        this.logger.debug('Extracted summary from response: ', summary);
                
        // Remove the summary section from the markdown
        processedMarkdown = markdownContent.replace(/--- Summary ---\s+([\s\S]+?)(?:\s*$|--- End)/i, '').trim();
      }

      // Process the markdown content if it's valid
      if (isValidMarkdown) {
        // Extract just the Slidev markdown content from the response if needed
        const markdownMatch = processedMarkdown.match(/--- Slidev Markdown Content Below ---\s+([\s\S]+?)--- End of Slidev Markdown Content ---/i);
        if (markdownMatch) {
          processedMarkdown = markdownMatch[1].trim();
          this.logger.debug('Extracted Slidev markdown content from response');
        }

        // Process the response to ensure it's valid Slidev markdown
        const finalContent = this.processMarkdownResponse(processedMarkdown);
        return new SlidevChatResponse(finalContent, summary, true);
      } else {
        this.logger.warn('Received invalid Slidev markdown from language model');
        return new SlidevChatResponse(markdownContent, summary, false);
      }
    } catch (error) {
      this.logger.error('Error parsing AI response:', error);
      return SlidevChatResponse.createInvalid(`Error parsing response: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validates if the content is valid Slidev markdown
   */
  private isValidSlidevMarkdown(content: string): boolean {
    // Check if content exists and is a string
    if (!content || typeof content !== 'string') {
      this.logger.warn('Content is empty or not a string');
      return false;
    }
        
    // Check for minimum required length
    if (content.length < 50) {
      this.logger.warn('Content is too short to be valid Slidev markdown');
      return false;
    }
        
    // Check for frontmatter (required for Slidev)
    const hasFrontmatter = /^---\s*\n(?:.*\n)+?---\s*\n/m.test(content);
    if (!hasFrontmatter) {
      this.logger.warn('Content lacks required Slidev frontmatter');
      return false;
    }
        
    // Check for slide delimiters
    const hasSlideDelimiters = /\n---\s*\n/.test(content);
    if (!hasSlideDelimiters) {
      this.logger.warn('Content lacks required slide delimiters');
      return false;
    }
        
    // Content passes basic validation checks
    return true;
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
      const result = [];
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