import { normalizeEditableMapLayout, type EditableMapLayout } from './mapLayout.js';

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
