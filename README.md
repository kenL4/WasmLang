# @dungeon Language

A NetHack-inspired, ASCII-hinted programming language that compiles to WebAssembly.

## Features

- **Visual Syntax**: Code is structured into "rooms" defined by (optional) ASCII art walls.
- **Room-Based**: Functions are rooms. You "enter" a room to call a function.
- **Verbs**: Built-in actions like `fight`, `open`, `drink`, `equip`, `pray`, `cast` (currently don't do anything, but we can change these for the game).
- **ASCII Control Flow**: `?` for conditionals, `spiral` for while loops.
- **Memory Access**: Direct memory access via `mem_get`, `mem_set`, and `scan`.
- **Zero Dependencies**: Compiles directly to WASM.

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

### Running Code

Run the compiler script with your source file:
```bash
npx ts-node run_compiler.ts dungeon.jj
```
This generates `test.wasm`.

To run the generated WASM, start the local server:
```bash
npx http-server -c-1
```
Then open `http://localhost:8080` in your browser.

## Language Guide

### Rooms
A program consists of multiple rooms.
- `init`: Called once at startup.
- `main` (or `frame`): Called repeatedly by the host (game loop).

Rooms are surrounded by ASCII walls (`+`, `-`, `|`).

```
+------------------+
| @ dungeon init   |
|                  |
|  gold x = 0      |
|  > 0             |
+------------------+
```

However, this is not a strict requirement. The following is also valid:
```
@ dungeon init

 gold x = 0
 > 0
```

### Entering Rooms (Functions)
To enter another room (calling the function), simply use its name followed by parentheses.
Note that rooms do not accept arguments directly. You must pass data via global memory (see Memory & Intrinsics).

```
some_room()
```

### Variables
Types include `gold` (int), `hp`, `mana`, `item`. All map to 32-bit integers.
```
gold coins = 10
hp health = 100
```

### Control Flow

**Conditionals (`?`)**:
```
? (health < 10) {
  drink potion
}
```

**Loops (`spiral`)**:
```
spiral (coins < 100) {
  fight goblin
  coins += 10
}
```

**Early Return (`>`)**:
Use `>` to return a value from a room.
```
> 0
```

### Memory & Intrinsics

The language provides direct access to WebAssembly memory.

- **Screen Buffer**: Bytes 0-1999 (80x25 grid).
- **General Memory**: Bytes 2000+ are available for use.

**Intrinsics**:
- `mem_get(addr)`: Read i32 from address.
- `mem_set(addr, val)`: Write i32 to address.
- `scan(x, y)`: Read byte from screen buffer at (x, y).
- `scribe(x, y, char)`: Write byte to screen buffer at (x, y).
- `reveal()`: Render the screen buffer to the browser.
- `get_key()`: Get the last key press code.
- `random()`: Get a random integer.

### Operators
- Arithmetic: `+`, `-`, `*`, `/`
- Comparison: `==`, `!=`, `<`, `>`
- Unary: `-` (Negation), `!` (Not)

### Example

```
+------------------+
| @ dungeon init   |
|                  |
|  gold x = 40     |
|  mem_set(20000, x) |
|  > 0             |
+------------------+

+------------------+
| @ dungeon frame  |
|                  |
|  gold x = mem_get(20000) |
|  scribe(x, 12, 64) |
|  reveal()        |
|  > 0             |
+------------------+
```
