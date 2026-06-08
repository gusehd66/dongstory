import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPlatformDialogueDefinitions,
  createPlatformObjectDefinitions,
  createStoryPhotoPublicUrl,
  createZigzagPlatformDefinitions,
  getActivePlatformIndexes,
  getBackgroundAssetIndexForFloor,
  getEstimatedFloorForY,
  getFloorTargetPosition,
  getRequiredFloorCount,
  getStandingFloor,
  getStoryObjectDetail,
  isNearStoryObject,
} from '../dist-test/platformLayout.js';

const READY_LABEL = 'Ready';

test('creates uniformly spaced zigzag platforms', () => {
  const platforms = createZigzagPlatformDefinitions({
    floorCount: 4,
    leftX: 360,
    rightX: 600,
    bottomY: 7000,
    verticalGap: 150,
  });

  assert.deepEqual(platforms.map((platform) => platform.x), [360, 600, 360, 600]);
  assert.deepEqual(platforms.map((platform) => platform.y), [7000, 6850, 6700, 6550]);
  assert.ok(platforms.every((platform) => platform.texture === 'platform'));
});

test('places one story object above each platform by default', () => {
  const platforms = [
    { x: 360, y: 7000, texture: 'platform' },
    { x: 600, y: 6850, texture: 'platform' },
  ];

  const objects = createPlatformObjectDefinitions(platforms, {
    yOffset: 44,
    label: READY_LABEL,
  });

  assert.deepEqual(objects, [
    { id: 'story-object-0', x: 360, y: 6956, label: READY_LABEL },
    { id: 'story-object-1', x: 600, y: 6806, label: READY_LABEL },
  ]);
});

test('assigns photos to story objects until photos run out', () => {
  const platforms = [
    { x: 360, y: 7000, texture: 'platform' },
    { x: 600, y: 6850, texture: 'platform' },
    { x: 360, y: 6700, texture: 'platform' },
  ];

  const objects = createPlatformObjectDefinitions(platforms, {
    yOffset: 44,
    label: READY_LABEL,
    photoUrls: ['/assets/photo/wedding_1.jpg', '/assets/photo/wedding_2.jpg'],
  });

  assert.equal(objects[0].photoUrl, '/assets/photo/wedding_1.jpg');
  assert.equal(objects[1].photoUrl, '/assets/photo/wedding_2.jpg');
  assert.equal(objects[2].photoUrl, undefined);
});

test('omits story objects on reserved dialogue floors and moves photos up', () => {
  const platforms = [
    { x: 360, y: 7000, texture: 'platform' },
    { x: 600, y: 6850, texture: 'platform' },
    { x: 360, y: 6700, texture: 'platform' },
    { x: 600, y: 6550, texture: 'platform' },
  ];

  const objects = createPlatformObjectDefinitions(platforms, {
    yOffset: 44,
    label: READY_LABEL,
    photoUrls: ['/assets/photo/wedding_1.jpg', '/assets/photo/wedding_2.jpg'],
    reservedFloors: [1],
  });

  assert.deepEqual(objects.map((object) => object.id), [
    'story-object-1',
    'story-object-2',
    'story-object-3',
  ]);
  assert.equal(objects[0].photoUrl, '/assets/photo/wedding_1.jpg');
  assert.equal(objects[1].photoUrl, '/assets/photo/wedding_2.jpg');
});

test('moves explicit story photos up when reserved floors collide', () => {
  const platforms = [
    { x: 360, y: 7000, texture: 'platform' },
    { x: 600, y: 6850, texture: 'platform' },
    { x: 360, y: 6700, texture: 'platform' },
  ];

  const objects = createPlatformObjectDefinitions(platforms, {
    yOffset: 44,
    label: READY_LABEL,
    reservedFloors: [1],
    storyPhotos: [
      {
        floor: 1,
        objectId: 'story-object-0',
        title: 'first photo',
        detailUrl: 'https://example.com/detail/wedding_1.jpg',
      },
      {
        floor: 2,
        objectId: 'story-object-1',
        title: 'second photo',
        detailUrl: 'https://example.com/detail/wedding_2.jpg',
      },
    ],
  });

  assert.deepEqual(objects.map((object) => object.id), [
    'story-object-1',
    'story-object-2',
  ]);
  assert.equal(objects[0].photoUrl, 'https://example.com/detail/wedding_1.jpg');
  assert.equal(objects[0].title, 'first photo');
  assert.equal(objects[1].photoUrl, 'https://example.com/detail/wedding_2.jpg');
  assert.equal(objects[1].title, 'second photo');
});

