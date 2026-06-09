# Local Multiplayer Design

## Scope

Build the first multiplayer slice for local development. Multiple browser tabs or devices on the same machine/network can connect to one Node WebSocket server, see each other moving in the Phaser world, and see players appear or disappear as they connect and leave.

## Architecture

The client remains a Vite/Phaser game. A small Node server owns the live room state and broadcasts snapshots over WebSocket. The server does not simulate physics; each client sends its local position, velocity, facing, animation, and floor, and the server validates shape and clamps only lightweight identity fields.

## Components

- `server/multiplayerRoom.mjs`: pure room-state helpers for joining, leaving, updating, and creating snapshots.
- `server/multiplayer-server.mjs`: WebSocket server using `ws`.
- `src/multiplayerClient.ts`: browser WebSocket helpers and message normalization.
- `src/main.ts`: publishes the local player state and renders remote players with the existing player spritesheet.

## Data Flow

On connection, the server assigns an id and display name. The client sends `player:update` messages several times per second. The server stores the latest state and broadcasts a `room:snapshot` containing all players. Clients ignore their own id and render the rest as remote players.

## Testing

Room-state behavior is tested with Node's built-in test runner. Client message helpers are tested through the existing TypeScript test build. The full project is verified with `npm test` and `npm run build`.
