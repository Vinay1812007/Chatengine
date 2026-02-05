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
  const router = useRouter();

  // STATE (always declared)
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  const bottomRef = useRef(null);

  /* =========================
     AUTH (ALWAYS RUNS)
  ==========================*/
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.replace("/");
      } else {
        setUser(u);
      }
      setAuthReady(true);
    });

    return () => unsub();
  }, [router]);

  const myUid = user?.uid;

  /* =========================
     CONTACTS (SAFE)
  ==========================*/
  useEffect(() => {
    if (!authReady || !myUid) return;

    const q = query(collection(db, "users"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        setContacts(
          snap.docs.map(d => d.data()).filter(u => u.uid !== myUid)
        );
      },
      (err) => console.error("Contacts error:", err)
    );

    return () => unsub();
  }, [authReady, myUid]);

  /* =========================
     MESSAGES (SAFE)
  ==========================*/
  useEffect(() => {
    if (!authReady || !myUid || !activeUser) return;

    const roomId = [myUid, activeUser.uid].sort().join("_");

    const q = query(
      collection(db, "messages"),
      where("room", "==", roomId)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setMessages(
          snap.docs.map(d => d.data()).sort((a, b) => a.time - b.time)
        );
        setTimeout(() => bottomRef.current?.scrollIntoView(), 50);
      },
      (err) => console.error("Messages error:", err)
    );

    return () => unsub();
  }, [authReady, myUid, activeUser]);

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
     RENDER (AFTER ALL HOOKS)
  ==========================*/
  if (!authReady) {
    return (
      <div style={{ padding: 40, color: "white" }}>
        Loading ChatEngine…
      </div>
    );
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
            {u.email}
          </div>
        ))}
      </div>

      <div className="chatArea">
        {!activeUser ? (
          <div className="empty">Select a contact</div>
        ) : (
          <>
            <div className="msgs">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`bubble ${m.from === myUid ? "me" : ""}`}
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
                placeholder="Type message…"
              />
