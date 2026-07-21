const app = document.querySelector('#app');
const title = document.querySelector('#screen-title');
const navItems = [...document.querySelectorAll('.nav-item')];
const campfireButton = document.querySelector('#campfire-button');
const notificationDot = document.querySelector('.notification-dot');

const savedState = JSON.parse(localStorage.getItem('ma-prototype-state') || '{}');
const state = {
  joined: false,
  checkedIn: false,
  completed: false,
  campfireRead: false,
  checklist: [true, true, true, false, false],
  ...savedState,
};

const adventures = [
  {
    id: 'horror-camp',
    title: 'The Great Melanated Little Camp of Horrors',
    category: 'Camping',
    date: 'October 30 – November 1, 2026',
    shortDate: 'Oct 30',
    place: 'Florida Sand Music Ranch, Brooksville',
    price: '$189',
    comfort: 'Beginner welcome',
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'sunrise-paddle',
    title: 'Sunrise Paddle & Picnic',
    category: 'Water',
    date: 'November 14, 2026',
    shortDate: 'Nov 14',
    place: 'Jacksonville, Florida',
    price: '$45',
    comfort: 'Beginner friendly',
    image: 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=900&q=80'
  },
  {
    id: 'little-talbot',
    title: 'First Hike: Little Talbot',
    category: 'Day Trips',
    date: 'December 5, 2026',
    shortDate: 'Dec 5',
    place: 'Jacksonville, Florida',
    price: 'Free',
    comfort: 'First-timer friendly',
    image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=900&q=80'
  }
];

const adventure = adventures[0];
let currentRoute = 'trailhead';

function saveState() {
  localStorage.setItem('ma-prototype-state', JSON.stringify(state));
}

function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2200);
}

function setActive(route) {
  navItems.forEach(item => item.classList.toggle('active', item.dataset.route === route));
}

function updateCampfireIndicator() {
  notificationDot.hidden = state.campfireRead;
}

