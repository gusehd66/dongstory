export type PlatformTexture = 'platform' | 'platform-small';

export type PlatformDefinition = {
  x: number;
  y: number;
  texture: PlatformTexture;
};

export type StoryObjectDefinition = {
  id: string;
  x: number;
  y: number;
  label: string;
  title?: string;
  description?: string;
  photoUrl?: string;
  thumbUrl?: string;
};

export type StoryObjectDetail = {
  title: string;
  label: string;
  description?: string;
  photoUrl?: string;
  thumbUrl?: string;
  isReady: boolean;
};

export type StoryPhotoDefinition = {
  floor: number;
  objectId: string;
  title?: string;
  description?: string;
  detailUrl?: string;
  thumbUrl?: string;
};

export type StoryDialogueLine = {
  speaker: string;
  message: string;
};

export type StoryDialogueSource = StoryDialogueLine & {
  floor: number;
};

export type StoryDialogueDefinition = StoryDialogueLine & {
  id: string;
  x: number;
  y: number;
};

export type ChairDefinition = {
  id: string;
  platformIndex: number;
  facing: 'left' | 'right';
  x: number;
  y: number;
  seatX: number;
  seatY: number;
  triggerDistance: number;
};

export type ZigzagPlatformOptions = {
  floorCount: number;
  leftX: number;
  rightX: number;
  bottomY: number;
  verticalGap: number;
};

export type PlatformObjectOptions = {
  yOffset: number;
  label: string;
  photoUrls?: string[];
  storyPhotos?: StoryPhotoDefinition[];
  reservedFloors?: number[];
};

export type PlatformDialogueOptions = {
  xOffset: number;
  yOffset: number;
  lines?: StoryDialogueLine[];
  floors?: number[];
  storyDialogues?: StoryDialogueSource[];
};

export type ChairDefinitionOptions = {
  id: string;
  platformIndex: number;
  facing: 'left' | 'right';
  xOffset: number;
  yOffset: number;
  seatXOffset: number;
  seatYOffset: number;
  triggerDistance: number;
};

export type Point = {
  x: number;
  y: number;
};

export type FloorDetectionOptions = {
  groundSurfaceY: number;
  platformColliderYOffset: number;
  platformColliderHalfHeight: number;
  tolerance: number;
};

export type FloorTargetOptions = {
  groundX: number;
  groundSurfaceY: number;
  platformColliderYOffset: number;
  platformColliderHalfHeight: number;
  playerHalfHeight: number;
};

export type ActivePlatformOptions = {
  cameraTopY: number;
  cameraHeight: number;
  aboveBufferY: number;
  belowBufferY: number;
  fallingVelocityY?: number;
  fallingLookaheadSeconds?: number;
  focusY?: number;
};

export function createZigzagPlatformDefinitions({
  floorCount,
  leftX,
  rightX,
  bottomY,
  verticalGap,
}: ZigzagPlatformOptions): PlatformDefinition[] {
  return Array.from({ length: floorCount }, (_, index) => ({
    x: index % 2 === 0 ? leftX : rightX,
    y: bottomY - index * verticalGap,
    texture: 'platform',
  }));
}

export function getPlatformVisualVariant(platformIndex: number, variantCount: number): number {
  if (variantCount <= 0) {
    return 0;
  }

  return Math.abs(platformIndex) % variantCount;
}

export function createPlatformObjectDefinitions(
  platforms: PlatformDefinition[],
  { yOffset, label, photoUrls = [], storyPhotos = [], reservedFloors = [] }: PlatformObjectOptions,
): StoryObjectDefinition[] {
  const reservedFloorSet = new Set(reservedFloors);
  const occupiedIndexes = new Set(reservedFloors.map((floor) => floor - 1));
  const storyPhotosByIndex = new Map<number, StoryPhotoDefinition>();
  const photoUrlsByIndex = new Map<number, string>();

  [...storyPhotos]
    .sort((first, second) => first.floor - second.floor)
    .forEach((storyPhoto) => {
      const assignedIndex = findNextOpenPlatformIndex(
        platforms.length,
        Math.max(0, storyPhoto.floor - 1),
        occupiedIndexes,
      );

      if (assignedIndex !== undefined) {
        storyPhotosByIndex.set(assignedIndex, storyPhoto);
        occupiedIndexes.add(assignedIndex);
      }
    });

  photoUrls.forEach((photoUrl, index) => {
    const assignedIndex = findNextOpenPlatformIndex(platforms.length, index, occupiedIndexes);

    if (assignedIndex !== undefined) {
      photoUrlsByIndex.set(assignedIndex, photoUrl);
      occupiedIndexes.add(assignedIndex);
    }
  });

  return platforms.reduce<StoryObjectDefinition[]>((storyObjects, platform, index) => {
    const floor = index + 1;

    if (reservedFloorSet.has(floor)) {
      return storyObjects;
    }

    const id = `story-object-${index}`;
    const storyPhoto = storyPhotosByIndex.get(index);
    const storyObject: StoryObjectDefinition = {
      id,
      x: platform.x,
      y: platform.y - yOffset,
      label,
    };
    const photoUrl = storyPhoto?.detailUrl ?? photoUrlsByIndex.get(index);

    if (photoUrl) {
      storyObject.photoUrl = photoUrl;
    }

    if (storyPhoto?.thumbUrl) {
      storyObject.thumbUrl = storyPhoto.thumbUrl;
    }

    if (storyPhoto?.title) {
      storyObject.title = storyPhoto.title;
    }

    if (storyPhoto?.description) {
      storyObject.description = storyPhoto.description;
    }

    storyObjects.push(storyObject);

    return storyObjects;
  }, []);
}

