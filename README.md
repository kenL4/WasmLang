# @dungeon Language

A NetHack-inspired, ASCII-hinted programming language that compiles to WebAssembly.

## Features

- **Visual Syntax**: Code is structured into "rooms" defined by ASCII art walls.
- **Room-Based**: Functions are rooms. You "enter" a room to call a function.
- **Verbs**: Built-in actions like `fight`, `open`, `drink`, `equip`, `pray`, `cast`.
- **ASCII Control Flow**: `?` for conditionals, `wander` for loops.
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

## Language Guide

### Rooms
A program consists of multiple rooms. The entry point is the `main` room.
Rooms are surrounded by ASCII walls (`+`, `-`, `|`).

```
+------------------+
| @ dungeon main   |
|                  |
|  gold score = 0  |
|  > score         |
+------------------+
```

### Variables
Types include `gold` (int), `hp`, `mana`, `item`.
```
gold coins = 10
hp health = 100
```

### Control Flow

**Conditionals (`?`)**:
```
? (health < 10)
+------------+
| {          |
| drink potion|
| }          |
+------------+
```

**Loops (`wander`)**:
```
wander (coins < 100)
+------------+
| {          |
| fight rat  |
| coins += 10|
| }          |
+------------+
```

### Verbs
Built-in actions that players will use (WHEN DONE)
- `fight <target>`
- `open <target>`
- `drink <target>`
- `equip <target>`
- `pray <target>`
- `cast <spell>`

### Environment Functions
- `scribe(x, y, char)`: Write ASCII character to screen buffer.
- `reveal()`: Render the screen buffer.
- `get_key()`: Get last key press.
- `random()`: Get random number.

### Example

```
+------------------+
| @ dungeon main   |
|                  |
|  gold score = 0  |
|                  |
|  ? (score < 10)  |
|  +------------+  |
|  | {          |  |
|  | fight rat  |  #
|  | score += 1 |  #
|  | }          |  #
|  +------------+  #
|                  |
|  > score         |
+------------------+
```

## Compilation

Run the compiler script:
```bash
npx ts-node test_compiler.ts
```
This generates `test.wasm`.
