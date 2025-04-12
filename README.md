# Slidev Copilot for VS Code

![Slidev Copilot Logo](media/slidev-icon.svg)

A Visual Studio Code extension that uses AI to generate [Slidev](https://sli.dev/) presentations directly from your chat context.

## Features

- 🎭 **Chat Integration**: Interact with Slidev Copilot directly in VS Code's chat interface
- 🚀 **Context-Aware**: Generates presentations based on chat context and requirements
- 📝 **Slidev Syntax**: Creates properly formatted Slidev markdown presentations
- 💾 **Easy Saving**: Save generated presentations with a single click
- 🖼️ **Preview Support**: Get a markdown preview before saving

## Requirements

- Visual Studio Code 1.80.0 or higher
- An active internet connection for AI service connectivity

## Installation

1. Launch VS Code
2. Go to Extensions view (Ctrl+Shift+X)
3. Search for "Slidev Copilot"
4. Click Install

## Usage

1. Open VS Code Chat (Ctrl+Shift+P > "Open Chat View")
2. Type `@slidev-copilot` followed by your presentation requirements
3. Wait for the AI to generate your Slidev presentation
4. Click the "Save Presentation" button to save the markdown file
5. Use [Slidev](https://sli.dev/) to present your slides

### Example

```
@slidev-copilot Create a presentation about Web Performance Optimization techniques with code examples
```

## Slidev Syntax Supported

This extension supports all standard Slidev markdown features:

- Frontmatter configuration
- Slide separators
- Multiple layouts
- Code blocks with syntax highlighting
- Images
- Custom styling
- And more!

Learn more about Slidev syntax at the [official documentation](https://sli.dev/guide/syntax.html).

## Extension Settings

This extension contributes the following settings:

* `slidev-copilot.defaultModel`: AI model to use for generation (default: "gpt-4")
* `slidev-copilot.temperature`: Creativity level for generation (0.0-1.0, default: 0.5)

## Known Issues

- First-time generation might take longer due to AI model initialization
- Some complex Slidev layouts might need manual adjustment

## Release Notes

### 0.1.0

- Initial release of Slidev Copilot
- Basic presentation generation from chat context
- Save functionality for generated presentations

## Contributing

Contributions are welcome! Please see our [contribution guidelines](CONTRIBUTING.md) for details.

## License

This extension is licensed under the [MIT License](LICENSE).

---

**Enjoy creating beautiful Slidev presentations with AI assistance!**