import { Compiler } from './compiler';
import { TokenColors, charToPixel } from './colorlexer';
import { TokenType, Lexer } from './lexer';

// Setup Canvas
const canvas = document.getElementById('editor-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const width = 32;
const height = 32;
const pixelSize = 20;

canvas.width = width * pixelSize;
canvas.height = height * pixelSize;

// Grid State (32x32 pixels)
let grid: number[] = new Array(width * height).fill(0);

// Reverse Map for Text -> Color
const TypeToColor: Map<TokenType, number> = new Map();
for (const [colorStr, type] of Object.entries(TokenColors)) {
    TypeToColor.set(type, parseInt(colorStr));
}

// ... (Rest of the file)

// Load Text Feature
const loadTextBtn = document.getElementById('load-text-btn')!;
const textInput = document.getElementById('text-input') as HTMLTextAreaElement;

loadTextBtn.onclick = () => {
    const text = textInput.value;
    if (!text) return;

    try {
        const lexer = new Lexer(text);
        const tokens = lexer.tokenize();

        // Clear grid
        grid.fill(0);

        let idx = 0;
        let indentLevel = 0;
        let isLineDirty = false;

        const newLine = () => {
            if (isLineDirty) {
                // Move to next line
                idx = (Math.floor(idx / width) + 1) * width + indentLevel;
                isLineDirty = false;
            } else {
                // Just adjust indent on current line
                idx = Math.floor(idx / width) * width + indentLevel;
            }
        };

        for (const token of tokens) {
            if (token.type === TokenType.EOF) break;

            if (idx >= grid.length) {
                alert('Program too large for 32x32 grid!');
                break;
            }

            // Pre-processing for formatting
            if (token.type === TokenType.RBrace) {
                indentLevel = Math.max(0, indentLevel - 1);
                newLine();
            }

            // Map Token to Pixels
            if (TypeToColor.has(token.type)) {
                // Fixed Color
                const color = TypeToColor.get(token.type)!;
                grid[idx++] = (255 << 24) | color;
                isLineDirty = true;
            } else if (token.type === TokenType.Identifier) {
                // Identifier: Sequence of pixels
                for (let i = 0; i < token.value.length; i++) {
                    if (idx >= grid.length) break;
                    grid[idx++] = charToPixel(token.value[i], 1);
                }
                isLineDirty = true;
            } else if (token.type === TokenType.Number) {
                // Number: Sequence of pixels
                for (let i = 0; i < token.value.length; i++) {
                    if (idx >= grid.length) break;
                    grid[idx++] = charToPixel(token.value[i], 2);
                }
                isLineDirty = true;
            }

            // Post-processing for formatting
            if (token.type === TokenType.LBrace) {
                indentLevel++;
                newLine();
            } else if (token.type === TokenType.Semicolon) {
                newLine();
            } else if (token.type === TokenType.RBrace) {
                newLine();
            } else {
                // Add a space (transparent) after each token to separate them
                if (idx < grid.length) grid[idx++] = 0;
            }
        }

        draw();
        updateStatus('Loaded text into grid.');
    } catch (e: any) {
        console.error(e);
        alert(`Error loading text: ${e.message}`);
    }
};

// Load Image Feature
const imageInput = document.getElementById('image-input') as HTMLInputElement;
imageInput.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            // Draw image to temp canvas to read pixels
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const tempCtx = tempCanvas.getContext('2d')!;
            tempCtx.drawImage(img, 0, 0, width, height);

            const imageData = tempCtx.getImageData(0, 0, width, height);
            const data = imageData.data;

            grid.fill(0);
            for (let i = 0; i < grid.length; i++) {
                const r = data[i * 4];
                const g = data[i * 4 + 1];
                const b = data[i * 4 + 2];
                const a = data[i * 4 + 3];

                if (a > 128) { // Threshold for transparency
                    grid[i] = (255 << 24) | (r << 16) | (g << 8) | b;
                } else {
                    grid[i] = 0;
                }
            }
            draw();
            updateStatus('Loaded image into grid.');
        };
        img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
});


// Current selected color/mode
let currentColor = 0xFF0000; // Default to Red (FOR)
let currentMode: 'fixed' | 'identifier' | 'number' = 'fixed';
let currentInput = '';

