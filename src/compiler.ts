

import { Emitter, Opcode, Section, ValType } from './emitter';
import { Lexer } from './lexer';
import { Parser, Program, ASTNode, VarDecl, Assign, If, While, For, Block, Call, BinaryExpr, Identifier, NumberLiteral, Expression, FuncDecl, Return, ArrayAccess, UnaryExpr } from './parser';
import { TokenType } from './lexer';

export class Compiler {
    private emitter: Emitter = new Emitter();
    private locals: Map<string, number> = new Map();
    private nextLocalIndex = 0;
    private heapOffset = 2000; // Start after video RAM (80*25 = 2000)
    private arrayGlobals: Map<string, number> = new Map(); // Name -> Address (for arrays)
    private scalarGlobals: Map<string, number> = new Map(); // Name -> Global Index
    private funcSignatures: Map<string, { params: number, results: number, typeIndex: number }> = new Map();

    compile(source: string): Uint8Array {
        const lexer = new Lexer(source);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const program = parser.parse();

        this.emitter = new Emitter();
        this.arrayGlobals.clear();
        this.scalarGlobals.clear();
        this.heapOffset = 2000;

        // Pass 1: Identify Globals (Scalar and Array)
        let globalIndex = 0;
        for (const stmt of program.statements) {
            if (stmt instanceof VarDecl) {
                if (stmt.size !== undefined) {
                    if (!this.arrayGlobals.has(stmt.name)) {
                        this.arrayGlobals.set(stmt.name, this.heapOffset);
                        this.heapOffset += stmt.size * 4;
                    }
                } else {
                    if (!this.scalarGlobals.has(stmt.name)) {
                        this.scalarGlobals.set(stmt.name, globalIndex++);
                    }
                }
            }
        }

        // Pass 2: Analyze Functions for Signatures
        // We need to know param count (from declaration) and return type (from body scanning)
        // Standard types:
        // Type 0: () -> ()
        // Type 1: () -> i32 (random)
        // We will add more types as needed.

        // Initialize with standard types
        const signatures: { params: number, results: number }[] = [
            { params: 0, results: 0 }, // Type 0
            { params: 0, results: 1 }  // Type 1
        ];

        for (const func of program.functions) {
            const params = func.params.length;
            let results = 0;
            // Scan body for return with value
            if (this.hasReturnValue(func.body)) {
                results = 1;
            }

            // Find or create type index
            let typeIndex = signatures.findIndex(s => s.params === params && s.results === results);
            if (typeIndex === -1) {
                typeIndex = signatures.length;
                signatures.push({ params, results });
            }

            this.funcSignatures.set(func.name, { params, results, typeIndex });
        }

        this.emitModule(program, signatures);
        return this.emitter.getBuffer();
    }

    private hasReturnValue(block: Block): boolean {
        for (const stmt of block.statements) {
            if (stmt instanceof Return) {
                if (stmt.value) return true;
            } else if (stmt instanceof If) {
                if (this.hasReturnValue(stmt.thenBlock)) return true;
                if (stmt.elseBlock && this.hasReturnValue(stmt.elseBlock)) return true;
            } else if (stmt instanceof While) {
                if (this.hasReturnValue(stmt.body)) return true;
            } else if (stmt instanceof For) {
                if (this.hasReturnValue(stmt.body)) return true;
            } else if (stmt instanceof Block) {
                if (this.hasReturnValue(stmt)) return true;
            }
        }
        return false;
    }

