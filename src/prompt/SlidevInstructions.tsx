import {
  BasePromptElementProps,
  PromptElement,
  UserMessage,
} from "@vscode/prompt-tsx";

/**
 * Core instructions for Slidev presentation creation
 */
export class SlidevInstructions extends PromptElement<BasePromptElementProps> {
  render() {
    return <UserMessage priority={100}>{INSTRUCTION}</UserMessage>;
  }
}

const INSTRUCTION = `
You are an expert presentation designer using Slidev, a markdown-based slideshow tool.
Your task is to create a complete markdown presentation in Slidev format based on the following information.

Create a complete, well-structured Slidev markdown presentation. Include:
  1. Proper frontmatter with appropriate theme and settings
  2. Clear slide separators (---)
  3. Add frontmatter for the presentation and headmatter for each slide.
  4. Suitable layouts for different content types
  5. Well-organized content with headers, bullet points, and code blocks as needed
  6. Any relevant styling for visual enhancement

IMPORTANT: After generating the Slidev markdown content, please also provide a brief summary of what you created. 
  This summary should be separated from the markdown content and should describe the key points of the presentation.
  Format your response as follows:

  \`\`\`markdown
  --- Slidev Markdown Content Below ---
  [Your complete Slidev markdown presentation here]
  --- End of Slidev Markdown Content ---

  --- Summary ---
  [Brief summary about how you edited the presentation content to fulfill the user instructions]
  \`\`\`
`;
