
import { Compiler } from './compiler';

// Visual Types
interface Point {
    x: number;
    y: number;
}

interface Node {
    id: string;
    type: 'soul' | 'altar' | 'crossroad' | 'circle' | 'conclude' | 'incantation';
    x: number;
    y: number;
    label: string;
    inputs: string[]; // Node IDs
    outputs: string[]; // Node IDs
    data: any;
}

class CathedralEditor {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private nodes: Node[] = [];
    private draggingNode: Node | null = null;
    private dragOffset: Point = { x: 0, y: 0 };
    private connectingNode: Node | null = null;
    private selectedNode: Node | null = null;
    private mousePos: Point = { x: 0, y: 0 };

    constructor() {
        this.canvas = document.getElementById('cathedral-floor') as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        this.setupInteraction();
        this.setupDragAndDrop();

        // Start loop
        this.render();

        // Setup buttons
        document.getElementById('btn-ritualize')?.addEventListener('click', () => this.ritualize());
        document.getElementById('btn-clear')?.addEventListener('click', () => this.cleanse());

        this.loadState();
    }

    private resizeCanvas() {
        this.canvas.width = this.canvas.parentElement!.clientWidth;
        this.canvas.height = this.canvas.parentElement!.clientHeight;
    }

    private setupInteraction() {
        this.canvas.addEventListener('mousedown', (e) => {
            const pos = this.getMousePos(e);
            const node = this.getNodeAt(pos);

            this.selectedNode = node || null; // Select or deselect
            this.render();

            if (node) {
                if (e.shiftKey) {
                    // Start connection
                    this.connectingNode = node;
                } else {
                    // Start drag
                    this.draggingNode = node;
                    this.dragOffset = { x: pos.x - node.x, y: pos.y - node.y };
                }
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            this.mousePos = this.getMousePos(e);

            if (this.draggingNode) {
                this.draggingNode.x = this.mousePos.x - this.dragOffset.x;
                this.draggingNode.y = this.mousePos.y - this.dragOffset.y;
            }
        });

        this.canvas.addEventListener('mouseup', (e) => {
            if (this.connectingNode) {
                const target = this.getNodeAt(this.mousePos);
                if (target && target !== this.connectingNode) {
                    // Create connection
                    this.connect(this.connectingNode, target);
                    this.saveState();
                }
                this.connectingNode = null;
            }
            if (this.draggingNode) {
                this.saveState();
            }
            this.draggingNode = null;
        });

        this.canvas.addEventListener('dblclick', (e) => {
            const pos = this.getMousePos(e);
            const node = this.getNodeAt(pos);
            if (node) {
                if (node.type === 'incantation') {
                    const code = prompt("Enter Gothica code for this incantation:", node.data.code || "");
                    if (code !== null) {
                        node.data.code = code;
                        node.label = code; // Show code as label
                        this.saveState();
                    }
                } else if (node.type === 'soul') {
                    const name = prompt("Variable Name:", node.data.name || "x");
                    const value = prompt("Initial Value:", node.data.value || "0");
                    if (name !== null && value !== null) {
                        node.data.name = name;
                        node.data.value = value;
                        node.label = `${name} = ${value}`;
                        this.saveState();
                    }
                } else if (node.type === 'crossroad') {
                    const condition = prompt("Condition (e.g. x > 10):", node.data.condition || "");
                    if (condition !== null) {
                        node.data.condition = condition;
                        node.label = `if (${condition})`;
                        this.saveState();
                    }
                } else if (node.type === 'circle') {
                    const condition = prompt("Loop Condition (e.g. x > 0):", node.data.condition || "");
                    if (condition !== null) {
                        node.data.condition = condition;
                        node.label = `while (${condition})`;
                        this.saveState();
                    }
                } else {
                    const newLabel = prompt("Rename this node:", node.label);
                    if (newLabel) {
                        node.label = newLabel;
                        this.saveState();
                    }
                }
                this.render();
            }
        });

        // Delete key handler
        window.addEventListener('keydown', (e) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedNode) {
                // Don't delete if editing text (simple check: if active element is input)
                // But we use prompt(), so no inputs on page.
                this.deleteNode(this.selectedNode);
                this.selectedNode = null;
                this.saveState();
                this.render();
            }
        });
    }

    private setupDragAndDrop() {
        const container = document.getElementById('canvas-container')!;

        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer!.dropEffect = 'copy';
        });

        // Sidebar drag start
        document.querySelectorAll('.reliquary').forEach(el => {
            el.addEventListener('dragstart', (e: any) => {
                // Use currentTarget to ensure we get the element with the listener
                const type = e.currentTarget.getAttribute('data-type');
                e.dataTransfer.setData('text/plain', type);
                e.dataTransfer.effectAllowed = 'copy';
            });
        });

        // Canvas drop
        container.addEventListener('drop', (e) => {
            e.preventDefault();
            const type = e.dataTransfer?.getData('text/plain');
            if (type) {
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                this.addNode(type as any, x, y);
                this.saveState();
            }
        });
    }

    private getMousePos(e: MouseEvent): Point {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    private getNodeAt(pos: Point): Node | undefined {
        // Simple hit testing
        return this.nodes.find(n => {
            return pos.x >= n.x && pos.x <= n.x + 100 &&
                pos.y >= n.y && pos.y <= n.y + 60;
        });
    }

    private addNode(type: 'soul' | 'altar' | 'crossroad' | 'circle' | 'conclude' | 'incantation', x: number, y: number) {
        const id = Math.random().toString(36).substr(2, 9);
        let label: string = type;
        const data: any = {};

        if (type === 'soul') {
            label = 'x = 0';
            data.name = 'x';
            data.value = '0';
        }

        this.nodes.push({
            id,
            type,
            x,
            y,
            label,
            inputs: [],
            outputs: [],
            data
        });
    }

    private deleteNode(node: Node) {
        // Remove from nodes list
        this.nodes = this.nodes.filter(n => n.id !== node.id);

        // Remove connections to/from this node
        this.nodes.forEach(n => {
            n.inputs = n.inputs.filter(id => id !== node.id);
            n.outputs = n.outputs.filter(id => id !== node.id);
            if (n.data.connections) {
                delete n.data.connections[node.id];
            }
        });
    }

    private connect(source: Node, target: Node) {
        if (source.outputs.includes(target.id)) {
            // Disconnect (Toggle)
            source.outputs = source.outputs.filter(id => id !== target.id);
            target.inputs = target.inputs.filter(id => id !== source.id);
            if (source.data.connections) {
                delete source.data.connections[target.id];
            }
        } else {
            // Connect
            // Handle Crossroad branching
            if (source.type === 'crossroad') {
                const isTrue = confirm("Is this the Path of Truth? (OK for Yes, Cancel for No/Else)");
                if (!source.data.connections) source.data.connections = {};
                source.data.connections[target.id] = isTrue ? 'true' : 'false';
            }

            source.outputs.push(target.id);
            target.inputs.push(source.id);
        }
    }

    private render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw connections
        this.ctx.strokeStyle = '#444';
        this.ctx.lineWidth = 2;

        // If connecting, draw temp line
        if (this.connectingNode) {
            this.ctx.beginPath();
            this.ctx.moveTo(this.connectingNode.x + 50, this.connectingNode.y + 30);
            this.ctx.lineTo(this.mousePos.x, this.mousePos.y);
            this.ctx.stroke();
        }

        // Draw existing connections
        for (const node of this.nodes) {
            for (const outId of node.outputs) {
                const target = this.nodes.find(n => n.id === outId);
                if (target) {
                    this.drawConnection(node, target);
                }
            }
        }

        // Draw nodes
        for (const node of this.nodes) {
            this.drawNode(node);
        }

        requestAnimationFrame(() => this.render());
    }

    private drawConnection(source: Node, target: Node) {
        this.ctx.beginPath();
        this.ctx.moveTo(source.x + 50, source.y + 30);
        // Bezier curve for "etched path" look
        const cp1x = source.x + 50 + (target.x - source.x) / 2;
        const cp1y = source.y + 30;
        const cp2x = source.x + 50 + (target.x - source.x) / 2;
        const cp2y = target.y + 30;

        this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, target.x + 50, target.y + 30);
        this.ctx.stroke();

        // Label branches
        if (source.type === 'crossroad' && source.data.connections) {
            const type = source.data.connections[target.id];
            if (type) {
                this.ctx.fillStyle = type === 'true' ? '#0f0' : '#f00';
                this.ctx.font = '12px Arial';
                this.ctx.fillText(type === 'true' ? 'T' : 'F', (source.x + target.x) / 2 + 50, (source.y + target.y) / 2 + 30);
            }
        }
    }

    private drawNode(node: Node) {
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.strokeStyle = node === this.selectedNode ? '#fff' : '#8b0000'; // Highlight selected
        this.ctx.lineWidth = node === this.selectedNode ? 3 : 2;

        // Glow effect
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = 'rgba(139, 0, 0, 0.5)';

        this.ctx.fillRect(node.x, node.y, 100, 60);
        this.ctx.strokeRect(node.x, node.y, 100, 60);

        this.ctx.shadowBlur = 0;

        // Icon
        this.ctx.fillStyle = '#d4af37';
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        let icon = '';
        switch (node.type) {
            case 'soul': icon = '☠'; break;
            case 'altar': icon = '⛧'; break;
            case 'crossroad': icon = '☩'; break;
            case 'circle': icon = '⟳'; break;
            case 'conclude': icon = '⚰'; break;
            case 'incantation': icon = '📜'; break;
        }
        this.ctx.fillText(icon, node.x + 50, node.y + 35);

        // Label
        this.ctx.fillStyle = '#aaa';
        this.ctx.font = '12px Courier New';
        this.ctx.fillText(node.label, node.x + 50, node.y + 55);
    }

    private ritualize() {
        console.log("Ritualizing...");
        const code = this.generateCode();
        console.log("Generated Code:", code);

        try {
            const compiler = new Compiler();
            const wasm = compiler.compile(code);

            // Save WASM to localStorage
            const base64 = this.bufferToBase64(wasm);
            localStorage.setItem('gothica_pending_ritual', base64);

            // Navigate to runtime
            window.location.href = 'index.html';
        } catch (e: any) {
            console.error(e);
            alert("Ritual failed: " + e.message);
        }
    }

    private bufferToBase64(buffer: Uint8Array): string {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    private saveState() {
        const state = {
            nodes: this.nodes
        };
        localStorage.setItem('gothica_vpl_state', JSON.stringify(state));
    }

    private loadState() {
        const json = localStorage.getItem('gothica_vpl_state');
        if (json) {
            try {
                const state = JSON.parse(json);
                this.nodes = state.nodes || [];
                this.render();
            } catch (e) {
                console.error("Failed to load state", e);
            }
        }
    }

    private generateCode(): string {
        // Simple generation strategy:
        // 1. Find 'soul' nodes -> Global variables
        // 2. Find 'altar' nodes -> Functions
        // 3. Traverse from altar to generate body

        let code = "";

        // Globals
        const souls = this.nodes.filter(n => n.type === 'soul');
        for (const soul of souls) {
            const name = soul.data.name || "x";
            const value = soul.data.value || "0";
            code += `☠ ${name} = ${value};\n`;
        }

        // Functions (Altars)
        const altars = this.nodes.filter(n => n.type === 'altar');
        for (const altar of altars) {
            code += `\n⛧ ${altar.label}() {\n`;

            // Traverse outputs
            // We need a recursive traversal for branching
            const startNode = this.findNext(altar);
            if (startNode) {
                code += this.generateBody(startNode, new Set());
            }

            // Always return 0 at the end to ensure valid WASM if paths fall through
            code += `    ⚰ 0;\n`;
            code += `}\n`;
        }

        // If no altar, create a default update
        if (altars.length === 0) {
            code += `\n⛧ update() {\n    ⚰ 0;\n}\n`;
        }

        return code;
    }

    private generateBody(node: Node, visited: Set<string>): string {
        if (visited.has(node.id)) return ""; // Prevent cycles for now
        visited.add(node.id);

        let code = "";

        if (node.type === 'conclude') {
            code += `    ⚰ 0;\n`;
        } else if (node.type === 'incantation') {
            if (node.data.code) {
                code += `    ${node.data.code};\n`;
            }
            // Continue flow
            const next = this.findNext(node);
            if (next) code += this.generateBody(next, visited);
        } else if (node.type === 'crossroad') {
            const condition = node.data.condition || "1";
            code += `    ☩ (${condition}) {\n`;

            // Find True path
            const trueTargetId = Object.keys(node.data.connections || {}).find(id => node.data.connections[id] === 'true');
            if (trueTargetId) {
                const trueNode = this.nodes.find(n => n.id === trueTargetId);
                if (trueNode) {
                    code += this.generateBody(trueNode, new Set(visited)); // New visited set for branch? Or same? 
                    // Actually, for a tree-like structure, we pass visited. 
                    // But if paths merge, we might want to allow visiting again? 
                    // For simplicity, let's just recurse.
                }
            }

            code += `    }\n`;

            // Find False path (Else) - Gothica supports else? Yes, 'path' or '☈' (actually '☩' is if, '☈' is else? No, check lexer)
            // Lexer: 'crossroad' -> If (1), 'path' -> Else (2). Unicode: ☩ (If), ☈ (Else - wait, lexer says ☩ is If, ☈ is Else? No, let's check lexer again)
            // Lexer: ☩ (2629) is If. ☈ (2608) is Else.

            const falseTargetId = Object.keys(node.data.connections || {}).find(id => node.data.connections[id] === 'false');
            if (falseTargetId) {
                const falseNode = this.nodes.find(n => n.id === falseTargetId);
                if (falseNode) {
                    code += `    ☈ {\n`;
                    code += this.generateBody(falseNode, new Set(visited));
                    code += `    }\n`;
                }
            }
        } else if (node.type === 'circle') {
            const condition = node.data.condition || "1";
            code += `    ♺ (${condition}) {\n`;

            // Loop body
            const next = this.findNext(node);
            if (next) {
                // For loops, we need to be careful about recursion/cycles. 
                // But in this simple VPL, the "body" is just the linear path connected to the output.
                // If the user creates a cycle back to the circle, it might be infinite recursion in generation?
                // Actually, 'visited' set handles cycles by stopping generation.
                // But a loop body SHOULD be generated.
                // If the loop body loops back to the circle, 'visited' will stop it, which is correct (we don't want to generate the circle again inside itself).
                code += this.generateBody(next, new Set(visited));
            }

            code += `    }\n`;
        } else if (node.type === 'soul') {
            // Just pass through soul nodes if they are in the flow (unlikely with new design, but possible)
            const next = this.findNext(node);
            if (next) code += this.generateBody(next, visited);
        }

        return code;
    }

    private findNext(node: Node): Node | undefined {
        if (node.outputs.length > 0) {
            return this.nodes.find(n => n.id === node.outputs[0]);
        }
        return undefined;
    }

    private runWasm(wasm: Uint8Array) {
        const overlay = document.getElementById('screen-overlay')!;
        overlay.classList.add('visible');

        // Reuse runtime logic (simplified)
        const worker = new Worker('worker.js');
        worker.onmessage = (e) => {
            if (e.data.type === 'frame') {
                // Render text buffer to overlay
                const buffer = e.data.buffer;
                let s = "";
                for (let y = 0; y < 25; y++) {
                    for (let x = 0; x < 80; x++) {
                        const charCode = buffer[y * 80 + x];
                        s += charCode ? String.fromCharCode(charCode) : ' ';
                    }
                    s += '\n';
                }
                document.getElementById('screen-content')!.innerText = s;
            }
        };
        worker.postMessage({ type: 'init', wasm: wasm });
    }

    private cleanse() {
        this.nodes = [];
        this.render();
    }
}

// Initialize
new CathedralEditor();
