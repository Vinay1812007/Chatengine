// pages/index.js
import Head from "next/head";
import { useEffect } from "react";
import { useRouter } from "next/router";
import { auth } from "../lib/firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(user => {
      if (user) router.replace("/chat");
    });
    return () => unsub();
  }, []);

  async function googleLogin() {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.replace("/chat");
    } catch (err) {
      console.error("Google login failed:", err);
      alert("Login failed: " + (err.message || err));
    }
  }

  return (
    <>
      <Head>
        <title>ChatEngine — Login</title>
      </Head>

      <div className="login glass">
        <h1>ChatEngine</h1>
        <p style={{opacity:0.8}}>Sign in with your Google account to continue</p>
        <button onClick={googleLogin}>Continue with Google</button>
      </div>
    </>
  );
}
