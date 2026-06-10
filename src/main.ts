import Phaser from 'phaser';
import './style.css';
import {
  createPlatformDialogueDefinitions,
  createPlatformObjectDefinitions,
  createZigzagPlatformDefinitions,
  getActivePlatformIndexes,
  getBackgroundAssetIndexForFloor,
  getEstimatedFloorForY,
  getFloorTargetPosition,
  getRequiredFloorCount,
  getStandingFloor,
  getStoryObjectDetail,
  isNearStoryObject,
  type StoryDialogueDefinition,
  type StoryDialogueSource,
  type StoryObjectDefinition,
} from './platformLayout';
import {
  loadStoryDialoguesFromSupabase,
  loadStoryPhotosFromSupabase,
} from './storyPhotoSource';
import {
  createMultiplayerConnection,
  formatMultiplayerStatus,
  normalizePlayerName,
  type MultiplayerConnection,
  type PlayerAnimation,
  type RemotePlayer,
  type RoomSnapshot,
} from './multiplayerClient';

const GAME_WIDTH = 1200;
const GAME_HEIGHT = 676;
const WORLD_WIDTH = GAME_WIDTH;
const GROUND_COLLIDER_HEIGHT = 28;
const GROUND_VISUAL_WIDTH = 430;
const GROUND_VISUAL_HEIGHT = 210;
const GROUND_TILE_SPACING = 396;
const PLATFORM_COLLIDER_HEIGHT = 18;
const PLATFORM_COLLIDER_Y_OFFSET = 19;
const DEFAULT_PLATFORM_FLOOR_COUNT = 30;
const PLATFORM_VERTICAL_GAP = 126;
const PLAYER_START_X = 160;
const STORY_OBJECT_Y_OFFSET = 44;
const STORY_OBJECT_TRIGGER_DISTANCE = 80;
const STORY_DIALOGUE_X_OFFSET = 0;
const STORY_DIALOGUE_Y_OFFSET = STORY_OBJECT_Y_OFFSET;
const STORY_DIALOGUE_TRIGGER_DISTANCE = 70;
const FALLBACK_STORY_DIALOGUE_FLOORS = [1, 21];
const STORY_OBJECT_LABEL = '\uC900\uBE44\uC911';
const FLOOR_DETECTION_TOLERANCE = 12;
const PLAYER_BODY_HEIGHT = 58;
const PLAYER_HALF_HEIGHT = PLAYER_BODY_HEIGHT / 2;
const MIN_WORLD_HEIGHT = 4600;
const WORLD_TOP_PADDING = 320;
const FIRST_PLATFORM_FROM_WORLD_BOTTOM = 145;
const PLAYER_START_FROM_WORLD_BOTTOM = 130;
const ACTIVE_PLATFORM_ABOVE_BUFFER_Y = 900;
const ACTIVE_PLATFORM_BELOW_BUFFER_Y = 1600;
const ACTIVE_PLATFORM_FALLING_LOOKAHEAD_SECONDS = 0.75;
const BACKGROUND_FLOOR_INTERVAL = 10;
const BACKGROUND_FADE_DURATION_MS = 320;
const MULTIPLAYER_SEND_INTERVAL_MS = 80;
const REMOTE_PLAYER_LERP = 0.34;
const PLAYER_NAME_SESSION_KEY = 'dongstory-player-name';
const PLAYER_VISUAL_FOOT_OFFSET = 5;
const BACKGROUND_ASSET_URLS = [
  '/assets/background.png',
  '/assets/background2.png',
  '/assets/background3.png',
  '/assets/background4.png',
  '/assets/background5.png',
  '/assets/background6.png',
  '/assets/background7.png',
  '/assets/background8.png',
  '/assets/background9.png',
  '/assets/background10.png',
  '/assets/background11.png',
];
const STORY_PHOTO_URLS = [
  '/assets/photo/wedding_1.jpg',
  '/assets/photo/wedding_2.jpg',
  '/assets/photo/wedding_3.jpg',
  '/assets/photo/wedding_4.jpg',
  '/assets/photo/wedding_5.jpg',
  '/assets/photo/wedding_6.jpg',
  '/assets/photo/wedding_7.jpg',
  '/assets/photo/wedding_8.jpg',
  '/assets/photo/wedding_9.jpg',
  '/assets/photo/wedding_10.jpg',
  '/assets/photo/wedding_11.jpg',
  '/assets/photo/wedding_12.jpg',
  '/assets/photo/wedding_13.jpg',
  '/assets/photo/wedding_14.jpg',
  '/assets/photo/wedding_15.jpg',
  '/assets/photo/wedding_16.jpg',
  '/assets/photo/wedding_17.jpg',
  '/assets/photo/wedding_18.jpg',
  '/assets/photo/wedding_19.jpg',
  '/assets/photo/wedding_20.jpg',
  '/assets/photo/wedding_21.jpg',
];
const FALLBACK_STORY_DIALOGUE_LINES = [
  {
    speaker: '\uC288\uAC00',
    message: '\uC548\uB155! \uC774 \uD0D1\uC5D0\uB294 \uC6B0\uB9AC \uC774\uC57C\uAE30\uAC00 \uD55C \uCE35\uC529 \uC313\uC5EC \uC788\uC5B4.',
  },
  {
    speaker: '\uB3C4\uB3C4',
    message: '\uBC1C\uD310\uC744 \uD558\uB098\uC529 \uC62C\uB77C\uAC00\uBA74 \uC0AC\uC9C4\uACFC \uAE30\uC5B5\uC744 \uB9CC\uB0A0 \uC218 \uC788\uC5B4.',
  },
  {
    speaker: '\uB098\uB798',
    message: '\uC0AC\uC9C4\uC774 \uC544\uC9C1 \uC5C6\uB294 \uACF3\uC740 \uB300\uC0AC\uB85C \uBA3C\uC800 \uBD84\uC704\uAE30\uB97C \uC7A1\uC544\uBCF4\uC790.',
  },
];