    private emitModule(program: Program, signatures: { params: number, results: number }[]) {
        // Magic number: \0asm
        this.emitter.emitBytes([0x00, 0x61, 0x73, 0x6d]);
        // Version: 1 (fixed 4 bytes little endian)
        this.emitter.emitBytes([0x01, 0x00, 0x00, 0x00]);

        // Type Section
        this.emitter.emitSection(Section.Type, () => {
            this.emitter.emitU32(signatures.length);
            for (const sig of signatures) {
                this.emitter.emit(0x60); // func type
                this.emitter.emitU32(sig.params); // num params
                for (let i = 0; i < sig.params; i++) this.emitter.emit(ValType.I32);
                this.emitter.emitU32(sig.results); // num results
                for (let i = 0; i < sig.results; i++) this.emitter.emit(ValType.I32);
            }
        });

        // Import Section (Memory & Functions)
        this.emitter.emitSection(Section.Import, () => {
            this.emitter.emitU32(4); // 4 imports

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

            // env.random
            this.emitter.emitString('env');
            this.emitter.emitString('random');
            this.emitter.emit(0x00); // func type
            this.emitter.emitU32(1); // type index 1 (void -> i32)

            // env.get_key
            this.emitter.emitString('env');
            this.emitter.emitString('get_key');
            this.emitter.emit(0x00); // func type
            this.emitter.emitU32(1); // type index 1 (void -> i32)
        });

        // Function Section
        this.emitter.emitSection(Section.Function, () => {
            // 1 function for 'run' + N user functions
            this.emitter.emitU32(1 + program.functions.length);
            this.emitter.emitU32(0); // Type index 0 for run (() -> ())
            for (const func of program.functions) {
                const sig = this.funcSignatures.get(func.name);
                if (!sig) throw new Error(`Missing signature for ${func.name}`);
                this.emitter.emitU32(sig.typeIndex);
            }
        });

        // Global Section
        if (this.scalarGlobals.size > 0) {
            this.emitter.emitSection(Section.Global, () => {
                this.emitter.emitU32(this.scalarGlobals.size);
                for (let i = 0; i < this.scalarGlobals.size; i++) {
                    this.emitter.emit(ValType.I32);
                    this.emitter.emit(0x01); // mut
                    this.emitter.emit(Opcode.I32Const);
                    this.emitter.emitS32(0); // Init to 0
                    this.emitter.emit(Opcode.End);
                }
            });
        }

        // Export Section
        this.emitter.emitSection(Section.Export, () => {
            this.emitter.emitU32(1 + program.functions.length); // 1 export for 'run' + N user functions
            this.emitter.emitString('run');
            this.emitter.emit(0x00); // func export
            this.emitter.emitU32(3); // func index 3 (0=present, 1=random, 2=get_key, 3=run)

            // Export user functions
            for (let i = 0; i < program.functions.length; i++) {
                this.emitter.emitString(program.functions[i].name);
                this.emitter.emit(0x00); // func export
                this.emitter.emitU32(4 + i); // func index (starts at 4)
            }
        });

        // Code Section
        this.emitter.emitSection(Section.Code, () => {
            // 1 body for run + N bodies for user functions
            this.emitter.emitU32(1 + program.functions.length);

            // Emit 'run' function (contains top-level statements)
            this.emitFunctionBody(program.statements, program, [], true);

            // Emit user functions
            for (const func of program.functions) {
                this.emitFunctionBody(func.body.statements, program, func.params, false);
            }
        });
    }

    private emitFunctionBody(statements: ASTNode[], program: Program, params: string[] = [], isMain: boolean = false) {
        const bodyEmitter = new Emitter();

        // Reset locals for each function
        this.locals.clear();
        this.nextLocalIndex = 0;

        // Register params as locals first
        for (const param of params) {
            this.locals.set(param, this.nextLocalIndex++);
        }

        // Find locals in body
        for (const stmt of statements) {
            this.findLocals(stmt, this.locals, isMain);
        }

        // Emit locals declaration
        // We need to count how many locals are NOT params
        const numLocals = this.locals.size - params.length;
        bodyEmitter.emitU32(numLocals > 0 ? 1 : 0);
        if (numLocals > 0) {
            bodyEmitter.emitU32(numLocals);
            bodyEmitter.emit(ValType.I32);
        }

        // Emit instructions
        const originalEmitter = this.emitter;
        this.emitter = bodyEmitter;

        for (const stmt of statements) {
            this.emitStatement(stmt, program);
        }
        this.emitter.emit(Opcode.End);

        // Restore and write to main emitter
        this.emitter = originalEmitter;
        this.emitter.emitU32(bodyEmitter.getBuffer().length);
        this.emitter.emitBytes(Array.from(bodyEmitter.getBuffer()));
    }

    private findLocals(node: ASTNode, locals: Map<string, number>, isMain: boolean) {
        if (node instanceof VarDecl) {
            if (node.size !== undefined) {
                // Array declaration - handled in Pass 1 as arrayGlobals, not a local.
                // No runtime local variable for the array itself.
                return;
            } else {
                // Scalar variable declaration
                if (isMain) {
                    // If in 'run' function, and it's a VarDecl, it must be a global scalar.
                    // These are handled by the global section, not as locals in 'run'.
                    return;
                } else {
                    // If in a user function, 'var' always creates a local, even if it shadows a global.
                    if (!locals.has(node.name)) {
                        locals.set(node.name, this.nextLocalIndex++);
                    }
                }
            }
        } else if (node instanceof Block) {
            for (const stmt of node.statements) {
                this.findLocals(stmt, locals, isMain);
            }
        } else if (node instanceof If) {
            this.findLocals(node.thenBlock, locals, isMain);
            if (node.elseBlock) this.findLocals(node.elseBlock, locals, isMain);
        } else if (node instanceof While) {
            this.findLocals(node.body, locals, isMain);
        } else if (node instanceof For) {
            this.findLocals(node.init, locals, isMain);
            this.findLocals(node.body, locals, isMain);
        }
    }