export function createPlatformDialogueDefinitions(
  platforms: PlatformDefinition[],
  { xOffset, yOffset, lines = [], floors, storyDialogues = [] }: PlatformDialogueOptions,
): StoryDialogueDefinition[] {
  if (storyDialogues.length > 0) {
    return [...storyDialogues]
      .sort((first, second) => first.floor - second.floor)
      .reduce<StoryDialogueDefinition[]>((dialogues, storyDialogue) => {
        const platformIndex = storyDialogue.floor - 1;
        const platform = platforms[platformIndex];

        if (!platform) {
          return dialogues;
        }

        dialogues.push({
          id: `dialogue-object-${platformIndex}`,
          x: platform.x + xOffset,
          y: platform.y - yOffset,
          speaker: storyDialogue.speaker,
          message: storyDialogue.message,
        });

        return dialogues;
      }, []);
  }

  if (lines.length === 0) {
    return [];
  }

  const selectedFloorSet = floors ? new Set(floors) : undefined;
  let dialogueIndex = 0;

  return platforms.reduce<StoryDialogueDefinition[]>((dialogues, platform, index) => {
    const floor = index + 1;

    if (selectedFloorSet && !selectedFloorSet.has(floor)) {
      return dialogues;
    }

    const line = lines[dialogueIndex % lines.length];
    dialogueIndex += 1;
    dialogues.push({
      id: `dialogue-object-${index}`,
      x: platform.x + xOffset,
      y: platform.y - yOffset,
      ...line,
    });

    return dialogues;
  }, []);
}

export function createChairDefinition(
  platforms: PlatformDefinition[],
  {
    id,
    platformIndex,
    facing,
    xOffset,
    yOffset,
    seatXOffset,
    seatYOffset,
    triggerDistance,
  }: ChairDefinitionOptions,
): ChairDefinition | undefined {
  const platform = platforms[platformIndex];

  if (!platform) {
    return undefined;
  }

  const x = platform.x + xOffset;
  const y = platform.y - yOffset;

  return {
    id,
    platformIndex,
    facing,
    x,
    y,
    seatX: x + seatXOffset,
    seatY: y - seatYOffset,
    triggerDistance,
  };
}

function findNextOpenPlatformIndex(
  platformCount: number,
  startIndex: number,
  occupiedIndexes: Set<number>,
): number | undefined {
  for (let index = startIndex; index < platformCount; index += 1) {
    if (!occupiedIndexes.has(index)) {
      return index;
    }
  }

  return undefined;
}

export function isNearStoryObject(
  point: Point,
  storyObject: Point,
  triggerDistance: number,
): boolean {
  return Math.hypot(point.x - storyObject.x, point.y - storyObject.y) <= triggerDistance;
}

export function isNearChairSeat(point: Point, chair: ChairDefinition): boolean {
  return Math.hypot(point.x - chair.seatX, point.y - chair.seatY) <= chair.triggerDistance;
}

export function getStoryObjectDetail(storyObject: StoryObjectDefinition): StoryObjectDetail {
  const objectIndex = Number.parseInt(storyObject.id.replace('story-object-', ''), 10);
  const displayIndex = Number.isNaN(objectIndex) ? 1 : objectIndex + 1;
  const detail: StoryObjectDetail = {
    title: storyObject.title ?? `${displayIndex}\uBC88\uC9F8 \uC624\uBE0C\uC81D\uD2B8`,
    label: storyObject.label,
    isReady: Boolean(storyObject.photoUrl),
  };

  if (storyObject.description) {
    detail.description = storyObject.description;
  }

  if (storyObject.photoUrl) {
    detail.photoUrl = storyObject.photoUrl;
  }

  if (storyObject.thumbUrl) {
    detail.thumbUrl = storyObject.thumbUrl;
  }

  return detail;
}

