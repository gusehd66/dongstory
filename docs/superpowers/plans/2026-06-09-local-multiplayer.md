# Local Multiplayer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local multiplayer so several browser sessions can see each other move in the current Phaser world.

**Architecture:** Add a small WebSocket server that owns room membership and broadcasts player snapshots. Keep client physics local and render remote players as visual-only avatars.

**Tech Stack:** Vite, TypeScript, Phaser, Node.js, `ws`, Node test runner.

---

### Task 1: Room State

**Files:**
- Create: `server/multiplayerRoom.mjs`
- Create: `tests/multiplayerRoom.test.mjs`
- Modify: `package.json`

- [ ] Write tests for join, update, snapshot, and leave behavior.
- [ ] Run `npm test` and confirm the multiplayer room test fails because the module is missing.
- [ ] Implement `createMultiplayerRoom()`.
- [ ] Run `npm test` and confirm the room tests pass.

### Task 2: Client Message Helpers

**Files:**
- Create: `src/multiplayerClient.ts`
- Create: `tests/multiplayerClient.test.mjs`
- Modify: `tsconfig.test.json`

- [ ] Write tests for WebSocket URL selection and snapshot normalization.
- [ ] Run `npm test` and confirm the client helper test fails because the module is missing.
- [ ] Implement the helper functions and exported message types.
- [ ] Run `npm test` and confirm the client helper tests pass.

### Task 3: WebSocket Server

**Files:**
- Create: `server/multiplayer-server.mjs`
- Modify: `package.json`

- [ ] Add `ws` as a dependency.
- [ ] Implement connection, update, snapshot broadcast, and disconnect handling.
- [ ] Add `dev:server` and `dev:multi` scripts.

### Task 4: Phaser Integration

**Files:**
- Modify: `src/main.ts`

- [ ] Connect the scene to the multiplayer client.
- [ ] Send local player updates when state changes or the send interval elapses.
- [ ] Render remote players with the existing player sprite frames, labels, and interpolation.
- [ ] Remove remote players when they disappear from the snapshot.

### Task 5: Verification

**Files:**
- Modify as needed based on compiler output.

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Start `npm run dev:multi` and report the local URLs.
