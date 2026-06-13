import Phaser from 'phaser';
import './style.css';
import {
  createDefaultEditableMapLayout,
  type EditableChairDefinition,
  type EditableMapLayout,
  type EditablePlatformDefinition,
} from './mapLayout';
import { loadActiveMapLayout } from './mapLayoutSource';
import { type StoryDialogueDefinition, type StoryObjectDefinition } from './platformLayout';
import { createMultiplayerConnection, getAdminJoinCode } from './multiplayerClient';

const GAME_WIDTH = 1200;
const GAME_HEIGHT = 676;
const WORLD_HEIGHT = 10419;
const FIRST_PLATFORM_Y = WORLD_HEIGHT - 145;
const PLATFORM_WIDTH = 128;
const PLATFORM_HEIGHT = 18;
const PHOTO_RADIUS = 15;
const DIALOGUE_RADIUS = 15;
const CHAIR_WIDTH = 54;
const CHAIR_HEIGHT = 42;
const FLOOR_GAP = 126;
const DEFAULT_LAYOUT = createDefaultEditableMapLayout({
  floorCount: 80,
  leftX: 360,
  rightX: 600,
  bottomY: FIRST_PLATFORM_Y,
  verticalGap: FLOOR_GAP,
});

type EditorTool = 'select' | 'platform' | 'object';
type ObjectKind = 'photo' | 'dialogue' | 'chair';
type SelectedItem =
  | { type: 'platform'; id: string }
  | { type: 'photo'; id: string }
  | { type: 'dialogue'; id: string }
  | { type: 'chair'; id: string };

let layout: EditableMapLayout = DEFAULT_LAYOUT;
let selectedItem: SelectedItem | undefined;
let activeTool: EditorTool = 'select';
let activeObjectKind: ObjectKind = 'photo';

const status = document.querySelector<HTMLElement>('#editor-status');
const labelInput = document.querySelector<HTMLInputElement>('#editor-label');
const titleInput = document.querySelector<HTMLInputElement>('#editor-title');
const descriptionInput = document.querySelector<HTMLTextAreaElement>('#editor-description');
const speakerInput = document.querySelector<HTMLInputElement>('#editor-speaker');
const messageInput = document.querySelector<HTMLTextAreaElement>('#editor-message');
const facingInput = document.querySelector<HTMLSelectElement>('#editor-facing');
const itemList = document.querySelector<HTMLElement>('#editor-item-list');
const floorLabel = document.querySelector<HTMLElement>('#editor-floor');
const yLabel = document.querySelector<HTMLElement>('#editor-y');
const scrollThumb = document.querySelector<HTMLElement>('#editor-scroll-thumb');
const connection = createMultiplayerConnection({
  adminCode: getAdminJoinCode(new URL(window.location.href)),
  name: 'Map Editor',
  onSnapshot: () => undefined,
  onMapUpdated: () => {
    setStatus('Saved and published');
  },
  onMapSaveFailed: (message) => {
    setStatus(message.message);
  },
});

class EditorScene extends Phaser.Scene {
  private graphics!: Phaser.GameObjects.Graphics;
  private dragOffset?: Phaser.Math.Vector2;

  constructor() {
    super('EditorScene');
  }

