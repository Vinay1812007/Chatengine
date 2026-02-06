import { useRouter } from "next/router";

export default function Apps() {
  const router = useRouter();

  return (
    <div className="centerPage">
      <h1>Apps</h1>

      <div className="appCard" onClick={() => router.push("/chat")}>
        💬 ChatEngine
      </div>

      <p style={{ opacity: 0.6 }}>More coming soon…</p>
    </div>
  );
}
