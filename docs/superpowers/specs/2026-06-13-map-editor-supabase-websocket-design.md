# Map Editor With Supabase And WebSocket Design

## Scope

Add a separate browser-based map editor where an admin can place platforms and story objects at desired world positions. Saving the map writes the latest layout to Supabase and notifies all connected game clients through the existing WebSocket server so everyone sees the updated map.

This first version focuses on platforms and placeable objects that already match the current game concepts. It does not add a full asset uploader, undo history, or multi-admin conflict editing.

## Architecture

Supabase is the durable source of truth for saved map layouts. The WebSocket server remains the live coordination layer. The editor saves a map layout to Supabase, then sends a lightweight publish message to the WebSocket server. The server broadcasts a `map:updated` notification to all connected clients. Game clients respond by loading the newest active map layout from Supabase and rebuilding their active platforms and objects.

If no saved map exists or Supabase loading fails, the game keeps the existing generated zigzag layout as a fallback.

## Components

- `src/mapLayout.ts`: shared map layout types, default map creation, validation, and conversion helpers.
- `src/mapLayoutSource.ts`: browser Supabase helpers for loading and saving the active map layout.
- `src/mapEditor.ts`: separate editor entry point with canvas/world preview, object palette, selection controls, and save flow.
- `src/main.ts`: loads the active saved map before creating the Phaser scene and listens for live map update notifications.
- `src/multiplayerClient.ts`: extends WebSocket message handling with map update events and publish messages.
- `server/multiplayer-server.mjs`: accepts `map:publish` from connected admin clients and broadcasts `map:updated`.
- `index.html` or a new editor HTML entry: routes normal game users to the game and editor users to the editor screen.

## Data Model

Create a Supabase table such as `map_layouts` with these fields:

- `id`: uuid primary key
- `name`: text
- `is_active`: boolean
- `version`: integer or timestamp-derived number
- `layout`: jsonb
- `created_at`: timestamptz
- `updated_at`: timestamptz

The `layout` JSON contains:

- `platforms`: array of `{ id, x, y, texture }`
- `storyObjects`: array of `{ id, x, y, label, title, description, photoUrl, thumbUrl }`
- `dialogues`: array of `{ id, x, y, speaker, message }`
- `chairs`: array of `{ id, x, y, facing, seatX, seatY, triggerDistance }`

The client validates loaded JSON and ignores invalid entries rather than crashing the game.

## Editor Experience

The editor is a separate screen, for example `/editor.html` or `/?mode=editor`. It shows the same world coordinate space as the game, with a restrained tool panel for selecting platform or object tools. The admin can click to place, drag to move, select to edit properties, and delete selected items. A visible save status confirms when Supabase save succeeds and when the WebSocket publish message has been sent.

The initial editor map loads the active Supabase layout. If there is no active layout yet, it starts from the current generated zigzag platform layout so the existing tower is immediately editable.

## Realtime Flow

1. Editor loads active map from Supabase.
2. Admin edits positions and object data.
3. Admin clicks save.
4. Editor validates and saves the active layout to Supabase.
5. Editor sends `map:publish` with the saved map version over WebSocket.
6. Server broadcasts `map:updated` with the version.
7. Game clients receive `map:updated`, reload the active layout from Supabase, and rebuild map objects.

Clients that are mid-game keep their player connection. If a platform under a player changes, the game should keep the player position and let physics settle naturally rather than teleporting everyone.

## Authorization

For the first implementation, editor access should reuse the existing admin join code concept. Only clients connected as admin can publish `map:publish` through the WebSocket server. Supabase writes should be protected by Supabase policy or an editor-only key configuration before public deployment.

If row-level security is not ready during local development, the UI should still keep editor access behind the admin code, and the deployment checklist must call out the database policy requirement.

## Error Handling

If Supabase load fails, the game uses the generated fallback layout and shows a console warning. If editor save fails, no publish message is sent and the editor shows the failed save state. If WebSocket publish fails after a successful Supabase save, the editor shows that the map is saved but live clients may need refresh; new clients will still load the saved map.

## Testing

Unit tests should cover map layout validation, fallback behavior, and WebSocket message normalization. Server tests should verify that only admin players can publish map update notifications. A build check should verify that the new editor entry compiles with the existing Vite setup.
