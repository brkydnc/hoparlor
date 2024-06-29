import { WebSocketServer } from 'ws';
import { v4 as uuid } from 'uuid';
import { URL } from 'url';
import { ReceiverMessage, BroadcasterMessage } from './message.js';
import pino from 'pino';
import express from 'express';

const transport = pino.transport({
  target: 'pino-pretty',
  // Logs are printed to stderr
  options: { destination: 2 }
})

const logger = pino({ level: "debug" }, transport);

let broadcaster = null;
const socketServer = new WebSocketServer({ port: 8080 });

socketServer.on('listening', () => {
  const { port } = socketServer.address();
  logger.info(`Socket server is listening at port ${port}`);
})

socketServer.on('connection', (socket, req) => {
  socket.id = uuid();
  logger.debug(`Client connected with id ${socket.id}`);

  // Parse URL params.
  const url = new URL(req.url, `http://${req.headers.host}`);
  const isBroadcastRequest = url.searchParams.get('broadcast') === 'true';

  if (isBroadcastRequest) {
    broadcaster = prepareBroadcaster(socket)
  } else {
    prepareReceiver(socket);
  }
});

function prepareReceiver(socket) {
  socket.on("message", data => {
    if (!broadcaster) return;

    const message = ReceiverMessage.parse(data);

    if (message.isInvalid()) return;

    logger.debug(`Receiver ${socket.id} received a message`);

    broadcaster.send(message.toBroadcasterMessage(socket.id).stringify());
  });

  return socket;
}

function prepareBroadcaster(socket) {
  socket.on('close', () => {
    if (broadcaster.id === socket.id) broadcaster = null;
  });

  socket.on('message', data => {
    const message = BroadcasterMessage.parse(data);

    if (message.isInvalid()) return;

    logger.debug(`Broadcaster ${socket.id} received a message`);

    for (const receiver of socketServer.clients.values()) {
      if (receiver.id === message.receiver) {
        receiver.send(message.toReceiverMessage().stringify());
        break;
      }
    }
  });

  return socket;
}

const app = express();

app.use('/broadcast', express.static('broadcast'));
app.use('/receive', express.static('receive'));

const expressServer = app.listen(8081, function () {
  const { port } = expressServer.address();
  logger.info(`Express server is listening at port ${port}`);
});