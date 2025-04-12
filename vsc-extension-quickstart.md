# Welcome to Slidev Copilot Extension Development

This guide will help you get started with developing and extending the Slidev Copilot extension.

## Project Structure

```
slidev-copilot/
├── .vscode/                  // VS Code configuration files
├── media/                    // Icons and images
├── src/                      // Source code
│   ├── extension.ts          // Extension entry point
│   ├── chatProvider.ts       // Chat participant implementation
│   ├── slidevGenerator.ts    // Core Slidev generation logic
│   ├── types/                // TypeScript type definitions
│   └── utils/                // Utility functions
└── package.json              // Extension manifest
```

## Development Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Build the Extension**
   ```bash
   npm run compile
   ```
   
   Or watch for changes:
   ```bash
   npm run watch
   ```

3. **Run the Extension**
   - Press F5 to open a new window with your extension loaded
   - Open VS Code Chat and type `@slidev-copilot` followed by your prompt

## Implementation Details

### Chat Participant

The `SlidevChatParticipant` class in `chatProvider.ts` implements the VS Code chat participant interface, handling user requests and providing responses.

### Slidev Generator

The `SlidevGenerator` class in `slidevGenerator.ts` contains the core logic for generating Slidev markdown presentations:

- Processing user prompts
- Constructing AI requests
- Post-processing AI responses
- Ensuring valid Slidev syntax

### Utility Functions

- `promptUtils.ts`: Enhances prompts with Slidev syntax guidance
- `markdownUtils.ts`: Validates and processes markdown content

## Extension Points

Want to extend the functionality? Here are some good places to start:

1. **Add New Layouts**: Extend the prompt utilities to support more Slidev layouts
2. **Themes Support**: Add integration with Slidev themes
3. **Custom Commands**: Implement additional VS Code commands

## Testing

Run the extension tests:
```bash
npm test
```

## Packaging

Create a VSIX package for distribution:
```bash
npm install -g vsce
vsce package
```

## Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [VS Code Chat API](https://code.visualstudio.com/api/extension-guides/chat)
- [Slidev Documentation](https://sli.dev)

Happy coding!