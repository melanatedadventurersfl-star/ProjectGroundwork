"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  location: string;
  socials: string;
  fit: string;
  marketingOptIn: boolean;
  acknowledgements: boolean[];
};

const acknowledgementText = [
  "I understand that requesting an invitation does not guarantee selection.",
  "If invited, I will participate with curiosity, respect, and consistency.",
  "I will provide thoughtful feedback that helps strengthen the experience for future members.",
  "I understand that the experience will continue to evolve, and I am ready to be part of that journey.",
];

const initialForm: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  location: "",
  socials: "",
  fit: "",
  marketingOptIn: false,
  acknowledgements: [false, false, false, false],
};

function phoneDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("1") && digits.length > 10 ? digits.slice(1, 11) : digits.slice(0, 10);
}

function formatUsPhone(value: string) {
  const digits = phoneDigits(value);
  if (!digits) return "";
  if (digits.length <= 3) return `+1 (${digits}`;
  if (digits.length <= 6) return `+1 (${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

const emailValid = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const textComplete = (value: string) => value.trim().length > 0;

export default function EarlyAccessForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [wasSubscribed, setWasSubscribed] = useState(false);

  function syncAutofilledFields() {
    const node = formRef.current;
    if (!node) return;
    const values = new FormData(node);
    setForm((current) => ({
      ...current,
      firstName: String(values.get("firstName") || ""),
      lastName: String(values.get("lastName") || ""),
      email: String(values.get("email") || ""),
      phone: formatUsPhone(String(values.get("phone") || "")),
      location: String(values.get("location") || ""),
      socials: String(values.get("socials") || ""),
      fit: String(values.get("fit") || ""),
    }));
  }

  useEffect(() => {
    const timers = [100, 400, 900, 1600].map((delay) => window.setTimeout(syncAutofilledFields, delay));
    return () => timers.forEach(window.clearTimeout);
  }, []);

  const phoneComplete = phoneDigits(form.phone).length === 10;

  const formComplete = useMemo(() => {
    const fieldsComplete =
      textComplete(form.firstName) &&
      textComplete(form.lastName) &&
      emailValid(form.email) &&
      phoneDigits(form.phone).length === 10 &&
      textComplete(form.location) &&
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
    syncAutofilledFields();

    const submitted = new FormData(event.currentTarget);
    const payload = {
      ...form,
      firstName: String(submitted.get("firstName") || form.firstName),
      lastName: String(submitted.get("lastName") || form.lastName),
      email: String(submitted.get("email") || form.email),
      phone: `+1${phoneDigits(String(submitted.get("phone") || form.phone))}`,
      location: String(submitted.get("location") || form.location),
      socials: String(submitted.get("socials") || form.socials),
      fit: String(submitted.get("fit") || form.fit),
    };

    const payloadComplete =
      payload.firstName.trim() &&
      payload.lastName.trim() &&
      emailValid(payload.email) &&
      /^\+1\d{10}$/.test(payload.phone) &&
      payload.location.trim() &&
      payload.fit.trim().length >= 50 &&
      payload.acknowledgements.every(Boolean);

    if (!payloadComplete) return;

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || "Something went wrong.";
        if (response.status === 409) {
          setStatus("error");
          setMessage(errorMessage);
          setShowDuplicateModal(true);
          return;
        }
        throw new Error(errorMessage);
      }

      setStatus("success");
      setWasSubscribed(Boolean(data.subscribed));
      setShowConfirmation(true);
      setForm(initialForm);
      event.currentTarget.reset();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Please try again.");
    }
  }

  return (
    <>
      <form ref={formRef} className="applicationCard" onSubmit={handleSubmit} onInput={syncAutofilledFields} onChange={syncAutofilledFields}>
        <div className="formColumn">
          <div className="nameGrid">
            <label>
              <span>First name</span>
              <input className={textComplete(form.firstName) ? "fieldComplete" : ""} required name="firstName" type="text" autoComplete="given-name" placeholder="First name" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} />
            </label>
            <label>
              <span>Last name</span>
              <input className={textComplete(form.lastName) ? "fieldComplete" : ""} required name="lastName" type="text" autoComplete="family-name" placeholder="Last name" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} />
            </label>
          </div>

          <label>
            <span>Email address</span>
            <input className={emailValid(form.email) ? "fieldComplete" : ""} required name="email" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </label>

          <label>
            <span>Phone number</span>
            <input className={phoneComplete ? "fieldComplete" : ""} required name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={17} placeholder="+1 (555) 555-5555" value={form.phone} onChange={(event) => setForm({ ...form, phone: formatUsPhone(event.target.value) })} />
            <small>US numbers only. Country code +1 is added automatically.</small>
          </label>

          <label>
            <span>Location</span>
            <input className={textComplete(form.location) ? "fieldComplete" : ""} required name="location" type="text" autoComplete="address-level2" placeholder="City, state, or country" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
          </label>

          <label>
            <span>Social profiles <em>Optional</em></span>
            <input className={textComplete(form.socials) ? "fieldComplete" : ""} name="socials" type="text" autoComplete="off" placeholder="Instagram, Facebook, TikTok, LinkedIn, or another profile" value={form.socials} onChange={(event) => setForm({ ...form, socials: event.target.value })} />
            <small>Share any handles or profile links you would like us to know about.</small>
          </label>

          <label>
            <span>Why would you make a strong Pathfinder for Melanated Adventurers?</span>
            <textarea
              required
              name="fit"
              minLength={50}
              rows={7}
              className={form.fit.length > 0 && form.fit.trim().length < 50 ? "needsMore" : form.fit.trim().length >= 50 ? "fieldComplete" : ""}
              placeholder="Tell us how you connect with the mission, how you show up in community, and what you would bring to the journey."
              value={form.fit}
              onChange={(event) => setForm({ ...form, fit: event.target.value })}
            />
            <small className={form.fit.length > 0 && form.fit.trim().length < 50 ? "characterCount warning" : form.fit.trim().length >= 50 ? "characterCount complete" : "characterCount"}>
              {form.fit.trim().length >= 50 ? `${form.fit.trim().length} characters · Ready` : `${form.fit.trim().length}/50 characters minimum`}
            </small>
          </label>
        </div>

        <div className="acknowledgementPanel">
          <p className="panelEyebrow">The Pathfinder Commitment</p>
          <p>All acknowledgements are required before your request can be submitted.</p>
          <div className="acknowledgementList">
            {acknowledgementText.map((text, index) => (
              <label className="acknowledgement" key={text}>
                <input required type="checkbox" checked={form.acknowledgements[index]} onChange={() => toggleAcknowledgement(index)} />
                <span>{text}</span>
              </label>
            ))}
          </div>

          <div className="marketingConsent">
            <p className="panelEyebrow">Keep Me Connected</p>
            <label className="acknowledgement optionalConsent">
              <input type="checkbox" checked={form.marketingOptIn} onChange={(event) => setForm({ ...form, marketingOptIn: event.target.checked })} />
              <span>I’d like to receive occasional emails about Melanated Adventurers experiences, news, and community updates. I can unsubscribe at any time.</span>
            </label>
          </div>
        </div>

        <button className="primaryButton submitButton" type="submit" disabled={status === "loading" || !formComplete}>
          {status === "loading" ? "Sending Request..." : "Request a Pathfinder Invitation"}
        </button>

        <p className="selectionNote">Selected individuals will receive a private invitation with expectations and next steps.</p>

        {message && !showDuplicateModal && <p className="formMessage errorText">{message}</p>}
      </form>

      {showConfirmation && (
        <div className="modalBackdrop" role="presentation" onClick={() => setShowConfirmation(false)}>
          <div className="confirmationModal compactModal" role="dialog" aria-modal="true" aria-labelledby="confirmation-title" onClick={(event) => event.stopPropagation()}>
            <p className="panelEyebrow">Request Received</p>
            <h2 id="confirmation-title">Application submitted.</h2>
            <p>We’ll review your Pathfinder application and contact selected individuals with next steps.</p>
            {wasSubscribed && <p className="subscriptionConfirmation">You’re also subscribed to Melanated Adventurers email updates.</p>}
            <button className="primaryButton" type="button" onClick={() => setShowConfirmation(false)}>Close</button>
          </div>
        </div>
      )}

      {showDuplicateModal && (
        <div className="modalBackdrop" role="presentation" onClick={() => setShowDuplicateModal(false)}>
          <div className="confirmationModal compactModal duplicateModal" role="dialog" aria-modal="true" aria-labelledby="duplicate-title" onClick={(event) => event.stopPropagation()}>
            <p className="panelEyebrow">Application Already Received</p>
            <h2 id="duplicate-title">You’re already on the list.</h2>
            <p>{message}</p>
            <button className="primaryButton" type="button" onClick={() => setShowDuplicateModal(false)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
