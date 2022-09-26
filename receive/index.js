const MessageKind = {
    OFFER: 0,
    ANSWER: 1,
    CANDIDATE: 2,
}

const configuration = {
    'iceServers': [
        { 'urls': 'stun:stun.l.google.com:19302' },
    ],
};

const video = document.querySelector('video');

const signaling = {
    channel: new WebSocket(`ws://${window.location.hostname}:8080`),
    sendMessage: function(kind, payload) {
        this.channel.send(JSON.stringify({ kind, payload }));
    }
}

const peerConnection = new RTCPeerConnection(configuration);

peerConnection.addEventListener('track', event => {
    video.srcObject = new MediaStream([event.track]);
});

peerConnection.addEventListener('icecandidate', event => {
    if (!event.candidate) return;

    signaling.sendMessage(MessageKind.CANDIDATE, event.candidate);
});

signaling.channel.addEventListener('open', async event => {
    const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true
    });

    await peerConnection.setLocalDescription(offer);

    signaling.sendMessage(MessageKind.OFFER, offer);
});

signaling.channel.addEventListener('message', async event => {
    const message = JSON.parse(event.data);

    if (message.kind == MessageKind.ANSWER) {
        await peerConnection.setRemoteDescription(message.payload);
    } else if (message.kind == MessageKind.CANDIDATE) {
        peerConnection.addIceCandidate(message.payload);
    }
});
