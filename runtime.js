
const screen = document.getElementById('screen');
const status = document.getElementById('status');

async function run() {
    try {
        status.innerText = "Checking for Rituals...";

        let bytes;
        const pendingRitual = localStorage.getItem('gothica_pending_ritual');

        if (pendingRitual) {
            status.innerText = "Loading Ritual...";
            const binaryString = window.atob(pendingRitual);
            const len = binaryString.length;
            bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
        } else {
            status.innerText = "Downloading Default...";
            const response = await fetch('test.wasm');
            bytes = await response.arrayBuffer();
        }

        status.innerText = "Starting Worker...";
        const worker = new Worker('worker.js');

        worker.onmessage = (e) => {
            if (e.data.type === 'frame') {
                const buffer = e.data.buffer;
                let s = "";
                for (let y = 0; y < 25; y++) {
                    for (let x = 0; x < 80; x++) {
                        const charCode = buffer[y * 80 + x];
                        s += charCode ? String.fromCharCode(charCode) : ' ';
                    }
                    s += '\n';
                }
                screen.innerText = s;
            } else if (e.data.type === 'ready') {
                status.innerText = "Running";
            } else if (e.data.type === 'error') {
                status.innerText = "Error: " + e.data.message;
            }
        };

        worker.postMessage({ type: 'init', wasm: bytes });

        document.addEventListener('keydown', (e) => {
            worker.postMessage({ type: 'keydown', key: e.keyCode });
        });

    } catch (e) {
        status.innerText = "Error: " + e.message;
        console.error(e);
    }
}

run();