const SUPABASE_STORY_PHOTOS = await loadSupabaseStoryPhotosSafely();
const SUPABASE_STORY_DIALOGUES = await loadSupabaseStoryDialoguesSafely();
const STORY_DIALOGUE_FLOORS = SUPABASE_STORY_DIALOGUES.length > 0
  ? [...new Set(SUPABASE_STORY_DIALOGUES.map((dialogue) => dialogue.floor))]
  : FALLBACK_STORY_DIALOGUE_FLOORS;
const STORY_DIALOGUE_LINES = SUPABASE_STORY_DIALOGUES.length > 0
  ? []
  : FALLBACK_STORY_DIALOGUE_LINES;
const PLATFORM_FLOOR_COUNT = Math.max(
  getRequiredFloorCount(DEFAULT_PLATFORM_FLOOR_COUNT, SUPABASE_STORY_PHOTOS),
  getRequiredFloorCount(DEFAULT_PLATFORM_FLOOR_COUNT, SUPABASE_STORY_DIALOGUES.map((dialogue) => ({
    floor: dialogue.floor,
    objectId: `dialogue-object-${dialogue.floor - 1}`,
  }))),
);
const WORLD_HEIGHT = Math.max(
  MIN_WORLD_HEIGHT,
  WORLD_TOP_PADDING + FIRST_PLATFORM_FROM_WORLD_BOTTOM + (PLATFORM_FLOOR_COUNT - 1) * PLATFORM_VERTICAL_GAP,
);
const GROUND_COLLIDER_Y = WORLD_HEIGHT - GROUND_COLLIDER_HEIGHT / 2;
const GROUND_SURFACE_Y = GROUND_COLLIDER_Y - GROUND_COLLIDER_HEIGHT / 2;
const GROUND_VISUAL_Y = WORLD_HEIGHT - 5;
const FIRST_PLATFORM_Y = WORLD_HEIGHT - FIRST_PLATFORM_FROM_WORLD_BOTTOM;
const PLAYER_START_Y = WORLD_HEIGHT - PLAYER_START_FROM_WORLD_BOTTOM;

