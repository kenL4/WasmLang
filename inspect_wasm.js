const fs = require('fs');
const buf = fs.readFileSync('test.wasm');

console.log('Total size:', buf.length);

// Print all bytes in hex
let s = '';
for (let i = 0; i < buf.length; i++) {
    s += buf[i].toString(16).padStart(2, '0') + ' ';
    if ((i + 1) % 16 === 0) s += '\n';
}
console.log(s);

// Search for Call opcode (0x10)
console.log('\nCall opcodes:');
for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0x10) {
        console.log(`At ${i.toString(16)}: Call ${buf[i + 1].toString(16)}`);
    }
}