test('creates dialogue objects only on selected floors', () => {
  const platforms = createZigzagPlatformDefinitions({
    floorCount: 22,
    leftX: 360,
    rightX: 600,
    bottomY: 7000,
    verticalGap: 150,
  });

  const dialogueObjects = createPlatformDialogueDefinitions(platforms, {
    xOffset: -54,
    yOffset: 34,
    floors: [1, 21],
    lines: [
      { speaker: 'Sugar', message: 'Floor 1 dialogue.' },
      { speaker: 'Dodo', message: 'Floor 21 dialogue.' },
    ],
  });

  assert.deepEqual(dialogueObjects.map((dialogue) => dialogue.id), [
    'dialogue-object-0',
    'dialogue-object-20',
  ]);
  assert.deepEqual(dialogueObjects.map((dialogue) => dialogue.speaker), ['Sugar', 'Dodo']);
});

test('can place selected dialogue objects in the story object slot', () => {
  const platforms = [
    { x: 360, y: 7000, texture: 'platform' },
    { x: 600, y: 6850, texture: 'platform' },
  ];

  const dialogueObjects = createPlatformDialogueDefinitions(platforms, {
    xOffset: 0,
    yOffset: 44,
    floors: [1],
    lines: [
      { speaker: 'Sugar', message: 'This is the photo object slot.' },
    ],
  });

  assert.deepEqual(dialogueObjects, [
    {
      id: 'dialogue-object-0',
      x: 360,
      y: 6956,
      speaker: 'Sugar',
      message: 'This is the photo object slot.',
    },
  ]);
});

test('assigns detail and thumb photos to matching story objects', () => {
  const platforms = [
    { x: 360, y: 7000, texture: 'platform' },
    { x: 600, y: 6850, texture: 'platform' },
  ];

  const objects = createPlatformObjectDefinitions(platforms, {
    yOffset: 44,
    label: READY_LABEL,
    storyPhotos: [
      {
        floor: 2,
        objectId: 'story-object-1',
        title: 'second object',
        description: 'Supabase test',
        detailUrl: 'https://example.com/detail/wedding_2.jpg',
        thumbUrl: 'https://example.com/thumb/wedding_2.jpg',
      },
    ],
  });

  assert.equal(objects[0].photoUrl, undefined);
  assert.equal(objects[1].photoUrl, 'https://example.com/detail/wedding_2.jpg');
  assert.equal(objects[1].thumbUrl, 'https://example.com/thumb/wedding_2.jpg');
  assert.equal(objects[1].title, 'second object');
  assert.equal(objects[1].description, 'Supabase test');
});

test('expands the platform count to the highest story photo floor', () => {
  assert.equal(getRequiredFloorCount(30, []), 30);
  assert.equal(getRequiredFloorCount(30, [
    { floor: 2, objectId: 'story-object-1' },
    { floor: 48, objectId: 'story-object-47' },
  ]), 48);
});

test('creates supabase public storage urls from paths', () => {
  assert.equal(
    createStoryPhotoPublicUrl('https://demo.supabase.co', 'story-photos', 'detail/wedding_1.jpg'),
    'https://demo.supabase.co/storage/v1/object/public/story-photos/detail/wedding_1.jpg',
  );
  assert.equal(
    createStoryPhotoPublicUrl('https://demo.supabase.co/', 'story-photos', undefined),
    undefined,
  );
});

test('detects whether the player is close enough to a story point', () => {
  const storyObject = { x: 360, y: 6956 };

  assert.equal(isNearStoryObject({ x: 360, y: 7000 }, storyObject, 80), true);
  assert.equal(isNearStoryObject({ x: 460, y: 7000 }, storyObject, 80), false);
});

