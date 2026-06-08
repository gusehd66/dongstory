# Zigzag Platform Tower Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 30-floor uniform zigzag platform tower the player can climb by jumping.

**Architecture:** Extract deterministic platform-position generation into `src/platformLayout.ts`. `src/main.ts` consumes that layout to create visible stool art and hidden static colliders, then expands world and camera bounds vertically.

**Tech Stack:** TypeScript, Vite, Phaser Arcade Physics, Node test runner.

---

### Task 1: Platform Layout Generator

**Files:**
- Create: `src/platformLayout.ts`
- Create: `tests/platformLayout.test.mjs`
- Modify: `package.json`

- [ ] Add a Node test that imports the built layout generator and asserts 30 alternating platforms with constant vertical spacing.
- [ ] Run `npm test` and confirm it fails because the generator does not exist yet.
- [ ] Implement `createZigzagPlatformDefinitions`.
- [ ] Run `npm test` and confirm it passes.

### Task 2: Phaser Scene Integration

**Files:**
- Modify: `src/main.ts`

- [ ] Replace hand-authored `PLATFORM_DEFINITIONS` with generated definitions.
- [ ] Increase `WORLD_HEIGHT` and set world/camera bounds to the tall world.
- [ ] Position the player near the bottom of the tower.
- [ ] Run `npm run build`.
- [ ] Open the game in the browser and verify the camera follows upward.
