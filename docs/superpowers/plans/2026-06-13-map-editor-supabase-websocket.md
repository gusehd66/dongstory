# Map Editor Supabase WebSocket Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a separate web map editor that saves platform and object placement to Supabase and pushes live map update notifications through the existing WebSocket server.

**Architecture:** Supabase stores the active map JSON. The editor loads, edits, validates, and saves that JSON, then sends a WebSocket publish message. Connected game clients receive `map:updated`, reload the active layout from Supabase, and rebuild their platforms and objects while keeping multiplayer sessions alive.

**Tech Stack:** Vite, TypeScript, Phaser, Node HTTP/WebSocket server using `ws`, Supabase REST API via `fetch`, Node built-in test runner.

---

## File Structure

- Create `src/mapLayout.ts`: shared map data types, runtime validation, default generated map creation, and helpers that convert saved layout data into the existing platform/object definitions.
- Create `src/mapLayoutSource.ts`: Supabase REST helpers for loading and saving the active `map_layouts` row from the browser.
- Create `src/mapEditor.ts`: standalone editor entry that renders a Phaser-based editable world preview and DOM controls.
- Create `editor.html`: Vite entry for the separate editor screen.
- Modify `src/main.ts`: load active map data before game creation, use saved platforms/objects when present, and reload map data on `map:updated`.
- Modify `src/multiplayerClient.ts`: normalize map update messages and expose `sendMapPublish`.
- Modify `server/multiplayer-server.mjs`: accept `map:publish` only after an admin joins, then broadcast `map:updated`.
- Create `tests/mapLayout.test.mjs`: validation and fallback tests.
- Modify `tests/multiplayerClient.test.mjs`: client message helper tests for map update messages.
- Modify `tests/multiplayerRoom.test.mjs` or create `tests/mapPublishServer.test.mjs`: pure admin publish authorization helper tests if server logic is extracted.
- Modify `package.json`: include new tests in `npm test` if a new test file is created.
- Create `docs/supabase-map-layouts.sql`: SQL schema and RLS policy notes for `map_layouts`.

---

### Task 1: Shared Map Layout Model

**Files:**
- Create: `src/mapLayout.ts`
- Create: `tests/mapLayout.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing validation tests**

Create `tests/mapLayout.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDefaultEditableMapLayout,
  normalizeEditableMapLayout,
} from '../dist-test/mapLayout.js';

test('normalizeEditableMapLayout keeps valid platforms and story objects', () => {
  const layout = normalizeEditableMapLayout({
    version: 7,
    platforms: [
      { id: 'platform-1', x: 360, y: 1200, texture: 'platform' },
      { id: 'bad-platform', x: 'bad', y: 100, texture: 'platform' },
    ],
    storyObjects: [
      { id: 'story-object-1', x: 360, y: 1140, label: '준비중', title: '첫 사진' },
    ],
    dialogues: [
      { id: 'dialogue-1', x: 420, y: 1090, speaker: '슈가', message: '안녕' },
    ],
    chairs: [
      {
        id: 'chair-1',
        x: 600,
        y: 1000,
        facing: 'left',
        seatX: 604,
        seatY: 984,
        triggerDistance: 82,
      },
    ],
  });

  assert.equal(layout.version, 7);
  assert.deepEqual(layout.platforms, [
    { id: 'platform-1', x: 360, y: 1200, texture: 'platform' },
  ]);
  assert.equal(layout.storyObjects[0].title, '첫 사진');
  assert.equal(layout.dialogues[0].speaker, '슈가');
  assert.equal(layout.chairs[0].facing, 'left');
});

test('normalizeEditableMapLayout returns undefined for non-object input', () => {
  assert.equal(normalizeEditableMapLayout(null), undefined);
  assert.equal(normalizeEditableMapLayout('bad'), undefined);
});

test('createDefaultEditableMapLayout creates editable platform ids', () => {
  const layout = createDefaultEditableMapLayout({
    floorCount: 3,
    leftX: 360,
    rightX: 600,
    bottomY: 2000,
    verticalGap: 126,
  });

  assert.equal(layout.version, 1);
  assert.deepEqual(layout.platforms.map((platform) => platform.id), [
    'platform-0',
    'platform-1',
    'platform-2',
  ]);
  assert.deepEqual(layout.platforms.map((platform) => platform.x), [360, 600, 360]);
});
```

- [ ] **Step 2: Add the test file to `npm test`**

Modify `package.json` so the `test` script includes `tests/mapLayout.test.mjs` after the TypeScript compile:

```json
"test": "tsc -p tsconfig.test.json && node --test tests/mapLayout.test.mjs tests/platformLayout.test.mjs tests/multiplayerRoom.test.mjs tests/multiplayerClient.test.mjs tests/staticFileResponder.test.mjs tests/snapshotBroadcaster.test.mjs"
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`

Expected: FAIL with an import error for `../dist-test/mapLayout.js`.

- [ ] **Step 4: Implement `src/mapLayout.ts`**

Create `src/mapLayout.ts`:

```ts
import { createZigzagPlatformDefinitions, type PlatformDefinition, type StoryDialogueDefinition, type StoryObjectDefinition } from './platformLayout';

