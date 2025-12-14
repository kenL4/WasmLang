

import { Emitter, Opcode, Section, ValType } from './emitter';
import { Lexer } from './lexer';
import { Parser, Program, ASTNode, VarDecl, Assign, If, While, Action, Call, BinaryExpr, Identifier, NumberLiteral, BooleanLiteral, Expression, Room, Return, UnaryExpr } from './parser';
import { TokenType } from './lexer';

export class Compiler {
    private emitter: Emitter = new Emitter();
    private locals: Map<string, number> = new Map();
    private nextLocalIndex = 0;

    // Verbs are imported functions: (i32) -> void
    // We map verb TokenType to function index
    private verbImports: Map<TokenType, number> = new Map();

    // Rooms are internal functions: () -> i32
    // We map room name to function index
    private roomIndices: Map<string, number> = new Map();

    compile(source: string): Uint8Array {
        const lexer = new Lexer(source);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const program = parser.parse();

        this.emitter = new Emitter();
        this.roomIndices.clear();

        // Map rooms to indices
        // Imports take up the first N indices
        // We have:
        // 0: env.random (void -> i32)
        // 1: env.present (void -> void) - maybe keep?
        // Verbs: fight, open, drink, equip, pray, cast (6 verbs)
        // Let's say:
        // 0: random
        // 1: fight
        // 2: open
        // 3: drink
        // 4: equip
        // 5: pray
        // 6: cast

        // Internal functions start at 7
        // 'run' export will be the 'main' room

        let funcIndex = 7;
        for (const room of program.rooms) {
            this.roomIndices.set(room.name, funcIndex++);
        }

        this.emitModule(program);
        return this.emitter.getBuffer();
    }

    private emitModule(program: Program) {
        // Magic number: \0asm
        this.emitter.emitBytes([0x00, 0x61, 0x73, 0x6d]);
        // Version: 1
        this.emitter.emitBytes([0x01, 0x00, 0x00, 0x00]);

        // Type Section
        this.emitter.emitSection(Section.Type, () => {
            this.emitter.emitU32(3);
            // Type 0: () -> i32 (Room function, random)
            this.emitter.emit(0x60);
            this.emitter.emitU32(0);
            this.emitter.emitU32(1);
            this.emitter.emit(ValType.I32);

            // Type 1: (i32) -> void (Verbs)
            this.emitter.emit(0x60);
            this.emitter.emitU32(1);
            this.emitter.emit(ValType.I32);
            this.emitter.emitU32(0);

            // Type 2: () -> void (present)
            this.emitter.emit(0x60);
            this.emitter.emitU32(0);
            this.emitter.emitU32(0);
        });

        // Import Section
        this.emitter.emitSection(Section.Import, () => {
            this.emitter.emitU32(10); // memory + random, present, get_key + 6 verbs

            // env.memory
            this.emitter.emitString('env');
            this.emitter.emitString('memory');
            this.emitter.emit(0x02); // memory
            this.emitter.emit(0x00); // limit flags (0 = min only)
            this.emitter.emitU32(1); // min 1 page

            // env.random (0)
            this.emitter.emitString('env');
            this.emitter.emitString('random');
            this.emitter.emit(0x00); // func
            this.emitter.emitU32(0); // type 0: () -> i32

            // env.present (1)
            this.emitter.emitString('env');
            this.emitter.emitString('present');
            this.emitter.emit(0x00); // func
            this.emitter.emitU32(2); // type 2: () -> void (need to define this type!)

            // env.get_key (2)
            this.emitter.emitString('env');
            this.emitter.emitString('get_key');
            this.emitter.emit(0x00); // func
            this.emitter.emitU32(0); // type 0: () -> i32

            const verbs = [
                { name: 'fight', type: TokenType.VerbFight },
                { name: 'open', type: TokenType.VerbOpen },
                { name: 'drink', type: TokenType.VerbDrink },
                { name: 'equip', type: TokenType.VerbEquip },
                { name: 'pray', type: TokenType.VerbPray },
                { name: 'cast', type: TokenType.VerbCast }
            ];

            let importIndex = 3;
            for (const verb of verbs) {
                this.emitter.emitString('env');
                this.emitter.emitString(verb.name);
                this.emitter.emit(0x00); // func
                this.emitter.emitU32(1); // type 1: (i32) -> void
                this.verbImports.set(verb.type, importIndex++);
            }
        });

        // Function Section
        this.emitter.emitSection(Section.Function, () => {
            this.emitter.emitU32(program.rooms.length);
            for (const _ of program.rooms) {
                this.emitter.emitU32(0); // All rooms are type 0: () -> i32
            }
        });

        // Export Section
        this.emitter.emitSection(Section.Export, () => {
            this.emitter.emitU32(1);
            this.emitter.emitString('run');
            this.emitter.emit(0x00); // func
            const mainIndex = this.roomIndices.get('main');
            if (mainIndex === undefined) throw new Error("No main room");
            this.emitter.emitU32(mainIndex);
        });

        // Code Section
        this.emitter.emitSection(Section.Code, () => {
            this.emitter.emitU32(program.rooms.length);
            for (const room of program.rooms) {
                this.emitRoom(room, program);
            }
        });
    }

