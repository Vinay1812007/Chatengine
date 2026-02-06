// pages/index.js
import Head from "next/head";
import { useEffect } from "react";
import { auth } from "../lib/firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useRouter } from "next/router";
import { useTheme } from "../lib/themeContext";

export default function Home() {
  const router = useRouter();
  const { theme } = useTheme();

  useEffect(() => {
    if (auth.currentUser) router.replace("/apps");
  }, []);

  async function login() {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    router.push("/apps");
  }

  return (
    <>
      <Head>
        <title>Welcome</title>
      </Head>

      <div className="centerPage">
        <div style={{ width: 420 }}>
          <h1 style={{ textAlign: "center", marginBottom: 6 }}>Sirimillavinay</h1>
          <p style={{ textAlign: "center", color: "rgba(255,255,255,0.7)" }}>
            Login to access apps
          </p>

          <button className="glass big" onClick={login} style={{ width: "100%", marginTop: 18 }}>
            Continue with Google
          </button>

          <div style={{ marginTop: 16, opacity: 0.7, textAlign: "center" }}>
            (If already logged in you will be redirected)
          </div>
        </div>
      </div>
    </>
  );
}
