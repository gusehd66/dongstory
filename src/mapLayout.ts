import {
  createZigzagPlatformDefinitions,
  type PlatformDefinition,
  type StoryDialogueDefinition,
  type StoryObjectDefinition,
} from './platformLayout.js';

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

export function toPlatformDefinitions(layout: EditableMapLayout): PlatformDefinition[] {
  return layout.platforms.map(({ x, y, texture }) => ({ x, y, texture }));
}

function normalizePlatform(value: unknown): EditablePlatformDefinition[] {
  if (!isRecord(value)) {
    return [];
  }

  const id = stringValue(value.id);
  const x = finiteNumber(value.x);
  const y = finiteNumber(value.y);
  const texture = value.texture === 'platform-small'
    ? 'platform-small'
    : value.texture === 'platform' ? 'platform' : undefined;

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
