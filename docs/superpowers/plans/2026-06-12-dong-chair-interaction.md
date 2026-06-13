# Dong Chair Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Place the dong chair in the map and let the player sit with `X` while preserving down-key crouch.

**Architecture:** Add a small chair definition helper in `src/platformLayout.ts` so chair placement and proximity are testable without Phaser. Render the chair in `src/main.ts`, track a local seated state, and use `X` to sit/stand when close enough.

**Tech Stack:** TypeScript, Phaser 4, Node test runner.

---

### Task 1: Chair Layout Helpers

**Files:**
- Modify: `src/platformLayout.ts`
- Test: `tests/platformLayout.test.mjs`

- [ ] **Step 1: Write failing tests**

Add tests for creating a chair definition on a platform and detecting whether a player can sit from nearby but not far away.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: TypeScript compile fails because chair helpers do not exist yet.

- [ ] **Step 3: Implement minimal helper code**

Export `ChairDefinition`, `createChairDefinition`, and `isNearChairSeat` from `src/platformLayout.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: platform layout tests pass with the rest of the suite.

### Task 2: Phaser Chair Interaction

**Files:**
- Modify: `src/main.ts`
- Copy/Create: `public/assets/dong-chair.png`

- [ ] **Step 1: Add chair asset and preload**

Copy generated chair PNG into `public/assets/dong-chair.png` and load it as `dong-chair`.

- [ ] **Step 2: Render the chair**

Create the chair when its target platform becomes active. Keep it behind the player but above the platform.

- [ ] **Step 3: Add `X` interaction**

Add an interact key. If the player is close to the seat, set the body position to the seat anchor, stop physics movement, and play a seated visual pose. If already seated, `X`, movement, or jump exits the seated state.

- [ ] **Step 4: Preserve down-key crouch**

Keep `down` mapped to the existing `crouch` animation when grounded and not seated.

- [ ] **Step 5: Verify**

Run: `npm test` and `npm run build`
Expected: both commands exit 0.
