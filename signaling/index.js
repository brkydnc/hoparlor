import { WebSocketServer } from 'ws';
import { v4 as uuid } from 'uuid';
import { URL } from 'url';
import { ReceiverMessage, BroadcasterMessage } from './message.js';

const wss = new WebSocketServer({ port: 8080 });
let broadcaster;

wss.on('connection', (ws, req) => {
    // Attach every client an id.
    ws.id = uuid();

    // Parse URL params.
    const url = new URL(req.url, `http://${req.headers.host}`);
    const isBroadcastRequest = url.searchParams.get('broadcast') === 'true';

    // Determine whether the client wants to broadcast.
    if (isBroadcastRequest) {
        // Allow only one active broadcasting client.
        if (broadcaster) {
            ws.terminate()
        } else {
            broadcaster = ws;

            ws.on('close', () => {
                broadcaster = null;
            });

            ws.on('message', data => {
                const message = BroadcasterMessage.parse(data);

                if (message.isInvalid()) return;

                for (const receiver of wss.clients.values()) {
                    if (receiver.id === message.receiver) {
                        receiver.send(message.toReceiverMessage().stringify());
                        break;
                    }
                }
            });
        }
    } else {
        ws.on("message", data => {
            // Ignore messages until a client starts broadcasting.
            if (!broadcaster) return;

            const message = ReceiverMessage.parse(data);

            if (message.isInvalid()) return;

            broadcaster.send(message.toBroadcasterMessage(ws.id).stringify());
        });
    }
});
