const STORAGE_KEY = 'workout-web-store-v1';

const routines = [
  {
    id: 'upper-a', name: 'Upper A', focus: 'Chest, back, shoulders', duration: 45,
    exercises: [
      ['bench-press', 'Barbell Bench Press', 3, '8–10'],
      ['lat-pulldown', 'Lat Pulldown', 3, '8–12'],
      ['shoulder-press', 'Shoulder Press', 3, '8–10'],
      ['cable-row', 'Seated Cable Row', 3, '10–12'],
      ['triceps-pushdown', 'Triceps Pushdown', 3, '10–15'],
    ],
  },
  {
    id: 'lower-a', name: 'Lower A', focus: 'Quads, glutes, calves', duration: 45,
    exercises: [
      ['back-squat', 'Back Squat', 3, '6–10'],
      ['leg-press', 'Leg Press', 3, '10–12'],
      ['leg-curl', 'Leg Curl', 3, '10–15'],
      ['calf-raise', 'Standing Calf Raise', 3, '12–15'],
      ['plank', 'Plank', 3, '30–60 sec'],
    ],
  },
  {
    id: 'upper-b', name: 'Upper B', focus: 'Back, chest, arms', duration: 45,
    exercises: [
      ['incline-press', 'Incline Dumbbell Press', 3, '8–12'],
      ['chest-row', 'Chest-Supported Row', 3, '8–12'],
      ['lateral-raise', 'Lateral Raise', 3, '12–15'],
      ['biceps-curl', 'Dumbbell Curl', 3, '10–12'],
      ['triceps-extension', 'Overhead Triceps Extension', 3, '10–12'],
    ],
  },
  {
    id: 'lower-b', name: 'Lower B', focus: 'Hamstrings, glutes, quads', duration: 45,
    exercises: [
      ['romanian-deadlift', 'Romanian Deadlift', 3, '8–10'],
      ['split-squat', 'Bulgarian Split Squat', 3, '8–10'],
      ['hip-thrust', 'Hip Thrust', 3, '8–12'],
      ['leg-extension', 'Leg Extension', 3, '10–15'],
      ['seated-calf', 'Seated Calf Raise', 3, '12–15'],
    ],
  },
].map(routine => ({
  ...routine,
  exercises: routine.exercises.map(([id, name, sets, reps]) => ({ id, name, sets, reps })),
}));

const defaultStore = { history: [], activeWorkout: null };
let store = loadStore();
let currentTab = store.activeWorkout ? 'workout' : 'home';

function loadStore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved && Array.isArray(saved.history) ? saved : structuredClone(defaultStore);
  } catch {
    return structuredClone(defaultStore);
  }
}

function saveStore() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createWorkout(routine) {
  return {
    id: uid('workout'),
    routineId: routine.id,
    routineName: routine.name,
    startedAt: new Date().toISOString(),
    exercises: routine.exercises.map(exercise => ({
      ...exercise,
      sets: Array.from({ length: exercise.sets }, () => ({ id: uid('set'), weight: '', reps: '', completed: false })),
    })),
  };
}

