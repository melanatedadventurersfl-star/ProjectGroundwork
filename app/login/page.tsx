"use client";

import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: data.get("email"), next: new URLSearchParams(location.search).get("next") ?? "/member" }),
    });
    setState(response.ok ? "sent" : "error");
  }

  return <main><section className="section"><div className="panel">
    <p className="eyebrow">Member access</p>
    <h1>Sign in with a secure email link</h1>
    <p className="lede">Only invited members and authorized operators can enter the private app.</p>
    {state === "sent" && <p className="notice" role="status">Check your email for your sign-in link.</p>}
    {state === "error" && <p className="notice" role="alert">We could not send the link. Confirm your email and try again.</p>}
    <form onSubmit={submit}><label>Email<input name="email" type="email" autoComplete="email" required /></label><button disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Email me a sign-in link"}</button></form>
  </div></section></main>;
}