export type EditablePlatformDefinition = PlatformDefinition & {
  id: string;
};

export type EditableChairDefinition = {
  id: string;
  x: number;
  y: number;
  facing: 'left' | 'right';
  seatX: number;
  seatY: number;
  triggerDistance: number;
};

export type EditableMapLayout = {
  version: number;
  platforms: EditablePlatformDefinition[];
  storyObjects: StoryObjectDefinition[];
  dialogues: StoryDialogueDefinition[];
  chairs: EditableChairDefinition[];
};

export type DefaultEditableMapOptions = {
  floorCount: number;
  leftX: number;
  rightX: number;
  bottomY: number;
  verticalGap: number;
};

export function createDefaultEditableMapLayout(options: DefaultEditableMapOptions): EditableMapLayout {
  return {
    version: 1,
    platforms: createZigzagPlatformDefinitions(options).map((platform, index) => ({
      id: `platform-${index}`,
      ...platform,
    })),
    storyObjects: [],
    dialogues: [],
    chairs: [],
  };
}

export function normalizeEditableMapLayout(value: unknown): EditableMapLayout | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    version: finiteNumber(value.version) ?? Date.now(),
    platforms: Array.isArray(value.platforms) ? value.platforms.flatMap(normalizePlatform) : [],
    storyObjects: Array.isArray(value.storyObjects) ? value.storyObjects.flatMap(normalizeStoryObject) : [],
    dialogues: Array.isArray(value.dialogues) ? value.dialogues.flatMap(normalizeDialogue) : [],
    chairs: Array.isArray(value.chairs) ? value.chairs.flatMap(normalizeChair) : [],
  };
}

function normalizePlatform(value: unknown): EditablePlatformDefinition[] {
  if (!isRecord(value)) {
    return [];
  }

  const id = stringValue(value.id);
  const x = finiteNumber(value.x);
  const y = finiteNumber(value.y);
  const texture = value.texture === 'platform-small' ? 'platform-small' : value.texture === 'platform' ? 'platform' : undefined;

  return id && x !== undefined && y !== undefined && texture ? [{ id, x, y, texture }] : [];
}

function normalizeStoryObject(value: unknown): StoryObjectDefinition[] {
  if (!isRecord(value)) {
    return [];
  }

  const id = stringValue(value.id);
  const x = finiteNumber(value.x);
  const y = finiteNumber(value.y);
  const label = stringValue(value.label);

  if (!id || x === undefined || y === undefined || !label) {
    return [];
  }

  return [{
    id,
    x,
    y,
    label,
    ...optionalStringFields(value, ['title', 'description', 'photoUrl', 'thumbUrl']),
  }];
}

function normalizeDialogue(value: unknown): StoryDialogueDefinition[] {
  if (!isRecord(value)) {
    return [];
  }

  const id = stringValue(value.id);
  const x = finiteNumber(value.x);
  const y = finiteNumber(value.y);
  const speaker = stringValue(value.speaker);
  const message = stringValue(value.message);

  return id && x !== undefined && y !== undefined && speaker && message
    ? [{ id, x, y, speaker, message }]
    : [];
}

function normalizeChair(value: unknown): EditableChairDefinition[] {
  if (!isRecord(value)) {
    return [];
  }

  const id = stringValue(value.id);
  const x = finiteNumber(value.x);
  const y = finiteNumber(value.y);
  const seatX = finiteNumber(value.seatX);
  const seatY = finiteNumber(value.seatY);
  const triggerDistance = finiteNumber(value.triggerDistance);
  const facing = value.facing === 'left' ? 'left' : value.facing === 'right' ? 'right' : undefined;

  return id && x !== undefined && y !== undefined && seatX !== undefined && seatY !== undefined && triggerDistance !== undefined && facing
    ? [{ id, x, y, facing, seatX, seatY, triggerDistance }]
    : [];
}

