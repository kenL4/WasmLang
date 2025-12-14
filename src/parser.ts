
import { Token, TokenType, Lexer } from './lexer';

export interface ASTNode { }

export class Program implements ASTNode {
    rooms: Room[] = [];
}

export class Room implements ASTNode {
    constructor(public name: string, public body: ASTNode[], public exit?: Return) { }
}

export class Return implements ASTNode {
    constructor(public value?: Expression) { }
}

export class VarDecl implements ASTNode {
    constructor(public name: string, public type: TokenType, public init: Expression) { }
}

export class Assign implements ASTNode {
    constructor(public name: string, public value: Expression, public op: TokenType) { }
}

export class If implements ASTNode {
    constructor(public condition: Expression, public thenBlock: ASTNode[]) { }
}

export class While implements ASTNode {
    constructor(public condition: Expression, public body: ASTNode[]) { }
}

export class Action implements ASTNode {
    constructor(public verb: TokenType, public target?: string) { }
}

export class Call implements ASTNode, Expression {
    constructor(public name: string, public args: Expression[]) { }
}

export interface Expression extends ASTNode { }

export class BinaryExpr implements Expression {
    constructor(public left: Expression, public op: TokenType, public right: Expression) { }
}

export class Identifier implements Expression {
    constructor(public name: string) { }
}

export class NumberLiteral implements Expression {
    constructor(public value: number) { }
}

export class BooleanLiteral implements Expression {
    constructor(public value: boolean) { }
}

export class UnaryExpr implements Expression {
    constructor(public op: TokenType, public right: Expression) { }
}

