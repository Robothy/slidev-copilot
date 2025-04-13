import {
  BasePromptElementProps,
  PromptElement,
  UserMessage,
} from "@vscode/prompt-tsx";

/**
 * Props for UserInstruction component
 */
interface UserInstructionProps extends BasePromptElementProps {
  userRequest: string;
}

/**
 * Renders the user's request as a standalone instruction component
 */
export class UserInstruction extends PromptElement<UserInstructionProps> {
  render() {
    return (
      <UserMessage priority={90}>
        {`\n\n# User Instruction\n\n`}
        {`${this.props.userRequest}`}
      </UserMessage>
    );
  }
}