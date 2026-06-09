export type PlayerFacing = 'left' | 'right';
export type PlayerAnimation = 'idle' | 'run' | 'jump' | 'crouch';

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
};

export type RoomSnapshot = {
  players: RemotePlayer[];
};

export type MultiplayerNotice = {
  type: 'room-full' | 'connection-lost' | 'reconnecting' | 'connected';
  message: string;
};

export type MultiplayerConnection = {
  readonly localPlayerId?: string;
  sendPlayerUpdate: (update: LocalPlayerUpdate) => void;
  disconnect: () => void;
};

export type MultiplayerConnectionOptions = {
  url?: string;
  name?: string;
  onSnapshot: (snapshot: RoomSnapshot) => void;
  onLocalPlayerId?: (id: string) => void;
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
  onSnapshot,
  onLocalPlayerId,
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
      socket?.send(JSON.stringify({ type: 'player:join', name }));
    });

    socket.addEventListener('message', (event) => {
      const message = parseJson(event.data);

      if (isWelcomeMessage(message)) {
        localPlayerId = message.id;
        reconnectAttempt = 0;
        onLocalPlayerId?.(message.id);
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
  };
}

function normalizeAnimation(value: unknown): PlayerAnimation {
  return value === 'run' || value === 'jump' || value === 'crouch' || value === 'idle'
    ? value
    : 'idle';
}

function finiteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
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
