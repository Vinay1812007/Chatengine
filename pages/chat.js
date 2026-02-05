import { useEffect, useState, useRef } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
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

  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  const bottomRef = useRef(null);

  /* AUTH */
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

  /* CONTACTS */
  useEffect(() => {
    if (!authReady || !myUid) return;

    const q = query(collection(db, "users"));
    const unsub = onSnapshot(q, (snap) => {
      setContacts(
        snap.docs
          .map(d => d.data())
          .filter(u => u.uid !== myUid)
      );
    });

    return () => unsub();
  }, [authReady, myUid]);

  /* MESSAGES */
  useEffect(() => {
    if (!authReady || !myUid || !activeUser) return;

    const roomId = [myUid, activeUser.uid].sort().join("_");
    const q = query(
      collection(db, "messages"),
      where("room", "==", roomId)
    );

    const unsub = onSnapshot(q, (snap) => {
      setMessages(
        snap.docs.map(d => d.data()).sort((a, b) => a.time - b.time)
      );
      setTimeout(() => bottomRef.current?.scrollIntoView(), 50);
    });

    return () => unsub();
  }, [authReady, myUid, activeUser]);

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

  async function logout() {
    await signOut(auth);
    router.replace("/");
  }

  if (!authReady) {
    return (
      <div style={{ padding: 40, color: "white" }}>
        Loading…
      </div>
    );
  }

  return (
    <div className="chatLayout">
      {/* CONTACTS */}
      <div className="contacts">
        <h3>Contacts</h3>
        {contacts.map((u) => (
          <div
            key={u.uid}
            className={`contact ${activeUser?.uid === u.uid ? "active" : ""}`}
            onClick={() => setActiveUser(u)}
          >
            {u.email}
          </div>
        ))}
      </div>

      {/* CHAT */}
      <div className="chatArea">
        {/* HEADER */}
        <div style={{
          padding: "10px 16px",
          borderBottom: "1px solid #1e293b",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div>{user?.email}</div>
          <button
            style={{ width: "auto", padding: "6px 12px" }}
            onClick={logout}
          >
            Logout
          </button>
        </div>

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
              <button onClick={send}>Send</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
