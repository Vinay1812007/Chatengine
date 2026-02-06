import { useEffect, useState } from "react";
import { auth, db } from "../lib/firebase";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function Chat() {
  const [user, setUser] = useState(null);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        window.location.href = "/";
      } else {
        setUser(u);
      }
    });
    return () => unsub();
  }, []);

  // Messages listener
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => unsub();
  }, [user]);

  const sendMessage = async () => {
    if (!text.trim() || !user) return;

    await addDoc(collection(db, "messages"), {
      text,
      uid: user.uid,
      email: user.email,
      createdAt: serverTimestamp(),
    });

    setText("");
  };

  if (!user) return null;

  return (
    <div className="chatRoot">
      <div className="chatHeader">
        <span>{user.email}</span>
      </div>

      <div className="chatBody">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`bubble ${m.uid === user.uid ? "me" : "them"}`}
          >
            {m.text}
          </div>
        ))}
      </div>

      <div className="chatInput">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}
