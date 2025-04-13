/**
 * Represents a parsed response from the language model chat
 * Contains the processed markdown content, summary, and validation status
 */
export class ChatResponse {
  /**
   * The processed markdown content from the language model
   */
  public content: string;

  /**
   * A summary of the generated content
   */
  public summary: string;

  /**
   * Whether the markdown content is valid for Slidev
   */
  public isValid: boolean;

  constructor(content: string, summary: string, isValid: boolean) {
    this.content = content;
    this.summary = summary;
    this.isValid = isValid;
  }

  /**
   * Creates a ChatResponse instance from an object with matching properties
   */
  public static fromObject(obj: {
    content: string;
    summary: string;
    isValid: boolean;
  }): ChatResponse {
    return new ChatResponse(obj.content, obj.summary, obj.isValid);
  }

  /**
   * Creates an invalid ChatResponse with an error message
   */
  public static createInvalid(errorMessage: string): ChatResponse {
    return new ChatResponse(
      `Failed to generate valid Slidev markdown: ${errorMessage}`,
      "Generation failed",
      false
    );
  }
}
