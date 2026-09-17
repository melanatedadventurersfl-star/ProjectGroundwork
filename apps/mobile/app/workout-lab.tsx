import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { workoutRoutines } from '../src/workout/plans';
import { loadWorkoutStore, saveWorkoutStore } from '../src/workout/storage';
import type {
  ActiveExercise,
  ActiveWorkout,
  WorkoutHistoryEntry,
  WorkoutRoutine,
  WorkoutSet,
  WorkoutStore,
} from '../src/workout/types';

type TabKey = 'home' | 'workout' | 'history' | 'progress';

const ACCENT = '#D6FF43';
const BG = '#0A0D0B';
const CARD = '#151A17';
const CARD_2 = '#1C231F';
const MUTED = '#8E9A93';
const TEXT = '#F7FAF8';

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeSets(count: number): WorkoutSet[] {
  return Array.from({ length: count }, () => ({
    id: makeId('set'),
    weight: '',
    reps: '',
    completed: false,
  }));
}

function createActiveWorkout(routine: WorkoutRoutine): ActiveWorkout {
  return {
    id: makeId('workout'),
    routineId: routine.id,
    routineName: routine.name,
    startedAt: new Date().toISOString(),
    exercises: routine.exercises.map((exercise) => ({
      ...exercise,
      sets: makeSets(exercise.targetSets),
    })),
  };
}

function parseNumber(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calculateVolume(exercises: ActiveExercise[]) {
  return exercises.reduce(
    (total, exercise) =>
      total +
      exercise.sets.reduce((setTotal, set) => {
        if (!set.completed) return setTotal;
        return setTotal + parseNumber(set.weight) * parseNumber(set.reps);
      }, 0),
    0,
  );
}

function countCompletedSets(exercises: ActiveExercise[]) {
  return exercises.reduce(
    (total, exercise) => total + exercise.sets.filter((set) => set.completed).length,
    0,
  );
}

function formatVolume(volume: number) {
  if (volume >= 1000) return `${(volume / 1000).toFixed(volume >= 10000 ? 0 : 1)}k lb`;
  return `${Math.round(volume)} lb`;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));
}

function formatShortDate(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso));
}

function minutesBetween(start: string, end: string) {
  return Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
}

function startOfWeek(date = new Date()) {
  const copy = new Date(date);
  const day = copy.getDay();
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - day);
  return copy;
}

