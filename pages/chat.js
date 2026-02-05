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
      if (!u) router.replace("/");
      else setUser(u);
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
      fromPhoto: user.photoURL || "",
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
    return <div style={{ padding: 40, color: "white" }}>Loading…</div>;
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
            <img
              src={u.photo || "/avatar.png"}
              className="avatar"
            />
            <span>{u.email}</span>
          </div>
        ))}
      </div>

      {/* CHAT */}
      <div className="chatArea">
        {/* HEADER */}
        <div className="chatHeader">
          <div className="headerUser">
            <img
              src={activeUser?.photo || "/avatar.png"}
              className="avatar"
            />
            <span>{activeUser?.email}</span>
          </div>

          <button onClick={logout}>Logout</button>
        </div>

        {!activeUser ? (
          <div className="empty">Select a contact</div>
        ) : (
          <>
            <div className="msgs">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`msgRow ${m.from === myUid ? "me" : ""}`}
                >
                  <img
                    src={
                      m.from === myUid
                        ? user.photoURL || "/avatar.png"
                        : activeUser.photo || "/avatar.png"
                    }
                    className="avatar small"
                  />
                  <div className="bubble">{m.text}</div>
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
