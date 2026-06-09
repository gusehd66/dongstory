import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { createMultiplayerRoom } from './multiplayerRoom.mjs';
import { createStaticFileResponder } from './staticFileResponder.mjs';

const PORT = Number.parseInt(process.env.PORT ?? process.env.MULTIPLAYER_PORT ?? '3010', 10);
const HOST = process.env.HOST ?? process.env.MULTIPLAYER_HOST ?? (process.env.PORT ? '0.0.0.0' : '127.0.0.1');
const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');
const room = createMultiplayerRoom();
const socketsByPlayerId = new Map();
const staticFiles = createStaticFileResponder(distDir);

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

  socket.on('message', (data) => {
    const message = parseJson(data);

    if (!isRecord(message)) {
      return;
    }

    if (message.type === 'player:join' && !playerId) {
      const result = room.join(message.name);

      if (!result.accepted) {
        socket.send(JSON.stringify({ type: 'room:full', message: result.message }));
        socket.close(1008, result.reason);
        return;
      }

      const player = result.player;
      playerId = player.id;
      socketsByPlayerId.set(player.id, socket);
      socket.send(JSON.stringify({ type: 'player:welcome', id: player.id, player }));
      broadcastSnapshot();
      return;
    }

    if (message.type === 'player:update' && playerId) {
      room.update(playerId, message);
      broadcastSnapshot();
    }
  });

  socket.on('close', () => {
    if (!playerId) {
      return;
    }

    room.leave(playerId);
    socketsByPlayerId.delete(playerId);
    broadcastSnapshot();
  });
});

server.on('listening', () => {
  console.log(`Dongstory listening on http://${HOST}:${PORT}`);
});

httpServer.listen(PORT, HOST);

function broadcastSnapshot() {
  const message = JSON.stringify({ type: 'room:snapshot', ...room.getSnapshot() });

  socketsByPlayerId.forEach((socket) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(message);
    }
  });
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
