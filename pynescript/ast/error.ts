export interface SyntaxErrorDetails {
  filename: string;
  lineno: number;
  offset: number;
  text: string;
  end_lineno?: number | null;
  end_offset?: number | null;
}

export class SyntaxError extends Error {
  readonly details?: SyntaxErrorDetails;

  constructor(message: string, ...details: [] | [SyntaxErrorDetails] | [string, number, number, string, number?, number?]) {
    super(message);
    this.name = 'SyntaxError';
    if (details.length === 1 && typeof details[0] === 'object') {
      this.details = details[0] as SyntaxErrorDetails;
    } else if (details.length > 0) {
      const [filename, lineno, offset, text, end_lineno = null, end_offset = null] = details as [
        string,
        number,
        number,
        string,
        number | null | undefined,
        number | null | undefined,
      ];
      this.details = { filename, lineno, offset, text, end_lineno, end_offset };
    }
  }

  override toString(): string {
    if (!this.details) {
      return this.message;
    }
    const { filename, lineno, offset, text } = this.details;
    const stripped = text.trimStart();
    const leading = text.length - stripped.length;
    const pointerOffset = Math.max(0, offset - leading);
    const pointer = ' '.repeat(pointerOffset) + '^';
    return `${this.message}\n  File "${filename}", line ${lineno}\n    ${stripped}\n    ${pointer}`;
  }
}

export class IndentationError extends SyntaxError {}
