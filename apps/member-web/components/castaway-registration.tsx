"use client";

import { FormEvent, useState } from "react";

export function CastawayRegistration() {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "duplicate" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/experiences/first-steps-castaway/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        firstName: form.get("firstName"),
        lastName: form.get("lastName"),
        email: form.get("email"),
        isNewcomer: form.get("isNewcomer") === "on",
        lunchSelected: form.get("lunchSelected") === "on",
        donationCents: Number(form.get("donationDollars") ?? 0) * 100,
        welcomeContactOptIn: form.get("welcomeContactOptIn") === "on",
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setState("error");
    setState(result.duplicate ? "duplicate" : "saved");
  }

  return <div className="panel"><p className="eyebrow">Pilot registration</p><h2>Reserve your free spot</h2><p className="muted">Lunch and support are optional. Registering does not require an active app account.</p>
    {state === "saved" && <p className="notice" role="status">You are registered. We will send the full event brief and confirmation steps.</p>}
    {state === "duplicate" && <p className="notice" role="status">This email is already registered for the pilot.</p>}
    {state === "error" && <p className="notice" role="alert">We could not complete registration. Please try again.</p>}
    <form onSubmit={submit}><div className="detailGrid"><label>First name<input name="firstName" required /></label><label>Last name<input name="lastName" required /></label><label>Email<input name="email" type="email" required /></label><label>Optional support amount<input name="donationDollars" type="number" min="0" step="1" defaultValue="0" /></label></div>
      <label className="check"><input name="isNewcomer" type="checkbox" />This would be my first MA experience.</label>
      <label className="check"><input name="welcomeContactOptIn" type="checkbox" defaultChecked />I would like a welcome contact before the event.</label>
      <label className="check"><input name="lunchSelected" type="checkbox" />Add the optional lunch. Payment instructions will follow.</label>
      <button disabled={state === "saving"}>{state === "saving" ? "Registering…" : "Register for free"}</button>
    </form>
  </div>;
}
