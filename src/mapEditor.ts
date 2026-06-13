import Phaser from 'phaser';
import './style.css';
import { createDefaultEditableMapLayout, type EditableMapLayout } from './mapLayout';
import { loadActiveMapLayout } from './mapLayoutSource';
import { createMultiplayerConnection, getAdminJoinCode } from './multiplayerClient';

const GAME_WIDTH = 1200;
const GAME_HEIGHT = 676;
const WORLD_HEIGHT = 10419;
const FIRST_PLATFORM_Y = WORLD_HEIGHT - 145;
const PLATFORM_WIDTH = 128;
const PLATFORM_HEIGHT = 18;
const OBJECT_RADIUS = 14;
const DEFAULT_LAYOUT = createDefaultEditableMapLayout({
  floorCount: 80,
  leftX: 360,
  rightX: 600,
  bottomY: FIRST_PLATFORM_Y,
  verticalGap: 126,
});

type EditorTool = 'select' | 'platform' | 'object';
type SelectedItem = {
  type: 'platform' | 'object';
  id: string;
};

let layout: EditableMapLayout = DEFAULT_LAYOUT;
let selectedItem: SelectedItem | undefined;
let activeTool: EditorTool = 'select';

const status = document.querySelector<HTMLElement>('#editor-status');
const labelInput = document.querySelector<HTMLInputElement>('#editor-label');
const titleInput = document.querySelector<HTMLInputElement>('#editor-title');
const descriptionInput = document.querySelector<HTMLTextAreaElement>('#editor-description');
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
      const platform = {
        id: `platform-${crypto.randomUUID()}`,
        x: Math.round(worldPoint.x),
        y: Math.round(worldPoint.y),
        texture: 'platform' as const,
      };
      layout = { ...layout, platforms: [...layout.platforms, platform] };
      selectedItem = { type: 'platform', id: platform.id };
      this.renderLayout();
      return;
    }

    if (activeTool === 'object') {
      const object = {
        id: `story-object-${crypto.randomUUID()}`,
        x: Math.round(worldPoint.x),
        y: Math.round(worldPoint.y),
        label: labelInput?.value.trim() || 'Ready',
        title: titleInput?.value.trim() || undefined,
        description: descriptionInput?.value.trim() || undefined,
      };
      layout = { ...layout, storyObjects: [...layout.storyObjects, object] };
      selectedItem = { type: 'object', id: object.id };
      syncForm();
      this.renderLayout();
      return;
    }

    selectedItem = findNearestItem(worldPoint.x, worldPoint.y);
    this.dragOffset = selectedItem
      ? getDragOffset(selectedItem, worldPoint)
      : undefined;
    syncForm();
    this.renderLayout();
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer) {
    if (!pointer.isDown || !selectedItem || !this.dragOffset || activeTool !== 'select') {
      return;
    }

    const worldPoint = this.getWorldPoint(pointer);
    const x = Math.round(worldPoint.x - this.dragOffset.x);
    const y = Math.round(worldPoint.y - this.dragOffset.y);

    moveSelectedItem(selectedItem, x, y);
    this.renderLayout();
  }

  private getWorldPoint(pointer: Phaser.Input.Pointer) {
    return pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
  }

  renderLayout() {
    this.graphics.clear();
    this.graphics.fillStyle(0xeaf7ff, 1);
    this.graphics.fillRect(0, 0, GAME_WIDTH, WORLD_HEIGHT);
    this.graphics.lineStyle(1, 0xc9d8e3, 0.6);

    for (let y = 0; y <= WORLD_HEIGHT; y += 126) {
      this.graphics.lineBetween(0, y, GAME_WIDTH, y);
    }

    layout.platforms.forEach((platform) => {
      this.graphics.fillStyle(isSelected('platform', platform.id) ? 0xf4d35e : 0x5aa9e6, 1);
      this.graphics.fillRoundedRect(
        platform.x - PLATFORM_WIDTH / 2,
        platform.y - PLATFORM_HEIGHT / 2,
        PLATFORM_WIDTH,
        PLATFORM_HEIGHT,
        6,
      );
    });

    layout.storyObjects.forEach((object) => {
      this.graphics.fillStyle(isSelected('object', object.id) ? 0xf4d35e : 0xf25f5c, 1);
      this.graphics.fillCircle(object.x, object.y, OBJECT_RADIUS);
    });
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

  document.querySelector<HTMLButtonElement>('#delete-selected')?.addEventListener('click', () => {
    if (!selectedItem) {
      return;
    }

    layout = {
      ...layout,
      platforms: selectedItem.type === 'platform'
        ? layout.platforms.filter((platform) => platform.id !== selectedItem?.id)
        : layout.platforms,
      storyObjects: selectedItem.type === 'object'
        ? layout.storyObjects.filter((object) => object.id !== selectedItem?.id)
        : layout.storyObjects,
    };
    selectedItem = undefined;
    syncForm();
    getEditorScene()?.renderLayout();
  });

  document.querySelector<HTMLButtonElement>('#save-map')?.addEventListener('click', () => {
    void saveMap();
  });
}

function connectForm() {
  [labelInput, titleInput, descriptionInput].forEach((input) => {
    input?.addEventListener('input', () => {
      if (selectedItem?.type !== 'object') {
        return;
      }

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
      getEditorScene()?.renderLayout();
    });
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

async function saveMap() {
  if (!connection?.sendMapSave(layout)) {
    setStatus('Realtime connection unavailable');
    return;
  }

  setStatus('Saving on server');
}

function syncForm() {
  const object = selectedItem?.type === 'object'
    ? layout.storyObjects.find((item) => item.id === selectedItem?.id)
    : undefined;

  if (labelInput) {
    labelInput.value = object?.label ?? 'Ready';
  }

  if (titleInput) {
    titleInput.value = object?.title ?? '';
  }

  if (descriptionInput) {
    descriptionInput.value = object?.description ?? '';
  }
}

function findNearestItem(x: number, y: number): SelectedItem | undefined {
  const platform = layout.platforms.find((item) => Math.abs(item.x - x) <= 72 && Math.abs(item.y - y) <= 24);

  if (platform) {
    return { type: 'platform', id: platform.id };
  }

  const object = layout.storyObjects.find((item) => Math.hypot(item.x - x, item.y - y) <= 24);

  return object ? { type: 'object', id: object.id } : undefined;
}

function getDragOffset(item: SelectedItem, point: Phaser.Math.Vector2) {
  const selectedPoint = item.type === 'platform'
    ? layout.platforms.find((platform) => platform.id === item.id)
    : layout.storyObjects.find((object) => object.id === item.id);

  return selectedPoint
    ? new Phaser.Math.Vector2(point.x - selectedPoint.x, point.y - selectedPoint.y)
    : undefined;
}

function moveSelectedItem(item: SelectedItem, x: number, y: number) {
  if (item.type === 'platform') {
    layout = {
      ...layout,
      platforms: layout.platforms.map((platform) => platform.id === item.id ? { ...platform, x, y } : platform),
    };
    return;
  }

  layout = {
    ...layout,
    storyObjects: layout.storyObjects.map((object) => object.id === item.id ? { ...object, x, y } : object),
  };
}

function isSelected(type: SelectedItem['type'], id: string) {
  return selectedItem?.type === type && selectedItem.id === id;
}

function getEditorScene() {
  return game.scene.getScene('EditorScene') as EditorScene | undefined;
}

function setStatus(message: string) {
  if (status) {
    status.textContent = message;
  }
}
