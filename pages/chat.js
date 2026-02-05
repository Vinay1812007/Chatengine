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
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";
import { useRouter } from "next/router";

/* fallback avatar */
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
  const [typing, setTyping] = useState(false);

  const bottomRef = useRef(null);

  /* ================= AUTH + ONLINE ================= */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.replace("/");
        return;
      }

      setUser(u);
      setAuthReady(true);

      const ref = doc(db, "users", u.uid);

      await updateDoc(ref, {
        online: true,
        lastSeen: serverTimestamp()
      });

      const off = async () => {
        await updateDoc(ref, {
          online: false,
          lastSeen: serverTimestamp()
        });
      };

      window.addEventListener("beforeunload", off);
      return () => window.removeEventListener("beforeunload", off);
    });

    return () => unsub();
  }, [router]);

  const myUid = user?.uid;

  /* ================= CONTACTS ================= */
  useEffect(() => {
    if (!authReady || !myUid) return;

    return onSnapshot(collection(db, "users"), (snap) => {
      setContacts(
        snap.docs.map(d => d.data()).filter(u => u.uid !== myUid)
      );
    });
  }, [authReady, myUid]);

  /* ================= MESSAGES ================= */
  useEffect(() => {
    if (!activeUser || !myUid) return;

    const room = [myUid, activeUser.uid].sort().join("_");

    return onSnapshot(
      query(collection(db, "messages"), where("room", "==", room)),
      async (snap) => {
        const msgs = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => a.time - b.time);

        setMessages(msgs);

        // mark seen
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

  /* ================= TYPING LISTENER ================= */
  useEffect(() => {
    if (!activeUser || !myUid) return;

    const ref = doc(db, "typing", `${activeUser.uid}_${myUid}`);

    return onSnapshot(ref, (snap) => {
      setTyping(snap.exists() && snap.data().isTyping);
    });
  }, [activeUser, myUid]);

  /* ================= SEND MESSAGE ================= */
  async function send() {
    if (!text.trim() || !activeUser) return;

    const room = [myUid, activeUser.uid].sort().join("_");

    await addDoc(collection(db, "messages"), {
      room,
      from: myUid,
      to: activeUser.uid,
      text,
      time: Date.now(),
      status: "sent"
    });

    await deleteDoc(doc(db, "typing", `${myUid}_${activeUser.uid}`));
    setText("");
  }

  /* ================= HANDLE TYPING ================= */
  async function handleTyping(value) {
    setText(value);

    if (!activeUser) return;

    const ref = doc(db, "typing", `${myUid}_${activeUser.uid}`);

    if (value.trim()) {
      await setDoc(ref, {
        from: myUid,
        to: activeUser.uid,
        isTyping: true,
        time: serverTimestamp()
      });
    } else {
      await deleteDoc(ref);
    }
  }

  /* ================= ENTER TO SEND ================= */
  function handleKeyDown(e) {
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

  if (!authReady) return <div style={{ padding: 40 }}>Loading…</div>;

  return (
    <div className="chatLayout">
      {/* CONTACTS */}
      <div className="contacts">
        <h3>Contacts</h3>
        {contacts.map(u => (
          <div
            key={u.uid}
            className={`contact ${activeUser?.uid === u.uid ? "active" : ""}`}
            onClick={() => setActiveUser(u)}
          >
            <img src={u.photo || FALLBACK_AVATAR} className="avatar" />
            <div>
              <div>{u.email}</div>
              <small style={{ opacity: 0.7 }}>
                {u.online ? "🟢 Online" : "Last seen"}
              </small>
            </div>
          </div>
        ))}
      </div>

      {/* CHAT */}
      <div className="chatArea">
        <div className="chatHeader">
          {activeUser && (
            <div>
              <div>{activeUser.email}</div>
              {typing && (
                <small style={{ color: "#22c55e" }}>
                  typing…
                </small>
              )}
            </div>
          )}
          <button onClick={logout}>Logout</button>
        </div>

        {!activeUser ? (
          <div className="empty">Select a contact</div>
        ) : (
          <>
            <div className
