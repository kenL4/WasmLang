
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
    LBracket,
    RBracket,
    Func,
    Return,
    NotEquals,
    DoubleEquals,
    EOF,
    // New Tokens
    Wall,
    Path,
    Dot,
    Player,
    Exit,
    Query,
    Bang,
    Dungeon,
    Wander,
    // Types
    TypeGold,
    TypeHp,
    TypeMana,
    TypeItem,
    // Verbs
    VerbFight,
    VerbOpen,
    VerbDrink,
    VerbEquip,
    VerbPray,
    VerbCast,
    // Literals
    True,
    False,
    PlusEquals,
    MinusEquals
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
                    case 'func': type = TokenType.Func; break;
                    case 'return': type = TokenType.Return; break;
                    case 'dungeon': type = TokenType.Dungeon; break;
                    case 'wander': type = TokenType.Wander; break;
                    case 'gold': type = TokenType.TypeGold; break;
                    case 'hp': type = TokenType.TypeHp; break;
                    case 'mana': type = TokenType.TypeMana; break;
                    case 'item': type = TokenType.TypeItem; break;
                    case 'fight': type = TokenType.VerbFight; break;
                    case 'open': type = TokenType.VerbOpen; break;
                    case 'drink': type = TokenType.VerbDrink; break;
                    case 'equip': type = TokenType.VerbEquip; break;
                    case 'pray': type = TokenType.VerbPray; break;
                    case 'cast': type = TokenType.VerbCast; break;
                    case 'true': type = TokenType.True; break;
                    case 'false': type = TokenType.False; break;
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
                case '=':
                    if (this.input[this.pos + 1] === '=') {
                        this.advance();
                        tokens.push({ type: TokenType.DoubleEquals, value: '==', line: this.line });
                    } else {
                        tokens.push({ type: TokenType.Equals, value: '=', line: this.line });
                    }
                    break;
                case '+':
                    if (this.input[this.pos + 1] === '=') {
                        this.advance();
                        tokens.push({ type: TokenType.PlusEquals, value: '+=', line: this.line });
                    } else {
                        // Heuristic: + is Plus if previous token is an expression ender
                        const lastType = tokens.length > 0 ? tokens[tokens.length - 1].type : TokenType.EOF;
                        if (lastType === TokenType.Number ||
                            lastType === TokenType.Identifier ||
                            lastType === TokenType.RParen ||
                            lastType === TokenType.RBracket ||
                            lastType === TokenType.True ||
                            lastType === TokenType.False) {
                            tokens.push({ type: TokenType.Plus, value: '+', line: this.line });
                        } else {
                            tokens.push({ type: TokenType.Wall, value: '+', line: this.line });
                        }
                    }
                    break;
                case '-':
                    if (this.input[this.pos + 1] === '=') {
                        this.advance();
                        tokens.push({ type: TokenType.MinusEquals, value: '-=', line: this.line });
                    } else {
                        const next = this.input[this.pos + 1];
                        if (next === '-' || next === '+' || next === '|' || next === '\n' || next === undefined || next === '') {
                            tokens.push({ type: TokenType.Wall, value: '-', line: this.line });
                        } else {
                            tokens.push({ type: TokenType.Minus, value: '-', line: this.line });
                        }
                    }
                    break;
                case '|': tokens.push({ type: TokenType.Wall, value: '|', line: this.line }); break;
                case '#': tokens.push({ type: TokenType.Path, value: '#', line: this.line }); break;
                case '.': tokens.push({ type: TokenType.Dot, value: '.', line: this.line }); break;
                case '@': tokens.push({ type: TokenType.Player, value: '@', line: this.line }); break;
                case '>': tokens.push({ type: TokenType.Exit, value: '>', line: this.line }); break;
                case '?': tokens.push({ type: TokenType.Query, value: '?', line: this.line }); break;
                case '!':
                    if (this.input[this.pos + 1] === '=') {
                        this.advance();
                        tokens.push({ type: TokenType.NotEquals, value: '!=', line: this.line });
                    } else {
                        tokens.push({ type: TokenType.Bang, value: '!', line: this.line });
                    }
                    break;
                case '*': tokens.push({ type: TokenType.Multiply, value: '*', line: this.line }); break;
                case '/':
                    if (this.input[this.pos + 1] === '/') {
                        // Comment: consume until end of line
                        while (this.peek() !== '\n' && this.peek() !== '') {
                            this.advance();
                        }
                    } else {
                        tokens.push({ type: TokenType.Divide, value: '/', line: this.line });
                    }
                    break;
                case '<': tokens.push({ type: TokenType.Lt, value: '<', line: this.line }); break;
                case ',': tokens.push({ type: TokenType.Comma, value: ',', line: this.line }); break;
                case '[': tokens.push({ type: TokenType.LBracket, value: '[', line: this.line }); break;
                case ']': tokens.push({ type: TokenType.RBracket, value: ']', line: this.line }); break;
                default:
                    throw new Error(`Unexpected character: ${char} at line ${this.line}`);
            }
            this.advance();
        }
        tokens.push({ type: TokenType.EOF, value: '', line: this.line });
        return tokens;
    }
}
