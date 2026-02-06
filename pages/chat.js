import { useEffect, useRef, useState } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  addDoc,
  query,
  onSnapshot,
  where,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";
import { useRouter } from "next/router";
import { createCall } from "../lib/webrtc";

export default function Chat() {
  const router = useRouter();
  const bottomRef = useRef(null);

  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const pcRef = useRef(null);
  const localStream = useRef(null);

  const [user, setUser] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  const [incomingCall, setIncomingCall] = useState(null);
  const [callId, setCallId] = useState(null);

  const myUid = user?.uid;

  /* AUTH */
  useEffect(() => {
    return onAuthStateChanged(auth, async u => {
      if (!u) return router.replace("/");
      setUser(u);
      await updateDoc(doc(db, "users", u.uid), {
        online: true,
        lastSeen: serverTimestamp()
      });
    });
  }, [router]);

  /* CONTACTS */
  useEffect(() => {
    if (!myUid) return;
    return onSnapshot(collection(db, "users"), snap => {
      setContacts(
        snap.docs.map(d => d.data()).filter(u => u.uid !== myUid)
      );
    });
  }, [myUid]);

  /* MESSAGES */
  useEffect(() => {
    if (!activeUser || !myUid) return;
    const room = [myUid, activeUser.uid].sort().join("_");

    return onSnapshot(
      query(collection(db, "messages"), where("room", "==", room)),
      snap => {
        setMessages(
          snap.docs.map(d => ({ id: d.id, ...d.data() }))
        );
        setTimeout(() => bottomRef.current?.scrollIntoView(), 50);
      }
    );
  }, [activeUser, myUid]);

  /* LISTEN FOR INCOMING CALL */
  useEffect(() => {
    if (!myUid) return;

    return onSnapshot(doc(db, "calls", myUid), snap => {
      if (snap.exists() && snap.data().status === "calling") {
        setIncomingCall({ id: myUid, ...snap.data() });
      }
    });
  }, [myUid]);

  async function startCall(video) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video
    });

    localStream.current = stream;
    localVideo.current.srcObject = stream;

    const id = `${myUid}_${activeUser.uid}`;
    setCallId(id);

    await setDoc(doc(db, "calls", activeUser.uid), {
      from: myUid,
      type: video ? "video" : "audio",
      status: "calling"
    });

    pcRef.current = await createCall({
      callId: id,
      localStream: stream,
      remoteVideo: remoteVideo.current,
      isCaller: true
    });
  }

  async function acceptCall() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: incomingCall.type === "video"
    });

    localStream.current = stream;
    localVideo.current.srcObject = stream;

    pcRef.current = await createCall({
      callId: callId || `${incomingCall.from}_${myUid}`,
      localStream: stream,
      remoteVideo: remoteVideo.current,
      isCaller: false
    });

    setIncomingCall(null);
  }

  function endCall() {
    pcRef.current?.close();
    localStream.current?.getTracks().forEach(t => t.stop());
    setCallId(null);
  }

  async function send() {
    if (!text.trim() || !activeUser) return;
    await addDoc(collection(db, "messages"), {
      room: [myUid, activeUser.uid].sort().join("_"),
      from: myUid,
      text,
      time: Date.now()
    });
    setText("");
  }

  async function logout() {
    await signOut(auth);
    router.replace("/");
  }

  return (
    <div className="chatLayout">
      <div className="contacts">
        {contacts.map(u => (
          <div key={u.uid} onClick={() => setActiveUser(u)}>
            {u.email}
          </div>
        ))}
      </div>

      <div className="chatArea">
        <div className="chatHeader">
          {activeUser?.email}
          <div>
            <button onClick={() => startCall(false)}>📞</button>
            <button onClick={() => startCall(true)}>🎥</button>
            <button onClick={logout}>Logout</button>
          </div>
        </div>

        <div className="msgs">
          {messages.map(m => (
            <div key={m.id}>{m.text}</div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="bar">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
          />
          <button onClick={send}>Send</button>
        </div>
      </div>

      {(callId || incomingCall) && (
        <div className="callModal">
          <video ref={remoteVideo} autoPlay />
          <video ref={localVideo} autoPlay muted />
          {incomingCall && (
            <button onClick={acceptCall}>Accept</button>
          )}
          <button onClick={endCall}>End</button>
        </div>
      )}
    </div>
  );
}
