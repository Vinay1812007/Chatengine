import { useEffect, useState, useRef } from 'react';
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged
} from "firebase/auth";
import {
  getFirestore, collection, addDoc, query, where, orderBy,
  limit, serverTimestamp, onSnapshot, doc, setDoc, updateDoc, getDoc, collectionGroup
} from "firebase/firestore";
import {
  getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL
} from "firebase/storage";
import styles from '../styles/Home.module.css';

// ---------- Firebase init (from env) ----------
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

if (!getApps().length) {
  initializeApp(firebaseConfig);
}

const auth = getAuth();
const db = getFirestore();
const storage = getStorage();

// ---------- Helpers ----------
function uidPair(a, b) {
  // deterministic id for 1:1 rooms (sort)
  return [a, b].sort().join('_');
}

// ---------- Main Component ----------
export default function Home() {
  const [user, setUser] = useState(null);
  const [roomId, setRoomId] = useState('global'); // default room
  const [roomList, setRoomList] = useState(['global']);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [uploadProgress, setUploadProgress] = useState(null);
  const bottomRef = useRef();

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, u => setUser(u));
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!roomId) return;
    // Listen for messages in current room
    // Use clientCreatedAt fallback if createdAt not present
    const q = query(
      collection(db, 'messages'),
      where('roomId', '==', roomId),
      orderBy('createdAt', 'asc'),
      limit(500)
    );

    const unsub = onSnapshot(q, snapshot => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // sort defensively: if createdAt missing, use clientCreatedAt
      msgs.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? new Date(a.clientCreatedAt).getTime();
        const tb = b.createdAt?.toMillis?.() ?? new Date(b.clientCreatedAt).getTime();
        return ta - tb;
      });
      setMessages(msgs);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }, err => {
      console.error('messages listener error:', err);
    });

    return () => unsub();
  }, [roomId]);

  // ---------- Auth ----------
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

  // ---------- Rooms ----------
  function createOrJoinRoom(id) {
    if (!id) return;
    setRoomId(id);
    if (!roomList.includes(id)) setRoomList(prev => [...prev, id]);
  }

  function startDM(otherUid) {
    if (!user) {
      alert('Sign in to start a direct message.');
      return;
    }
    const id = uidPair(user.uid, otherUid);
    createOrJoinRoom(`dm_${id}`);
  }

  // ---------- Sending messages ----------
  async function sendMessage(e) {
    e?.preventDefault();
    if (!user) { alert('Please sign in'); return; }
    if (!text.trim()) return;
    const payload = {
      text: text.trim(),
      uid: user.uid,
      displayName: user.displayName || 'Unknown',
      photoURL: user.photoURL || null,
      roomId,
      type: 'text',
      clientCreatedAt: new Date().toISOString(),
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

  // ---------- File upload (Firebase Storage) ----------
  async function uploadFile(ev) {
    const file = ev.target.files?.[0];
    if (!file) return;
    if (!user) { alert('Please sign in'); return; }

    const name = `${Date.now()}_${file.name}`;
    const path = `uploads/${roomId}/${name}`;
    const sRef = storageRef(storage, path);
    const uploadTask = uploadBytesResumable(sRef, file);

    setUploadProgress(0);
    uploadTask.on('state_changed', snapshot => {
      const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
      setUploadProgress(pct);
    }, err => {
      console.error('upload error', err);
      setUploadProgress(null);
      alert('Upload failed: ' + err.message);
    }, async () => {
      const url = await getDownloadURL(uploadTask.snapshot.ref);
      const payload = {
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL || null,
        roomId,
        type: 'file',
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        url,
        clientCreatedAt: new Date().toISOString(),
        createdAt: serverTimestamp()
      };
      await addDoc(collection(db, 'messages'), payload);
      setUploadProgress(null);
    });
  }

  // ---------- Simple 1:1 WebRTC call (Firestore signaling) ----------
  // NOTE: This implements basic create/join call using Firestore documents and subcollections for ice.
  // Works for 1:1. For multiple peers use an SFU in production.
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const [callId, setCallId] = useState('');
  const [currentCallDocId, setCurrentCallDocId] = useState(null);

  async function startLocalStream() {
    if (localStreamRef.current) return localStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStreamRef.current = stream;
    return stream;
  }

  async function createCall() {
    if (!user) { alert('Sign in to make calls'); return; }
    const stream = await startLocalStream();

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
        // In production add TURN server here
      ]
    });
    pcRef.current = pc;

    // remote stream
    const remoteStream = new MediaStream();
    remoteStreamRef.current = remoteStream;
    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach(t => remoteStream.addTrack(t));
    };

    // add local tracks
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    // create call doc
    const callDocRef = doc(collection(db, 'calls'));
    const offerCandidates = collection(callDocRef, 'offerCandidates');
    const answerCandidates = collection(callDocRef, 'answerCandidates');

    pc.onicecandidate = event => {
      if (event.candidate) {
        addDoc(offerCandidates, event.candidate.toJSON()).catch(console.error);
      }
    };

    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);

    const callData = {
      offer: {
        type: offerDescription.type,
        sdp: offerDescription.sdp
      },
      createdBy: user.uid,
      createdAt: serverTimestamp()
    };

    await setDoc(callDocRef, callData);
    setCurrentCallDocId(callDocRef.id);
    setCallId(callDocRef.id);

    // listen for remote answer
    onSnapshot(callDocRef, snapshot => {
      const data = snapshot.data();
      if (!data) return;
      if (data.answer && !pc.currentRemoteDescription) {
        const answerDesc = {
          type: data.answer.type,
          sdp: data.answer.sdp
        };
        pc.setRemoteDescription(answerDesc).catch(console.error);
      }
    });

    // add any remote ICE candidates (answer candidates)
    onSnapshot(answerCandidates, snap => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          const c = change.doc.data();
          pc.addIceCandidate(c).catch(console.error);
        }
      });
    });

    // listen for remote tracks (already above) - expose streams via UI
    // show local preview by attaching stream to video element via state (handled below)
    return callDocRef.id;
  }

  async function joinCall(joinId) {
    if (!joinId) return alert('Enter call ID to join');
    const callDocRef = doc(db, 'calls', joinId);
    const callSnapshot = await getDoc(callDocRef);
    if (!callSnapshot.exists()) return alert('Call does not exist');

    const stream = await startLocalStream();
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    });
    pcRef.current = pc;

    const remoteStream = new MediaStream();
    remoteStreamRef.current = remoteStream;
    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach(t => remoteStream.addTrack(t));
    };

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    const offerCandidates = collection(callDocRef, 'offerCandidates');
    const answerCandidates = collection(callDocRef, 'answerCandidates');

    pc.onicecandidate = event => {
      if (event.candidate) {
        addDoc(answerCandidates, event.candidate.toJSON()).catch(console.error);
      }
    };

    // fetch offer
    const callData = callSnapshot.data();
    const offerDesc = callData.offer;
    await pc.setRemoteDescription(offerDesc);

    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription);

    // write answer to call doc
    await updateDoc(callDocRef, {
      answer: {
        type: answerDescription.type,
        sdp: answerDescription.sdp
      },
      answeredBy: user.uid
    });

    // listen for remote ICE candidates (offer candidates)
    onSnapshot(offerCandidates, snap => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          const c = change.doc.data();
          pc.addIceCandidate(c).catch(console.error);
        }
      });
    });

    setCurrentCallDocId(joinId);
    setCallId(joinId);
  }

  function hangup() {
    try {
      pcRef.current?.getSenders?.().forEach(s => s.track?.stop?.());
    } catch {}
    pcRef.current?.close?.();
    pcRef.current = null;
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    setCurrentCallDocId(null);
    setCallId('');
    // Note: call documents remain in Firestore. You can delete them programmatically.
  }

  // ---------- Render ----------
  return (
    <div className={styles.container}>
      <main className={styles.chatContainer}>
        <header className={styles.header}>
          <h1>ChatEngine</h1>

          <div style={{display:'flex', gap:12, alignItems:'center'}}>
            <div className={styles.rooms}>
              <label>Room:</label>
              <select value={roomId} onChange={(e)=>setRoomId(e.target.value)}>
                {roomList.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <input placeholder="new room id" onKeyDown={(e)=>{ if(e.key==='Enter'){ createOrJoinRoom(e.target.value); e.target.value=''; }}} />
            </div>

            {user ? (
              <div className={styles.userRow}>
                <img src={user.photoURL || '/default-avatar.png'} alt="avatar" className={styles.avatar} />
                <span className={styles.userName}>{user.displayName}</span>
                <button onClick={doSignOut} className={styles.btn}>Sign out</button>
              </div>
            ) : (
              <button onClick={signIn} className={styles.btnPrimary}>Sign in with Google</button>
            )}
          </div>
        </header>

        <section className={styles.messages}>
          {messages.map(m => (
            <div key={m.id} className={`${styles.message} ${user && m.uid === user.uid ? styles.me : ''}`}>
              <img src={m.photoURL || '/default-avatar.png'} alt="" className={styles.msgAvatar} />
              <div className={styles.msgBody}>
                <div className={styles.msgMeta}>
                  <strong>{m.displayName || 'Someone'}</strong>
                  <small className={styles.msgTime}>
                    { (m.createdAt?.toDate?.()?.toLocaleString?.()) ?? new Date(m.clientCreatedAt).toLocaleString() }
                  </small>
                </div>

                {m.type === 'text' && <div className={styles.msgText}>{m.text}</div>}

                {m.type === 'file' && (
                  <div className={styles.fileMsg}>
                    {m.mimeType?.startsWith('image/') ? (
                      <img src={m.url} alt={m.fileName} style={{maxWidth:'320px', borderRadius:8}}/>
                    ) : (
                      <a href={m.url} target="_blank" rel="noreferrer" className={styles.fileLink}>
                        {m.fileName} ⤓
                      </a>
                    )}
                    <div className={styles.fileMeta}>{Math.round((m.size||0)/1024)} KB • {m.mimeType}</div>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </section>

        <form onSubmit={sendMessage} className={styles.sendForm}>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={user ? `Message #${roomId}` : "Sign in to chat"}
            disabled={!user}
            className={styles.input}
          />
          <label className={styles.uploadLabel}>
            📎
            <input type="file" onChange={uploadFile} style={{display:'none'}} />
          </label>
          <button type="submit" disabled={!user || !text.trim()} className={styles.sendBtn}>Send</button>
        </form>

        <div className={styles.bottomBar}>
          {uploadProgress !== null && <div>Uploading: {uploadProgress}%</div>}

          <div className={styles.callArea}>
            <div>
              <input placeholder="call id" value={callId} onChange={(e)=>setCallId(e.target.value)} />
              <button onClick={()=>createCall()} className={styles.btn}>Create Call</button>
              <button onClick={()=>joinCall(callId)} className={styles.btn}>Join Call</button>
              <button onClick={hangup} className={styles.btnDanger}>Hangup</button>
            </div>
            <div className={styles.videoPreview}>
              <video autoPlay playsInline muted ref={(el)=>{ if(el && localStreamRef.current){ el.srcObject = localStreamRef.current }}} style={{width:160, height:120, borderRadius:8, background:'#000'}} />
              <video autoPlay playsInline ref={(el)=>{ if(el && remoteStreamRef.current){ el.srcObject = remoteStreamRef.current }}} style={{width:160, height:120, borderRadius:8, background:'#000'}} />
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
