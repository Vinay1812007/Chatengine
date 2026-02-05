import { auth, db } from "../lib/firebase";
import {
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/router";
import { useState } from "react";

export default function Index() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function googleLogin() {
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);

      await setDoc(
        doc(db, "users", res.user.uid),
        {
          uid: res.user.uid,
          email: res.user.email,
          name: res.user.displayName,
          photo: res.user.photoURL || ""
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

      {error && (
        <div style={{ color: "red", marginBottom: 10 }}>
          {error}
        </div>
      )}

      <button className="google" onClick={googleLogin}>
        Continue with Google
      </button>
    </div>
  );
}
