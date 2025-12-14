
export enum TokenType {
    // Standard
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
    NotEquals,
    DoubleEquals,
    PlusEquals,
    MinusEquals,
    EOF,

    // Dungeon Specific
    Wall,       // + - |
    Path,       // #
    Dot,        // .
    Player,     // @
    Exit,       // >
    Query,      // ?
    Bang,       // !
    Dungeon,    // 'dungeon'
    Spiral,     // 'spiral'

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
    False
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
                    case 'dungeon': type = TokenType.Dungeon; break;
                    case 'spiral': type = TokenType.Spiral; break;
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
                    } else if (this.input[this.pos + 1] === '-' || this.input[this.pos + 1] === '+' || this.input[this.pos + 1] === '|') {
                        // Corner of a wall: +---+, +|
                        tokens.push({ type: TokenType.Wall, value: '+', line: this.line });
                    } else {
                        // Heuristic: if previous token was an identifier, number, or closing paren, this is likely an operator
                        // Also if it was an operator or assignment, it's a unary operator
                        const lastType = tokens.length > 0 ? tokens[tokens.length - 1].type : TokenType.EOF;
                        const isExpressionPart = [
                            TokenType.Number, TokenType.Identifier, TokenType.RParen, TokenType.RBracket,
                            TokenType.True, TokenType.False,
                            TokenType.Equals, TokenType.PlusEquals, TokenType.MinusEquals,
                            TokenType.Plus, TokenType.Minus, TokenType.Multiply, TokenType.Divide,
                            TokenType.Gt, TokenType.Lt, TokenType.DoubleEquals, TokenType.NotEquals,
                            TokenType.LParen, TokenType.LBracket, TokenType.Comma, TokenType.Exit
                        ].includes(lastType);

                        if (isExpressionPart) {
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
                        // Heuristic for minus vs wall
                        const lastType = tokens.length > 0 ? tokens[tokens.length - 1].type : TokenType.EOF;
                        const isExpressionPart = [
                            TokenType.Number, TokenType.Identifier, TokenType.RParen, TokenType.RBracket,
                            TokenType.True, TokenType.False,
                            TokenType.Equals, TokenType.PlusEquals, TokenType.MinusEquals,
                            TokenType.Plus, TokenType.Minus, TokenType.Multiply, TokenType.Divide,
                            TokenType.Gt, TokenType.Lt, TokenType.DoubleEquals, TokenType.NotEquals,
                            TokenType.LParen, TokenType.LBracket, TokenType.Comma, TokenType.Exit
                        ].includes(lastType);

                        if (isExpressionPart) {
                            tokens.push({ type: TokenType.Minus, value: '-', line: this.line });
                        } else {
                            tokens.push({ type: TokenType.Wall, value: '-', line: this.line });
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
                        // Comment
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
