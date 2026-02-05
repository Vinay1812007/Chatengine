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
  updateDoc
} from "firebase/firestore";
import { useRouter } from "next/router";
import { createPeerConnection } from "../lib/webrtc";

/* fallback avatar */
const FALLBACK =
  "data:image/svg+xml;utf8," +
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>
    <circle cx='50' cy='50' r='50' fill='%23334155'/>
    <circle cx='50' cy='38' r='18' fill='%239ca3af'/>
    <path d='M20 90c6-22 54-22 60 0' fill='%239ca3af'/>
  </svg>`;

export default function Chat() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  const pcRef = useRef(null);
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const localStream = useRef(null);

  /* AUTH */
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      if (!u) router.replace("/");
      else setUser(u);
      setAuthReady(true);
    });
  }, [router]);

  const myUid = user?.uid;

  /* CONTACTS */
  useEffect(() => {
    if (!authReady || !myUid) return;
    return onSnapshot(query(collection(db, "users")), snap => {
      setContacts(
        snap.docs.map(d => d.data()).filter(u => u.uid !== myUid)
      );
    });
  }, [authReady, myUid]);

  /* MESSAGES */
  useEffect(() => {
    if (!activeUser || !myUid) return;
    const room = [myUid, activeUser.uid].sort().join("_");

    return onSnapshot(
      query(collection(db, "messages"), where("room", "==", room)),
      snap => {
        setMessages(
          snap.docs.map(d => d.data()).sort((a, b) => a.time - b.time)
        );
      }
    );
  }, [activeUser, myUid]);

  /* SEND MESSAGE */
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

  /* ================= CALL LOGIC ================= */

  async function startCall(video = false) {
    if (!activeUser) return;

    localStream.current = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video
    });

    localVideo.current.srcObject = localStream.current;

    const callId = [myUid, activeUser.uid].sort().join("_");
    const callRef = doc(db, "calls", callId);

    pcRef.current = createPeerConnection(
      (stream) => (remoteVideo.current.srcObject = stream),
      async (ice) => {
        await updateDoc(callRef, {
          ice: ice.toJSON()
        });
      }
    );

    localStream.current.getTracks().forEach(track =>
      pcRef.current.addTrack(track, localStream.current)
    );

    const offer = await pcRef.current.createOffer();
    await pcRef.current.setLocalDescription(offer);

    await setDoc(callRef, {
      offer,
      from: myUid,
      to: activeUser.uid
    });
  }

  /* LISTEN FOR CALL */
  useEffect(() => {
    if (!myUid) return;

    return onSnapshot(doc(db, "calls", myUid), async (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();

      if (data.offer && !pcRef.current) {
        localStream.current = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true
        });

        localVideo.current.srcObject = localStream.current;

        pcRef.current = createPeerConnection(
          (stream) => (remoteVideo.current.srcObject = stream),
          async (ice) => {
            await updateDoc(doc(db, "calls", snap.id), {
              ice: ice.toJSON()
            });
          }
        );

        localStream.current.getTracks().forEach(track =>
          pcRef.current.addTrack(track, localStream.current)
        );

        await pcRef.current.setRemoteDescription(data.offer);
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);

        await updateDoc(doc(db, "calls", snap.id), { answer });
      }

      if (data.answer && pcRef.current) {
        await pcRef.current.setRemoteDescription(data.answer);
      }
    });
  }, [myUid]);

  async function logout() {
    await signOut(auth);
    router.replace("/");
  }

  if (!authReady) return <div style={{ padding: 40 }}>Loading…</div>;

  return (
    <div className="chatLayout">
      <div className="contacts">
        {contacts.map(u => (
          <div
            key={u.uid}
            className="contact"
            onClick={() => setActiveUser(u)}
          >
            <img src={u.photo || FALLBACK} className="avatar" />
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

        <div style={{ display: "flex", gap: 10, padding: 10 }}>
          <video ref={localVideo} autoPlay muted width="120" />
          <video ref={remoteVideo} autoPlay width="200" />
        </div>

        <div className="msgs">
          {messages.map((m, i) => (
            <div key={i} className={`bubble ${m.from === myUid ? "me" : ""}`}>
              {m.text}
            </div>
          ))}
        </div>

        <div className="bar">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Type message…"
          />
          <button onClick={send}>Send</button>
        </div>
      </div>
    </div>
  );
}
