import {
  doc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  onSnapshot,
  getDoc
} from "firebase/firestore";
import { db } from "./firebase";

const servers = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

export async function createCall({
  callId,
  localStream,
  remoteVideo,
  isCaller
}) {
  const pc = new RTCPeerConnection(servers);

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
    snap.docChanges().forEach(c => {
      if (c.type === "added") {
        pc.addIceCandidate(new RTCIceCandidate(c.doc.data()));
      }
    });
  });

  if (isCaller) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await setDoc(callRef, { offer, status: "calling" });

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

    await pc.setRemoteDescription(
      new RTCSessionDescription(offer)
    );

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await updateDoc(callRef, { answer, status: "connected" });
  }

  return pc;
}
