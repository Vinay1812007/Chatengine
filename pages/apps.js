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
        <div className="appCard" onClick={() => router.push("/chat")}>
          💬 Chatgram
        </div>
        <p>More coming soon…</p>
      </div>
    </>
  );
}