function SectionTitle({ eyebrow, title }: { eyebrow?: string; title: string }) {
  return (
    <View style={styles.sectionHeading}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export default function WorkoutLabScreen() {
  const [tab, setTab] = useState<TabKey>('home');
  const [store, setStore] = useState<WorkoutStore>({ history: [], activeWorkout: null });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    void loadWorkoutStore().then((saved) => {
      if (!active) return;
      setStore(saved);
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void saveWorkoutStore(store);
  }, [hydrated, store]);

  const history = store.history;
  const activeWorkout = store.activeWorkout;

  const weekStart = useMemo(() => startOfWeek(), []);
  const weeklyWorkouts = history.filter((entry) => new Date(entry.completedAt) >= weekStart);
  const weeklyVolume = weeklyWorkouts.reduce((sum, entry) => sum + entry.totalVolume, 0);
  const totalVolume = history.reduce((sum, entry) => sum + entry.totalVolume, 0);
  const totalSets = history.reduce((sum, entry) => sum + entry.completedSets, 0);

  const personalRecords = useMemo(() => {
    const records = new Map<string, { name: string; weight: number; reps: number }>();
    for (const entry of history) {
      for (const exercise of entry.exercises) {
        for (const set of exercise.sets) {
          if (!set.completed) continue;
          const weight = parseNumber(set.weight);
          const reps = parseNumber(set.reps);
          const current = records.get(exercise.id);
          if (!current || weight > current.weight || (weight === current.weight && reps > current.reps)) {
            records.set(exercise.id, { name: exercise.name, weight, reps });
          }
        }
      }
    }
    return [...records.values()].sort((a, b) => b.weight - a.weight).slice(0, 6);
  }, [history]);

  function beginWorkout(routine: WorkoutRoutine) {
    if (activeWorkout) {
      Alert.alert(
        'Workout in progress',
        `Finish or discard ${activeWorkout.routineName} before starting another workout.`,
      );
      setTab('workout');
      return;
    }
    setStore((current) => ({ ...current, activeWorkout: createActiveWorkout(routine) }));
    setTab('workout');
  }

  function updateSet(exerciseId: string, setId: string, field: 'weight' | 'reps', value: string) {
    setStore((current) => {
      if (!current.activeWorkout) return current;
      return {
        ...current,
        activeWorkout: {
          ...current.activeWorkout,
          exercises: current.activeWorkout.exercises.map((exercise) =>
            exercise.id !== exerciseId
              ? exercise
              : {
                  ...exercise,
                  sets: exercise.sets.map((set) =>
                    set.id === setId ? { ...set, [field]: value.replace(/[^0-9.]/g, '') } : set,
                  ),
                },
          ),
        },
      };
    });
  }

  function toggleSet(exerciseId: string, setId: string) {
    setStore((current) => {
      if (!current.activeWorkout) return current;
      return {
        ...current,
        activeWorkout: {
          ...current.activeWorkout,
          exercises: current.activeWorkout.exercises.map((exercise) =>
            exercise.id !== exerciseId
              ? exercise
              : {
                  ...exercise,
                  sets: exercise.sets.map((set) =>
                    set.id === setId ? { ...set, completed: !set.completed } : set,
                  ),
                },
          ),
        },
      };
    });
  }

  function addSet(exerciseId: string) {
    setStore((current) => {
      if (!current.activeWorkout) return current;
      return {
        ...current,
        activeWorkout: {
          ...current.activeWorkout,
          exercises: current.activeWorkout.exercises.map((exercise) =>
            exercise.id === exerciseId
              ? { ...exercise, sets: [...exercise.sets, ...makeSets(1)] }
              : exercise,
          ),
        },
      };
    });
  }

  function previousBest(exerciseId: string) {
    for (const entry of history) {
      const exercise = entry.exercises.find((item) => item.id === exerciseId);
      if (!exercise) continue;
      const best = exercise.sets
        .filter((set) => set.completed)
        .sort((a, b) => parseNumber(b.weight) - parseNumber(a.weight))[0];
      if (best) return `${best.weight || '0'} x ${best.reps || '0'}`;
    }
    return 'No previous sets';
  }

  function finishWorkout() {
    if (!activeWorkout) return;
    const completedSets = countCompletedSets(activeWorkout.exercises);
    if (completedSets === 0) {
      Alert.alert('No completed sets', 'Check off at least one set before finishing the workout.');
      return;
    }
    const completedAt = new Date().toISOString();
    const entry: WorkoutHistoryEntry = {
      ...activeWorkout,
      completedAt,
      durationMinutes: minutesBetween(activeWorkout.startedAt, completedAt),
      totalVolume: calculateVolume(activeWorkout.exercises),
      completedSets,
    };
    setStore((current) => ({
      activeWorkout: null,
      history: [entry, ...current.history],
    }));
    setTab('history');
  }

  function discardWorkout() {
    if (!activeWorkout) return;
    Alert.alert('Discard workout?', 'Your current set entries will be removed.', [
      { text: 'Keep workout', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => setStore((current) => ({ ...current, activeWorkout: null })),
      },
    ]);
  }

  if (!hydrated) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingMark}>W/</Text>
          <Text style={styles.loadingText}>Loading workout data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.shell}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>WORKOUT</Text>
            <Text style={styles.headerSub}>Simple training. Clear progress.</Text>
          </View>
          <View style={styles.avatar}><Text style={styles.avatarText}>JC</Text></View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {tab === 'home' ? (
            <>
              <View style={styles.heroCard}>
                <Text style={styles.heroKicker}>THIS WEEK</Text>
                <View style={styles.heroRow}>
                  <View>
                    <Text style={styles.heroNumber}>{weeklyWorkouts.length}</Text>
                    <Text style={styles.heroLabel}>workouts complete</Text>
                  </View>
                  <View style={styles.heroDivider} />
                  <View>
                    <Text style={styles.heroNumber}>{formatVolume(weeklyVolume)}</Text>
                    <Text style={styles.heroLabel}>training volume</Text>
                  </View>
                </View>
              </View>

              {activeWorkout ? (
                <Pressable style={styles.resumeCard} onPress={() => setTab('workout')}>
                  <View style={styles.resumeDot} />
                  <View style={styles.flexOne}>
                    <Text style={styles.resumeEyebrow}>WORKOUT IN PROGRESS</Text>
                    <Text style={styles.resumeTitle}>{activeWorkout.routineName}</Text>
                  </View>
                  <Text style={styles.resumeArrow}>→</Text>
                </Pressable>
              ) : null}

              <SectionTitle eyebrow="YOUR PLAN" title="Choose a workout" />
              <View style={styles.routineGrid}>
                {workoutRoutines.map((routine, index) => (
                  <Pressable key={routine.id} style={styles.routineCard} onPress={() => beginWorkout(routine)}>
                    <View style={styles.routineTopRow}>
                      <Text style={styles.routineNumber}>0{index + 1}</Text>
                      <Text style={styles.routineTime}>{routine.durationMinutes} MIN</Text>
                    </View>
                    <Text style={styles.routineName}>{routine.name}</Text>
                    <Text style={styles.routineFocus}>{routine.focus}</Text>
                    <View style={styles.routineFooter}>
                      <Text style={styles.routineMeta}>{routine.exercises.length} exercises</Text>
                      <View style={styles.goButton}><Text style={styles.goButtonText}>START</Text></View>
                    </View>
                  </Pressable>
                ))}
              </View>

              <SectionTitle eyebrow="RECENT" title="Last session" />
              {history[0] ? (
                <View style={styles.historyCard}>
                  <View style={styles.historyTop}>
                    <View>
                      <Text style={styles.historyName}>{history[0].routineName}</Text>
                      <Text style={styles.historyDate}>{formatShortDate(history[0].completedAt)}</Text>
                    </View>
                    <Text style={styles.historyVolume}>{formatVolume(history[0].totalVolume)}</Text>
                  </View>
                  <View style={styles.historyStats}>
                    <Text style={styles.historyStat}>{history[0].completedSets} sets</Text>
                    <Text style={styles.historyStat}>•</Text>
                    <Text style={styles.historyStat}>{history[0].durationMinutes} min</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>No sessions yet</Text>
                  <Text style={styles.emptyBody}>Finish your first workout and it will land here automatically.</Text>
                </View>
              )}
            </>
          ) : null}

          {tab === 'workout' ? (
            activeWorkout ? (
              <>
                <View style={styles.workoutHeaderCard}>
                  <Text style={styles.eyebrow}>ACTIVE WORKOUT</Text>
                  <Text style={styles.workoutTitle}>{activeWorkout.routineName}</Text>
                  <Text style={styles.workoutStarted}>Started {new Date(activeWorkout.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text>
                  <View style={styles.progressLineTrack}>
                    <View
                      style={[
                        styles.progressLineFill,
                        {
                          width: `${Math.min(
                            100,
                            (countCompletedSets(activeWorkout.exercises) /
                              Math.max(1, activeWorkout.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0))) *
                              100,
                          )}%`,
                        },
                      ]}
                    />
                  </View>
                </View>

                {activeWorkout.exercises.map((exercise, exerciseIndex) => (
                  <View key={exercise.id} style={styles.exerciseCard}>
                    <View style={styles.exerciseHeader}>
                      <View style={styles.exerciseNumber}><Text style={styles.exerciseNumberText}>{exerciseIndex + 1}</Text></View>
                      <View style={styles.flexOne}>
                        <Text style={styles.exerciseName}>{exercise.name}</Text>
                        <Text style={styles.exerciseTarget}>{exercise.targetSets} sets • {exercise.targetReps} reps</Text>
                      </View>
                    </View>
                    <Text style={styles.previousText}>Previous best: {previousBest(exercise.id)}</Text>

                    <View style={styles.setHeaderRow}>
                      <Text style={[styles.setHeaderText, styles.setIndexCell]}>SET</Text>
                      <Text style={[styles.setHeaderText, styles.inputCell]}>LB</Text>
                      <Text style={[styles.setHeaderText, styles.inputCell]}>REPS</Text>
                      <Text style={[styles.setHeaderText, styles.doneCell]}>DONE</Text>
                    </View>

                    {exercise.sets.map((set, setIndex) => (
                      <View key={set.id} style={[styles.setRow, set.completed && styles.setRowDone]}>
                        <Text style={[styles.setIndex, styles.setIndexCell]}>{setIndex + 1}</Text>
                        <View style={styles.inputCell}>
                          <TextInput
                            value={set.weight}
                            onChangeText={(value) => updateSet(exercise.id, set.id, 'weight', value)}
                            placeholder="0"
                            placeholderTextColor="#5E6963"
                            keyboardType="decimal-pad"
                            style={styles.setInput}
                            selectTextOnFocus
                          />
                        </View>
                        <View style={styles.inputCell}>
                          <TextInput
                            value={set.reps}
                            onChangeText={(value) => updateSet(exercise.id, set.id, 'reps', value)}
                            placeholder="0"
                            placeholderTextColor="#5E6963"
                            keyboardType="number-pad"
                            style={styles.setInput}
                            selectTextOnFocus
                          />
                        </View>
                        <View style={styles.doneCell}>
                          <Pressable
                            style={[styles.checkButton, set.completed && styles.checkButtonDone]}
                            onPress={() => toggleSet(exercise.id, set.id)}
                          >
                            <Text style={[styles.checkText, set.completed && styles.checkTextDone]}>{set.completed ? '✓' : ''}</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}

                    <Pressable style={styles.addSetButton} onPress={() => addSet(exercise.id)}>
                      <Text style={styles.addSetText}>+ ADD SET</Text>
                    </Pressable>
                  </View>
                ))}

                <Pressable style={styles.finishButton} onPress={finishWorkout}>
                  <Text style={styles.finishButtonText}>FINISH WORKOUT</Text>
                </Pressable>
                <Pressable style={styles.discardButton} onPress={discardWorkout}>
                  <Text style={styles.discardButtonText}>Discard workout</Text>
                </Pressable>
              </>
            ) : (
              <View style={styles.emptyLarge}>
                <Text style={styles.emptyGlyph}>+</Text>
                <Text style={styles.emptyLargeTitle}>Nothing active</Text>
                <Text style={styles.emptyLargeBody}>Choose a routine from Home when you are ready to train.</Text>
                <Pressable style={styles.primaryButton} onPress={() => setTab('home')}>
                  <Text style={styles.primaryButtonText}>CHOOSE WORKOUT</Text>
                </Pressable>
              </View>
            )
          ) : null}

          {tab === 'history' ? (
            <>
              <SectionTitle eyebrow="TRAINING LOG" title="Workout history" />
              {history.length ? (
                history.map((entry) => (
                  <View key={entry.id} style={styles.historyCard}>
                    <View style={styles.historyTop}>
                      <View style={styles.flexOne}>
                        <Text style={styles.historyName}>{entry.routineName}</Text>
                        <Text style={styles.historyDate}>{formatDate(entry.completedAt)}</Text>
                      </View>
                      <Text style={styles.historyVolume}>{formatVolume(entry.totalVolume)}</Text>
                    </View>
                    <View style={styles.historyStats}>
                      <Text style={styles.historyStat}>{entry.completedSets} completed sets</Text>
                      <Text style={styles.historyStat}>•</Text>
                      <Text style={styles.historyStat}>{entry.durationMinutes} min</Text>
                    </View>
                    <View style={styles.exerciseChips}>
                      {entry.exercises.filter((exercise) => exercise.sets.some((set) => set.completed)).map((exercise) => (
                        <View key={exercise.id} style={styles.exerciseChip}>
                          <Text style={styles.exerciseChipText}>{exercise.name}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyLarge}>
                  <Text style={styles.emptyGlyph}>↗</Text>
                  <Text style={styles.emptyLargeTitle}>Your log starts here</Text>
                  <Text style={styles.emptyLargeBody}>Completed workouts will show up with duration, volume, and exercises.</Text>
                </View>
              )}
            </>
          ) : null}

          {tab === 'progress' ? (
            <>
              <SectionTitle eyebrow="PROGRESS" title="The numbers" />
              <View style={styles.metricsGrid}>
                <MetricCard label="TOTAL WORKOUTS" value={`${history.length}`} />
                <MetricCard label="TOTAL SETS" value={`${totalSets}`} />
                <MetricCard label="TOTAL VOLUME" value={formatVolume(totalVolume)} />
                <MetricCard label="THIS WEEK" value={`${weeklyWorkouts.length}`} />
              </View>

              <SectionTitle eyebrow="PERSONAL BESTS" title="Heaviest sets" />
              {personalRecords.length ? (
                <View style={styles.prList}>
                  {personalRecords.map((record, index) => (
                    <View key={`${record.name}-${index}`} style={styles.prRow}>
                      <View style={styles.prRank}><Text style={styles.prRankText}>{String(index + 1).padStart(2, '0')}</Text></View>
                      <View style={styles.flexOne}>
                        <Text style={styles.prName}>{record.name}</Text>
                        <Text style={styles.prSub}>Best logged working set</Text>
                      </View>
                      <Text style={styles.prValue}>{record.weight} x {record.reps}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>PR board is empty</Text>
                  <Text style={styles.emptyBody}>Complete weighted sets and your best lifts will appear here.</Text>
                </View>
              )}

              <SectionTitle eyebrow="CONSISTENCY" title="Weekly target" />
              <View style={styles.goalCard}>
                <View>
                  <Text style={styles.goalNumber}>{weeklyWorkouts.length}/4</Text>
                  <Text style={styles.goalLabel}>workouts this week</Text>
                </View>
                <View style={styles.goalTrack}>
                  <View style={[styles.goalFill, { width: `${Math.min(100, (weeklyWorkouts.length / 4) * 100)}%` }]} />
                </View>
              </View>
            </>
          ) : null}
        </ScrollView>

        <View style={styles.bottomNav}>
          {([
            ['home', 'HOME', '⌂'],
            ['workout', 'WORKOUT', '＋'],
            ['history', 'HISTORY', '≡'],
            ['progress', 'PROGRESS', '↗'],
          ] as const).map(([key, label, icon]) => (
            <Pressable key={key} style={styles.navItem} onPress={() => setTab(key)}>
              <Text style={[styles.navIcon, tab === key && styles.navActive]}>{icon}</Text>
              <Text style={[styles.navLabel, tab === key && styles.navActive]}>{label}</Text>
              {key === 'workout' && activeWorkout ? <View style={styles.navDot} /> : null}
            </Pressable>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  shell: { flex: 1, backgroundColor: BG },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#252D28' },
  brand: { color: TEXT, fontSize: 20, fontWeight: '900', letterSpacing: 2 },
  headerSub: { color: MUTED, fontSize: 11, marginTop: 3 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: BG, fontSize: 12, fontWeight: '900' },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, gap: 14 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingMark: { color: ACCENT, fontSize: 42, fontWeight: '900' },
  loadingText: { color: MUTED, fontSize: 13 },
  heroCard: { backgroundColor: ACCENT, borderRadius: 22, padding: 22 },
  heroKicker: { color: '#39400B', fontSize: 10, fontWeight: '900', letterSpacing: 1.8, marginBottom: 14 },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  heroNumber: { color: BG, fontSize: 28, fontWeight: '900' },
  heroLabel: { color: '#39400B', fontSize: 11, marginTop: 2 },
  heroDivider: { width: 1, height: 45, backgroundColor: '#9FB927', marginHorizontal: 24 },
  resumeCard: { backgroundColor: '#263014', borderWidth: 1, borderColor: '#53651D', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  resumeDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: ACCENT },
  resumeEyebrow: { color: ACCENT, fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  resumeTitle: { color: TEXT, fontSize: 17, fontWeight: '800', marginTop: 3 },
  resumeArrow: { color: ACCENT, fontSize: 24 },
  sectionHeading: { marginTop: 14, marginBottom: 2 },
  eyebrow: { color: ACCENT, fontSize: 9, fontWeight: '900', letterSpacing: 1.7, marginBottom: 5 },
  sectionTitle: { color: TEXT, fontSize: 24, lineHeight: 29, fontWeight: '900' },
  routineGrid: { gap: 10 },
  routineCard: { backgroundColor: CARD, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#222A25' },
  routineTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  routineNumber: { color: '#48534C', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  routineTime: { color: MUTED, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  routineName: { color: TEXT, fontSize: 23, fontWeight: '900', marginTop: 14 },
  routineFocus: { color: MUTED, fontSize: 12, marginTop: 4, lineHeight: 18 },
  routineFooter: { marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  routineMeta: { color: '#6F7B74', fontSize: 11 },
  goButton: { backgroundColor: '#252D28', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  goButtonText: { color: ACCENT, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  historyCard: { backgroundColor: CARD, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#222A25' },
  historyTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  historyName: { color: TEXT, fontSize: 18, fontWeight: '900' },
  historyDate: { color: MUTED, fontSize: 11, marginTop: 4 },
  historyVolume: { color: ACCENT, fontSize: 16, fontWeight: '900' },
  historyStats: { flexDirection: 'row', gap: 8, marginTop: 14 },
  historyStat: { color: '#718078', fontSize: 11 },
  emptyCard: { backgroundColor: CARD, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: '#222A25' },
  emptyTitle: { color: TEXT, fontSize: 16, fontWeight: '800' },
  emptyBody: { color: MUTED, fontSize: 12, lineHeight: 18, marginTop: 5 },
  workoutHeaderCard: { backgroundColor: CARD, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#2B352F' },
  workoutTitle: { color: TEXT, fontSize: 30, fontWeight: '900' },
  workoutStarted: { color: MUTED, fontSize: 11, marginTop: 5 },
  progressLineTrack: { height: 4, borderRadius: 99, backgroundColor: '#2A332E', overflow: 'hidden', marginTop: 18 },
  progressLineFill: { height: '100%', backgroundColor: ACCENT, borderRadius: 99 },
  exerciseCard: { backgroundColor: CARD, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#222A25' },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  exerciseNumber: { width: 32, height: 32, borderRadius: 10, backgroundColor: CARD_2, alignItems: 'center', justifyContent: 'center' },
  exerciseNumberText: { color: ACCENT, fontSize: 11, fontWeight: '900' },
  exerciseName: { color: TEXT, fontSize: 16, fontWeight: '900' },
  exerciseTarget: { color: MUTED, fontSize: 10, marginTop: 3 },
  previousText: { color: '#667169', fontSize: 10, marginTop: 13, marginBottom: 9 },
  setHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  setHeaderText: { color: '#5E6963', fontSize: 9, fontWeight: '900', textAlign: 'center', letterSpacing: 1 },
  setRow: { flexDirection: 'row', alignItems: 'center', minHeight: 50, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#27302A' },
  setRowDone: { opacity: 0.75 },
  setIndexCell: { width: 42, textAlign: 'center' },
  inputCell: { flex: 1, alignItems: 'center' },
  doneCell: { width: 58, alignItems: 'center' },
  setIndex: { color: MUTED, fontSize: 12, fontWeight: '800' },
  setInput: { width: '82%', minHeight: 36, borderRadius: 10, backgroundColor: CARD_2, color: TEXT, textAlign: 'center', fontSize: 15, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 7 },
  checkButton: { width: 30, height: 30, borderRadius: 9, borderWidth: 1, borderColor: '#455149', alignItems: 'center', justifyContent: 'center' },
  checkButtonDone: { backgroundColor: ACCENT, borderColor: ACCENT },
  checkText: { color: '#5E6963', fontWeight: '900' },
  checkTextDone: { color: BG },
  addSetButton: { marginTop: 10, paddingVertical: 11, backgroundColor: CARD_2, borderRadius: 11, alignItems: 'center' },
  addSetText: { color: '#A5B0A9', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  finishButton: { marginTop: 6, backgroundColor: ACCENT, borderRadius: 15, paddingVertical: 17, alignItems: 'center' },
  finishButtonText: { color: BG, fontSize: 12, fontWeight: '900', letterSpacing: 1.4 },
  discardButton: { alignItems: 'center', paddingVertical: 12 },
  discardButtonText: { color: '#7F8A84', fontSize: 11 },
  emptyLarge: { alignItems: 'center', paddingVertical: 70, paddingHorizontal: 24 },
  emptyGlyph: { color: ACCENT, fontSize: 42, fontWeight: '300' },
  emptyLargeTitle: { color: TEXT, fontSize: 24, fontWeight: '900', marginTop: 12 },
  emptyLargeBody: { color: MUTED, fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 7, maxWidth: 280 },
  primaryButton: { backgroundColor: ACCENT, paddingHorizontal: 22, paddingVertical: 14, borderRadius: 13, marginTop: 22 },
  primaryButtonText: { color: BG, fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  exerciseChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  exerciseChip: { backgroundColor: CARD_2, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999 },
  exerciseChipText: { color: '#9AA59F', fontSize: 9, fontWeight: '700' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { width: '48%', minHeight: 112, backgroundColor: CARD, borderRadius: 18, padding: 16, justifyContent: 'space-between', borderWidth: 1, borderColor: '#222A25' },
  metricValue: { color: TEXT, fontSize: 24, fontWeight: '900' },
  metricLabel: { color: '#657169', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  prList: { backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: '#222A25', overflow: 'hidden' },
  prRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2A332E' },
  prRank: { width: 34 },
  prRankText: { color: '#57625B', fontSize: 11, fontWeight: '900' },
  prName: { color: TEXT, fontSize: 13, fontWeight: '800' },
  prSub: { color: '#68736C', fontSize: 9, marginTop: 2 },
  prValue: { color: ACCENT, fontSize: 13, fontWeight: '900' },
  goalCard: { backgroundColor: CARD, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: '#222A25' },
  goalNumber: { color: TEXT, fontSize: 30, fontWeight: '900' },
  goalLabel: { color: MUTED, fontSize: 11, marginTop: 2 },
  goalTrack: { height: 8, borderRadius: 99, backgroundColor: '#26302A', overflow: 'hidden', marginTop: 18 },
  goalFill: { height: '100%', borderRadius: 99, backgroundColor: ACCENT },
  bottomNav: { flexDirection: 'row', minHeight: 72, backgroundColor: '#0E120F', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2B332E', paddingBottom: 6 },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  navIcon: { color: '#5E6963', fontSize: 18, height: 23 },
  navLabel: { color: '#5E6963', fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  navActive: { color: ACCENT },
  navDot: { position: 'absolute', top: 11, right: '29%', width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT },
  flexOne: { flex: 1 },
});
