const STORAGE_KEY = 'workout-web-store-v2';
const LEGACY_KEY = 'workout-web-store-v1';

const routines = [
  {
    id: 'upper-a', name: 'Upper A', focus: 'Chest, back, shoulders', duration: 45,
    exercises: [
      ['bench-press', 'Barbell Bench Press', 3, '8–10', 90],
      ['lat-pulldown', 'Lat Pulldown', 3, '8–12', 75],
      ['shoulder-press', 'Shoulder Press', 3, '8–10', 75],
      ['cable-row', 'Seated Cable Row', 3, '10–12', 75],
      ['triceps-pushdown', 'Triceps Pushdown', 3, '10–15', 60],
    ],
  },
  {
    id: 'lower-a', name: 'Lower A', focus: 'Quads, glutes, calves', duration: 45,
    exercises: [
      ['back-squat', 'Back Squat', 3, '6–10', 90],
      ['leg-press', 'Leg Press', 3, '10–12', 90],
      ['leg-curl', 'Leg Curl', 3, '10–15', 60],
      ['calf-raise', 'Standing Calf Raise', 3, '12–15', 60],
      ['plank', 'Plank', 3, '30–60 sec', 60],
    ],
  },
  {
    id: 'upper-b', name: 'Upper B', focus: 'Back, chest, arms', duration: 45,
    exercises: [
      ['incline-press', 'Incline Dumbbell Press', 3, '8–12', 75],
      ['chest-row', 'Chest-Supported Row', 3, '8–12', 75],
      ['lateral-raise', 'Lateral Raise', 3, '12–15', 60],
      ['biceps-curl', 'Dumbbell Curl', 3, '10–12', 60],
      ['triceps-extension', 'Overhead Triceps Extension', 3, '10–12', 60],
    ],
  },
  {
    id: 'lower-b', name: 'Lower B', focus: 'Hamstrings, glutes, quads', duration: 45,
    exercises: [
      ['romanian-deadlift', 'Romanian Deadlift', 3, '8–10', 90],
      ['split-squat', 'Bulgarian Split Squat', 3, '8–10', 75],
      ['hip-thrust', 'Hip Thrust', 3, '8–12', 90],
      ['leg-extension', 'Leg Extension', 3, '10–15', 60],
      ['seated-calf', 'Seated Calf Raise', 3, '12–15', 60],
    ],
  },
].map(routine => ({
  ...routine,
  exercises: routine.exercises.map(([id, name, sets, reps, rest]) => ({ id, name, sets, reps, rest })),
}));

const defaultStore = { history: [], activeWorkout: null, lastSummaryId: null };
let store = loadStore();
let currentTab = store.activeWorkout ? 'workout' : 'home';
let tickHandle = null;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadStore() {
  try {
    const next = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (next && Array.isArray(next.history)) return { ...clone(defaultStore), ...next };
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY));
    if (legacy && Array.isArray(legacy.history)) {
      const migrated = { ...clone(defaultStore), history: legacy.history, activeWorkout: null };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch {}
  return clone(defaultStore);
}

function saveStore() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  syncLiveBadge();
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function num(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function esc(value) {
  return String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[char]));
}

function formatClock(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function formatDate(iso) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(iso));
}

