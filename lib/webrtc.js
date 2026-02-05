import {
  doc,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  onSnapshot,
  deleteDoc
} from "firebase/firestore";
import { db } from "./firebase";

const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

export async function startCall({
  callId,
  localStream,
  remoteVideo,
  isCaller
}) {
  const pc = new RTCPeerConnection(config);

  localStream.getTracks().forEach(track =>
    pc.addTrack(track, localStream)
  );

  pc.ontrack = e => {
    remoteVideo.srcObject = e.streams[0];
  };

  const callRef = doc(db, "calls", callId);
  const candRef = collection(callRef, "candidates");

  pc.onicecandidate = e => {
    if (e.candidate) {
      addDoc(candRef, e.candidate.toJSON());
    }
  };

  onSnapshot(candRef, snap => {
    snap.docChanges().forEach(change => {
      if (change.type === "added") {
        pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
      }
    });
  });

  if (isCaller) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await setDoc(callRef, { offer });

    onSnapshot(callRef, async snap => {
      const data = snap.data();
      if (data?.answer && !pc.currentRemoteDescription) {
        await pc.setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );
      }
    });
  } else {
    const snap = await getDoc(callRef);
    const offer = snap.data().offer;
    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await updateDoc(callRef, { answer });
  }

  return pc;
}
