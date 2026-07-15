"use client";

import { useState } from "react";

export default function EarlyAccessForm() {
  const [form, setForm] = useState({ name: "", email: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Something went wrong.");

      setStatus("success");
      setMessage("Thanks, you’re on the list.");
      setForm({ name: "", email: "" });
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Please try again.");
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Full name"
        value={form.name}
        onChange={(event) => setForm({ ...form, name: event.target.value })}
      />
      <input
        type="email"
        placeholder="Email address"
        required
        value={form.email}
        onChange={(event) => setForm({ ...form, email: event.target.value })}
      />
      <button className="btn primary" type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Submitting..." : "Request Early Access"}
      </button>
      {message && <p className={status === "success" ? "success" : "errorText"}>{message}</p>}
    </form>
  );
}
