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
- `main` : Called repeatedly at a target of ~60 calls per second.

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

### Entering/Exiting Rooms (Functions)
To enter another room (calling the function), simply use its name followed by parentheses.
Note that rooms do not accept arguments directly. You must pass data via global memory (see Memory & Intrinsics).

```
some_room()
```

**Early Return (`>`)**:
Use `>` to return a value and exit a room.
```
> 0
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

### Memory & Intrinsics

The language provides direct access to WebAssembly memory.

- **Screen Buffer**: Bytes 0-1999 (80x25 grid).
- **General Memory**: Bytes 2000+ are available for use.

**Intrinsics**:
- `mem_get(addr)`: Read i32 from address.
- `mem_set(addr, val)`: Write i32 to address.
- `scan(x, y)`: Read byte from screen buffer at (x, y).
- `scribe(x, y, char)`: Write byte to screen buffer at (x, y). Takes ASCII code for `char` (reference table below).
- `reveal()`: Render the screen buffer to the browser.
- `get_key()`: Get the last key press code (reference table also provided below).
- `random()`: Get a random integer.

### Operators
- Arithmetic: `+`, `-`, `*`, `/`
- Comparison: `==`, `!=`, `<`, `>`
- Unary: `-` (Negation), `!` (Not)

### Reference Tables

**Keycodes (for `get_key`)**
| Key | Code |
| :--- | :--- |
| Left Arrow | 37 |
| Up Arrow | 38 |
| Right Arrow | 39 |
| Down Arrow | 40 |
| 0 - 9 | 48 - 57 |
| A - Z | 65 - 90 |

*Note: Letter keys always return uppercase codes (65-90), regardless of Shift/Caps Lock.*

**Common ASCII Codes**
| Char | Code | Description |
| :--- | :--- | :--- |
| ` ` | 32 | Empty Space |
| `#` | 35 | Wall |
| `$` | 36 | Gold / Coin |
| `*` | 42 | Level Indicator |
| `>` | 62 | Stairs / Goal |
| `@` | 64 | Player |
| `A` - `Z` | 65 - 90 | Uppercase Letters |
| `a` - `z` | 97 - 122 | Lowercase Letters |
| `M` | 77 | Monster |
| `O` | 79 | Object |

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
| @ dungeon main   |
|                  |
|  gold x = mem_get(20000) |
|  scribe(x, 12, 64) |
|  reveal()        |
|  > 0             |
+------------------+
```
