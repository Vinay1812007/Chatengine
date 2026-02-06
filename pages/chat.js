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
  const [loadingChat, setLoadingChat] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);

  const msgUnsub = useRef(null);

  const myUid = user?.uid;

  /* ================= AUTH ================= */
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

  /* ================= CONTACTS ================= */
  useEffect(() => {
    if (!myUid) return;
    return onSnapshot(collection(db, "users"), snap => {
      setContacts(
        snap.docs.map(d => d.data()).filter(u => u.uid !== myUid)
      );
    });
  }, [myUid]);

  /* ================= SWITCH CONTACT (SAFE) ================= */
  function openChat(user) {
    if (user.uid === activeUser?.uid) return;

    // clean old listener
    if (msgUnsub.current) {
      msgUnsub.current();
      msgUnsub.current = null;
    }

    setActiveUser(user);
    setMessages([]);
    setLoadingChat(true);

    const room = [myUid, user.uid].sort().join("_");

    msgUnsub.current = onSnapshot(
      query(collection(db, "messages"), where("room", "==", room)),
      snap => {
        const msgs = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => a.time - b.time);

        setMessages(msgs);
        setLoadingChat(false);
        setTimeout(() => bottomRef.current?.scrollIntoView(), 50);
      }
    );
  }

  /* ================= INCOMING CALL ================= */
  useEffect(() => {
    if (!myUid) return;
    return onSnapshot(doc(db, "calls", myUid), snap => {
      setIncomingCall(snap.exists() ? snap.data() : null);
    });
  }, [myUid]);

  /* ================= SEND MESSAGE ================= */
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
    await updateDoc(doc(db, "users", user.uid), {
      online: false,
      lastSeen: serverTimestamp()
    });
    await signOut(auth);
    router.replace("/");
  }

  return (
    <div className="chatLayout">
      {/* CONTACTS */}
      <div className="contacts">
        <h3>Contacts</h3>
        {contacts.map(u => (
          <div
            key={u.uid}
            className={`contact ${activeUser?.uid === u.uid ? "active" : ""}`}
            onClick={() => openChat(u)}
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
          <div>{activeUser?.email || "Select a contact"}</div>
          <div className="callBtns">
            <button disabled={!activeUser}>📞</button>
            <button disabled={!activeUser}>🎥</button>
            <button onClick={logout}>Logout</button>
          </div>
        </div>

        {!activeUser ? (
          <div className="empty">Select a contact</div>
        ) : loadingChat ? (
          <div className="empty">Loading chat…</div>
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
                disabled={loadingChat}
              />
              <button onClick={send} disabled={loadingChat}>
                Send
              </button>
            </div>
          </>
        )}
      </div>

      {/* INCOMING CALL UI */}
      {incomingCall && (
        <div className="callModal">
          <h2>Incoming {incomingCall.type} call</h2>
          <p>{incomingCall.fromEmail}</p>
          <div style={{ display: "flex", gap: 20 }}>
            <button style={{ background: "#22c55e" }}>Accept</button>
            <button style={{ background: "#ef4444" }}>Reject</button>
          </div>
        </div>
      )}
    </div>
  );
}
