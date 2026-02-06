// pages/settings.js
import Head from "next/head";
import { useRouter } from "next/router";

export default function Settings() {
  const router = useRouter();

  return (
    <>
      <Head><title>ChatEngine Settings</title></Head>

      <div className="settings glass" style={{padding:24, maxWidth:980, margin:"36px auto"}}>
        <h2>App Settings</h2>

        <section style={{marginTop:16}}>
          <h3>Account</h3>
          <div style={{color:"#9aa6b9"}}>
            Change profile picture, name and email display. (Use Firebase console or implement upload flow)
          </div>
        </section>

        <section style={{marginTop:16}}>
          <h3>Privacy</h3>
          <div style={{display:"grid", gap:8, marginTop:8}}>
            <label style={{display:"flex", justifyContent:"space-between"}}>
              <span>Last seen & online</span>
              <input type="checkbox" />
            </label>
            <label style={{display:"flex", justifyContent:"space-between"}}>
              <span>Profile photo</span>
              <input type="checkbox" />
            </label>
            <label style={{display:"flex", justifyContent:"space-between"}}>
              <span>Read receipts</span>
              <input type="checkbox" />
            </label>
          </div>
        </section>

        <section style={{marginTop:16}}>
          <h3>Chats</h3>
          <div style={{display:"grid", gap:8, marginTop:8}}>
            <label style={{display:"flex", justifyContent:"space-between"}}>
              <span>Enter is Send (Web)</span>
              <input type="checkbox" defaultChecked />
            </label>

            <label style={{display:"flex", justifyContent:"space-between"}}>
              <span>Media Visibility</span>
              <input type="checkbox" />
            </label>

            <label style={{display:"flex", justifyContent:"space-between"}}>
              <span>Theme</span>
              <select defaultValue="system">
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </label>
          </div>
        </section>

        <div style={{marginTop:20, display:"flex", gap:8}}>
          <button onClick={() => router.back()}>Back</button>
        </div>
      </div>
    </>
  );
}
