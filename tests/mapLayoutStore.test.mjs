import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createActiveMapLayoutUpsertRequest,
  createMapSaveFailedMessage,
  saveActiveMapLayoutToSupabase,
} from '../server/mapLayoutStore.mjs';

const LAYOUT = {
  version: 1,
  platforms: [{ id: 'platform-1', x: 10, y: 20, texture: 'platform' }],
  storyObjects: [],
  dialogues: [],
  chairs: [],
};

test('createActiveMapLayoutUpsertRequest uses service role credentials', () => {
  const request = createActiveMapLayoutUpsertRequest(LAYOUT, {
    supabaseUrl: 'https://example.supabase.co',
    supabaseServiceRoleKey: 'service-secret',
    now: () => 123,
  });

  assert.equal(request.url, 'https://example.supabase.co/rest/v1/map_layouts?on_conflict=name');
  assert.equal(request.headers.apikey, 'service-secret');
  assert.equal(request.headers.Authorization, 'Bearer service-secret');
  assert.equal(request.headers.Prefer, 'resolution=merge-duplicates,return=representation');
  assert.deepEqual(JSON.parse(request.body), {
    name: 'active',
    is_active: true,
    version: 123,
    layout: { ...LAYOUT, version: 123 },
  });
});

test('saveActiveMapLayoutToSupabase returns saved version', async () => {
  const calls = [];
  const result = await saveActiveMapLayoutToSupabase(LAYOUT, {
    supabaseUrl: 'https://example.supabase.co',
    supabaseServiceRoleKey: 'service-secret',
    now: () => 456,
    fetcher: async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        json: async () => [{ id: 'row-1', version: 456 }],
      };
    },
  });

  assert.equal(result.version, 456);
  assert.equal(calls.length, 1);
});

test('saveActiveMapLayoutToSupabase fails without server credentials', async () => {
  await assert.rejects(
    () => saveActiveMapLayoutToSupabase(LAYOUT, { supabaseUrl: 'https://example.supabase.co' }),
    /Supabase map save config is missing/,
  );
});

test('saveActiveMapLayoutToSupabase includes response body on Supabase failure', async () => {
  await assert.rejects(
    () => saveActiveMapLayoutToSupabase(LAYOUT, {
      supabaseUrl: 'https://example.supabase.co',
      supabaseServiceRoleKey: 'service-secret',
      fetcher: async () => ({
        ok: false,
        status: 404,
        text: async () => '{"message":"Could not find the table public.map_layouts"}',
      }),
    }),
    /Failed to save active map layout: 404 \{"message":"Could not find the table public.map_layouts"\}/,
  );
});

test('createMapSaveFailedMessage serializes a save failure notice', () => {
  assert.equal(
    createMapSaveFailedMessage('Admin privileges required'),
    JSON.stringify({ type: 'map:save-failed', message: 'Admin privileges required' }),
  );
});
