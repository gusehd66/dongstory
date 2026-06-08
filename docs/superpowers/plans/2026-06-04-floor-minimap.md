# Floor Minimap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fixed left-side minimap that shows floors 0-30 and lets the player click a floor to teleport there.

**Architecture:** Keep floor math in `src/platformLayout.ts` so it can be tested without Phaser. `src/main.ts` renders a camera-fixed minimap HUD, highlights the current floor, and teleports the player to selected floor targets.

**Tech Stack:** TypeScript, Phaser Arcade Physics, Node test runner, Vite.

---

### Task 1: Floor Target Helper

**Files:**
- Modify: `src/platformLayout.ts`
- Modify: `tests/platformLayout.test.mjs`

- [ ] Add a failing test for floor 0 and platform floor teleport target positions.
- [ ] Implement `getFloorTargetPosition`.
- [ ] Run `npm test`.

### Task 2: Phaser Minimap HUD

**Files:**
- Modify: `src/main.ts`

- [ ] Render a fixed left-side panel with floor dots from 30 down to 0.
- [ ] Highlight the current floor.
- [ ] Make each dot interactive and teleport the player to that floor.
- [ ] Run `npm test` and `npm run build`.
