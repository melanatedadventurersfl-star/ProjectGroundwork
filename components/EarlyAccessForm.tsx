"use client";

import { useState } from "react";

const interests = [
  "Camping",
  "Hiking",
  "Water activities",
  "Road trips",
  "Social outings",
  "Outdoor learning",
  "Wellness",
  "Volunteer opportunities",
];

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  experienceLevel: string;
  attendsAlone: string;
  heardAboutUs: string;
  supportNeeds: string;
  interests: string[];
  consent: boolean;
};

const initialForm: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  experienceLevel: "",
  attendsAlone: "",
  heardAboutUs: "",
  supportNeeds: "",
  interests: [],
  consent: false,
};

export default function EarlyAccessForm() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  function toggleInterest(interest: string) {
    setForm((current) => ({
      ...current,
      interests: current.interests.includes(interest)
        ? current.interests.filter((item) => item !== interest)
        : [...current.interests, interest],
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
      setMessage("You’re on the list. We’ll contact you when an early-access cohort becomes available.");
      setForm(initialForm);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Please try again.");
    }
  }

  return (
    <form className="interestForm" onSubmit={handleSubmit}>
      <div className="formIntro">
        <span>Prospective-member interest form</span>
        <h3>Tell us what would help you step outside with confidence.</h3>
      </div>

      <div className="fieldGrid twoColumns">
        <label>
          <span>First name</span>
          <input
            required
            type="text"
            autoComplete="given-name"
            value={form.firstName}
            onChange={(event) => setForm({ ...form, firstName: event.target.value })}
          />
        </label>
        <label>
          <span>Last name</span>
          <input
            required
            type="text"
            autoComplete="family-name"
            value={form.lastName}
            onChange={(event) => setForm({ ...form, lastName: event.target.value })}
          />
        </label>
      </div>

      <div className="fieldGrid twoColumns">
        <label>
          <span>Email</span>
          <input
            required
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
        </label>
        <label>
          <span>Phone <small>optional</small></span>
          <input
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
        </label>
      </div>

      <div className="fieldGrid twoColumns">
        <label>
          <span>Outdoor experience level</span>
          <select
            required
            value={form.experienceLevel}
            onChange={(event) => setForm({ ...form, experienceLevel: event.target.value })}
          >
            <option value="">Select one</option>
            <option value="new">Completely new</option>
            <option value="beginner">Beginner</option>
            <option value="comfortable">Comfortable, but still learning</option>
            <option value="experienced">Experienced</option>
          </select>
        </label>
        <label>
          <span>Do you usually attend alone?</span>
          <select
            required
            value={form.attendsAlone}
            onChange={(event) => setForm({ ...form, attendsAlone: event.target.value })}
          >
            <option value="">Select one</option>
            <option value="yes">Yes</option>
            <option value="sometimes">Sometimes</option>
            <option value="no">No</option>
          </select>
        </label>
      </div>

      <fieldset>
        <legend>What kinds of experiences interest you?</legend>
        <div className="interestGrid">
          {interests.map((interest) => (
            <label className="checkOption" key={interest}>
              <input
                type="checkbox"
                checked={form.interests.includes(interest)}
                onChange={() => toggleInterest(interest)}
              />
              <span>{interest}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label>
        <span>How did you hear about Melanated Adventurers?</span>
        <select
          required
          value={form.heardAboutUs}
          onChange={(event) => setForm({ ...form, heardAboutUs: event.target.value })}
        >
          <option value="">Select one</option>
          <option value="facebook">Facebook</option>
          <option value="instagram">Instagram</option>
          <option value="meetup">Meetup</option>
          <option value="friend">Friend or family member</option>
          <option value="event">An MA experience or event</option>
          <option value="other">Other</option>
        </select>
      </label>

      <label>
        <span>Anything that would make joining easier?</span>
        <textarea
          rows={4}
          placeholder="Transportation, equipment, meeting new people, accessibility, knowing what to expect..."
          value={form.supportNeeds}
          onChange={(event) => setForm({ ...form, supportNeeds: event.target.value })}
        />
      </label>

      <label className="consentRow">
        <input
          required
          type="checkbox"
          checked={form.consent}
          onChange={(event) => setForm({ ...form, consent: event.target.checked })}
        />
        <span>I agree to receive early-access and rollout updates from Melanated Adventurers.</span>
      </label>

      <button className="button buttonPrimary submitButton" type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Joining the list..." : "Join the Early-Access List"}
      </button>

      {message && (
        <p className={status === "success" ? "formMessage success" : "formMessage errorText"}>
          {message}
        </p>
      )}
    </form>
  );
}