    private emitStatement(stmt: ASTNode, program: Program) {
        if (stmt instanceof VarDecl) {
            if (stmt.size !== undefined) {
                // Array decl - nothing to emit at runtime, just compile-time allocation
                return;
            }
            if (stmt.init) {
                this.emitExpression(stmt.init, program);
                const index = this.locals.get(stmt.name);
                if (index !== undefined) {
                    this.emitter.emit(Opcode.LocalSet);
                    this.emitter.emitU32(index);
                } else {
                    const globalIndex = this.scalarGlobals.get(stmt.name);
                    if (globalIndex !== undefined) {
                        this.emitter.emit(Opcode.GlobalSet);
                        this.emitter.emitU32(globalIndex);
                    } else {
                        throw new Error(`Unknown variable ${stmt.name}`);
                    }
                }
            }
        } else if (stmt instanceof Assign) {
            if (stmt.index) {
                // Array assignment: name[index] = value
                // Stack: [value] -> need [address, value] for I32Store

                // Emit address first
                const baseAddr = this.arrayGlobals.get(stmt.name);
                if (baseAddr === undefined) throw new Error(`Unknown array ${stmt.name}`);

                this.emitter.emit(Opcode.I32Const);
                this.emitter.emitS32(baseAddr);

                this.emitExpression(stmt.index, program);
                this.emitter.emit(Opcode.I32Const);
                this.emitter.emitS32(4);
                this.emitter.emit(Opcode.I32Mul);

                this.emitter.emit(Opcode.I32Add);

                // Value
                this.emitExpression(stmt.value, program);

                this.emitter.emit(Opcode.I32Store);
                this.emitter.emitU32(2); // align 4
                this.emitter.emitU32(0); // offset
            } else {
                this.emitExpression(stmt.value, program);
                const index = this.locals.get(stmt.name);
                if (index !== undefined) {
                    this.emitter.emit(Opcode.LocalSet);
                    this.emitter.emitU32(index);
                } else {
                    const globalIndex = this.scalarGlobals.get(stmt.name);
                    if (globalIndex !== undefined) {
                        this.emitter.emit(Opcode.GlobalSet);
                        this.emitter.emitU32(globalIndex);
                    } else {
                        throw new Error(`Unknown variable ${stmt.name}`);
                    }
                }
            }
        } else if (stmt instanceof Return) {
            if (stmt.value) {
                this.emitExpression(stmt.value, program);
            }
            this.emitter.emit(Opcode.Return);
        } else if (stmt instanceof If) {
            this.emitExpression(stmt.condition, program);
            this.emitter.emit(Opcode.If);
            this.emitter.emit(0x40); // block type: void
            this.emitBlock(stmt.thenBlock, program);
            if (stmt.elseBlock) {
                this.emitter.emit(Opcode.Else);
                this.emitBlock(stmt.elseBlock, program);
            }
            this.emitter.emit(Opcode.End);
        } else if (stmt instanceof While) {
            this.emitter.emit(Opcode.Block);
            this.emitter.emit(0x40);
            this.emitter.emit(Opcode.Loop);
            this.emitter.emit(0x40);

            this.emitExpression(stmt.condition, program);
            this.emitter.emit(Opcode.I32Eqz);
            this.emitter.emit(Opcode.BrIf);
            this.emitter.emitU32(1); // Break to Block

            this.emitBlock(stmt.body, program);

            this.emitter.emit(Opcode.Br);
            this.emitter.emitU32(0); // Jump to Loop

            this.emitter.emit(Opcode.End); // End Loop
            this.emitter.emit(Opcode.End); // End Block
        } else if (stmt instanceof For) {
            // Init
            this.emitStatement(stmt.init, program);

            this.emitter.emit(Opcode.Block);
            this.emitter.emit(0x40);
            this.emitter.emit(Opcode.Loop);
            this.emitter.emit(0x40);

            // Condition
            this.emitExpression(stmt.condition, program);
            this.emitter.emit(Opcode.I32Eqz);
            this.emitter.emit(Opcode.BrIf);
            this.emitter.emitU32(1);

            // Body
            this.emitBlock(stmt.body, program);

            // Update
            this.emitStatement(stmt.update, program);

            this.emitter.emit(Opcode.Br);
            this.emitter.emitU32(0);

            this.emitter.emit(Opcode.End);
            this.emitter.emit(Opcode.End);
        } else if (stmt instanceof Call) {
            if (stmt.name === 'set_char') {
                // set_char(x, y, char)
                this.emitExpression(stmt.args[1], program); // y
                this.emitter.emit(Opcode.I32Const);
                this.emitter.emitS32(80);
                this.emitter.emit(Opcode.I32Mul);
                this.emitExpression(stmt.args[0], program); // x
                this.emitter.emit(Opcode.I32Add);
                this.emitExpression(stmt.args[2], program); // char
                this.emitter.emit(Opcode.I32Store8);
                this.emitter.emitU32(0);
                this.emitter.emitU32(0);
            } else if (stmt.name === 'present') {
                this.emitter.emit(Opcode.Call);
                this.emitter.emitU32(0);
            } else {
                // User function call as statement
                this.emitCall(stmt, program);
                // If it returns a value, drop it (assuming we don't know types yet, but we assumed void->void for user funcs? No, we need to handle return values if we add them)
                // For now, user funcs are void->void so no drop needed.
            }
        }
    }

