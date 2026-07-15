import EarlyAccessForm from "@/components/EarlyAccessForm";

const benefits = [
  {
    title: "Know Before You Go",
    text: "See the cost, difficulty, equipment, accessibility, schedule, location, and what is included before deciding to attend.",
  },
  {
    title: "Arrive Connected",
    text: "Newcomers can request a welcome contact, get arrival guidance, and feel less like they are walking into a room full of strangers.",
  },
  {
    title: "Find Your Next Adventure",
    text: "Discover experiences based on your interests, comfort level, location, and previous participation.",
  },
];

const steps = [
  {
    number: "01",
    title: "Join the prospective-member list",
    text: "Tell us a little about yourself and the experiences that interest you.",
  },
  {
    number: "02",
    title: "Receive an invitation",
    text: "Access will open in small cohorts so we can test, learn, and improve the experience.",
  },
  {
    number: "03",
    title: "Explore and participate",
    text: "Invited members can view experiences, register, receive updates, and manage their participation.",
  },
];

export default function Home() {
  return (
    <main>
      <header className="siteHeader">
        <a className="brand" href="#top" aria-label="Melanated Adventurers home">
          <span className="brandMark">MA</span>
          <span className="brandName">Melanated Adventurers</span>
        </a>
        <nav className="navLinks" aria-label="Main navigation">
          <a href="#about">About the App</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#join">Join Early Access</a>
          <a href="#signin">Member Sign-In</a>
        </nav>
      </header>

      <section className="hero sectionShell" id="top">
        <div className="heroCopy">
          <p className="eyebrow">Melanated Adventurers App · Early Access</p>
          <h1>Your next adventure should feel possible.</h1>
          <p className="heroText">
            A clearer, more connected way to discover Melanated Adventurers experiences,
            understand what to expect, and feel welcome before you arrive.
          </p>
          <div className="ctaRow">
            <a className="button buttonPrimary" href="#join">Join Early Access</a>
            <a className="button buttonSecondary" href="#how-it-works">See How It Works</a>
          </div>
        </div>

        <aside className="heroCard" aria-label="Early access overview">
          <p className="heroCardKicker">Built for the moment before you say yes</p>
          <h2>Less guessing. More belonging.</h2>
          <p>
            The app is being designed to help people move from curious to confident before
            their first experience ever begins.
          </p>
          <div className="heroStatGrid">
            <div><strong>Clear</strong><span>experience details</span></div>
            <div><strong>Warm</strong><span>newcomer support</span></div>
            <div><strong>Intentional</strong><span>cohort rollout</span></div>
          </div>
        </aside>
      </section>

      <section className="sectionShell" id="about">
        <div className="sectionHeading">
          <p className="eyebrow">Why the app exists</p>
          <h2>Adventure is easier when the unknowns are smaller.</h2>
          <p>
            We are building one place where prospective members can understand an experience,
            prepare for it, and feel connected before showing up.
          </p>
        </div>
        <div className="benefitGrid">
          {benefits.map((benefit, index) => (
            <article className="benefitCard" key={benefit.title}>
              <span className="cardNumber">0{index + 1}</span>
              <h3>{benefit.title}</h3>
              <p>{benefit.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="processSection" id="how-it-works">
        <div className="sectionShell">
          <div className="sectionHeading lightHeading">
            <p className="eyebrow">How early access works</p>
            <h2>We are opening the trail in small groups.</h2>
            <p>
              Completing the form adds you to the prospective-member list. It does not create
              an active member account immediately.
            </p>
          </div>
          <div className="stepsGrid">
            {steps.map((step) => (
              <article className="stepCard" key={step.number}>
                <span>{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="joinSection sectionShell" id="join">
        <div className="joinCopy">
          <p className="eyebrow">Join early access</p>
          <h2>Help us build the member base before launch.</h2>
          <p>
            Share what you are interested in and what would make joining easier. We will use
            that information to shape the rollout and invite prospective members in cohorts.
          </p>
          <div className="trustNote">
            <strong>No payment required.</strong>
            <span>
              Joining early access does not guarantee immediate app access. We are opening the
              experience gradually so we can build something useful, welcoming, and reliable.
            </span>
          </div>
        </div>
        <EarlyAccessForm />
      </section>

      <section className="signinSection sectionShell" id="signin">
        <div>
          <p className="eyebrow">Already invited?</p>
          <h2>Member sign-in is coming with the pilot.</h2>
          <p>
            During early access, sign-in will be invitation-only. Prospective members should
            join the list above for rollout updates.
          </p>
        </div>
        <span className="statusPill">Pilot access only</span>
      </section>

      <footer className="footer">
        <div className="footerInner">
          <div>
            <strong>Melanated Adventurers</strong>
            <p>Jacksonville, Florida</p>
          </div>
          <div className="footerLinks">
            <a href="#join">Early Access</a>
            <a href="#about">About</a>
            <a href="mailto:buildacampusa@gmail.com">Contact</a>
          </div>
          <p>© {new Date().getFullYear()} Melanated Adventurers</p>
        </div>
      </footer>
    </main>
  );
}
