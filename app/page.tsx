import EarlyAccessForm from "@/components/EarlyAccessForm";

const commitments = ["Participate", "Explore", "Respond", "Contribute"];

export default function Home() {
  return (
    <main className="page" id="top">
      <header className="topbar">
        <a className="brandWordmark" href="#top" aria-label="Melanated Adventurers home">
          <span className="brandMark" aria-hidden="true">MA</span>
          <span className="brandName">Melanated Adventurers</span>
        </a>
        <span>Pathfinder Invitation</span>
      </header>

      <section className="hero">
        <div className="ambientGlow" aria-hidden="true" />
        <div className="contours contoursLeft" aria-hidden="true" />
        <div className="contours contoursRight" aria-hidden="true" />
        <div className="compassGhost" aria-hidden="true">✦</div>
        <div className="heroInner">
          <h1>The next chapter begins soon.</h1>
          <p className="heroText">
            Melanated Adventurers is inviting a small number of committed individuals to become our first Pathfinders and help shape what comes next.
          </p>
          <p className="limited">Limited entry. Invitation only.</p>
          <a className="primaryButton invitationButton" href="#apply">Request a Pathfinder Invitation</a>
          <span className="downArrow" aria-hidden="true">↓</span>
        </div>
      </section>

      <section className="commitmentSection revealSection">
        <div className="sectionInner">
          <p className="eyebrow">The Pathfinder Commitment</p>
          <h2>This is not passive access.</h2>
          <p>
            Pathfinders are expected to show up with curiosity, consistency, and thoughtful feedback as the experience evolves.
          </p>
          <div className="commitmentGrid">
            {commitments.map((item, index) => (
              <div key={item}>
                <span>0{index + 1}</span>
                <strong>{item}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="applicationSection revealSection" id="apply">
        <div className="applicationIntro">
          <p className="eyebrow">Tell Us About Yourself</p>
          <h2>Request your invitation.</h2>
          <p>Every great journey begins with someone willing to take the first step.</p>
        </div>
        <EarlyAccessForm />
      </section>

      <footer className="footer">
        <span>Melanated Adventurers</span>
        <span>Every trail begins somewhere.</span>
      </footer>
    </main>
  );
}