function num(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function completedSets(exercises) {
  return exercises.reduce((sum, exercise) => sum + exercise.sets.filter(set => set.completed).length, 0);
}

function volume(exercises) {
  return exercises.reduce((total, exercise) => total + exercise.sets.reduce((sum, set) => {
    return sum + (set.completed ? num(set.weight) * num(set.reps) : 0);
  }, 0), 0);
}

function formatVolume(value) {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k lb`;
  return `${Math.round(value)} lb`;
}

function formatDate(iso) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(iso));
}

function startOfWeek() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - date.getDay());
  return date;
}

function weeklyHistory() {
  const start = startOfWeek();
  return store.history.filter(entry => new Date(entry.completedAt) >= start);
}

function previousBest(exerciseId) {
  let best = null;
  for (const workout of store.history) {
    const exercise = workout.exercises.find(item => item.id === exerciseId);
    if (!exercise) continue;
    for (const set of exercise.sets) {
      if (!set.completed) continue;
      const candidate = { weight: num(set.weight), reps: num(set.reps) };
      if (!best || candidate.weight > best.weight || (candidate.weight === best.weight && candidate.reps > best.reps)) best = candidate;
    }
  }
  return best ? `${best.weight} × ${best.reps}` : 'No previous sets';
}

function personalRecords() {
  const records = new Map();
  for (const workout of store.history) {
    for (const exercise of workout.exercises) {
      for (const set of exercise.sets) {
        if (!set.completed) continue;
        const candidate = { name: exercise.name, weight: num(set.weight), reps: num(set.reps) };
        const current = records.get(exercise.id);
        if (!current || candidate.weight > current.weight || (candidate.weight === current.weight && candidate.reps > current.reps)) records.set(exercise.id, candidate);
      }
    }
  }
  return [...records.values()].sort((a, b) => b.weight - a.weight).slice(0, 9);
}

function esc(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function setTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.tab === tab));
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toast(message) {
  document.querySelector('.toast')?.remove();
  const node = document.createElement('div');
  node.className = 'toast';
  node.textContent = message;
  document.body.append(node);
  setTimeout(() => node.remove(), 2200);
}

function startWorkout(routineId) {
  if (store.activeWorkout) {
    setTab('workout');
    toast('Finish or discard your current workout first.');
    return;
  }
  const routine = routines.find(item => item.id === routineId);
  if (!routine) return;
  store.activeWorkout = createWorkout(routine);
  saveStore();
  setTab('workout');
}

function updateSet(exerciseId, setId, field, value) {
  const exercise = store.activeWorkout?.exercises.find(item => item.id === exerciseId);
  const set = exercise?.sets.find(item => item.id === setId);
  if (!set) return;
  set[field] = value.replace(/[^0-9.]/g, '');
  saveStore();
}

function toggleSet(exerciseId, setId) {
  const exercise = store.activeWorkout?.exercises.find(item => item.id === exerciseId);
  const set = exercise?.sets.find(item => item.id === setId);
  if (!set) return;
  set.completed = !set.completed;
  saveStore();
  render();
}

function addSet(exerciseId) {
  const exercise = store.activeWorkout?.exercises.find(item => item.id === exerciseId);
  if (!exercise) return;
  exercise.sets.push({ id: uid('set'), weight: '', reps: '', completed: false });
  saveStore();
  render();
}

function finishWorkout() {
  const workout = store.activeWorkout;
  if (!workout) return;
  const count = completedSets(workout.exercises);
  if (!count) {
    toast('Complete at least one set first.');
    return;
  }
  const completedAt = new Date().toISOString();
  const duration = Math.max(1, Math.round((new Date(completedAt) - new Date(workout.startedAt)) / 60000));
  store.history.unshift({
    ...workout,
    completedAt,
    durationMinutes: duration,
    completedSets: count,
    totalVolume: volume(workout.exercises),
  });
  store.activeWorkout = null;
  saveStore();
  toast('Workout saved.');
  setTab('history');
}

function discardWorkout() {
  if (!store.activeWorkout) return;
  if (!confirm('Discard this workout? Your current set entries will be removed.')) return;
  store.activeWorkout = null;
  saveStore();
  setTab('home');
}

function renderHome() {
  const week = weeklyHistory();
  const weeklyVolume = week.reduce((sum, entry) => sum + entry.totalVolume, 0);
  const last = store.history[0];
  return `
    <div class="page-head">
      <div><p class="eyebrow">TRAINING DASHBOARD</p><h2 class="page-title">Ready to work?</h2><p class="page-copy">Pick a session, log your sets, and keep moving.</p></div>
    </div>
    ${store.activeWorkout ? `<div class="resume-card" data-action="resume"><div class="resume-dot"></div><div><span>WORKOUT IN PROGRESS</span><strong>${esc(store.activeWorkout.routineName)}</strong></div><div class="resume-arrow">→</div></div>` : ''}
    <div class="hero">
      <section class="hero-primary"><p class="eyebrow">THIS WEEK</p><div class="hero-metrics"><div class="hero-metric"><span class="hero-number">${week.length}</span><span class="hero-label">workouts complete</span></div><div class="hero-divider"></div><div class="hero-metric"><span class="hero-number">${formatVolume(weeklyVolume)}</span><span class="hero-label">training volume</span></div></div></section>
      <section class="hero-secondary"><div><p class="eyebrow">CURRENT GOAL</p><h3>4 workouts this week</h3><p>${week.length >= 4 ? 'Weekly target complete. Strong work.' : `${Math.max(0, 4 - week.length)} session${4 - week.length === 1 ? '' : 's'} left to hit the target.`}</p></div><button class="button" data-action="quick-start">START NEXT WORKOUT</button></section>
    </div>
    <section class="section"><div class="section-head"><div><p class="eyebrow">YOUR PLAN</p><h2>Choose a workout</h2></div><span class="section-meta">4-day strength split</span></div><div class="routine-grid">
      ${routines.map((routine, index) => `<article class="card routine-card"><div class="routine-top"><span class="routine-number">0${index + 1}</span><span class="routine-time">${routine.duration} MIN</span></div><h3>${esc(routine.name)}</h3><div class="routine-focus">${esc(routine.focus)}</div><div class="routine-footer"><span class="routine-meta">${routine.exercises.length} exercises</span><button class="button" data-start="${routine.id}">START</button></div></article>`).join('')}
    </div></section>
    <section class="section"><div class="section-head"><div><p class="eyebrow">RECENT</p><h2>Last session</h2></div></div>
      ${last ? `<article class="history-card"><div class="history-top"><div><h3>${esc(last.routineName)}</h3><div class="history-date">${formatDate(last.completedAt)}</div></div><div class="history-volume">${formatVolume(last.totalVolume)}</div></div><div class="history-stats"><span>${last.completedSets} sets</span><span>•</span><span>${last.durationMinutes} min</span></div></article>` : `<div class="empty-state"><div class="empty-glyph">W/</div><h2>No sessions yet</h2><p>Finish your first workout and it will land here automatically.</p></div>`}
    </section>`;
}

function renderWorkout() {
  const workout = store.activeWorkout;
  if (!workout) return `<div class="page-head"><div><p class="eyebrow">WORKOUT</p><h2 class="page-title">No active session</h2><p class="page-copy">Choose a routine from Home to start logging.</p></div><button class="button" data-action="home">CHOOSE WORKOUT</button></div>`;
  const total = workout.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  const done = completedSets(workout.exercises);
  const pct = Math.round((done / Math.max(1, total)) * 100);
  return `
    <div class="workout-header"><div><p class="eyebrow">ACTIVE WORKOUT</p><h2 class="page-title">${esc(workout.routineName)}</h2><p class="page-copy">Started ${new Date(workout.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · ${done}/${total} sets complete</p></div><div class="workout-actions"><button class="button danger" data-action="discard">DISCARD</button><button class="button" data-action="finish">FINISH WORKOUT</button></div></div>
    <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
    <div class="exercise-list">${workout.exercises.map((exercise, i) => `
      <article class="exercise-card">
        <div class="exercise-head"><div class="exercise-index">${i + 1}</div><div><h3>${esc(exercise.name)}</h3><p>${exercise.sets.length} sets · target ${esc(exercise.reps)} reps</p></div><div class="previous"><span>PREVIOUS BEST</span><strong>${previousBest(exercise.id)}</strong></div></div>
        <div class="set-head"><span>SET</span><span>WEIGHT (LB)</span><span>REPS</span><span>DONE</span></div>
        ${exercise.sets.map((set, si) => `<div class="set-row"><div class="set-num">${si + 1}</div><input class="set-input" inputmode="decimal" value="${esc(set.weight)}" placeholder="0" data-exercise="${exercise.id}" data-set="${set.id}" data-field="weight"><input class="set-input" inputmode="numeric" value="${esc(set.reps)}" placeholder="0" data-exercise="${exercise.id}" data-set="${set.id}" data-field="reps"><button class="set-done ${set.completed ? 'complete' : ''}" data-toggle-exercise="${exercise.id}" data-toggle-set="${set.id}">${set.completed ? '✓' : '○'}</button></div>`).join('')}
        <button class="add-set" data-add-set="${exercise.id}">+ ADD SET</button>
      </article>`).join('')}</div>`;
}

function renderHistory() {
  return `<div class="page-head"><div><p class="eyebrow">TRAINING LOG</p><h2 class="page-title">History</h2><p class="page-copy">Every completed workout stays on this device.</p></div></div>
  <div class="history-list">${store.history.length ? store.history.map(entry => `<article class="history-card"><div class="history-top"><div><h3>${esc(entry.routineName)}</h3><div class="history-date">${formatDate(entry.completedAt)}</div></div><div class="history-volume">${formatVolume(entry.totalVolume)}</div></div><div class="history-stats"><span>${entry.completedSets} sets</span><span>•</span><span>${entry.durationMinutes} min</span><span>•</span><span>${entry.exercises.length} exercises</span></div><div class="chips">${entry.exercises.map(exercise => `<span class="chip">${esc(exercise.name)}</span>`).join('')}</div></article>`).join('') : `<div class="empty-state"><div class="empty-glyph">↺</div><h2>No workout history</h2><p>Completed sessions will appear here.</p></div>`}</div>`;
}

function renderProgress() {
  const totalVolume = store.history.reduce((sum, entry) => sum + entry.totalVolume, 0);
  const totalSets = store.history.reduce((sum, entry) => sum + entry.completedSets, 0);
  const week = weeklyHistory();
  const prs = personalRecords();
  return `<div class="page-head"><div><p class="eyebrow">PROGRESS</p><h2 class="page-title">Keep the numbers moving.</h2><p class="page-copy">Simple totals and personal records from your logged sessions.</p></div></div>
    <div class="stat-grid"><div class="stat-card"><span class="stat-value">${store.history.length}</span><span class="stat-label">Total workouts</span></div><div class="stat-card"><span class="stat-value">${totalSets}</span><span class="stat-label">Completed sets</span></div><div class="stat-card"><span class="stat-value">${formatVolume(totalVolume)}</span><span class="stat-label">Lifetime volume</span></div><div class="stat-card"><span class="stat-value">${week.length}/4</span><span class="stat-label">This week's target</span></div></div>
    <section class="section"><div class="section-head"><div><p class="eyebrow">PERSONAL RECORDS</p><h2>Best logged sets</h2></div></div>${prs.length ? `<div class="pr-grid">${prs.map(record => `<article class="pr-card"><h3>${esc(record.name)}</h3><span class="pr-value">${record.weight} lb</span><span class="pr-reps">${record.reps} reps</span></article>`).join('')}</div>` : `<div class="empty-state"><div class="empty-glyph">↗</div><h2>No PRs yet</h2><p>Complete some weighted sets and your best numbers will appear here.</p></div>`}</section>`;
}

function render() {
  const app = document.getElementById('app');
  app.innerHTML = currentTab === 'home' ? renderHome() : currentTab === 'workout' ? renderWorkout() : currentTab === 'history' ? renderHistory() : renderProgress();

  app.querySelectorAll('[data-start]').forEach(button => button.addEventListener('click', () => startWorkout(button.dataset.start)));
  app.querySelector('[data-action="resume"]')?.addEventListener('click', () => setTab('workout'));
  app.querySelector('[data-action="quick-start"]')?.addEventListener('click', () => {
    const index = store.history.length % routines.length;
    startWorkout(routines[index].id);
  });
  app.querySelector('[data-action="home"]')?.addEventListener('click', () => setTab('home'));
  app.querySelector('[data-action="finish"]')?.addEventListener('click', finishWorkout);
  app.querySelector('[data-action="discard"]')?.addEventListener('click', discardWorkout);
  app.querySelectorAll('[data-add-set]').forEach(button => button.addEventListener('click', () => addSet(button.dataset.addSet)));
  app.querySelectorAll('[data-toggle-set]').forEach(button => button.addEventListener('click', () => toggleSet(button.dataset.toggleExercise, button.dataset.toggleSet)));
  app.querySelectorAll('[data-field]').forEach(input => input.addEventListener('input', () => updateSet(input.dataset.exercise, input.dataset.set, input.dataset.field, input.value)));
}

document.querySelectorAll('.nav-item').forEach(button => button.addEventListener('click', () => setTab(button.dataset.tab)));
setTab(currentTab);
