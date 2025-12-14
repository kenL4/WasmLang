# Toy WASM Language

A simple toy language that compiles to WebAssembly (WASM), designed for creating retro ASCII games and animations in the browser.

## Features

- **Zero Dependencies**: Compiles directly to WASM binary (no LLVM/Binaryen required).
- **Browser Runtime**: Runs in a Web Worker to support infinite game loops without freezing the UI.
- **ASCII Rendering**: DMA to a 80x25 text buffer used in the runtime.
- **Simple Syntax**: JavaScript-like syntax with `var`, `if`, `while`, `for`.

## Getting Started

### Prerequisites
- Node.js (v14+)
- NPM

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the compiler:
   ```bash
   npm run build
   ```

## Usage

### 1. Write Code
Create a file (e.g., `code.jj`) with your code:

```javascript
var x = 0;
while (1) {
  set_char(x, 10, 65); // Draw 'A' at (x, 10)
  present();           // Render frame
  x = x + 1;
  if (x > 79) { x = 0; }
}
```

### 2. Compile
Run the compiler script:

```bash
node dist/test_compiler.js code.jj
```
This will generate `test.wasm`.

### 3. Run
Start a local server (caching disabled is recommended during development):

```bash
npx http-server -c-1 .
```
Open `http://localhost:8080` in your browser.

## Language Reference

### Variables
All variables are 32-bit integers.
```javascript
var score = 0;
var speed = 5;

// Arrays (fixed size, compile-time allocation)
var map[2000];
map[0] = 1;

```

### Control Flow
**If / Else**:
```javascript
if (x > 10) {
  x = 0;
} else {
  x = x + 1;
}
```

**While Loop**:
```javascript
while (x < 100) {
  x = x + 1;
}
```

**For Loop**:
```javascript
for (var i = 0; i < 10; i = i + 1) {
  // ...
}
```

### Functions
Functions are declared with `func` and can take arguments.
```javascript
func add(a, b) {
  return a + b;
}

var result = add(10, 20);
```

**Return**:
```javascript
func test() {
  if (x > 10) { return; }
  // ...
}
```

### TODO:
- Classes (Optional)

### Built-in Functions

- **`set_char(x, y, char_code)`**
  - `x`: Column (0-79)
  - `y`: Row (0-24)
  - `char_code`: ASCII code (e.g., 65 for 'A', 32 for Space)
  - Writes a character to the video buffer.

- **`present()`**
  - Sends the current video buffer to the screen.
  - Limits framerate to ~60 FPS.
  - **Must be called** inside your main loop to see anything.

- **`random()`**
  - Returns a random 32-bit integer (0 to 2147483647).
  - Use modulo arithmetic helper for ranges (see `code.jj` example).

- **`get_key()`**
  - Returns the key code of the last pressed key (or 0 if none).
  - Consumes the key event (subsequent calls return 0 until new key press).
  - Key codes: 37 (Left), 38 (Up), 39 (Right), 40 (Down).

## Game Loop
For interactive applications, define an `update` function instead of using a `while(1)` loop. The runtime will call this function approximately 60 times per second.

```javascript
func update() {
  // Handle input
  var k = get_key();
  if (k == 37) { x = x - 1; }
  
  // Draw
  set_char(x, y, 64);
  present();
}
```

## Example: Bouncing Ball

```javascript
var x = 40;
var y = 12;
var dx = 1;
var dy = 1;

while (1) {
  // Clear previous position
  set_char(x, y, 32); 

  // Update position
  x = x + dx;
  y = y + dy;

  // Bounce off walls
  if (x > 78) { dx = 0 - 1; }
  if (x < 1) { dx = 1; }
  if (y > 23) { dy = 0 - 1; }
  if (y < 1) { dy = 1; }

  // Draw ball 'O'
  set_char(x, y, 79);
  
  present();
}
```
