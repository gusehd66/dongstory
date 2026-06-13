export type PlayerFacing = 'left' | 'right';
export type PlayerAnimation = 'idle' | 'run' | 'jump' | 'crouch' | 'sit';
export type PlayerRole = 'admin' | 'normal';

export type LocalPlayerUpdate = {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  floor: number;
  facing: PlayerFacing;
  animation: PlayerAnimation;
};

export type RemotePlayer = LocalPlayerUpdate & {
  id: string;
  name: string;
  role: PlayerRole;
};

export type RemotePlayerInterpolationSample = {
  receivedAt: number;
  player: RemotePlayer;
};

export type RoomSnapshot = {
  players: RemotePlayer[];
};

export type ChatMessage = {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  sentAt: number;
};

export type MapUpdatedMessage = {
  type: 'map:updated';
  version: number;
};

export type MultiplayerNotice = {
  type: 'room-full' | 'connection-lost' | 'reconnecting' | 'connected';
  message: string;
};

export type MultiplayerConnection = {
  readonly localPlayerId?: string;
  sendPlayerUpdate: (update: LocalPlayerUpdate) => void;
  sendChatMessage: (text: string) => boolean;
  sendMapPublish: (version: number) => boolean;
  disconnect: () => void;
};

export type MultiplayerConnectionOptions = {
  url?: string;
  name?: string;
  adminCode?: string;
  onSnapshot: (snapshot: RoomSnapshot) => void;
  onChatMessage?: (message: ChatMessage) => void;
  onMapUpdated?: (message: MapUpdatedMessage) => void;
  onLocalPlayerId?: (id: string) => void;
  onLocalPlayer?: (player: RemotePlayer) => void;
  onNotice?: (notice: MultiplayerNotice) => void;
};

type WelcomeMessage = {
  type: 'player:welcome';
  id: string;
  player: RemotePlayer;
};

export function createMultiplayerUrl(pageLocation: URL, devPort = 3010) {
  const protocol = pageLocation.protocol === 'https:' ? 'wss:' : 'ws:';
  const isViteDevServer = pageLocation.hostname === 'localhost' && pageLocation.port === '5173';
  const port = isViteDevServer
    ? `:${devPort}`
    : pageLocation.port ? `:${pageLocation.port}` : '';

  return `${protocol}//${pageLocation.hostname}${port}`;
}

export function normalizeRoomSnapshot(value: unknown): RoomSnapshot {
  if (!isRecord(value) || value.type !== 'room:snapshot' || !Array.isArray(value.players)) {
    return { players: [] };
  }

  return {
    players: value.players.flatMap((player) => {
      const normalizedPlayer = normalizeRemotePlayer(player);

      return normalizedPlayer ? [normalizedPlayer] : [];
    }),
  };
}

