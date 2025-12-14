

import { Token, TokenType, Lexer } from './lexer';

export interface ASTNode { }

export class Program implements ASTNode {
    statements: ASTNode[] = [];
    functions: FuncDecl[] = [];
}

export class FuncDecl implements ASTNode {
    constructor(public name: string, public params: string[], public body: Block) { }
}

export class Return implements ASTNode {
    constructor(public value?: Expression) { }
}

export class VarDecl implements ASTNode {
    constructor(public name: string, public init?: Expression, public size?: number) { }
}

export class Assign implements ASTNode {
    constructor(public name: string, public value: Expression, public index?: Expression) { }
}

export class If implements ASTNode {
    constructor(public condition: Expression, public thenBlock: Block, public elseBlock?: Block) { }
}

export class While implements ASTNode {
    constructor(public condition: Expression, public body: Block) { }
}

export class For implements ASTNode {
    constructor(public init: ASTNode, public condition: Expression, public update: ASTNode, public body: Block) { }
}

export class Block implements ASTNode {
    statements: ASTNode[] = [];
}

export class Call implements ASTNode {
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

export class ArrayAccess implements Expression {
    constructor(public name: string, public index: Expression) { }
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
            if (this.match(TokenType.Func)) {
                program.functions.push(this.funcDecl());
            } else {
                program.statements.push(this.statement());
            }
        }
        return program;
    }

    private funcDecl(): FuncDecl {
        const name = this.consume(TokenType.Identifier, "Expect function name.").value;
        this.consume(TokenType.LParen, "Expect '(' after function name.");
        const params: string[] = [];
        if (!this.check(TokenType.RParen)) {
            do {
                params.push(this.consume(TokenType.Identifier, "Expect parameter name.").value);
            } while (this.match(TokenType.Comma));
        }
        this.consume(TokenType.RParen, "Expect ')' after parameters.");
        const body = this.block();
        return new FuncDecl(name, params, body);
    }

    private statement(): ASTNode {
        if (this.match(TokenType.Var)) return this.varDecl();
        if (this.match(TokenType.If)) return this.ifStatement();
        if (this.match(TokenType.While)) return this.whileStatement();
        if (this.match(TokenType.For)) return this.forStatement();
        if (this.match(TokenType.Return)) return this.returnStatement();
        if (this.check(TokenType.Identifier)) {
            // Check for assignment or call
            // Lookahead is tricky here because `id` could be `id = ...`, `id(...)`, `id[expr] = ...`
            // We need to peek further or just parse expression and check if it's an assignment target?
            // But our grammar distinguishes statements and expressions.

            // Let's peek next token
            const next = this.peekNext();
            if (next.type === TokenType.Equals || next.type === TokenType.LBracket) {
                return this.assignment();
            }
        }
        if (this.check(TokenType.Identifier) && this.peekNext().type === TokenType.LParen) {
            this.advance(); // Consume identifier
            const stmt = this.call();
            this.consume(TokenType.Semicolon, "Expect ';' after call.");
            return stmt;
        }
        // Fallback for expression statements (like calls)
        throw new Error(`Unexpected token at line ${this.peek().line}: ${this.peek().value} `);
    }

    private varDecl(): VarDecl {
        const name = this.consume(TokenType.Identifier, "Expect variable name.").value;
        if (this.match(TokenType.LBracket)) {
            const size = this.consume(TokenType.Number, "Expect array size.").value;
            this.consume(TokenType.RBracket, "Expect ']' after array size.");
            this.consume(TokenType.Semicolon, "Expect ';' after array declaration.");
            return new VarDecl(name, undefined, parseInt(size));
        }
        this.consume(TokenType.Equals, "Expect '=' after variable name.");
        const init = this.expression();
        this.consume(TokenType.Semicolon, "Expect ';' after variable declaration.");
        return new VarDecl(name, init);
    }

    private assignment(): Assign {
        const name = this.consume(TokenType.Identifier, "Expect variable name.").value;
        let index: Expression | undefined = undefined;
        if (this.match(TokenType.LBracket)) {
            index = this.expression();
            this.consume(TokenType.RBracket, "Expect ']' after index.");
        }
        this.consume(TokenType.Equals, "Expect '=' after variable name.");
        const value = this.expression();
        this.consume(TokenType.Semicolon, "Expect ';' after assignment.");
        return new Assign(name, value, index);
    }

    private returnStatement(): Return {
        let value: Expression | undefined = undefined;
        if (!this.check(TokenType.Semicolon)) {
            value = this.expression();
        }
        this.consume(TokenType.Semicolon, "Expect ';' after return value.");
        return new Return(value);
    }

    private ifStatement(): If {
        this.consume(TokenType.LParen, "Expect '(' after 'if'.");
        const condition = this.expression();
        this.consume(TokenType.RParen, "Expect ')' after if condition.");
        const thenBlock = this.block();
        let elseBlock = undefined;
        if (this.match(TokenType.Else)) {
            elseBlock = this.block();
        }
        return new If(condition, thenBlock, elseBlock);
    }

    private whileStatement(): While {
        this.consume(TokenType.LParen, "Expect '(' after 'while'.");
        const condition = this.expression();
        this.consume(TokenType.RParen, "Expect ')' after while condition.");
        const body = this.block();
        return new While(condition, body);
    }

    private forStatement(): For {
        this.consume(TokenType.LParen, "Expect '(' after 'for'.");

        // Init
        let init: ASTNode;
        if (this.match(TokenType.Var)) {
            init = this.varDecl();
        } else {
            init = this.assignment();
        }
        // Note: varDecl and assignment consume the semicolon

        // Condition
        const condition = this.expression();
        this.consume(TokenType.Semicolon, "Expect ';' after loop condition.");

        // Update
        // Hack: Parse assignment but don't consume semicolon because ')' comes next
        const name = this.consume(TokenType.Identifier, "Expect variable name.").value;
        this.consume(TokenType.Equals, "Expect '=' after variable name.");
        const value = this.expression();
        const update = new Assign(name, value);

        this.consume(TokenType.RParen, "Expect ')' after for clauses.");
        const body = this.block();

        return new For(init, condition, update, body);
    }

    private block(): Block {
        this.consume(TokenType.LBrace, "Expect '{' before block.");
        const block = new Block();
        while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
            block.statements.push(this.statement());
        }
        this.consume(TokenType.RBrace, "Expect '}' after block.");
        return block;
    }

    private expression(): Expression {
        return this.equality();
    }

    private equality(): Expression {
        let expr = this.comparison();
        while (this.match(TokenType.DoubleEquals) || this.match(TokenType.NotEquals)) {
            const operator = this.previous().type;
            const right = this.comparison();
            expr = new BinaryExpr(expr, operator, right);
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
        while (this.match(TokenType.Plus, TokenType.Minus)) {
            const op = this.previous().type;
            const right = this.factor();
            expr = new BinaryExpr(expr, op, right);
        }
        return expr;
    }

    private factor(): Expression {
        let expr = this.unary();
        while (this.match(TokenType.Multiply, TokenType.Divide)) {
            const op = this.previous().type;
            const right = this.unary();
            expr = new BinaryExpr(expr, op, right);
        }
        return expr;
    }

    private unary(): Expression {
        if (this.match(TokenType.Minus)) {
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
        if (this.match(TokenType.Identifier)) {
            if (this.check(TokenType.LParen)) {
                return this.call();
            }
            const name = this.previous().value;
            if (this.match(TokenType.LBracket)) {
                const index = this.expression();
                this.consume(TokenType.RBracket, "Expect ']' after index.");
                return new ArrayAccess(name, index);
            }
            return new Identifier(name);
        }
        if (this.match(TokenType.LParen)) {
            const expr = this.expression();
            this.consume(TokenType.RParen, "Expect ')' after expression.");
            return expr;
        }
        throw new Error(`Expect expression at line ${this.peek().line}, found ${this.peek().value} `);
    }

    private call(): Call {
        // Identifier already consumed if called from primary, but if called from statement it is not?
        // Actually in primary() we consumed Identifier.
        // In statement() we peeked.
        // Let's standardize.
        // In primary(), we matched Identifier.
        const name = this.previous().value;
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
        throw new Error(message + ` Found ${this.peek().value} at line ${this.peek().line} `);
    }
}
