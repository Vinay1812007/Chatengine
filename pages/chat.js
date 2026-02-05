import { useEffect, useState, useRef } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  addDoc,
  query,
  onSnapshot,
  where
} from "firebase/firestore";
import { useRouter } from "next/router";

export default function Chat() {
  const [user, setUser] = useState(undefined); // undefined = loading
  const [contacts, setContacts] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const bottomRef = useRef(null);
  const router = useRouter();

  /* =========================
     AUTH – CLIENT SAFE
  ==========================*/
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.replace("/");
      } else {
        setUser(u);
      }
    });
    return () => unsub();
  }, [router]);

  // ⏳ Wait for auth
  if (user === undefined) {
    return (
      <div style={{ color: "white", padding: 40 }}>
        Loading ChatEngine…
      </div>
    );
  }

  const myUid = user.uid;

  /* =========================
     LOAD CONTACTS
  ==========================*/
  useEffect(() => {
    if (!myUid) return;

    const q = query(collection(db, "users"));
    const unsub = onSnapshot(q, (snap) => {
      setContacts(
        snap.docs
          .map((d) => d.data())
          .filter((u) => u.uid !== myUid)
      );
    });

    return () => unsub();
  }, [myUid]);

  /* =========================
     LOAD MESSAGES
  ==========================*/
  useEffect(() => {
    if (!activeUser || !myUid) return;

    const roomId = [myUid, activeUser.uid].sort().join("_");

    const q = query(
      collection(db, "messages"),
      where("room", "==", roomId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs
        .map((d) => d.data())
        .sort((a, b) => a.time - b.time);

      setMessages(msgs);
      setTimeout(() => bottomRef.current?.scrollIntoView(), 50);
    });

    return () => unsub();
  }, [activeUser, myUid]);

  /* =========================
     SEND MESSAGE
  ==========================*/
  async function send() {
    if (!text.trim() || !activeUser || !myUid) return;

    const roomId = [myUid, activeUser.uid].sort().join("_");

    await addDoc(collection(db, "messages"), {
      room: roomId,
      from: myUid,
      to: activeUser.uid,
      text: text.trim(),
      time: Date.now()
    });

    setText("");
  }

  /* =========================
     UI
  ==========================*/
  return (
    <div className="chatLayout">
      {/* CONTACT LIST */}
      <div className="contacts">
        <h3>Contacts</h3>
        {contacts.map((u) => (
          <div
            key={u.uid}
            className={`contact ${
              activeUser?.uid === u.uid ? "active" : ""
            }`}
            onClick={() => setActiveUser(u)}
          >
            {u.email}
          </div>
        ))}
      </div>

      {/* CHAT AREA */}
      <div className="chatArea">
        {!activeUser ? (
          <div className="empty">Select a contact</div>
        ) : (
          <>
            <div className="msgs">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`bubble ${
                    m.from === myUid ? "me" : ""
                  }`}
                >
                  {m.text}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="bar">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a message…"
              />
              <button onClick={send}>Send</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
