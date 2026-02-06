import { auth } from "../lib/firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useRouter } from "next/router";

export default function Login() {
  const router = useRouter();

  async function login() {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    router.push("/apps");
  }

  return (
    <div className="centerPage">
      <h1>Welcome</h1>
      <button onClick={login}>Login with Google</button>
    </div>
  );
}