export class Parser {
    private tokens: Token[];
    private current = 0;

    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }

    parse(): Program {
        const program = new Program();
        while (!this.isAtEnd()) {
            // Consume walls/paths/dots between rooms
            if (this.match(TokenType.Wall, TokenType.Path, TokenType.Dot)) {
                continue;
            }
            if (this.isAtEnd()) break;
            program.rooms.push(this.room());
        }
        return program;
    }

    private room(): Room {
        // room_header ::= PLAYER 'dungeon' identifier
        // Consume any leading walls just in case
        while (this.match(TokenType.Wall, TokenType.Path, TokenType.Dot)) { }

        this.consume(TokenType.Player, "Expect '@' at start of room.");
        this.consume(TokenType.Dungeon, "Expect 'dungeon' after '@'.");
        const name = this.consume(TokenType.Identifier, "Expect room name.").value;

        const body: ASTNode[] = [];
        let exit: Return | undefined;

        // room_body ::= { statement | wall | path }
        // room_close ::= EXIT expression
        while (!this.isAtEnd()) {
            if (this.check(TokenType.Exit)) {
                this.advance();
                const value = this.expression();
                exit = new Return(value);
                break;
            }

            if (this.match(TokenType.Wall, TokenType.Path, TokenType.Dot)) {
                continue; // Ignore walls, paths, dots
            }

            if (this.check(TokenType.Player)) {
                // Next room started without explicit exit?
                // The grammar says room_close is mandatory, so we should error or assume implicit exit if we want to be lenient.
                // But let's stick to grammar: room_close ::= EXIT expression
                throw new Error(`Expect '>' exit before next room at line ${this.peek().line}`);
            }

            // If we hit EOF without exit, it's an error
            if (this.isAtEnd()) {
                throw new Error(`Expect '>' exit at end of room ${name}`);
            }

            body.push(this.statement());
        }

        // Consume trailing walls/paths if any
        while (this.match(TokenType.Wall, TokenType.Path, TokenType.Dot)) { }

        if (!exit) {
            throw new Error(`Expect '>' exit at end of room ${name}`);
        }

        return new Room(name, body, exit);
    }

    private statement(): ASTNode {
        if (this.match(TokenType.TypeGold, TokenType.TypeHp, TokenType.TypeMana, TokenType.TypeItem)) {
            return this.varDecl(this.previous().type);
        }
        if (this.match(TokenType.Query)) return this.conditional();
        if (this.match(TokenType.Spiral)) return this.loop();
        if (this.match(TokenType.VerbFight, TokenType.VerbOpen, TokenType.VerbDrink, TokenType.VerbEquip, TokenType.VerbPray, TokenType.VerbCast)) {
            return this.action(this.previous().type);
        }
        if (this.check(TokenType.Exit)) {
            this.advance();
            const value = this.expression();
            return new Return(value);
        }
        if (this.check(TokenType.Identifier)) {
            // Assignment or Call
            const next = this.peekNext();
            if (next.type === TokenType.Equals || next.type === TokenType.PlusEquals || next.type === TokenType.MinusEquals) {
                return this.assignment();
            }
            if (next.type === TokenType.LParen) {
                const name = this.consume(TokenType.Identifier, "Expect function name.").value;
                return this.call(name);
            }
        }

        throw new Error(`Unexpected token at line ${this.peek().line}: ${this.peek().value}`);
    }

    private varDecl(type: TokenType): VarDecl {
        const name = this.consume(TokenType.Identifier, "Expect variable name.").value;
        this.consume(TokenType.Equals, "Expect '=' after variable name.");
        const init = this.expression();
        return new VarDecl(name, type, init);
    }

    private assignment(): Assign {
        const name = this.consume(TokenType.Identifier, "Expect variable name.").value;
        const op = this.advance().type; // =, +=, -=
        const value = this.expression();
        return new Assign(name, value, op);
    }

    private conditional(): If {
        this.consume(TokenType.LParen, "Expect '(' after '?'.");
        const condition = this.expression();
        this.consume(TokenType.RParen, "Expect ')' after condition.");

        const thenBlock: ASTNode[] = [];
        // Ignore walls before block start
        while (this.match(TokenType.Wall, TokenType.Path, TokenType.Dot)) { }

        // We can have a block wrapped in walls/braces or a single statement
        // The grammar says: room (which is a block)
        // But the example shows:
        // ? (score < 10)
        // +------------+
        // | fight rat   |
        // ...
        // So it expects a block.
        // Let's allow { } or just a sequence of statements until a wall/end?
        // Actually, the user example shows:
        // ? (score < 10)
        // +------------+
        // | fight rat   |
        // | score += 1  |
        // +------------+
        // This looks like a block delimited by walls?
        // Or maybe we just look for a block.
        // Let's support standard { } blocks for now, and also "implicit" blocks if we see walls?
        // The user said: "Walls visually surround blocks, but braces still exist internally"
        // So maybe we should look for braces.

        if (this.check(TokenType.LBrace)) {
            this.consume(TokenType.LBrace, "Expect '{'");
            while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
                if (this.match(TokenType.Wall, TokenType.Path, TokenType.Dot)) continue;
                thenBlock.push(this.statement());
            }
            this.consume(TokenType.RBrace, "Expect '}'");
        } else {
            // Single statement
            thenBlock.push(this.statement());
        }

        return new If(condition, thenBlock);
    }

    private loop(): While {
        this.consume(TokenType.LParen, "Expect '(' after 'spiral'.");
        const condition = this.expression();
        this.consume(TokenType.RParen, "Expect ')' after condition.");

        const body: ASTNode[] = [];
        while (this.match(TokenType.Wall, TokenType.Path, TokenType.Dot)) { }

        if (this.check(TokenType.LBrace)) {
            this.consume(TokenType.LBrace, "Expect '{'");
            while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
                if (this.match(TokenType.Wall, TokenType.Path, TokenType.Dot)) continue;
                body.push(this.statement());
            }
            this.consume(TokenType.RBrace, "Expect '}'");
        } else {
            body.push(this.statement());
        }
        return new While(condition, body);
    }

    private action(verb: TokenType): Action {
        let target: string | undefined;
        if (this.check(TokenType.Identifier)) {
            target = this.advance().value;
        }
        return new Action(verb, target);
    }

    private call(name: string): Call {
        this.consume(TokenType.LParen, "Expect '(' after function name.");
        const args: Expression[] = [];
        if (!this.check(TokenType.RParen)) {
            do {
                args.push(this.expression());
            } while (this.match(TokenType.Comma));
        }
        this.consume(TokenType.RParen, "Expect ')' after arguments.");
        return new Call(name, args);
    }

    private expression(): Expression {
        return this.equality();
    }

    private equality(): Expression {
        let expr = this.comparison();

        while (this.match(TokenType.NotEquals, TokenType.DoubleEquals)) {
            const op = this.previous().type;
            const right = this.comparison();
            expr = new BinaryExpr(expr, op, right);
        }

        return expr;
    }

    private comparison(): Expression {
        let expr = this.term();

        while (this.match(TokenType.Gt, TokenType.Lt)) {
            const op = this.previous().type;
            const right = this.term();
            expr = new BinaryExpr(expr, op, right);
        }

        return expr;
    }

    private term(): Expression {
        let expr = this.factor();

        while (this.match(TokenType.Minus, TokenType.Plus)) {
            const op = this.previous().type;
            const right = this.factor();
            expr = new BinaryExpr(expr, op, right);
        }

        return expr;
    }

    private factor(): Expression {
        let expr = this.unary();

        while (this.match(TokenType.Divide, TokenType.Multiply)) {
            const op = this.previous().type;
            const right = this.unary();
            expr = new BinaryExpr(expr, op, right);
        }

        return expr;
    }

    private unary(): Expression {
        if (this.match(TokenType.Bang, TokenType.Minus)) {
            const op = this.previous().type;
            const right = this.unary();
            return new UnaryExpr(op, right);
        }

        return this.primary();
    }

    private primary(): Expression {
        if (this.match(TokenType.Number)) {
            return new NumberLiteral(parseInt(this.previous().value));
        }
        if (this.match(TokenType.True)) {
            return new BooleanLiteral(true);
        }
        if (this.match(TokenType.False)) {
            return new BooleanLiteral(false);
        }
        if (this.match(TokenType.Identifier)) {
            if (this.check(TokenType.LParen)) {
                return this.call(this.previous().value);
            }
            return new Identifier(this.previous().value);
        }
        if (this.match(TokenType.LParen)) {
            const expr = this.expression();
            this.consume(TokenType.RParen, "Expect ')' after expression.");
            return expr;
        }
        throw new Error(`Expect expression at line ${this.peek().line}, found ${this.peek().value}`);
    }

    private match(...types: TokenType[]): boolean {
        for (const type of types) {
            if (this.check(type)) {
                this.advance();
                return true;
            }
        }
        return false;
    }

    private check(type: TokenType): boolean {
        if (this.isAtEnd()) return false;
        return this.peek().type === type;
    }

    private advance(): Token {
        if (!this.isAtEnd()) this.current++;
        return this.previous();
    }

    private isAtEnd(): boolean {
        return this.peek().type === TokenType.EOF;
    }

    private peek(): Token {
        return this.tokens[this.current];
    }

    private peekNext(): Token {
        if (this.current + 1 >= this.tokens.length) return this.tokens[this.tokens.length - 1];
        return this.tokens[this.current + 1];
    }

    private previous(): Token {
        return this.tokens[this.current - 1];
    }

    private consume(type: TokenType, message: string): Token {
        if (this.check(type)) return this.advance();
        throw new Error(message + ` Found ${this.peek().value} at line ${this.peek().line}`);
    }
}
