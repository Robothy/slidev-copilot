import { BasePromptElementProps, PromptElement, PrioritizedList, UserMessage } from "@vscode/prompt-tsx";
import * as vscode from 'vscode';
import { ReferenceDisplay } from './ReferenceDisplay';

/**
 * Props for References component
 */
interface ReferencesProps extends BasePromptElementProps {
  references: readonly vscode.ChatPromptReference[];
}

/**
 * Component to display multiple references
 * Handles rendering a collection of references with appropriate prioritization
 */
export class References extends PromptElement<ReferencesProps> {
  render() {
    if (!this.props.references || this.props.references.length === 0) {
      return null;
    }

    return (
      <UserMessage priority={45}>
        {"# Referenced Content\n"}
        <PrioritizedList priority={40} descending={true}>
          {this.props.references.map((ref, index) => (
            <ReferenceDisplay reference={ref} />
          ))}
        </PrioritizedList>
      </UserMessage>
    );
  }
}