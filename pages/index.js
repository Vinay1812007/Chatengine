import Head from "next/head";
import { useEffect } from "react";
import { auth } from "../lib/firebase";
import { useRouter } from "next/router";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (auth.currentUser) router.replace("/apps");
  }, []);

  return (
    <>
      <Head>
        <title>Welcome</title>
      </Head>

      <div className="centerPage">
        <h1>Welcome</h1>
        <p>Please login</p>
      </div>
    </>
  );
}