type PlayerFrameDefinition = {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type StoryObjectView = {
  definition: StoryObjectDefinition;
  marker: Phaser.GameObjects.Arc;
  popup: Phaser.GameObjects.Container;
};

type StoryDialogueView = {
  definition: StoryDialogueDefinition;
  marker: Phaser.GameObjects.Container;
};

type PlatformView = {
  visual: Phaser.GameObjects.Image;
  collider: Phaser.Physics.Arcade.Sprite;
};

type RemotePlayerView = {
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  target: RemotePlayer;
};

const PLATFORM_DEFINITIONS = createZigzagPlatformDefinitions({
  floorCount: PLATFORM_FLOOR_COUNT,
  leftX: 360,
  rightX: 600,
  bottomY: FIRST_PLATFORM_Y,
  verticalGap: PLATFORM_VERTICAL_GAP,
});

const STORY_OBJECT_DEFINITIONS = createPlatformObjectDefinitions(PLATFORM_DEFINITIONS, {
  yOffset: STORY_OBJECT_Y_OFFSET,
  label: STORY_OBJECT_LABEL,
  photoUrls: SUPABASE_STORY_PHOTOS.length > 0 ? [] : STORY_PHOTO_URLS,
  storyPhotos: SUPABASE_STORY_PHOTOS,
  reservedFloors: STORY_DIALOGUE_FLOORS,
});
const STORY_OBJECT_DEFINITIONS_BY_PLATFORM_INDEX = new Map(
  STORY_OBJECT_DEFINITIONS.map((definition) => [
    Number.parseInt(definition.id.replace('story-object-', ''), 10),
    definition,
  ]),
);

const STORY_DIALOGUE_DEFINITIONS = createPlatformDialogueDefinitions(PLATFORM_DEFINITIONS, {
  xOffset: STORY_DIALOGUE_X_OFFSET,
  yOffset: STORY_DIALOGUE_Y_OFFSET,
  floors: STORY_DIALOGUE_FLOORS,
  lines: STORY_DIALOGUE_LINES,
  storyDialogues: SUPABASE_STORY_DIALOGUES,
});
const STORY_DIALOGUE_DEFINITIONS_BY_PLATFORM_INDEX = new Map(
  STORY_DIALOGUE_DEFINITIONS.map((definition) => [
    Number.parseInt(definition.id.replace('dialogue-object-', ''), 10),
    definition,
  ]),
);

const PLAYER_TEXTURE_KEY = 'player';
const PLAYER_FRAMES: PlayerFrameDefinition[] = [
  { name: 'idle-0', x: 144, y: 207, width: 131, height: 172 },
  { name: 'walk-0', x: 123, y: 387, width: 129, height: 172 },
  { name: 'walk-1', x: 278, y: 387, width: 130, height: 173 },
  { name: 'walk-2', x: 444, y: 387, width: 129, height: 172 },
  { name: 'jump-0', x: 272, y: 561, width: 131, height: 168 },
  { name: 'jump-1', x: 272, y: 561, width: 131, height: 168 },
  { name: 'crouch-0', x: 621, y: 627, width: 163, height: 120 },
  { name: 'crouch-1', x: 803, y: 631, width: 163, height: 116 },
  { name: 'crouch-2', x: 981, y: 627, width: 163, height: 120 },
  { name: 'crouch-3', x: 1162, y: 631, width: 163, height: 116 },
];

class MainScene extends Phaser.Scene {
  private backgroundLayer!: Phaser.GameObjects.Image;
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerVisual!: Phaser.GameObjects.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private jumpKey!: Phaser.Input.Keyboard.Key;
  private debugKey!: Phaser.Input.Keyboard.Key;
  private debugEnabled = false;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private activePlatformViews = new Map<number, PlatformView>();
  private activeStoryObjectViews = new Map<number, StoryObjectView>();
  private activeStoryDialogueViews = new Map<number, StoryDialogueView>();
  private remotePlayerViews = new Map<string, RemotePlayerView>();
  private loadingStoryPhotoTextureKeys = new Set<string>();
  private multiplayerConnection?: MultiplayerConnection;
  private localPlayerId?: string;
  private multiplayerPlayerCount?: number;
  private lastMultiplayerSentAt = 0;
  private playerAnimationState: PlayerAnimation = 'idle';
  private currentFloor = 0;
  private activeBackgroundIndex = 0;
  private activeStoryObjectId?: string;
  private activeStoryDialogueId?: string;

  constructor() {
    super('MainScene');
  }

  preload() {
    BACKGROUND_ASSET_URLS.forEach((url, index) => {
      this.load.image(this.getBackgroundTextureKey(index), url);
    });
    this.load.image('ground', '/assets/ground.png');
    this.load.image('stool', '/assets/stool1.png');
    this.load.image(PLAYER_TEXTURE_KEY, '/assets/player-transparent.png');
    this.createRectTexture('player-body', 46, 58, 0x2f80ed);
    this.createRectTexture('ground-collider', GROUND_VISUAL_WIDTH, GROUND_COLLIDER_HEIGHT, 0x00ff00);
    this.createRectTexture('platform-small-collider', 150, PLATFORM_COLLIDER_HEIGHT, 0x00ff00);
  }

  create() {
    this.cameras.main.setBackgroundColor('#87ceeb');
    this.activeBackgroundIndex = getBackgroundAssetIndexForFloor(
      this.currentFloor,
      BACKGROUND_ASSET_URLS.length,
      BACKGROUND_FLOOR_INTERVAL,
    );
    this.backgroundLayer = this.add
      .image(0, 0, this.getBackgroundTextureKey(this.activeBackgroundIndex))
      .setOrigin(0, 0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setScrollFactor(0)
      .setDepth(-20);
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.setPhysicsDebug(false);

    this.platforms = this.physics.add.staticGroup();
    this.createGround(this.platforms);

    this.registerPlayerFrames();
    this.createAnimations();

    this.player = this.physics.add.sprite(PLAYER_START_X, PLAYER_START_Y, 'player-body');
    this.player.setVisible(false);
    this.player.setCollideWorldBounds(true);
    this.player.setDragX(1800);
    this.player.setMaxVelocity(340, 760);

    this.playerVisual = this.add.sprite(this.player.x, this.player.y, PLAYER_TEXTURE_KEY, 'idle-0');
    this.playerVisual.setOrigin(0.5, 1);
    this.playerVisual.setScale(0.42);
    this.playerVisual.play('player-idle');

    this.physics.add.collider(this.player, this.platforms);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.jumpKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.debugKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);

    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.08);
    this.cameras.main.setDeadzone(180, 90);
    this.updateActiveFloors(0, this.player.y);
    this.connectFloorHud();
    this.connectNicknameGate();
    this.publishCurrentFloor();
  }

  update() {
    const runAcceleration = 1700;
    const jumpVelocity = 510;
    const jumpCutVelocity = -210;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const isGrounded = body.blocked.down || body.touching.down;
    const movingLeft = this.cursors.left?.isDown;
    const movingRight = this.cursors.right?.isDown;
    const isCrouching = isGrounded && Boolean(this.cursors.down?.isDown);
    const wantsJump =
      Phaser.Input.Keyboard.JustDown(this.jumpKey) ||
      Phaser.Input.Keyboard.JustDown(this.cursors.up);

    this.updateActiveFloors(body.velocity.y, body.center.y);

    if (isCrouching) {
      this.player.setAccelerationX(0);
    } else if (movingLeft) {
      this.player.setAccelerationX(-runAcceleration);
      this.playerVisual.setFlipX(false);
    } else if (movingRight) {
      this.player.setAccelerationX(runAcceleration);
      this.playerVisual.setFlipX(true);
    } else {
      this.player.setAccelerationX(0);
    }

    if (wantsJump && isGrounded) {
      this.player.setVelocityY(-jumpVelocity);
    }

    if (this.isJumpReleased() && body.velocity.y < jumpCutVelocity) {
      this.player.setVelocityY(jumpCutVelocity);
    }

    this.updatePlayerAnimation(isGrounded, movingLeft || movingRight, isCrouching);
    this.syncPlayerVisual();
    this.updateBackgroundByHeight(body.bottom);
    this.updateCurrentFloor(isGrounded, body.bottom);
    this.updateStoryObjectPopups(body.center.x, body.center.y);
    this.updateStoryDialogue(body.center.x, body.center.y);
    this.updateRemotePlayerViews();
    this.sendMultiplayerUpdate(this.time.now, body);

    if (Phaser.Input.Keyboard.JustDown(this.debugKey)) {
      this.setPhysicsDebug(!this.debugEnabled);
    }
  }

  private createGround(platforms: Phaser.Physics.Arcade.StaticGroup) {
    for (let x = GROUND_VISUAL_WIDTH / 2; x < WORLD_WIDTH + GROUND_VISUAL_WIDTH; x += GROUND_TILE_SPACING) {
      this.add
        .image(x, GROUND_VISUAL_Y, 'ground')
        .setDisplaySize(GROUND_VISUAL_WIDTH, GROUND_VISUAL_HEIGHT);

      platforms.create(x, GROUND_COLLIDER_Y, 'ground-collider').setVisible(false);
    }
  }

  private updateActiveFloors(fallingVelocityY = 0, focusY?: number) {
    const activeIndexes = new Set(getActivePlatformIndexes(PLATFORM_DEFINITIONS, {
      cameraTopY: this.cameras.main.scrollY,
      cameraHeight: GAME_HEIGHT,
      aboveBufferY: ACTIVE_PLATFORM_ABOVE_BUFFER_Y,
      belowBufferY: ACTIVE_PLATFORM_BELOW_BUFFER_Y,
      fallingVelocityY,
      fallingLookaheadSeconds: ACTIVE_PLATFORM_FALLING_LOOKAHEAD_SECONDS,
      focusY,
    }));

    this.activePlatformViews.forEach((_, index) => {
      if (!activeIndexes.has(index)) {
        this.destroyPlatform(index);
      }
    });

    activeIndexes.forEach((index) => this.createPlatform(index));
  }

  private createPlatform(index: number) {
    if (this.activePlatformViews.has(index)) {
      return;
    }

    const platform = PLATFORM_DEFINITIONS[index];

    if (!platform) {
      return;
    }

    const visual = this.add
      .image(platform.x, platform.y + 34, 'stool')
      .setDisplaySize(170, 77);
    const collider = this.platforms
      .create(platform.x, platform.y + PLATFORM_COLLIDER_Y_OFFSET, 'platform-small-collider')
      .setVisible(false) as Phaser.Physics.Arcade.Sprite;

    this.activePlatformViews.set(index, { visual, collider });
    this.createStoryObject(index);
    this.createStoryDialogue(index);
  }

  private destroyPlatform(index: number) {
    const platformView = this.activePlatformViews.get(index);

    if (platformView) {
      platformView.visual.destroy();
      platformView.collider.destroy();
      this.activePlatformViews.delete(index);
    }

    const storyObjectView = this.activeStoryObjectViews.get(index);

    if (storyObjectView) {
      storyObjectView.marker.destroy();
      storyObjectView.popup.destroy();
      this.activeStoryObjectViews.delete(index);
    }

    const storyDialogueView = this.activeStoryDialogueViews.get(index);

    if (storyDialogueView) {
      storyDialogueView.marker.destroy();
      this.activeStoryDialogueViews.delete(index);
    }
  }

  private createStoryObject(index: number) {
    if (this.activeStoryObjectViews.has(index)) {
      return;
    }

    const definition = STORY_OBJECT_DEFINITIONS_BY_PLATFORM_INDEX.get(index);

    if (!definition) {
      return;
    }

    const marker = this.add
      .circle(definition.x, definition.y, 14, 0xffd166)
      .setStrokeStyle(3, 0x6b3f12)
      .setDepth(5);
    const popup = this.createStoryPopup(index, definition);

    this.activeStoryObjectViews.set(index, { definition, marker, popup });
    this.ensureStoryPhotoTexture(index, definition);
  }

  private createStoryDialogue(index: number) {
    if (this.activeStoryDialogueViews.has(index)) {
      return;
    }

    const definition = STORY_DIALOGUE_DEFINITIONS_BY_PLATFORM_INDEX.get(index);

    if (!definition) {
      return;
    }

    const marker = this.add.container(definition.x, definition.y).setDepth(6);
    const base = this.add.circle(0, 0, 13, 0x38bdf8).setStrokeStyle(3, 0x075985);
    const dot = this.add.circle(0, -2, 5, 0xfff7cc);
    const tail = this.add.triangle(0, 14, -6, 0, 6, 0, 0, 8, 0x38bdf8);

    marker.add([tail, base, dot]);
    this.activeStoryDialogueViews.set(index, { definition, marker });
  }

  private createStoryPopup(platformIndex: number, { id, x, y, label, photoUrl }: StoryObjectDefinition) {
    const popup = this.add.container(x, y - 50).setDepth(10).setVisible(false);
    const bubble = this.add.graphics();
    const photoTextureKey = photoUrl ? this.getStoryPhotoTextureKey(platformIndex) : undefined;

    bubble.fillStyle(0xffffff, 0.94);
    bubble.lineStyle(2, 0x2f4756, 0.85);

    if (photoTextureKey && this.textures.exists(photoTextureKey)) {
      const photo = this.add
        .image(0, -16, photoTextureKey)
        .setDisplaySize(112, 76);

      bubble.fillRoundedRect(-64, -64, 128, 100, 8);
      bubble.strokeRoundedRect(-64, -64, 128, 100, 8);
      bubble.fillTriangle(-8, 36, 8, 36, 0, 48);
      popup.add([bubble, photo]);

      return popup;
    }

    const text = this.add
      .text(0, -2, label, {
        color: '#20303a',
        fontFamily: 'system-ui, Segoe UI, sans-serif',
        fontSize: '14px',
        fontStyle: '700',
      })
      .setOrigin(0.5)
      .setName(`${id}-label`);

    bubble.fillRoundedRect(-50, -24, 100, 38, 8);
    bubble.strokeRoundedRect(-50, -24, 100, 38, 8);
    bubble.fillTriangle(-8, 14, 8, 14, 0, 24);

    popup.add([bubble, text]);

    return popup;
  }

  private ensureStoryPhotoTexture(index: number, definition: StoryObjectDefinition) {
    const popupPhotoUrl = definition.thumbUrl ?? definition.photoUrl;
    const textureKey = this.getStoryPhotoTextureKey(index);

    if (!popupPhotoUrl || this.textures.exists(textureKey) || this.loadingStoryPhotoTextureKeys.has(textureKey)) {
      return;
    }

    this.loadingStoryPhotoTextureKeys.add(textureKey);
    this.load.once(`filecomplete-image-${textureKey}`, () => {
      this.loadingStoryPhotoTextureKeys.delete(textureKey);

      const view = this.activeStoryObjectViews.get(index);

      if (!view) {
        return;
      }

      const wasVisible = view.popup.visible;
      view.popup.destroy();
      view.popup = this.createStoryPopup(index, view.definition);
      view.popup.setVisible(wasVisible);
    });
    this.load.image(textureKey, popupPhotoUrl);
    this.load.start();
  }

  private updateStoryObjectPopups(playerX: number, playerY: number) {
    let activeDefinition: StoryObjectDefinition | undefined;

    this.activeStoryObjectViews.forEach(({ definition, marker, popup }) => {
      const isNear = isNearStoryObject({ x: playerX, y: playerY }, definition, STORY_OBJECT_TRIGGER_DISTANCE);

      popup.setVisible(isNear);
      marker.setScale(isNear ? 1.15 : 1);

      if (isNear && !activeDefinition) {
        activeDefinition = definition;
      }
    });

    this.updateStoryDetail(activeDefinition);
  }

  private updateStoryDialogue(playerX: number, playerY: number) {
    let activeDefinition: StoryDialogueDefinition | undefined;

    this.activeStoryDialogueViews.forEach(({ definition, marker }) => {
      const isNear = isNearStoryObject({ x: playerX, y: playerY }, definition, STORY_DIALOGUE_TRIGGER_DISTANCE);

      marker.setScale(isNear ? 1.2 : 1);
      marker.setAlpha(isNear ? 1 : 0.86);

      if (isNear && !activeDefinition) {
        activeDefinition = definition;
      }
    });

    this.updateDialogueBox(activeDefinition);
  }

  private updateDialogueBox(definition?: StoryDialogueDefinition) {
    if (definition?.id === this.activeStoryDialogueId) {
      return;
    }

    this.activeStoryDialogueId = definition?.id;

    const box = document.querySelector<HTMLElement>('#dialogue-box');
    const speaker = document.querySelector<HTMLElement>('#dialogue-speaker');
    const message = document.querySelector<HTMLElement>('#dialogue-message');
    const initial = document.querySelector<HTMLElement>('#dialogue-initial');

    if (!box || !speaker || !message || !initial) {
      return;
    }

    if (!definition) {
      box.classList.add('is-hidden');
      return;
    }

    speaker.textContent = definition.speaker;
    message.textContent = definition.message;
    initial.textContent = definition.speaker.slice(0, 1);
    box.classList.remove('is-hidden');
  }

  private updateStoryDetail(definition?: StoryObjectDefinition) {
    if (definition?.id === this.activeStoryObjectId) {
      return;
    }

    this.activeStoryObjectId = definition?.id;

    const title = document.querySelector<HTMLElement>('#story-detail-title');
    const media = document.querySelector<HTMLElement>('#story-detail-media');
    const text = document.querySelector<HTMLElement>('#story-detail-text');

    if (!title || !media || !text) {
      return;
    }

    if (!definition) {
      title.textContent = '\uAC00\uAE4C\uC6B4 \uC624\uBE0C\uC81D\uD2B8 \uC5C6\uC74C';
      media.classList.add('is-empty');
      media.replaceChildren(this.createDetailPlaceholder('\uB300\uAE30\uC911'));
      text.textContent = '\uC624\uBE0C\uC81D\uD2B8 \uAC00\uAE4C\uC774 \uC774\uB3D9\uD558\uBA74 \uC0AC\uC9C4\uC774\uB098 \uC815\uBCF4\uAC00 \uD45C\uC2DC\uB429\uB2C8\uB2E4.';
      return;
    }

    const detail = getStoryObjectDetail(definition);

    title.textContent = detail.title;
    media.classList.toggle('is-empty', !detail.photoUrl);

    if (detail.photoUrl) {
      const image = document.createElement('img');
      image.src = detail.photoUrl;
      image.alt = detail.title;
      media.replaceChildren(image);
      text.textContent = '\uC624\uBE0C\uC81D\uD2B8\uC5D0 \uC5F0\uACB0\uB41C \uC0AC\uC9C4\uC785\uB2C8\uB2E4.';
      return;
    }

    media.replaceChildren(this.createDetailPlaceholder(detail.label));
    text.textContent = '\uC544\uC9C1 \uC5F0\uACB0\uB41C \uC0AC\uC9C4\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.';
  }

  private createDetailPlaceholder(label: string) {
    const placeholder = document.createElement('span');
    placeholder.textContent = label;

    return placeholder;
  }

  private updateCurrentFloor(isGrounded: boolean, playerBottomY: number) {
    if (!isGrounded) {
      return;
    }

    const floor = getStandingFloor(playerBottomY, PLATFORM_DEFINITIONS, {
      groundSurfaceY: GROUND_SURFACE_Y,
      platformColliderYOffset: PLATFORM_COLLIDER_Y_OFFSET,
      platformColliderHalfHeight: PLATFORM_COLLIDER_HEIGHT / 2,
      tolerance: FLOOR_DETECTION_TOLERANCE,
    });

    if (floor === undefined || floor === this.currentFloor) {
      return;
    }

    this.currentFloor = floor;
    this.publishCurrentFloor();
  }

  private updateBackgroundByHeight(playerBottomY: number) {
    const estimatedFloor = getEstimatedFloorForY(playerBottomY, PLATFORM_DEFINITIONS, {
      groundSurfaceY: GROUND_SURFACE_Y,
      platformColliderYOffset: PLATFORM_COLLIDER_Y_OFFSET,
      platformColliderHalfHeight: PLATFORM_COLLIDER_HEIGHT / 2,
    });

    this.updateBackgroundForFloor(estimatedFloor);
  }

  private connectFloorHud() {
    const total = document.querySelector<HTMLElement>('#floor-hud-total');
    const input = document.querySelector<HTMLInputElement>('#floor-jump-input');
    const form = document.querySelector<HTMLFormElement>('#floor-jump-form');
    const list = document.querySelector<HTMLElement>('#floor-list');

    if (total) {
      total.textContent = `${PLATFORM_FLOOR_COUNT}\uCE35`;
    }

    if (input) {
      input.max = String(PLATFORM_FLOOR_COUNT);
    }

    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      this.teleportToFloor(this.normalizeFloorInput(input?.value));
    });

    if (list && list.childElementCount === 0) {
      for (let floor = PLATFORM_FLOOR_COUNT; floor >= 0; floor -= 1) {
        const button = document.createElement('button');
        button.className = 'floor-hud__floor';
        button.type = 'button';
        button.dataset.floor = String(floor);
        button.textContent = `${floor}\uCE35`;
        button.addEventListener('click', () => this.teleportToFloor(floor));
        list.append(button);
      }
    }
  }

  private normalizeFloorInput(value = '0') {
    const floor = Number.parseInt(value, 10);

    if (Number.isNaN(floor)) {
      return this.currentFloor;
    }

    return Phaser.Math.Clamp(floor, 0, PLATFORM_FLOOR_COUNT);
  }

  private publishCurrentFloor() {
    const current = document.querySelector<HTMLElement>('#floor-hud-current');
    const input = document.querySelector<HTMLInputElement>('#floor-jump-input');
    const buttons = document.querySelectorAll<HTMLButtonElement>('.floor-hud__floor');

    if (current) {
      current.textContent = `${this.currentFloor}\uCE35`;
    }

    if (input) {
      input.value = String(this.currentFloor);
    }

    buttons.forEach((button) => {
      const isCurrent = button.dataset.floor === String(this.currentFloor);
      button.classList.toggle('is-current', isCurrent);
      button.setAttribute('aria-current', isCurrent ? 'true' : 'false');
    });
  }

  private connectNicknameGate() {
    const form = document.querySelector<HTMLFormElement>('#nickname-form');
    const input = document.querySelector<HTMLInputElement>('#nickname-input');
    const gate = document.querySelector<HTMLElement>('#nickname-gate');

    if (!form || !input || !gate) {
      this.connectMultiplayer();
      return;
    }

    input.value = window.sessionStorage.getItem(PLAYER_NAME_SESSION_KEY) ?? '';
    this.updateMultiplayerStatus();

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      const playerName = normalizePlayerName(input.value);

      if (playerName) {
        window.sessionStorage.setItem(PLAYER_NAME_SESSION_KEY, playerName);
      } else {
        window.sessionStorage.removeItem(PLAYER_NAME_SESSION_KEY);
      }

      gate.classList.add('is-hidden');
      this.connectMultiplayer(playerName);
    });
  }

  private connectMultiplayer(playerName?: string) {
    if (this.multiplayerConnection) {
      return;
    }

    this.multiplayerConnection = createMultiplayerConnection({
      name: playerName,
      onLocalPlayerId: (id) => {
        this.localPlayerId = id;
        this.updateMultiplayerStatus();
      },
      onSnapshot: (snapshot) => {
        this.multiplayerPlayerCount = snapshot.players.length;
        this.applyMultiplayerSnapshot(snapshot);
        this.updateMultiplayerStatus();
      },
      onNotice: (notice) => {
        this.updateMultiplayerStatus(notice.message, notice.type === 'room-full' || notice.type === 'connection-lost');
      },
    });
    this.updateMultiplayerStatus('멀티플레이 연결 중');
  }

  private applyMultiplayerSnapshot(snapshot: RoomSnapshot) {
    const remoteIds = new Set<string>();

    snapshot.players.forEach((remotePlayer) => {
      if (remotePlayer.id === this.localPlayerId) {
        return;
      }

      remoteIds.add(remotePlayer.id);
      this.upsertRemotePlayer(remotePlayer);
    });

    this.remotePlayerViews.forEach((view, id) => {
      if (remoteIds.has(id)) {
        return;
      }

      view.sprite.destroy();
      view.label.destroy();
      this.remotePlayerViews.delete(id);
    });
  }

  private upsertRemotePlayer(remotePlayer: RemotePlayer) {
    const existingView = this.remotePlayerViews.get(remotePlayer.id);

    if (existingView) {
      existingView.target = remotePlayer;
      return;
    }

    const sprite = this.add
      .sprite(remotePlayer.x, remotePlayer.y + PLAYER_VISUAL_FOOT_OFFSET, PLAYER_TEXTURE_KEY, 'idle-0')
      .setOrigin(0.5, 1)
      .setScale(0.42)
      .setAlpha(0.72)
      .setDepth(20);
    const label = this.add
      .text(remotePlayer.x, remotePlayer.y - 84, remotePlayer.name, {
        color: '#fff7cc',
        fontFamily: 'system-ui, Segoe UI, sans-serif',
        fontSize: '13px',
        fontStyle: '900',
        stroke: '#20303a',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(21);

    this.remotePlayerViews.set(remotePlayer.id, {
      sprite,
      label,
      target: remotePlayer,
    });
  }

  private updateRemotePlayerViews() {
    this.remotePlayerViews.forEach(({ sprite, label, target }) => {
      sprite.x = Phaser.Math.Linear(sprite.x, target.x, REMOTE_PLAYER_LERP);
      sprite.y = Phaser.Math.Linear(sprite.y, target.y + PLAYER_VISUAL_FOOT_OFFSET, REMOTE_PLAYER_LERP);
      sprite.setFlipX(target.facing === 'right');
      sprite.play(this.getPlayerAnimationKey(target.animation), true);
      label.setPosition(sprite.x, sprite.y - 84);
    });
  }

  private sendMultiplayerUpdate(now: number, body: Phaser.Physics.Arcade.Body) {
    if (!this.multiplayerConnection || now - this.lastMultiplayerSentAt < MULTIPLAYER_SEND_INTERVAL_MS) {
      return;
    }

    this.lastMultiplayerSentAt = now;
    this.multiplayerConnection.sendPlayerUpdate({
      x: body.center.x,
      y: body.bottom,
      velocityX: body.velocity.x,
      velocityY: body.velocity.y,
      floor: this.currentFloor,
      facing: this.playerVisual.flipX ? 'right' : 'left',
      animation: this.playerAnimationState,
    });
  }

  private updateMultiplayerStatus(message?: string, isError = false) {
    const status = document.querySelector<HTMLElement>('#multiplayer-status');

    if (!status) {
      return;
    }

    status.textContent = formatMultiplayerStatus(
      message ?? (this.localPlayerId ? '멀티플레이 연결됨' : '멀티플레이 오프라인'),
      this.multiplayerPlayerCount,
    );
    status.classList.toggle('is-error', isError);
  }

  private teleportToFloor(floor: number) {
    const normalizedFloor = Phaser.Math.Clamp(Math.round(floor), 0, PLATFORM_FLOOR_COUNT);
    const target = getFloorTargetPosition(normalizedFloor, PLATFORM_DEFINITIONS, {
      groundX: PLAYER_START_X,
      groundSurfaceY: GROUND_SURFACE_Y,
      platformColliderYOffset: PLATFORM_COLLIDER_Y_OFFSET,
      platformColliderHalfHeight: PLATFORM_COLLIDER_HEIGHT / 2,
      playerHalfHeight: PLAYER_HALF_HEIGHT,
    });

    if (!target) {
      return;
    }

    if (normalizedFloor > 0) {
      this.createPlatform(normalizedFloor - 1);
    }

    this.player.setPosition(target.x, target.y);
    this.player.setVelocity(0, 0);
    this.player.setAcceleration(0, 0);

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.reset(target.x, target.y);

    this.currentFloor = normalizedFloor;
    this.updateBackgroundForFloor(normalizedFloor);
    this.publishCurrentFloor();
    this.syncPlayerVisual();
    this.updateActiveFloors(0, target.y);
    this.updateStoryObjectPopups(body.center.x, body.center.y);
    this.updateStoryDialogue(body.center.x, body.center.y);
  }

  private getStoryPhotoTextureKey(index: number) {
    return `story-photo-${index}`;
  }

  private getBackgroundTextureKey(index: number) {
    return `tower-background-${index}`;
  }

  private updateBackgroundForFloor(floor: number) {
    const backgroundIndex = getBackgroundAssetIndexForFloor(
      floor,
      BACKGROUND_ASSET_URLS.length,
      BACKGROUND_FLOOR_INTERVAL,
    );

    if (backgroundIndex === this.activeBackgroundIndex) {
      return;
    }

    this.activeBackgroundIndex = backgroundIndex;

    const nextBackground = this.add
      .image(0, 0, this.getBackgroundTextureKey(backgroundIndex))
      .setOrigin(0, 0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setScrollFactor(0)
      .setAlpha(0)
      .setDepth(-19);

    this.tweens.add({
      targets: nextBackground,
      alpha: 1,
      duration: BACKGROUND_FADE_DURATION_MS,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.backgroundLayer.destroy();
        this.backgroundLayer = nextBackground;
        this.backgroundLayer.setDepth(-20);
      },
    });
  }

  private createAnimations() {
    this.anims.create({
      key: 'player-idle',
      frames: [{ key: PLAYER_TEXTURE_KEY, frame: 'idle-0' }],
      frameRate: 1,
      repeat: -1,
    });

    this.anims.create({
      key: 'player-run',
      frames: [
        { key: PLAYER_TEXTURE_KEY, frame: 'walk-0' },
        { key: PLAYER_TEXTURE_KEY, frame: 'walk-1' },
        { key: PLAYER_TEXTURE_KEY, frame: 'walk-2' },
        { key: PLAYER_TEXTURE_KEY, frame: 'walk-1' },
      ],
      frameRate: 9,
      repeat: -1,
    });

    this.anims.create({
      key: 'player-jump',
      frames: [
        { key: PLAYER_TEXTURE_KEY, frame: 'jump-0' },
        { key: PLAYER_TEXTURE_KEY, frame: 'jump-1' },
      ],
      frameRate: 5,
      repeat: -1,
    });

    this.anims.create({
      key: 'player-crouch',
      frames: [
        { key: PLAYER_TEXTURE_KEY, frame: 'crouch-0' },
        { key: PLAYER_TEXTURE_KEY, frame: 'crouch-1' },
        { key: PLAYER_TEXTURE_KEY, frame: 'crouch-2' },
        { key: PLAYER_TEXTURE_KEY, frame: 'crouch-3' },
      ],
      frameRate: 6,
      repeat: -1,
    });
  }

  private updatePlayerAnimation(isGrounded: boolean, isMoving: boolean, isCrouching: boolean) {
    if (!isGrounded) {
      this.playerAnimationState = 'jump';
      this.playerVisual.play('player-jump', true);
      return;
    }

    if (isCrouching) {
      this.playerAnimationState = 'crouch';
      this.playerVisual.play('player-crouch', true);
      return;
    }

    if (isMoving) {
      this.playerAnimationState = 'run';
      this.playerVisual.play('player-run', true);
      return;
    }

    this.playerAnimationState = 'idle';
    this.playerVisual.play('player-idle', true);
  }

  private getPlayerAnimationKey(animation: PlayerAnimation) {
    return `player-${animation}`;
  }

  private syncPlayerVisual() {
    const body = this.player.body as Phaser.Physics.Arcade.Body;

    this.playerVisual.setPosition(body.center.x, body.bottom + PLAYER_VISUAL_FOOT_OFFSET);
  }

  private isJumpReleased() {
    return this.jumpKey.isUp && Boolean(this.cursors.up?.isUp);
  }

  private setPhysicsDebug(enabled: boolean) {
    this.debugEnabled = enabled;
    this.physics.world.drawDebug = enabled;
    this.physics.world.debugGraphic.setVisible(enabled);

    if (!enabled) {
      this.physics.world.debugGraphic.clear();
    }
  }

  private registerPlayerFrames() {
    const texture = this.textures.get(PLAYER_TEXTURE_KEY);

    PLAYER_FRAMES.forEach(({ name, x, y, width, height }) => {
      if (!texture.has(name)) {
        texture.add(name, 0, x, y, width, height);
      }
    });
  }

  private createRectTexture(
    key: string,
    width: number,
    height: number,
    color: number,
  ) {
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(color, 1);
    graphics.fillRect(0, 0, width, height);
    graphics.generateTexture(key, width, height);
    graphics.destroy();
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'app',
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 940 },
      debug: true,
    },
  },
  scene: MainScene,
};

new Phaser.Game(config);

async function loadSupabaseStoryPhotosSafely() {
  try {
    return await loadStoryPhotosFromSupabase();
  } catch (error) {
    console.warn(error);
    return [];
  }
}

async function loadSupabaseStoryDialoguesSafely(): Promise<StoryDialogueSource[]> {
  try {
    return await loadStoryDialoguesFromSupabase();
  } catch (error) {
    console.warn(error);
    return [];
  }
}
