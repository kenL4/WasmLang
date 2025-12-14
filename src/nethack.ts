
export class NethackInterpreter {
    private x: number = 0;
    private y: number = 0;
    private output: string = "";

    // QWERTY layout
    // 0123456789
    // qwertyuiop
    // asdfghjkl;
    // zxcvbnm,./
    // SPACE (special handling?)

    private readonly layout: string[][] = [
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
        ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
        ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';'],
        ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/'],

        [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
        ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')'],
        ['-', '_', '=', '+', '[', ']', '{', '}', '\\', '|'],
        [':', ';', '"', '\'', '<', '>', '?', '`', '~', '←'],
        ['↵', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
        ['\n', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ']
    ];

    // Special handling for space, enter, etc?
    // Let's assume a 5th row for space and special chars if needed, 
    // or just map some unused keys.
    // For now, let's keep it simple. 
    // Maybe ' ' is at the end of row 3?

    constructor() {
        // Start at 'h' (row 2, col 6)
        this.x = 6;
        this.y = 2;
    }

    transpile(source: string): string {
        this.output = "";
        this.x = 6; // Reset to 'h'
        this.y = 2;

        for (const char of source) {
            switch (char) {
                case 'h': // Left
                    this.x = Math.max(0, this.x - 1);
                    break;
                case 'l': // Right
                    // Dynamic width based on current row
                    const rowLen = this.layout[this.y] ? this.layout[this.y].length : 10;
                    this.x = Math.min(rowLen - 1, this.x + 1);
                    break;
                case 'k': // Up
                    this.y = Math.max(0, this.y - 1);
                    // Clamp x if moving to a shorter row (though currently all are 10)
                    if (this.layout[this.y]) {
                        this.x = Math.min(this.layout[this.y].length - 1, this.x);
                    }
                    break;
                case 'j': // Down
                    this.y = Math.min(this.layout.length - 1, this.y + 1);
                    // Clamp x
                    if (this.layout[this.y]) {
                        this.x = Math.min(this.layout[this.y].length - 1, this.x);
                    }
                    break;
                case '.': // Pick up
                case ',': // Pick up
                    this.pickUp();
                    break;
            }
        }
        return this.output;
    }

    private pickUp() {
        if (this.y >= 0 && this.y < this.layout.length) {
            const row = this.layout[this.y];
            if (this.x >= 0 && this.x < row.length) {
                const char = row[this.x];
                if (char === '←') {
                    this.output = this.output.slice(0, -1);
                } else if (char === '↵') {
                    this.output += '\n';
                } else {
                    this.output += char;
                }
            }
        }
    }
}