export function createStoryPhotoPublicUrl(
  supabaseUrl: string,
  bucket: string,
  path?: string | null,
): string | undefined {
  if (!path) {
    return undefined;
  }

  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${path.replace(/^\//, '')}`;
}

export function getRequiredFloorCount(
  defaultFloorCount: number,
  storyPhotos: StoryPhotoDefinition[],
): number {
  const highestPhotoFloor = storyPhotos.reduce(
    (highestFloor, photo) => Math.max(highestFloor, photo.floor),
    0,
  );

  return Math.max(defaultFloorCount, highestPhotoFloor);
}

export function getStandingFloor(
  playerBottomY: number,
  platforms: PlatformDefinition[],
  {
    groundSurfaceY,
    platformColliderYOffset,
    platformColliderHalfHeight,
    tolerance,
  }: FloorDetectionOptions,
): number | undefined {
  if (Math.abs(playerBottomY - groundSurfaceY) <= tolerance) {
    return 0;
  }

  const platformIndex = platforms.findIndex((platform) => {
    const platformSurfaceY = platform.y + platformColliderYOffset - platformColliderHalfHeight;

    return Math.abs(playerBottomY - platformSurfaceY) <= tolerance;
  });

  return platformIndex >= 0 ? platformIndex + 1 : undefined;
}

export function getEstimatedFloorForY(
  playerBottomY: number,
  platforms: PlatformDefinition[],
  {
    groundSurfaceY,
    platformColliderYOffset,
    platformColliderHalfHeight,
  }: Omit<FloorDetectionOptions, 'tolerance'>,
): number {
  let estimatedFloor = 0;
  let lowerSurfaceY = groundSurfaceY;

  platforms.forEach((platform, index) => {
    const upperSurfaceY = platform.y + platformColliderYOffset - platformColliderHalfHeight;
    const midpointY = (lowerSurfaceY + upperSurfaceY) / 2;

    if (playerBottomY <= midpointY) {
      estimatedFloor = index + 1;
      lowerSurfaceY = upperSurfaceY;
    }
  });

  return estimatedFloor;
}

export function getFloorTargetPosition(
  floor: number,
  platforms: PlatformDefinition[],
  {
    groundX,
    groundSurfaceY,
    platformColliderYOffset,
    platformColliderHalfHeight,
    playerHalfHeight,
  }: FloorTargetOptions,
): Point | undefined {
  if (floor === 0) {
    return { x: groundX, y: groundSurfaceY - playerHalfHeight };
  }

  const platform = platforms[floor - 1];

  if (!platform) {
    return undefined;
  }

  const platformSurfaceY = platform.y + platformColliderYOffset - platformColliderHalfHeight;

  return { x: platform.x, y: platformSurfaceY - playerHalfHeight };
}

export function getActivePlatformIndexes(
  platforms: PlatformDefinition[],
  {
    cameraTopY,
    cameraHeight,
    aboveBufferY,
    belowBufferY,
    fallingVelocityY = 0,
    fallingLookaheadSeconds = 0,
    focusY,
  }: ActivePlatformOptions,
): number[] {
  const fallingLookaheadY = Math.max(0, fallingVelocityY) * fallingLookaheadSeconds;
  const visibleTopY = cameraTopY - aboveBufferY;
  const visibleBottomY = cameraTopY + cameraHeight + belowBufferY + fallingLookaheadY;
  const focusTopY = focusY === undefined ? visibleTopY : focusY - aboveBufferY;
  const focusBottomY = focusY === undefined ? visibleBottomY : focusY + belowBufferY + fallingLookaheadY;
  const activeTopY = Math.min(visibleTopY, focusTopY);
  const activeBottomY = Math.max(visibleBottomY, focusBottomY);

  return platforms.reduce<number[]>((activeIndexes, platform, index) => {
    if (platform.y >= activeTopY && platform.y <= activeBottomY) {
      activeIndexes.push(index);
    }

    return activeIndexes;
  }, []);
}

export function getBackgroundAssetIndexForFloor(
  floor: number,
  assetCount: number,
  floorsPerAsset: number,
): number {
  if (assetCount <= 1) {
    return 0;
  }

  const safeFloorsPerAsset = Math.max(1, floorsPerAsset);
  const rawIndex = Math.floor(Math.max(0, floor) / safeFloorsPerAsset);

  return Math.min(rawIndex, assetCount - 1);
}
