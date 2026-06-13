import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDefaultEditableMapLayout,
  normalizeEditableMapLayout,
  toPlatformDefinitions,
} from '../dist-test/mapLayout.js';
import {
  createActiveMapLayoutSavePath,
  loadActiveMapLayout,
  normalizeMapLayoutRow,
} from '../dist-test/mapLayoutSource.js';

test('normalizeEditableMapLayout keeps valid platforms and story objects', () => {
  const layout = normalizeEditableMapLayout({
    version: 7,
    platforms: [
      { id: 'platform-1', x: 360, y: 1200, texture: 'platform' },
      { id: 'bad-platform', x: 'bad', y: 100, texture: 'platform' },
    ],
    storyObjects: [
      { id: 'story-object-1', x: 360, y: 1140, label: 'Ready', title: 'First photo' },
    ],
    dialogues: [
      { id: 'dialogue-1', x: 420, y: 1090, speaker: 'Sugar', message: 'Hello' },
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
  assert.equal(layout.storyObjects[0].title, 'First photo');
  assert.equal(layout.dialogues[0].speaker, 'Sugar');
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

test('createActiveMapLayoutSavePath saves by active map name conflict', () => {
  assert.equal(createActiveMapLayoutSavePath(), 'map_layouts?on_conflict=name');
});

test('loadActiveMapLayout calls default fetch without rebinding it', async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async function fetchWithGlobalThis(url) {
      assert.equal(this, globalThis);
      assert.equal(
        url,
        'https://example.supabase.co/rest/v1/map_layouts?select=id,version,layout&is_active=eq.true&order=updated_at.desc&limit=1',
      );

      return {
        ok: true,
        json: async () => [],
      };
    };

    assert.equal(await loadActiveMapLayout({
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'anon',
    }), undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

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
