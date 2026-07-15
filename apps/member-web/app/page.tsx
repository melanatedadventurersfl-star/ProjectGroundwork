"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { addRegistrant } from "@/lib/waitlist";

const interests = ["Camping", "Hiking", "Water activities", "Road trips", "Social outings", "Learning outdoors"];

export default function HomePage() {
  const [submitted, setSubmitted] = useState<"new" | "duplicate" | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  function toggleInterest(value: string) {
    setSelected((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = addRegistrant({
      firstName: String(form.get("firstName") ?? ""),
      lastName: String(form.get("lastName") ?? ""),
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? ""),
      experienceLevel: String(form.get("experienceLevel") ?? "new") as "new" | "beginner" | "comfortable" | "experienced",
      interests: selected,
      attendingSolo: form.get("attendingSolo") === "on",
      referralSource: String(form.get("referralSource") ?? ""),
      notes: String(form.get("notes") ?? ""),
      communicationConsent: form.get("communicationConsent") === "on",
    });
    setSubmitted(result.duplicate ? "duplicate" : "new");
    if (!result.duplicate) event.currentTarget.reset();
  }

  return (
    <main>
      <section className="hero">
        <div>
          <p className="eyebrow">Melanated Adventurers app · early access</p>
          <h1>Your next adventure should feel possible.</h1>
          <p className="lede">Join the early-access list for a calmer, clearer way to discover MA experiences, know what to expect, and arrive already connected.</p>
          <div className="actions">
            <a className="button" href="#waitlist">Join the early-access list</a>
            <Link className="button ghost" href="/castaway">Preview the Castaway pilot</Link>
          </div>
        </div>
        <aside className="heroCard" aria-label="How early access works">
          <p className="eyebrow">Measured rollout</p>
          <h2>Sign up now. Enter in cohorts.</h2>
          <p>Prospective members join the waitlist first. MA approves small cohorts, sends invitations, learns from each group, and expands access without opening the floodgates all at once.</p>
        </aside>
      </section>

      <section className="section">
        <div className="grid">
          <article className="card"><h3>Know the fit</h3><p>See pace, cost, gear, accessibility, arrival details, and what is included before registering.</p></article>
          <article className="card"><h3>Arrive connected</h3><p>Newcomers can choose a welcome contact and receive support without being forced into direct introductions.</p></article>
          <article className="card"><h3>Grow with MA</h3><p>Discover the next experience, learning path, or optional way to help after each adventure.</p></article>
        </div>
      </section>

      <section className="section" id="waitlist">
        <div className="panel">
          <p className="eyebrow">Early-access waitlist</p>
          <h2>Become a prospective member</h2>
          <p className="muted">Joining the waitlist does not create an active member account yet. Invitations will be released in small cohorts.</p>
          {submitted === "new" && <p className="notice" role="status">You are on the list. We will contact you when an early-access cohort is available.</p>}
          {submitted === "duplicate" && <p className="notice" role="status">This email is already on the early-access list.</p>}
          <form onSubmit={submit}>
            <div className="detailGrid">
              <label>First name<input name="firstName" autoComplete="given-name" required /></label>
              <label>Last name<input name="lastName" autoComplete="family-name" required /></label>
              <label>Email<input name="email" type="email" autoComplete="email" required /></label>
              <label>Phone, optional<input name="phone" type="tel" autoComplete="tel" /></label>
              <label>Outdoor experience
                <select name="experienceLevel" defaultValue="new">
                  <option value="new">Completely new</option>
                  <option value="beginner">Beginner</option>
                  <option value="comfortable">Comfortable with some activities</option>
                  <option value="experienced">Experienced</option>
                </select>
              </label>
              <label>How did you hear about MA?<input name="referralSource" /></label>
            </div>
            <fieldset>
              <legend><strong>What interests you?</strong></legend>
              <div className="grid">
                {interests.map((interest) => (
                  <label className="check" key={interest}>
                    <input type="checkbox" checked={selected.includes(interest)} onChange={() => toggleInterest(interest)} />
                    {interest}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="check"><input name="attendingSolo" type="checkbox" />I often attend events by myself.</label>
            <label>Anything that would make joining an MA experience easier?<textarea name="notes" /></label>
            <label className="check"><input name="communicationConsent" type="checkbox" required />I agree to receive MA early-access and experience updates. I can unsubscribe later.</label>
            <button type="submit">Join the early-access list</button>
          </form>
        </div>
      </section>
    </main>
  );
}