  create() {
    this.cameras.main.setBounds(0, 0, GAME_WIDTH, WORLD_HEIGHT);
    this.cameras.main.scrollY = WORLD_HEIGHT - GAME_HEIGHT;
    this.graphics = this.add.graphics();
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.handlePointerDown(pointer));
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.handlePointerMove(pointer));
    this.input.on('pointerup', () => {
      this.dragOffset = undefined;
    });
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objects: unknown[], _dx: number, dy: number) => {
      this.cameras.main.scrollY = Phaser.Math.Clamp(this.cameras.main.scrollY + dy, 0, WORLD_HEIGHT - GAME_HEIGHT);
      this.renderLayout();
    });
    this.renderLayout();
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer) {
    const worldPoint = this.getWorldPoint(pointer);

    if (activeTool === 'platform') {
      const platform: EditablePlatformDefinition = {
        id: `platform-${crypto.randomUUID()}`,
        x: Math.round(worldPoint.x),
        y: Math.round(worldPoint.y),
        texture: 'platform',
      };
      layout = { ...layout, platforms: [...layout.platforms, platform] };
      selectedItem = { type: 'platform', id: platform.id };
      syncEditor();
      return;
    }

    if (activeTool === 'object') {
      selectedItem = createObjectAt(worldPoint.x, worldPoint.y, activeObjectKind);
      syncEditor();
      return;
    }

    selectedItem = findNearestItem(worldPoint.x, worldPoint.y);
    this.dragOffset = selectedItem
      ? getDragOffset(selectedItem, worldPoint)
      : undefined;
    syncEditor();
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer) {
    if (!pointer.isDown || !selectedItem || !this.dragOffset || activeTool !== 'select') {
      return;
    }

    const worldPoint = this.getWorldPoint(pointer);
    const x = Math.round(worldPoint.x - this.dragOffset.x);
    const y = Math.round(worldPoint.y - this.dragOffset.y);

    moveSelectedItem(selectedItem, x, y);
    syncEditor();
  }

  private getWorldPoint(pointer: Phaser.Input.Pointer) {
    return pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
  }

  renderLayout() {
    this.graphics.clear();
    this.graphics.fillStyle(0xeaf7ff, 1);
    this.graphics.fillRect(0, 0, GAME_WIDTH, WORLD_HEIGHT);
    this.graphics.lineStyle(1, 0xc9d8e3, 0.65);

    for (let y = 0; y <= WORLD_HEIGHT; y += FLOOR_GAP) {
      this.graphics.lineBetween(0, y, GAME_WIDTH, y);
    }

    layout.platforms.forEach((platform) => this.drawPlatform(platform));
    layout.storyObjects.forEach((object) => this.drawPhotoObject(object));
    layout.dialogues.forEach((dialogue) => this.drawDialogueObject(dialogue));
    layout.chairs.forEach((chair) => this.drawChairObject(chair));
    updatePositionMeter(this.cameras.main.scrollY);
  }

  private drawPlatform(platform: EditablePlatformDefinition) {
    const selected = isSelected('platform', platform.id);
    this.graphics.fillStyle(0x315f7a, 0.18);
    this.graphics.fillRoundedRect(platform.x - PLATFORM_WIDTH / 2 + 4, platform.y - 3, PLATFORM_WIDTH, 16, 5);
    this.graphics.fillStyle(selected ? 0xf4d35e : 0x5aa9e6, 1);
    this.graphics.lineStyle(2, selected ? 0x7c5c00 : 0x2d6f9f, 1);
    this.graphics.fillRoundedRect(
      platform.x - PLATFORM_WIDTH / 2,
      platform.y - PLATFORM_HEIGHT / 2,
      PLATFORM_WIDTH,
      PLATFORM_HEIGHT,
      6,
    );
    this.graphics.strokeRoundedRect(
      platform.x - PLATFORM_WIDTH / 2,
      platform.y - PLATFORM_HEIGHT / 2,
      PLATFORM_WIDTH,
      PLATFORM_HEIGHT,
      6,
    );
  }

  private drawPhotoObject(object: StoryObjectDefinition) {
    const selected = isSelected('photo', object.id);
    this.graphics.fillStyle(selected ? 0xf4d35e : 0xf25f5c, 1);
    this.graphics.lineStyle(3, selected ? 0x7c5c00 : 0x8f2d2b, 1);
    this.graphics.fillCircle(object.x, object.y, PHOTO_RADIUS);
    this.graphics.strokeCircle(object.x, object.y, PHOTO_RADIUS);
    this.graphics.fillStyle(0xffffff, 0.92);
    this.graphics.fillRect(object.x - 7, object.y - 5, 14, 10);
  }

  private drawDialogueObject(dialogue: StoryDialogueDefinition) {
    const selected = isSelected('dialogue', dialogue.id);
    this.graphics.fillStyle(selected ? 0xf4d35e : 0x38bdf8, 1);
    this.graphics.lineStyle(3, selected ? 0x7c5c00 : 0x075985, 1);
    this.graphics.fillCircle(dialogue.x, dialogue.y, DIALOGUE_RADIUS);
    this.graphics.strokeCircle(dialogue.x, dialogue.y, DIALOGUE_RADIUS);
    this.graphics.fillStyle(0xffffff, 0.95);
    this.graphics.fillCircle(dialogue.x - 5, dialogue.y - 1, 2);
    this.graphics.fillCircle(dialogue.x, dialogue.y - 1, 2);
    this.graphics.fillCircle(dialogue.x + 5, dialogue.y - 1, 2);
  }

  private drawChairObject(chair: EditableChairDefinition) {
    const selected = isSelected('chair', chair.id);
    this.graphics.fillStyle(selected ? 0xf4d35e : 0x8b5e34, 1);
    this.graphics.lineStyle(3, selected ? 0x7c5c00 : 0x4a2c15, 1);
    this.graphics.fillRoundedRect(chair.x - CHAIR_WIDTH / 2, chair.y - CHAIR_HEIGHT / 2, CHAIR_WIDTH, CHAIR_HEIGHT, 7);
    this.graphics.strokeRoundedRect(chair.x - CHAIR_WIDTH / 2, chair.y - CHAIR_HEIGHT / 2, CHAIR_WIDTH, CHAIR_HEIGHT, 7);
    this.graphics.fillStyle(0xfff2cf, 1);
    this.graphics.fillRect(chair.x - 16, chair.y - 4, 32, 7);
  }
}

