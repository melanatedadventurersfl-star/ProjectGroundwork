import EarlyAccessForm from "@/components/EarlyAccessForm";

const commitments = ["Participate", "Explore", "Respond", "Contribute"];

export default function Home() {
  return (
    <main className="page" id="top">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Melanated Adventurers home">MA</a>
        <span>Private Early Access</span>
      </header>

      <section className="hero">
        <div className="contours contoursLeft" aria-hidden="true" />
        <div className="contours contoursRight" aria-hidden="true" />
        <div className="heroInner">
          <p className="eyebrow">Private Early Access</p>
          <h1>Something new is coming.</h1>
          <p className="heroText">
            Melanated Adventurers is selecting a small group of committed people to help shape what comes next.
          </p>
          <p className="limited">Limited entry. Invitation only.</p>
          <a className="primaryButton" href="#apply">Request Consideration</a>
          <span className="downArrow" aria-hidden="true">↓</span>
        </div>
      </section>

      <section className="commitmentSection">
        <div className="sectionInner">
          <p className="eyebrow">This is not passive early access.</p>
          <h2>Selected testers are expected to show up.</h2>
          <p>
            The first cohort will participate, explore the experience, complete requested activities,
            and provide honest feedback throughout the testing period.
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

      <section className="applicationSection" id="apply">
        <div className="applicationIntro">
          <p className="eyebrow">First testing cohort</p>
          <h2>Request consideration.</h2>
          <p>
            Initial selections will focus on Jacksonville and surrounding areas. People outside the area may still apply for future testing opportunities.
          </p>
        </div>
        <EarlyAccessForm />
      </section>

      <footer className="footer">
        <span>Melanated Adventurers</span>
        <span>Jacksonville, Florida</span>
      </footer>
    </main>
  );
}
