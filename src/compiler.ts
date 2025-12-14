
import { Emitter, Opcode, Section, ValType } from './emitter';
import { Lexer } from './lexer';
import { Parser, Program, ASTNode, VarDecl, Assign, If, While, For, Block, Call, BinaryExpr, Identifier, NumberLiteral, Expression } from './parser';
import { TokenType } from './lexer';

export class Compiler {
    private emitter: Emitter = new Emitter();
    private locals: Map<string, number> = new Map();
    private nextLocalIndex = 0;

    compile(source: string): Uint8Array {
        const lexer = new Lexer(source);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const program = parser.parse();

        this.emitModule(program);
        return this.emitter.getBuffer();
    }

    private emitModule(program: Program) {
        // Magic number: \0asm
        this.emitter.emitBytes([0x00, 0x61, 0x73, 0x6d]);
        // Version: 1 (fixed 4 bytes little endian)
        this.emitter.emitBytes([0x01, 0x00, 0x00, 0x00]);

        // Type Section
        this.emitter.emitSection(Section.Type, () => {
            this.emitter.emitU32(1); // 1 type
            // Type 0: () -> () (void function)
            this.emitter.emit(0x60); // func type
            this.emitter.emit(0); // 0 params
            this.emitter.emit(0); // 0 results
        });

        // Import Section (Memory & Functions)
        this.emitter.emitSection(Section.Import, () => {
            this.emitter.emitU32(2); // 2 imports

            // env.memory
            this.emitter.emitString('env');
            this.emitter.emitString('memory');
            this.emitter.emit(0x02); // mem type
            this.emitter.emit(0x00); // limit: min only
            this.emitter.emitU32(1); // 1 page (64KB)

            // env.present
            this.emitter.emitString('env');
            this.emitter.emitString('present');
            this.emitter.emit(0x00); // func type
            this.emitter.emitU32(0); // type index 0 (void -> void)
        });

        // Function Section
        this.emitter.emitSection(Section.Function, () => {
            this.emitter.emitU32(1); // 1 function
            this.emitter.emitU32(0); // Type index 0
        });

        // Export Section
        this.emitter.emitSection(Section.Export, () => {
            this.emitter.emitU32(1); // 1 export
            this.emitter.emitString('run');
            this.emitter.emit(0x00); // func export
            this.emitter.emitU32(1); // func index 1 (0 is imported present)
        });

        // Code Section
        this.emitter.emitSection(Section.Code, () => {
            this.emitter.emitU32(1); // 1 body
            this.emitFunctionBody(program);
        });
    }

    private emitFunctionBody(program: Program) {
        const bodyEmitter = new Emitter();

        // First pass to find locals
        // In a real compiler we'd scope this, but here all vars are function-local (global to the script)
        this.locals.clear();
        this.nextLocalIndex = 0;
        this.findLocals(program, this.locals);

        // Emit locals declaration
        bodyEmitter.emitU32(this.locals.size); // Number of local entries
        // We'll just emit one entry per local for simplicity, though we could group them
        for (let i = 0; i < this.locals.size; i++) {
            bodyEmitter.emitU32(1); // count
            bodyEmitter.emit(ValType.I32); // type
        }

        // Emit instructions
        const originalEmitter = this.emitter;
        this.emitter = bodyEmitter;

        for (const stmt of program.statements) {
            this.emitStatement(stmt);
        }
        this.emitter.emit(Opcode.End);

        // Restore and write to main emitter
        this.emitter = originalEmitter;
        this.emitter.emitU32(bodyEmitter.getBuffer().length);
        this.emitter.emitBytes(Array.from(bodyEmitter.getBuffer()));
    }

    private findLocals(node: ASTNode, locals: Map<string, number>) {
        if (node instanceof VarDecl) {
            if (!locals.has(node.name)) {
                locals.set(node.name, this.nextLocalIndex++);
            }
        } else if (node instanceof Block) {
            for (const stmt of node.statements) {
                this.findLocals(stmt, locals);
            }
        } else if (node instanceof If) {
            this.findLocals(node.thenBlock, locals);
            if (node.elseBlock) this.findLocals(node.elseBlock, locals);
        } else if (node instanceof While) {
            this.findLocals(node.body, locals);
        } else if (node instanceof For) {
            this.findLocals(node.init, locals);
            this.findLocals(node.body, locals);
        } else if (node instanceof Program) {
            for (const stmt of node.statements) {
                this.findLocals(stmt, locals);
            }
        }
    }

