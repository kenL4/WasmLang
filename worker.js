
self.onmessage = async (e) => {
    if (e.data.type === 'init') {
        try {
            const memory = new WebAssembly.Memory({ initial: 1 });
            const importObject = {
                env: {
                    memory: memory,
                    present: () => {
                        // Send memory buffer to main thread
                        const buffer = new Uint8Array(memory.buffer, 0, 80 * 25);
                        self.postMessage({ type: 'frame', buffer: buffer });

                        // Simple throttle to ~60fps
                        const start = Date.now();
                        while (Date.now() - start < 16);
                    }
                }
            };

            const results = await WebAssembly.instantiate(e.data.wasm, importObject);
            self.postMessage({ type: 'ready' });
            results.instance.exports.run();
        } catch (err) {
            self.postMessage({ type: 'error', message: err.message });
        }
    }
};