await loadInitialLayout();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'editor-canvas',
  backgroundColor: '#eaf7ff',
  scene: EditorScene,
});

connectToolbar();
connectForm();
connectKeyboard();
syncEditor();

async function loadInitialLayout() {
  try {
    layout = (await loadActiveMapLayout())?.layout ?? DEFAULT_LAYOUT;
    setStatus('Ready');
  } catch (error) {
    console.warn(error);
    layout = DEFAULT_LAYOUT;
    setStatus('Supabase unavailable, using default map');
  }
}

function connectToolbar() {
  bindTool('tool-select', 'select');
  bindTool('tool-platform', 'platform');
  bindTool('tool-object', 'object');
  bindObjectKind('kind-photo', 'photo');
  bindObjectKind('kind-dialogue', 'dialogue');
  bindObjectKind('kind-chair', 'chair');

  document.querySelector<HTMLButtonElement>('#delete-selected')?.addEventListener('click', () => {
    deleteSelectedItem();
  });

  document.querySelector<HTMLButtonElement>('#save-map')?.addEventListener('click', () => {
    void saveMap();
  });
}

function connectForm() {
  [labelInput, titleInput, descriptionInput, speakerInput, messageInput, facingInput].forEach((input) => {
    input?.addEventListener('input', () => {
      updateSelectedFromForm();
      syncEditor();
    });
  });
}

function connectKeyboard() {
  window.addEventListener('keydown', (event) => {
    if ((event.key !== 'Delete' && event.key !== 'Backspace') || isTypingTarget(event.target)) {
      return;
    }

    event.preventDefault();
    deleteSelectedItem();
  });
}

function bindTool(buttonId: string, tool: EditorTool) {
  document.querySelector<HTMLButtonElement>(`#${buttonId}`)?.addEventListener('click', () => {
    activeTool = tool;
    document.querySelectorAll('.editor-tools__button').forEach((button) => {
      button.classList.toggle('is-active', button.id === buttonId);
    });
  });
}

function bindObjectKind(buttonId: string, kind: ObjectKind) {
  document.querySelector<HTMLButtonElement>(`#${buttonId}`)?.addEventListener('click', () => {
    activeObjectKind = kind;
    activeTool = 'object';
    document.querySelectorAll('.editor-palette__button').forEach((button) => {
      button.classList.toggle('is-active', button.id === buttonId);
    });
    document.querySelectorAll('.editor-tools__button').forEach((button) => {
      button.classList.toggle('is-active', button.id === 'tool-object');
    });
  });
}

async function saveMap() {
  if (!connection?.sendMapSave(layout)) {
    setStatus('Realtime connection unavailable');
    return;
  }

  setStatus('Saving on server');
}

function createObjectAt(x: number, y: number, kind: ObjectKind): SelectedItem {
  if (kind === 'dialogue') {
    const dialogue: StoryDialogueDefinition = {
      id: `dialogue-object-${crypto.randomUUID()}`,
      x: Math.round(x),
      y: Math.round(y),
      speaker: speakerInput?.value.trim() || 'Story',
      message: messageInput?.value.trim() || 'Message',
    };
    layout = { ...layout, dialogues: [...layout.dialogues, dialogue] };
    return { type: 'dialogue', id: dialogue.id };
  }

  if (kind === 'chair') {
    const chair: EditableChairDefinition = {
      id: `chair-${crypto.randomUUID()}`,
      x: Math.round(x),
      y: Math.round(y),
      facing: facingInput?.value === 'right' ? 'right' : 'left',
      seatX: Math.round(x),
      seatY: Math.round(y - 16),
      triggerDistance: 82,
    };
    layout = { ...layout, chairs: [...layout.chairs, chair] };
    return { type: 'chair', id: chair.id };
  }

  const object: StoryObjectDefinition = {
    id: `story-object-${crypto.randomUUID()}`,
    x: Math.round(x),
    y: Math.round(y),
    label: labelInput?.value.trim() || 'Ready',
    title: titleInput?.value.trim() || undefined,
    description: descriptionInput?.value.trim() || undefined,
  };
  layout = { ...layout, storyObjects: [...layout.storyObjects, object] };
  return { type: 'photo', id: object.id };
}