function optionalStringFields<T extends string>(value: Record<string, unknown>, keys: T[]): Partial<Record<T, string>> {
  return keys.reduce<Partial<Record<T, string>>>((fields, key) => {
    const fieldValue = stringValue(value[key]);

    if (fieldValue) {
      fields[key] = fieldValue;
    }

    return fields;
  }, {});
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`

Expected: PASS for `tests/mapLayout.test.mjs`; unrelated existing tests should keep their previous status.

- [ ] **Step 6: Commit**

```bash
git add package.json src/mapLayout.ts tests/mapLayout.test.mjs
git commit -m "feat: add editable map layout model"
```

---

### Task 2: Supabase Map Layout Source

**Files:**
- Create: `src/mapLayoutSource.ts`
- Create: `docs/supabase-map-layouts.sql`
- Modify: `tests/mapLayout.test.mjs`

- [ ] **Step 1: Add failing Supabase response normalization tests**

Append to `tests/mapLayout.test.mjs`:

```js
import { normalizeMapLayoutRow } from '../dist-test/mapLayoutSource.js';

test('normalizeMapLayoutRow extracts active layout metadata', () => {
  const row = normalizeMapLayoutRow({
    id: '11111111-1111-1111-1111-111111111111',
    version: 12,
    layout: {
      version: 12,
      platforms: [{ id: 'platform-1', x: 10, y: 20, texture: 'platform' }],
      storyObjects: [],
      dialogues: [],
      chairs: [],
    },
  });

  assert.equal(row?.id, '11111111-1111-1111-1111-111111111111');
  assert.equal(row?.layout.version, 12);
});

test('normalizeMapLayoutRow rejects rows without valid layout JSON', () => {
  assert.equal(normalizeMapLayoutRow({ id: 'x', version: 1, layout: null }), undefined);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL with an import error for `../dist-test/mapLayoutSource.js`.

- [ ] **Step 3: Implement browser Supabase helpers**

Create `src/mapLayoutSource.ts`:

```ts
import { normalizeEditableMapLayout, type EditableMapLayout } from './mapLayout';

export type MapLayoutRow = {
  id: string;
  version: number;
  layout: EditableMapLayout;
};

export type MapLayoutSourceConfig = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  fetcher?: typeof fetch;
};

const TABLE_NAME = 'map_layouts';

export function getMapLayoutSourceConfig(): MapLayoutSourceConfig {
  return {
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  };
}

export async function loadActiveMapLayout(config = getMapLayoutSourceConfig()): Promise<MapLayoutRow | undefined> {
  const request = createSupabaseRequest(config, `${TABLE_NAME}?select=id,version,layout&is_active=eq.true&order=updated_at.desc&limit=1`);

  if (!request) {
    return undefined;
  }

  const response = await request.fetcher(request.url, { headers: request.headers });

  if (!response.ok) {
    throw new Error(`Failed to load active map layout: ${response.status}`);
  }

  const rows = await response.json();
  return Array.isArray(rows) ? normalizeMapLayoutRow(rows[0]) : undefined;
}

export async function saveActiveMapLayout(layout: EditableMapLayout, config = getMapLayoutSourceConfig()): Promise<MapLayoutRow> {
  const versionedLayout = { ...layout, version: Date.now() };
  const request = createSupabaseRequest(config, TABLE_NAME);

  if (!request) {
    throw new Error('Supabase map layout config is missing');
  }

  const response = await request.fetcher(request.url, {
    method: 'POST',
    headers: {
      ...request.headers,
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify({
      name: 'active',
      is_active: true,
      version: versionedLayout.version,
      layout: versionedLayout,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to save active map layout: ${response.status}`);
  }

  const rows = await response.json();
  const row = Array.isArray(rows) ? normalizeMapLayoutRow(rows[0]) : undefined;

  if (!row) {
    throw new Error('Saved map layout response was invalid');
  }

  return row;
}

export function normalizeMapLayoutRow(value: unknown): MapLayoutRow | undefined {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return undefined;
  }

  const layout = normalizeEditableMapLayout(value.layout);
  const version = typeof value.version === 'number' && Number.isFinite(value.version)
    ? value.version
    : layout?.version;

  return layout && version !== undefined
    ? { id: value.id, version, layout: { ...layout, version } }
    : undefined;
}

