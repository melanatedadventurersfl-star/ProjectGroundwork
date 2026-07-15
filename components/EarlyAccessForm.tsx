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
  "I understand that submitting this form does not guarantee selection.",
  "I understand that selected testers are expected to participate actively and provide thoughtful feedback.",
  "I understand that early-access features may still be changing or incomplete.",
  "I am prepared to commit the time needed during the testing period.",
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
  const allAcknowledged = useMemo(() => form.acknowledgements.every(Boolean), [form.acknowledgements]);

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
      setMessage("Your request has been received. Selected applicants will receive a private invitation with next steps.");
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
          <small>Jacksonville and surrounding areas will be prioritized for the first cohort.</small>
        </label>

        <label>
          <span>What makes you a strong fit for the first MA testing cohort?</span>
          <textarea
            required
            minLength={50}
            rows={7}
            placeholder="Share how you connect with the MA mission, how you show up in community, and what you would bring to the testing experience."
            value={form.fit}
            onChange={(event) => setForm({ ...form, fit: event.target.value })}
          />
        </label>
      </div>

      <div className="acknowledgementPanel">
        <p className="panelEyebrow">Before requesting consideration</p>
        <p>Please review and acknowledge the following:</p>
        <div className="acknowledgementList">
          {acknowledgementText.map((text, index) => (
            <label className="acknowledgement" key={text}>
              <input
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
        disabled={status === "loading" || !allAcknowledged}
      >
        {status === "loading" ? "Submitting..." : "Request Consideration"}
      </button>

      <p className="selectionNote">
        Submitting does not guarantee selection. Chosen applicants will receive a private invitation with expectations and next steps.
      </p>

      {message && (
        <p className={status === "success" ? "formMessage success" : "formMessage errorText"}>{message}</p>
      )}
    </form>
  );
}
