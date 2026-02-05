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
  const [user, setUser] = useState(undefined);
  const [contacts, setContacts] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const router = useRouter();

  /* AUTH */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) router.replace("/");
      else setUser(u);
    });
    return () => unsub();
  }, [router]);

  if (user === undefined) {
    return <div style={{ padding: 40, color: "white" }}>Loading…</div>;
  }

  const myUid = user.uid;

  /* CONTACTS (SAFE) */
  useEffect(() => {
    try {
      const q = query(collection(db, "users"));
      return onSnapshot(
        q,
        snap => {
          setContacts(
            snap.docs.map(d => d.data()).filter(u => u.uid !== myUid)
          );
        },
        err => {
          console.error("Contacts error:", err);
          setError(err.message);
        }
      );
    } catch (e) {
      console.error(e);
      setError(e.message);
    }
  }, [myUid]);

  /* MESSAGES (SAFE) */
  useEffect(() => {
    if (!activeUser) return;

    const roomId = [myUid, activeUser.uid].sort().join("_");

    try {
      const q = query(
        collection(db, "messages"),
        where("room", "==", roomId)
      );

      return onSnapshot(
        q,
        snap => {
          setMessages(
            snap.docs.map(d => d.data()).sort((a, b) => a.time - b.time)
          );
          setTimeout(() => bottomRef.current?.scrollIntoView(), 50);
        },
        err => {
          console.error("Messages error:", err);
          setError(err.message);
        }
      );
    } catch (e) {
      console.error(e);
      setError(e.message);
    }
  }, [activeUser, myUid]);

  async function send() {
    if (!text.trim() || !activeUser) return;

    try {
      const roomId = [myUid, activeUser.uid].sort().join("_");

      await addDoc(collection(db, "messages"), {
        room: roomId,
        from: myUid,
        to: activeUser.uid,
        text,
        time: Date.now()
      });

      setText("");
    } catch (e) {
      console.error("Send error:", e);
      setError(e.message);
    }
  }

  if (error) {
    return (
      <div style={{ padding: 40, color: "red" }}>
        ❌ Error: {error}
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
                <div key={i} className={`bubble ${m.from === myUid ? "me" : ""}`}>
                  {m.text}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="bar">
              <input
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Type message…"
              />
              <button onClick={send}>Send</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
