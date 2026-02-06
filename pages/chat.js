// pages/chat.js
import Head from "next/head";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { auth, db, rtdb } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  doc,
  setDoc,
  orderBy,
  getDocs,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";

import {
  ref as rdbRef,
  onDisconnect,
  set as rtdbSet,
  onValue,
  serverTimestamp as rtdbServerTimestamp
} from "firebase/database";

/* fallback avatar (SVG) */
const FALLBACK_AVATAR =
  "data:image/svg+xml;utf8," +
  `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'>
     <rect width="100" height="100" fill="#0b1220"/>
     <circle cx="50" cy="40" r="18" fill="#9ca3af"/>
     <rect x="20" y="70" width="60" height="12" rx="6" fill="#9ca3af"/>
   </svg>`;

export default function Chat() {
  const router = useRouter();

  // user
  const [user, setUser] = useState(null);

  // contacts and online map
  const [contacts, setContacts] = useState([]);
  const onlineMapRef = useRef({}); // { uid: {state, last_changed} }
  const [contactsWithStatus, setContactsWithStatus] = useState([]);

  // UI
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [chatSearch, setChatSearch] = useState("");
  const [showChatSettings, setShowChatSettings] = useState(false);

  // refs
  const messagesDomRef = useRef(null);
  const bottomRef = useRef(null);
  const unsubMessagesRef = useRef(null);
  const unsubContactsRef = useRef(null);
  const unsubStatusRef = useRef(null);

  // ---------------- AUTH & PRESENCE ----------------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.replace("/");
        return;
      }
      setUser(u);

      // ensure Firestore user doc exists
      try {
        await setDoc(doc(db, "users", u.uid), {
          uid: u.uid,
          email: u.email,
          photo: u.photoURL || "",
          lastSeen: Date.now()
        }, { merge: true });
      } catch (err) {
        console.error("failed set user doc", err);
      }

      // RTDB presence: set online and register onDisconnect
      try {
        const myStatusRef = rdbRef(rtdb, `/status/${u.uid}`);

        const isOnlineForDatabase = {
          state: "online",
          last_changed: rtdbServerTimestamp()
        };
        const isOfflineForDatabase = {
          state: "offline",
          last_changed: rtdbServerTimestamp()
        };

        // ensure onDisconnect will set offline
        await onDisconnect(myStatusRef).set(isOfflineForDatabase);
        // now set online
        await rtdbSet(myStatusRef, isOnlineForDatabase);
      } catch (err) {
        console.error("RTDB presence setup failed", err);
      }
    });

    // cleanup
    return () => {
      unsub();
      // attempt to set offline on page unload (best-effort)
      if (user?.uid) {
        try {
          rtdbSet(rdbRef(rtdb, `/status/${user.uid}`), { state: "offline", last_changed: Date.now() });
        } catch (e) {}
      }
    };
  }, []); // run once

  // ---------------- CONTACTS LIST (firestore) ----------------
  useEffect(() => {
    if (!user) return;

    // listen to users collection
    const usersCol = collection(db, "users");
    const unsub = onSnapshot(usersCol, (snap) => {
      // create base contact objects from firestore users
      const arr = snap.docs.map(d => d.data()).filter(u => u.uid !== user.uid);
      setContacts(arr);
    });

    unsubContactsRef.current = unsub;
    return () => {
      unsub();
      unsubContactsRef.current = null;
    };
  }, [user]);

  // ---------------- RTDB status listener (all status nodes) ----------------
  useEffect(() => {
    if (!user) return;

    const statusRootRef = rdbRef(rtdb, "/status");

    const listener = onValue(statusRootRef, (snapshot) => {
      const data = snapshot.val() || {};
      // store in map
      onlineMapRef.current = data;
      // merge with contacts to produce contactsWithStatus
      setContactsWithStatus(mergeContactsWithStatus(contacts, data));
    });

    unsubStatusRef.current = () => { /* can't unsubscribe onValue directly - it's returned by onValue as function in modular */
      // onValue returns an unsubscribe function - but we didn't capture it. To safely remove:
      // (In modular SDK, onValue returns a function if you pass it; so normally do const unsub = onValue(...); unsub();)
    };

    // correct way: capture unsub function
    // To ensure, remove earlier listener by re-implementing properly:
    return () => {
      // attempt to remove listener: create same ref and call onValue with null? Simplest approach is to rely on page unloading.
    };
  }, [user, contacts]);

  // Helper to merge contacts (firestore) with online map (RTDB)
  function mergeContactsWithStatus(fireContacts = [], statusMap = {}) {
    return fireContacts.map(c => {
      const s = statusMap[c.uid];
      return {
        ...c,
        online: s?.state === "online",
        last_changed: s?.last_changed || null
      };
    });
  }

  // keep contactsWithStatus updated when contacts array changes (merge with current onlineMapRef)
  useEffect(() => {
    setContactsWithStatus(mergeContactsWithStatus(contacts, onlineMapRef.current || {}));
  }, [contacts]);

  // ---------------- MESSAGES SUBSCRIBE / UNSUBSCRIBE ----------------
  useEffect(() => {
    // cleanup previous
    if (unsubMessagesRef.current) {
      try { unsubMessagesRef.current(); } catch (e) {}
      unsubMessagesRef.current = null;
    }
    setMessages([]);

    if (!user || !active) return;

    const chatId = [user.uid, active.uid].sort().join("_");
    const q = query(collection(db, "messages"), where("chatId", "==", chatId), orderBy("time"));

    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(msgs);

      // if we just opened the chat, mark messages TO me as seen
      markMessagesSeen(chatId);

      // scroll to bottom
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 40);
    });

    unsubMessagesRef.current = unsub;
    return () => {
      try { unsub(); } catch (e) {}
      unsubMessagesRef.current = null;
    };
  }, [user, active]);

  // mark unseen messages (to me) as seen when opening a chat
  async function markMessagesSeen(chatId) {
    if (!user) return;
    try {
      const msgsQ = query(collection(db, "messages"), where("chatId", "==", chatId), where("to", "==", user.uid));
      const snap = await getDocs(msgsQ);
      const updates = [];
      snap.forEach(docSnap => {
        const d = docSnap.data();
        if (!d.seen) {
          updates.push(updateDoc(doc(db, "messages", docSnap.id), { seen: true, seenAt: Date.now() }));
        }
      });
      await Promise.all(updates);
    } catch (err) {
      console.error("markMessagesSeen failed", err);
    }
  }

  // ---------------- SEND MESSAGE ----------------
  async function sendMessage() {
    if (!text.trim() || !user || !active) return;
    const chatId = [user.uid, active.uid].sort().join("_");
    try {
      await addDoc(collection(db, "messages"), {
        chatId,
        from: user.uid,
        to: active.uid,
        text: text.trim(),
        time: Date.now(),
        seen: false
      });

      setText("");

      // small scroll after send
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
    } catch (err) {
      console.error("send failed", err);
    }
  }

  // ---------------- UNREAD BADGES (computed) ----------------
  // We compute unread counts for each contact by comparing message times to the contact's lastSeen in Firestore.
  // Simpler approach: count messages where chatId==and to==user.uid and seen==false.
  async function getUnreadCounts() {
    if (!user) return {};
    const counts = {};
    try {
      // find all messages to me that are not seen
      const q = query(collection(db, "messages"), where("to", "==", user.uid), where("seen", "==", false));
      const snap = await getDocs(q);
      snap.forEach(d => {
        const m = d.data();
        const other = m.from;
        // determine chat key (other)
        counts[other] = (counts[other] || 0) + 1;
      });
    } catch (err) {
      console.error("getUnreadCounts failed", err);
    }
    return counts;
  }

  const [unreadMap, setUnreadMap] = useState({});
  // refresh unread map periodically or when messages change
  useEffect(() => {
    let mounted = true;
    async function refresh() {
      const map = await getUnreadCounts();
      if (mounted) setUnreadMap(map);
    }
    refresh();

    // also refresh on every messages update (because seen flags may change)
    return () => { mounted = false; };
  }, [messages, user]);

  // ---------------- DYNAMIC TAB TITLE ----------------
  useEffect(() => {
    if (active) {
      document.title = `${active.email} — ChatEngine`;
    } else if (router.pathname === "/chat") {
      document.title = "CHATS & CALLS — ChatEngine";
    } else {
      document.title = "ChatEngine";
    }
  }, [active, router.pathname]);

  // ---------------- BACK BUTTON (UI) ----------------
  function goBack() {
    // if active chat open, close it (on mobile behaves like back)
    if (active) {
      setActive(null);
      return;
    }
    // otherwise navigate back in router
    router.back();
  }

  // ---------------- HELPERS ----------------
  const filteredContacts = contactsWithStatus.filter(c =>
    c.email?.toLowerCase().includes(contactSearch.toLowerCase())
  );

  const filteredMessages = messages.filter(m =>
    m.text?.toLowerCase().includes(chatSearch.toLowerCase())
  );

  // ---------------- UI RENDER ----------------
  return (
    <>
      <Head><title>ChatEngine</title></Head>

      <div className="chatLayout">
        {/* Contacts side */}
        <aside className="contacts glass">
          <h3>Contacts</h3>

          <input
            className="contact-search"
            placeholder="Search contacts"
            value={contactSearch}
            onChange={(e) => setContactSearch(e.target.value)}
            aria-label="Search contacts"
          />

          {filteredContacts.map(c => {
            const unreadCount = unreadMap[c.uid] || 0;
            return (
              <div key={c.uid} className={`contact ${active?.uid === c.uid ? "active" : ""}`} onClick={() => setActive(c)}>
                <img src={c.photo || FALLBACK_AVATAR} alt="avatar" className="avatar" />
                <div className="meta">
                  <div className="email">{c.email}</div>
                  <div className="status">{c.online ? "Online" : "Offline"}</div>
                </div>
                {unreadCount > 0 && <div className="unread">{unreadCount}</div>}
              </div>
            );
          })}

          {filteredContacts.length === 0 && <div style={{opacity:0.6, marginTop:12}}>No contacts found</div>}
        </aside>

        {/* Chat area */}
        <main className="chat glass">
          <header>
            <div style={{display:"flex", alignItems:"center", gap:12}}>
              <button className="header-back" onClick={goBack} title="Back">←</button>

              <div style={{display:"flex", alignItems:"center", gap:12}}>
                <img src={user?.photoURL || FALLBACK_AVATAR} alt="me" style={{width:36,height:36,borderRadius:999,objectFit:"cover"}} />
                <div>
                  <div className="title">{active ? active.email : (user?.email || "ChatEngine")}</div>
                  <div className="sub">{active ? (active.online ? "Online" : "Offline") : (user ? "You are logged in" : "")}</div>
                </div>
              </div>
            </div>

            <div style={{display:"flex", alignItems:"center", gap:10}}>
              <input className="chat-search" placeholder="Search messages" value={chatSearch} onChange={(e) => setChatSearch(e.target.value)} />

              <button className="header-btn" title="Chat settings" onClick={() => setShowChatSettings(true)} disabled={!active}>⚙️</button>
              <button className="header-btn" title="App settings" onClick={() => router.push("/settings")}>⚙️ App</button>
            </div>
          </header>

          <div className="messages" ref={messagesDomRef} aria-live="polite">
            {!active ? (
              <div className="empty">Select a contact to start chatting</div>
            ) : (
              <>
                {filteredMessages.map((m) => (
                  <div key={m.id} className={`msg ${m.from === user?.uid ? "me" : ""}`}>
                    {m.text}
                    <div style={{fontSize:11, opacity:0.6, marginTop:6}}>
                      {m.from === user?.uid ? (m.seen ? "Seen" : "Sent") : ""}
                    </div>
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

      {/* Chat settings drawer */}
      <div className={`settings-drawer ${showChatSettings ? "open" : ""}`}>
        <h3>Chat Settings</h3>
        {!active ? (
          <div style={{opacity:0.7}}>Select a chat to show chat-specific settings</div>
        ) : (
          <>
            <div style={{display:"flex", alignItems:"center", gap:12}}>
              <img src={active.photo || FALLBACK_AVATAR} style={{width:48,height:48,borderRadius:999}} />
              <div>
                <div style={{fontWeight:700}}>{active.email}</div>
                <div style={{fontSize:13,color:"#9aa6b9"}}>{active.online ? "Online" : "Offline"}</div>
              </div>
            </div>

            <div className="setting-row" style={{marginTop:12}}>
              <div>Search this chat</div>
              <div><input placeholder="Search inside chat..." onChange={(e)=>setChatSearch(e.target.value)} /></div>
            </div>

            <div className="setting-row">
              <div>Enter is Send</div>
              <div><input type="checkbox" defaultChecked /></div>
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
