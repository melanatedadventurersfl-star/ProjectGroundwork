"use client";

import { useMemo, useState } from "react";

type FormState = {
  firstName: string;
  email: string;
  location: string;
  fit: string;
  acknowledgements: boolean[];
};

const acknowledgementText = [
  "I understand that applying does not guarantee selection.",
  "I will participate actively if selected.",
  "I will provide honest and thoughtful feedback.",
  "I understand that features may still be changing.",
];

const initialForm: FormState = {
  firstName: "",
  email: "",
  location: "",
  fit: "",
  acknowledgements: [false, false, false, false],
};

export default function EarlyAccessForm() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const formComplete = useMemo(() => {
    const fieldsComplete =
      form.firstName.trim().length > 0 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) &&
      form.location.trim().length > 0 &&
      form.fit.trim().length >= 50;

    return fieldsComplete && form.acknowledgements.every(Boolean);
  }, [form]);

  function toggleAcknowledgement(index: number) {
    setForm((current) => ({
      ...current,
      acknowledgements: current.acknowledgements.map((value, itemIndex) =>
        itemIndex === index ? !value : value
      ),
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formComplete) return;

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
      setMessage("Your request has been received. Selected individuals will receive a private invitation with next steps.");
      setForm(initialForm);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Please try again.");
    }
  }

  return (
    <form className="applicationCard" onSubmit={handleSubmit}>
      <div className="formColumn">
        <label>
          <span>First name</span>
          <input
            required
            type="text"
            autoComplete="given-name"
            placeholder="Your first name"
            value={form.firstName}
            onChange={(event) => setForm({ ...form, firstName: event.target.value })}
          />
        </label>

        <label>
          <span>Email address</span>
          <input
            required
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
        </label>

        <label>
          <span>Location</span>
          <input
            required
            type="text"
            autoComplete="address-level2"
            placeholder="City, state, or country"
            value={form.location}
            onChange={(event) => setForm({ ...form, location: event.target.value })}
          />
        </label>

        <label>
          <span>Why are you a strong fit to help test what comes next?</span>
          <textarea
            required
            minLength={50}
            rows={7}
            placeholder="Tell us how you connect with Melanated Adventurers and what you would bring as a tester."
            value={form.fit}
            onChange={(event) => setForm({ ...form, fit: event.target.value })}
          />
          <small>Minimum 50 characters.</small>
        </label>
      </div>

      <div className="acknowledgementPanel">
        <p className="panelEyebrow">Before requesting consideration</p>
        <p>All acknowledgements are required.</p>
        <div className="acknowledgementList">
          {acknowledgementText.map((text, index) => (
            <label className="acknowledgement" key={text}>
              <input
                required
                type="checkbox"
                checked={form.acknowledgements[index]}
                onChange={() => toggleAcknowledgement(index)}
              />
              <span>{text}</span>
            </label>
          ))}
        </div>
      </div>

      <button
        className="primaryButton submitButton"
        type="submit"
        disabled={status === "loading" || !formComplete}
      >
        {status === "loading" ? "Submitting..." : "Request Consideration"}
      </button>

      <p className="selectionNote">
        Selected individuals will receive a private invitation with next steps.
      </p>

      {message && (
        <p className={status === "success" ? "formMessage success" : "formMessage errorText"}>{message}</p>
      )}
    </form>
  );
}
