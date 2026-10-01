(() => {
  const STATE_KEY = 'goworkout.performance.v1';
  const PERIODS = {
    week: { label: 'This week', days: 7 },
    month: { label: '4 weeks', days: 28 },
    quarter: { label: '3 months', days: 90 },
    all: { label: 'All time', days: Infinity }
  };

  function readState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
      return saved && typeof saved === 'object' ? saved : {};
    } catch {
      return {};
    }
  }

  const saved = readState();
  let performancePeriod = PERIODS[saved.period] ? saved.period : 'month';
  let performanceView = ['home', 'exercises', 'records', 'intelligence'].includes(saved.view) ? saved.view : 'home';
  let performanceTrendMetric = ['strength', 'volume', 'workouts'].includes(saved.trendMetric) ? saved.trendMetric : 'strength';
  let performancePointIndex = Number.isFinite(Number(saved.pointIndex)) ? Number(saved.pointIndex) : -1;
  let performanceExerciseFilter = ['all', 'improving', 'records', 'recent'].includes(saved.exerciseFilter) ? saved.exerciseFilter : 'all';

  function saveState() {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify({
        period: performancePeriod,
        view: performanceView,
        trendMetric: performanceTrendMetric,
        pointIndex: performancePointIndex,
        exerciseFilter: performanceExerciseFilter
      }));
    } catch {}
  }

  function orderedHistory(desc = true) {
    return [...(store.history || [])].sort((a, b) => {
      const delta = Date.parse(b.completedAt || '') - Date.parse(a.completedAt || '');
      return desc ? delta : -delta;
    });
  }

  function periodCutoff(period = performancePeriod) {
    const config = PERIODS[period] || PERIODS.month;
    if (!Number.isFinite(config.days)) return null;
    return Date.now() - config.days * 86400000;
  }

  function inPeriod(date, period = performancePeriod) {
    const cutoff = periodCutoff(period);
    if (cutoff === null) return true;
    const time = Date.parse(date || '');
    return Number.isFinite(time) && time >= cutoff;
  }

  function periodHistory(period = performancePeriod) {
    return orderedHistory(true).filter(item => inPeriod(item.completedAt, period));
  }

  function sessionBest(exercise) {
    let best = null;
    for (const set of exercise?.sets || []) {
      if (!set.completed) continue;
      const current = { weight: num(set.weight), reps: num(set.reps) };
      if (!best || current.weight > best.weight || (current.weight === best.weight && current.reps > best.reps)) best = current;
    }
    return best;
  }

  function periodExerciseSummary(exerciseId, period = performancePeriod) {
    const series = exerciseProgressSeries(exerciseId).filter(item => inPeriod(item.date, period));
    if (!series.length) return null;
    const ex = catalog.find(item => item.id === exerciseId) ||
      (store.history || []).flatMap(item => item.exercises || []).find(item => item.id === exerciseId) || null;
    const first = series[0];
    const latest = series[series.length - 1];
    let best = series[0];
    for (const session of series) {
      if (session.bestWeight > best.bestWeight || (session.bestWeight === best.bestWeight && session.bestReps > best.bestReps)) best = session;
    }
    const weighted = series.some(item => item.bestWeight > 0);
    const loadDelta = weighted ? latest.bestWeight - first.bestWeight : 0;
    const repDelta = latest.bestReps - first.bestReps;
    const improved = weighted
      ? latest.bestWeight > first.bestWeight || (latest.bestWeight === first.bestWeight && latest.bestReps > first.bestReps)
      : latest.bestReps > first.bestReps;
    const relativeChange = weighted && first.bestWeight > 0 ? ((latest.bestWeight - first.bestWeight) / first.bestWeight) * 100 : repDelta;
    return {
      exerciseId,
      name: ex?.name || exerciseId,
      loadMode: ex?.loadMode || '',
      series,
      first,
      latest,
      best,
      weighted,
      sessions: series.length,
      baselineLabel: weighted ? first.bestWeight + ' lb × ' + first.bestReps : first.bestReps + (ex?.loadMode === 'timed' ? ' sec' : ' reps'),
      bestLabel: weighted ? best.bestWeight + ' lb × ' + best.bestReps : best.bestReps + (ex?.loadMode === 'timed' ? ' sec' : ' reps'),
      changeLabel: weighted
        ? (loadDelta > 0 ? '+' + Math.round(loadDelta * 10) / 10 + ' lb in this period' : repDelta > 0 ? '+' + repDelta + ' reps at the same load' : 'Holding steady')
        : (repDelta > 0 ? '+' + repDelta + (ex?.loadMode === 'timed' ? ' sec' : ' reps') + ' in this period' : 'Holding steady'),
      status: series.length === 1 ? 'baseline' : (improved ? 'improved' : 'steady'),
      relativeChange
    };
  }

  function movementSummaries(period = performancePeriod) {
    const ids = new Set();
    for (const workout of periodHistory(period)) {
      for (const ex of workout.exercises || []) {
        if ((ex.sets || []).some(set => set.completed)) ids.add(ex.id);
      }
    }
    return [...ids].map(id => periodExerciseSummary(id, period)).filter(Boolean);
  }

  function strengthChange(summaries) {
    const changes = summaries
      .filter(item => item.weighted && item.series.length >= 2 && item.first.bestWeight > 0)
      .map(item => ((item.latest.bestWeight - item.first.bestWeight) / item.first.bestWeight) * 100);
    if (!changes.length) return null;
    return changes.reduce((sum, value) => sum + value, 0) / changes.length;
  }

  function volumeChange(history) {
    const ordered = [...history].reverse();
    if (ordered.length < 2) return null;
    const split = Math.max(1, Math.floor(ordered.length / 2));
    const first = ordered.slice(0, split);
    const second = ordered.slice(split);
    if (!second.length) return null;
    const avg = list => list.reduce((sum, item) => sum + num(item.totalVolume), 0) / Math.max(1, list.length);
    const before = avg(first);
    const after = avg(second);
    if (!before) return null;
    return ((after - before) / before) * 100;
  }

  function recordEventsForPeriod(period = performancePeriod) {
    return progressRecordEvents().filter(event => inPeriod(event.date, period));
  }

  function latestWorkoutChanges() {
    const latest = orderedHistory(true)[0];
    if (!latest) return { workout: null, changes: [] };
    const classified = workoutRecordClassification(latest);
    const prIds = new Set((classified.prs || []).map(item => item.exerciseId));
    const baselineIds = new Set((classified.baselines || []).map(item => item.exerciseId));
    const changes = [];

    for (const ex of latest.exercises || []) {
      const best = sessionBest(ex);
      if (!best) continue;
      const series = exerciseProgressSeries(ex.id);
      const index = series.findIndex(item => item.workoutId === latest.id);
      const prior = index > 0 ? series[index - 1] : null;
      const value = best.weight ? best.weight + ' lb × ' + best.reps : best.reps + (ex.loadMode === 'timed' ? ' sec' : ' reps');

      if (prIds.has(ex.id)) {
        let delta = '';
        if (prior) {
          if (best.weight > prior.bestWeight) delta = '+' + Math.round((best.weight - prior.bestWeight) * 10) / 10 + ' lb';
          else if (best.reps > prior.bestReps) delta = '+' + (best.reps - prior.bestReps) + ' reps';
        }
        changes.push({ type: 'pr', exerciseId: ex.id, name: ex.name, value, delta, label: 'NEW BEST' });
        continue;
      }

      if (baselineIds.has(ex.id) || !prior) {
        changes.push({ type: 'baseline', exerciseId: ex.id, name: ex.name, value, delta: '', label: 'FIRST MARKER' });
        continue;
      }

      if (best.weight > prior.bestWeight || (best.weight === prior.bestWeight && best.reps > prior.bestReps)) {
        const delta = best.weight > prior.bestWeight
          ? '+' + Math.round((best.weight - prior.bestWeight) * 10) / 10 + ' lb'
          : '+' + (best.reps - prior.bestReps) + ' reps';
        changes.push({ type: 'improved', exerciseId: ex.id, name: ex.name, value, delta, label: 'MOVED FORWARD' });
      }
    }

    changes.sort((a, b) => {
      const order = { pr: 0, improved: 1, baseline: 2 };
      return order[a.type] - order[b.type];
    });
    return { workout: latest, changes };
  }

  function headlineState(summaries) {
    const history = orderedHistory(true);
    if (!history.length) {
      return {
        title: 'Your training story starts here.',
        copy: 'Your first workouts establish the baseline GoWorkout will use to show how your strength changes over time.'
      };
    }
    if (history.length === 1) {
      return {
        title: 'Your baseline is taking shape.',
        copy: 'One session is logged. Repeat a few movements and GoWorkout can start showing meaningful change.'
      };
    }
    const improving = summaries.filter(item => item.status === 'improved').length;
    if (improving >= 4) {
      return {
        title: 'Your work is showing.',
        copy: improving + ' movements improved during ' + PERIODS[performancePeriod].label.toLowerCase() + '.'
      };
    }
    if (improving > 0) {
      return {
        title: 'You’re moving forward.',
        copy: improving + ' movement' + (improving === 1 ? ' is' : 's are') + ' ahead of where this period started.'
      };
    }
    return {
      title: 'You’re building something steady.',
      copy: 'Your recent working numbers are holding. GoWorkout will keep watching for the next clear change.'
    };
  }

  function latestWorkoutStory() {
    const result = latestWorkoutChanges();
    if (!result.workout) return null;
    const prs = result.changes.filter(item => item.type === 'pr').length;
    const improved = result.changes.filter(item => item.type === 'improved').length;
    const baselines = result.changes.filter(item => item.type === 'baseline').length;
    if (prs) return { ...result, title: 'Progress showed up.', copy: prs + ' new best' + (prs === 1 ? '' : 's') + ' came out of your last session.' };
    if (improved) return { ...result, title: 'Something moved.', copy: improved + ' movement' + (improved === 1 ? ' finished' : 's finished') + ' ahead of your previous session.' };
    if (baselines) return { ...result, title: 'Your baseline got clearer.', copy: baselines + ' movement' + (baselines === 1 ? ' now has' : 's now have') + ' a first recorded marker.' };
    return { ...result, title: 'Another session is in the books.', copy: 'Your working numbers held steady this time. The session still adds useful history.' };
  }

  function globalStrengthTrend() {
    const all = orderedHistory(false);
    const baselines = new Map();
    const bests = new Map();
    const points = [];
    for (const workout of all) {
      for (const ex of workout.exercises || []) {
        const best = sessionBest(ex);
        if (!best || !best.weight) continue;
        if (!baselines.has(ex.id)) baselines.set(ex.id, best.weight);
        bests.set(ex.id, Math.max(num(bests.get(ex.id)), best.weight));
      }
      const ratios = [...bests.entries()]
        .map(([id, best]) => {
          const baseline = num(baselines.get(id));
          return baseline > 0 ? best / baseline : null;
        })
        .filter(value => value !== null);
      if (!ratios.length) continue;
      const score = ratios.reduce((sum, value) => sum + value, 0) / ratios.length * 100;
      points.push({ date: workout.completedAt, value: score, workout });
    }
    return points.filter(point => inPeriod(point.date));
  }

  function trendPoints(metric = performanceTrendMetric) {
    const history = [...periodHistory()].reverse();
    if (metric === 'strength') return globalStrengthTrend();
    if (metric === 'volume') return history.map(item => ({ date: item.completedAt, value: num(item.totalVolume), workout: item }));
    let count = 0;
    return history.map(item => ({ date: item.completedAt, value: ++count, workout: item }));
  }

  function trendValueLabel(value, metric) {
    if (metric === 'strength') return Math.round(value * 10) / 10 + ' strength index';
    if (metric === 'volume') return formatVolume(value);
    return Math.round(value) + ' workout' + (Math.round(value) === 1 ? '' : 's');
  }

  function renderTrendChart(metric = performanceTrendMetric) {
    const points = trendPoints(metric);
    if (!points.length) {
      return '<div class="perf-chart-empty"><strong>Your chart starts with logged training.</strong><span>Complete workouts to build a visible trend.</span></div>';
    }

    const width = 360;
    const height = 154;
    const left = 16;
    const right = width - 16;
    const top = 16;
    const bottom = height - 24;
    const values = points.map(point => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(1, max - min);
    const plot = points.map((point, index) => ({
      ...point,
      x: points.length === 1 ? (left + right) / 2 : left + (right - left) * (index / (points.length - 1)),
      y: bottom - ((point.value - min) / range) * (bottom - top),
      index
    }));
    const path = plot.map((point, index) => (index ? 'L' : 'M') + point.x.toFixed(1) + ' ' + point.y.toFixed(1)).join(' ');
    const selectedIndex = performancePointIndex >= 0 && performancePointIndex < plot.length ? performancePointIndex : plot.length - 1;
    const selected = plot[selectedIndex];
    const first = plot[0];
    const delta = selected.value - first.value;
    const deltaLabel = metric === 'strength'
      ? ((delta >= 0 ? '+' : '') + (Math.round(delta * 10) / 10) + ' pts from the first visible session')
      : metric === 'volume'
        ? 'Session volume on ' + formatDate(selected.date)
        : 'Completed in this period';

    return '<div class="perf-chart-wrap">' +
      '<svg class="perf-chart" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="' + esc(metric === 'strength' ? 'Strength trend' : metric === 'volume' ? 'Training volume trend' : 'Workout count trend') + '">' +
        '<line class="perf-chart-grid" x1="' + left + '" y1="' + top + '" x2="' + right + '" y2="' + top + '"></line>' +
        '<line class="perf-chart-grid" x1="' + left + '" y1="' + ((top + bottom) / 2) + '" x2="' + right + '" y2="' + ((top + bottom) / 2) + '"></line>' +
        '<line class="perf-chart-grid" x1="' + left + '" y1="' + bottom + '" x2="' + right + '" y2="' + bottom + '"></line>' +
        '<path class="perf-chart-line" d="' + path + '"></path>' +
        plot.map(point => '<circle class="perf-chart-dot ' + (point.index === selectedIndex ? 'selected' : '') + '" cx="' + point.x.toFixed(1) + '" cy="' + point.y.toFixed(1) + '" r="' + (point.index === selectedIndex ? '5' : '3.5') + '" tabindex="0" role="button" data-action="performance-chart-point" data-performance-point="' + point.index + '" aria-label="' + esc(formatDate(point.date) + ', ' + trendValueLabel(point.value, metric)) + '"></circle>').join('') +
      '</svg>' +
      '<div class="perf-chart-axis"><span>' + esc(formatDate(plot[0].date)) + '</span><span>' + esc(formatDate(plot[plot.length - 1].date)) + '</span></div>' +
      '<div class="perf-chart-readout"><span>' + esc(formatDate(selected.date)) + '</span><strong>' + esc(trendValueLabel(selected.value, metric)) + '</strong><small>' + esc(deltaLabel) + '</small></div>' +
    '</div>';
  }

  function coachInsight() {
    const learner = ensureTrainingLearner();
    const models = Object.values(learner?.models || {});
    const ranked = models
      .map(model => ({ model, gate: learnerGateLabel(model) }))
      .sort((a, b) => {
        const order = { influence: 0, suggest: 1, observe: 2 };
        return (order[a.gate.level] ?? 3) - (order[b.gate.level] ?? 3) ||
          (b.model.confidence?.score || 0) - (a.model.confidence?.score || 0);
      });

    const candidate = ranked.find(item => ['influence', 'suggest'].includes(item.gate.level)) || ranked[0] || null;
    if (!candidate) {
      return {
        title: 'GoWorkout is getting to know how you train.',
        copy: 'Complete repeated movements and the app will start separating normal variation from changes worth acting on.',
        detail: 'No movement has enough training history for a recommendation yet.',
        exerciseId: ''
      };
    }

    const model = candidate.model;
    const next = learnerNextTarget(model.exerciseId);
    if (['influence', 'suggest'].includes(candidate.gate.level) && next) {
      return {
        title: 'You may be ready for a change.',
        copy: model.exerciseName + ' has enough evidence for GoWorkout to surface a next target.',
        detail: next + ' · based on ' + num(model.exposures) + ' completed exposure' + (num(model.exposures) === 1 ? '' : 's') + '.',
        exerciseId: model.exerciseId
      };
    }

    return {
      title: 'GoWorkout is learning your normal.',
      copy: model.exerciseName + ' currently has the clearest training history.',
      detail: num(model.exposures) + ' completed exposure' + (num(model.exposures) === 1 ? '' : 's') + ' are informing the model.',
      exerciseId: model.exerciseId
    };
  }

  function milestone() {
    const count = (store.history || []).length;
    const thresholds = [100, 50, 25, 10, 5];
    const reached = thresholds.find(value => count >= value);
    if (reached) {
      const copy = reached === 100 ? 'One hundred sessions are now part of your training history.'
        : reached === 50 ? 'Fifty sessions. This has become part of how you train.'
        : reached === 25 ? 'Twenty-five workouts. You’ve built real history here.'
        : reached === 10 ? 'Double digits. Ten sessions are now part of your story.'
        : 'Five workouts. Your training history is taking shape.';
      return { label: reached + ' WORKOUTS', title: copy, value: reached };
    }

    const prs = progressRecordEvents().filter(item => item.type === 'pr');
    if (prs.length) return { label: 'FIRST RECORDED BEST', title: 'There it is. Your training history has a first personal best.', value: 1 };
    return null;
  }

  function renderPeriodTabs() {
    return '<div class="perf-period-tabs" role="tablist" aria-label="Performance period">' +
      Object.entries(PERIODS).map(([key, config]) =>
        '<button role="tab" aria-selected="' + (performancePeriod === key ? 'true' : 'false') + '" class="' + (performancePeriod === key ? 'active' : '') + '" data-action="set-performance-period" data-performance-period="' + key + '">' + esc(config.label) + '</button>'
      ).join('') +
    '</div>';
  }

  function renderEmptyPerformance() {
    return '<div class="performance-v2">' +
      '<header class="perf-hero empty"><p class="eyebrow">PERFORMANCE</p><h2>Your training story starts here.</h2><p>Your first workouts establish the baseline GoWorkout will use to show how your strength changes over time.</p></header>' +
      '<section class="perf-empty-state"><span>YOUR BASELINE</span><strong>Nothing to compare yet</strong><p>Complete workouts to begin tracking strength, training volume, records, and consistency.</p><button class="button" data-action="train">START YOUR FIRST WORKOUT</button></section>' +
    '</div>';
  }

  function renderLastWorkoutSection() {
    const story = latestWorkoutStory();
    if (!story) return '';
    const visible = story.changes.slice(0, 4);
    return '<section class="perf-section perf-last-workout">' +
      '<div class="perf-section-head"><div><p class="eyebrow">SINCE YOUR LAST WORKOUT</p><h3>' + esc(story.title) + '</h3><p>' + esc(story.copy) + '</p></div><span class="perf-section-date">' + esc(formatDate(story.workout.completedAt)) + '</span></div>' +
      (visible.length
        ? '<div class="perf-change-grid">' + visible.map(item =>
            '<button class="perf-change-card ' + item.type + '" data-action="progress-exercise" data-progress-exercise="' + esc(item.exerciseId) + '">' +
              '<span>' + esc(item.label) + '</span><strong>' + esc(item.name) + '</strong><b>' + esc(item.value) + '</b>' +
              (item.delta ? '<small>' + esc(item.delta) + '</small>' : '<small>Now part of your baseline</small>') +
            '</button>'
          ).join('') + '</div>'
        : '<div class="perf-steady-note"><strong>Your numbers held steady.</strong><span>The session still adds useful evidence for future recommendations.</span></div>') +
    '</section>';
  }

  function renderScorecard(history, summaries, records) {
    const strength = strengthChange(summaries);
    const volumeDelta = volumeChange(history);
    return '<section class="perf-section">' +
      '<div class="perf-section-head"><div><p class="eyebrow">YOUR TRAINING STORY</p><h3>' + esc(PERIODS[performancePeriod].label) + '</h3></div></div>' +
      '<div class="perf-scorecard">' +
        '<div><span>STRENGTH</span><strong>' + (strength === null ? 'Building' : (strength >= 0 ? '+' : '') + Math.round(strength) + '%') + '</strong><small>' + (strength === null ? 'Repeat movements to create a comparison' : 'average load change across repeated weighted movements') + '</small></div>' +
        '<div><span>TRAINING VOLUME</span><strong>' + esc(formatVolume(history.reduce((sum, item) => sum + num(item.totalVolume), 0))) + '</strong><small>' + (volumeDelta === null ? 'logged in this period' : (volumeDelta >= 0 ? '+' : '') + Math.round(volumeDelta) + '% average session change') + '</small></div>' +
        '<div><span>WORKOUTS</span><strong>' + history.length + '</strong><small>completed in this period</small></div>' +
        '<div><span>PERSONAL BESTS</span><strong>' + records.filter(item => item.type === 'pr').length + '</strong><small>after an established baseline</small></div>' +
      '</div>' +
    '</section>';
  }

  function renderTrendSection() {
    return '<section class="perf-section perf-trend-section">' +
      '<div class="perf-section-head"><div><p class="eyebrow">YOUR TRAINING TREND</p><h3>See the direction, not just the log.</h3></div></div>' +
      '<div class="perf-trend-tabs" role="tablist" aria-label="Training trend metric">' +
        [['strength', 'Strength'], ['volume', 'Volume'], ['workouts', 'Workouts']].map(([key, label]) =>
          '<button role="tab" aria-selected="' + (performanceTrendMetric === key ? 'true' : 'false') + '" class="' + (performanceTrendMetric === key ? 'active' : '') + '" data-action="set-performance-trend" data-performance-trend="' + key + '">' + label + '</button>'
        ).join('') +
      '</div>' +
      renderTrendChart() +
    '</section>';
  }

  function renderStrongestMovers(summaries) {
    const movers = summaries
      .filter(item => item.series.length >= 2)
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'improved' ? -1 : b.status === 'improved' ? 1 : 0;
        return (b.relativeChange || 0) - (a.relativeChange || 0);
      })
      .slice(0, 3);

    if (!movers.length) {
      return '<section class="perf-section"><div class="perf-section-head"><div><p class="eyebrow">MOVEMENT PROGRESS</p><h3>Your comparisons are still forming.</h3><p>Repeat a movement in another workout and it will start showing here.</p></div></div><button class="text-button" data-action="performance-exercises">VIEW EXERCISES</button></section>';
    }

    return '<section class="perf-section">' +
      '<div class="perf-section-head"><div><p class="eyebrow">YOUR STRONGEST MOVERS</p><h3>' + (movers.some(item => item.status === 'improved') ? 'These movements changed most.' : 'These movements have the clearest history.') + '</h3></div><button class="text-button" data-action="performance-exercises">VIEW ALL</button></div>' +
      '<div class="perf-mover-list">' +
        movers.map(item => {
          const metric = item.weighted ? 'weight' : 'reps';
          const narrative = item.status === 'improved'
            ? (item.weighted && item.first.bestWeight > 0 && item.latest.bestWeight >= item.first.bestWeight * 2
              ? 'You’ve more than doubled the working load shown at the start of this period.'
              : item.changeLabel + '.')
            : item.status === 'baseline' ? 'This is where the comparison starts.' : 'Your working range is holding.';
          return '<button class="perf-mover-card" data-action="progress-exercise" data-progress-exercise="' + esc(item.exerciseId) + '">' +
            '<div class="perf-mover-copy"><span>' + esc(item.status === 'improved' ? 'MOVING FORWARD' : item.status === 'baseline' ? 'BASELINE' : 'HOLDING STEADY') + '</span><strong>' + esc(item.name) + '</strong><b>' + esc(item.weighted ? item.latest.bestWeight + ' lb × ' + item.latest.bestReps : item.latest.bestReps + (item.loadMode === 'timed' ? ' sec' : ' reps')) + '</b><small>' + esc(narrative) + '</small></div>' +
            '<div class="perf-mini-chart">' + renderProgressChart(item, metric, true) + '</div>' +
          '</button>';
        }).join('') +
      '</div>' +
    '</section>';
  }

  function renderRecordsSection(records) {
    const prs = records.filter(item => item.type === 'pr').slice(0, 4);
    if (!prs.length) {
      return '<section class="perf-section perf-records-section"><div class="perf-section-head"><div><p class="eyebrow">RECORDS</p><h3>Your first best is still ahead.</h3><p>Once a movement has a baseline, a later improvement can become a recorded best.</p></div><button class="text-button" data-action="performance-records">OPEN RECORD BOOK</button></div></section>';
    }

    return '<section class="perf-section perf-records-section">' +
      '<div class="perf-section-head"><div><p class="eyebrow">RECENT RECORDS</p><h3>You gave yourself something new to chase.</h3></div><button class="text-button" data-action="performance-records">RECORD BOOK</button></div>' +
      '<div class="perf-record-carousel">' +
        prs.map((record, index) => '<button class="perf-record-card" data-action="progress-exercise" data-progress-exercise="' + esc(record.exerciseId) + '">' +
          '<span>' + (index === 0 ? 'NEW BEST' : 'PERSONAL BEST') + '</span><strong>' + esc(record.weight ? record.weight + ' LB' : record.reps + ' REPS') + '</strong><b>' + esc(record.name) + '</b><small>' + esc(record.weight ? record.reps + ' reps · ' + formatDate(record.date) : formatDate(record.date)) + '</small>' +
        '</button>').join('') +
      '</div>' +
    '</section>';
  }

  function renderCoachSection() {
    const insight = coachInsight();
    const overview = trainingLearnerOverview();
    return '<section class="perf-section perf-coach-section">' +
      '<div class="perf-coach-mark" aria-hidden="true">GO</div>' +
      '<div class="perf-coach-copy"><p class="eyebrow">COACH INSIGHTS</p><h3>' + esc(insight.title) + '</h3><p>' + esc(insight.copy) + '</p><small>' + esc(insight.detail) + '</small></div>' +
      '<div class="perf-coach-actions">' +
        (insight.exerciseId ? '<button class="button secondary compact-button" data-action="progress-exercise" data-progress-exercise="' + esc(insight.exerciseId) + '">SEE MOVEMENT</button>' : '') +
        '<button class="text-button" data-action="performance-intelligence">SEE WHAT GOWORKOUT KNOWS</button>' +
      '</div>' +
      '<div class="perf-learning-strip"><span>' + num(overview.modeledExercises) + ' movements being watched</span><span>' + num(overview.predictionsEvaluated) + ' predictions checked</span></div>' +
    '</section>';
  }

  function renderMilestoneSection() {
    const item = milestone();
    if (!item) return '';
    return '<section class="perf-milestone"><span>' + esc(item.label) + '</span><strong>' + esc(item.title) + '</strong><small>Milestones stay in your history. They do not reset when your program changes.</small></section>';
  }

  function renderTrainingHistory() {
    const history = orderedHistory(true).slice(0, 6);
    if (!history.length) return '';
    return '<section class="perf-section perf-history-section">' +
      '<div class="perf-section-head"><div><p class="eyebrow">YOUR TRAINING</p><h3>The work behind the numbers.</h3></div><button class="text-button" data-action="history">VIEW ALL</button></div>' +
      '<div class="perf-history-list">' +
        history.map(item => {
          const records = workoutRecordClassification(item);
          const recordCount = (records.prs || []).length;
          return '<button class="perf-history-row" data-action="history-details" data-history-id="' + esc(item.id) + '">' +
            '<div><span>' + esc(formatDate(item.completedAt)) + '</span><strong>' + esc(item.routineName || 'Workout') + '</strong><small>' + num(item.durationMinutes) + ' min · ' + esc(formatVolume(item.totalVolume || 0)) + (recordCount ? ' · ' + recordCount + ' new best' + (recordCount === 1 ? '' : 's') : '') + '</small></div><em>›</em>' +
          '</button>';
        }).join('') +
      '</div>' +
    '</section>';
  }

  function exerciseStory(summary) {
    const series = summary?.series || [];
    if (!series.length) return [];
    const events = [{
      label: 'STARTED HERE',
      title: summary.weighted ? series[0].bestWeight + ' lb × ' + series[0].bestReps : series[0].bestReps + (summary.loadMode === 'timed' ? ' sec' : ' reps'),
      date: series[0].date,
      copy: 'This became the first recorded marker for the movement.'
    }];

    for (let index = 1; index < series.length; index += 1) {
      const prev = series[index - 1];
      const current = series[index];
      const improved = summary.weighted
        ? current.bestWeight > prev.bestWeight || (current.bestWeight === prev.bestWeight && current.bestReps > prev.bestReps)
        : current.bestReps > prev.bestReps;
      if (!improved) continue;
      const value = summary.weighted ? current.bestWeight + ' lb × ' + current.bestReps : current.bestReps + (summary.loadMode === 'timed' ? ' sec' : ' reps');
      events.push({
        label: 'MOVED FORWARD',
        title: value,
        date: current.date,
        copy: summary.weighted && current.bestWeight > prev.bestWeight
          ? 'Working load increased from the previous logged session.'
          : 'You added reps without giving up the working load.'
      });
    }

    if (events.length > 4) return [events[0], ...events.slice(-3)];
    return events;
  }

  function renderExerciseCoach(summary) {
    const model = trainingLearnerModel(summary.exerciseId);
    if (!model) {
      return '<section class="perf-exercise-coach"><p class="eyebrow">WHAT GOWORKOUT SEES</p><h3>Still learning this movement.</h3><p>Repeat it in future workouts and GoWorkout can begin separating normal variation from a clear progression signal.</p></section>';
    }
    const gate = learnerGateLabel(model);
    const next = learnerNextTarget(summary.exerciseId);
    const title = ['suggest', 'influence'].includes(gate.level) && next ? 'This movement may be ready for more.' : 'GoWorkout is watching the pattern.';
    const copy = ['suggest', 'influence'].includes(gate.level) && next
      ? next + ' is the current next target based on ' + num(model.exposures) + ' completed exposures.'
      : num(model.exposures) + ' completed exposure' + (num(model.exposures) === 1 ? ' is' : 's are') + ' informing the model. No automatic increase is being forced.';
    return '<section class="perf-exercise-coach"><p class="eyebrow">WHAT GOWORKOUT SEES</p><h3>' + esc(title) + '</h3><p>' + esc(copy) + '</p><button class="text-button" data-action="performance-intelligence">OPEN TRAINING INTELLIGENCE</button></section>';
  }

  function renderExerciseDetail(summary) {
    const metric = progressMetric;
    const latestValue = progressMetricValue(summary.latest, metric);
    const firstValue = progressMetricValue(summary.first, metric);
    const delta = latestValue - firstValue;
    const story = exerciseStory(summary);

    return '<div class="performance-v2 perf-detail-page">' +
      '<header class="perf-detail-header"><button class="perf-back" data-action="close-progress-exercise" aria-label="Back to Performance">‹</button><div><p class="eyebrow">EXERCISE PERFORMANCE</p><h2>' + esc(summary.name) + '</h2><p>' + summary.sessions + ' logged session' + (summary.sessions === 1 ? '' : 's') + '</p></div></header>' +
      '<section class="perf-exercise-hero">' +
        '<div><span>CURRENT BEST</span><strong>' + esc(summary.bestLabel) + '</strong></div>' +
        '<div><span>STARTED AT</span><strong>' + esc(summary.baselineLabel) + '</strong></div>' +
        '<p>' + esc(summary.status === 'improved' ? 'You’ve changed what this movement looks like in your training.' : summary.status === 'baseline' ? 'This is where the comparison starts.' : 'Your working range is holding steady.') + '</p>' +
      '</section>' +
      '<section class="perf-section perf-exercise-chart-section">' +
        '<div class="perf-section-head"><div><p class="eyebrow">YOUR TREND</p><h3>' + esc(progressMetricLabel(metric)) + '</h3></div><div class="perf-detail-value"><strong>' + esc(formatProgressMetric(latestValue, metric, summary)) + '</strong><small>' + esc((delta > 0 ? '+' : '') + (metric === 'volume' ? formatVolume(delta) : Math.round(delta * 10) / 10) + (metric === 'weight' ? ' lb' : metric === 'reps' ? (summary.loadMode === 'timed' ? ' sec' : ' reps') : '') + ' from first session') + '</small></div></div>' +
        '<div class="progress-metric-tabs perf-metric-tabs" role="tablist" aria-label="Exercise progress metric">' +
          [['weight', 'Weight'], ['reps', 'Reps'], ['volume', 'Volume']].map(([value, label]) => '<button role="tab" aria-selected="' + (metric === value ? 'true' : 'false') + '" class="' + (metric === value ? 'active' : '') + '" data-action="set-progress-metric" data-progress-metric="' + value + '">' + label + '</button>').join('') +
        '</div>' +
        '<div class="perf-detail-chart">' + renderProgressChart(summary, metric, false) + '</div>' +
      '</section>' +
      (story.length ? '<section class="perf-section"><div class="perf-section-head"><div><p class="eyebrow">YOUR STORY WITH THIS MOVEMENT</p><h3>The numbers have a history.</h3></div></div><div class="perf-story-timeline">' +
        story.map(item => '<div class="perf-story-event"><i></i><div><span>' + esc(item.label) + ' · ' + esc(formatDate(item.date)) + '</span><strong>' + esc(item.title) + '</strong><p>' + esc(item.copy) + '</p></div></div>').join('') +
      '</div></section>' : '') +
      renderExerciseCoach(summary) +
      '<section class="perf-section"><div class="perf-section-head"><div><p class="eyebrow">RECENT SESSIONS</p><h3>The sets behind the trend.</h3></div></div><div class="perf-session-list">' +
        summary.series.slice(-6).reverse().map(session => '<button class="perf-session-row" data-action="history-details" data-history-id="' + esc(session.workoutId) + '"><div><span>' + esc(formatDate(session.date)) + '</span><strong>' + esc(session.routineName || 'Workout') + '</strong></div><b>' + esc(formatProgressMetric(progressMetricValue(session, metric), metric, summary)) + '</b><em>›</em></button>').join('') +
      '</div></section>' +
      '<button class="button secondary perf-form-button" data-exercise-detail="' + esc(summary.exerciseId) + '">VIEW FORM & FULL EXERCISE HISTORY</button>' +
    '</div>';
  }

  function renderExerciseDirectory() {
    const summaries = personalRecords();
    const events = progressRecordEvents();
    const recordIds = new Set(events.filter(item => item.type === 'pr').map(item => item.exerciseId));
    const recentIds = new Set();
    for (const workout of orderedHistory(true).slice(0, 3)) for (const ex of workout.exercises || []) recentIds.add(ex.id);

    const filtered = summaries.filter(item => {
      if (performanceExerciseFilter === 'improving') return item.status === 'improved';
      if (performanceExerciseFilter === 'records') return recordIds.has(item.exerciseId);
      if (performanceExerciseFilter === 'recent') return recentIds.has(item.exerciseId);
      return true;
    });

    return '<div class="performance-v2 perf-subpage">' +
      '<header class="perf-detail-header"><button class="perf-back" data-action="performance-home" aria-label="Back to Performance">‹</button><div><p class="eyebrow">EXERCISE PROGRESS</p><h2>Your movements</h2><p>Open any movement to see the history behind the number.</p></div></header>' +
      '<div class="perf-filter-row">' +
        [['all', 'All'], ['improving', 'Improving'], ['records', 'Records'], ['recent', 'Recent']].map(([key, label]) => '<button class="' + (performanceExerciseFilter === key ? 'active' : '') + '" data-action="performance-exercise-filter" data-performance-exercise-filter="' + key + '">' + label + '</button>').join('') +
      '</div>' +
      (filtered.length ? '<div class="perf-exercise-directory">' + filtered.map(item =>
        '<button class="perf-directory-row" data-action="progress-exercise" data-progress-exercise="' + esc(item.exerciseId) + '"><div><span>' + esc(item.status === 'improved' ? 'MOVING FORWARD' : item.status === 'baseline' ? 'BASELINE' : 'HOLDING STEADY') + '</span><strong>' + esc(item.name) + '</strong><small>' + esc(item.changeLabel) + '</small></div><b>' + esc(item.bestLabel) + '</b><em>›</em></button>'
      ).join('') + '</div>' : '<div class="perf-empty-inline"><strong>No movements match this filter yet.</strong><span>Your history will populate this view as you train.</span></div>') +
    '</div>';
  }

  function renderRecordBook() {
    const events = progressRecordEvents();
    const prs = events.filter(item => item.type === 'pr');
    const baselines = events.filter(item => item.type === 'baseline');
    return '<div class="performance-v2 perf-subpage">' +
      '<header class="perf-detail-header"><button class="perf-back" data-action="performance-home" aria-label="Back to Performance">‹</button><div><p class="eyebrow">RECORD BOOK</p><h2>The marks you moved past.</h2><p>Records stay with you even when your program changes.</p></div></header>' +
      '<div class="perf-record-summary"><div><span>PERSONAL BESTS</span><strong>' + prs.length + '</strong></div><div><span>BASELINES</span><strong>' + baselines.length + '</strong></div></div>' +
      (prs.length ? '<section class="perf-section"><div class="perf-section-head"><div><p class="eyebrow">PERSONAL BESTS</p><h3>Each one started with an earlier version of you.</h3></div></div><div class="perf-record-book-list">' +
        prs.map(item => '<button class="perf-record-book-row" data-action="progress-exercise" data-progress-exercise="' + esc(item.exerciseId) + '"><div><span>' + esc(formatDate(item.date)) + '</span><strong>' + esc(item.name) + '</strong><small>A new recorded best.</small></div><b>' + esc(item.weight ? item.weight + ' lb × ' + item.reps : item.reps + ' reps') + '</b></button>').join('') +
      '</div></section>' : '<div class="perf-empty-inline"><strong>Your first recorded best is still ahead.</strong><span>Once a movement has a baseline, later progress can enter the record book.</span></div>') +
      (baselines.length ? '<section class="perf-section"><div class="perf-section-head"><div><p class="eyebrow">WHERE IT STARTED</p><h3>Your original markers.</h3></div></div><div class="perf-baseline-list">' +
        baselines.slice(0, 12).map(item => '<button class="perf-baseline-row" data-action="progress-exercise" data-progress-exercise="' + esc(item.exerciseId) + '"><div><strong>' + esc(item.name) + '</strong><small>' + esc(formatDate(item.date)) + '</small></div><b>' + esc(item.weight ? item.weight + ' lb × ' + item.reps : item.reps + ' reps') + '</b></button>').join('') +
      '</div></section>' : '') +
    '</div>';
  }

  function renderIntelligence() {
    const overview = trainingLearnerOverview();
    const models = Object.values(ensureTrainingLearner()?.models || {});
    const gates = models.map(model => learnerGateLabel(model));
    const ready = gates.filter(gate => ['suggest', 'influence'].includes(gate.level)).length;
    const learning = Math.max(0, models.length - ready);
    const insight = coachInsight();

    return '<div class="performance-v2 perf-subpage">' +
      '<header class="perf-detail-header"><button class="perf-back" data-action="performance-home" aria-label="Back to Performance">‹</button><div><p class="eyebrow">TRAINING INTELLIGENCE</p><h2>What GoWorkout knows so far.</h2><p>The app separates observation from recommendation. A movement earns more influence only after enough evidence.</p></div></header>' +
      '<section class="perf-intelligence-hero"><div><span>MOVEMENTS KNOWN</span><strong>' + num(overview.modeledExercises) + '</strong><small>with learner history</small></div><div><span>READY TO SUGGEST</span><strong>' + ready + '</strong><small>movements with enough evidence</small></div><div><span>STILL LEARNING</span><strong>' + learning + '</strong><small>observation comes first</small></div></section>' +
      '<section class="perf-section perf-intelligence-insight"><p class="eyebrow">CURRENT READ</p><h3>' + esc(insight.title) + '</h3><p>' + esc(insight.copy) + '</p><small>' + esc(insight.detail) + '</small></section>' +
      '<section class="perf-section"><div class="perf-section-head"><div><p class="eyebrow">HOW THIS WORKS</p><h3>Recommendations have to earn their way onto your plan.</h3></div></div><div class="perf-intelligence-steps"><div><span>01</span><strong>Observe</strong><p>GoWorkout records completed sets, targets, rest, feedback, and readiness context.</p></div><div><span>02</span><strong>Compare</strong><p>Repeated exposures create a normal range for each movement.</p></div><div><span>03</span><strong>Suggest</strong><p>When the evidence is strong enough, GoWorkout can surface a conservative next target.</p></div></div></section>' +
      '<section class="perf-section perf-advanced-intelligence"><div class="perf-section-head"><div><p class="eyebrow">ADVANCED</p><h3>Model diagnostics</h3><p>These details explain prediction checks and evidence gates. They are kept out of the main Performance story.</p></div><button class="text-button" data-action="toggle-learner-diagnostics">' + (learnerDiagnosticsOpen ? 'HIDE DETAILS' : 'VIEW DETAILS') + '</button></div>' +
        (learnerDiagnosticsOpen ? renderLearnerDiagnostics() : '') +
      '</section>' +
    '</div>';
  }

  function renderHomePerformance() {
    const history = periodHistory();
    const summaries = movementSummaries();
    const records = recordEventsForPeriod();
    const headline = headlineState(summaries);
    const schedule = currentWeekSchedule();
    const completed = schedule.filter(entry => entry.status === 'complete').length;
    const weekLine = schedule.length ? completed + ' of ' + schedule.length + ' planned workouts complete this week' : history.length + ' workouts in this period';

    return '<div class="performance-v2">' +
      '<header class="perf-hero"><div><p class="eyebrow">PERFORMANCE</p><h2>' + esc(headline.title) + '</h2><p>' + esc(headline.copy) + '</p></div><button class="button secondary perf-history-button" data-action="history">HISTORY</button>' +
        '<div class="perf-week-line"><span>' + esc(weekLine) + '</span>' + (schedule.length ? '<div class="perf-week-bar"><i style="width:' + Math.min(100, completed / Math.max(1, schedule.length) * 100) + '%"></i></div>' : '') + '</div>' +
        renderPeriodTabs() +
      '</header>' +
      renderLastWorkoutSection() +
      renderScorecard(history, summaries, records) +
      renderTrendSection() +
      renderStrongestMovers(summaries) +
      renderRecordsSection(records) +
      renderCoachSection() +
      renderMilestoneSection() +
      renderTrainingHistory() +
    '</div>';
  }

  function renderPerformance() {
    if (!(store.history || []).length) return renderEmptyPerformance();
    if (progressExerciseId) {
      const detail = exerciseProgressSummary(progressExerciseId);
      if (detail) return renderExerciseDetail(detail);
      progressExerciseId = '';
    }
    if (performanceView === 'exercises') return renderExerciseDirectory();
    if (performanceView === 'records') return renderRecordBook();
    if (performanceView === 'intelligence') return renderIntelligence();
    return renderHomePerformance();
  }

  renderProgress = renderPerformance;

  document.addEventListener('click', event => {
    const node = event.target.closest('[data-action], .nav-item[data-tab]');
    if (!node) return;
    const action = node.dataset.action || '';

    if (node.matches('.nav-item[data-tab="progress"]') || action === 'progress') {
      performanceView = 'home';
      performancePointIndex = -1;
      saveState();
      setTimeout(() => {
        if (currentTab === 'progress') render();
      }, 0);
      return;
    }

    if (action === 'performance-home') {
      performanceView = 'home';
      performancePointIndex = -1;
      progressExerciseId = '';
      saveState();
      persistUiState();
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (action === 'performance-exercises') {
      performanceView = 'exercises';
      progressExerciseId = '';
      saveState();
      persistUiState();
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (action === 'performance-records') {
      performanceView = 'records';
      progressExerciseId = '';
      saveState();
      persistUiState();
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (action === 'performance-intelligence') {
      performanceView = 'intelligence';
      progressExerciseId = '';
      saveState();
      persistUiState();
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (action === 'set-performance-period') {
      const next = node.dataset.performancePeriod;
      if (PERIODS[next]) {
        performancePeriod = next;
        performancePointIndex = -1;
        saveState();
        render();
      }
      return;
    }

    if (action === 'set-performance-trend') {
      const next = node.dataset.performanceTrend;
      if (['strength', 'volume', 'workouts'].includes(next)) {
        performanceTrendMetric = next;
        performancePointIndex = -1;
        saveState();
        render();
      }
      return;
    }

    if (action === 'performance-chart-point') {
      performancePointIndex = Math.max(0, Number(node.dataset.performancePoint) || 0);
      saveState();
      render();
      return;
    }

    if (action === 'performance-exercise-filter') {
      const next = node.dataset.performanceExerciseFilter;
      if (['all', 'improving', 'records', 'recent'].includes(next)) {
        performanceExerciseFilter = next;
        saveState();
        render();
      }
      return;
    }

    if (action === 'progress-exercise') {
      performanceView = 'home';
      saveState();
      return;
    }

    if (action === 'close-progress-exercise') {
      performanceView = 'home';
      saveState();
    }
  });

  if (currentTab === 'progress') render();
})();
