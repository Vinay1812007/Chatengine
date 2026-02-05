import { useEffect, useState, useRef } from "react";
import { auth, db, storage } from "../lib/firebase";
import { collection, addDoc, query, where, onSnapshot } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export default function Chat() {
  const [room] = useState("global");
  const [text, setText] = useState("");
  const [msgs, setMsgs] = useState([]);
  const bottom = useRef();

  useEffect(() => {
    const q = query(collection(db, "messages"), where("room", "==", room));
    return onSnapshot(q, snap => {
      const m = snap.docs.map(d => d.data())
        .sort((a,b)=>a.clientTime-b.clientTime);
      setMsgs(m);
      setTimeout(()=>bottom.current?.scrollIntoView(),50);
    });
  }, []);

  async function send() {
    if (!text.trim()) return;
    await addDoc(collection(db,"messages"),{
      text,
      room,
      uid: auth.currentUser.uid,
      email: auth.currentUser.email,
      clientTime: Date.now()
    });
    setText("");
  }

  return (
    <div className="chat">
      <div className="msgs">
        {msgs.map((m,i)=>(
          <div key={i} className="bubble">
            <b>{m.email}</b>
            <div>{m.text}</div>
          </div>
        ))}
        <div ref={bottom} />
      </div>

      <div className="bar">
        <input
          value={text}
          onChange={e=>setText(e.target.value)}
          placeholder="Type message..."
        />
        <button onClick={send}>Send</button>
      </div>
    </div>
  );
}
