import { describe, it, expect, beforeEach } from 'vitest';
import { ChatResponseParser } from '../../model/SlidevChatResponseParser';
import { SlidevChatResponse } from '../../model/SlidevChatResponse';

describe('ChatResponseParser Tests', () => {
  let parser: ChatResponseParser;

  beforeEach(() => {
    parser = new ChatResponseParser();
  });

  it('Should parse valid Slidev markdown', () => {
    const validMarkdown = `---
theme: default
highlight: github
---

# Slide 12

Content for slide 1

---

# Slide 2

Content for slide 2

--- Summary ---
This is a sample presentation with two slides
`;

    const result = parser.parse(validMarkdown);

    expect(result).toBeInstanceOf(SlidevChatResponse);
    expect(result.isValid).toBe(true);
    expect(result.summary).toBe('This is a sample presentation with two slides');
    expect(result.content.includes('# Slide 1')).toBe(true);
    expect(result.content.includes('# Slide 2')).toBe(true);
  });

  it('Should extract markdown from code blocks', () => {
    const markdownWithCodeBlocks = `\`\`\`markdown
---
theme: default
highlight: github
---

# Slide 1

Content for slide 1

---

# Slide 2

Content for slide 2
\`\`\`

--- Summary ---
This is a sample presentation with code blocks
`;

    const result = parser.parse(markdownWithCodeBlocks);

    expect(result.isValid).toBe(true);
    expect(result.summary).toBe('This is a sample presentation with code blocks');
    expect(result.content.includes('```markdown')).toBe(false);
    expect(result.content.includes('```')).toBe(false);
  });

  it('Should add frontmatter if missing', () => {
    const markdownWithoutFrontmatter = `# Slide 1

Content for slide 1

---

# Slide 2

Content for slide 2`;

    const result = parser.parse(markdownWithoutFrontmatter);

    // This should be invalid because our parser expects frontmatter
    expect(result.isValid).toBe(false);
    
    // But it still returns processed content
    expect(result.content).toBe(markdownWithoutFrontmatter);
  });

  it('Should handle empty or invalid input', () => {
    const emptyInput = '';
    const result = parser.parse(emptyInput);

    expect(result.isValid).toBe(false);
    expect(result.content).toBe(emptyInput);
  });

  it('Should extract summary section', () => {
    const markdownWithSummary = `---
theme: default
highlight: github
---

# Slide 1

Content for slide 1

---

# Slide 2

Content for slide 2

--- Summary ---
This is a detailed summary of the presentation content.
It covers multiple lines.
--- End`;

    const result = parser.parse(markdownWithSummary);

    expect(result.isValid).toBe(true);
    expect(result.summary).toBe('This is a detailed summary of the presentation content.\nIt covers multiple lines.');
    expect(result.content.includes('--- Summary ---')).toBe(false);
    expect(result.content.includes('--- End')).toBe(false);
  });

  it('Should extract content from special markers', () => {
    const markdownWithMarkers = `Here is some introduction text.

--- Slidev Markdown Content Below ---
---
theme: default
highlight: github
---

# Slide 1

Content for slide 1

---

# Slide 2

Content for slide 2
--- End of Slidev Markdown Content ---

Here is some conclusion text.`;

    const result = parser.parse(markdownWithMarkers);

    expect(result.isValid).toBe(true);
    expect(result.content.includes('Here is some introduction text')).toBe(false);
    expect(result.content.includes('Here is some conclusion text')).toBe(false);
    expect(result.content.includes('# Slide 1')).toBe(true);
    expect(result.content.includes('# Slide 2')).toBe(true);
  });

  it('Should handle error conditions gracefully', () => {
    // Create a malformed input that might cause parsing errors
    const malformedInput = `---
theme: default
highlight: github
---

# Slide with unclosed tag <div>

Content with problematic elements

---`;

    // Should not throw an exception
    const result = parser.parse(malformedInput);
    expect(result.isValid).toBe(true); // It's still valid Slidev markdown despite potential parsing issues
  });
});