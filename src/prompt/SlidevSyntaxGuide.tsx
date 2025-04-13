import {
  BasePromptElementProps,
  PromptElement,
  UserMessage,
} from "@vscode/prompt-tsx";

/**
 * Slidev syntax guide component
 */
export class SlidevSyntaxGuide extends PromptElement<BasePromptElementProps> {
  render() {
    return <UserMessage>{SYNTAX_GUIDE}</UserMessage>;
  }
}

const SYNTAX_GUIDE = `
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

\`\`\`js
console.log('Hello, Slidev!')
\`\`\`

## Images
Add images:

\`\`\`md
![Description](https://example.com/image.png)
\`\`\`

## Styling
Add custom styles:

\`\`\`
<style>
  h1 {
    color: #42b983;
  }
</style>
\`\`\`
`;
