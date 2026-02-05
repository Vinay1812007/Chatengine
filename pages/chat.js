import { useEffect, useState, useRef } from "react";
import { auth, db } from "../lib/firebase";
import {
  collection,
  addDoc,
  query,
  onSnapshot,
  where
} from "firebase/firestore";

export default function Chat() {
  const [users, setUsers] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const bottomRef = useRef();

  const myUid = auth.currentUser.uid;

  // Load contacts
  useEffect(() => {
    const q = query(collection(db, "users"));
    return onSnapshot(q, snap => {
      setUsers(snap.docs.map(d => d.data()).filter(u => u.uid !== myUid));
    });
  }, []);

  // Load messages
  useEffect(() => {
    if (!activeUser) return;

    const roomId = [myUid, activeUser.uid].sort().join("_");
    const q = query(collection(db, "messages"), where("room", "==", roomId));

    return onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => d.data())
        .sort((a,b)=>a.time-b.time);
      setMessages(msgs);
      setTimeout(()=>bottomRef.current?.scrollIntoView(),50);
    });
  }, [activeUser]);

  async function send() {
    if (!text || !activeUser) return;

    const roomId = [myUid, activeUser.uid].sort().join("_");

    await addDoc(collection(db, "messages"), {
      room: roomId,
      from: myUid,
      to: activeUser.uid,
      text,
      time: Date.now()
    });

    setText("");
  }

  return (
    <div className="chatLayout">

      {/* CONTACTS */}
      <div className="contacts">
        <h3>Contacts</h3>
        {users.map(u=>(
          <div
            key={u.uid}
            className={`contact ${activeUser?.uid===u.uid?'active':''}`}
            onClick={()=>setActiveUser(u)}
          >
            {u.email}
          </div>
        ))}
      </div>

      {/* CHAT */}
      <div className="chatArea">
        {!activeUser ? (
          <div className="empty">Select a contact</div>
        ) : (
          <>
            <div className="msgs">
              {messages.map((m,i)=>(
                <div key={i} className={`bubble ${m.from===myUid?'me':''}`}>
                  {m.text}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="bar">
              <input
                value={text}
                onChange={e=>setText(e.target.value)}
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
