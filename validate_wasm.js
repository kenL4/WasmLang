
const fs = require('fs');

try {
    const buffer = fs.readFileSync('test.wasm');
    if (WebAssembly.validate(buffer)) {
        console.log("WASM is valid!");
    } else {
        console.error("WASM is INVALID");
        try {
            new WebAssembly.Module(buffer);
        } catch (e) {
            console.error(e);
        }
    }
} catch (e) {
    console.error("Error reading or validating:", e);
}