function navigate(route, push = true) {
  currentRoute = route;
  if (push) history.pushState({ route }, '', `#${route}`);
  render(route);
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
  setActive(['trailhead', 'explore', 'community', 'passport', 'more'].includes(route) ? route : '');
  updateCampfireIndicator();
  app.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function bindRoutes() {
  document.querySelectorAll('[data-route]').forEach(el => {
    if (!el.classList.contains('nav-item')) {
      el.addEventListener('click', () => navigate(el.dataset.route));
      el.addEventListener('keydown', event => {
        if ((event.key === 'Enter' || event.key === ' ') && el.getAttribute('role') === 'button') {
          event.preventDefault();
          navigate(el.dataset.route);
        }
      });
    }
  });
}

function renderTrailhead() {
  title.textContent = 'Trailhead';
  const nextAction = state.completed
    ? 'Your newest stamp is waiting in Passport.'
    : state.checkedIn
      ? 'You are checked in. Your adventure has begun.'
      : state.joined
        ? 'Your packing list and arrival guide are ready.'
        : 'Your next adventure is getting close.';
  const heroRoute = state.joined ? 'hub' : 'adventure';
  const heroBadge = state.completed ? 'COMPLETED' : state.joined ? 'YOU’RE GOING' : '100 DAYS';
  app.innerHTML = `
    <section class="screen">
      <section class="welcome-block">
        <p>Good evening, Jonathan.</p>
        <h2>${nextAction}</h2>
        <div class="status-line"><span class="pulse-dot"></span> The community is active tonight</div>
      </section>
      <section class="tile-grid" aria-label="Trailhead tiles">
        <button class="tile tile-hero tile-photo" data-route="${heroRoute}" style="--image:url('${adventure.image}')">
          <span class="tile-badge">${heroBadge}</span>
          <span class="tile-label">NEXT ADVENTURE</span>
          <span><strong>${adventure.title}</strong><span class="tile-meta">${adventure.shortDate} • Brooksville</span></span>
        </button>
        <button class="tile tile-tall tile-community" data-route="community">
          <span class="tile-label">COMMUNITY</span>
          <span class="live-stack" aria-label="Recent community activity">
            <span>Ashley shared 24 new photos.</span>
            <span>Marcus completed his first five-mile hike.</span>
            <span>Eight members joined the next campout.</span>
          </span>
          <span class="tile-meta">Stories from outside</span>
        </button>
        <button class="tile tile-small tile-passport" data-route="passport">
          <span class="tile-label">PASSPORT</span>
          <span><strong>Pathfinder II</strong><span class="tile-meta">72% to next rank</span><span class="mini-progress"><i></i></span></span>
        </button>
        <button class="tile tile-wide tile-journey" data-route="journey">
          <span class="tile-label">MY JOURNEY</span>
          <span><strong>${state.completed ? 13 : 12} adventures completed</strong><span class="tile-meta">4 states • 9 campouts • countless stories</span></span>
        </button>
        <button class="tile tile-small tile-accent" data-route="campfire">
          <span class="tile-label">CAMPFIRE</span>
          <span><strong>${state.campfireRead ? 'All caught up' : '3 updates'}</strong><span class="tile-meta">Weather • Arrival • Trail Mark</span></span>
        </button>
        <button class="tile tile-wide tile-explore" data-route="explore">
          <span class="tile-label">EXPLORE</span>
          <span><strong>Find your next outside story</strong><span class="tile-meta">Camping, water, day trips and new firsts</span></span>
        </button>
      </section>
    </section>`;
  bindRoutes();
}

function adventureCard(item, featured = false) {
  return `<article class="adventure-card" ${item.id === adventure.id ? 'data-route="adventure" role="button" tabindex="0"' : ''} data-category="${item.category}" data-search="${item.title.toLowerCase()} ${item.place.toLowerCase()}">
    <div class="card-image" style="background-image:url('${item.image}')"></div>
    <div class="card-body"><span class="tag">${featured ? 'FEATURED ' : ''}${item.category.toUpperCase()}</span><h3>${item.title}</h3><p>${item.shortDate} • ${item.place.split(',')[0]} • ${item.price}</p></div>
  </article>`;
}

function renderExplore() {
  title.textContent = 'Explore';
  app.innerHTML = `
    <section class="screen">
      <div class="section-heading"><div><h2>Find your next story</h2><p>Curated outdoor experiences for every comfort level.</p></div></div>
      <input class="search" id="adventure-search" aria-label="Search adventures" placeholder="Search camping, water, parks…" />
      <div class="chips" aria-label="Adventure categories">
        ${['Featured', 'Camping', 'Water', 'Day Trips'].map((chip, index) => `<button class="chip ${index === 0 ? 'active' : ''}" data-filter="${chip}">${chip}</button>`).join('')}
      </div>
      <div class="card-list" id="adventure-list">${adventures.map((item, index) => adventureCard(item, index === 0)).join('')}</div>
      <div class="panel empty-results" hidden><h3>No trail found</h3><p>Try another search or category.</p></div>
    </section>`;
  bindRoutes();

  const search = document.querySelector('#adventure-search');
  const chips = [...document.querySelectorAll('[data-filter]')];
  let filter = 'Featured';
  const applyFilters = () => {
    const query = search.value.trim().toLowerCase();
    let visible = 0;
    document.querySelectorAll('.adventure-card').forEach((card, index) => {
      const categoryMatch = filter === 'Featured' ? true : card.dataset.category === filter;
      const searchMatch = !query || card.dataset.search.includes(query);
      card.hidden = !(categoryMatch && searchMatch);
      if (!card.hidden) visible += 1;
    });
    document.querySelector('.empty-results').hidden = visible > 0;
  };
  search.addEventListener('input', applyFilters);
  chips.forEach(chip => chip.addEventListener('click', () => {
    chips.forEach(item => item.classList.remove('active'));
    chip.classList.add('active');
    filter = chip.dataset.filter;
    applyFilters();
  }));
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
        <div class="detail"><small>Comfort</small><strong>${adventure.comfort}</strong></div>
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
      <div class="panel selected-package"><span class="tag">RECOMMENDED</span><h3>Weekend Experience</h3><p>Full event access, shared meals, activities and preparation support.</p><div class="section-heading"><strong>${adventure.price}</strong><span>per person</span></div></div>
      <div class="panel"><h3>Member details</h3><label>Full name<input class="search" value="Jonathan" /></label><label>Email<input class="search" value="jonathan@example.com" /></label></div>
      <div class="panel"><h3>Important note</h3><p>Your campground site or lodging selection may be managed separately depending on the package.</p></div>
      <button class="primary" id="complete-registration">Confirm Registration</button>
      <button class="secondary" data-route="adventure">Back</button>
    </section>`;
  document.querySelector('#complete-registration').addEventListener('click', () => {
    state.joined = true;
    saveState();
    showToast('Adventure added to your journey.');
    navigate('confirmation');
  });
  bindRoutes();
}

function renderConfirmation() {
  title.textContent = 'Confirmed';
  app.innerHTML = `<section class="screen success"><div class="success-mark">✓</div><span class="tag">YOU'RE GOING</span><h2>Your next story is officially on the map.</h2><p>${adventure.title}<br>${adventure.date}</p><button class="primary" data-route="hub">Open Adventure Hub</button><button class="secondary" data-route="trailhead">Return to Trailhead</button></section>`;
  bindRoutes();
}

function renderHub() {
  title.textContent = 'Adventure Hub';
  const ready = state.checklist.filter(Boolean).length;
  const progress = Math.round((ready / state.checklist.length) * 100);
  const checklistLabels = ['Event registration', 'Transportation plan', 'Meal preference', 'Pack overnight gear', 'Review arrival map'];
  app.innerHTML = `
    <section class="screen">
      <div class="hero" style="min-height:220px;background-image:url('${adventure.image}')"><span class="tag">YOUR NEXT ADVENTURE</span><h2>${adventure.title}</h2><p>100 days to go</p></div>
      <div class="panel"><div class="section-heading"><div><h3>Preparation</h3><p>${ready} of ${state.checklist.length} items ready</p></div><strong>${progress}%</strong></div><div class="progress"><span style="width:${progress}%"></span></div></div>
      <div class="panel"><h3>Packing checklist</h3><ul class="checklist interactive-checklist">${checklistLabels.map((label, index) => `<li><button class="check-toggle ${state.checklist[index] ? 'done' : ''}" data-check="${index}" aria-pressed="${state.checklist[index]}">${state.checklist[index] ? '✓' : '○'}</button>${label}</li>`).join('')}</ul></div>
      <div class="panel"><h3>Arrival</h3><p>Check-in opens Friday at 3:00 PM. Your digital check-in pass will become available before arrival.</p></div>
      <button class="primary" data-route="checkin">Preview Check-In</button>
      <button class="secondary" data-route="campfire">View Event Updates</button>
    </section>`;
  document.querySelectorAll('[data-check]').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.check);
    state.checklist[index] = !state.checklist[index];
    saveState();
    renderHub();
  }));
  bindRoutes();
}

