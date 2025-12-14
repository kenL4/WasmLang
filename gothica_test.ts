import { Lexer } from './src/lexer';
import { Parser } from './src/parser';
import * as fs from 'fs';

const input = fs.readFileSync('ritual_glyphs.goth', 'utf-8');
const lexer = new Lexer(input);
const tokens = lexer.tokenize();

console.log('Tokens:', tokens);

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('AST:', JSON.stringify(ast, null, 2));
