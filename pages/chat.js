import { useEffect, useState, useRef } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, addDoc, query, onSnapshot, where } from "firebase/firestore";
import { useRouter } from "next/router";

/* ✅ SVG FALLBACK AVATAR (ALWAYS WORKS) */
const FALLBACK_AVATAR =
  "data:image/svg+xml;utf8," +
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>
     <circle cx='50' cy='50' r='50' fill='%23334155'/>
     <circle cx='50' cy='38' r='18' fill='%239ca3af'/>
     <path d='M20 90c6-22 54-22 60 0' fill='%239ca3af'/>
   </svg>`;

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
    return onAuthStateChanged(auth, (u) => {
      if (!u) router.replace("/");
      else setUser(u);
      setAuthReady(true);
    });
  }, [router]);

  const myUid = user?.uid;

  /* CONTACTS */
  useEffect(() => {
    if (!authReady || !myUid) return;
    return onSnapshot(query(collection(db, "users")), snap => {
      setContacts(snap.docs.map(d => d.data()).filter(u => u.uid !== myUid));
    });
  }, [authReady, myUid]);

  /* MESSAGES */
  useEffect(() => {
    if (!activeUser || !myUid) return;
    const room = [myUid, activeUser.uid].sort().join("_");
    return onSnapshot(
      query(collection(db, "messages"), where("room", "==", room)),
      snap => {
        setMessages(snap.docs.map(d => d.data()).sort((a, b) => a.time - b.time));
        setTimeout(() => bottomRef.current?.scrollIntoView(), 50);
      }
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
    setText("");
  }

  async function logout() {
    await signOut(auth);
    router.replace("/");
  }

  if (!authReady) return <div style={{ padding: 40 }}>Loading…</div>;

  return (
    <div className="chatLayout">
      {/* CONTACTS */}
      <div className="contacts">
        <h3>Contacts</h3>
        {contacts.map(u => (
          <div key={u.uid} className="contact" onClick={() => setActiveUser(u)}>
            <img
              src={u.photo || FALLBACK_AVATAR}
              className="avatar"
              referrerPolicy="no-referrer"
            />
            {u.email}
          </div>
        ))}
      </div>

      {/* CHAT */}
      <div className="chatArea">
        <div className="chatHeader">
          {activeUser && (
            <>
              <img
                src={activeUser.photo || FALLBACK_AVATAR}
                className="avatar"
                referrerPolicy="no-referrer"
              />
              <span>{activeUser.email}</span>
            </>
          )}
          <button onClick={logout}>Logout</button>
        </div>

        {!activeUser ? (
          <div className="empty">Select a contact</div>
        ) : (
          <>
            <div className="msgs">
              {messages.map((m, i) => (
                <div key={i} className={`msgRow ${m.from === myUid ? "me" : ""}`}>
                  <img
                    src={
                      m.from === myUid
                        ? user.photoURL || FALLBACK_AVATAR
                        : activeUser.photo || FALLBACK_AVATAR
                    }
                    className="avatar small"
                    referrerPolicy="no-referrer"
                  />
                  <div className="bubble">{m.text}</div>
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
