import {
  BasePromptElementProps,
  PromptElement,
  UserMessage,
  PrioritizedList,
} from "@vscode/prompt-tsx";
import * as vscode from "vscode";
import { SlidevInstructions } from "./SlidevInstructions";
import { SlidevSyntaxGuide } from "./SlidevSyntaxGuide";
import { References } from "./References";
import { HistoryMessages } from "./HistoryMessages";
import { UserInstruction } from "./UserInstruction";
import { RecentSlidevMarkdown } from "./RecentSlidevMarkdown";

/**
 * Props for SlidevPrompt component
 */
interface SlidevPromptProps extends BasePromptElementProps {
  userRequest: string;
  history: vscode.ChatContext["history"];
  references?: readonly vscode.ChatPromptReference[];
}

/**
 * Top-level component for Slidev prompt generation
 */
export class SlidevPrompt extends PromptElement<SlidevPromptProps> {
  render() {
    return (
      <>
        <SlidevInstructions priority={100} />

        <SlidevSyntaxGuide priority={90} />

        {this.props.references && this.props.references.length > 0 && (
          <References references={this.props.references} priority={60} />
        )}

        {this.props.history && this.props.history.length > 0 && (
          <HistoryMessages history={this.props.history} priority={40} />
        )}

        {this.props.history && this.props.history.length > 0 && (
          <RecentSlidevMarkdown history={this.props.history} priority={70} />
        )}

        <UserInstruction userRequest={this.props.userRequest} priority={80} />
      </>
    );
  }
}
