import EarlyAccessForm from "@/components/EarlyAccessForm";

const commitments = ["Participate", "Explore", "Respond", "Contribute"];

export default function Home() {
  return (
    <main className="page" id="top">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Melanated Adventurers home">
          <img src="/ma-mark.svg" alt="Melanated Adventurers" />
        </a>
        <span>Private Early Access</span>
      </header>

      <section className="hero">
        <div className="contours contoursLeft" aria-hidden="true" />
        <div className="contours contoursRight" aria-hidden="true" />
        <div className="heroInner">
          <h1>Something new is coming.</h1>
          <p className="heroText">
            Melanated Adventurers is selecting a limited number of committed individuals to help shape what comes next.
          </p>
          <p className="limited">Limited entry. Invitation only.</p>
          <a className="primaryButton" href="#apply">Request Consideration</a>
          <span className="downArrow" aria-hidden="true">↓</span>
        </div>
      </section>

      <section className="commitmentSection">
        <div className="sectionInner">
          <p className="eyebrow">This is not passive early access.</p>
          <h2>Selected individuals are expected to show up.</h2>
          <p>
            Those selected will participate, complete requested activities, and provide honest feedback during testing.
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
          <p className="eyebrow">Private Selection</p>
          <h2>Request consideration.</h2>
          <p>
            Tell us why you are a strong fit to help test what comes next.
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
