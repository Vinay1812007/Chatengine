import { useState } from "react";
import { auth, db } from "../lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/router";

export default function Index() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  async function emailAuth(register) {
    if (!email || !password) return alert("Enter email & password");

    const res = register
      ? await createUserWithEmailAndPassword(auth, email, password)
      : await signInWithEmailAndPassword(auth, email, password);

    await setDoc(doc(db, "users", res.user.uid), {
      uid: res.user.uid,
      email: res.user.email,
      name: res.user.displayName || email.split("@")[0]
    }, { merge: true });

    router.push("/chat");
  }

  async function googleLogin() {
    const provider = new GoogleAuthProvider();
    const res = await signInWithPopup(auth, provider);

    await setDoc(doc(db, "users", res.user.uid), {
      uid: res.user.uid,
      email: res.user.email,
      name: res.user.displayName
    }, { merge: true });

    router.push("/chat");
  }

  return (
    <div className="auth">
      <h1>ChatEngine</h1>

      <input placeholder="Email" onChange={e=>setEmail(e.target.value)} />
      <input type="password" placeholder="Password" onChange={e=>setPassword(e.target.value)} />

      <button onClick={()=>emailAuth(false)}>Login</button>
      <button onClick={()=>emailAuth(true)}>Register</button>

      <div className="divider">OR</div>

      <button className="google" onClick={googleLogin}>
        Continue with Google
      </button>
    </div>
  );
}
