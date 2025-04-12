/**
 * Utility functions for constructing prompts for the AI model
 */

/**
 * Enhances the user prompt with Slidev syntax information
 * @param userPrompt The original prompt from the user
 * @param contextText Additional context from the chat 
 * @returns Enhanced prompt with Slidev guidance
 */
export function getEnhancedPrompt(userPrompt: string, contextText: string): string {
    // Slidev syntax documentation to include in the prompt
    const slidevSyntaxGuide = `
# Slidev Syntax Guide

Here's a guide on how to format a Slidev markdown presentation:

## Basic Structure
A Slidev presentation starts with frontmatter and is separated by slide delimiters:

\`\`\`md
---
theme: default
highlight: github
lineNumbers: true
drawings:
  persist: false
transition: slide-left
title: Example Presentation
---

# Slide 1

Content for slide 1

---

# Slide 2

Content for slide 2

<!-- Use comments for presenter notes -->

---

## Slide with bullet points

- Point 1
- Point 2
- Point 3
\`\`\`

## Layout System
Use layouts by adding layout specification:

\`\`\`md
---
layout: cover
---

# Cover Slide

---
layout: two-cols
---

# Left

This shows on the left

::right::

# Right

This shows on the right
\`\`\`

## Code Blocks
Code with syntax highlighting:

\`\`\`md
\`\`\`js
console.log('Hello, Slidev!')
\`\`\`
\`\`\`

## Images
Add images:

\`\`\`md
![Description](https://example.com/image.png)
\`\`\`

## Styling
Add custom styles:

\`\`\`md
<style>
h1 {
  color: #42b983;
}
</style>
\`\`\`
`;

    // Construct the enhanced prompt with instructions for the AI
    return `
You are an expert presentation designer using Slidev, a markdown-based slideshow tool. 
Your task is to create a complete markdown presentation in Slidev format based on the following information.

### CONTEXT FROM CHAT:
${contextText}

### USER REQUEST:
${userPrompt}

### SLIDEV SYNTAX REFERENCE:
${slidevSyntaxGuide}

Create a complete, well-structured Slidev markdown presentation. Include:
1. Proper frontmatter with appropriate theme and settings
2. Clear slide separators (---)
3. Suitable layouts for different content types
4. Well-organized content with headers, bullet points, and code blocks as needed
5. Any relevant styling for visual enhancement

FORMAT YOUR RESPONSE AS A COMPLETE, VALID SLIDEV MARKDOWN DOCUMENT THAT CAN BE USED DIRECTLY.
`;
}