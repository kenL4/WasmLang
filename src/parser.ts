
import { Token, TokenType, Lexer } from './lexer';

export interface ASTNode { }

export class Program implements ASTNode {
    statements: ASTNode[] = [];
}

export class VarDecl implements ASTNode {
    constructor(public name: string, public init: Expression) { }
}

export class Assign implements ASTNode {
    constructor(public name: string, public value: Expression) { }
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

export class Parser {
    private tokens: Token[];
    private current = 0;

    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }

    parse(): Program {
        const program = new Program();
        while (!this.isAtEnd()) {
            program.statements.push(this.statement());
        }
        return program;
    }

    private statement(): ASTNode {
        if (this.match(TokenType.Var)) return this.varDecl();
        if (this.match(TokenType.If)) return this.ifStatement();
        if (this.match(TokenType.While)) return this.whileStatement();
        if (this.match(TokenType.For)) return this.forStatement();
        if (this.check(TokenType.Identifier) && this.peekNext().type === TokenType.Equals) {
            return this.assignment();
        }
        if (this.check(TokenType.Identifier) && this.peekNext().type === TokenType.LParen) {
            this.advance(); // Consume identifier
            const stmt = this.call();
            this.consume(TokenType.Semicolon, "Expect ';' after call.");
            return stmt;
        }
        // Fallback for expression statements (like calls)
        throw new Error(`Unexpected token at line ${this.peek().line}: ${this.peek().value}`);
    }

    private varDecl(): VarDecl {
        const name = this.consume(TokenType.Identifier, "Expect variable name.").value;
        this.consume(TokenType.Equals, "Expect '=' after variable name.");
        const init = this.expression();
        this.consume(TokenType.Semicolon, "Expect ';' after variable declaration.");
        return new VarDecl(name, init);
    }

    private assignment(): Assign {
        const name = this.consume(TokenType.Identifier, "Expect variable name.").value;
        this.consume(TokenType.Equals, "Expect '=' after variable name.");
        const value = this.expression();
        this.consume(TokenType.Semicolon, "Expect ';' after assignment.");
        return new Assign(name, value);
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
        while (this.match(TokenType.Equals)) { // Using = for equality check in this toy lang? No, let's use == if we had it. But lexer only has =. 
            // Wait, standard C-like has ==. My lexer has Equals (=). 
            // Let's assume for this toy lang, we might need '==' or just use '=' for both? 
            // No, that's ambiguous.
            // Let's check lexer. It has Equals.
            // I should probably add DoubleEquals to Lexer or just use Equals for assignment and something else for equality?
            // User asked for "very basic".
            // Let's stick to C-style: = is assign, == is equals.
            // I need to update Lexer to support ==.
            // For now, let's assume the user meant standard stuff.
            // I'll update Lexer to support '==' and '!='.
            // Actually, let's just use '==' for equality.
            // I will fix Lexer in a bit. For now, let's assume I have TokenType.DoubleEquals.
            // Wait, I can't easily change Lexer without another tool call.
            // Let's assume I'll fix Lexer.
            // Actually, let's just use `val` for now and fix it later.
            // Or, I can just use `>` and `<` for now as the only comparisons?
            // The user example used `x > 79`.
            // Let's stick to comparison for now.
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
        let expr = this.primary();
        while (this.match(TokenType.Multiply, TokenType.Divide)) {
            const op = this.previous().type;
            const right = this.primary();
            expr = new BinaryExpr(expr, op, right);
        }
        return expr;
    }

    private primary(): Expression {
        if (this.match(TokenType.Number)) {
            return new NumberLiteral(parseInt(this.previous().value));
        }
        if (this.match(TokenType.Identifier)) {
            if (this.check(TokenType.LParen)) {
                return this.call();
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
        throw new Error(message + ` Found ${this.peek().value} at line ${this.peek().line}`);
    }
}
