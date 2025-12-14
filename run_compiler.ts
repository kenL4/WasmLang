
import * as fs from 'fs';
import { Compiler } from './src/compiler';

const inputFile = process.argv[2] || 'dungeon.jj';
const source = fs.readFileSync(inputFile, 'utf-8');
const compiler = new Compiler();
try {
    const wasm = compiler.compile(source);
    fs.writeFileSync('test.wasm', wasm);
    console.log(`Successfully compiled ${inputFile} to test.wasm`);
} catch (e) {
    console.error('Compilation failed:', e);
    process.exit(1);
}
