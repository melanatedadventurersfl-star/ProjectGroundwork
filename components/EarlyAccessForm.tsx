"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  socials: string;
  fit: string;
  photoCaption: string;
  marketingOptIn: boolean;
  acknowledgements: boolean[];
};

const acknowledgementText = [
  "I understand that requesting an invitation does not guarantee selection.",
  "If invited, I will participate with curiosity, respect, and consistency.",
  "I will provide thoughtful feedback that helps strengthen the experience for future members.",
  "I understand that the experience will continue to evolve, and I am ready to be part of that journey.",
];

const states = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"],
  ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"],
  ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"],
  ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"],
  ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"],
  ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"],
  ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
  ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
  ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"],
  ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"],
  ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"],
  ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"],
  ["WI", "Wisconsin"], ["WY", "Wyoming"], ["DC", "District of Columbia"],
] as const;

const initialForm: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  city: "",
  state: "",
  socials: "",
  fit: "",
  photoCaption: "",
  marketingOptIn: false,
  acknowledgements: [false, false, false, false],
};

const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

function phoneDigits(value: string) {
  const hasDisplayedCountryCode = value.trim().startsWith("+1");
  let digits = value.replace(/\D/g, "");
  if (hasDisplayedCountryCode && digits.startsWith("1")) digits = digits.slice(1);
  else if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return digits.slice(0, 10);
}

