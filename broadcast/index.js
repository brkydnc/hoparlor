const MessageKind = {
  Offer: 0,
  Answer: 1,
  Candidate: 2,
}

const configuration = {
  'iceServers': [
    { 'urls': 'stun:stun.l.google.com:19302' },
  ],
};

const constraints = {
  video: true,
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

const OLD_SDP = "useinbandfec=1"
const NEW_SDP = "useinbandfec=1; stereo=1; maxaveragebitrate=510000; maxplaybackrate=510000";
const SOCKET_URI = `ws://${window.location.hostname}:8080/?broadcast=true`;

// TODO: Drop closed connections.
const peers = new Map();

const signaling = {
  channel: new WebSocket(SOCKET_URI),
  sendMessage: function (kind, payload, receiver) {
    const message = JSON.stringify({ kind, payload, receiver })
    this.channel.send(message);
  }
}

let broadcastedAudioTrack = null;
const broadcastButton = document.querySelector('button');

broadcastButton.addEventListener('click', async () => {
  const mediaStream = await navigator.mediaDevices.getDisplayMedia(constraints);
  const audioTrack = mediaStream.getAudioTracks()[0];
  if (!audioTrack) return;

  audioTrack.addEventListener('ended', () => {
    if (audioTrack !== broadcastedAudioTrack) return;
    broadcastedAudioTrack = null;
  });

  broadcastedAudioTrack = audioTrack;
})

signaling.channel.addEventListener('message', async event => {
  if (!broadcastedAudioTrack) return;

  const message = JSON.parse(event.data);

  if (message.kind == MessageKind.Offer) {
    const peerConnection = new RTCPeerConnection(configuration);
    peers.set(message.receiver, peerConnection);
    peerConnection.addTrack(broadcastedAudioTrack);

    peerConnection.addEventListener('icecandidate', event => {
      if (!event.candidate) return;
      signaling.sendMessage(MessageKind.Candidate, message.receiver, event.candidate);
    })

    await peerConnection.setRemoteDescription(message.payload);
    const answer = await peerConnection.createAnswer();
    answer.sdp = answer.sdp.replace(OLD_SDP, NEW_SDP);
    await peerConnection.setLocalDescription(answer);

    signaling.sendMessage(MessageKind.Answer, message.receiver, answer);
  } else if (message.kind == MessageKind.Candidate) {
    const peerConnection = peers.get(message.receiver);
    peerConnection.addIceCandidate(message.payload);
  }
});
