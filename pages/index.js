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
  const [error, setError] = useState("");
  const router = useRouter();

  async function emailAuth(isRegister) {
    setError("");

    if (!email || !password) {
      setError("Email and password required");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    try {
      const res = isRegister
        ? await createUserWithEmailAndPassword(auth, email, password)
        : await signInWithEmailAndPassword(auth, email, password);

      await setDoc(
        doc(db, "users", res.user.uid),
        {
          uid: res.user.uid,
          email: res.user.email,
          name: res.user.displayName || email.split("@")[0]
        },
        { merge: true }
      );

      router.push("/chat");
    } catch (e) {
      console.error(e);
      setError(e.message.replace("Firebase: ", ""));
    }
  }

  async function googleLogin() {
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);

      await setDoc(
        doc(db, "users", res.user.uid),
        {
          uid: res.user.uid,
          email: res.user.email,
          name: res.user.displayName
        },
        { merge: true }
      );

      router.push("/chat");
    } catch (e) {
      console.error(e);
      setError(e.message);
    }
  }

  return (
    <div className="auth">
      <h1>ChatEngine</h1>

      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {error && <div style={{ color: "red", marginTop: 8 }}>{error}</div>}

      <button onClick={() => emailAuth(false)}>Login</button>
      <button onClick={() => emailAuth(true)}>Register</button>

      <div className="divider">OR</div>

      <button className="google" onClick={googleLogin}>
        Continue with Google
      </button>
    </div>
  );
}
