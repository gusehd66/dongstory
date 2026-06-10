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
