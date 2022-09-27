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

const constraints = {
    video: true,
    audio: true,
    audio: {
        sampleRate: 48000,
        sampleSize: 32,
        channelCount: 2,
        latency: 0,
        echoCancellation: false,
        autoGainControl: false,
        noiseSuppression: false,
    }
}

// TODO: Drop closed connections.
const peers = new Map();
const signaling = {
    channel: new WebSocket('ws://0.0.0.0:8080/?broadcast=true'),
    sendMessage: function(kind, receiver, payload) {
        this.channel.send(JSON.stringify({ kind, payload, receiver }));
    }
}


let broadcastedAudioTrack;
const broadcastButton = document.querySelector('button');

broadcastButton.addEventListener('click', event => {
    navigator.mediaDevices.getDisplayMedia(constraints).then(mediaStream => {
        const audioTrack = mediaStream.getAudioTracks()[0];

        if (audioTrack) {
            broadcastedAudioTrack = audioTrack;

            audioTrack.addEventListener('ended', event => {
                broadcastedAudioTrack = null;
            });
        }
    });
})

signaling.channel.addEventListener('message', async event => {
    if (!broadcastedAudioTrack) return;

    const message = JSON.parse(event.data);

    if (message.kind == MessageKind.OFFER) {
        const peerConnection = new RTCPeerConnection(configuration);
        peers.set(message.receiver, peerConnection);
        peerConnection.addTrack(broadcastedAudioTrack);

        peerConnection.addEventListener('icecandidate', event => {
            if (!event.candidate) return;

            signaling.sendMessage(MessageKind.CANDIDATE, message.receiver, event.candidate);
        })

        await peerConnection.setRemoteDescription(message.payload);
        const answer = await peerConnection.createAnswer();
        answer.sdp = answer.sdp.replace('useinbandfec=1', 'useinbandfec=1; stereo=1; maxaveragebitrate=510000; maxplaybackrate=510000');
        await peerConnection.setLocalDescription(answer);

        signaling.sendMessage(MessageKind.ANSWER, message.receiver, answer);
    } else if (message.kind == MessageKind.CANDIDATE) {
        const peerConnection = peers.get(message.receiver);
        peerConnection.addIceCandidate(message.payload);
    }
});
