
export enum Opcode {
    Unreachable = 0x00,
    Block = 0x02,
    Loop = 0x03,
    If = 0x04,
    Else = 0x05,
    End = 0x0b,
    Br = 0x0c,
    BrIf = 0x0d,
    Return = 0x0f,
    Call = 0x10,
    Drop = 0x1a,
    LocalGet = 0x20,
    LocalSet = 0x21,
    LocalTee = 0x22,
    GlobalGet = 0x23,
    GlobalSet = 0x24,
    I32Load = 0x28,
    I32Load8U = 0x2d,
    I32Store = 0x36,
    I32Store8 = 0x3a,
    I32Const = 0x41,
    I32Eqz = 0x45,
    I32Eq = 0x46,
    I32Ne = 0x47,
    I32LtS = 0x48,
    I32GtS = 0x4a,
    I32LeS = 0x4c,
    I32GeS = 0x4e,
    I32Add = 0x6a,
    I32Sub = 0x6b,
    I32Mul = 0x6c,
    I32DivS = 0x6d,
    I32RemS = 0x6f,
    I32And = 0x71,
    I32Or = 0x72,
    I32Xor = 0x73,
    I32Shl = 0x74,
    I32ShrS = 0x75,
}

export enum Section {
    Custom = 0,
    Type = 1,
    Import = 2,
    Function = 3,
    Table = 4,
    Memory = 5,
    Global = 6,
    Export = 7,
    Start = 8,
    Element = 9,
    Code = 10,
    Data = 11,
}

export enum ValType {
    I32 = 0x7f,
    I64 = 0x7e,
    F32 = 0x7d,
    F64 = 0x7c,
}

export class Emitter {
    private buffer: number[] = [];

    constructor() { }

    getBuffer(): Uint8Array {
        return new Uint8Array(this.buffer);
    }

    emit(byte: number) {
        this.buffer.push(byte & 0xff);
    }

    emitBytes(bytes: number[]) {
        bytes.forEach(b => this.emit(b));
    }

    emitU32(n: number) {
        // LEB128 unsigned
        do {
            let byte = n & 0x7f;
            n >>>= 7;
            if (n !== 0) {
                byte |= 0x80;
            }
            this.emit(byte);
        } while (n !== 0);
    }

    emitS32(n: number) {
        // LEB128 signed
        while (true) {
            let byte = n & 0x7f;
            n >>= 7;
            const signBit = byte & 0x40;
            if ((n === 0 && !signBit) || (n === -1 && signBit)) {
                this.emit(byte);
                break;
            } else {
                this.emit(byte | 0x80);
            }
        }
    }

    emitString(s: string) {
        const bytes = new TextEncoder().encode(s);
        this.emitU32(bytes.length);
        this.emitBytes(Array.from(bytes));
    }

    emitVector(elements: any[], emitFn: (el: any) => void) {
        this.emitU32(elements.length);
        elements.forEach(emitFn);
    }

    emitSection(id: Section, contentFn: () => void) {
        this.emit(id);
        const tempBuffer = new Emitter();
        const originalEmit = this.emit;
        const originalBuffer = this.buffer;

        // Capture output to temp buffer
        this.buffer = tempBuffer.buffer;
        this.emit = tempBuffer.emit.bind(tempBuffer);

        contentFn();

        // Restore
        this.emit = originalEmit;
        this.buffer = originalBuffer;

        this.emitU32(tempBuffer.buffer.length);
        this.emitBytes(tempBuffer.buffer);
    }
}
