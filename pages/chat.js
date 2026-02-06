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
  updateDoc,
  serverTimestamp
} from "firebase/firestore";
import { useRouter } from "next/router";

export default function Chat() {
  const router = useRouter();
  const bottomRef = useRef(null);
  const msgUnsub = useRef(null);

  const [user, setUser] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);

  const myUid = user?.uid;

  /* AUTH */
  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) return router.replace("/");
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

  /* OPEN CHAT SAFELY */
  function openChat(u) {
    if (u.uid === activeUser?.uid) return;

    if (msgUnsub.current) msgUnsub.current();

    setActiveUser(u);
    setMessages([]);
    setLoadingChat(true);

    const room = [myUid, u.uid].sort().join("_");

    msgUnsub.current = onSnapshot(
      query(collection(db, "messages"), where("room", "==", room)),
      snap => {
        const msgs = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => a.time - b.time);
        setMessages(msgs);
        setLoadingChat(false);
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
        <title>Chatgram</title>
      </Head>

      <div className="chatLayout">
        {/* CONTACTS */}
        <aside className="contacts">
          <h3>Contacts</h3>
          {contacts.map(u => (
            <div
              key={u.uid}
              className={`contact ${activeUser?.uid === u.uid ? "active" : ""}`}
              onClick={() => openChat(u)}
            >
              <img src={u.photo} className="avatar" />
              <div className="contactText">
                <div className="email">{u.email}</div>
                <span className={u.online ? "on" : "off"}>
                  {u.online ? "Online" : "Offline"}
                </span>
              </div>
            </div>
          ))}
        </aside>

        {/* CHAT */}
        <main className="chatArea">
          <header className="chatHeader">
            <div>
              <div>{activeUser?.email || "Select a contact"}</div>
              {activeUser && (
                <small>
                  {activeUser.online
                    ? "Online"
                    : "Last seen today"}
                </small>
              )}
            </div>

            <div className="callBtns">
              {activeUser && (
                <>
                  <button title="Voice Call">📞</button>
                  <button title="Video Call">🎥</button>
                </>
              )}
              <button title="Settings" onClick={() => router.push("/settings")}>
                ⚙️
              </button>
            </div>
          </header>

          {!activeUser ? (
            <div className="empty">Select a contact</div>
          ) : loadingChat ? (
            <div className="empty">Loading chat…</div>
          ) : (
            <>
              <div className="msgs">
                {messages.map(m => (
                  <div
                    key={m.id}
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
                  onKeyDown={e => e.key === "Enter" && send()}
                  placeholder="Type message…"
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
