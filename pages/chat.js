import { useEffect, useRef, useState } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  addDoc,
  query,
  onSnapshot,
  where,
  doc,
  updateDoc
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
      setContacts(
        snap.docs.map(d => d.data()).filter(u => u.uid !== myUid)
      );
    });
  }, [authReady, myUid]);

  /* MESSAGES */
  useEffect(() => {
    if (!activeUser || !myUid) return;

    const room = [myUid, activeUser.uid].sort().join("_");

    return onSnapshot(
      query(collection(db, "messages"), where("room", "==", room)),
      async snap => {
        const msgs = snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        })).sort((a, b) => a.time - b.time);

        setMessages(msgs);

        // 👀 mark received messages as SEEN
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

  /* SEND MESSAGE */
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

    setText("");
  }

  /* UPDATE DELIVERED */
  useEffect(() => {
    if (!activeUser || !myUid) return;

    messages.forEach(async m => {
      if (m.from === myUid && m.status === "sent") {
        await updateDoc(doc(db, "messages", m.id), {
          status: "delivered"
        });
      }
    });
  }, [messages, activeUser, myUid]);

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
          <div
            key={u.uid}
            className="contact"
            onClick={() => setActiveUser(u)}
          >
            {u.email}
          </div>
        ))}
      </div>

      {/* CHAT */}
      <div className="chatArea">
        <div className="chatHeader">
          {activeUser?.email}
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
                        {m.status === "delivered" && "✓✓"}
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