    private emitRoom(room: Room, program: Program) {
        const bodyEmitter = new Emitter();

        // Reset locals
        this.locals.clear();
        this.nextLocalIndex = 0;

        // Find locals
        for (const stmt of room.body) {
            this.findLocals(stmt, this.locals);
        }
        // Also exit expression might use locals? No, exit uses vars defined in body.

        // Emit locals decl
        const numLocals = this.locals.size;
        bodyEmitter.emitU32(numLocals > 0 ? 1 : 0);
        if (numLocals > 0) {
            bodyEmitter.emitU32(numLocals);
            bodyEmitter.emit(ValType.I32);
        }

        // Emit instructions
        const originalEmitter = this.emitter;
        this.emitter = bodyEmitter;

        for (const stmt of room.body) {
            this.emitStatement(stmt, program);
        }

        // Emit exit
        if (room.exit && room.exit.value) {
            this.emitExpression(room.exit.value, program);
        } else {
            // Default return 0 if no exit value (shouldn't happen with valid grammar)
            this.emitter.emit(Opcode.I32Const);
            this.emitter.emitS32(0);
        }
        // Implicit return at end of function
        this.emitter.emit(Opcode.End);

        // Restore
        this.emitter = originalEmitter;
        this.emitter.emitU32(bodyEmitter.getBuffer().length);
        this.emitter.emitBytes(Array.from(bodyEmitter.getBuffer()));
    }

    private findLocals(node: ASTNode, locals: Map<string, number>) {
        if (node instanceof VarDecl) {
            if (!locals.has(node.name)) {
                locals.set(node.name, this.nextLocalIndex++);
            }
        } else if (node instanceof If) {
            for (const stmt of node.thenBlock) this.findLocals(stmt, locals);
        } else if (node instanceof While) {
            for (const stmt of node.body) this.findLocals(stmt, locals);
        }
    }