function renderCheckin() {
  title.textContent = 'Check-In';
  if (state.checkedIn) {
    app.innerHTML = `<section class="screen success"><div class="success-mark">⌖</div><span class="tag">CHECKED IN</span><h2>Welcome to camp.</h2><p>Your adventure has begun. Put the phone away when you're ready. The good part is outside.</p><button class="primary" id="complete-adventure">Simulate Adventure Completion</button><button class="secondary" data-route="hub">Adventure Hub</button></section>`;
    document.querySelector('#complete-adventure').addEventListener('click', () => {
      state.completed = true;
      saveState();
      showToast('New Passport stamp unlocked.');
      navigate('passport');
    });
  } else {
    app.innerHTML = `<section class="screen"><div class="section-heading"><div><h2>Ready to arrive?</h2><p>Confirm your identity and event.</p></div></div><div class="panel"><h3>${adventure.title}</h3><p>${adventure.place}</p></div><div class="passport-cover"><div class="crest">⌖</div><p class="eyebrow">DIGITAL CHECK-IN PASS</p><h2>JONATHAN</h2><p>Weekend Experience</p></div><button class="primary" id="check-in-now">Check In Now</button><button class="secondary" data-route="hub">Not Yet</button></section>`;
    document.querySelector('#check-in-now').addEventListener('click', () => {
      state.checkedIn = true;
      saveState();
      showToast('You are checked in. Welcome outside.');
      renderCheckin();
    });
  }
  bindRoutes();
}

function renderPassport() {
  title.textContent = 'Passport';
  const newStamp = state.completed ? `<div class="stamp stamp-new"><div><strong>Little Camp<br>of Horrors</strong><small>2026</small></div></div>` : '';
  app.innerHTML = `
    <section class="screen">
      <div class="passport-cover"><div class="crest">✦</div><p class="eyebrow">ADVENTURE PASSPORT</p><h2>JONATHAN</h2><p>Pathfinder II • Member since 2025</p></div>
      <div class="stats"><div class="stat"><strong>${state.completed ? 13 : 12}</strong><small>Adventures</small></div><div class="stat"><strong>9</strong><small>Campouts</small></div><div class="stat"><strong>4</strong><small>States</small></div></div>
      <div class="panel rank-panel"><div class="section-heading"><div><h3>Pathfinder III</h3><p>Two overnight adventures away</p></div><strong>72%</strong></div><div class="progress"><span style="width:72%"></span></div></div>
      <div class="section-heading"><div><h2>Passport stamps</h2><p>Every stamp holds a real memory.</p></div></div>
      <div class="stamp-grid">${newStamp}<div class="stamp"><div><strong>Float Out</strong><small>2026</small></div></div><div class="stamp"><div><strong>Blue Springs</strong><small>2026</small></div></div><div class="stamp"><div><strong>Florida Caverns</strong><small>2025</small></div></div></div>
      ${state.completed ? `<div class="panel"><span class="tag">NEW JOURNEY ENTRY</span><h3>The camp where Halloween found the woods</h3><p>Your attendance created a new Passport stamp and Journey memory.</p><button class="primary" data-route="journey">View My Journey</button></div>` : ''}
    </section>`;
  bindRoutes();
}

