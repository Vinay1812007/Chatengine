import { useEffect, useState, useRef } from "react";
import { auth, db } from "../lib/firebase";
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot
} from "firebase/firestore";

export default function Chat() {
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);
  const bottomRef = useRef();

  useEffect(() => {
    const q = query(
      collection(db, "messages"),
      where("room", "==", "global")
    );

    return onSnapshot(q, snap => {
      const data = snap.docs
        .map(d => d.data())
        .sort((a, b) => a.clientTime - b.clientTime);
      setMessages(data);
      setTimeout(() => bottomRef.current?.scrollIntoView(), 50);
    });
  }, []);

  async function send() {
    if (!text.trim()) return;

    await addDoc(collection(db, "messages"), {
      text,
      room: "global",
      uid: auth.currentUser.uid,
      email: auth.currentUser.email,
      clientTime: Date.now()
    });

    setText(""); // 🔥 THIS guarantees visibility reset
  }

  return (
    <div className="chat">
      <div className="msgs">
        {messages.map((m, i) => (
          <div className="bubble" key={i}>
            <b>{m.email}</b>
            <div className="msgText">{m.text}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="bar">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Type a message…"
        />
        <button onClick={send}>Send</button>
      </div>
    </div>
  );
}
