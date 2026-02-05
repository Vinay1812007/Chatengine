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

  const [user, setUser] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  const [incomingCall, setIncomingCall] = useState(null);
  const ringSound = useRef(null);

  const myUid = user?.uid;

  /* AUTH */
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

    const ref = doc(db, "calls", myUid);

    return onSnapshot(ref, snap => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.status === "calling") {
          setIncomingCall(data);
          ringSound.current?.play();
        }
      }
    });
  }, [myUid]);

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

  /* START CALL */
  async function startCall(video = false) {
    if (!activeUser) return;

    await setDoc(doc(db, "calls", activeUser.uid), {
      from: myUid,
      fromEmail: user.email,
      type: video ? "video" : "audio",
      status: "calling",
      time: serverTimestamp()
    });

    alert("Calling… waiting for answer");
  }

  /* ACCEPT CALL */
  async function acceptCall() {
    await updateDoc(doc(db, "calls", myUid), {
      status: "accepted"
    });
    ringSound.current.pause();
    setIncomingCall(null);
    alert("Call accepted (media connection comes next)");
  }

  /* REJECT CALL */
  async function rejectCall() {
    await deleteDoc(doc(db, "calls", myUid));
    ringSound.current.pause();
    setIncomingCall(null);
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
      <audio
        ref={ringSound}
        loop
        src="https://actions.google.com/sounds/v1/alarms/phone_alerts_and_rings.ogg"
      />

      {/* CONTACTS */}
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

      {/* CHAT */}
      <div className="chatArea">
        <div className="chatHeader">
          {activeUser?.email}
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
              <input
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && send()}
                placeholder="Type message…"
              />
              <button onClick={send}>Send</button>
            </div>
          </>
        )}
      </div>

      {/* INCOMING CALL SCREEN */}
      {incomingCall && (
        <div className="callScreen">
          <h2>Incoming {incomingCall.type} call</h2>
          <p>{incomingCall.fromEmail}</p>
          <div className="callActions">
            <button className="accept" onClick={acceptCall}>Accept</button>
            <button className="reject" onClick={rejectCall}>Reject</button>
          </div>
        </div>
      )}
    </div>
  );
}