function updateSelectedFromForm() {
  if (!selectedItem) {
    return;
  }

  if (selectedItem.type === 'photo') {
    layout = {
      ...layout,
      storyObjects: layout.storyObjects.map((object) => object.id === selectedItem?.id
        ? {
          ...object,
          label: labelInput?.value.trim() || 'Ready',
          title: titleInput?.value.trim() || undefined,
          description: descriptionInput?.value.trim() || undefined,
        }
        : object),
    };
    return;
  }

  if (selectedItem.type === 'dialogue') {
    layout = {
      ...layout,
      dialogues: layout.dialogues.map((dialogue) => dialogue.id === selectedItem?.id
        ? {
          ...dialogue,
          speaker: speakerInput?.value.trim() || 'Story',
          message: messageInput?.value.trim() || 'Message',
        }
        : dialogue),
    };
    return;
  }

  if (selectedItem.type === 'chair') {
    layout = {
      ...layout,
      chairs: layout.chairs.map((chair) => chair.id === selectedItem?.id
        ? {
          ...chair,
          facing: facingInput?.value === 'right' ? 'right' : 'left',
        }
        : chair),
    };
  }
}

function syncEditor() {
  syncForm();
  renderItemList();
  getEditorScene()?.renderLayout();
}

function syncForm() {
  const photo = selectedItem?.type === 'photo'
    ? layout.storyObjects.find((item) => item.id === selectedItem?.id)
    : undefined;
  const dialogue = selectedItem?.type === 'dialogue'
    ? layout.dialogues.find((item) => item.id === selectedItem?.id)
    : undefined;
  const chair = selectedItem?.type === 'chair'
    ? layout.chairs.find((item) => item.id === selectedItem?.id)
    : undefined;

  if (labelInput) {
    labelInput.value = photo?.label ?? 'Ready';
  }

  if (titleInput) {
    titleInput.value = photo?.title ?? '';
  }

  if (descriptionInput) {
    descriptionInput.value = photo?.description ?? '';
  }

  if (speakerInput) {
    speakerInput.value = dialogue?.speaker ?? '';
  }

  if (messageInput) {
    messageInput.value = dialogue?.message ?? '';
  }

  if (facingInput) {
    facingInput.value = chair?.facing ?? 'left';
  }
}

function renderItemList() {
  if (!itemList) {
    return;
  }

  const items = [
    ...layout.platforms.map((item) => ({ type: 'platform' as const, id: item.id, label: `Platform (${item.x}, ${item.y})` })),
    ...layout.storyObjects.map((item) => ({ type: 'photo' as const, id: item.id, label: `Photo ${item.title ?? item.label}` })),
    ...layout.dialogues.map((item) => ({ type: 'dialogue' as const, id: item.id, label: `Dialogue ${item.speaker}` })),
    ...layout.chairs.map((item) => ({ type: 'chair' as const, id: item.id, label: `Chair ${item.facing}` })),
  ];

  itemList.replaceChildren(...items.map((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'editor-item-list__button';
    button.classList.toggle('is-selected', isSelected(item.type, item.id));
    button.textContent = item.label;
    button.addEventListener('click', () => {
      selectedItem = { type: item.type, id: item.id };
      activeTool = 'select';
      document.querySelectorAll('.editor-tools__button').forEach((toolButton) => {
        toolButton.classList.toggle('is-active', toolButton.id === 'tool-select');
      });
      syncEditor();
    });

    return button;
  }));
}

