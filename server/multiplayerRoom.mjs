const DEFAULT_PLAYER_STATE = {
  x: 160,
  y: 0,
  velocityX: 0,
  velocityY: 0,
  floor: 0,
  facing: 'right',
  animation: 'idle',
};
const DEFAULT_MAX_PLAYERS = 20;
const ROOM_FULL_MESSAGE = '방이 가득 찼습니다';

export function createMultiplayerRoom({ maxPlayers = DEFAULT_MAX_PLAYERS } = {}) {
  const players = new Map();
  let nextGuestNumber = 1;

  function join(requestedName) {
    if (players.size >= maxPlayers) {
      return {
        accepted: false,
        reason: 'room-full',
        message: ROOM_FULL_MESSAGE,
      };
    }

    const id = globalThis.crypto.randomUUID();
    const name = normalizeName(requestedName) ?? `Guest ${nextGuestNumber++}`;
    const player = { id, name, ...DEFAULT_PLAYER_STATE };

    players.set(id, player);

    return { accepted: true, player: { ...player }, ...player };
  }

  function update(id, state) {
    const player = players.get(id);

    if (!player) {
      return false;
    }

    players.set(id, {
      ...player,
      x: finiteNumber(state.x, player.x),
      y: finiteNumber(state.y, player.y),
      velocityX: finiteNumber(state.velocityX, player.velocityX),
      velocityY: finiteNumber(state.velocityY, player.velocityY),
      floor: finiteNumber(state.floor, player.floor),
      facing: state.facing === 'left' ? 'left' : 'right',
      animation: normalizeAnimation(state.animation, player.animation),
    });

    return true;
  }

  function leave(id) {
    return players.delete(id);
  }

  function getSnapshot() {
    return {
      players: [...players.values()].map((player) => ({ ...player })),
    };
  }

  function getPlayer(id) {
    const player = players.get(id);

    return player ? { ...player } : undefined;
  }

  return {
    join,
    update,
    leave,
    getSnapshot,
    getPlayer,
  };
}

function normalizeName(name) {
  if (typeof name !== 'string') {
    return undefined;
  }

  const trimmedName = name.trim();

  if (!trimmedName) {
    return undefined;
  }

  return trimmedName.slice(0, 18);
}

function finiteNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeAnimation(animation, fallback) {
  return animation === 'run' || animation === 'jump' || animation === 'crouch' || animation === 'idle'
    ? animation
    : fallback;
}