function renderJourney() {
  title.textContent = 'My Journey';
  app.innerHTML = `<section class="screen"><div class="section-heading"><div><h2>Your outside story</h2><p>A timeline of places, people and firsts.</p></div></div><div class="journey-line">${state.completed ? `<div class="journey-entry"><span class="journey-dot"></span><div class="panel"><span class="tag">NOVEMBER 2026</span><h3>${adventure.title}</h3><p>Camped, celebrated and made another memory with the community.</p></div></div>` : ''}<div class="journey-entry"><span class="journey-dot"></span><div class="panel"><span class="tag">JUNE 2026</span><h3>Float Out: Juneteenth Edition</h3><p>A lake day, a shared meal and freedom celebrated outside.</p></div></div><div class="journey-entry"><span class="journey-dot"></span><div class="panel"><span class="tag">MARCH 2026</span><h3>First spring campout</h3><p>Two nights under the trees and one new favorite campsite.</p></div></div></div></section>`;
}

function renderCommunity() {
  title.textContent = 'Community';
  app.innerHTML = `<section class="screen"><div class="section-heading"><div><h2>Stories from outside</h2><p>Community built around experiences, not endless scrolling.</p></div></div><div class="card-list"><div class="activity-card"><div class="activity-icon">📷</div><div><h3>Ashley shared 24 photos</h3><p>Float Out: Juneteenth Edition</p></div></div><div class="activity-card"><div class="activity-icon">🥾</div><div><h3>Marcus completed his first hike</h3><p>“I didn't think five miles was in me.”</p></div></div><div class="activity-card"><div class="activity-icon">🏕</div><div><h3>First-time camper question</h3><p>What do you wish you packed for your first overnight trip?</p></div></div><button class="primary" id="share-memory">Share a Memory</button></div></section>`;
  document.querySelector('#share-memory').addEventListener('click', () => showToast('Memory sharing will open in the next prototype pass.'));
}

function renderCampfire() {
  title.textContent = 'Campfire';
  state.campfireRead = true;
  saveState();
  app.innerHTML = `<section class="screen"><div class="section-heading"><div><h2>What needs your attention</h2><p>Updates from your adventures and community.</p></div><span class="tag">ALL CAUGHT UP</span></div><div class="card-list"><div class="activity-card priority"><div class="activity-icon">⚠</div><div><h3>Arrival instructions updated</h3><p>Review the final parking and check-in map.</p></div></div><div class="activity-card"><div class="activity-icon">☁</div><div><h3>Weather watch</h3><p>Rain is possible Friday evening. Pack a light rain layer.</p></div></div><div class="activity-card"><div class="activity-icon">✦</div><div><h3>You're close to a Trail Mark</h3><p>Complete two more overnight adventures.</p></div></div></div><button class="primary" data-route="${state.joined ? 'hub' : 'adventure'}">${state.joined ? 'Open Adventure Hub' : 'View Adventure'}</button></section>`;
  bindRoutes();
  updateCampfireIndicator();
}

function renderMore() {
  title.textContent = 'More';
  app.innerHTML = `<section class="screen"><div class="section-heading"><div><h2>More paths</h2><p>Account, support and future modules.</p></div></div><div class="card-list"><div class="panel"><h3>Bucket List</h3><p>Save places and adventures for later.</p></div><div class="panel"><h3>Safety & Support</h3><p>Emergency information, reports and help.</p></div><div class="panel"><h3>Build-A-Camp</h3><p>Future equipment and setup services.</p></div><div class="panel"><h3>Settings</h3><p>Privacy, notifications and accessibility.</p></div><button class="secondary danger" id="reset-prototype">Reset Prototype Journey</button></div></section>`;
  document.querySelector('#reset-prototype').addEventListener('click', () => {
    localStorage.removeItem('ma-prototype-state');
    Object.assign(state, { joined: false, checkedIn: false, completed: false, campfireRead: false, checklist: [true, true, true, false, false] });
    showToast('Prototype journey reset.');
    navigate('trailhead');
  });
}

navItems.forEach(item => item.addEventListener('click', () => navigate(item.dataset.route)));
campfireButton.addEventListener('click', () => navigate('campfire'));
window.addEventListener('popstate', event => render(event.state?.route || location.hash.slice(1) || 'trailhead'));

const initialRoute = location.hash.slice(1) || 'trailhead';
history.replaceState({ route: initialRoute }, '', `#${initialRoute}`);
render(initialRoute);
