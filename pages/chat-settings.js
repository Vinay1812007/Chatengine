// pages/chat-settings.js
import Head from "next/head";
import { useRouter } from "next/router";
import { auth } from "../lib/firebase";
import { useEffect, useState } from "react";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

export default function ChatSettings() {
  const router = useRouter();
  const user = auth.currentUser;
  const [room, setRoom] = useState("");
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!user) router.replace("/");
  }, []);

  async function saveWallpaper() {
    if (!room || !url) {
      alert("Set room and URL");
      return;
    }
    await setDoc(doc(db, "wallpapers", room), { url });
    alert("Saved wallpaper");
  }

  async function load() {
    if (!room) return;
    const snap = await getDoc(doc(db, "wallpapers", room));
    if (snap.exists()) setUrl(snap.data().url || "");
    else setUrl("");
  }

  return (
    <>
      <Head>
        <title>Chat Settings</title>
      </Head>

      <div className="settingsPage">
        <h1>Chat Settings</h1>

        <section>
          <h2>Theme & Chat Behavior</h2>
          <p>Enter is Send (Android)</p>
          <p>Media Visibility</p>
          <p>Font Size</p>
        </section>

        <section>
          <h2>Wallpaper per conversation</h2>
          <p>To set a wallpaper for a chat, enter the room id (user1_user2 sorted) and paste a public image URL (or host an image in Storage and paste its URL).</p>
          <input placeholder="room id e.g. uid1_uid2" value={room} onChange={(e)=>setRoom(e.target.value)} />
          <input placeholder="image url" value={url} onChange={(e)=>setUrl(e.target.value)} />
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button onClick={saveWallpaper}>Save</button>
            <button onClick={load}>Load</button>
          </div>
        </section>
      </div>
    </>
  );
}
