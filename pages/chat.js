// pages/chat.js
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
  setDoc,
  deleteDoc,
  getDoc
} from "firebase/firestore";
import { useRouter } from "next/router";
import { useTheme } from "../lib/themeContext";

const FALLBACK =
  "data:image/svg+xml;utf8," +
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>
    <circle cx='50' cy='50' r='50' fill='%23212b45'/>
    <circle cx='50' cy='38' r='16' fill='%239ca3af'/>
    <path d='M22 88c6-20 50-20 56 0' fill='%239ca3af'/>
  </svg>`;

export default function Chat() {
  const router = useRouter();
  const { drawerOpen, setDrawerOpen } = useTheme();
  const bottomRef = useRef(null);
  const msgUnsub = useRef(null);

  const [user, setUser] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const [typingRemote, setTypingRemote] = useState(false);
  const [wallpaperUrl, setWallpaperUrl] = useState("");
  const [unreadCounts, setUnreadCounts] = useState({});

  const myUid = user?.uid;

  /* AUTH */
  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) return router.replace("/");
      setUser(u);
      // ensure user doc exists may be created at register
      // update online flag
      try {
        await updateDoc(doc(db, "users", u.uid), { online: true });
      } catch (e) {
        // ignore
      }
    });
  }, [router]);

  /* CONTACTS + unread counts */
  useEffect(() => {
    if (!myUid) return;
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      const all = snap.docs.map((d) => d.data()).filter((u) => u.uid !== myUid);
      setContacts(all);
    });

    // realtime unread counts: listen to messages where to==myUid
    const q = query(collection(db, "messages"), where("to", "==", myUid));
    const unsubUnread = onSnapshot(q, (snap) => {
      // compute counts grouped by the other uid (from)
      const counts = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        if (!data.read && data.to === myUid) {
          const other = data.from;
          counts[other] = (counts[other] || 0) + 1;
        }
      });
      setUnreadCounts(counts);
    });

    return () => {
      unsubUsers();
      unsubUnread();
    };
  }, [myUid]);

  /* OPEN CHAT SAFELY */
  async function openChat(u) {
    if (u.uid === activeUser?.uid) return;

    if (msgUnsub.current) {
      msgUnsub.current();
      msgUnsub.current = null;
    }

    setActiveUser(u);
    setMessages([]);
    setLoadingChat(true);

    const room = [myUid, u.uid].sort().join("_");

    // load wallpaper if any
    try {
      const wpDoc = await getDoc(doc(db, "wallpapers", room));
      if (wpDoc.exists()) setWallpaperUrl(wpDoc.data().url || "");
      else setWallpaperUrl("");
    } catch (e) {
      setWallpaperUrl("");
    }

    // subscribe messages
    msgUnsub.current = onSnapshot(
      query(collection(db, "messages"), where("room", "==", room)),
      (snap) => {
        const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a,b)=>a.time-b.time);
        setMessages(msgs);
        setLoadingChat(false);
        setTimeout(()=>bottomRef.current?.scrollIntoView(),50);
        // mark unread messages in this room as read (basic behavior)
        snap.docs.forEach(async (d) => {
          const data = d.data();
          if (data.to === myUid && !data.read) {
            try { await updateDoc(doc(db, "messages", d.id), { read: true }); } catch (e) {}
          }
        });
      }
    );

    // close drawer on mobile
    setDrawerOpen(false);
  }

  /* SEND + TYPING */
  let typingTimeout = null;
  async function handleTyping(v) {
    setText(v);
    if (!activeUser) return;
    const room = [myUid, activeUser.uid].sort().join("_");
    const typingRef = doc(db, "typing", room);
    // set typing doc
    await setDoc(typingRef, { uid: myUid, time: Date.now() });
    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(async () => {
      try { await deleteDoc(typingRef); } catch (e) {}
    }, 1500);
  }

  /* LISTEN FOR REMOTE TYPING */
  useEffect(() => {
    if (!activeUser) return;
    const room = [myUid, activeUser.uid].sort().join("_");
    const ref = doc(db, "typing", room);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setTypingRemote(false);
        return;
      }
      const d = snap.data();
      setTypingRemote(d.uid && d.uid !== myUid);
    });
    return () => unsub();
  }, [activeUser, myUid]);

  /* send message */
  async function send() {
    if (!text.trim() || !activeUser) return;
    const room = [myUid, activeUser.uid].sort().join("_");
    await addDoc(collection(db, "messages"), {
      room,
      from: myUid,
      to: activeUser.uid,
      text,
      time: Date.now(),
      read: false
    });
    setText("");
    // remove typing doc
    try { await deleteDoc(doc(db, "typing", room)); } catch (e) {}
  }

  /* responsive drawer toggle helper */
  function toggleDrawer() {
    setDrawerOpen(!drawerOpen);
  }

  /* cleanup on unmount */
  useEffect(()=> {
    return () => {
      if (msgUnsub.current) msgUnsub.current();
    };
  }, []);

  return (
    <>
      <Head><title>Chatgram</title></Head>

      <div className={`chatLayout`}>
        {/* Drawer overlay for mobile */}
        <aside className={`contacts ${drawerOpen ? "open" : ""}`}>
          <h3>Contacts</h3>
          {contacts.map(u => (
            <div
              key={u.uid}
              className={`contact ${activeUser?.uid === u.uid ? "active" : ""}`}
              onClick={() => openChat(u)}
            >
              <img src={u.photo || FALLBACK} className="avatar" />
              <div className="contactText">
                <div className="email">{u.email}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className={u.online ? "on" : "off"}>
                    {u.online ? "Online" : "Offline"}
                  </span>
                  {unreadCounts[u.uid] ? (
                    <div className="unreadBadge">{unreadCounts[u.uid]}</div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </aside>

        <main className="chatArea">
          <header className="chatHeader">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* mobile menu toggle */}
              <button className="glass" onClick={toggleDrawer} title="Contacts" style={{ padding: 8 }}>
                ☰
              </button>

              <div>
                <div style={{ fontWeight: 600 }}>
                  {activeUser?.email || "Select a contact"}
                </div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  {activeUser ? (activeUser.online ? "Online" : "Last seen") : ""}
                  {typingRemote && <span style={{ marginLeft: 8 }}>• <span className="typingDots">typing</span></span>}
                </div>
              </div>
            </div>

            <div className="callBtns">
              {activeUser && <button title="Voice call">📞</button>}
              {activeUser && <button title="Video call">🎥</button>}
              <button title="Settings" onClick={() => router.push("/settings")}>⚙️</button>
            </div>
          </header>

          {/* Chat wallpaper applied inline */}
          <div className="msgs" style={{ backgroundImage: wallpaperUrl ? `url(${wallpaperUrl})` : "none", backgroundSize: "cover", backgroundPosition: "center" }}>
            {!activeUser ? (
              <div className="empty">Select a contact</div>
            ) : loadingChat ? (
              <div className="empty">Loading chat…</div>
            ) : (
              <>
                {messages.map(m => (
                  <div key={m.id} className={`msgRow ${m.from === myUid ? "me" : ""}`}>
                    <div className="bubble">{m.text}</div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </>
            )}
          </div>

          <div className="bar">
            <input
              value={text}
              onChange={(e)=>handleTyping(e.target.value)}
              onKeyDown={(e)=> e.key === "Enter" && send()}
              placeholder="Type message…"
              disabled={!activeUser}
            />
            <button onClick={send} disabled={!activeUser}>Send</button>
          </div>
        </main>
      </div>
    </>
  );
}
