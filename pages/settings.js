import Head from "next/head";
import { useRouter } from "next/router";

export default function Settings() {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>Settings</title>
      </Head>

      <div className="settings glass">
        <h2>Settings</h2>

        <section>
          <h3>Account</h3>
          <p>Change profile photo</p>
          <p>Change name</p>
        </section>

        <section>
          <h3>Privacy</h3>
          <p>Last seen & online</p>
          <p>Profile photo</p>
          <p>Read receipts</p>
        </section>

        <section>
          <h3>Chats</h3>
          <p>Wallpaper</p>
          <p>Font size</p>
          <p>Enter is send</p>
        </section>

        <button onClick={() => router.back()}>Back</button>
      </div>
    </>
  );
}
