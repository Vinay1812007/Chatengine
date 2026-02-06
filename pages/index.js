import Head from "next/head";
import { useEffect } from "react";
import { useRouter } from "next/router";
import { auth } from "../lib/firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(user => {
      if (user) router.replace("/apps");
    });
    return () => unsub();
  }, []);

  async function googleLogin() {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    router.replace("/apps");
  }

  return (
    <>
      <Head>
        <title>ChatEngine Login</title>
      </Head>

      <div className="login glass">
        <h1>ChatEngine</h1>
        <button onClick={googleLogin}>
          Continue with Google
        </button>
      </div>
    </>
  );
}
