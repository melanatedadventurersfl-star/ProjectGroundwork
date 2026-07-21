const app = document.querySelector('#app');
const title = document.querySelector('#screen-title');
const navItems = [...document.querySelectorAll('.nav-item')];
const campfireButton = document.querySelector('#campfire-button');

const state = {
  joined: false,
  checkedIn: false,
  completed: false,
};

const adventure = {
  title: 'The Great Melanated Little Camp of Horrors',
  date: 'October 30 – November 1, 2026',
  place: 'Florida Sand Music Ranch, Brooksville',
  price: '$189',
  image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80'
};

function setActive(route) {
  navItems.forEach(item => item.classList.toggle('active', item.dataset.route === route));
}

function render(route) {
  const routes = {
    trailhead: renderTrailhead,
    explore: renderExplore,
    adventure: renderAdventure,
    registration: renderRegistration,
    confirmation: renderConfirmation,
    hub: renderHub,
    checkin: renderCheckin,
    passport: renderPassport,
    journey: renderJourney,
    community: renderCommunity,
    campfire: renderCampfire,
    more: renderMore
  };
  (routes[route] || routes.trailhead)();
  setActive(['trailhead','explore','community','passport','more'].includes(route) ? route : '');
  app.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function bindRoutes() {
  document.querySelectorAll('[data-route]').forEach(el => {
    if (!el.classList.contains('nav-item')) {
      el.addEventListener('click', () => render(el.dataset.route));
    }
  });
}

function renderTrailhead() {
  title.textContent = 'Trailhead';
  app.innerHTML = document.querySelector('#trailhead-template').innerHTML;
  bindRoutes();
}

function renderExplore() {
  title.textContent = 'Explore';
  app.innerHTML = `
    <section class="screen">
      <div class="section-heading"><div><h2>Find your next story</h2><p>Curated outdoor experiences for every comfort level.</p></div></div>
      <input class="search" aria-label="Search adventures" placeholder="Search camping, water, parks…" />
      <div class="chips" aria-label="Adventure categories">
        <button class="chip active">Featured</button><button class="chip">Camping</button><button class="chip">Water</button><button class="chip">Day Trips</button><button class="chip">Skills</button>
      </div>
      <div class="card-list">
        <article class="adventure-card" data-route="adventure" tabindex="0">
          <div class="card-image" style="background-image:url('${adventure.image}')"></div>
          <div class="card-body"><span class="tag">FEATURED CAMPING</span><h3>${adventure.title}</h3><p>Oct 30 • Brooksville • From ${adventure.price}</p></div>
        </article>
        <article class="adventure-card">
          <div class="card-image" style="background-image:url('https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=900&q=80')"></div>
          <div class="card-body"><span class="tag">WATER ADVENTURE</span><h3>Sunrise Paddle & Picnic</h3><p>Nov 14 • Jacksonville • Beginner friendly</p></div>
        </article>
        <article class="adventure-card">
          <div class="card-image" style="background-image:url('https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=900&q=80')"></div>
          <div class="card-body"><span class="tag">TRAIL DAY</span><h3>First Hike: Little Talbot</h3><p>Dec 5 • Jacksonville • Free</p></div>
        </article>
      </div>
    </section>`;
  bindRoutes();
}

function renderAdventure() {
  title.textContent = 'Adventure';
  app.innerHTML = `
    <section class="screen">
      <div class="hero" style="background-image:url('${adventure.image}')">
        <span class="tag">HALLOWEEN WEEKEND</span>
        <h2>${adventure.title}</h2>
        <p>${adventure.date}</p>
      </div>
      <div class="detail-grid">
        <div class="detail"><small>Location</small><strong>Brooksville, FL</strong></div>
        <div class="detail"><small>Experience</small><strong>3 days / 2 nights</strong></div>
        <div class="detail"><small>Comfort</small><strong>Beginner welcome</strong></div>
        <div class="detail"><small>Starting at</small><strong>${adventure.price}</strong></div>
      </div>
      <div class="panel"><h3>What awaits</h3><p>A Halloween village, campfire gatherings, performances, contests, shared meals and a full weekend of outdoor community.</p></div>
      <div class="panel"><h3>Your experience includes</h3><ul class="checklist"><li><span class="check">✓</span>Hosted activities and community spaces</li><li><span class="check">✓</span>Meals included with selected packages</li><li><span class="check">✓</span>Preparation guide and packing checklist</li></ul></div>
      <button class="primary" data-route="${state.joined ? 'hub' : 'registration'}">${state.joined ? 'Open Adventure Hub' : 'Choose Your Experience'}</button>
      <button class="secondary" data-route="explore">Back to Explore</button>
    </section>`;
  bindRoutes();
}

function renderRegistration() {
  title.textContent = 'Register';
  app.innerHTML = `
    <section class="screen">
      <div class="section-heading"><div><h2>Choose your experience</h2><p>Prototype checkout. No payment will be collected.</p></div></div>
      <div class="panel"><span class="tag">RECOMMENDED</span><h3>Weekend Experience</h3><p>Full event access, shared meals, activities and preparation support.</p><div class="section-heading"><strong>${adventure.price}</strong><span>per person</span></div></div>
      <div class="panel"><h3>Member details</h3><label>Full name<input class="search" value="Jonathan" /></label><label>Email<input class="search" value="jonathan@example.com" /></label></div>
      <div class="panel"><h3>Important note</h3><p>Your campground site or lodging selection may be managed separately depending on the package.</p></div>
      <button class="primary" id="complete-registration">Confirm Registration</button>
      <button class="secondary" data-route="adventure">Back</button>
    </section>`;
  document.querySelector('#complete-registration').addEventListener('click', () => {
    state.joined = true;
    render('confirmation');
  });
  bindRoutes();
}

function renderConfirmation() {
  title.textContent = 'Confirmed';
  app.innerHTML = `
    <section class="screen success">
      <div class="success-mark">✓</div>
      <span class="tag">YOU'RE GOING</span>
      <h2>Your next story is officially on the map.</h2>
      <p>${adventure.title}<br>${adventure.date}</p>
      <button class="primary" data-route="hub">Open Adventure Hub</button>
      <button class="secondary" data-route="trailhead">Return to Trailhead</button>
    </section>`;
  bindRoutes();
}

function renderHub() {
  title.textContent = 'Adventure Hub';
  app.innerHTML = `
    <section class="screen">
      <div class="hero" style="min-height:220px;background-image:url('${adventure.image}')"><span class="tag">YOUR NEXT ADVENTURE</span><h2>${adventure.title}</h2><p>100 days to go</p></div>
      <div class="panel"><div class="section-heading"><div><h3>Preparation</h3><p>Three of five items ready</p></div><strong>60%</strong></div><div class="progress"><span style="width:60%"></span></div></div>
      <div class="panel"><h3>Packing checklist</h3><ul class="checklist"><li><span class="check">✓</span>Event registration</li><li><span class="check">✓</span>Transportation plan</li><li><span class="check">✓</span>Meal preference</li><li><span class="check">○</span>Pack overnight gear</li><li><span class="check">○</span>Review arrival map</li></ul></div>
      <div class="panel"><h3>Arrival</h3><p>Check-in opens Friday at 3:00 PM. Your digital check-in pass will become available before arrival.</p></div>
      <button class="primary" data-route="checkin">Preview Check-In</button>
      <button class="secondary" data-route="campfire">View Event Updates</button>
    </section>`;
  bindRoutes();
}

function renderCheckin() {
  title.textContent = 'Check-In';
  if (state.checkedIn) {
    app.innerHTML = `<section class="screen success"><div class="success-mark">⌖</div><span class="tag">CHECKED IN</span><h2>Welcome to camp.</h2><p>Your adventure has begun. Put the phone away when you're ready. The good part is outside.</p><button class="primary" id="complete-adventure">Simulate Adventure Completion</button><button class="secondary" data-route="hub">Adventure Hub</button></section>`;
    document.querySelector('#complete-adventure').addEventListener('click', () => { state.completed = true; render('passport'); });
  } else {
    app.innerHTML = `<section class="screen"><div class="section-heading"><div><h2>Ready to arrive?</h2><p>Confirm your identity and event.</p></div></div><div class="panel"><h3>${adventure.title}</h3><p>${adventure.place}</p></div><div class="passport-cover"><div class="crest">⌖</div><p class="eyebrow">DIGITAL CHECK-IN PASS</p><h2>JONATHAN</h2><p>Weekend Experience</p></div><button class="primary" id="check-in-now">Check In Now</button><button class="secondary" data-route="hub">Not Yet</button></section>`;
    document.querySelector('#check-in-now').addEventListener('click', () => { state.checkedIn = true; render('checkin'); });
  }
  bindRoutes();
}

function renderPassport() {
  title.textContent = 'Passport';
  const newStamp = state.completed ? `<div class="stamp"><div><strong>Little Camp<br>of Horrors</strong><small>2026</small></div></div>` : '';
  app.innerHTML = `
    <section class="screen">
      <div class="passport-cover"><div class="crest">✦</div><p class="eyebrow">ADVENTURE PASSPORT</p><h2>JONATHAN</h2><p>Pathfinder II • Member since 2025</p></div>
      <div class="stats"><div class="stat"><strong>${state.completed ? 13 : 12}</strong><small>Adventures</small></div><div class="stat"><strong>9</strong><small>Campouts</small></div><div class="stat"><strong>4</strong><small>States</small></div></div>
      <div class="section-heading"><div><h2>Passport stamps</h2><p>Every stamp holds a real memory.</p></div></div>
      <div class="stamp-grid">${newStamp}<div class="stamp"><div><strong>Float Out</strong><small>2026</small></div></div><div class="stamp"><div><strong>Blue Springs</strong><small>2026</small></div></div><div class="stamp"><div><strong>Florida Caverns</strong><small>2025</small></div></div></div>
      ${state.completed ? `<div class="panel"><span class="tag">NEW JOURNEY ENTRY</span><h3>The camp where Halloween found the woods</h3><p>Your attendance created a new Passport stamp and Journey memory.</p><button class="primary" data-route="journey">View My Journey</button></div>` : ''}
    </section>`;
  bindRoutes();
}

function renderJourney() {
  title.textContent = 'My Journey';
  app.innerHTML = `<section class="screen"><div class="section-heading"><div><h2>Your outside story</h2><p>A timeline of places, people and firsts.</p></div></div><div class="card-list">${state.completed ? `<div class="panel"><span class="tag">NOVEMBER 2026</span><h3>${adventure.title}</h3><p>Camped, celebrated and made another memory with the community.</p></div>` : ''}<div class="panel"><span class="tag">JUNE 2026</span><h3>Float Out: Juneteenth Edition</h3><p>A lake day, a shared meal and freedom celebrated outside.</p></div><div class="panel"><span class="tag">MARCH 2026</span><h3>First spring campout</h3><p>Two nights under the trees and one new favorite campsite.</p></div></div></section>`;
}

function renderCommunity() {
  title.textContent = 'Community';
  app.innerHTML = `<section class="screen"><div class="section-heading"><div><h2>Stories from outside</h2><p>Community built around experiences, not endless scrolling.</p></div></div><div class="card-list"><div class="activity-card"><div class="activity-icon">📷</div><div><h3>Ashley shared 24 photos</h3><p>Float Out: Juneteenth Edition</p></div></div><div class="activity-card"><div class="activity-icon">🥾</div><div><h3>Marcus completed his first hike</h3><p>“I didn't think five miles was in me.”</p></div></div><div class="activity-card"><div class="activity-icon">🏕</div><div><h3>First-time camper question</h3><p>What do you wish you packed for your first overnight trip?</p></div></div></div></section>`;
}

function renderCampfire() {
  title.textContent = 'Campfire';
  app.innerHTML = `<section class="screen"><div class="section-heading"><div><h2>What needs your attention</h2><p>Updates from your adventures and community.</p></div></div><div class="card-list"><div class="activity-card"><div class="activity-icon">⚠</div><div><h3>Arrival instructions updated</h3><p>Review the final parking and check-in map.</p></div></div><div class="activity-card"><div class="activity-icon">☁</div><div><h3>Weather watch</h3><p>Rain is possible Friday evening. Pack a light rain layer.</p></div></div><div class="activity-card"><div class="activity-icon">✦</div><div><h3>You're close to a Trail Mark</h3><p>Complete two more overnight adventures.</p></div></div></div><button class="primary" data-route="hub">Open Adventure Hub</button></section>`;
  bindRoutes();
}

function renderMore() {
  title.textContent = 'More';
  app.innerHTML = `<section class="screen"><div class="section-heading"><div><h2>More paths</h2><p>Account, support and future modules.</p></div></div><div class="card-list"><div class="panel"><h3>Bucket List</h3><p>Save places and adventures for later.</p></div><div class="panel"><h3>Safety & Support</h3><p>Emergency information, reports and help.</p></div><div class="panel"><h3>Build-A-Camp</h3><p>Future equipment and setup services.</p></div><div class="panel"><h3>Settings</h3><p>Privacy, notifications and accessibility.</p></div></div></section>`;
}

navItems.forEach(item => item.addEventListener('click', () => render(item.dataset.route)));
campfireButton.addEventListener('click', () => render('campfire'));

render('trailhead');
