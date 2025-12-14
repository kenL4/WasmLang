
import { Compiler } from './compiler';
import { NethackInterpreter } from './nethack';

const compiler = new Compiler();
const interpreter = new NethackInterpreter();

// Test 1: Basic movement and pickup
// Start at 'h' (2, 6)
// Target: 'v' (3, 3)
// Path: j (down to n), h (left to b), h (left to v), h (left to v), . (pickup)
const nethackCode = "jhhh.";
const expected = "v";
const result = interpreter.transpile(nethackCode);

console.log(`Test 1: ${result === expected ? 'PASS' : 'FAIL'} (Expected: ${expected}, Got: ${result})`);

// Test 2: Compile Nethack code "var x = 10;"
// v: jhh.
// a: kkhhh.
// r: lll.
//  : jj.
// x: khhhh.
//  : jj.
// =: kkkkkkkkkkk. (Wait, = is not in layout either! Need to add symbols)
// 1: kkkkkkkkkkk. (Wait, 1 is in row 0)
// 0: lllllllll.

// Okay, I need to add more symbols to the layout.
// Let's update the layout to include symbols.
// For now, let's just test what we have.
const test2Code = "jhh.";
const result2 = interpreter.transpile(test2Code);
console.log(`Test 2: ${result2}`);

// Test 3: Deletion
// Start at 'h' (2, 6). Pick up 'h'.
// Move to '←' (7, 9). Pick up '←'.
// Path: . (pick h), jjjjj (down to row 7), lll (right to col 9), . (pick backspace)
const test3Code = ".jjjjjlll.";
const result3 = interpreter.transpile(test3Code);
const expected3 = "";
console.log(`Test 3: ${result3 === expected3 ? 'PASS' : 'FAIL'} (Expected: '${expected3}', Got: '${result3}')`);

// Test 4: Newline
// Start at 'h' (2, 6). Pick up 'h'.
// Move to '↵' (8, 0). Pick up '↵'.
// Path: . (pick j), jjjjjj (down to row 8), hhhhhh (left to col 0), . (pick newline)
const test4Code = ".jjjjjjhhhhhh.";
const result4 = interpreter.transpile(test4Code);
const expected4 = "j\n";
console.log(`Test 4: ${result4 === expected4 ? 'PASS' : 'FAIL'} (Expected: '${expected4.replace('\n', '\\n')}', Got: '${result4.replace('\n', '\\n')}')`);


