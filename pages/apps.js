// pages/apps.js
import Head from "next/head";
import { useRouter } from "next/router";

export default function Apps() {
  const router = useRouter();
  return (
    <>
      <Head>
        <title>Apps</title>
      </Head>

      <div className="centerPage">
        <h1>Apps</h1>
        <div className="appGrid" style={{ marginTop: 12 }}>
          <div className="appCard" onClick={() => router.push("/chat")}>
            💬 Chatgram
          </div>
        </div>
        <p style={{ marginTop: 18, opacity: 0.7 }}>More coming soon…</p>
      </div>
    </>
  );
}
