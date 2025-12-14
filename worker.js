
let lastKey = 0;

self.onmessage = async (e) => {
    if (e.data.type === 'init') {
        try {
            const memory = new WebAssembly.Memory({ initial: 1 });

            let sleepView = null;
            if (typeof SharedArrayBuffer !== 'undefined') {
                sleepView = new Int32Array(new SharedArrayBuffer(4));
            }

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
                if (k !== 0) console.log("Key pressed:", k);
                lastKey = 0; // Consume key
                return k;
            }

            const importObject = {
                env: {
                    memory: memory,
                    present: present,
                    random: random,
                    get_key: get_key,
                    fight: (t) => console.log("fight", t),
                    open: (t) => console.log("open", t),
                    drink: (t) => console.log("drink", t),
                    equip: (t) => console.log("equip", t),
                    pray: (t) => console.log("pray", t),
                    cast: (t) => console.log("cast", t)
                }
            };

            console.log("Worker initializing... v4");

            const results = await WebAssembly.instantiate(e.data.wasm, importObject);
            self.postMessage({ type: 'ready' });

            // Run init function
            results.instance.exports.init();

            // Run loop in JS to allow event processing
            function loop() {
                const start = Date.now();
                results.instance.exports.main();

                // Throttle to ~30fps
                const elapsed = Date.now() - start;
                const delay = Math.max(0, 33 - elapsed);
                setTimeout(loop, delay);
            }
            loop();

        } catch (err) {
            self.postMessage({ type: 'error', message: err.message });
        }
    } else if (e.data.type === 'keydown') {
        lastKey = e.data.key;
    }
};
