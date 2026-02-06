import Head from "next/head";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  doc,
  setDoc,
  orderBy
} from "firebase/firestore";

export default function Chat() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  const bottomRef = useRef(null);

  // Auth
  useEffect(() => {
    return onAuthStateChanged(auth, async u => {
      if (!u) {
        router.replace("/");
        return;
      }

      setUser(u);

      await setDoc(
        doc(db, "users", u.uid),
        {
          uid: u.uid,
          email: u.email,
          photo: u.photoURL || "",
          online: true,
          lastSeen: Date.now()
        },
        { merge: true }
      );
    });
  }, []);

  // Contacts
  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, "users"), snap => {
      setContacts(snap.docs.map(d => d.data()).filter(u => u.uid !== user.uid));
    });
  }, [user]);

  // Messages
  useEffect(() => {
    if (!user || !active) return;

    const q = query(
      collection(db, "messages"),
      where("chatId", "==", [user.uid, active.uid].sort().join("_")),
      orderBy("time")
    );

    return onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => d.data()));
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, [active, user]);

  async function send() {
    if (!text.trim()) return;

    await addDoc(collection(db, "messages"), {
      chatId: [user.uid, active.uid].sort().join("_"),
      from: user.uid,
      to: active.uid,
      text,
      time: Date.now()
    });

    setText("");
  }

  return (
    <>
      <Head>
        <title>Chat</title>
      </Head>

      <div className="chatLayout">
        <aside className="contacts glass">
          <h3>Contacts</h3>
          {contacts.map(c => (
            <div
              key={c.uid}
              className={`contact ${active?.uid === c.uid ? "active" : ""}`}
              onClick={() => setActive(c)}
            >
              <img src={c.photo || "/avatar.png"} />
              <div>
                <div>{c.email}</div>
                <small>{c.online ? "Online" : "Offline"}</small>
              </div>
            </div>
          ))}
        </aside>

        <main className="chat glass">
          {!active ? (
            <div className="empty">Select a contact</div>
          ) : (
            <>
              <header>{active.email}</header>

              <div className="messages">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`msg ${m.from === user.uid ? "me" : ""}`}
                  >
                    {m.text}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              <footer>
                <input
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Type message…"
                  onKeyDown={e => e.key === "Enter" && send()}
                />
                <button onClick={send}>Send</button>
              </footer>
            </>
          )}
        </main>
      </div>
    </>
  );
}
