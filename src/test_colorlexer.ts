import { ColorLexer, charToPixel, TokenColors, pixelToChar } from './colorlexer';
import { TokenType } from './lexer';

// Helper to create a pixel for a keyword (using the map)
function getKeywordPixel(type: TokenType): number {
    // Find color for token type
    for (const [colorStr, t] of Object.entries(TokenColors)) {
        if (t === type) {
            const color = parseInt(colorStr);
            return (255 << 24) | color;
        }
    }
    return 0;
}

// Construct a program: "var x = 10;"
// var -> Fixed Color
// x -> Identifier (Type 1)
// = -> Fixed Color
// 10 -> Number (Type 2)
// ; -> Fixed Color

const pixels: number[] = [];

// var
pixels.push(getKeywordPixel(TokenType.Var));

// space (ignored)
pixels.push(0);

// x (Identifier)
pixels.push(charToPixel('x', 1));

// space
pixels.push(0);

// =
pixels.push(getKeywordPixel(TokenType.Equals));

// space
pixels.push(0);

// 10 (Number)
pixels.push(charToPixel('1', 2));
pixels.push(charToPixel('0', 2));

// ;
pixels.push(getKeywordPixel(TokenType.Semicolon));

console.log("Input Pixels:", pixels.map(p => '0x' + p.toString(16).toUpperCase()));

const lexer = new ColorLexer(pixels, 10); // Width 10
const tokens = lexer.tokenize();

console.log("Tokens:");
tokens.forEach(t => {
    console.log(`Type: ${TokenType[t.type]}, Value: '${t.value}'`);
});
