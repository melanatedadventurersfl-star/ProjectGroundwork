import EarlyAccessForm from "@/components/EarlyAccessForm";

export default function Home() {
  return (
    <main className="page">
      <header className="nav">
        <div className="logo">MA</div>
        <nav>
          <a href="#about">About the App</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#join">Join Early Access</a>
          <a href="#signin">Member Sign-In</a>
        </nav>
      </header>

      <section className="hero">
        <div className="heroCopy">
          <p className="eyebrow">Melanated Adventurers App · Early Access</p>
          <h1>Your next adventure should feel possible.</h1>
          <p className="subhead">A clearer, more connected way to discover Melanated Adventurers experiences, understand what to expect, and feel welcome before you arrive.</p>
          <div className="ctaRow">
            <a className="btn primary" href="#join">Join Early Access</a>
            <a className="btn secondary" href="#how-it-works">See How It Works</a>
          </div>
        </div>
        <div className="heroPanel">
          <p className="panelLabel">What early access gives you</p>
          <ul>
            <li>First updates on the rollout</li>
            <li>Clear expectations before launch</li>
            <li>Priority invitation when the pilot opens</li>
          </ul>
        </div>
      </section>

      <section id="about" className="card">
        <h2>About the App</h2>
        <p>This pre-launch page introduces the app, builds interest, and helps future members stay connected while the full experience is being prepared.</p>
      </section>

      <section id="how-it-works" className="card">
        <h2>How It Works</h2>
        <div className="steps">
          <div><h3>1. Explore</h3><p>Learn what the app will help you discover and plan.</p></div>
          <div><h3>2. Join Early Access</h3><p>Share your information so we can keep you updated.</p></div>
          <div><h3>3. Get Invited</h3><p>Early members are first in line when the pilot opens.</p></div>
        </div>
      </section>

      <section id="join" className="card">
        <h2>Join Early Access</h2>
        <p>Be among the first to hear when the app opens for the pilot.</p>
        <EarlyAccessForm />
      </section>

      <section id="signin" className="card signin">
        <h2>Member Sign-In</h2>
        <p>Invitation-only during the pilot. Please join early access for updates.</p>
      </section>

      <footer className="footer"><p>© {new Date().getFullYear()} Melanated Adventurers</p></footer>
    </main>
  );
}
