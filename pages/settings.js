// pages/settings.js
import Head from "next/head";
import { auth } from "../lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useTheme } from "../lib/themeContext";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

export default function Settings() {
  const router = useRouter();
  const user = auth.currentUser;
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState(user?.displayName || "");
  const [about, setAbout] = useState("");

  useEffect(() => {
    if (!user) router.replace("/");
  }, []);

  async function logout() {
    await signOut(auth);
    router.replace("/");
  }

  async function saveProfile() {
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid), {
      name,
      about
    });
    alert("Saved");
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
          <div>Name</div>
          <input value={name} onChange={(e) => setName(e.target.value)} />
          <div>About</div>
          <input value={about} onChange={(e) => setAbout(e.target.value)} />
          <div style={{ marginTop: 10 }}>
            <button onClick={saveProfile}>Save profile</button>
          </div>
        </section>

        <section>
          <h2>Privacy</h2>
          <p>Control who sees your Last Seen & Online, Profile Photo, About, and Status.</p>
          <p>Read Receipts: Toggle read receipts on/off (not implemented yet)</p>
          <p>Blocked Contacts: Manage blocked contacts (not implemented yet)</p>
        </section>

        <section>
          <h2>App Language</h2>
          <p>Change interface language (not implemented yet)</p>
        </section>

        <section>
          <h2>Theme</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setTheme("light")}>Light</button>
            <button onClick={() => setTheme("dark")}>Dark</button>
            <button onClick={() => setTheme("system")}>System</button>
          </div>
          <p style={{ marginTop: 8 }}>Current: {theme}</p>
        </section>

        <div style={{ marginTop: 14 }}>
          <button className="danger" onClick={logout}>
            Logout
          </button>
        </div>
      </div>
    </>
  );
}
