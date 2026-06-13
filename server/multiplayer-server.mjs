import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { createMultiplayerRoom } from './multiplayerRoom.mjs';
import { createSnapshotBroadcaster } from './snapshotBroadcaster.mjs';
import { createStaticFileResponder } from './staticFileResponder.mjs';

const PORT = Number.parseInt(process.env.PORT ?? process.env.MULTIPLAYER_PORT ?? '3010', 10);
const HOST = process.env.HOST ?? process.env.MULTIPLAYER_HOST ?? (process.env.PORT ? '0.0.0.0' : '127.0.0.1');
const SNAPSHOT_INTERVAL_MS = 100;
const HEARTBEAT_INTERVAL_MS = 30000;
const CHAT_MESSAGE_MAX_LENGTH = 140;
const ADMIN_JOIN_CODE = process.env.ADMIN_JOIN_CODE;
const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');
const room = createMultiplayerRoom({ adminJoinCode: ADMIN_JOIN_CODE });
const socketsByPlayerId = new Map();
const staticFiles = createStaticFileResponder(distDir);
const snapshotBroadcaster = createSnapshotBroadcaster({
  intervalMs: SNAPSHOT_INTERVAL_MS,
  sendSnapshot: broadcastSnapshot,
});

const httpServer = createServer(async (request, response) => {
  const staticResponse = await staticFiles.respond(request.url);

  response.writeHead(staticResponse.status, {
    'Content-Type': staticResponse.contentType,
    'Cache-Control': getCacheControl(request.url),
  });
  response.end(staticResponse.body);
});

const server = new WebSocketServer({ server: httpServer });

server.on('connection', (socket) => {
  let playerId;
  socket.isAlive = true;

  socket.on('pong', () => {
    socket.isAlive = true;
  });

  socket.on('message', (data) => {
    const message = parseJson(data);

    if (!isRecord(message)) {
      return;
    }

    if (message.type === 'player:join' && !playerId) {
      const result = room.join(message.name, message.adminCode);

      if (!result.accepted) {
        socket.send(JSON.stringify({ type: 'room:full', message: result.message }));
        socket.close(1008, result.reason);
        return;
      }

      const player = result.player;
      playerId = player.id;
      socketsByPlayerId.set(player.id, socket);
      socket.send(JSON.stringify({ type: 'player:welcome', id: player.id, player }));
      snapshotBroadcaster.broadcastNow();
      return;
    }

    if (message.type === 'player:update' && playerId) {
      room.update(playerId, message);
      snapshotBroadcaster.requestBroadcast();
      return;
    }

    if (message.type === 'chat:send' && playerId) {
      broadcastChatMessage(playerId, message.text);
      return;
    }

    if (message.type === 'map:publish' && playerId) {
      if (!room.canPublishMapUpdate(playerId)) {
        return;
      }

      const version = finiteNumber(message.version);

      if (version === undefined) {
        return;
      }

      sendToOpenSockets(JSON.stringify({ type: 'map:updated', version }));
    }
  });

  socket.on('close', () => {
    if (!playerId) {
      return;
    }

    room.leave(playerId);
    socketsByPlayerId.delete(playerId);
    snapshotBroadcaster.broadcastNow();
  });
});

server.on('listening', () => {
  console.log(`Dongstory listening on http://${HOST}:${PORT}`);
});

httpServer.listen(PORT, HOST);

const heartbeat = setInterval(() => {
  server.clients.forEach((socket) => {
    if (socket.isAlive === false) {
      socket.terminate();
      return;
    }

    socket.isAlive = false;
    socket.ping();
  });
}, HEARTBEAT_INTERVAL_MS);

server.on('close', () => {
  clearInterval(heartbeat);
});

function broadcastSnapshot() {
  const message = JSON.stringify({ type: 'room:snapshot', ...room.getSnapshot() });

  sendToOpenSockets(message);
}

function broadcastChatMessage(playerId, text) {
  const player = room.getPlayer(playerId);
  const chatText = normalizeChatText(text);

  if (!player || !chatText) {
    return;
  }

  const commandResult = room.createAdminChatCommandMessages(playerId, chatText);

  if (commandResult.handled) {
    commandResult.messages.forEach((message) => {
      sendChatMessage(message.playerId, message.playerName, message.text);
    });
    return;
  }

  sendChatMessage(player.id, player.name, chatText);
}

function sendChatMessage(playerId, playerName, text) {
  sendToOpenSockets(JSON.stringify({
    type: 'chat:message',
    id: globalThis.crypto.randomUUID(),
    playerId,
    playerName,
    text,
    sentAt: Date.now(),
  }));
}

function sendToOpenSockets(message) {
  socketsByPlayerId.forEach((socket) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(message);
    }
  });
}

function normalizeChatText(text) {
  if (typeof text !== 'string') {
    return undefined;
  }

  const trimmedText = text.trim();

  return trimmedText ? trimmedText.slice(0, CHAT_MESSAGE_MAX_LENGTH) : undefined;
}

function finiteNumber(value) {
  return Number.isFinite(value) ? value : undefined;
}

function parseJson(data) {
  try {
    return JSON.parse(data.toString());
  } catch {
    return undefined;
  }
}

function isRecord(value) {
  return typeof value === 'object' && value !== null;
}

function getCacheControl(requestUrl = '/') {
  return requestUrl.startsWith('/assets/')
    ? 'public, max-age=31536000, immutable'
    : 'no-cache';
}
