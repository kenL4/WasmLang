const fs = require('fs');

async function run() {
    try {
        const buffer = fs.readFileSync('test.wasm');
        const memory = new WebAssembly.Memory({ initial: 1 });

        function present() {
            // Send memory buffer to main thread
            const buffer = new Uint8Array(memory.buffer, 0, 80 * 25);
            // self.postMessage({ type: 'frame', buffer: buffer });

            // Simple throttle to ~60fps
            const start = Date.now();
            while (Date.now() - start < 16);
        }

        function random() {
            return Math.floor(Math.random() * 2147483647);
        }

        const importObject = {
            env: {
                memory: memory,
                present: present,
                random: random
            }
        };

        console.log("Worker initializing... v2");
        console.log("importObject.env.random type:", typeof importObject.env.random);
        console.log("importObject.env.random value:", importObject.env.random);

        const results = await WebAssembly.instantiate(buffer, importObject);
        console.log("Instantiation successful!");
        results.instance.exports.run();
    } catch (err) {
        console.error("Error:", err.message);
    }
}

run();
