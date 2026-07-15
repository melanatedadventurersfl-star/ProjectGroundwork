import Link from "next/link";
import { CastawayRegistration } from "@/components/castaway-registration";

export default function CastawayPage() {
  return (
    <main>
      <section className="hero">
        <div>
          <p className="eyebrow">Release 0.1 pilot · hypothetical experience</p>
          <h1>First Steps with MA</h1>
          <p className="lede">A beginner-friendly marsh walk and picnic at Castaway Island Preserve, built to help newcomers know what to expect and arrive with a human connection.</p>
          <div className="actions"><a className="button" href="#register">Register for free</a><Link className="button ghost" href="/">Join early access</Link></div>
        </div>
        <aside className="heroCard"><p className="eyebrow">At a glance</p><h2>Easy pace. Real welcome.</h2><p>One-mile paved walk, picnic gathering, optional paid lunch, optional support contribution, and no outdoor experience required.</p></aside>
      </section>

      <section className="section detailGrid">
        <article className="card"><h3>When</h3><p>Saturday · 9:00 AM to 12:00 PM</p><p className="muted">Staff setup begins at 8:15 AM. Check-in opens at 8:45 AM.</p></article>
        <article className="card"><h3>Where</h3><p>Castaway Island Preserve<br />2921 San Pablo Road South<br />Jacksonville, FL 32224</p></article>
        <article className="card"><h3>Cost</h3><p><strong>Admission: Free</strong></p><p>Optional lunch add-on and optional donation to support MA. Donating does not change access or treatment.</p></article>
        <article className="card"><h3>Suitability</h3><p>Beginner-friendly · solo-friendly · approximately one paved mile · restrooms available.</p></article>
      </section>

      <section className="section"><div className="panel"><p className="eyebrow">What happens</p><h2>A simple three-part experience</h2><div className="grid">
        <article><span className="badge">1</span><h3>Personal arrival</h3><p>Check in, meet your welcome contact if selected, and receive a two-minute orientation.</p></article>
        <article><span className="badge">2</span><h3>Guided marsh walk</h3><p>Walk in small groups with easy conversation prompts and a halfway group rotation.</p></article>
        <article><span className="badge">3</span><h3>Picnic and next steps</h3><p>Eat, connect, reflect, and discover one or two experiences that may fit you next.</p></article>
      </div></div></section>

      <section className="section detailGrid">
        <article className="card"><h3>Bring</h3><ul><li>Comfortable walking shoes</li><li>Water bottle</li><li>Sun and insect protection</li><li>Your own lunch unless purchasing the add-on</li></ul></article>
        <article className="card"><h3>Access and support</h3><p>The pilot brief labels the route as paved and wheelchair accessible. Participants can request arrival or communication support without sharing unnecessary medical detail.</p></article>
        <article className="card"><h3>No-show learning</h3><p>Free registration lets MA compare registration, confirmation, lunch purchase, cancellation, check-in, late arrival, and no-show behavior.</p></article>
        <article className="card"><h3>Weather</h3><p>The first pilot uses a simple reschedule plan rather than adding a complicated indoor relocation workflow.</p></article>
      </section>

      <section className="section" id="register"><CastawayRegistration /></section>
    </main>
  );
}
