export const servers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" }
  ]
};

export function createPeerConnection(onTrack, onIce) {
  const pc = new RTCPeerConnection(servers);

  pc.ontrack = (event) => {
    onTrack(event.streams[0]);
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      onIce(event.candidate);
    }
  };

  return pc;
}