    private emitStatement(stmt: ASTNode) {
        if (stmt instanceof VarDecl) {
            this.emitExpression(stmt.init);
            const index = this.locals.get(stmt.name);
            if (index === undefined) throw new Error(`Unknown local ${stmt.name}`);
            this.emitter.emit(Opcode.LocalSet);
            this.emitter.emitU32(index);
        } else if (stmt instanceof Assign) {
            this.emitExpression(stmt.value);
            const index = this.locals.get(stmt.name);
            if (index === undefined) throw new Error(`Unknown local ${stmt.name}`);
            this.emitter.emit(Opcode.LocalSet);
            this.emitter.emitU32(index);
        } else if (stmt instanceof If) {
            this.emitExpression(stmt.condition);
            this.emitter.emit(Opcode.If);
            this.emitter.emit(0x40); // block type: void
            this.emitBlock(stmt.thenBlock);
            if (stmt.elseBlock) {
                this.emitter.emit(Opcode.Else);
                this.emitBlock(stmt.elseBlock);
            }
            this.emitter.emit(Opcode.End);
        } else if (stmt instanceof While) {
            this.emitter.emit(Opcode.Block);
            this.emitter.emit(0x40);
            this.emitter.emit(Opcode.Loop);
            this.emitter.emit(0x40);

            this.emitExpression(stmt.condition);
            this.emitter.emit(Opcode.I32Eqz);
            this.emitter.emit(Opcode.BrIf);
            this.emitter.emitU32(1); // Break to Block

            this.emitBlock(stmt.body);

            this.emitter.emit(Opcode.Br);
            this.emitter.emitU32(0); // Jump to Loop

            this.emitter.emit(Opcode.End); // End Loop
            this.emitter.emit(Opcode.End); // End Block
        } else if (stmt instanceof For) {
            // Init
            this.emitStatement(stmt.init);

            this.emitter.emit(Opcode.Block);
            this.emitter.emit(0x40);
            this.emitter.emit(Opcode.Loop);
            this.emitter.emit(0x40);

            // Condition
            this.emitExpression(stmt.condition);
            this.emitter.emit(Opcode.I32Eqz);
            this.emitter.emit(Opcode.BrIf);
            this.emitter.emitU32(1);

            // Body
            this.emitBlock(stmt.body);

            // Update
            this.emitStatement(stmt.update);

            this.emitter.emit(Opcode.Br);
            this.emitter.emitU32(0);

            this.emitter.emit(Opcode.End);
            this.emitter.emit(Opcode.End);
        } else if (stmt instanceof Call) {
            if (stmt.name === 'set_char') {
                // set_char(x, y, char)
                // Addr = y * 80 + x
                // We need to calculate this on stack

                // Push y
                this.emitExpression(stmt.args[1]);
                // Push 80
                this.emitter.emit(Opcode.I32Const);
                this.emitter.emitS32(80);
                // Multiply
                this.emitter.emit(Opcode.I32Mul);

                // Push x
                this.emitExpression(stmt.args[0]);
                // Add
                this.emitter.emit(Opcode.I32Add);

                // Push char
                this.emitExpression(stmt.args[2]);

                // Store 8
                this.emitter.emit(Opcode.I32Store8);
                this.emitter.emitU32(0); // align
                this.emitter.emitU32(0); // offset
            } else if (stmt.name === 'present') {
                this.emitter.emit(Opcode.Call);
                this.emitter.emitU32(0); // call env.present (index 0)
            }
        }
    }

    private emitBlock(block: Block) {
        for (const stmt of block.statements) {
            this.emitStatement(stmt);
        }
    }

    private emitExpression(expr: Expression) {
        if (expr instanceof NumberLiteral) {
            this.emitter.emit(Opcode.I32Const);
            this.emitter.emitS32(expr.value);
        } else if (expr instanceof Identifier) {
            const index = this.locals.get(expr.name);
            if (index === undefined) throw new Error(`Unknown local ${expr.name}`);
            this.emitter.emit(Opcode.LocalGet);
            this.emitter.emitU32(index);
        } else if (expr instanceof BinaryExpr) {
            this.emitExpression(expr.left);
            this.emitExpression(expr.right);
            switch (expr.op) {
                case TokenType.Plus: this.emitter.emit(Opcode.I32Add); break;
                case TokenType.Minus: this.emitter.emit(Opcode.I32Sub); break;
                case TokenType.Multiply: this.emitter.emit(Opcode.I32Mul); break;
                case TokenType.Divide: this.emitter.emit(Opcode.I32DivS); break;
                case TokenType.Gt: this.emitter.emit(Opcode.I32GtS); break;
                case TokenType.Lt: this.emitter.emit(Opcode.I32LtS); break;
                case TokenType.Equals: this.emitter.emit(Opcode.I32Eq); break; // Assuming we add == later, or use = for now
                default: throw new Error(`Unknown binary op ${expr.op}`);
            }
        } else if (expr instanceof Call) {
            // We don't support function calls in expressions yet (except builtins if they returned something)
            throw new Error("Function calls in expressions not supported yet");
        }
    }
}
