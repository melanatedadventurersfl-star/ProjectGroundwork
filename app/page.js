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

export default function HomePage() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(true);
    event.currentTarget.reset();
  }

  return (
    <>
      <header className="siteHeader">
        <a className="brand" href="#top" aria-label="Melanated Adventurers home">MA</a>
        <nav aria-label="Primary navigation">
          <a href="#about">About the App</a>
          <a href="#how">How It Works</a>
          <a className="navButton" href="#interest">Join Early Access</a>
        </nav>
      </header>

      <main id="top">
        <section className="hero shell">
          <div className="heroCopy">
            <p className="eyebrow">Melanated Adventurers App · Early Access</p>
            <h1>Your next adventure should feel possible.</h1>
            <p className="lede">A clearer, more connected way to discover Melanated Adventurers experiences, understand what to expect, and feel welcome before you arrive.</p>
            <div className="actions">
              <a className="button primary" href="#interest">Join Early Access</a>
              <a className="button secondary" href="#how">See How It Works</a>
            </div>
          </div>
          <aside className="heroCard">
            <span className="heroNumber">01</span>
            <p className="eyebrow light">Built for the first step</p>
            <h2>Less uncertainty. More adventure.</h2>
            <p>Know the pace, cost, gear, accessibility, arrival details, and what is included before you decide to go.</p>
          </aside>
        </section>

        <section className="section shell" id="about">
          <div className="sectionHeading">
            <p className="eyebrow">Why we are building it</p>
            <h2>Adventure should not begin with guesswork.</h2>
          </div>
          <div className="cardGrid">
            <article className="featureCard"><span>01</span><h3>Know Before You Go</h3><p>See the cost, difficulty, equipment, accessibility, schedule, location, and what is included before deciding to attend.</p></article>
            <article className="featureCard"><span>02</span><h3>Arrive Connected</h3><p>Newcomers can request a welcome contact, get arrival guidance, and feel less like they are walking into a room full of strangers.</p></article>
            <article className="featureCard"><span>03</span><h3>Find Your Next Adventure</h3><p>Discover experiences based on your interests, comfort level, location, and previous participation.</p></article>
          </div>
        </section>

        <section className="section stepsSection" id="how">
          <div className="shell">
            <div className="sectionHeading narrow">
              <p className="eyebrow light">How early access works</p>
              <h2>We are opening the trail in small groups.</h2>
              <p>Prospective members join first. Invitations are released in cohorts so we can learn, improve, and build something reliable.</p>
            </div>
            <div className="steps">
              <article><strong>1</strong><div><h3>Join the prospective-member list</h3><p>Tell us a little about yourself and the experiences that interest you.</p></div></article>
              <article><strong>2</strong><div><h3>Receive an invitation</h3><p>Access opens in small cohorts while MA tests and improves the experience.</p></div></article>
              <article><strong>3</strong><div><h3>Explore and participate</h3><p>Invited members can discover experiences, register, and manage participation.</p></div></article>
            </div>
          </div>
        </section>

        <section className="section shell" id="interest">
          <div className="formIntro">
            <div>
              <p className="eyebrow">Early-access interest</p>
              <h2>Help us build the member base.</h2>
              <p>Joining the list does not create an active account yet. It lets us know you are interested and helps shape the first cohorts.</p>
            </div>
            <div className="trustNote">No payment required. No immediate account access. Just a place at the front of the trail.</div>
          </div>

          {submitted ? (
            <div className="successCard" role="status">
              <span>✓</span>
              <div><h3>You are on the list.</h3><p>We will contact you when an early-access cohort becomes available.</p></div>
            </div>
          ) : (
            <form className="interestForm" onSubmit={handleSubmit}>
              <div className="twoCol">
                <label>First name<input name="firstName" required /></label>
                <label>Last name<input name="lastName" required /></label>
                <label>Email<input name="email" type="email" required /></label>
                <label>Phone, optional<input name="phone" type="tel" /></label>
                <label>Outdoor experience level<select name="experienceLevel" defaultValue="new"><option value="new">Completely new</option><option value="beginner">Beginner</option><option value="comfortable">Comfortable with some activities</option><option value="experienced">Experienced</option></select></label>
                <label>How did you hear about MA?<input name="referralSource" /></label>
              </div>

              <fieldset>
                <legend>What interests you?</legend>
                <div className="interestGrid">
                  {interests.map((interest) => <label className="check" key={interest}><input type="checkbox" name="interests" value={interest} />{interest}</label>)}
                </div>
              </fieldset>

              <label className="check"><input type="checkbox" name="attendingSolo" />I often attend events by myself.</label>
              <label>Anything that would make joining an MA experience easier?<textarea name="notes" rows="4" /></label>
              <label className="check consent"><input type="checkbox" required />I agree to receive MA early-access and experience updates. I can unsubscribe later.</label>
              <button className="button primary submitButton" type="submit">Join the Early-Access List</button>
            </form>
          )}
        </section>
      </main>

      <footer><div className="shell footerInner"><div><strong>Melanated Adventurers</strong><p>Jacksonville, Florida</p></div><p>Reconnect. Explore. Belong.</p></div></footer>
    </>
  );
}
