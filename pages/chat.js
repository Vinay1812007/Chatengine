import Head from "next/head";
import { useEffect, useRef, useState } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  addDoc,
  query,
  onSnapshot,
  where,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";
import { useRouter } from "next/router";

const FALLBACK =
  "data:image/svg+xml;utf8," +
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>
    <circle cx='50' cy='50' r='50' fill='%23212121'/>
    <circle cx='50' cy='38' r='16' fill='%239ca3af'/>
    <path d='M22 88c6-20 50-20 56 0' fill='%239ca3af'/>
  </svg>`;

export default function Chat() {
  const router = useRouter();
  const bottomRef = useRef(null);
  const unsubRef = useRef(null);

  const [user, setUser] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  const [contactSearch, setContactSearch] = useState("");
  const [chatSearch, setChatSearch] = useState("");

  const myUid = user?.uid;

  /* AUTH + ENSURE USER DOC EXISTS (CONTACT SYNC FIX) */
  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
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

  /* CONTACTS SYNC */
  useEffect(() => {
    if (!myUid) return;
    return onSnapshot(collection(db, "users"), (snap) => {
      setContacts(
        snap.docs
          .map(d => d.data())
          .filter(u => u.uid !== myUid)
      );
    });
  }, [myUid]);

  /* OPEN CHAT SAFELY */
  function openChat(u) {
    if (u.uid === activeUser?.uid) return;

    if (unsubRef.current) unsubRef.current();

    setActiveUser(u);
    setMessages([]);

    const room = [myUid, u.uid].sort().join("_");

    unsubRef.current = onSnapshot(
      query(collection(db, "messages"), where("room", "==", room)),
      (snap) => {
        const msgs = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => a.time - b.time);
        setMessages(msgs);
        setTimeout(() => bottomRef.current?.scrollIntoView(), 50);
      }
    );
  }

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

  return (
    <>
      <Head>
        <title>ChatEngine</title>
      </Head>

      <div className="chatLayout">
        {/* CONTACTS */}
        <aside className="contacts glass">
          <input
            className="search"
            placeholder="Search contacts"
            value={contactSearch}
            onChange={(e) => setContactSearch(e.target.value)}
          />

          {contacts
            .filter(c =>
              c.email.toLowerCase().includes(contactSearch.toLowerCase())
            )
            .map(u => (
              <div
                key={u.uid}
                className={`contact ${activeUser?.uid === u.uid ? "active" : ""}`}
                onClick={() => openChat(u)}
              >
                <img src={u.photo || FALLBACK} className="avatar" />
                <div>
                  <div className="email">{u.email}</div>
                  <small>{u.online ? "Online" : "Offline"}</small>
                </div>
              </div>
            ))}
        </aside>

        {/* CHAT */}
        <main className="chatArea">
          <header className="chatHeader glass">
            <div>
              <div>{activeUser?.email || "Select a contact"}</div>
              {activeUser && (
                <small>{activeUser.online ? "Online" : "Last seen"}</small>
              )}
            </div>

            <div className="callBtns">
              {activeUser && <button>📞</button>}
              {activeUser && <button>🎥</button>}
              <button onClick={() => router.push("/settings")}>⚙️</button>
            </div>
          </header>

          {!activeUser ? (
            <div className="empty">Select a contact</div>
          ) : (
            <>
              <input
                className="search chatSearch"
                placeholder="Search in chat"
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
              />

              <div className="msgs">
                {messages
                  .filter(m =>
                    m.text.toLowerCase().includes(chatSearch.toLowerCase())
                  )
                  .map(m => (
                    <div
                      key={m.id}
                      className={`msgRow ${m.from === myUid ? "me" : ""}`}
                    >
                      <div className="bubble glass">{m.text}</div>
                    </div>
                  ))}
                <div ref={bottomRef} />
              </div>

              <div className="bar glass">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="Type a message"
                />
                <button onClick={send}>Send</button>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}