    private emitBlock(block: Block, program: Program) {
        for (const stmt of block.statements) {
            this.emitStatement(stmt, program);
        }
    }

    private emitExpression(expr: Expression, program: Program) {
        if (expr instanceof NumberLiteral) {
            this.emitter.emit(Opcode.I32Const);
            this.emitter.emitS32(expr.value);
        } else if (expr instanceof Identifier) {
            const index = this.locals.get(expr.name);
            if (index !== undefined) {
                this.emitter.emit(Opcode.LocalGet);
                this.emitter.emitU32(index);
            } else {
                const globalIndex = this.scalarGlobals.get(expr.name);
                if (globalIndex !== undefined) {
                    this.emitter.emit(Opcode.GlobalGet);
                    this.emitter.emitU32(globalIndex);
                } else {
                    throw new Error(`Unknown variable ${expr.name}`);
                }
            }
        } else if (expr instanceof ArrayAccess) {
            // Load from array
            const baseAddr = this.arrayGlobals.get(expr.name);
            if (baseAddr === undefined) throw new Error(`Unknown array ${expr.name}`);

            // Addr = base + index * 4
            this.emitter.emit(Opcode.I32Const);
            this.emitter.emitS32(baseAddr);

            this.emitExpression(expr.index, program);
            this.emitter.emit(Opcode.I32Const);
            this.emitter.emitS32(4);
            this.emitter.emit(Opcode.I32Mul);

            this.emitter.emit(Opcode.I32Add);

            this.emitter.emit(Opcode.I32Load);
            this.emitter.emitU32(2); // align 4
            this.emitter.emitU32(0); // offset
        } else if (expr instanceof BinaryExpr) {
            this.emitExpression(expr.left, program);
            this.emitExpression(expr.right, program);
            switch (expr.op) {
                case TokenType.Plus: this.emitter.emit(Opcode.I32Add); break;
                case TokenType.Minus: this.emitter.emit(Opcode.I32Sub); break;
                case TokenType.Multiply: this.emitter.emit(Opcode.I32Mul); break;
                case TokenType.Divide: this.emitter.emit(Opcode.I32DivS); break;
                case TokenType.Gt: this.emitter.emit(Opcode.I32GtS); break;
                case TokenType.Lt: this.emitter.emit(Opcode.I32LtS); break;
                case TokenType.DoubleEquals: this.emitter.emit(Opcode.I32Eq); break;
                case TokenType.NotEquals: this.emitter.emit(Opcode.I32Ne); break;
                default: throw new Error(`Unknown binary op ${expr.op}`);
            }
        } else if (expr instanceof UnaryExpr) {
            if (expr.op === TokenType.Minus) {
                // 0 - expr
                this.emitter.emit(Opcode.I32Const);
                this.emitter.emitS32(0);
                this.emitExpression(expr.right, program);
                this.emitter.emit(Opcode.I32Sub);
            } else {
                throw new Error(`Unknown unary op ${expr.op}`);
            }
        } else if (expr instanceof Call) {
            if (expr.name === 'random') {
                this.emitter.emit(Opcode.Call);
                this.emitter.emitU32(1); // env.random (index 1 in imports)
            } else if (expr.name === 'get_key') {
                this.emitter.emit(Opcode.Call);
                this.emitter.emitU32(2); // env.get_key (index 2 in imports)
            } else {
                this.emitCall(expr, program);
            }
        }
    }

    private emitCall(expr: Call, program: Program) {
        // Find function index
        // Imported functions: 0 (present), 1 (random)
        // Internal functions: 2 (run), 3+ (user functions)
        const funcIndex = program.functions.findIndex(f => f.name === expr.name);
        if (funcIndex === -1) throw new Error(`Unknown function ${expr.name}`);

        // Push args
        for (const arg of expr.args) {
            this.emitExpression(arg, program);
        }

        this.emitter.emit(Opcode.Call);
        this.emitter.emitU32(4 + funcIndex); // 4 for 'run' + user function index (0=present, 1=random, 2=get_key, 3=run, 4=func0)
    }
}
