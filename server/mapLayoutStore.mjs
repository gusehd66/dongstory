const TABLE_NAME = 'map_layouts';

export function createActiveMapLayoutUpsertRequest(layout, {
  supabaseUrl,
  supabaseServiceRoleKey,
  now = Date.now,
} = {}) {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Supabase map save config is missing');
  }

  const versionedLayout = { ...layout, version: now() };

  return {
    url: `${supabaseUrl.replace(/\/$/, '')}/rest/v1/${TABLE_NAME}?on_conflict=name`,
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify({
      name: 'active',
      is_active: true,
      version: versionedLayout.version,
      layout: versionedLayout,
    }),
  };
}

export async function saveActiveMapLayoutToSupabase(layout, {
  supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL,
  supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY,
  fetcher = fetch,
  now = Date.now,
} = {}) {
  const request = createActiveMapLayoutUpsertRequest(layout, {
    supabaseUrl,
    supabaseServiceRoleKey,
    now,
  });
  const response = await fetcher(request.url, {
    method: 'POST',
    headers: request.headers,
    body: request.body,
  });

  if (!response.ok) {
    throw new Error(`Failed to save active map layout: ${response.status}`);
  }

  const rows = await response.json();
  const row = Array.isArray(rows) ? rows[0] : undefined;
  const version = Number.isFinite(row?.version) ? row.version : JSON.parse(request.body).version;

  return { version };
}

export function normalizeServerMapLayout(value) {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    version: Number.isFinite(value.version) ? value.version : Date.now(),
    platforms: Array.isArray(value.platforms) ? value.platforms : [],
    storyObjects: Array.isArray(value.storyObjects) ? value.storyObjects : [],
    dialogues: Array.isArray(value.dialogues) ? value.dialogues : [],
    chairs: Array.isArray(value.chairs) ? value.chairs : [],
  };
}

export function createMapSaveFailedMessage(message) {
  return JSON.stringify({ type: 'map:save-failed', message });
}

function isRecord(value) {
  return typeof value === 'object' && value !== null;
}
