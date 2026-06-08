# Platform Story Objects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Place a temporary round story object on every platform and show a small text/image panel when the player is nearby.

**Architecture:** Extend `src/platformLayout.ts` with deterministic story-object layout and proximity helpers. `src/main.ts` renders circles and hidden popup containers, then toggles popup visibility from the player position every frame.

**Tech Stack:** TypeScript, Vite, Phaser Arcade Physics, Node test runner.

---

### Task 1: Story Object Layout Helpers

**Files:**
- Modify: `src/platformLayout.ts`
- Modify: `tests/platformLayout.test.mjs`

- [ ] Add tests for object generation and proximity checks.
- [ ] Run `npm test` and confirm the new tests fail because the helpers do not exist.
- [ ] Implement `createPlatformObjectDefinitions` and `isNearStoryObject`.
- [ ] Run `npm test` and confirm all tests pass.

### Task 2: Phaser Scene Rendering

**Files:**
- Modify: `src/main.ts`

- [ ] Render a temporary circle object above every platform.
- [ ] Render a hidden popup above every object.
- [ ] In `update()`, show a popup only when the player is within 80 pixels of its object.
- [ ] Run `npm test` and `npm run build`.
- [ ] Reload `http://127.0.0.1:5173/` and visually verify the first object/popup behavior.