function createSupabaseRequest({ supabaseUrl, supabaseAnonKey, fetcher = fetch }: MapLayoutSourceConfig, path: string) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return undefined;
  }

  return {
    fetcher,
    url: `${supabaseUrl.replace(/\/$/, '')}/rest/v1/${path}`,
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
```

- [ ] **Step 4: Add Supabase SQL setup doc**

Create `docs/supabase-map-layouts.sql`:

```sql
create table if not exists public.map_layouts (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'active',
  is_active boolean not null default false,
  version bigint not null,
  layout jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists map_layouts_one_active
  on public.map_layouts (is_active)
  where is_active = true;

create or replace function public.set_map_layouts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_map_layouts_updated_at on public.map_layouts;

create trigger set_map_layouts_updated_at
before update on public.map_layouts
for each row
execute function public.set_map_layouts_updated_at();

alter table public.map_layouts enable row level security;

create policy "Public can read active map layouts"
on public.map_layouts
for select
using (is_active = true);

-- For production, create a stricter write policy tied to authenticated admins.
-- During local development, use the Supabase dashboard or a temporary admin-only policy for editor saves.
```

- [ ] **Step 5: Run tests**

Run: `npm test`

Expected: PASS for map layout source normalization.

- [ ] **Step 6: Commit**

```bash
git add docs/supabase-map-layouts.sql src/mapLayoutSource.ts tests/mapLayout.test.mjs
git commit -m "feat: add supabase map layout source"
```

---

### Task 3: WebSocket Map Update Messages

**Files:**
- Modify: `src/multiplayerClient.ts`
- Modify: `server/multiplayerRoom.mjs`
- Modify: `server/multiplayer-server.mjs`
- Modify: `tests/multiplayerClient.test.mjs`
- Modify: `tests/multiplayerRoom.test.mjs`

- [ ] **Step 1: Add failing client message tests**

Append to `tests/multiplayerClient.test.mjs`:

```js
import {
  normalizeMapUpdatedMessage,
} from '../dist-test/multiplayerClient.js';

test('normalizeMapUpdatedMessage accepts numeric version', () => {
  assert.deepEqual(normalizeMapUpdatedMessage({ type: 'map:updated', version: 123 }), {
    type: 'map:updated',
    version: 123,
  });
});

test('normalizeMapUpdatedMessage rejects invalid messages', () => {
  assert.equal(normalizeMapUpdatedMessage({ type: 'map:updated', version: 'bad' }), undefined);
  assert.equal(normalizeMapUpdatedMessage({ type: 'chat:message', version: 1 }), undefined);
});
```

- [ ] **Step 2: Add failing room authorization tests**

Append to `tests/multiplayerRoom.test.mjs`:

```js
test('canPublishMapUpdate allows admins only', () => {
  const room = createMultiplayerRoom({ adminJoinCode: 'secret' });
  const admin = room.join('Admin', 'secret').player;
  const guest = room.join('Guest').player;

  assert.equal(room.canPublishMapUpdate(admin.id), true);
  assert.equal(room.canPublishMapUpdate(guest.id), false);
  assert.equal(room.canPublishMapUpdate('missing'), false);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`

Expected: FAIL because `normalizeMapUpdatedMessage` and `canPublishMapUpdate` do not exist.

- [ ] **Step 4: Extend `src/multiplayerClient.ts`**

Add these types and options near existing multiplayer types:

```ts
export type MapUpdatedMessage = {
  type: 'map:updated';
  version: number;
};
```

Add to `MultiplayerConnection`:

```ts
  sendMapPublish: (version: number) => boolean;
```

Add to `MultiplayerConnectionOptions`:

```ts
  onMapUpdated?: (message: MapUpdatedMessage) => void;
```

Add `onMapUpdated` to the destructured options in `createMultiplayerConnection`.

Inside the `message` event, before notice handling:

```ts
      const mapUpdatedMessage = normalizeMapUpdatedMessage(message);

      if (mapUpdatedMessage) {
        onMapUpdated?.(mapUpdatedMessage);
        return;
      }
```

Add to the returned connection object:

```ts
    sendMapPublish(version) {
      if (!Number.isFinite(version) || socket?.readyState !== WebSocket.OPEN) {
        return false;
      }

      socket.send(JSON.stringify({ type: 'map:publish', version }));
      return true;
    },
```

Export this helper:

```ts
export function normalizeMapUpdatedMessage(value: unknown): MapUpdatedMessage | undefined {
  if (!isRecord(value) || value.type !== 'map:updated' || typeof value.version !== 'number' || !Number.isFinite(value.version)) {
    return undefined;
  }

  return {
    type: 'map:updated',
    version: value.version,
  };
}
```

- [ ] **Step 5: Extend room admin helper**

Add this function inside `createMultiplayerRoom` in `server/multiplayerRoom.mjs`:

```js
  function canPublishMapUpdate(actorId) {
    const actor = players.get(actorId);

    return actor?.role === 'admin';
  }
```

Return it:

```js
    canPublishMapUpdate,
```

- [ ] **Step 6: Broadcast map updates from the server**

In `server/multiplayer-server.mjs`, add this branch inside the `message` handler after chat handling:

```js
    if (message.type === 'map:publish' && playerId) {
      if (!room.canPublishMapUpdate(playerId)) {
        return;
      }

      const version = finiteNumber(message.version);

      if (version === undefined) {
        return;
      }

      sendToOpenSockets(JSON.stringify({ type: 'map:updated', version }));
    }
```

Add helper near `normalizeChatText`:

```js
function finiteNumber(value) {
  return Number.isFinite(value) ? value : undefined;
}
```

- [ ] **Step 7: Run tests**

Run: `npm test`

Expected: PASS for multiplayer client and room tests.

- [ ] **Step 8: Commit**

```bash
git add src/multiplayerClient.ts server/multiplayerRoom.mjs server/multiplayer-server.mjs tests/multiplayerClient.test.mjs tests/multiplayerRoom.test.mjs
git commit -m "feat: broadcast map update notifications"
```

---

### Task 4: Game Loads Saved Map Layout

**Files:**
- Modify: `src/main.ts`
- Modify: `src/mapLayout.ts`
- Modify: `tests/mapLayout.test.mjs`

- [ ] **Step 1: Add conversion tests**

Append to `tests/mapLayout.test.mjs`:

```js
import { toPlatformDefinitions } from '../dist-test/mapLayout.js';

test('toPlatformDefinitions removes editor ids for game physics', () => {
  assert.deepEqual(
    toPlatformDefinitions({
      version: 1,
      platforms: [{ id: 'platform-1', x: 12, y: 34, texture: 'platform' }],
      storyObjects: [],
      dialogues: [],
      chairs: [],
    }),
    [{ x: 12, y: 34, texture: 'platform' }],
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL because `toPlatformDefinitions` does not exist.

- [ ] **Step 3: Add conversion helper**

Append to `src/mapLayout.ts`:

```ts
export function toPlatformDefinitions(layout: EditableMapLayout): PlatformDefinition[] {
  return layout.platforms.map(({ x, y, texture }) => ({ x, y, texture }));
}
```

- [ ] **Step 4: Refactor map constants in `src/main.ts`**

Import:

```ts
import {
  createDefaultEditableMapLayout,
  toPlatformDefinitions,
  type EditableMapLayout,
} from './mapLayout';
import { loadActiveMapLayout } from './mapLayoutSource';
```

Replace the direct `PLATFORM_DEFINITIONS` creation with a mutable map state:

```ts
const DEFAULT_EDITABLE_MAP_LAYOUT = createDefaultEditableMapLayout({
  floorCount: PLATFORM_FLOOR_COUNT,
  leftX: 360,
  rightX: 600,
  bottomY: FIRST_PLATFORM_Y,
  verticalGap: PLATFORM_VERTICAL_GAP,
});
const ACTIVE_MAP_LAYOUT = await loadActiveMapLayoutSafely(DEFAULT_EDITABLE_MAP_LAYOUT);
let activeMapLayout: EditableMapLayout = ACTIVE_MAP_LAYOUT;
let PLATFORM_DEFINITIONS = toPlatformDefinitions(activeMapLayout);
```

Create story objects from saved layout first:

```ts
let STORY_OBJECT_DEFINITIONS = activeMapLayout.storyObjects.length > 0
  ? activeMapLayout.storyObjects
  : createPlatformObjectDefinitions(PLATFORM_DEFINITIONS, {
      yOffset: STORY_OBJECT_Y_OFFSET,
      label: STORY_OBJECT_LABEL,
      photoUrls: SUPABASE_STORY_PHOTOS.length > 0 ? [] : STORY_PHOTO_URLS,
      storyPhotos: SUPABASE_STORY_PHOTOS,
      reservedFloors: [...STORY_DIALOGUE_FLOORS, DONG_CHAIR_PLATFORM_INDEX + 1],
    });
let STORY_OBJECT_DEFINITIONS_BY_PLATFORM_INDEX = new Map(
  STORY_OBJECT_DEFINITIONS.map((definition) => [
    Number.parseInt(definition.id.replace('story-object-', ''), 10),
    definition,
  ]),
);
```

Create dialogues from saved layout first:

```ts
let STORY_DIALOGUE_DEFINITIONS = activeMapLayout.dialogues.length > 0
  ? activeMapLayout.dialogues
  : createPlatformDialogueDefinitions(PLATFORM_DEFINITIONS, {
      xOffset: STORY_DIALOGUE_X_OFFSET,
      yOffset: STORY_DIALOGUE_Y_OFFSET,
      floors: STORY_DIALOGUE_FLOORS,
      lines: STORY_DIALOGUE_LINES,
      storyDialogues: SUPABASE_STORY_DIALOGUES,
    });
let STORY_DIALOGUE_DEFINITIONS_BY_PLATFORM_INDEX = new Map(
  STORY_DIALOGUE_DEFINITIONS.map((definition) => [
    Number.parseInt(definition.id.replace('dialogue-object-', ''), 10),
    definition,
  ]),
);
```

Add a loader helper near existing Supabase helpers:

```ts
async function loadActiveMapLayoutSafely(fallback: EditableMapLayout): Promise<EditableMapLayout> {
  try {
    return (await loadActiveMapLayout())?.layout ?? fallback;
  } catch (error) {
    console.warn(error);
    return fallback;
  }
}
```

- [ ] **Step 5: Add live reload method in `MainScene`**

In `connectMultiplayer`, pass:

```ts
      onMapUpdated: () => {
        void this.reloadActiveMapLayout();
      },
```

Add method to `MainScene`:

```ts
  private async reloadActiveMapLayout() {
    const nextLayout = await loadActiveMapLayoutSafely(activeMapLayout);

    activeMapLayout = nextLayout;
    PLATFORM_DEFINITIONS = toPlatformDefinitions(nextLayout);
    STORY_OBJECT_DEFINITIONS = nextLayout.storyObjects;
    STORY_OBJECT_DEFINITIONS_BY_PLATFORM_INDEX = new Map(
      STORY_OBJECT_DEFINITIONS.map((definition) => [
        Number.parseInt(definition.id.replace('story-object-', ''), 10),
        definition,
      ]),
    );
    STORY_DIALOGUE_DEFINITIONS = nextLayout.dialogues;
    STORY_DIALOGUE_DEFINITIONS_BY_PLATFORM_INDEX = new Map(
      STORY_DIALOGUE_DEFINITIONS.map((definition) => [
        Number.parseInt(definition.id.replace('dialogue-object-', ''), 10),
        definition,
      ]),
    );

    this.activePlatformViews.forEach((_, index) => this.destroyPlatform(index));
    this.updateActiveFloors(0, this.player.y);
  }
```

If TypeScript complains about `const` maps, convert the relevant top-level `const` declarations to `let`.

- [ ] **Step 6: Run build and tests**

Run: `npm test`

Expected: PASS.

Run: `npm run build`

Expected: PASS and Vite emits the app bundle.

- [ ] **Step 7: Commit**

```bash
git add src/main.ts src/mapLayout.ts tests/mapLayout.test.mjs
git commit -m "feat: load saved map layouts in game"
```

---

### Task 5: Separate Editor Screen

**Files:**
- Create: `editor.html`
- Create: `src/mapEditor.ts`
- Modify: `src/style.css`
- Modify: `package.json` only if Vite needs explicit multi-entry config after testing

- [ ] **Step 1: Create editor HTML entry**

Create `editor.html`:

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Dongstory Map Editor</title>
  </head>
  <body>
    <div id="editor-shell" class="editor-shell">
      <aside class="editor-panel" aria-label="Map editor tools">
        <header class="editor-panel__header">
          <h1>Map Editor</h1>
          <p id="editor-status">불러오는 중</p>
        </header>
        <div class="editor-tools" role="toolbar" aria-label="Place tools">
          <button id="tool-select" class="editor-tools__button is-active" type="button">Select</button>
          <button id="tool-platform" class="editor-tools__button" type="button">Platform</button>
          <button id="tool-object" class="editor-tools__button" type="button">Object</button>
        </div>
        <form id="editor-form" class="editor-form">
          <label>
            Label
            <input id="editor-label" type="text" maxlength="40" value="준비중" />
          </label>
          <label>
            Title
            <input id="editor-title" type="text" maxlength="80" />
          </label>
          <label>
            Description
            <textarea id="editor-description" rows="5"></textarea>
          </label>
        </form>
        <div class="editor-actions">
          <button id="delete-selected" type="button">Delete</button>
          <button id="save-map" type="button">Save</button>
        </div>
      </aside>
      <main id="editor-canvas" class="editor-canvas" aria-label="Editable map preview"></main>
    </div>
    <script type="module" src="/src/mapEditor.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Implement editor**

Create `src/mapEditor.ts`:

```ts
import Phaser from 'phaser';
import './style.css';
import { createDefaultEditableMapLayout, type EditableMapLayout } from './mapLayout';
import { loadActiveMapLayout, saveActiveMapLayout } from './mapLayoutSource';
import { createMultiplayerConnection, getAdminJoinCode } from './multiplayerClient';

const GAME_WIDTH = 1200;
const GAME_HEIGHT = 676;
const WORLD_HEIGHT = 10419;
const FIRST_PLATFORM_Y = WORLD_HEIGHT - 145;
const DEFAULT_LAYOUT = createDefaultEditableMapLayout({
  floorCount: 80,
  leftX: 360,
  rightX: 600,
  bottomY: FIRST_PLATFORM_Y,
  verticalGap: 126,
});

type EditorTool = 'select' | 'platform' | 'object';

let layout: EditableMapLayout = DEFAULT_LAYOUT;
let selectedId: string | undefined;
let activeTool: EditorTool = 'select';

const status = document.querySelector<HTMLElement>('#editor-status');
const labelInput = document.querySelector<HTMLInputElement>('#editor-label');
const titleInput = document.querySelector<HTMLInputElement>('#editor-title');
const descriptionInput = document.querySelector<HTMLTextAreaElement>('#editor-description');
const connection = createMultiplayerConnection({
  adminCode: getAdminJoinCode(new URL(window.location.href)),
  name: 'Map Editor',
  onSnapshot: () => undefined,
});

class EditorScene extends Phaser.Scene {
  private graphics!: Phaser.GameObjects.Graphics;

  constructor() {
    super('EditorScene');
  }

  create() {
    this.cameras.main.setBounds(0, 0, GAME_WIDTH, WORLD_HEIGHT);
    this.cameras.main.scrollY = WORLD_HEIGHT - GAME_HEIGHT;
    this.graphics = this.add.graphics();
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.handlePointer(pointer));
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objects: unknown[], _dx: number, dy: number) => {
      this.cameras.main.scrollY = Phaser.Math.Clamp(this.cameras.main.scrollY + dy, 0, WORLD_HEIGHT - GAME_HEIGHT);
      this.renderLayout();
    });
    this.renderLayout();
  }

  private handlePointer(pointer: Phaser.Input.Pointer) {
    const worldPoint = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;

    if (activeTool === 'platform') {
      layout = {
        ...layout,
        platforms: [
          ...layout.platforms,
          { id: `platform-${crypto.randomUUID()}`, x: Math.round(worldPoint.x), y: Math.round(worldPoint.y), texture: 'platform' },
        ],
      };
      this.renderLayout();
      return;
    }

    if (activeTool === 'object') {
      const object = {
        id: `story-object-${crypto.randomUUID()}`,
        x: Math.round(worldPoint.x),
        y: Math.round(worldPoint.y),
        label: labelInput?.value.trim() || '준비중',
        title: titleInput?.value.trim() || undefined,
        description: descriptionInput?.value.trim() || undefined,
      };
      layout = { ...layout, storyObjects: [...layout.storyObjects, object] };
      selectedId = object.id;
      this.renderLayout();
      return;
    }

    selectedId = findNearestItem(worldPoint.x, worldPoint.y);
    this.syncForm();
    this.renderLayout();
  }

  private syncForm() {
    const object = layout.storyObjects.find((item) => item.id === selectedId);

    if (labelInput) {
      labelInput.value = object?.label ?? '준비중';
    }

    if (titleInput) {
      titleInput.value = object?.title ?? '';
    }

    if (descriptionInput) {
      descriptionInput.value = object?.description ?? '';
    }
  }

  renderLayout() {
    this.graphics.clear();
    this.graphics.fillStyle(0xeaf7ff, 1);
    this.graphics.fillRect(0, 0, GAME_WIDTH, WORLD_HEIGHT);
    this.graphics.lineStyle(1, 0xc9d8e3, 0.6);

    for (let y = 0; y <= WORLD_HEIGHT; y += 126) {
      this.graphics.lineBetween(0, y, GAME_WIDTH, y);
    }

    layout.platforms.forEach((platform) => {
      this.graphics.fillStyle(platform.id === selectedId ? 0xf4d35e : 0x5aa9e6, 1);
      this.graphics.fillRoundedRect(platform.x - 64, platform.y - 9, 128, 18, 6);
    });

    layout.storyObjects.forEach((object) => {
      this.graphics.fillStyle(object.id === selectedId ? 0xf4d35e : 0xf25f5c, 1);
      this.graphics.fillCircle(object.x, object.y, 14);
    });
  }
}

await loadInitialLayout();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'editor-canvas',
  backgroundColor: '#eaf7ff',
  scene: EditorScene,
});

connectToolbar();

async function loadInitialLayout() {
  try {
    layout = (await loadActiveMapLayout())?.layout ?? DEFAULT_LAYOUT;
    setStatus('준비됨');
  } catch (error) {
    console.warn(error);
    layout = DEFAULT_LAYOUT;
    setStatus('Supabase 연결 실패, 기본 맵 사용 중');
  }
}

function connectToolbar() {
  bindTool('tool-select', 'select');
  bindTool('tool-platform', 'platform');
  bindTool('tool-object', 'object');

  document.querySelector<HTMLButtonElement>('#delete-selected')?.addEventListener('click', () => {
    if (!selectedId) {
      return;
    }

    layout = {
      ...layout,
      platforms: layout.platforms.filter((platform) => platform.id !== selectedId),
      storyObjects: layout.storyObjects.filter((object) => object.id !== selectedId),
    };
    selectedId = undefined;
    getEditorScene()?.renderLayout();
  });

  document.querySelector<HTMLButtonElement>('#save-map')?.addEventListener('click', () => {
    void saveMap();
  });
}

function bindTool(buttonId: string, tool: EditorTool) {
  document.querySelector<HTMLButtonElement>(`#${buttonId}`)?.addEventListener('click', () => {
    activeTool = tool;
    document.querySelectorAll('.editor-tools__button').forEach((button) => {
      button.classList.toggle('is-active', button.id === buttonId);
    });
  });
}

async function saveMap() {
  setStatus('저장 중');

  try {
    const saved = await saveActiveMapLayout(layout);
    layout = saved.layout;
    const published = connection?.sendMapPublish(saved.version) ?? false;
    setStatus(published ? '저장됨, 모든 접속자에게 적용 중' : '저장됨, 실시간 알림 연결 없음');
  } catch (error) {
    console.warn(error);
    setStatus('저장 실패');
  }
}

function findNearestItem(x: number, y: number) {
  const platform = layout.platforms.find((item) => Math.abs(item.x - x) <= 72 && Math.abs(item.y - y) <= 24);

  if (platform) {
    return platform.id;
  }

  return layout.storyObjects.find((item) => Math.hypot(item.x - x, item.y - y) <= 24)?.id;
}

function getEditorScene() {
  return game.scene.getScene('EditorScene') as EditorScene | undefined;
}

function setStatus(message: string) {
  if (status) {
    status.textContent = message;
  }
}
```

- [ ] **Step 3: Add editor styles**

Append to `src/style.css`:

```css
.editor-shell {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  min-height: 100vh;
  background: #f5f7fb;
  color: #18202a;
  font-family: system-ui, Segoe UI, sans-serif;
}

.editor-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px;
  border-right: 1px solid #d8e0ea;
  background: #ffffff;
}

.editor-panel__header h1 {
  margin: 0;
  font-size: 22px;
}

.editor-panel__header p {
  margin: 6px 0 0;
  color: #526070;
  font-size: 13px;
}

.editor-tools {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.editor-tools__button,
.editor-actions button {
  min-height: 36px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #f8fafc;
  color: #18202a;
  font-weight: 800;
}

.editor-tools__button.is-active {
  background: #1f7a8c;
  border-color: #1f7a8c;
  color: #ffffff;
}

.editor-form {
  display: grid;
  gap: 12px;
}

.editor-form label {
  display: grid;
  gap: 5px;
  color: #526070;
  font-size: 13px;
  font-weight: 700;
}

.editor-form input,
.editor-form textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 8px 10px;
  font: inherit;
}

.editor-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: auto;
}

.editor-canvas {
  min-width: 0;
  overflow: hidden;
}

.editor-canvas canvas {
  display: block;
  width: 100%;
  height: 100vh;
}
```

- [ ] **Step 4: Run build**

Run: `npm run build`

Expected: PASS. If Vite does not include `editor.html`, create `vite.config.ts` with Rollup input for `index.html` and `editor.html`, then rerun.

- [ ] **Step 5: Commit**

```bash
git add editor.html src/mapEditor.ts src/style.css vite.config.ts
git commit -m "feat: add web map editor screen"
```

---

### Task 6: Verification And Manual Flow

**Files:**
- Modify: `docs/superpowers/plans/2026-06-13-map-editor-supabase-websocket.md` checkboxes as tasks complete

- [ ] **Step 1: Run full automated verification**

Run: `npm test`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 2: Start local servers**

Run: `npm run dev:multi`

Expected: the Vite app and WebSocket server start; terminal shows local URLs.

- [ ] **Step 3: Manual editor smoke test**

Open the editor URL from the Vite server, such as `http://localhost:5173/editor.html?admin=<ADMIN_JOIN_CODE>`.

Expected:

- Editor loads without a blank canvas.
- Platform tool places a platform where clicked.
- Object tool places a marker where clicked.
- Save shows either successful Supabase save or a clear Supabase configuration error.

- [ ] **Step 4: Manual live update smoke test**

Open a game client and editor at the same time. Save a changed map in the editor.

Expected:

- Editor sends `map:publish`.
- Game client receives `map:updated`.
- Game client reloads the saved Supabase layout.
- Player remains connected to multiplayer.

- [ ] **Step 5: Commit verification notes if the plan checkboxes were updated**

```bash
git add docs/superpowers/plans/2026-06-13-map-editor-supabase-websocket.md
git commit -m "docs: track map editor implementation progress"
```

---

## Self-Review

- Spec coverage: The plan covers the separate editor, Supabase persistence, WebSocket notification, client reload, admin publish authorization, fallback behavior, error handling, SQL setup, and tests.
- Placeholder scan: The plan uses concrete file paths, functions, message names, commands, and expected results. No empty implementation placeholders remain.
- Type consistency: `EditableMapLayout`, `MapLayoutRow`, `map:publish`, `map:updated`, `version`, and `sendMapPublish` are named consistently across tasks.
