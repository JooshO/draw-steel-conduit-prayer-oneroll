# Draw Steel: Conduit Prayer Module

A clean, refactored implementation that properly integrates with Draw Steel's resource system.

## Features

- **Clean Architecture**: Simplified codebase with proper Draw Steel integration
- **Correct Prayer Mechanics**: Implements one-roll prayer system:
  - Prayer 1: +1 piety + 1d6+level psychic damage (unblockable)
  - Prayer 2: +1 piety (safe)
  - Prayer 3: +2 piety + domain effect activation
- **Enricher Integration**: Uses Draw Steel's `/gain` system for proper resource management
- **Ownership-based Dialogs**: Only appears on the owning player's client
- **No Socket Dependencies**: Leverages Foundry's built-in client routing

## Requirements

- Foundry VTT v12+
- Draw Steel System

## Installation

1. In Foundry VTT, go to **Game Settings** → **Manage Modules**
2. Click **Add Module** → **Install Module**
3. Enter the Manifest URL:
   ```
   https://github.com/stgreenb/draw-steel-conduit-prayer-oneroll/releases/latest/download/module.json
   ```
4. Click **Install** and enable the module

## Usage

1. Start combat with a Conduit character
2. Prayer dialog appears automatically at turn start (only on owning client)
3. Choose to pray or skip
4. Piety gains are applied using Draw Steel's native resource system

## Changes in fork
Switch to oneroll

## License

MIT
# Updated contributors trigger