export function createMultiplayerConnection({
  url = createMultiplayerUrl(new URL(window.location.href)),
  name,
  adminCode,
  onSnapshot,
  onChatMessage,
  onMapUpdated,
  onLocalPlayerId,
  onLocalPlayer,
  onNotice,
}: MultiplayerConnectionOptions): MultiplayerConnection | undefined {
  if (!('WebSocket' in window)) {
    return undefined;
  }

  let socket: WebSocket | undefined;
  let localPlayerId: string | undefined;
  let reconnectAttempt = 0;
  let reconnectTimer: number | undefined;
  let wasDisconnected = false;
  let isClosedByClient = false;
  let lastUpdate: LocalPlayerUpdate | undefined;

  connect();

  function connect() {
    socket = new WebSocket(url);

    socket.addEventListener('open', () => {
      socket?.send(JSON.stringify({ type: 'player:join', name, adminCode }));
    });

    socket.addEventListener('message', (event) => {
      const message = parseJson(event.data);

      if (isWelcomeMessage(message)) {
        localPlayerId = message.id;
        reconnectAttempt = 0;
        onLocalPlayerId?.(message.id);
        onLocalPlayer?.(message.player);
        onNotice?.({
          type: 'connected',
          message: wasDisconnected ? '멀티플레이 다시 연결됨' : '멀티플레이 연결됨',
        });
        wasDisconnected = false;

        if (lastUpdate) {
          socket?.send(JSON.stringify({ type: 'player:update', ...lastUpdate }));
        }

        return;
      }

      if (isRoomSnapshotMessage(message)) {
        onSnapshot(normalizeRoomSnapshot(message));
        return;
      }

      const chatMessage = normalizeChatMessage(message);

      if (chatMessage) {
        onChatMessage?.(chatMessage);
        return;
      }

      const mapUpdatedMessage = normalizeMapUpdatedMessage(message);

      if (mapUpdatedMessage) {
        onMapUpdated?.(mapUpdatedMessage);
        return;
      }

      const notice = normalizeMultiplayerNotice(message);

      if (notice) {
        onNotice?.(notice);
      }
    });

    socket.addEventListener('close', () => {
      if (isClosedByClient) {
        return;
      }

      wasDisconnected = true;
      localPlayerId = undefined;
      onNotice?.({
        type: 'connection-lost',
        message: '연결이 끊겼습니다. 다시 연결 중...',
      });
      scheduleReconnect();
    });
  }

  function scheduleReconnect() {
    if (reconnectTimer !== undefined) {
      return;
    }

    const delay = getReconnectDelay(reconnectAttempt);
    reconnectAttempt += 1;
    onNotice?.({
      type: 'reconnecting',
      message: '멀티플레이 재연결 중',
    });
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = undefined;
      connect();
    }, delay);
  }

  return {
    get localPlayerId() {
      return localPlayerId;
    },
    sendPlayerUpdate(update) {
      lastUpdate = update;

      if (socket?.readyState !== WebSocket.OPEN) {
        return;
      }

      socket.send(JSON.stringify({ type: 'player:update', ...update }));
    },
    sendChatMessage(text) {
      const normalizedText = normalizeOutgoingChatText(text);

      if (!normalizedText || socket?.readyState !== WebSocket.OPEN) {
        return false;
      }

      socket.send(JSON.stringify({ type: 'chat:send', text: normalizedText }));
      return true;
    },
    sendMapPublish(version) {
      if (!Number.isFinite(version) || socket?.readyState !== WebSocket.OPEN) {
        return false;
      }

      socket.send(JSON.stringify({ type: 'map:publish', version }));
      return true;
    },
    disconnect() {
      isClosedByClient = true;

      if (reconnectTimer !== undefined) {
        window.clearTimeout(reconnectTimer);
      }

      socket?.close();
    },
  };
}

export function getReconnectDelay(attempt: number) {
  return Math.min(500 * 2 ** Math.max(0, attempt), 5000);
}

export function normalizeMultiplayerNotice(value: unknown): MultiplayerNotice | undefined {
  if (!isRecord(value) || value.type !== 'room:full' || typeof value.message !== 'string') {
    return undefined;
  }

  return {
    type: 'room-full',
    message: value.message,
  };
}

export function formatMultiplayerStatus(message: string, playerCount?: number) {
  if (playerCount === undefined) {
    return message;
  }

  return `${message} · ${Math.max(0, playerCount)}명 접속`;
}

export function normalizePlayerName(name: string) {
  const trimmedName = name.trim();

  return trimmedName ? trimmedName.slice(0, 18) : undefined;
}

export function getAdminJoinCode(pageLocation: URL) {
  const adminCode = pageLocation.searchParams.get('admin')?.trim();

  return adminCode || undefined;
}

export function getPlayerTextureKey(role: PlayerRole) {
  return role === 'admin' ? 'player-admin' : 'player-normal';
}

export function getInterpolatedRemotePlayer(
  samples: RemotePlayerInterpolationSample[],
  now: number,
  interpolationDelayMs = 120,
  maxPredictionMs = 120,
): RemotePlayer | undefined {
  if (samples.length === 0) {
    return undefined;
  }

  const sortedSamples = [...samples].sort((first, second) => first.receivedAt - second.receivedAt);
  const renderTime = now - Math.max(0, interpolationDelayMs);
  const oldestSample = sortedSamples[0];
  const newestSample = sortedSamples[sortedSamples.length - 1];

  if (renderTime <= oldestSample.receivedAt) {
    return { ...oldestSample.player };
  }

  for (let index = 1; index < sortedSamples.length; index += 1) {
    const previousSample = sortedSamples[index - 1];
    const nextSample = sortedSamples[index];

    if (renderTime <= nextSample.receivedAt) {
      const sampleDuration = Math.max(1, nextSample.receivedAt - previousSample.receivedAt);
      const progress = Math.max(0, Math.min(1, (renderTime - previousSample.receivedAt) / sampleDuration));

      return {
        ...nextSample.player,
        x: lerp(previousSample.player.x, nextSample.player.x, progress),
        y: lerp(previousSample.player.y, nextSample.player.y, progress),
        velocityX: lerp(previousSample.player.velocityX, nextSample.player.velocityX, progress),
        velocityY: lerp(previousSample.player.velocityY, nextSample.player.velocityY, progress),
      };
    }
  }

  const predictionMs = Math.min(
    Math.max(0, renderTime - newestSample.receivedAt),
    Math.max(0, maxPredictionMs),
  );
  const predictionSeconds = predictionMs / 1000;

  return {
    ...newestSample.player,
    x: newestSample.player.x + newestSample.player.velocityX * predictionSeconds,
    y: newestSample.player.y + newestSample.player.velocityY * predictionSeconds,
  };
}

