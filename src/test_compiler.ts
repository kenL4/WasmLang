
import { Compiler } from './compiler';
import * as fs from 'fs';

const inputFile = process.argv[2] || 'code.jj';
const outputFile = process.argv[3] || 'test.wasm';

if (!fs.existsSync(inputFile)) {
  console.error(`Error: File '${inputFile}' not found.`);
  process.exit(1);
}

const source = fs.readFileSync(inputFile, 'utf-8');

try {
  const compiler = new Compiler();
  const wasm = compiler.compile(source);
  fs.writeFileSync(outputFile, wasm);
  console.log(`Successfully compiled ${inputFile} to ${outputFile}`);
} catch (e) {
  console.error('Compilation failed:', e);
  process.exit(1);
}