    private emitStatement(stmt: ASTNode, program: Program) {
        if (stmt instanceof VarDecl) {
            this.emitExpression(stmt.init, program);
            const index = this.locals.get(stmt.name);
            if (index === undefined) throw new Error(`Unknown local ${stmt.name}`);
            this.emitter.emit(Opcode.LocalSet);
            this.emitter.emitU32(index);
        } else if (stmt instanceof Assign) {
            if (stmt.op === TokenType.Equals) {
                this.emitExpression(stmt.value, program);
            } else {
                // +=, -=
                // Get current value
                const index = this.locals.get(stmt.name);
                if (index === undefined) throw new Error(`Unknown local ${stmt.name}`);
                this.emitter.emit(Opcode.LocalGet);
                this.emitter.emitU32(index);

                this.emitExpression(stmt.value, program);

                if (stmt.op === TokenType.PlusEquals) {
                    this.emitter.emit(Opcode.I32Add);
                } else if (stmt.op === TokenType.MinusEquals) {
                    this.emitter.emit(Opcode.I32Sub);
                }
            }

            const index = this.locals.get(stmt.name);
            if (index === undefined) throw new Error(`Unknown local ${stmt.name}`);
            this.emitter.emit(Opcode.LocalSet);
            this.emitter.emitU32(index);
        } else if (stmt instanceof If) {
            this.emitExpression(stmt.condition, program);
            this.emitter.emit(Opcode.If);
            this.emitter.emit(0x40); // void block
            for (const s of stmt.thenBlock) this.emitStatement(s, program);
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

            for (const s of stmt.body) this.emitStatement(s, program);

            this.emitter.emit(Opcode.Br);
            this.emitter.emitU32(0); // Jump to Loop

            this.emitter.emit(Opcode.End);
            this.emitter.emit(Opcode.End);
        } else if (stmt instanceof Action) {
            const funcIndex = this.verbImports.get(stmt.verb);
            if (funcIndex === undefined) throw new Error(`Unknown verb ${stmt.verb}`);

            // Pass target as hash
            const targetHash = this.hashString(stmt.target || "");
            this.emitter.emit(Opcode.I32Const);
            this.emitter.emitS32(targetHash);

            this.emitter.emit(Opcode.Call);
            this.emitter.emitU32(funcIndex);
        } else if (stmt instanceof Call) {
            if (stmt.name === 'scribe') {
                // scribe(x, y, char) -> memory[y * 80 + x] = char
                // Stack: [address, value]

                // Calculate address: y * 80 + x
                this.emitExpression(stmt.args[1], program); // y
                this.emitter.emit(Opcode.I32Const);
                this.emitter.emitS32(80);
                this.emitter.emit(Opcode.I32Mul);

                this.emitExpression(stmt.args[0], program); // x
                this.emitter.emit(Opcode.I32Add);

                // Value
                this.emitExpression(stmt.args[2], program); // char

                this.emitter.emit(Opcode.I32Store8);
                this.emitter.emitU32(0); // align
                this.emitter.emitU32(0); // offset
            } else if (stmt.name === 'reveal') {
                this.emitter.emit(Opcode.Call);
                this.emitter.emitU32(1); // env.present
            } else {
                // Call another room
                const funcIndex = this.roomIndices.get(stmt.name);
                if (funcIndex === undefined) throw new Error(`Unknown room ${stmt.name}`);

                this.emitter.emit(Opcode.Call);
                this.emitter.emitU32(funcIndex);
                this.emitter.emit(Opcode.Drop); // Rooms return i32, but as a statement we drop it
            }
        }
    }

    private emitExpression(expr: Expression, program: Program) {
        if (expr instanceof NumberLiteral) {
            this.emitter.emit(Opcode.I32Const);
            this.emitter.emitS32(expr.value);
        } else if (expr instanceof BooleanLiteral) {
            this.emitter.emit(Opcode.I32Const);
            this.emitter.emitS32(expr.value ? 1 : 0);
        } else if (expr instanceof Identifier) {
            const index = this.locals.get(expr.name);
            if (index === undefined) throw new Error(`Unknown local ${expr.name}`);
            this.emitter.emit(Opcode.LocalGet);
            this.emitter.emitU32(index);
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
                this.emitter.emit(Opcode.I32Const);
                this.emitter.emitS32(0);
                this.emitExpression(expr.right, program);
                this.emitter.emit(Opcode.I32Sub);
            } else if (expr.op === TokenType.Bang) {
                this.emitExpression(expr.right, program);
                this.emitter.emit(Opcode.I32Eqz);
            }
        } else if (expr instanceof Call) {
            if (expr.name === 'random') {
                this.emitter.emit(Opcode.Call);
                this.emitter.emitU32(0); // env.random
            } else if (expr.name === 'get_key') {
                this.emitter.emit(Opcode.Call);
                this.emitter.emitU32(2); // env.get_key
            } else {
                const funcIndex = this.roomIndices.get(expr.name);
                if (funcIndex === undefined) throw new Error(`Unknown room ${expr.name}`);
                this.emitter.emit(Opcode.Call);
                this.emitter.emitU32(funcIndex);
            }
        }
    }

    private hashString(s: string): number {
        let h = 0x811c9dc5;
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        return h >>> 0;
    }
}