export function normalizeOutgoingChatText(text: string) {
  const trimmedText = text.trim();

  return trimmedText ? trimmedText.slice(0, 140) : undefined;
}

export function getChatBubbleText(text: string, maxLength = 70) {
  const normalizedText = normalizeOutgoingChatText(text);

  if (!normalizedText) {
    return undefined;
  }

  const safeMaxLength = Math.max(4, maxLength);

  return normalizedText.length > safeMaxLength
    ? `${normalizedText.slice(0, safeMaxLength - 3)}...`
    : normalizedText;
}

export function normalizeChatMessage(value: unknown): ChatMessage | undefined {
  if (!isRecord(value) || value.type !== 'chat:message') {
    return undefined;
  }

  const id = typeof value.id === 'string' ? value.id : undefined;
  const playerId = typeof value.playerId === 'string' ? value.playerId : undefined;
  const playerName = typeof value.playerName === 'string' ? value.playerName : undefined;
  const text = typeof value.text === 'string' ? normalizeOutgoingChatText(value.text) : undefined;
  const sentAt = typeof value.sentAt === 'number' && Number.isFinite(value.sentAt) ? value.sentAt : undefined;

  if (!id || !playerId || !playerName || !text || sentAt === undefined) {
    return undefined;
  }

  return {
    id,
    playerId,
    playerName,
    text,
    sentAt,
  };
}

export function normalizeMapUpdatedMessage(value: unknown): MapUpdatedMessage | undefined {
  if (!isRecord(value) || value.type !== 'map:updated' || typeof value.version !== 'number' || !Number.isFinite(value.version)) {
    return undefined;
  }

  return {
    type: 'map:updated',
    version: value.version,
  };
}

export function shouldReleaseChatFocus(activeElementId: string | undefined, clickedInsideChatPanel: boolean) {
  return activeElementId === 'chat-input' && !clickedInsideChatPanel;
}

function normalizeRemotePlayer(value: unknown): RemotePlayer | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const id = typeof value.id === 'string' ? value.id : undefined;
  const name = typeof value.name === 'string' ? value.name : undefined;
  const x = finiteNumber(value.x);
  const y = finiteNumber(value.y);
  const velocityX = finiteNumber(value.velocityX);
  const velocityY = finiteNumber(value.velocityY);
  const floor = finiteNumber(value.floor);

  if (!id || !name || x === undefined || y === undefined || velocityX === undefined || velocityY === undefined || floor === undefined) {
    return undefined;
  }

  return {
    id,
    name,
    x,
    y,
    velocityX,
    velocityY,
    floor,
    facing: value.facing === 'left' ? 'left' : 'right',
    animation: normalizeAnimation(value.animation),
    role: normalizePlayerRole(value.role),
  };
}

function normalizePlayerRole(value: unknown): PlayerRole {
  return value === 'admin' ? 'admin' : 'normal';
}

function normalizeAnimation(value: unknown): PlayerAnimation {
  return value === 'run' || value === 'jump' || value === 'crouch' || value === 'idle' || value === 'sit'
    ? value
    : 'idle';
}

function finiteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function parseJson(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function isWelcomeMessage(value: unknown): value is WelcomeMessage {
  return isRecord(value) && value.type === 'player:welcome' && typeof value.id === 'string';
}

function isRoomSnapshotMessage(value: unknown): value is { type: 'room:snapshot'; players: unknown[] } {
  return isRecord(value) && value.type === 'room:snapshot' && Array.isArray(value.players);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