function formatUsPhone(value: string) {
  const digits = phoneDigits(value);
  if (!digits) return "";
  if (digits.length <= 3) return `+1 (${digits}`;
  if (digits.length <= 6) return `+1 (${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(new Error("The selected photo could not be read."));
    reader.readAsDataURL(file);
  });
}

const emailValid = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const textComplete = (value: string) => value.trim().length > 0;
const stateValid = (value: string) => states.some(([code]) => code === value);
const validationClass = (valid: boolean) => valid ? "fieldComplete" : "fieldInvalid";

export default function EarlyAccessForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);
  const [form, setForm] = useState<FormState>(initialForm);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoError, setPhotoError] = useState("");
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
      city: String(values.get("city") || ""),
      state: String(values.get("state") || "").toUpperCase(),
      socials: String(values.get("socials") || ""),
      fit: String(values.get("fit") || ""),
      photoCaption: String(values.get("photoCaption") || ""),
    }));
  }

  useEffect(() => {
    const timers = [100, 400, 900, 1600].map((delay) => window.setTimeout(syncAutofilledFields, delay));
    return () => timers.forEach(window.clearTimeout);
  }, []);

  useEffect(() => {
    if (!photo) {
      setPhotoPreview("");
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const phoneComplete = phoneDigits(form.phone).length === 10;
  const fitComplete = form.fit.trim().length >= 50;
  const formComplete = useMemo(() => {
    const fieldsComplete =
      textComplete(form.firstName) && textComplete(form.lastName) && emailValid(form.email) &&
      phoneDigits(form.phone).length === 10 && textComplete(form.city) && stateValid(form.state) &&
      form.fit.trim().length >= 50;
    return fieldsComplete && form.acknowledgements.every(Boolean);
  }, [form]);

  function toggleAcknowledgement(index: number) {
    setForm((current) => ({
      ...current,
      acknowledgements: current.acknowledgements.map((value, itemIndex) => itemIndex === index ? !value : value),
    }));
  }

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] || null;
    setPhotoError("");
    if (!selected) {
      setPhoto(null);
      return;
    }
    if (!ALLOWED_PHOTO_TYPES.includes(selected.type)) {
      setPhotoError("Choose a JPG, PNG, or WebP image.");
      event.target.value = "";
      setPhoto(null);
      return;
    }
    if (selected.size > MAX_PHOTO_BYTES) {
      setPhotoError("Photo must be 4 MB or smaller.");
      event.target.value = "";
      setPhoto(null);
      return;
    }
    setPhoto(selected);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    const submitted = new FormData(event.currentTarget);
    const payload = {
      ...form,
      firstName: String(submitted.get("firstName") || form.firstName).trim(),
      lastName: String(submitted.get("lastName") || form.lastName).trim(),
      email: String(submitted.get("email") || form.email).trim(),
      phone: `+1${phoneDigits(String(submitted.get("phone") || form.phone))}`,
      city: String(submitted.get("city") || form.city).trim(),
      state: String(submitted.get("state") || form.state).toUpperCase(),
      socials: String(submitted.get("socials") || form.socials).trim(),
      fit: String(submitted.get("fit") || form.fit).trim(),
      photoCaption: String(submitted.get("photoCaption") || form.photoCaption).trim(),
    };

    const payloadComplete =
      payload.firstName && payload.lastName && emailValid(payload.email) &&
      /^\+1\d{10}$/.test(payload.phone) && payload.city && stateValid(payload.state) &&
      payload.fit.length >= 50 && payload.acknowledgements.every(Boolean);
    if (!payloadComplete || photoError) return;

    submittingRef.current = true;
    setStatus("loading");
    setMessage("");
    try {
      const photoPayload = photo ? {
        name: photo.name,
        type: photo.type,
        size: photo.size,
        data: await fileToBase64(photo),
      } : null;

      const response = await fetch("/api/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, photo: photoPayload }),
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
      setPhoto(null);
      formRef.current?.reset();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Please try again.");
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <>
      <form ref={formRef} className={`applicationCard${formComplete ? " formComplete" : ""}`} onSubmit={handleSubmit} onInput={syncAutofilledFields} onChange={syncAutofilledFields}>
        <div className="formColumn">
          <div className="nameGrid">
            <label><span>First name</span><input className={validationClass(textComplete(form.firstName))} required name="firstName" type="text" autoComplete="given-name" placeholder="First name" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} /></label>
            <label><span>Last name</span><input className={validationClass(textComplete(form.lastName))} required name="lastName" type="text" autoComplete="family-name" placeholder="Last name" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></label>
          </div>
          <label><span>Email address</span><input className={validationClass(emailValid(form.email))} required name="email" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label><span>Phone number</span><input className={validationClass(phoneComplete)} required name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={17} placeholder="+1 (555) 555-5555" value={form.phone} onChange={(event) => setForm({ ...form, phone: formatUsPhone(event.target.value) })} /><small>US numbers only. Country code +1 is added automatically.</small></label>
          <div className="nameGrid">
            <label><span>City</span><input className={validationClass(textComplete(form.city))} required name="city" type="text" autoComplete="address-level2" placeholder="City" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></label>
            <label><span>State</span><select className={validationClass(stateValid(form.state))} required name="state" autoComplete="address-level1" value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })}><option value="">Select state</option>{states.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
          </div>

          <label className="pathfinderResponseField"><span>Why would you make a strong Pathfinder for Melanated Adventurers?</span><textarea required name="fit" minLength={50} rows={7} className={validationClass(fitComplete)} placeholder="Tell us how you connect with the mission, how you show up in community, and what you would bring to the journey." value={form.fit} onChange={(event) => setForm({ ...form, fit: event.target.value })} /><small className={!fitComplete ? "characterCount warning" : "characterCount complete"}>{fitComplete ? `${form.fit.trim().length} characters · Ready` : `${form.fit.trim().length}/50 characters minimum`}</small></label>

          <label><span>Social profiles <em>Optional</em></span><input name="socials" type="text" autoComplete="off" placeholder="Instagram, Facebook, TikTok, LinkedIn, or another profile" value={form.socials} onChange={(event) => setForm({ ...form, socials: event.target.value })} /><small>Share any handles or profile links you would like us to know about.</small></label>

          <div className="photoField">
            <div className="photoFieldHeading"><span>Share a photo <em>Optional</em></span><small>JPG, PNG, or WebP · 4 MB maximum</small></div>
            <label className={`photoPicker${photoPreview ? " hasPhoto" : ""}`}>
              <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} />
              {photoPreview ? <img src={photoPreview} alt="Selected applicant preview" /> : <span><strong>Choose a photo</strong><small>A moment, place, or adventure that says something about you.</small></span>}
            </label>
            {photo && <button className="removePhotoButton" type="button" onClick={() => { setPhoto(null); setForm({ ...form, photoCaption: "" }); }}>Remove photo</button>}
            {photoError && <small className="photoError">{photoError}</small>}
            {photo && <label><span>Photo caption <em>Optional</em></span><textarea name="photoCaption" rows={3} maxLength={300} placeholder="Tell us what this photo means to you." value={form.photoCaption} onChange={(event) => setForm({ ...form, photoCaption: event.target.value })} /><small className="characterCount">{form.photoCaption.length}/300</small></label>}
          </div>
        </div>

        <div className="acknowledgementPanel">
          <p className="panelEyebrow">The Pathfinder Commitment</p><p>All acknowledgements are required before your request can be submitted.</p>
          <div className="acknowledgementList">{acknowledgementText.map((text, index) => <label className="acknowledgement" key={text}><input className={form.acknowledgements[index] ? "ackComplete" : "ackInvalid"} required type="checkbox" checked={form.acknowledgements[index]} onChange={() => toggleAcknowledgement(index)} /><span>{text}</span></label>)}</div>
          <div className="marketingConsent"><p className="panelEyebrow">Keep Me Connected</p><label className="acknowledgement optionalConsent"><input type="checkbox" checked={form.marketingOptIn} onChange={(event) => setForm({ ...form, marketingOptIn: event.target.checked })} /><span>I’d like to receive occasional emails about Melanated Adventurers experiences, news, and community updates. I can unsubscribe at any time.</span></label></div>
        </div>

        <button className="primaryButton submitButton" type="submit" disabled={status === "loading" || !formComplete}>{status === "loading" ? "Sending Request..." : "Request a Pathfinder Invitation"}</button>
        <p className="selectionNote">Selected individuals will receive a private invitation with expectations and next steps.</p>
        {message && !showDuplicateModal && <p className="formMessage errorText">{message}</p>}
      </form>

      {showConfirmation && <div className="modalBackdrop" role="presentation" onClick={() => setShowConfirmation(false)}><div className="confirmationModal compactModal" role="dialog" aria-modal="true" aria-labelledby="confirmation-title" onClick={(event) => event.stopPropagation()}><p className="panelEyebrow">Request Received</p><h2 id="confirmation-title">Application submitted.</h2><p>We’ll review your Pathfinder application and contact selected individuals with next steps.</p>{wasSubscribed && <p className="subscriptionConfirmation">You’re also subscribed to Melanated Adventurers email updates.</p>}<button className="primaryButton" type="button" onClick={() => setShowConfirmation(false)}>Close</button></div></div>}
      {showDuplicateModal && <div className="modalBackdrop" role="presentation" onClick={() => setShowDuplicateModal(false)}><div className="confirmationModal compactModal duplicateModal" role="dialog" aria-modal="true" aria-labelledby="duplicate-title" onClick={(event) => event.stopPropagation()}><p className="panelEyebrow">Application Already Received</p><h2 id="duplicate-title">You’re already on the list.</h2><p>{message}</p><button className="primaryButton" type="button" onClick={() => setShowDuplicateModal(false)}>Close</button></div></div>}
    </>
  );
}
