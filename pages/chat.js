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
  setDoc,
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
  const [typing, setTyping] = useState(false);

  const myUid = user?.uid;

  /* AUTH + ONLINE */
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

  /* CONTACTS */
  useEffect(() => {
    if (!myUid) return;
    return onSnapshot(collection(db, "users"), snap => {
      setContacts(
        snap.docs.map(d => d.data()).filter(u => u.uid !== myUid)
      );
    });
  }, [myUid]);

  /* MESSAGES */
  useEffect(() => {
    if (!activeUser || !myUid) return;
    const room = [myUid, activeUser.uid].sort().join("_");

    return onSnapshot(
      query(collection(db, "messages"), where("room", "==", room)),
      async snap => {
        const msgs = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => a.time - b.time);

        setMessages(msgs);

        for (const m of msgs) {
          if (m.from !== myUid && m.status !== "seen") {
            await updateDoc(doc(db, "messages", m.id), {
              status: "seen"
            });
          }
        }

        setTimeout(() => bottomRef.current?.scrollIntoView(), 50);
      }
    );
  }, [activeUser, myUid]);

  /* TYPING LISTENER */
  useEffect(() => {
    if (!activeUser || !myUid) return;
    return onSnapshot(
      doc(db, "typing", `${activeUser.uid}_${myUid}`),
      snap => setTyping(snap.exists())
    );
  }, [activeUser, myUid]);

  async function send() {
    if (!text.trim() || !activeUser) return;

    await addDoc(collection(db, "messages"), {
      room: [myUid, activeUser.uid].sort().join("_"),
      from: myUid,
      to: activeUser.uid,
      text,
      time: Date.now(),
      status: "sent"
    });

    await deleteDoc(doc(db, "typing", `${myUid}_${activeUser.uid}`));
    setText("");
  }

  async function handleTyping(v) {
    setText(v);
    if (!activeUser) return;

    const ref = doc(db, "typing", `${myUid}_${activeUser.uid}`);

    if (v.trim()) {
      await setDoc(ref, { typing: true, time: serverTimestamp() });
    } else {
      await deleteDoc(ref);
    }
  }

  function onKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
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
            <img src={u.photo || FALLBACK} className="avatar" />
            <div>
              <div>{u.email}</div>
              <small>{u.online ? "🟢 Online" : "Offline"}</small>
            </div>
          </div>
        ))}
      </div>

      <div className="chatArea">
        <div className="chatHeader">
          {activeUser && (
            <div>
              <div>{activeUser.email}</div>
              {typing && <small style={{ color: "#22c55e" }}>typing…</small>}
            </div>
          )}
          <button onClick={logout}>Logout</button>
        </div>

        {!activeUser ? (
          <div className="empty">Select a contact</div>
        ) : (
          <>
            <div className="msgs">
              {messages.map(m => (
                <div
                  key={m.id}
                  className={`msgRow ${m.from === myUid ? "me" : ""}`}
                >
                  <div className="bubble">
                    {m.text}
                    {m.from === myUid && (
                      <span style={{ marginLeft: 6, fontSize: 12 }}>
                        {m.status === "sent" && "✓"}
                        {m.status === "seen" && (
                          <span style={{ color: "#22c55e" }}>✓✓</span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="bar">
              <textarea
                value={text}
                onChange={e => handleTyping(e.target.value)}
                onKeyDown={onKey}
                placeholder="Type message…"
                rows={1}
              />
              <button onClick={send}>Send</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
