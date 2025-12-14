
let lastKey = 0;

self.onmessage = async (e) => {
    if (e.data.type === 'init') {
        try {
            const memory = new WebAssembly.Memory({ initial: 1 });

            function present() {
                // Send memory buffer to main thread
                const buffer = new Uint8Array(memory.buffer, 0, 80 * 25);
                self.postMessage({ type: 'frame', buffer: buffer });
            }

            function random() {
                return Math.floor(Math.random() * 2147483647);
            }

            function get_key() {
                const k = lastKey;
                lastKey = 0; // Consume key
                return k;
            }

            const importObject = {
                env: {
                    memory: memory,
                    present: present,
                    random: random,
                    get_key: get_key
                }
            };

            console.log("Worker initializing... v3");

            const results = await WebAssembly.instantiate(e.data.wasm, importObject);
            self.postMessage({ type: 'ready' });

            // Run initialization
            results.instance.exports.run();

            // Check for update function
            if (results.instance.exports.update) {
                console.log("Starting update loop");
                setInterval(() => {
                    results.instance.exports.update();
                }, 16); // ~60 FPS
            }

        } catch (err) {
            self.postMessage({ type: 'error', message: err.message });
        }
    } else if (e.data.type === 'keydown') {
        lastKey = e.data.key;
    }
};
