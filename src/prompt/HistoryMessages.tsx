import {
  UserMessage,
  AssistantMessage,
  PromptElement,
  BasePromptElementProps,
  PrioritizedList,
  PromptPiece,
} from "@vscode/prompt-tsx";
import {
  ChatContext,
  ChatRequestTurn,
  ChatResponseTurn,
  ChatResponseMarkdownPart,
} from "vscode";

/**
 * Props for HistoryMessages component
 */
interface HistoryMessagesProps extends BasePromptElementProps {
  history: ChatContext["history"];
}

/**
 * Helper function to convert chat response parts to markdown string
 */
function extractSummaryFromAssistantTurn(turn: ChatResponseTurn): string {
  const responseText = extractResponseTextFromAssistantTurn(turn);

  // For slidev-copilot responses, try to extract the summary
  if (turn.participant === "slidev-copilot") {
    const summaryMatch = responseText.match(
      /--- Summary ---\s+([\s\S]+?)(?:\s*$|--- End)/i
    );
    if (summaryMatch) {
      return `[Summary] ${summaryMatch[1].trim()}`;
    }
  }

  return responseText;
}

function extractResponseTextFromAssistantTurn(turn: ChatResponseTurn): string {
  let responseText = "";

  for (const part of turn.response) {
    if (part instanceof ChatResponseMarkdownPart) {
      responseText += part.value.value;
    } else if (typeof part === "string") {
      responseText += part;
    }
  }

  return responseText;
}

/**
 * Component to display chat history with proper prioritization
 */
export class HistoryMessages extends PromptElement<HistoryMessagesProps> {
  render(): PromptPiece {
    const history: (UserMessage | AssistantMessage | PromptElement)[] = [];

    if (this.props.history !== null && this.props.history.length > 0) {
      const oldTurns = this.props.history
        .slice(0, this.props.history.length - 1)
        .reverse();

      for (const turn of oldTurns) {
        if (turn instanceof ChatRequestTurn) {
          history.push(<UserMessage>{turn.prompt}</UserMessage>);
        } else if (turn instanceof ChatResponseTurn) {
          history.push(
            <AssistantMessage name={turn.participant}>
              {extractSummaryFromAssistantTurn(turn)}
            </AssistantMessage>
          );
        }
      }

      const lastTurn = this.props.history[this.props.history.length - 1];
      if (lastTurn instanceof ChatResponseTurn) {
        history.push(
          <AssistantMessage name={lastTurn.participant}>
            {extractResponseTextFromAssistantTurn(lastTurn)}
          </AssistantMessage>
        );
      }
    }

    return (
      <UserMessage>
        {`\n\n# Chat History\n`}
        <PrioritizedList priority={0} descending={false}>
          {history}
        </PrioritizedList>
      </UserMessage>
    );
  }
}
