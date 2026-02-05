import { useEffect, useState, useRef } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  addDoc,
  query,
  onSnapshot,
  where,
  doc,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";
import { useRouter } from "next/router";

/* SVG fallback avatar */
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

  /* =========================
     AUTH + ONLINE STATUS
  ==========================*/
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.replace("/");
        return;
      }

      setUser(u);
      setAuthReady(true);

      const userRef = doc(db, "users", u.uid);

      // 🟢 set online
      await updateDoc(userRef, {
        online: true,
        lastSeen: serverTimestamp()
      });

      // 🔴 set offline on tab close
      window.addEventListener("beforeunload", async () => {
        await updateDoc(userRef, {
          online: false,
          lastSeen: serverTimestamp()
        });
      });
    });

    return () => unsub();
  }, [router]);

  const myUid = user?.uid;

  /* =========================
     CONTACTS (REAL-TIME)
  ==========================*/
  useEffect(() => {
    if (!authReady || !myUid) return;

    const q = query(collection(db, "users"));
    return onSnapshot(q, (snap) => {
      setContacts(
        snap.docs
          .map(d => d.data())
          .filter(u => u.uid !== myUid)
      );
    });
  }, [authReady, myUid]);

  /* =========================
     MESSAGES
  ==========================*/
  useEffect(() => {
    if (!activeUser || !myUid) return;

    const room = [myUid, activeUser.uid].sort().join("_");

    return onSnapshot(
      query(collection(db, "messages"), where("room", "==", room)),
      snap => {
        setMessages(
          snap.docs.map(d => d.data()).sort((a, b) => a.time - b.time)
        );
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
    if (user) {
      await updateDoc(doc(db, "users", user.uid), {
        online: false,
        lastSeen: serverTimestamp()
      });
    }
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
          <div
            key={u.uid}
            className="contact"
            onClick={() => setActiveUser(u)}
          >
            <img
              src={u.photo || FALLBACK_AVATAR}
              className="avatar"
              referrerPolicy="no-referrer"
            />
            <div>
              <div>{u.email}</div>
              <small style={{ opacity: 0.7 }}>
                {u.online ? "🟢 Online" : "Last seen recently"}
              </small>
            </div>
          </div>
        ))}
      </div>

      {/* CHAT */}
      <div className="chatArea">
        <div className="chatHeader">
          {activeUser && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img
                src={activeUser.photo || FALLBACK_AVATAR}
                className="avatar"
              />
              <div>
                <div>{activeUser.email}</div>
                <small style={{ opacity: 0.7 }}>
                  {activeUser.online ? "🟢 Online" : "Last seen recently"}
                </small>
              </div>
            </div>
          )}
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