function formatVolume(value) {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k lb`;
  return `${Math.round(value)} lb`;
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

function completedSets(exercises) {
  return exercises.reduce((sum, exercise) => sum + exercise.sets.filter(set => set.completed).length, 0);
}

function totalSets(exercises) {
  return exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
}

function volume(exercises) {
  return exercises.reduce((total, exercise) => total + exercise.sets.reduce((sum, set) => (
    sum + (set.completed ? num(set.weight) * num(set.reps) : 0)
  ), 0), 0);
}

function previousBest(exerciseId, excludeWorkoutId = null) {
  let best = null;
  for (const workout of store.history) {
    if (workout.id === excludeWorkoutId) continue;
    const exercise = workout.exercises.find(item => item.id === exerciseId);
    if (!exercise) continue;
    for (const set of exercise.sets) {
      if (!set.completed) continue;
      const candidate = { weight: num(set.weight), reps: num(set.reps) };
      if (!best || candidate.weight > best.weight || (candidate.weight === best.weight && candidate.reps > best.reps)) best = candidate;
    }
  }
  return best;
}

function bestLabel(exerciseId) {
  const best = previousBest(exerciseId);
  if (!best) return 'No previous sets';
  if (exerciseId === 'plank') return `${best.reps} sec`;
  if (!best.weight) return `${best.reps} reps`;
  return `${best.weight} lb × ${best.reps}`;
}

function personalRecords() {
  const records = new Map();
  for (const workout of store.history) {
    for (const exercise of workout.exercises) {
      for (const set of exercise.sets) {
        if (!set.completed) continue;
        const candidate = { id: exercise.id, name: exercise.name, weight: num(set.weight), reps: num(set.reps) };
        const current = records.get(exercise.id);
        if (!current || candidate.weight > current.weight || (candidate.weight === current.weight && candidate.reps > current.reps)) {
          records.set(exercise.id, candidate);
        }
      }
    }
  }
  return [...records.values()].sort((a, b) => b.weight - a.weight);
}

function createWorkout(routine) {
  return {
    id: uid('workout'),
    routineId: routine.id,
    routineName: routine.name,
    focus: routine.focus,
    startedAt: new Date().toISOString(),
    currentExerciseIndex: 0,
    currentSetIndex: 0,
    phase: 'work',
    restEndsAt: null,
    restDuration: 0,
    restPausedRemaining: null,
    exercises: routine.exercises.map(exercise => ({
      id: exercise.id,
      name: exercise.name,
      targetSets: exercise.sets,
      reps: exercise.reps,
      rest: exercise.rest,
      sets: Array.from({ length: exercise.sets }, () => ({
        id: uid('set'), weight: '', reps: '', completed: false, completedAt: null,
      })),
    })),
  };
}

function getActivePosition() {
  const workout = store.activeWorkout;
  if (!workout) return null;
  const ei = Math.min(Math.max(0, workout.currentExerciseIndex || 0), workout.exercises.length - 1);
  const exercise = workout.exercises[ei];
  const si = Math.min(Math.max(0, workout.currentSetIndex || 0), exercise.sets.length - 1);
  return { workout, ei, si, exercise, set: exercise.sets[si] };
}

function nextPosition(workout, ei, si) {
  const exercise = workout.exercises[ei];
  if (si + 1 < exercise.sets.length) return { ei, si: si + 1, type: 'set' };
  if (ei + 1 < workout.exercises.length) return { ei: ei + 1, si: 0, type: 'exercise' };
  return null;
}

function workoutElapsedSeconds(workout) {
  return Math.max(0, Math.floor((Date.now() - new Date(workout.startedAt).getTime()) / 1000));
}

function restRemaining(workout) {
  if (!workout || workout.phase !== 'rest') return 0;
  if (Number.isFinite(workout.restPausedRemaining)) return Math.max(0, Math.ceil(workout.restPausedRemaining));
  if (!workout.restEndsAt) return 0;
  return Math.max(0, Math.ceil((new Date(workout.restEndsAt).getTime() - Date.now()) / 1000));
}

function restProgress(workout) {
  const duration = Math.max(1, workout.restDuration || 1);
  return Math.max(0, Math.min(100, (restRemaining(workout) / duration) * 100));
}

function startWorkout(routineId) {
  if (store.activeWorkout) {
    currentTab = 'workout';
    render();
    toast('Resume or finish your current workout first.');
    return;
  }
  const routine = routines.find(item => item.id === routineId);
  if (!routine) return;
  store.activeWorkout = createWorkout(routine);
  saveStore();
  currentTab = 'workout';
  render();
  document.querySelector('#set-weight')?.focus();
}

function completeCurrentSet() {
  const pos = getActivePosition();
  if (!pos || pos.workout.phase !== 'work') return;
  const weightInput = document.querySelector('#set-weight');
  const repsInput = document.querySelector('#set-reps');
  const weight = weightInput ? weightInput.value.trim() : pos.set.weight;
  const reps = repsInput ? repsInput.value.trim() : pos.set.reps;
  if (num(reps) <= 0) {
    toast(pos.exercise.reps.includes('sec') ? 'Enter the seconds completed.' : 'Enter the reps completed.');
    repsInput?.focus();
    return;
  }
  pos.set.weight = weight.replace(/[^0-9.]/g, '');
  pos.set.reps = reps.replace(/[^0-9.]/g, '');
  pos.set.completed = true;
  pos.set.completedAt = new Date().toISOString();

  const next = nextPosition(pos.workout, pos.ei, pos.si);
  if (!next) {
    saveStore();
    finishWorkout(true);
    return;
  }

  const restSeconds = pos.exercise.rest || 60;
  pos.workout.phase = 'rest';
  pos.workout.restDuration = restSeconds;
  pos.workout.restEndsAt = new Date(Date.now() + restSeconds * 1000).toISOString();
  pos.workout.restPausedRemaining = null;
  pos.workout.pendingPosition = next;
  saveStore();
  render();
}

function advanceAfterRest() {
  const workout = store.activeWorkout;
  if (!workout || workout.phase !== 'rest') return;
  const next = workout.pendingPosition;
  if (!next) {
    finishWorkout(true);
    return;
  }
  workout.currentExerciseIndex = next.ei;
  workout.currentSetIndex = next.si;
  workout.phase = 'work';
  workout.restEndsAt = null;
  workout.restDuration = 0;
  workout.restPausedRemaining = null;
  workout.pendingPosition = null;
  saveStore();
  render();
  document.querySelector('#set-weight')?.focus();
}

function adjustRest(delta) {
  const workout = store.activeWorkout;
  if (!workout || workout.phase !== 'rest') return;
  if (Number.isFinite(workout.restPausedRemaining)) {
    workout.restPausedRemaining = Math.max(0, workout.restPausedRemaining + delta);
  } else {
    const remaining = restRemaining(workout);
    workout.restEndsAt = new Date(Date.now() + Math.max(0, remaining + delta) * 1000).toISOString();
  }
  workout.restDuration = Math.max(1, (workout.restDuration || 1) + Math.max(0, delta));
  saveStore();
  updateTimers();
}

function toggleRestPause() {
  const workout = store.activeWorkout;
  if (!workout || workout.phase !== 'rest') return;
  if (Number.isFinite(workout.restPausedRemaining)) {
    workout.restEndsAt = new Date(Date.now() + workout.restPausedRemaining * 1000).toISOString();
    workout.restPausedRemaining = null;
  } else {
    workout.restPausedRemaining = restRemaining(workout);
    workout.restEndsAt = null;
  }
  saveStore();
  render();
}

function skipRest() {
  if (!store.activeWorkout || store.activeWorkout.phase !== 'rest') return;
  advanceAfterRest();
}

function finishWorkout(auto = false) {
  const workout = store.activeWorkout;
  if (!workout) return;
  const count = completedSets(workout.exercises);
  if (!count) {
    toast('Complete at least one set first.');
    return;
  }
  if (!auto && !confirm('Finish this workout now? Completed sets will be saved.')) return;

  const beforeRecords = new Map();
  for (const exercise of workout.exercises) beforeRecords.set(exercise.id, previousBest(exercise.id));

  const completedAt = new Date().toISOString();
  const durationMinutes = Math.max(1, Math.round((new Date(completedAt) - new Date(workout.startedAt)) / 60000));
  const entry = {
    ...workout,
    phase: 'complete',
    completedAt,
    durationMinutes,
    completedSets: count,
    totalVolume: volume(workout.exercises),
    newPRs: [],
  };

  for (const exercise of entry.exercises) {
    const oldBest = beforeRecords.get(exercise.id);
    let sessionBest = null;
    for (const set of exercise.sets) {
      if (!set.completed) continue;
      const candidate = { weight: num(set.weight), reps: num(set.reps) };
      if (!sessionBest || candidate.weight > sessionBest.weight || (candidate.weight === sessionBest.weight && candidate.reps > sessionBest.reps)) {
        sessionBest = candidate;
      }
    }
    if (sessionBest && (!oldBest || sessionBest.weight > oldBest.weight || (sessionBest.weight === oldBest.weight && sessionBest.reps > oldBest.reps))) {
      entry.newPRs.push({ exerciseId: exercise.id, name: exercise.name, ...sessionBest });
    }
  }

  delete entry.pendingPosition;
  delete entry.restEndsAt;
  delete entry.restPausedRemaining;
  store.history.unshift(entry);
  store.history = store.history.slice(0, 100);
  store.lastSummaryId = entry.id;
  store.activeWorkout = null;
  saveStore();
  currentTab = 'summary';
  render();
}

function discardWorkout() {
  if (!store.activeWorkout) return;
  if (!confirm('Discard this workout? Current progress will be removed.')) return;
  store.activeWorkout = null;
  saveStore();
  currentTab = 'home';
  render();
}

function setTab(tab) {
  if (tab === 'summary') {
    currentTab = 'summary';
  } else {
    currentTab = tab;
  }
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function syncNav() {
  document.querySelectorAll('.nav-item').forEach(button => {
    button.classList.toggle('active', button.dataset.tab === currentTab || (currentTab === 'summary' && button.dataset.tab === 'history'));
  });
}

function syncLiveBadge() {
  const badge = document.querySelector('.nav-live');
  if (badge) badge.hidden = !store.activeWorkout;
}

function toast(message) {
  const region = document.querySelector('#toast-region') || document.body;
  region.querySelector('.toast')?.remove();
  const node = document.createElement('div');
  node.className = 'toast';
  node.textContent = message;
  region.append(node);
  setTimeout(() => node.remove(), 2200);
}

function renderHome() {
  const week = weeklyHistory();
  const weeklyVolume = week.reduce((sum, entry) => sum + (entry.totalVolume || 0), 0);
  const last = store.history[0];
  const nextRoutine = routines[store.history.length % routines.length];
  return `
    <div class="page-head">
      <div>
        <p class="eyebrow">4-DAY STRENGTH PLAN</p>
        <h2 class="page-title">Train. Rest. Advance.</h2>
        <p class="page-copy">Start a workout and the guided player takes over: one set at a time, timed rest, then the next set or exercise automatically.</p>
      </div>
    </div>

    ${store.activeWorkout ? `
      <button class="resume-card" type="button" data-action="resume">
        <div class="resume-dot"></div>
        <div><span>WORKOUT IN PROGRESS</span><strong>${esc(store.activeWorkout.routineName)} · ${store.activeWorkout.phase === 'rest' ? 'Resting' : 'Set in progress'}</strong></div>
        <div class="resume-arrow">→</div>
      </button>` : ''}

    <div class="hero">
      <section class="hero-primary">
        <p class="eyebrow">THIS WEEK</p>
        <div class="hero-metrics">
          <div class="hero-metric"><span class="hero-number">${week.length}</span><span class="hero-label">workouts complete</span></div>
          <div class="hero-divider"></div>
          <div class="hero-metric"><span class="hero-number">${formatVolume(weeklyVolume)}</span><span class="hero-label">training volume</span></div>
        </div>
      </section>
      <section class="hero-secondary">
        <div><p class="eyebrow">NEXT IN ROTATION</p><h3>${esc(nextRoutine.name)}</h3><p>${esc(nextRoutine.focus)} · ${nextRoutine.duration} minutes · ${nextRoutine.exercises.length} exercises</p></div>
        <button class="button" type="button" data-start="${nextRoutine.id}" ${store.activeWorkout ? 'disabled' : ''}>START GUIDED WORKOUT</button>
      </section>
    </div>

    <section class="section">
      <div class="section-head"><div><p class="eyebrow">YOUR PLAN</p><h2>Choose a workout</h2></div><span class="section-meta">4 sessions · about 45 min each</span></div>
      <div class="routine-grid">
        ${routines.map((routine, index) => `
          <article class="routine-card">
            <div class="routine-top"><span class="routine-number">0${index + 1}</span><span class="routine-time">${routine.duration} MIN</span></div>
            <h3>${esc(routine.name)}</h3>
            <div class="routine-focus">${esc(routine.focus)}</div>
            <div class="routine-plan">
              ${routine.exercises.map(ex => `<div class="plan-row"><strong>${esc(ex.name)}</strong><span>${ex.sets} × ${esc(ex.reps)}</span></div>`).join('')}
            </div>
            <div class="routine-footer">
              <span class="routine-meta">Timed rest: 60–90 sec</span>
              <button class="button" type="button" data-start="${routine.id}" ${store.activeWorkout ? 'disabled' : ''}>START</button>
            </div>
          </article>`).join('')}
      </div>
    </section>

    <section class="section">
      <div class="section-head"><div><p class="eyebrow">RECENT</p><h2>Last session</h2></div></div>
      ${last ? `
        <article class="history-card">
          <div class="history-top"><div><h3>${esc(last.routineName)}</h3><div class="history-date">${formatDate(last.completedAt)}</div></div><div class="history-volume">${formatVolume(last.totalVolume || 0)}</div></div>
          <div class="history-stats"><span>${last.completedSets} sets</span><span>•</span><span>${last.durationMinutes} min</span>${last.newPRs?.length ? `<span>•</span><span>${last.newPRs.length} PR${last.newPRs.length === 1 ? '' : 's'}</span>` : ''}</div>
        </article>` : renderEmpty('No sessions yet', 'Finish your first guided workout and it will land here automatically.')}
    </section>`;
}

function renderWorkout() {
  const pos = getActivePosition();
  if (!pos) {
    return `<div class="page-head"><div><p class="eyebrow">GUIDED WORKOUT</p><h2 class="page-title">No active session</h2><p class="page-copy">Choose a routine from your plan to start the guided player.</p></div><button class="button" type="button" data-action="home">CHOOSE WORKOUT</button></div>`;
  }
  const done = completedSets(pos.workout.exercises);
  const total = totalSets(pos.workout.exercises);
  const pct = Math.round((done / Math.max(1, total)) * 100);
  const pips = pos.workout.exercises.map((_, index) => `<span class="step-pip ${index < pos.ei ? 'done' : index === pos.ei ? 'current' : ''}"></span>`).join('');
  return `
    <div class="guided-shell">
      <div class="session-status">
        <div class="session-title">
          <p class="eyebrow">ACTIVE WORKOUT</p>
          <h2>${esc(pos.workout.routineName)}</h2>
          <div class="session-meta"><span>${done}/${total} sets complete</span><span>${Math.round(pct)}%</span><span>Exercise ${pos.ei + 1} of ${pos.workout.exercises.length}</span></div>
        </div>
        <div class="elapsed"><span>ELAPSED</span><strong id="elapsed-clock">${formatClock(workoutElapsedSeconds(pos.workout))}</strong></div>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="step-strip" aria-label="Exercise progress">${pips}</div>

      <section class="exercise-stage">
        ${pos.workout.phase === 'rest' ? renderRest(pos) : renderWorkSet(pos)}
      </section>

      <div class="session-controls">
        <button class="button ghost" type="button" data-action="home">LEAVE & RESUME LATER</button>
        <button class="button danger" type="button" data-action="finish">FINISH EARLY</button>
        <button class="button danger" type="button" data-action="discard">DISCARD</button>
      </div>
    </div>`;
}

function renderWorkSet(pos) {
  const next = nextPosition(pos.workout, pos.ei, pos.si);
  const completedChips = pos.exercise.sets.map((set, index) => {
    if (index >= pos.si) return '';
    const label = set.completed ? `${set.weight ? `${esc(set.weight)} lb · ` : ''}${esc(set.reps)} ${pos.exercise.reps.includes('sec') ? 'sec' : 'reps'}` : 'Skipped';
    return `<span class="set-chip ${set.completed ? 'done' : ''}">Set ${index + 1}: ${label}</span>`;
  }).join('');
  const nextLabel = next ? (next.type === 'set' ? `Set ${next.si + 1} of ${pos.exercise.sets.length}` : pos.workout.exercises[next.ei].name) : 'Workout complete';
  const isTimed = pos.exercise.reps.includes('sec');
  const prior = previousBest(pos.exercise.id);

  let defaultWeight = pos.set.weight;
  let defaultReps = pos.set.reps;
  const priorSet = pos.exercise.sets[pos.si - 1];
  if (!defaultWeight && priorSet?.completed) defaultWeight = priorSet.weight;
  if (!defaultReps && priorSet?.completed) defaultReps = priorSet.reps;
  if (!defaultWeight && prior) defaultWeight = prior.weight ? String(prior.weight) : '';

  return `
    <div class="exercise-hero">
      <div class="exercise-kicker"><span class="current-label">CURRENT EXERCISE</span><span>EXERCISE ${pos.ei + 1}/${pos.workout.exercises.length}</span></div>
      <h3>${esc(pos.exercise.name)}</h3>
      <p class="exercise-target">${pos.exercise.targetSets} working sets · target ${esc(pos.exercise.reps)} · ${pos.exercise.rest}s rest</p>
      <div class="exercise-best"><span>Previous best</span><strong>${esc(bestLabel(pos.exercise.id))}</strong></div>
    </div>
    <div class="set-panel">
      <div class="set-heading"><h4>Set ${pos.si + 1} of ${pos.exercise.sets.length}</h4><span>Log it, then rest timer starts</span></div>
      <div class="input-grid">
        <div class="field">
          <label for="set-weight">WEIGHT (LB) ${isTimed ? '· OPTIONAL' : ''}</label>
          <input id="set-weight" inputmode="decimal" autocomplete="off" placeholder="${isTimed ? 'Bodyweight' : '0'}" value="${esc(defaultWeight)}" />
        </div>
        <div class="field">
          <label for="set-reps">${isTimed ? 'SECONDS' : 'REPS'}</label>
          <input id="set-reps" inputmode="numeric" autocomplete="off" placeholder="${isTimed ? '45' : '0'}" value="${esc(defaultReps)}" />
        </div>
      </div>
      ${completedChips ? `<div class="set-history">${completedChips}</div>` : ''}
      <button class="button primary-action" type="button" data-action="complete-set">COMPLETE SET ${pos.si + 1}</button>
      <div class="next-preview"><div><span>UP NEXT</span><strong>${esc(nextLabel)}</strong></div><div class="next-arrow">→</div></div>
    </div>`;
}

function renderRest(pos) {
  const remaining = restRemaining(pos.workout);
  const next = pos.workout.pendingPosition;
  const nextExercise = next ? pos.workout.exercises[next.ei] : null;
  const nextSet = next ? next.si + 1 : null;
  const changingExercise = next && next.ei !== pos.ei;
  const paused = Number.isFinite(pos.workout.restPausedRemaining);
  return `
    <div class="rest-stage">
      <div class="rest-label">${changingExercise ? 'EXERCISE COMPLETE · TRANSITION' : 'REST TIMER'}</div>
      <div class="timer-wrap" id="timer-ring" style="--timer-progress:${restProgress(pos.workout)}%">
        <div>
          <div class="timer-value" id="rest-clock">${formatClock(remaining)}</div>
          <div class="timer-sub">${paused ? 'PAUSED' : 'UNTIL NEXT SET'}</div>
        </div>
      </div>
      <h3>${changingExercise ? 'Reset for the next exercise' : 'Recover, then go again'}</h3>
      <p>${changingExercise ? 'The player will move to the next exercise automatically when the timer reaches zero.' : 'Stay ready. Your next set opens automatically when rest is over.'}</p>
      <div class="timer-actions">
        <button class="button secondary" type="button" data-action="add-rest">+15 SEC</button>
        <button class="button secondary" type="button" data-action="pause-rest">${paused ? 'RESUME' : 'PAUSE'}</button>
        <button class="button" type="button" data-action="skip-rest">SKIP REST</button>
      </div>
      ${nextExercise ? `
        <div class="up-next-card">
          <div class="up-next-number">${String(next.ei + 1).padStart(2, '0')}</div>
          <div><span>UP NEXT</span><strong>${esc(nextExercise.name)}</strong></div>
          <em>Set ${nextSet}/${nextExercise.sets.length}</em>
        </div>` : ''}
    </div>`;
}

function renderHistory() {
  return `
    <div class="page-head"><div><p class="eyebrow">TRAINING LOG</p><h2 class="page-title">History</h2><p class="page-copy">Completed workouts are stored on this browser and feed your progress and PRs.</p></div></div>
    <div class="history-list">
      ${store.history.length ? store.history.map(entry => `
        <article class="history-card">
          <div class="history-top"><div><h3>${esc(entry.routineName)}</h3><div class="history-date">${formatDate(entry.completedAt)}</div></div><div class="history-volume">${formatVolume(entry.totalVolume || 0)}</div></div>
          <div class="history-stats"><span>${entry.completedSets} sets</span><span>•</span><span>${entry.durationMinutes} min</span>${entry.newPRs?.length ? `<span>•</span><span>${entry.newPRs.length} PR${entry.newPRs.length === 1 ? '' : 's'}</span>` : ''}</div>
        </article>`).join('') : renderEmpty('No workout history', 'Your completed guided workouts will appear here.')}
    </div>`;
}

function renderProgress() {
  const week = weeklyHistory();
  const allVolume = store.history.reduce((sum, entry) => sum + (entry.totalVolume || 0), 0);
  const prs = personalRecords().slice(0, 12);
  const totalWorkouts = store.history.length;
  return `
    <div class="page-head"><div><p class="eyebrow">PROGRESS</p><h2 class="page-title">Your numbers</h2><p class="page-copy">Simple signals that show whether the training is stacking up.</p></div></div>
    <div class="progress-grid">
      <section class="panel"><h3>This week</h3><div class="big-stat">${week.length}/4</div><div class="stat-label">workouts completed</div></section>
      <section class="panel"><h3>All-time volume</h3><div class="big-stat">${formatVolume(allVolume)}</div><div class="stat-label">logged training volume</div></section>
      <section class="panel"><h3>Total sessions</h3><div class="big-stat">${totalWorkouts}</div><div class="stat-label">completed workouts</div></section>
      <section class="panel"><h3>Personal records</h3>${prs.length ? `<div class="pr-list">${prs.map(pr => `<div class="pr-row"><span>${esc(pr.name)}</span><strong>${pr.id === 'plank' ? `${pr.reps} sec` : `${pr.weight} lb × ${pr.reps}`}</strong></div>`).join('')}</div>` : `<div class="stat-label">Complete workouts to establish your first PRs.</div>`}</section>
    </div>`;
}

function renderSummary() {
  const entry = store.history.find(item => item.id === store.lastSummaryId) || store.history[0];
  if (!entry) return renderHistory();
  return `
    <div class="summary-hero">
      <div class="summary-check">✓</div>
      <p class="eyebrow">WORKOUT COMPLETE</p>
      <h2>${esc(entry.routineName)} done.</h2>
      <p>${entry.completedSets} sets logged across ${entry.exercises.filter(ex => ex.sets.some(set => set.completed)).length} exercises. Your history and progress are already updated.</p>
      <div class="summary-grid">
        <div class="summary-card"><strong>${entry.durationMinutes}</strong><span>Minutes</span></div>
        <div class="summary-card"><strong>${entry.completedSets}</strong><span>Sets</span></div>
        <div class="summary-card"><strong>${formatVolume(entry.totalVolume || 0)}</strong><span>Volume</span></div>
      </div>
      ${entry.newPRs?.length ? `
        <section class="panel summary-prs">
          <p class="eyebrow">NEW PERSONAL RECORD${entry.newPRs.length === 1 ? '' : 'S'}</p>
          <div class="pr-list">${entry.newPRs.map(pr => `<div class="pr-row"><span>${esc(pr.name)}</span><strong>${pr.exerciseId === 'plank' ? `${pr.reps} sec` : `${pr.weight} lb × ${pr.reps}`}</strong></div>`).join('')}</div>
        </section>` : ''}
      <div class="summary-actions">
        <button class="button" type="button" data-action="home">BACK TO PLAN</button>
        <button class="button secondary" type="button" data-action="history">VIEW HISTORY</button>
      </div>
    </div>`;
}

function renderEmpty(title, copy) {
  return `<div class="empty-state"><div class="empty-glyph">W/</div><h2>${esc(title)}</h2><p>${esc(copy)}</p></div>`;
}

function render() {
  const app = document.querySelector('#app');
  if (!app) return;
  if (currentTab === 'home') app.innerHTML = renderHome();
  else if (currentTab === 'workout') app.innerHTML = renderWorkout();
  else if (currentTab === 'history') app.innerHTML = renderHistory();
  else if (currentTab === 'progress') app.innerHTML = renderProgress();
  else if (currentTab === 'summary') app.innerHTML = renderSummary();
  else app.innerHTML = renderHome();
  syncNav();
  syncLiveBadge();
  updateTimers();
}

function updateTimers() {
  const workout = store.activeWorkout;
  const elapsedNode = document.querySelector('#elapsed-clock');
  if (workout && elapsedNode) elapsedNode.textContent = formatClock(workoutElapsedSeconds(workout));

  if (!workout || workout.phase !== 'rest') return;
  const remaining = restRemaining(workout);
  const clock = document.querySelector('#rest-clock');
  const ring = document.querySelector('#timer-ring');
  if (clock) clock.textContent = formatClock(remaining);
  if (ring) ring.style.setProperty('--timer-progress', `${restProgress(workout)}%`);

  if (remaining <= 0 && !Number.isFinite(workout.restPausedRemaining)) {
    advanceAfterRest();
  }
}

function handleClick(event) {
  const tab = event.target.closest('[data-tab]');
  if (tab) {
    setTab(tab.dataset.tab);
    return;
  }

  const start = event.target.closest('[data-start]');
  if (start) {
    startWorkout(start.dataset.start);
    return;
  }

  const actionNode = event.target.closest('[data-action]');
  if (!actionNode) return;
  const action = actionNode.dataset.action;
  if (action === 'go-home' || action === 'home') setTab('home');
  else if (action === 'history') setTab('history');
  else if (action === 'resume') setTab('workout');
  else if (action === 'complete-set') completeCurrentSet();
  else if (action === 'add-rest') adjustRest(15);
  else if (action === 'pause-rest') toggleRestPause();
  else if (action === 'skip-rest') skipRest();
  else if (action === 'finish') finishWorkout(false);
  else if (action === 'discard') discardWorkout();
}

document.addEventListener('click', handleClick);
document.addEventListener('keydown', event => {
  if (event.key === 'Enter' && currentTab === 'workout' && store.activeWorkout?.phase === 'work') {
    const active = document.activeElement;
    if (active?.tagName === 'INPUT') {
      event.preventDefault();
      completeCurrentSet();
    }
  }
});

tickHandle = window.setInterval(updateTimers, 500);
window.addEventListener('beforeunload', () => {
  if (tickHandle) window.clearInterval(tickHandle);
});

render();
