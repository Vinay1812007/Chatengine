// pages/chat.js
import Head from "next/head";
import { useEffect, useRef, useState } from "react";
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

const FALLBACK_AVATAR =
  "data:image/svg+xml;utf8," +
  `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'>
     <rect width="100" height="100" fill="#0b1220"/>
     <circle cx="50" cy="40" r="18" fill="#9ca3af"/>
     <rect x="20" y="70" width="60" height="12" rx="6" fill="#9ca3af"/>
   </svg>`;

export default function Chat() {
  const router = useRouter();

  // auth & data
  const [user, setUser] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  // search states
  const [contactSearch, setContactSearch] = useState("");
  const [chatSearch, setChatSearch] = useState("");

  // refs
  const messagesDomRef = useRef(null);      // DOM node ref (for scrolling)
  const bottomRef = useRef(null);           // bottom placeholder
  const unsubRef = useRef(null);            // stores firestore unsubscribe (function)

  // handle auth and ensure user doc exists
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.replace("/");
        return;
      }
      setUser(u);

      // create/update user doc so contacts are visible to others
      try {
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
      } catch (err) {
        console.error("create user doc failed", err);
      }
    });

    return () => {
      unsubAuth();
      // also cleanup any messages subscription if set
      if (unsubRef.current) {
        try { unsubRef.current(); } catch (e) {}
        unsubRef.current = null;
      }
    };
  }, [router]);

  // subscribe to users (contacts)
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      setContacts(snap.docs.map(d => d.data()).filter(u => u.uid !== user.uid));
    });
    return () => unsub();
  }, [user]);

  // open chat: subscribe to messages for that chatId
  useEffect(() => {
    // cleanup previous subscription
    if (unsubRef.current) {
      try { unsubRef.current(); } catch (e) {}
      unsubRef.current = null;
    }

    if (!user || !active) {
      setMessages([]);
      return;
    }

    const chatId = [user.uid, active.uid].sort().join("_");
    const q = query(collection(db, "messages"), where("chatId", "==", chatId), orderBy("time"));

    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => d.data());
      setMessages(msgs);

      // scroll to bottom after messages update
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 20);
    });

    unsubRef.current = unsub;

    return () => {
      // cleanup when active/user changes
      try { unsub(); } catch (e) {}
      if (unsubRef.current === unsub) unsubRef.current = null;
    };
  }, [active, user]);

  async function sendMessage() {
    if (!text.trim() || !user || !active) return;

    const chatId = [user.uid, active.uid].sort().join("_");
    try {
      await addDoc(collection(db, "messages"), {
        chatId,
        from: user.uid,
        to: active.uid,
        text: text.trim(),
        time: Date.now()
      });
      setText("");
      // small scroll after send
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      console.error("send message failed", err);
    }
  }

  // helper: filtered lists
  const filteredContacts = contacts.filter(c =>
    c.email?.toLowerCase().includes(contactSearch.toLowerCase())
  );

  const filteredMessages = messages.filter(m =>
    m.text?.toLowerCase().includes(chatSearch.toLowerCase())
  );

  return (
    <>
      <Head>
        <title>ChatEngine</title>
      </Head>

      <div className="chatLayout">
        {/* LEFT: Contacts */}
        <aside className="contacts glass">
          <h3>Contacts</h3>

          <input
            className="contact-search"
            placeholder="Search contacts"
            value={contactSearch}
            onChange={(e) => setContactSearch(e.target.value)}
            aria-label="Search contacts"
          />

          {filteredContacts.map(c => (
            <div key={c.uid} className={`contact ${active?.uid === c.uid ? "active" : ""}`} onClick={() => setActive(c)}>
              <img src={c.photo || FALLBACK_AVATAR} alt="avatar" className="avatar" />
              <div className="meta">
                <div className="email">{c.email}</div>
                <div className="status">{c.online ? "Online" : "Offline"}</div>
              </div>
            </div>
          ))}

          {filteredContacts.length === 0 && <div style={{opacity:0.6, marginTop:12}}>No contacts found</div>}
        </aside>

        {/* RIGHT: Chat */}
        <main className="chat glass" role="main">
          <header>
            <div>
              <div className="title">{active ? active.email : "Select a contact"}</div>
              <div className="sub">{active ? (active.online ? "Online" : "Last seen recently") : ""}</div>
            </div>

            {active ? (
              <div style={{display:"flex", alignItems:"center", gap:10}}>
                <input className="chat-search" placeholder="Search messages" value={chatSearch} onChange={(e)=>setChatSearch(e.target.value)} />
                <div style={{display:"flex", gap:8}}>
                  <button title="Voice call" style={{padding:"8px 10px", borderRadius:10}}>📞</button>
                  <button title="Video call" style={{padding:"8px 10px", borderRadius:10}}>🎥</button>
                </div>
              </div>
            ) : (
              <div style={{opacity:0.6}}> </div>
            )}
          </header>

          {/* IMPORTANT: messagesDomRef is the DOM ref (NOT used to store unsubscribe) */}
          <div className="messages" aria-live="polite" ref={messagesDomRef}>
            {!active ? (
              <div className="empty">Select a contact to start chatting</div>
            ) : (
              <>
                {filteredMessages.map((m, idx) => (
                  <div key={idx} className={`msg ${m.from === user?.uid ? "me" : ""}`}>
                    {m.text}
                  </div>
                ))}
                <div ref={bottomRef} />
              </>
            )}
          </div>

          <div className="inputbar glass">
            <input
              placeholder={active ? "Type a message…" : "Select a contact to start"}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              disabled={!active}
            />
            <button onClick={sendMessage} disabled={!active}>Send</button>
          </div>
        </main>
      </div>
    </>
  );
}