function deleteSelectedItem() {
  if (!selectedItem) {
    return;
  }

  layout = {
    ...layout,
    platforms: selectedItem.type === 'platform'
      ? layout.platforms.filter((platform) => platform.id !== selectedItem?.id)
      : layout.platforms,
    storyObjects: selectedItem.type === 'photo'
      ? layout.storyObjects.filter((object) => object.id !== selectedItem?.id)
      : layout.storyObjects,
    dialogues: selectedItem.type === 'dialogue'
      ? layout.dialogues.filter((dialogue) => dialogue.id !== selectedItem?.id)
      : layout.dialogues,
    chairs: selectedItem.type === 'chair'
      ? layout.chairs.filter((chair) => chair.id !== selectedItem?.id)
      : layout.chairs,
  };
  selectedItem = undefined;
  syncEditor();
}

function findNearestItem(x: number, y: number): SelectedItem | undefined {
  const platform = layout.platforms.find((item) => Math.abs(item.x - x) <= 72 && Math.abs(item.y - y) <= 24);

  if (platform) {
    return { type: 'platform', id: platform.id };
  }

  const photo = layout.storyObjects.find((item) => Math.hypot(item.x - x, item.y - y) <= 24);

  if (photo) {
    return { type: 'photo', id: photo.id };
  }

  const dialogue = layout.dialogues.find((item) => Math.hypot(item.x - x, item.y - y) <= 24);

  if (dialogue) {
    return { type: 'dialogue', id: dialogue.id };
  }

  const chair = layout.chairs.find((item) => Math.abs(item.x - x) <= CHAIR_WIDTH / 2 && Math.abs(item.y - y) <= CHAIR_HEIGHT / 2);

  return chair ? { type: 'chair', id: chair.id } : undefined;
}

function getDragOffset(item: SelectedItem, point: Phaser.Math.Vector2) {
  const selectedPoint = getSelectedPoint(item);

  return selectedPoint
    ? new Phaser.Math.Vector2(point.x - selectedPoint.x, point.y - selectedPoint.y)
    : undefined;
}

function getSelectedPoint(item: SelectedItem) {
  if (item.type === 'platform') {
    return layout.platforms.find((platform) => platform.id === item.id);
  }

  if (item.type === 'photo') {
    return layout.storyObjects.find((object) => object.id === item.id);
  }

  if (item.type === 'dialogue') {
    return layout.dialogues.find((dialogue) => dialogue.id === item.id);
  }

  return layout.chairs.find((chair) => chair.id === item.id);
}

function moveSelectedItem(item: SelectedItem, x: number, y: number) {
  if (item.type === 'platform') {
    layout = {
      ...layout,
      platforms: layout.platforms.map((platform) => platform.id === item.id ? { ...platform, x, y } : platform),
    };
    return;
  }

  if (item.type === 'photo') {
    layout = {
      ...layout,
      storyObjects: layout.storyObjects.map((object) => object.id === item.id ? { ...object, x, y } : object),
    };
    return;
  }

  if (item.type === 'dialogue') {
    layout = {
      ...layout,
      dialogues: layout.dialogues.map((dialogue) => dialogue.id === item.id ? { ...dialogue, x, y } : dialogue),
    };
    return;
  }

  layout = {
    ...layout,
    chairs: layout.chairs.map((chair) => chair.id === item.id
      ? { ...chair, x, y, seatX: x, seatY: y - 16 }
      : chair),
  };
}

function updatePositionMeter(scrollY: number) {
  if (floorLabel) {
    floorLabel.textContent = `Floor ${Math.max(0, Math.round((WORLD_HEIGHT - scrollY - GAME_HEIGHT) / FLOOR_GAP))}`;
  }

  if (yLabel) {
    yLabel.textContent = `Y ${Math.round(scrollY)} / ${WORLD_HEIGHT}`;
  }

  if (scrollThumb) {
    const trackHeight = 150;
    const thumbHeight = Math.max(28, (GAME_HEIGHT / WORLD_HEIGHT) * trackHeight);
    const maxTop = trackHeight - thumbHeight;
    const progress = scrollY / Math.max(1, WORLD_HEIGHT - GAME_HEIGHT);
    scrollThumb.style.height = `${thumbHeight}px`;
    scrollThumb.style.transform = `translateY(${Math.round(progress * maxTop)}px)`;
  }
}

function isSelected(type: SelectedItem['type'], id: string) {
  return selectedItem?.type === type && selectedItem.id === id;
}

function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement;
}

function getEditorScene() {
  return game.scene.getScene('EditorScene') as EditorScene | undefined;
}

function setStatus(message: string) {
  if (status) {
    status.textContent = message;
  }
}
