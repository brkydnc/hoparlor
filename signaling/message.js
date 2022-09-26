export const MessageKind = {
    INVALID: -1,
    OFFER: 0,
    ANSWER: 1,
    CANDIDATE: 2,
}

const NUM_VALID_KINDS = Object.keys(MessageKind).length - 1;

const toMessageKind = n => (Number.isNaN(n) || n < 0 || n >= NUM_VALID_KINDS) ? -1 : n;

class Message {
    constructor(kind, payload) {
        this.kind = kind;
        this.payload = payload;
    }

    stringify() {
        return JSON.stringify(this);
    }

    isInvalid() {
        return this.kind == MessageKind.INVALID;
    }
}

export class ReceiverMessage extends Message {
    constructor(kind, payload) {
        super(kind, payload);
    }

    static parse(messageBuffer) {
        try {
            const obj = JSON.parse(messageBuffer.toString());
            const kind = toMessageKind(Number(obj.kind));
            const payload = obj.payload || {};

            return new ReceiverMessage(kind, payload);
        } catch (e) {
            return new ReceiverMessage(MessageKind.INVALID, {});
        }
    }

    toBroadcasterMessage(receiver) {
        return new BroadcasterMessage(this.kind, this.payload, receiver);
    }
}

export class BroadcasterMessage extends Message {
    constructor(kind, payload, receiver) {
        super(kind, payload);
        this.receiver = receiver;
    }

    static parse(messageBuffer) {
        try {
            const obj = JSON.parse(messageBuffer.toString());

            if (!obj.receiver)
                throw new Error("Broadcaster messages must carry a receiver id");

            const kind = toMessageKind(Number(obj.kind));
            const payload = obj.payload || {};

            return new BroadcasterMessage(kind, payload, obj.receiver);
        } catch (e) {
            return new BroadcasterMessage(MessageKind.INVALID, {}, null);
        }
    }

    toReceiverMessage() {
        return new ReceiverMessage(this.kind, this.payload);
    }
}
