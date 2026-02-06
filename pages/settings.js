import Head from "next/head";
import { auth } from "../lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/router";

export default function Settings() {
  const router = useRouter();
  const user = auth.currentUser;

  async function logout() {
    await signOut(auth);
    router.replace("/");
  }

  return (
    <>
      <Head>
        <title>Settings</title>
      </Head>

      <div className="settingsPage">
        <h1>Settings</h1>

        <section>
          <h2>Account</h2>
          <p>Name: {user?.displayName}</p>
          <p>Email: {user?.email}</p>
          <p>Change Profile Photo</p>
        </section>

        <section>
          <h2>Privacy</h2>
          <p>Last Seen & Online</p>
          <p>Profile Photo</p>
          <p>About</p>
          <p>Status</p>
          <p>Read Receipts</p>
          <p>Blocked Contacts</p>
        </section>

        <section>
          <h2>Chats</h2>
          <p>Theme</p>
          <p>Wallpaper</p>
          <p>Enter is Send</p>
          <p>Media Visibility</p>
          <p>Font Size</p>
        </section>

        <button className="danger" onClick={logout}>
          Logout
        </button>
      </div>
    </>
  );
}
