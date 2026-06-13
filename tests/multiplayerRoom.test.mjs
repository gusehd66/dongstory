import test from 'node:test';
import assert from 'node:assert/strict';
import { createMultiplayerRoom } from '../server/multiplayerRoom.mjs';

test('adds players with stable display names and includes them in snapshots', () => {
  const room = createMultiplayerRoom();

  const player = room.join('Sugar');
  const snapshot = room.getSnapshot();

  assert.equal(player.name, 'Sugar');
  assert.equal(snapshot.players.length, 1);
  assert.equal(snapshot.players[0].id, player.id);
  assert.equal(snapshot.players[0].name, 'Sugar');
});

test('stores the latest player movement state', () => {
  const room = createMultiplayerRoom();
  const player = room.join('Dodo');

  room.update(player.id, {
    x: 320,
    y: 640,
    velocityX: -20,
    velocityY: 30,
    floor: 3,
    facing: 'left',
    animation: 'run',
  });

  assert.deepEqual(room.getSnapshot().players[0], {
    id: player.id,
    name: 'Dodo',
    role: 'normal',
    x: 320,
    y: 640,
    velocityX: -20,
    velocityY: 30,
    floor: 3,
    facing: 'left',
    animation: 'run',
  });
});

test('stores the sitting player animation state', () => {
  const room = createMultiplayerRoom();
  const player = room.join('Dodo');

  room.update(player.id, {
    x: 320,
    y: 640,
    velocityX: 0,
    velocityY: 0,
    floor: 3,
    facing: 'left',
    animation: 'sit',
  });

  assert.equal(room.getSnapshot().players[0].animation, 'sit');
});

test('canPublishMapUpdate allows admins only', () => {
  const room = createMultiplayerRoom({ adminJoinCode: 'secret' });
  const admin = room.join('Admin', 'secret').player;
  const guest = room.join('Guest').player;

  assert.equal(room.canPublishMapUpdate(admin.id), true);
  assert.equal(room.canPublishMapUpdate(guest.id), false);
  assert.equal(room.canPublishMapUpdate('missing'), false);
});

test('marks players as admin only when they join with the configured admin code', () => {
  const room = createMultiplayerRoom({ adminJoinCode: 'admin' });

  const admin = room.join('Owner', 'admin');
  const normal = room.join('Guest', 'wrong-code');

  assert.equal(admin.accepted, true);
  assert.equal(admin.player.role, 'admin');
  assert.equal(normal.accepted, true);
  assert.equal(normal.player.role, 'normal');
  assert.deepEqual(
    room.getSnapshot().players.map((player) => ({ name: player.name, role: player.role })),
    [
      { name: 'Owner', role: 'admin' },
      { name: 'Guest', role: 'normal' },
    ],
  );
});

test('creates admin cheer messages for every other player', () => {
  const room = createMultiplayerRoom({ adminJoinCode: 'admin' });
  const admin = room.join('김현동', 'admin').player;
  const sugar = room.join('Sugar').player;
  const dodo = room.join('Dodo').player;

  assert.deepEqual(room.createAdminChatCommandMessages(admin.id, '/만세'), {
    handled: true,
    messages: [
      {
        playerId: sugar.id,
        playerName: 'Sugar',
        text: '김현동 만세!!!!',
      },
      {
        playerId: dodo.id,
        playerName: 'Dodo',
        text: '김현동 만세!!!!',
      },
    ],
  });
});

test('creates admin cheer messages for one named player', () => {
  const room = createMultiplayerRoom({ adminJoinCode: 'admin' });
  const admin = room.join('김현동', 'admin').player;
  room.join('Sugar');
  const dodo = room.join('Dodo').player;

  assert.deepEqual(room.createAdminChatCommandMessages(admin.id, '/만세:Dodo'), {
    handled: true,
    messages: [
      {
        playerId: dodo.id,
        playerName: 'Dodo',
        text: '김현동 만세!!!!',
      },
    ],
  });
});

test('does not run admin chat commands for normal players', () => {
  const room = createMultiplayerRoom({ adminJoinCode: 'admin' });
  const normal = room.join('Guest').player;
  room.join('Dodo');

  assert.deepEqual(room.createAdminChatCommandMessages(normal.id, '/만세'), {
    handled: false,
    messages: [],
  });
});

test('removes players from snapshots when they leave', () => {
  const room = createMultiplayerRoom();
  const player = room.join('Guest');

  assert.equal(room.leave(player.id), true);
  assert.deepEqual(room.getSnapshot(), { players: [] });
  assert.equal(room.leave(player.id), false);
});

test('rejects joins after the room reaches the player limit', () => {
  const room = createMultiplayerRoom({ maxPlayers: 2 });

  const first = room.join('Sugar');
  const second = room.join('Dodo');
  const third = room.join('Late');

  assert.equal(first.accepted, true);
  assert.equal(second.accepted, true);
  assert.deepEqual(third, {
    accepted: false,
    reason: 'room-full',
    message: '방이 가득 찼습니다',
  });
  assert.deepEqual(
    room.getSnapshot().players.map((player) => player.name),
    ['Sugar', 'Dodo'],
  );
});
