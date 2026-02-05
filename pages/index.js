import { useEffect, useState, useRef } from 'react';
import { initializeApp } from "firebase/app";
import {
  getAuth, signInWithPopup, GoogleAuthProvider, signOut,
  onAuthStateChanged
} from "firebase/auth";
import {
  getFirestore, collection, addDoc, query, orderBy,
  limit, serverTimestamp, onSnapshot
} from "firebase/firestore";
import styles from '../styles/Home.module.css';

// Initialize Firebase client using env vars
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

let app;
try {
  app = initializeApp(firebaseConfig);
} catch (e) {
  // ignore if already initialized during hot reloads
}

const auth = getAuth();
const db = getFirestore();

export default function Home() {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const bottomRef = useRef();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });

    // realtime listener for latest 200 messages
    const q = query(collection(db, 'messages'), orderBy('createdAt', 'asc'), limit(200));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      // scroll to bottom
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    });

    return () => {
      unsubscribeAuth();
      unsubscribe();
    };
  }, []);

  async function signIn() {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      alert('Sign in failed: ' + err.message);
    }
  }

  async function doSignOut() {
    await signOut(auth);
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!text.trim()) return;
    const payload = {
      text: text.trim(),
      uid: user.uid,
      displayName: user.displayName || 'Unknown',
      photoURL: user.photoURL || null,
      createdAt: serverTimestamp()
    };
    try {
      await addDoc(collection(db, 'messages'), payload);
      setText('');
    } catch (err) {
      console.error(err);
      alert('Send failed: ' + err.message);
    }
  }

  return (
    <div className={styles.container}>
      <main className={styles.chatContainer}>
        <header className={styles.header}>
          <h1>ChatEngine</h1>
          {user ? (
            <div className={styles.userRow}>
              <img src={user.photoURL || '/default-avatar.png'} alt="avatar" className={styles.avatar} />
              <span>{user.displayName}</span>
              <button onClick={doSignOut} className={styles.btn}>Sign out</button>
            </div>
          ) : (
            <button onClick={signIn} className={styles.btnPrimary}>Sign in with Google</button>
          )}
        </header>

        <section className={styles.messages}>
          {messages.map(m => (
            <div key={m.id} className={`${styles.message} ${user && m.uid === user.uid ? styles.me : ''}`}>
              <img src={m.photoURL || '/default-avatar.png'} alt="" className={styles.msgAvatar} />
              <div>
                <div className={styles.msgMeta}>
                  <strong>{m.displayName || 'Someone'}</strong>
                </div>
                <div className={styles.msgText}>{m.text}</div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </section>

        <form onSubmit={sendMessage} className={styles.sendForm}>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={user ? "Write a message..." : "Sign in to chat"}
            disabled={!user}
            className={styles.input}
          />
          <button type="submit" disabled={!user || !text.trim()} className={styles.sendBtn}>Send</button>
        </form>
      </main>
    </div>
  );
}