test('detects the standing floor from visible collision surfaces', () => {
  const platforms = [
    { x: 360, y: 7000, texture: 'platform' },
    { x: 600, y: 6850, texture: 'platform' },
  ];

  const options = {
    groundSurfaceY: 7186,
    platformColliderYOffset: 19,
    platformColliderHalfHeight: 9,
    tolerance: 8,
  };

  assert.equal(getStandingFloor(7186, platforms, options), 0);
  assert.equal(getStandingFloor(7010, platforms, options), 1);
  assert.equal(getStandingFloor(6860, platforms, options), 2);
  assert.equal(getStandingFloor(6900, platforms, options), undefined);
});

test('estimates floor by height while the player is airborne', () => {
  const platforms = [
    { x: 360, y: 7000, texture: 'platform' },
    { x: 600, y: 6850, texture: 'platform' },
  ];
  const options = {
    groundSurfaceY: 7186,
    platformColliderYOffset: 19,
    platformColliderHalfHeight: 9,
  };

  assert.equal(getEstimatedFloorForY(7160, platforms, options), 0);
  assert.equal(getEstimatedFloorForY(7060, platforms, options), 1);
  assert.equal(getEstimatedFloorForY(6900, platforms, options), 2);
  assert.equal(getEstimatedFloorForY(6600, platforms, options), 2);
});

test('returns a teleport target on the requested floor surface', () => {
  const platforms = [
    { x: 360, y: 7000, texture: 'platform' },
    { x: 600, y: 6850, texture: 'platform' },
  ];

  const options = {
    groundX: 160,
    groundSurfaceY: 7186,
    platformColliderYOffset: 19,
    platformColliderHalfHeight: 9,
    playerHalfHeight: 29,
  };

  assert.deepEqual(getFloorTargetPosition(0, platforms, options), { x: 160, y: 7157 });
  assert.deepEqual(getFloorTargetPosition(2, platforms, options), { x: 600, y: 6831 });
  assert.equal(getFloorTargetPosition(3, platforms, options), undefined);
});

test('returns active platform indexes around the camera with a falling buffer', () => {
  const platforms = [
    { x: 360, y: 1200, texture: 'platform' },
    { x: 600, y: 1000, texture: 'platform' },
    { x: 360, y: 800, texture: 'platform' },
    { x: 600, y: 600, texture: 'platform' },
    { x: 360, y: 400, texture: 'platform' },
    { x: 600, y: 200, texture: 'platform' },
  ];

  assert.deepEqual(getActivePlatformIndexes(platforms, {
    cameraTopY: 500,
    cameraHeight: 300,
    aboveBufferY: 100,
    belowBufferY: 250,
    fallingVelocityY: 0,
  }), [1, 2, 3, 4]);

  assert.deepEqual(getActivePlatformIndexes(platforms, {
    cameraTopY: 500,
    cameraHeight: 300,
    aboveBufferY: 100,
    belowBufferY: 250,
    fallingVelocityY: 600,
    fallingLookaheadSeconds: 0.5,
  }), [0, 1, 2, 3, 4]);
});

test('selects a background asset every 10 floors and caps at the last asset', () => {
  assert.equal(getBackgroundAssetIndexForFloor(0, 11, 10), 0);
  assert.equal(getBackgroundAssetIndexForFloor(9, 11, 10), 0);
  assert.equal(getBackgroundAssetIndexForFloor(10, 11, 10), 1);
  assert.equal(getBackgroundAssetIndexForFloor(29, 11, 10), 2);
  assert.equal(getBackgroundAssetIndexForFloor(100, 11, 10), 10);
});

test('returns detail panel data for story objects', () => {
  assert.deepEqual(getStoryObjectDetail({
    id: 'story-object-0',
    x: 360,
    y: 6956,
    label: READY_LABEL,
    title: 'first photo',
    description: 'description',
    photoUrl: '/assets/photo/wedding_1.jpg',
    thumbUrl: '/assets/photo/thumb/wedding_1.jpg',
  }), {
    title: 'first photo',
    label: READY_LABEL,
    description: 'description',
    photoUrl: '/assets/photo/wedding_1.jpg',
    thumbUrl: '/assets/photo/thumb/wedding_1.jpg',
    isReady: true,
  });

  assert.deepEqual(getStoryObjectDetail({
    id: 'story-object-22',
    x: 360,
    y: 4196,
    label: READY_LABEL,
  }), {
    title: '23\uBC88\uC9F8 \uC624\uBE0C\uC81D\uD2B8',
    label: READY_LABEL,
    isReady: false,
  });
});
