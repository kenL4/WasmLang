
const fs = require('fs');

try {
    const buffer = fs.readFileSync('test.wasm');
    if (WebAssembly.validate(buffer)) {
        console.log("WASM is valid!");

        const module = new WebAssembly.Module(buffer);
        console.log("Imports:", WebAssembly.Module.imports(module));

        const memory = new WebAssembly.Memory({ initial: 1 });
        const importObject = {
            env: {
                memory: memory,
                present: () => { console.log("present called"); },
                random: () => { return 42; }
            }
        };

        WebAssembly.instantiate(buffer, importObject).then(results => {
            console.log("Instantiation successful!");
        }).catch(e => {
            console.error("Instantiation failed:", e);
        });

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
