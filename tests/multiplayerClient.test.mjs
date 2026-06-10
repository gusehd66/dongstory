import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMultiplayerUrl,
  formatMultiplayerStatus,
  getAdminJoinCode,
  getReconnectDelay,
  normalizeChatMessage,
  normalizeOutgoingChatText,
  normalizePlayerName,
  normalizeMultiplayerNotice,
  normalizeRoomSnapshot,
  shouldReleaseChatFocus,
  getPlayerTextureKey,
} from '../dist-test/multiplayerClient.js';

test('creates a websocket url from a page location', () => {
  assert.equal(
    createMultiplayerUrl(new URL('http://localhost:5173/play')),
    'ws://localhost:3010',
  );
  assert.equal(
    createMultiplayerUrl(new URL('https://example.com/game')),
    'wss://example.com',
  );
  assert.equal(
    createMultiplayerUrl(new URL('http://example.com:8080/game')),
    'ws://example.com:8080',
  );
});

test('reads an admin join code from the page url', () => {
  assert.equal(getAdminJoinCode(new URL('https://example.com/game?admin=admin')), 'admin');
  assert.equal(getAdminJoinCode(new URL('https://example.com/game?admin=')), undefined);
  assert.equal(getAdminJoinCode(new URL('https://example.com/game')), undefined);
});

test('normalizes valid room snapshots and drops invalid players', () => {
  const snapshot = normalizeRoomSnapshot({
    type: 'room:snapshot',
    players: [
      {
        id: 'one',
        name: 'Sugar',
        x: 10,
        y: 20,
        velocityX: 1,
        velocityY: 2,
        floor: 3,
        facing: 'left',
        animation: 'run',
        role: 'admin',
      },
      {
        id: 'broken',
        name: 'Broken',
        x: 'bad',
      },
    ],
  });

  assert.deepEqual(snapshot, {
    players: [
      {
        id: 'one',
        name: 'Sugar',
        x: 10,
        y: 20,
        velocityX: 1,
        velocityY: 2,
        floor: 3,
        facing: 'left',
        animation: 'run',
        role: 'admin',
      },
    ],
  });
});

test('falls back to a normal role for room snapshots without a valid role', () => {
  const snapshot = normalizeRoomSnapshot({
    type: 'room:snapshot',
    players: [
      {
        id: 'one',
        name: 'Sugar',
        x: 10,
        y: 20,
        velocityX: 1,
        velocityY: 2,
        floor: 3,
        facing: 'left',
        animation: 'run',
        role: 'owner',
      },
    ],
  });

  assert.equal(snapshot.players[0].role, 'normal');
});

test('selects a player texture key by role', () => {
  assert.equal(getPlayerTextureKey('admin'), 'player-admin');
  assert.equal(getPlayerTextureKey('normal'), 'player-normal');
});

test('normalizes room full notices', () => {
  assert.deepEqual(normalizeMultiplayerNotice({
    type: 'room:full',
    message: '방이 가득 찼습니다',
  }), {
    type: 'room-full',
    message: '방이 가득 찼습니다',
  });

  assert.equal(normalizeMultiplayerNotice({
    type: 'room:full',
    message: 123,
  }), undefined);
});

test('caps reconnect delay after repeated disconnects', () => {
  assert.equal(getReconnectDelay(0), 500);
  assert.equal(getReconnectDelay(1), 1000);
  assert.equal(getReconnectDelay(2), 2000);
  assert.equal(getReconnectDelay(10), 5000);
});

test('formats multiplayer status with connected player count', () => {
  assert.equal(formatMultiplayerStatus('멀티플레이 연결 중', 1), '멀티플레이 연결 중 · 1명 접속');
  assert.equal(formatMultiplayerStatus('멀티플레이 연결됨', 12), '멀티플레이 연결됨 · 12명 접속');
  assert.equal(formatMultiplayerStatus('멀티플레이 오프라인'), '멀티플레이 오프라인');
});

test('normalizes player names before joining multiplayer', () => {
  assert.equal(normalizePlayerName('  Dodo  '), 'Dodo');
  assert.equal(normalizePlayerName(''), undefined);
  assert.equal(normalizePlayerName('                  '), undefined);
  assert.equal(normalizePlayerName('abcdefghijklmnopqrst'), 'abcdefghijklmnopqr');
});

test('normalizes outgoing chat text before sending', () => {
  assert.equal(normalizeOutgoingChatText('  hello dongstory  '), 'hello dongstory');
  assert.equal(normalizeOutgoingChatText(''), undefined);
  assert.equal(normalizeOutgoingChatText('     '), undefined);
  assert.equal(normalizeOutgoingChatText('a'.repeat(180)).length, 140);
});

test('normalizes incoming chat messages and drops invalid payloads', () => {
  assert.deepEqual(normalizeChatMessage({
    type: 'chat:message',
    id: 'chat-1',
    playerId: 'player-1',
    playerName: 'Dodo',
    text: 'hello',
    sentAt: 123,
  }), {
    id: 'chat-1',
    playerId: 'player-1',
    playerName: 'Dodo',
    text: 'hello',
    sentAt: 123,
  });

  assert.equal(normalizeChatMessage({
    type: 'chat:message',
    id: 'bad',
    playerId: 'player-1',
    playerName: 'Dodo',
    text: '',
    sentAt: 123,
  }), undefined);
});

test('releases chat focus only when clicking outside the chat panel', () => {
  assert.equal(shouldReleaseChatFocus('chat-input', false), true);
  assert.equal(shouldReleaseChatFocus('chat-input', true), false);
  assert.equal(shouldReleaseChatFocus('nickname-input', false), false);
});
