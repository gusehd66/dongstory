import {
  createStoryPhotoPublicUrl,
  type StoryDialogueSource,
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

type SupabaseStoryDialogueRow = {
  floor: number;
  sort_order: number | null;
  story_dialogues: {
    speaker: string | null;
    message: string | null;
  }[] | {
    speaker: string | null;
    message: string | null;
  } | null;
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

export async function loadStoryDialoguesFromSupabase(): Promise<StoryDialogueSource[]> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return [];
  }

  const endpoint = new URL('/rest/v1/story_items', SUPABASE_URL);
  endpoint.searchParams.set('select', 'floor,sort_order,story_dialogues(speaker,message)');
  endpoint.searchParams.set('type', 'eq.dialogue');
  endpoint.searchParams.set('enabled', 'eq.true');
  endpoint.searchParams.set('order', 'floor.asc,sort_order.asc');

  const response = await fetch(endpoint, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase story_dialogues request failed: ${response.status}`);
  }

  const rows = await response.json() as SupabaseStoryDialogueRow[];

  return rows.flatMap((row) => {
    const dialogues = Array.isArray(row.story_dialogues)
      ? row.story_dialogues
      : row.story_dialogues
        ? [row.story_dialogues]
        : [];

    return dialogues
      .filter((dialogue) => dialogue.speaker && dialogue.message)
      .map((dialogue) => ({
        floor: row.floor,
        speaker: dialogue.speaker!,
        message: dialogue.message!,
      }));
  });
}
