import { BasePromptElementProps, PromptElement, UserMessage } from "@vscode/prompt-tsx";
import * as vscode from 'vscode';


/**
 * Component to display a reference
 */
export class ReferenceDisplay extends PromptElement<BasePromptElementProps & { reference: vscode.ChatPromptReference }> {
  async render(state: void) {
    const ref = this.props.reference;
    const refId = ref.id || 'unknown';

    try {
      if (ref.value instanceof vscode.Uri) {
        // File URI reference
        const uri = ref.value as vscode.Uri;
        try {
          const bytes = await vscode.workspace.fs.readFile(uri);
          const content = new TextDecoder().decode(bytes);
          return (
            <UserMessage priority={40}>
              {`## File: `} {uri.fsPath}

              {"\n\\`\\`\\`\n"}
              {content}
              {"\n\\`\\`\\`\n"}
            </UserMessage>
          );
        } catch (error) {
          return (
            <UserMessage priority={40}>
              {"## File: "} {uri.fsPath}
              {"\nCould not read file content.\n\n"}
            </UserMessage>
          );
        }
      } else if (ref.value instanceof vscode.Location) {
        // Location reference
        const location = ref.value as vscode.Location;
        try {
          const bytes = await vscode.workspace.fs.readFile(location.uri);
          const content = new TextDecoder().decode(bytes);
          const lines = content.split('\n');
          const startLine = location.range.start.line;
          const endLine = location.range.end.line;
          const extractedContent = lines.slice(startLine, endLine + 1).join('\n');

          return (
            <UserMessage priority={40}>
              {"## Location:"} {location.uri.fsPath} (Lines {startLine + 1}-{endLine + 1})

              {"\n\\`\\`\\`\n"}
              {extractedContent}
              {"\n\\`\\`\\`\n"}
            </UserMessage>
          );
        } catch (error) {
          return (
            <UserMessage priority={40}>
              {"## Location:"} {location.uri.fsPath}
              {"\nCould not read location content.\n\n"}
            </UserMessage>
          );
        }
      } else if (typeof ref.value === 'string') {
        // String reference
        return (
          <UserMessage priority={40}>
            {"## Reference:"} {ref.id || 'Text'}
            {"\n\\`\\`\\`\n"}
            {ref.value}
            {"\n\\`\\`\\`\n"}
          </UserMessage>
        );
      } else {
        // Unknown reference type
        if (ref.modelDescription) {
          return (
            <UserMessage priority={40}>
              {"## Reference:"} {ref.id || 'Unknown'}
              {ref.modelDescription}
            </UserMessage>
          );
        } else {
          return (
            <UserMessage priority={40}>
              {"## Reference:"} {ref.id || 'Unknown'}
              {"\nReference with unknown type received.\n\n"}
            </UserMessage>
          );
        }
      }
    } catch (error) {
      return (
        <UserMessage priority={40}>
          {"## Reference Error"}
          {"\nFailed to process reference.\n\n"}
        </UserMessage>
      );
    }
  }
}