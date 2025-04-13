import {
  BasePromptElementProps,
  PromptElement,
  UserMessage,
} from "@vscode/prompt-tsx";
import {
  ChatContext,
  ChatResponseTurn,
  ChatResponseMarkdownPart,
} from "vscode";
import { SessionManager } from "../utils/sessionManager";

/**
 * Props for RecentSlidevMarkdown component
 */
interface RecentSlidevMarkdownProps extends BasePromptElementProps {
  history?: ChatContext["history"];
}

/**
 * Component to display the most recent Slidev markdown content from the session manager
 */
export class RecentSlidevMarkdown extends PromptElement<RecentSlidevMarkdownProps> {
  render() {
    let slidevMarkdown = "No recent Slidev markdown content available.";
    
    try {
      const sessionManager = SessionManager.getInstance();
      
      // Extract the session ID from chat history
      const sessionId = sessionManager.extractSessionIdFromHistory(this.props.history);
      
      if (sessionId) {
        // Get the presentation content from the session manager
        const presentationContent = sessionManager.getLastPresentationContent(sessionId);
        
        // Escape code blocks in presentation content to prevent rendering issues
        if (presentationContent) {
          slidevMarkdown = presentationContent.replace(/```/g, '\\`\\`\\`');
        }
        if (presentationContent) {
          slidevMarkdown = presentationContent;
        }
      }
    } catch (error) {
      // If there's an error, we'll fall back to the default message
      console.error("Error retrieving presentation content:", error);
    }

    return (
      <UserMessage>
        {`\n\n# Most Recent Slidev Markdown\n\n`}
        {`\`\`\`markdown\n`}
        {slidevMarkdown}
        {`\n\`\`\`\n\n`}
      </UserMessage>
    );
  }
}