// Draw Grid
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const pixel = grid[idx];

            // Extract RGB (ignore alpha for display, assume full opacity if set)
            // If 0, draw white/checkerboard
            if (pixel === 0) {
                ctx.fillStyle = ((x + y) % 2 === 0) ? '#eee' : '#ddd';
            } else {
                const r = (pixel >> 16) & 0xFF;
                const g = (pixel >> 8) & 0xFF;
                const b = pixel & 0xFF;
                ctx.fillStyle = `rgb(${r},${g},${b})`;
            }

            ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
            ctx.strokeStyle = '#ccc';
            ctx.strokeRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
        }
    }
}

// Handle Click
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / pixelSize);
    const y = Math.floor((e.clientY - rect.top) / pixelSize);

    if (x >= 0 && x < width && y >= 0 && y < height) {
        const idx = y * width + x;

        if (e.button === 2) { // Right click to clear
            grid[idx] = 0;
        } else {
            // Set pixel based on current mode
            if (currentMode === 'fixed') {
                if (currentColor === 0) {
                    grid[idx] = 0; // Eraser
                } else {
                    // Ensure alpha is set to 0xFF
                    grid[idx] = (255 << 24) | currentColor;
                }
            } else if (currentMode === 'identifier' || currentMode === 'number') {
                // We need to place a sequence of pixels for the input string
                // But the user might just want to place ONE char at a time?
                // Or maybe we just place the current "brush" which is one char?
                // Let's assume the UI allows picking a char.

                if (currentInput.length > 0) {
                    const char = currentInput[0]; // Take first char
                    const type = currentMode === 'identifier' ? 1 : 2;
                    grid[idx] = charToPixel(char, type);
                }
            }
        }
        draw();
    }
});

canvas.addEventListener('contextmenu', e => e.preventDefault());

// Setup UI Controls
const palette = document.getElementById('palette')!;

// Add Eraser Button
const eraserBtn = document.createElement('button');
eraserBtn.textContent = 'Eraser';
eraserBtn.style.backgroundColor = '#333';
eraserBtn.style.color = 'white';
eraserBtn.style.border = '1px solid #555';
eraserBtn.onclick = () => {
    currentColor = 0; // 0 is transparent/empty
    currentMode = 'fixed';
    updateStatus('Selected: Eraser');
};
palette.appendChild(eraserBtn);

// Add Fixed Color Buttons
for (const [colorStr, type] of Object.entries(TokenColors)) {
    const color = parseInt(colorStr);
    const btn = document.createElement('button');
    const hex = '#' + color.toString(16).padStart(6, '0');
    btn.style.backgroundColor = hex;
    btn.textContent = TokenType[type];
    btn.style.color = (color & 0xFF0000) > 0x800000 ? 'black' : 'white'; // Simple contrast
    btn.onclick = () => {
        currentColor = color;
        currentMode = 'fixed';
        updateStatus(`Selected: ${TokenType[type]}`);
    };
    palette.appendChild(btn);
}

// Variable Input
const varInput = document.getElementById('var-input') as HTMLInputElement;
const varType = document.getElementById('var-type') as HTMLSelectElement;

varInput.addEventListener('input', () => {
    currentInput = varInput.value;
    currentMode = varType.value as 'identifier' | 'number';
    updateStatus(`Mode: ${currentMode}, Char: ${currentInput[0] || ''}`);
});

varType.addEventListener('change', () => {
    currentMode = varType.value as 'identifier' | 'number';
});

function updateStatus(msg: string) {
    document.getElementById('status')!.textContent = msg;
}

// Compile
document.getElementById('compile-btn')!.onclick = () => {
    try {
        const compiler = new Compiler();
        const wasm = compiler.compileFromPixels(grid, width);

        // Download
        const blob = new Blob([wasm], { type: 'application/wasm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'program.wasm';
        a.click();
        URL.revokeObjectURL(url);

        updateStatus('Compiled and downloaded successfully!');
    } catch (e: any) {
        console.error(e);
        updateStatus(`Error: ${e.message}`);
        alert(`Compilation Error: ${e.message}`);
    }
};

// Initial draw
draw();
