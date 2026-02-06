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

  // core data
  const [user, setUser] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  // UI state
  const [contactSearch, setContactSearch] = useState("");
  const [chatSearch, setChatSearch] = useState("");
  const [showAppSettings, setShowAppSettings] = useState(false);
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [contactsVisible, setContactsVisible] = useState(true); // for back button small screens

  const bottomRef = useRef(null);
  const messagesUnsubRef = useRef(null);

  // auth + ensure user doc exists
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.replace("/");
        return;
      }
      setUser(u);

      // ensure user doc exists so contacts sync
      try {
        await setDoc(doc(db, "users", u.uid), {
          uid: u.uid,
          email: u.email,
          photo: u.photoURL || "",
          online: true,
          lastSeen: Date.now()
        }, { merge: true });
      } catch (err) {
        console.error("ensure user doc failed", err);
      }
    });

    return () => unsub();
  }, []);

  // subscribe to contacts
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const arr = snap.docs.map(d => d.data()).filter(x => x.uid !== user.uid);
      setContacts(arr);
    });
    return () => unsub();
  }, [user]);

  // open a chat: subscribe to messages for this chatId
  useEffect(() => {
    if (!user || !active) {
      setMessages([]);
      if (messagesUnsubRef.current) {
        messagesUnsubRef.current();
        messagesUnsubRef.current = null;
      }
      return;
    }

    const chatId = [user.uid, active.uid].sort().join("_");
    const q = query(collection(db, "messages"), where("chatId", "==", chatId), orderBy("time"));

    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => d.data());
      setMessages(msgs);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });

    messagesUnsubRef.current = unsub;
    return () => unsub();
  }, [user, active]);

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
    } catch (err) {
      console.error("send message failed", err);
    }
  }

  const filteredContacts = contacts.filter(c =>
    c.email?.toLowerCase().includes(contactSearch.toLowerCase())
  );

  const filteredMessages = messages.filter(m =>
    m.text?.toLowerCase().includes(chatSearch.toLowerCase())
  );

  // Back button: deselect active chat and show contacts
  function handleBack() {
    setActive(null);
    setContactsVisible(true);
    setShowChatSettings(false);
  }

  return (
    <>
      <Head><title>Chat</title></Head>

      <div className="chatLayout">
        {/* LEFT: Contacts */}
        <aside className={`contacts glass ${contactsVisible ? "" : "hidden"}`}>
          <h3>Contacts</h3>

          <input
            className="contact-search"
            placeholder="Search contacts"
            value={contactSearch}
            onChange={(e) => setContactSearch(e.target.value)}
            aria-label="Search contacts"
          />

          {filteredContacts.map(c => (
            <div
              key={c.uid}
              className={`contact ${active?.uid === c.uid ? "active" : ""}`}
              onClick={() => {
                setActive(c);
                // on narrow screens, hide contacts after selecting
                if (window.innerWidth <= 900) setContactsVisible(false);
              }}
            >
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
        <main className="chat glass">
          <header>
            <div className="header-left">
              <button className="header-back" onClick={handleBack} title="Back">
                ←
              </button>

              <div className="header-profile" style={{cursor: "pointer"}} onClick={() => setShowAppSettings(v => !v)}>
                <img src={user?.photoURL || FALLBACK_AVATAR} alt="me" />
                <div>
                  <div className="title">{active ? active.email : (user?.email || "ChatEngine")}</div>
                  <div className="sub">{active ? (active.online ? "Online" : "Offline") : (user ? "You are logged in" : "")}</div>
                </div>
              </div>
            </div>

            <div className="header-controls">
              <input className="chat-search" placeholder="Search messages" value={chatSearch} onChange={(e)=>setChatSearch(e.target.value)} />

              {/* Chat Settings (per-chat) */}
              <button
                className="header-btn"
                title="Chat settings"
                onClick={() => setShowChatSettings(true)}
                disabled={!active}
                aria-disabled={!active}
              >
                ⚙️
              </button>

              {/* App settings quick button */}
              <button className="header-btn" title="App settings" onClick={() => router.push("/settings")}>
                ⚙️ App
              </button>
            </div>
          </header>

          <div className="messages" aria-live="polite" ref={messagesUnsubRef}>
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

      {/* App Settings quick overlay (opens when clicking your avatar) */}
      {showAppSettings && (
        <div className="app-settings-overlay glass" role="dialog" aria-modal="true">
          <h3>App Settings (Quick)</h3>
          <div style={{marginBottom:10}}>
            <strong>Account</strong>
            <div style={{fontSize:13, color:"#9aa6b9"}}>Change profile picture and name on Settings page</div>
          </div>

          <div style={{marginBottom:10}}>
            <strong>Privacy</strong>
            <div style={{fontSize:13, color:"#9aa6b9"}}>Configure Last seen & Profile photo in full Settings</div>
          </div>

          <div style={{display:"flex", gap:8, marginTop:8}}>
            <button onClick={() => { setShowAppSettings(false); router.push("/settings"); }}>Open full Settings</button>
            <button onClick={() => setShowAppSettings(false)} style={{background:"rgba(255,255,255,0.06)"}}>Close</button>
          </div>
        </div>
      )}

      {/* CHAT SETTINGS DRAWER */}
      <div className={`settings-drawer ${showChatSettings ? "open" : ""}`}>
        <h3>Chat Settings</h3>
        {!active ? (
          <div style={{opacity:0.7}}>Select a contact to change chat-specific settings</div>
        ) : (
          <>
            <div className="setting-row">
              <div>
                <div style={{fontWeight:600}}>{active.email}</div>
                <div style={{fontSize:13, color:"#9aa6b9"}}>Chat-specific options</div>
              </div>
            </div>

            <div className="setting-row">
              <div>Enter is Send</div>
              <div><input type="checkbox" defaultChecked /></div>
            </div>

            <div className="setting-row">
              <div>Chat Wallpaper</div>
              <div>
                <select defaultValue="">
                  <option value="">Default</option>
                  <option value="grid">Grid</option>
                  <option value="dots">Dots</option>
                  <option value="gradient">Gradient</option>
                </select>
              </div>
            </div>

            <div className="setting-row">
              <div>Font Size</div>
              <div>
                <select defaultValue="medium">
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>
            </div>

            <div style={{marginTop:12, display:"flex", gap:8}}>
              <button onClick={() => setShowChatSettings(false)}>Close</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
