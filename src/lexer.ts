
export enum TokenType {
    Var,
    If,
    Else,
    While,
    For,
    Identifier,
    Number,
    LBrace,
    RBrace,
    LParen,
    RParen,
    Semicolon,
    Equals,
    Plus,
    Minus,
    Multiply,
    Divide,
    Gt,
    Lt,
    Comma,
    EOF,
}

export interface Token {
    type: TokenType;
    value: string;
    line: number;
}

export class Lexer {
    private pos = 0;
    private line = 1;
    private input: string;

    constructor(input: string) {
        this.input = input;
    }

    private peek(): string {
        return this.input[this.pos] || '';
    }

    private advance(): string {
        const char = this.peek();
        this.pos++;
        if (char === '\n') this.line++;
        return char;
    }

    tokenize(): Token[] {
        const tokens: Token[] = [];
        while (this.pos < this.input.length) {
            const char = this.peek();

            if (/\s/.test(char)) {
                this.advance();
                continue;
            }

            if (/[0-9]/.test(char)) {
                let num = '';
                while (/[0-9]/.test(this.peek())) {
                    num += this.advance();
                }
                tokens.push({ type: TokenType.Number, value: num, line: this.line });
                continue;
            }

            if (/[a-zA-Z_]/.test(char)) {
                let id = '';
                while (/[a-zA-Z0-9_]/.test(this.peek())) {
                    id += this.advance();
                }

                let type = TokenType.Identifier;
                switch (id) {
                    case 'var': type = TokenType.Var; break;
                    case 'if': type = TokenType.If; break;
                    case 'else': type = TokenType.Else; break;
                    case 'while': type = TokenType.While; break;
                    case 'for': type = TokenType.For; break;
                }
                tokens.push({ type, value: id, line: this.line });
                continue;
            }

            switch (char) {
                case '{': tokens.push({ type: TokenType.LBrace, value: '{', line: this.line }); break;
                case '}': tokens.push({ type: TokenType.RBrace, value: '}', line: this.line }); break;
                case '(': tokens.push({ type: TokenType.LParen, value: '(', line: this.line }); break;
                case ')': tokens.push({ type: TokenType.RParen, value: ')', line: this.line }); break;
                case ';': tokens.push({ type: TokenType.Semicolon, value: ';', line: this.line }); break;
                case '=': tokens.push({ type: TokenType.Equals, value: '=', line: this.line }); break;
                case '+': tokens.push({ type: TokenType.Plus, value: '+', line: this.line }); break;
                case '-': tokens.push({ type: TokenType.Minus, value: '-', line: this.line }); break;
                case '*': tokens.push({ type: TokenType.Multiply, value: '*', line: this.line }); break;
                case '/':
                    if (this.peek() === '/') {
                        // Comment: consume until end of line
                        while (this.peek() !== '\n' && this.peek() !== '') {
                            this.advance();
                        }
                    } else {
                        tokens.push({ type: TokenType.Divide, value: '/', line: this.line });
                    }
                    break;
                case '>': tokens.push({ type: TokenType.Gt, value: '>', line: this.line }); break;
                case '<': tokens.push({ type: TokenType.Lt, value: '<', line: this.line }); break;
                case ',': tokens.push({ type: TokenType.Comma, value: ',', line: this.line }); break;
                default:
                    throw new Error(`Unexpected character: ${char} at line ${this.line}`);
            }
            this.advance();
        }
        tokens.push({ type: TokenType.EOF, value: '', line: this.line });
        return tokens;
    }
}
