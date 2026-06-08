import {
  createStoryPhotoPublicUrl,
  type StoryPhotoDefinition,
} from './platformLayout';

type SupabaseStoryPhotoRow = {
  floor: number;
  object_id: string;
  title: string | null;
  description: string | null;
  detail_path: string | null;
  thumb_path: string | null;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const SUPABASE_STORY_BUCKET = (import.meta.env.VITE_SUPABASE_STORY_BUCKET as string | undefined) ?? 'story-photos';

export async function loadStoryPhotosFromSupabase(): Promise<StoryPhotoDefinition[]> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return [];
  }

  const endpoint = new URL('/rest/v1/story_photos', SUPABASE_URL);
  endpoint.searchParams.set('select', 'floor,object_id,title,description,detail_path,thumb_path');
  endpoint.searchParams.set('order', 'sort_order.asc');

  const response = await fetch(endpoint, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase story_photos request failed: ${response.status}`);
  }

  const rows = await response.json() as SupabaseStoryPhotoRow[];

  return rows.map((row) => ({
    floor: row.floor,
    objectId: row.object_id,
    title: row.title ?? undefined,
    description: row.description ?? undefined,
    detailUrl: createStoryPhotoPublicUrl(SUPABASE_URL, SUPABASE_STORY_BUCKET, row.detail_path),
    thumbUrl: createStoryPhotoPublicUrl(SUPABASE_URL, SUPABASE_STORY_BUCKET, row.thumb_path),
  }));
}
