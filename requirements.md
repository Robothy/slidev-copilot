# VSCode Slidev Copilot Extension Development Prompt

I need you to implement a VSCode chat extension called "slidev-copilot" that generates Slidev markdown presentations based on user requests and chat context. Here are the detailed requirements:

## Core Functionality

1. Create a VSCode extension that adds a custom chat participant named `@slidev-copilot`.
2. When activated, the extension should:
   - Accept user requirements for slide content
   - Process the current VSCode chat context
   - Generate a properly formatted Slidev markdown presentation
   - Save it temporarily and offer a "Save" button for the user to save permanently

## Technical Specifications

### Extension Structure
- Use TypeScript for development
- Implement proper error handling throughout
- Follow VSCode extension best practices with a modular, maintainable design

### Chat Participant
- Register a chat participant with name "slidev-copilot" and ID "slidev-copilot"
- Create a suitable icon for the participant
- Handle chat requests through the VSCode Chat API

### Slidev Generation
- Craft specialized prompts that instruct the AI to generate valid Slidev syntax
- Include the Slidev syntax documentation in the prompt context
- Process the generated content to ensure it follows Slidev formatting

### File Handling
- Save generated presentations to a temporary location
- Provide a UI button to let users choose where to permanently save the file
- Handle file system operations securely

### User Experience
- Show appropriate progress indicators during generation
- Provide clear error messages if something goes wrong
- Add helpful instructions in the README

## Important References

- https://code.visualstudio.com/api/extension-guides/chat-tutorial
- https://code.visualstudio.com/api/extension-guides/language-model-tutorial
- https://code.visualstudio.com/api/extension-guides/tools
- Slidev Syntax: https://sli.dev/guide/syntax

Please implement this extension with well-organized code that's extensible and maintainable. Include appropriate documentation and tests where necessary.