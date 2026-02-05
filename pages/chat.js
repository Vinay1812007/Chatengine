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
  updateDoc,
  setDoc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";
import { useRouter } from "next/router";

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
  const [typing, setTyping] = useState(false);
  const [callActive, setCallActive] = useState(false);

  const myUid = user?.uid;

  /* AUTH + ONLINE */
  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.replace("/");
        return;
      }
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
        const msgs = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => a.time - b.time);
        setMessages(msgs);
        setTimeout(() => bottomRef.current?.scrollIntoView(), 50);
      }
    );
  }, [activeUser, myUid]);

  /* TYPING LISTENER */
  useEffect(() => {
    if (!activeUser || !myUid) return;
    return onSnapshot(
      doc(db, "typing", `${activeUser.uid}_${myUid}`),
      snap => setTyping(snap.exists())
    );
  }, [activeUser, myUid]);

  async function send() {
    if (!text.trim() || !activeUser) return;

    await addDoc(collection(db, "messages"), {
      room: [myUid, activeUser.uid].sort().join("_"),
      from: myUid,
      text,
      time: Date.now()
    });

    await deleteDoc(doc(db, "typing", `${myUid}_${activeUser.uid}`));
    setText("");
  }

  async function handleTyping(v) {
    setText(v);
    if (!activeUser) return;

    const ref = doc(db, "typing", `${myUid}_${activeUser.uid}`);
    if (v.trim()) {
      await setDoc(ref, { typing: true, time: serverTimestamp() });
    } else {
      await deleteDoc(ref);
    }
  }

  function onKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  /* CALLS (P2P BASIC) */
  async function startCall(video) {
    localStream.current = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video
    });

    localVideo.current.srcObject = localStream.current;
    setCallActive(true);
  }

  function endCall() {
    localStream.current?.getTracks().forEach(t => t.stop());
    setCallActive(false);
  }

  async function logout() {
    await updateDoc(doc(db, "users", user.uid), {
      online: false,
      lastSeen: serverTimestamp()
    });
    await signOut(auth);
    router.replace("/");
  }

  return (
    <div className="chatLayout">
      <div className="contacts">
        <h3>Contacts</h3>
        {contacts.map(u => (
          <div
            key={u.uid}
            className={`contact ${activeUser?.uid === u.uid ? "active" : ""}`}
            onClick={() => setActiveUser(u)}
          >
            <img src={u.photo || FALLBACK} className="avatar" />
            <div>
              <div>{u.email}</div>
              <small>{u.online ? "🟢 Online" : "Offline"}</small>
            </div>
          </div>
        ))}
      </div>

      <div className="chatArea">
        <div className="chatHeader">
          <div>
            {activeUser?.email}
            {typing && <small style={{ color: "#22c55e" }}> typing…</small>}
          </div>
          <div className="callBtns">
            <button onClick={() => startCall(false)}>📞</button>
            <button onClick={() => startCall(true)}>🎥</button>
            <button onClick={logout}>Logout</button>
          </div>
        </div>

        {!activeUser ? (
          <div className="empty">Select a contact</div>
        ) : (
          <>
            <div className="msgs">
              {messages.map(m => (
                <div
                  key={m.id}
                  className={`msgRow ${m.from === myUid ? "me" : ""}`}
                >
                  <div className="bubble">{m.text}</div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="bar">
              <textarea
                value={text}
                onChange={e => handleTyping(e.target.value)}
                onKeyDown={onKey}
                placeholder="Type message…"
                rows={1}
              />
              <button onClick={send}>Send</button>
            </div>
          </>
        )}
      </div>

      {callActive && (
        <div className="callModal">
          <video ref={localVideo} autoPlay muted />
          <button className="end" onClick={endCall}>End Call</button>
        </div>
      )}
    </div>
  );
}
