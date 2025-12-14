import { Token, TokenType } from './lexer';

// Helper functions from the original file
export function charToPixel(char: string, type: number = 0) {
    const ascii = char.charCodeAt(0);
    return (255 << 24) | (ascii << 16) | (type << 8); // RGBA as uint32
}

export function pixelToChar(pixel: number) {
    const ascii = (pixel >> 16) & 0xFF;
    const type = (pixel >> 8) & 0xFF;
    return { char: String.fromCharCode(ascii), type };
}

// Fixed colors for keywords and operators
// We'll use a simple scheme: 0xFF0000 + offset for keywords, etc.
// But to match the user's "FOR = 0xFF0000", we'll define that explicitly.
// Note: The helper uses (255 << 24) for alpha. 0xFF0000 is just RGB.
// We will mask out alpha when checking fixed colors if needed, or assume the input has alpha.
// Let's assume the input pixels might be fully opaque (0xFF......).
// 0xFF0000 (Red) -> If Alpha is 0xFF, it is 0xFFFF0000.
// Let's define the map with the expected full uint32 values if possible, or just RGB.
// To be safe, let's look at just the lower 24 bits for the fixed map.

export const TokenColors: Record<number, TokenType> = {
    0xFF0000: TokenType.For,
    0x00FF00: TokenType.If,
    0x0000FF: TokenType.Else,
    0xFFFF00: TokenType.While,
    0x00FFFF: TokenType.Func,
    0xFF00FF: TokenType.Return,
    0x800000: TokenType.Var,

    // Operators
    0xFFFFFF: TokenType.LBrace,
    0x010101: TokenType.RBrace, // Almost Black (0x000000 is reserved for transparent/eraser)
    0x808080: TokenType.Semicolon,
    0xC0C0C0: TokenType.LParen,
    0x404040: TokenType.RParen,
    0x505050: TokenType.Comma,
    0xFF8000: TokenType.Equals,
    0x0080FF: TokenType.Plus,
    0x80FF00: TokenType.Minus,
    0xFF0080: TokenType.Multiply,
    0x00FF80: TokenType.Divide,

    // Comparison
    0x8000FF: TokenType.Gt,
    0x008080: TokenType.Lt,
    0x808000: TokenType.DoubleEquals,
};

export class ColorLexer {
    private pixels: number[];
    private pos = 0;
    private width: number;

    constructor(pixels: number[], width: number) {
        this.pixels = pixels;
        this.width = width;
    }

    private peek(): number {
        return this.pixels[this.pos];
    }

    private advance(): number {
        const p = this.pixels[this.pos];
        this.pos++;
        return p;
    }

    tokenize(): Token[] {
        const tokens: Token[] = [];

        while (this.pos < this.pixels.length) {
            const pixel = this.peek();

            // Check Alpha channel (top 8 bits)
            // Use >>> for unsigned shift to handle negative numbers correctly
            const alpha = (pixel >>> 24) & 0xFF;

            if (alpha !== 0xFF) {
                // Treat as whitespace/ignored if not fully opaque
                this.advance();
                continue;
            }

            const rgb = pixel & 0xFFFFFF; // Ignore alpha for fixed map check
            const { char, type } = pixelToChar(pixel);

            // Check for Comments
            // Divide: 0x00FF80, Multiply: 0xFF0080
            if (rgb === 0x00FF80) { // Divide
                // Check next pixel
                if (this.pos + 1 < this.pixels.length) {
                    const nextPixel = this.pixels[this.pos + 1];
                    const nextRgb = nextPixel & 0xFFFFFF;

                    if (nextRgb === 0x00FF80) { // Divide + Divide = Line Comment
                        // Consume both
                        this.advance();
                        this.advance();
                        // Consume until end of line (row)
                        while (this.pos < this.pixels.length) {
                            // Check if we wrapped to new line
                            // Current line index: Math.floor(pos / width)
                            // If pos % width == 0, we are at start of new line
                            if (this.pos % this.width === 0) break;
                            this.advance();
                        }
                        continue;
                    } else if (nextRgb === 0xFF0080) { // Divide + Multiply = Block Comment Start
                        // Consume both
                        this.advance();
                        this.advance();
                        // Consume until Multiply + Divide
                        while (this.pos < this.pixels.length) {
                            const p = this.peek();
                            const pRgb = p & 0xFFFFFF;
                            if (pRgb === 0xFF0080) { // Multiply
                                if (this.pos + 1 < this.pixels.length) {
                                    const nextP = this.pixels[this.pos + 1];
                                    const nextPRgb = nextP & 0xFFFFFF;
                                    if (nextPRgb === 0x00FF80) { // Multiply + Divide = Block Comment End
                                        this.advance(); // Consume *
                                        this.advance(); // Consume /
                                        break;
                                    }
                                }
                            }
                            this.advance();
                        }
                        continue;
                    }
                }
            }

            // 1. Check Fixed Colors
            if (TokenColors.hasOwnProperty(rgb)) {
                tokens.push({
                    type: TokenColors[rgb],
                    value: TokenType[TokenColors[rgb]],
                    line: Math.floor(this.pos / this.width) + 1
                });
                this.advance();
                continue;
            }

            // 2. Check Type (Green Channel)
            // Type 1: Identifier
            if (type === 1) {
                let id = '';
                while (this.pos < this.pixels.length) {
                    const p = this.peek();
                    const info = pixelToChar(p);
                    if (info.type !== 1) break;
                    id += info.char;
                    this.advance();
                }
                tokens.push({
                    type: TokenType.Identifier,
                    value: id,
                    line: Math.floor(this.pos / this.width) + 1
                });
                continue;
            }

            // Type 2: Number
            if (type === 2) {
                let num = '';
                while (this.pos < this.pixels.length) {
                    const p = this.peek();
                    const info = pixelToChar(p);
                    if (info.type !== 2) break;
                    num += info.char;
                    this.advance();
                }
                tokens.push({
                    type: TokenType.Number,
                    value: num,
                    line: Math.floor(this.pos / this.width) + 1
                });
                continue;
            }

            // Type 0: Whitespace or Unknown
            // If it's not a fixed color and type is 0, we treat it as whitespace/ignored.
            this.advance();
        }

        tokens.push({ type: TokenType.EOF, value: '', line: Math.floor(this.pos / this.width) + 1 });
        return tokens;
    }
}
