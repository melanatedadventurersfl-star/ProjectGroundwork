const STORAGE_KEY = 'workout-web-store-v3';
const LEGACY_KEYS = ['workout-web-store-v2','workout-web-store-v1'];
const ACTIVE_WORKOUT_SCHEMA = 4;
const catalog = window.EXERCISE_CATALOG || [];
const movements = window.EXERCISE_MOVEMENTS || {};
const exerciseMedia = window.EXERCISE_MEDIA || {};
const exerciseMediaFallbacks = window.EXERCISE_MEDIA_FALLBACKS || {};
const EXERCISE_IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
let exerciseDetailId = null;
let swapContext = null;
let readinessContext = null;
let workoutMapOpen = false;
let setEditContext = null;

const defaultStore = {
  profile: null,
  plan: null,
  history: [],
  activeWorkout: null,
  calibration: {},
  progression: {},
  progressionLog: [],
  exercisePreferences: {excluded:[],swapHistory:[]},
  trainingProgram: {scheduleOverrides:{},weekReviews:{}},
  cueSettings: {sound:true,voice:true,haptics:true,flash:true},
  lastSummaryId: null
};

let store = loadStore();
let clearedLegacyActiveWorkout = false;
if (store.activeWorkout && store.activeWorkout.schemaVersion !== ACTIVE_WORKOUT_SCHEMA) {
  store.activeWorkout = null;
  clearedLegacyActiveWorkout = true;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}
let currentTab = store.profile && store.plan ? (store.activeWorkout ? 'workout' : 'home') : 'profile';
let catalogQuery = '';
let tickHandle = null;

const BLUEPRINTS = {
  2: [
    {name:'Full Body A',focus:'Full body',patterns:['squat','horizontal-push','horizontal-pull','hinge','vertical-pull','core']},
    {name:'Full Body B',focus:'Full body',patterns:['hinge','vertical-push','vertical-pull','single-leg','horizontal-push','core']}
  ],
  3: [
    {name:'Full Body A',focus:'Strength foundation',patterns:['squat','horizontal-push','horizontal-pull','hinge','core']},
    {name:'Full Body B',focus:'Posterior chain + shoulders',patterns:['hinge','vertical-push','vertical-pull','single-leg','biceps','core']},
    {name:'Full Body C',focus:'Balanced hypertrophy',patterns:['single-leg','horizontal-push','horizontal-pull','quad-accessory','shoulder-accessory','triceps','core']}
  ],
  4: [
    {name:'Upper A',focus:'Chest, back, shoulders',patterns:['horizontal-push','vertical-pull','horizontal-pull','vertical-push','triceps','biceps']},
    {name:'Lower A',focus:'Quads, glutes, core',patterns:['squat','hinge','single-leg','quad-accessory','calves','core']},
    {name:'Upper B',focus:'Back, chest, arms',patterns:['horizontal-pull','horizontal-push','vertical-pull','shoulder-accessory','biceps','triceps']},
    {name:'Lower B',focus:'Hamstrings, glutes, quads',patterns:['hinge','squat','single-leg','hamstring-accessory','calves','core']}
  ],
  5: [
    {name:'Upper',focus:'Upper-body compounds',patterns:['horizontal-push','horizontal-pull','vertical-push','vertical-pull','biceps','triceps']},
    {name:'Lower',focus:'Lower-body compounds',patterns:['squat','hinge','single-leg','calves','core']},
    {name:'Push',focus:'Chest, shoulders, triceps',patterns:['horizontal-push','vertical-push','shoulder-accessory','triceps','core']},
    {name:'Pull',focus:'Back and biceps',patterns:['horizontal-pull','vertical-pull','horizontal-pull','biceps','core']},
    {name:'Legs',focus:'Quads, hamstrings, glutes',patterns:['squat','hinge','single-leg','quad-accessory','hamstring-accessory','calves']}
  ]
};

function clone(value){ return JSON.parse(JSON.stringify(value)); }

function loadStore(){
  try {
    const direct = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (direct && Array.isArray(direct.history)) return {...clone(defaultStore),...direct};
    for (const key of LEGACY_KEYS) {
      const old = JSON.parse(localStorage.getItem(key));
      if (old && Array.isArray(old.history)) {
        const migrated = {...clone(defaultStore),history:old.history,activeWorkout:null};
        localStorage.setItem(STORAGE_KEY,JSON.stringify(migrated));
        return migrated;
      }
    }
  } catch {}
  return clone(defaultStore);
}
function saveStore(){
  let persisted=true;
  try{
    localStorage.setItem(STORAGE_KEY,JSON.stringify(store));
  }catch{
    persisted=false;
  }
  syncLiveBadge();
  return persisted;
}
function uid(prefix){ return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; }
function num(value){ const n=Number.parseFloat(value); return Number.isFinite(n)?n:0; }
function esc(value){ return String(value ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function roundTo(value,step=5){ if(!value) return 0; return Math.max(step,Math.round(value/step)*step); }
function formatClock(seconds){ const s=Math.max(0,Math.floor(seconds)); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }
function formatDate(iso){
  const value=typeof iso==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(iso)?dateFromKey(iso):new Date(iso);
  return new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric'}).format(value);
}
function formatVolume(v){ return v>=1000?`${(v/1000).toFixed(v>=10000?0:1)}k lb`:`${Math.round(v)} lb`; }
const TRAINING_DAYS=[
  {id:'mon',label:'Mon',name:'Monday',jsDay:1},
  {id:'tue',label:'Tue',name:'Tuesday',jsDay:2},
  {id:'wed',label:'Wed',name:'Wednesday',jsDay:3},
  {id:'thu',label:'Thu',name:'Thursday',jsDay:4},
  {id:'fri',label:'Fri',name:'Friday',jsDay:5},
  {id:'sat',label:'Sat',name:'Saturday',jsDay:6},
  {id:'sun',label:'Sun',name:'Sunday',jsDay:0}
];
function defaultWorkoutDays(days){
  return ({2:['mon','thu'],3:['mon','wed','fri'],4:['mon','tue','thu','sat'],5:['mon','tue','wed','fri','sat']})[num(days)||4]||['mon','tue','thu','sat'];
}
function preferredWorkoutDays(profile=store.profile){
  const selected=Array.isArray(profile?.workoutDays)?profile.workoutDays.filter(id=>TRAINING_DAYS.some(day=>day.id===id)):[];
  return selected.length===num(profile?.days)?selected:defaultWorkoutDays(profile?.days||4);
}
function startOfWeek(date=new Date()){
  const d=new Date(date);d.setHours(0,0,0,0);
  const offset=(d.getDay()+6)%7;
  d.setDate(d.getDate()-offset);
  return d;
}
function addDays(date,days){const d=new Date(date);d.setDate(d.getDate()+days);return d;}
function dateKey(date=new Date()){
  const d=new Date(date);
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
}
function dateFromKey(key){
  const [y,m,d]=String(key||'').split('-').map(Number);
  return y&&m&&d?new Date(y,m-1,d):new Date(NaN);
}
function dayOffsetFromMonday(dayId){
  const day=TRAINING_DAYS.find(item=>item.id===dayId);
  return day?((day.jsDay+6)%7):0;
}
function weekKey(date=new Date()){return dateKey(startOfWeek(date));}
function weeklyHistory(date=new Date()){
  const start=startOfWeek(date),end=addDays(start,7);
  return store.history.filter(x=>{const completed=new Date(x.completedAt);return completed>=start&&completed<end;});
}
function ensureTrainingProgram(){
  store.trainingProgram=store.trainingProgram||{};
  store.trainingProgram.scheduleOverrides=store.trainingProgram.scheduleOverrides||{};
  store.trainingProgram.weekReviews=store.trainingProgram.weekReviews||{};
  return store.trainingProgram;
}
function programOriginDate(){
  const created=store.plan?.createdAt?new Date(store.plan.createdAt):new Date();
  return startOfWeek(Number.isFinite(created.getTime())?created:new Date());
}
function programContext(date=new Date()){
  const origin=programOriginDate(),weekStart=startOfWeek(date);
  const calendarWeekNumber=Math.max(1,Math.floor((weekStart-origin)/(7*86400000))+1);
  const plannedPerWeek=Math.max(1,num(store.profile?.days)||4);
  const completedScheduledDates=new Set(
    store.history
      .filter(item=>item.planId===store.plan?.id&&item.scheduledDate)
      .filter(item=>{
        const scheduled=dateFromKey(item.scheduledDate);
        return scheduled>=origin&&scheduled<weekStart;
      })
      .map(item=>item.scheduledDate)
  );
  const earnedWeekNumber=Math.floor(completedScheduledDates.size/plannedPerWeek)+1;
  const weekNumber=Math.max(1,Math.min(calendarWeekNumber,earnedWeekNumber));
  return {
    weekStart,
    weekKey:dateKey(weekStart),
    calendarWeekNumber,
    weekNumber,
    blockNumber:Math.floor((weekNumber-1)/4)+1,
    blockWeek:((weekNumber-1)%4)+1,
    completedScheduledBeforeWeek:completedScheduledDates.size
  };
}
function blockPhaseLabel(blockWeek){
  return ({1:'ESTABLISH',2:'BUILD',3:'PUSH',4:'CONSOLIDATE'})[blockWeek]||'BUILD';
}

const ACCESSORY_MOVEMENTS=new Set(['biceps','triceps','calves','core','shoulder-accessory','quad-accessory','hamstring-accessory']);

function scheduleHistoryMatch(entry){
  return store.history.find(item=>{
    if(item.scheduledDate)return item.scheduledDate===entry.dateKey;
    return item.planDayId===entry.day.id&&dateKey(new Date(item.completedAt))===entry.dateKey;
  })||null;
}
function scheduledEntriesForWeek(date=new Date()){
  if(!store.plan?.days?.length||!store.profile)return [];
  const context=programContext(date);
  const overrides=ensureTrainingProgram().scheduleOverrides;
  const preferred=preferredWorkoutDays();
  return preferred.map((dayId,index)=>{
    const dayDef=TRAINING_DAYS.find(item=>item.id===dayId)||TRAINING_DAYS[index];
    const scheduledDate=addDays(context.weekStart,dayOffsetFromMonday(dayId));
    const key=dateKey(scheduledDate);
    const day=store.plan.days[index%store.plan.days.length];
    const entry={dayId,date:scheduledDate,dateKey:key,day,index,override:overrides[key]||null};
    const history=scheduleHistoryMatch(entry);
    const todayKey=dateKey();
    let status=history?'complete':entry.override?.status==='skipped'?'skipped':key===todayKey?'today':scheduledDate<new Date(new Date().setHours(0,0,0,0))?'missed':'upcoming';
    return {...entry,dayName:dayDef?.name||dayId,status,history};
  });
}
function weekReview(weekStartDate){
  const start=startOfWeek(weekStartDate),end=addDays(start,7);
  const entries=scheduledEntriesForWeek(start);
  const sessions=store.history.filter(item=>{
    const scheduled=item.scheduledDate?dateFromKey(item.scheduledDate):new Date(item.completedAt);
    return scheduled>=start&&scheduled<end;
  });
  const feedback=[];
  for(const session of sessions)for(const ex of session.exercises||[])if(ex.feedback)feedback.push(ex.feedback);
  const readiness=sessions.map(item=>num(item.readiness?.score)).filter(Boolean);
  const completionRate=entries.length?sessions.filter(item=>entries.some(entry=>entry.dateKey===(item.scheduledDate||dateKey(new Date(item.completedAt))))).length/entries.length:0;
  const tooHard=feedback.filter(value=>value==='too-hard'||value==='form-off').length;
  const hard=feedback.filter(value=>value==='hard').length;
  const swapHistory=store.exercisePreferences?.swapHistory||[];
  const swaps=swapHistory.filter(item=>{const at=new Date(item.at);return at>=start&&at<end;}).length;
  return {
    weekKey:dateKey(start),
    scheduled:entries.length,
    completed:sessions.length,
    completionRate:Math.min(1,completionRate),
    totalVolume:sessions.reduce((sum,item)=>sum+(item.totalVolume||0),0),
    minutes:sessions.reduce((sum,item)=>sum+(item.durationMinutes||0),0),
    averageMinutes:sessions.length?Math.round(sessions.reduce((sum,item)=>sum+(item.durationMinutes||0),0)/sessions.length):0,
    averageReadiness:readiness.length?readiness.reduce((a,b)=>a+b,0)/readiness.length:0,
    tooHardRate:feedback.length?tooHard/feedback.length:0,
    hardRate:feedback.length?hard/feedback.length:0,
    swaps,
    prs:sessions.reduce((sum,item)=>sum+(item.newPRs?.length||0),0)
  };
}
function ensurePriorWeekReview(date=new Date()){
  const context=programContext(date);
  if(context.calendarWeekNumber<=1)return null;
  const previousStart=addDays(context.weekStart,-7);
  const key=dateKey(previousStart);
  const program=ensureTrainingProgram();
  program.weekReviews[key]=weekReview(previousStart);
  return program.weekReviews[key];
}
function adaptationDecision(date=new Date()){
  const context=programContext(date);
  const previous=ensurePriorWeekReview(date);
  const decision={mode:'steady',addSets:0,reduceAccessories:false,notes:[]};
  if(context.blockWeek===1){
    decision.notes.push(context.blockNumber===1?'Establish working loads and clean reps.':'New 4-week block: keep anchor lifts and refresh selected accessory work.');
  }
  if(previous){
    if(previous.completionRate<.6){
      decision.mode='repeat';
      decision.reduceAccessories=true;
      decision.notes.push('Last week was incomplete, so volume stays conservative instead of automatically progressing.');
    }else if((previous.averageReadiness&&previous.averageReadiness<2.7)||previous.tooHardRate>.25){
      decision.mode='recover';
      decision.reduceAccessories=true;
      decision.notes.push('Readiness or difficulty feedback was low, so this week trims accessory volume.');
    }else if(context.blockWeek===2&&previous.completionRate>=.75){
      decision.mode='build';
      decision.addSets=1;
      decision.notes.push('Completion was solid, so one primary movement gets an additional working set.');
    }else if(context.blockWeek===3&&previous.completionRate>=.75){
      decision.mode='push';
      decision.addSets=2;
      decision.notes.push('This is the push week: up to two primary movements gain one working set.');
    }
  }
  if(context.blockWeek===4){
    decision.mode='consolidate';
    decision.addSets=0;
    decision.reduceAccessories=true;
    decision.notes.push('Consolidation week reduces accessory volume while preserving productive anchor work.');
  }
  return {...decision,previous,context};
}
function rotateAccessoriesForBlock(day,blockNumber){
  if(blockNumber<=1)return day;
  const used=new Set((day.exercises||[]).map(ex=>ex.id));
  day.exercises=(day.exercises||[]).map(ex=>{
    if(!ACCESSORY_MOVEMENTS.has(ex.movement))return ex;
    const candidates=catalog.filter(candidate=>
      candidate.id!==ex.id&&candidate.movement===ex.movement&&
      equipmentAllows(candidate,store.profile?.equipment||'full-gym')&&!avoided(candidate,store.profile||{})&&!used.has(candidate.id)
    ).sort((a,b)=>a.id.localeCompare(b.id));
    if(!candidates.length)return ex;
    const chosen=candidates[(blockNumber-2)%candidates.length];
    const replacement=planSlotFromCandidate(chosen,ex);
    delete replacement.swappedFrom;delete replacement.swapUndo;
    used.delete(ex.id);used.add(replacement.id);
    return replacement;
  });
  return day;
}
function adaptDayForProgramWeek(baseDay,date=new Date()){
  const decision=adaptationDecision(date);
  const day=rotateAccessoriesForBlock(clone(baseDay),decision.context.blockNumber);
  const compounds=day.exercises.filter(ex=>!ACCESSORY_MOVEMENTS.has(ex.movement));
  for(let i=0;i<Math.min(decision.addSets,compounds.length);i++)compounds[i].sets=Math.min(4,(compounds[i].sets||2)+1);
  if(decision.reduceAccessories){
    for(const ex of day.exercises)if(ACCESSORY_MOVEMENTS.has(ex.movement)&&ex.sets>2)ex.sets-=1;
  }
  recalculatePlanDay(day);
  const cap=Math.max(20,num(store.profile?.minutes)||45)*1.03;
  for(let i=day.exercises.length-1;i>=0&&day.estimatedMinutes>cap;i--){
    while(day.exercises[i]?.sets>2&&day.estimatedMinutes>cap){
      day.exercises[i].sets-=1;
      recalculatePlanDay(day);
    }
  }
  day.programContext=decision.context;
  day.adaptationMode=decision.mode;
  day.adaptationNotes=decision.notes;
  return day;
}
function currentWeekSchedule(date=new Date()){
  return scheduledEntriesForWeek(date).map(entry=>({...entry,adaptedDay:adaptDayForProgramWeek(entry.day,entry.date)}));
}
function nextScheduledSession(date=new Date()){
  const schedule=currentWeekSchedule(date);
  return schedule.find(entry=>entry.status==='today')||
    schedule.find(entry=>entry.status==='missed')||
    schedule.find(entry=>entry.status==='upcoming')||null;
}
function totalSets(exercises){ return exercises.reduce((n,e)=>n+e.sets.length,0); }
function completedSets(exercises){ return exercises.reduce((n,e)=>n+e.sets.filter(s=>s.completed).length,0); }
function volume(exercises){ return exercises.reduce((t,e)=>t+e.sets.reduce((s,x)=>s+(x.completed?num(x.weight)*num(x.reps):0),0),0); }
function exerciseState(ex){
  if(!ex)return 'not-started';
  if(ex.manualComplete)return 'completed-manually';
  if(ex.skipped)return 'skipped';
  const done=(ex.sets||[]).filter(set=>set.completed).length;
  if(done&&done===(ex.sets||[]).length)return 'complete';
  if(done)return 'partial';
  return 'not-started';
}
function exerciseStateLabel(ex){
  return ({
    'complete':'Completed',
    'completed-manually':'Completed manually',
    'skipped':'Skipped',
    'partial':'Partial',
    'not-started':'Not started'
  })[exerciseState(ex)]||'Not started';
}
function exerciseCountsAsResolved(ex){
  return ['complete','completed-manually','skipped'].includes(exerciseState(ex));
}
function workoutResolvedCount(w){
  return (w?.exercises||[]).filter(exerciseCountsAsResolved).length;
}
function workoutIsFullyResolved(w){
  return Boolean(w?.exercises?.length)&&w.exercises.every(exerciseCountsAsResolved);
}
function firstIncompleteSetIndex(ex){
  const index=(ex?.sets||[]).findIndex(set=>!set.completed);
  return index<0?Math.max(0,(ex?.sets?.length||1)-1):index;
}
function nextUnresolvedExerciseIndex(w,from=-1){
  for(let i=Math.max(0,from+1);i<(w?.exercises?.length||0);i++)if(!exerciseCountsAsResolved(w.exercises[i]))return i;
  for(let i=0;i<=from&&i<(w?.exercises?.length||0);i++)if(!exerciseCountsAsResolved(w.exercises[i]))return i;
  return -1;
}
function pauseInteractiveTimers(w){
  if(!w)return;
  if(w.phase==='rest'&&!Number.isFinite(w.restPausedRemaining))w.restPausedRemaining=restRemaining(w);
  if(w.phase==='timed-set'){
    const snap=timedSetSnapshot(w);
    if(snap)w.timedSetPausedRemaining=snap.remaining;
    w.timedSetEndsAt=null;
  }
  delete w.preSetStartedAt;
}
function announceExercise(ex,prefix='Next exercise'){
  if(!ex)return;
  const target=(ex.sets?.length||0)+' sets of '+String(ex.reps||ex.suggestedReps||'your target');
  const equipment=equipmentRequirement(exerciseSource(ex));
  fireWorkoutSignal('transition','exercise-announce-'+(store.activeWorkout?.id||'')+'-'+ex.id+'-'+Date.now(),{
    voice:prefix+': '+ex.name+'. '+target+'. You will need '+equipment+'.',
    label:'NEXT'
  });
}
let workoutAudioContext=null;
const cueRuntime={lastToken:'',lastVoiceToken:'',lastVisualToken:'',visualTimer:null};

function workoutCueSettings(){
  const saved=store.cueSettings||{};
  return {
    sound:saved.sound!==false,
    voice:saved.voice!==false,
    haptics:saved.haptics!==false,
    flash:saved.flash!==false
  };
}
function ensureWorkoutAudio(){
  if(!workoutCueSettings().sound)return null;
  try{
    const AudioCtor=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtor)return null;
    if(!workoutAudioContext)workoutAudioContext=new AudioCtor();
    if(workoutAudioContext.state==='suspended')workoutAudioContext.resume?.();
    return workoutAudioContext;
  }catch{return null;}
}
function unlockWorkoutCues(){
  ensureWorkoutAudio();
  if(workoutCueSettings().voice&&'speechSynthesis' in window){
    try{window.speechSynthesis.resume?.();}catch{}
  }
}
function speakWorkoutCue(text,token=''){
  if(!text||!workoutCueSettings().voice||!('speechSynthesis' in window)||typeof window.SpeechSynthesisUtterance!=='function')return;
  if(token&&cueRuntime.lastVoiceToken===token)return;
  if(token)cueRuntime.lastVoiceToken=token;
  try{
    window.speechSynthesis.cancel?.();
    const utterance=new window.SpeechSynthesisUtterance(String(text));
    utterance.rate=1.18;
    utterance.pitch=1.02;
    utterance.volume=1;
    window.speechSynthesis.speak(utterance);
  }catch{}
}
function triggerVisualCue(type,label='',token=''){
  if(!workoutCueSettings().flash)return;
  if(token&&cueRuntime.lastVisualToken===token)return;
  if(token)cueRuntime.lastVisualToken=token;
  const root=document.querySelector('.guided-shell');
  if(!root)return;
  const flash=document.querySelector('#workout-cue-flash');
  if(cueRuntime.visualTimer)clearTimeout(cueRuntime.visualTimer);
  root.classList.remove('cue-flash-warning','cue-flash-go','cue-flash-complete','cue-flash-transition');
  void root.offsetWidth;
  const className=type==='go'?'cue-flash-go':type==='complete'?'cue-flash-complete':type==='transition'?'cue-flash-transition':'cue-flash-warning';
  root.classList.add(className);
  if(flash){
    flash.textContent=label||'';
    flash.dataset.cueType=type;
    flash.classList.add('show');
  }
  cueRuntime.visualTimer=setTimeout(()=>{
    root.classList.remove(className);
    flash?.classList.remove('show');
  },type==='go'||type==='complete'?700:440);
}
function fireWorkoutSignal(type,token,{voice='',label=''}={}){
  playWorkoutCue(type,token);
  if(voice)speakWorkoutCue(voice,'voice-'+token);
  triggerVisualCue(type,label,'visual-'+token);
}
function vibrateCue(type){
  if(!workoutCueSettings().haptics||typeof navigator==='undefined'||typeof navigator.vibrate!=='function')return;
  try{
    const pattern=type==='go'?[90,35,140]:type==='complete'?[110,45,110]:type==='transition'?[70,30,70]:type==='warning'?[65]:[45];
    navigator.vibrate(pattern);
  }catch{}
}
function playWorkoutCue(type,token=''){
  if(token&&cueRuntime.lastToken===token)return;
  if(token)cueRuntime.lastToken=token;
  vibrateCue(type);
  const ctx=ensureWorkoutAudio();
  if(!ctx)return;
  try{
    const now=ctx.currentTime;
    const config={
      tick:{frequency:760,duration:.11,volume:.16,harmonic:1.5},
      warning:{frequency:880,duration:.16,volume:.22,harmonic:1.33},
      go:{frequency:1080,duration:.24,volume:.25,harmonic:1.5},
      complete:{frequency:600,duration:.22,volume:.22,harmonic:1.5},
      transition:{frequency:820,duration:.17,volume:.18,harmonic:1.4}
    }[type]||{frequency:760,duration:.12,volume:.15,harmonic:1.5};
    const master=ctx.createGain();
    master.gain.setValueAtTime(.95,now);
    master.gain.exponentialRampToValueAtTime(.0001,now+config.duration);
    master.connect(ctx.destination);

    const primary=ctx.createOscillator();
    const primaryGain=ctx.createGain();
    primary.type=type==='go'?'square':'triangle';
    primary.frequency.setValueAtTime(config.frequency,now);
    primaryGain.gain.setValueAtTime(config.volume,now);
    primary.connect(primaryGain);primaryGain.connect(master);
    primary.start(now);primary.stop(now+config.duration);

    const harmonic=ctx.createOscillator();
    const harmonicGain=ctx.createGain();
    harmonic.type='sine';
    harmonic.frequency.setValueAtTime(config.frequency*config.harmonic,now);
    harmonicGain.gain.setValueAtTime(config.volume*.48,now);
    harmonic.connect(harmonicGain);harmonicGain.connect(master);
    harmonic.start(now);harmonic.stop(now+config.duration);
  }catch{}
}
function toggleCueSetting(key){
  if(!['sound','voice','haptics','flash'].includes(key))return;
  store.cueSettings={...workoutCueSettings(),[key]:!workoutCueSettings()[key]};
  saveStore();
  if((key==='sound'||key==='voice')&&store.cueSettings[key])unlockWorkoutCues();
  if(key==='voice'&&!store.cueSettings.voice&&'speechSynthesis' in window){
    try{window.speechSynthesis.cancel?.();}catch{}
  }
  render();
}
function renderCueControls(){
  const settings=workoutCueSettings();
  const hapticsAvailable=typeof navigator!=='undefined'&&typeof navigator.vibrate==='function';
  const voiceAvailable='speechSynthesis' in window&&typeof window.SpeechSynthesisUtterance==='function';
  return '<div class="cue-controls" aria-label="Workout cue settings">'+
    '<button type="button" data-action="toggle-sound" aria-pressed="'+String(settings.sound)+'"><span>♪</span> Sound '+(settings.sound?'ON':'OFF')+'</button>'+
    '<button type="button" data-action="toggle-voice" aria-pressed="'+String(settings.voice)+'" '+(!voiceAvailable?'disabled title="Voice cues are not supported by this browser"':'')+'><span>◖</span> Voice '+(voiceAvailable?(settings.voice?'ON':'OFF'):'N/A')+'</button>'+
    '<button type="button" data-action="toggle-flash" aria-pressed="'+String(settings.flash)+'"><span>✦</span> Flash '+(settings.flash?'ON':'OFF')+'</button>'+
    '<button type="button" data-action="toggle-haptics" aria-pressed="'+String(settings.haptics)+'" '+(!hapticsAvailable?'disabled title="Vibration is not supported by this browser"':'')+'><span>↯</span> Haptics '+(hapticsAvailable?(settings.haptics?'ON':'OFF'):'N/A')+'</button>'+
    '<button type="button" class="cue-test" data-action="test-cues"><span>▶</span> TEST CUES</button>'+
  '</div>';
}
const MOVEMENT_GUIDANCE = {
  'squat': {
    cue:'Keep your chest tall and let your knees track with your toes.',
    setup:'Set your feet in a stable stance and brace before you descend.',
    steps:['Brace your trunk and keep your whole foot planted.','Lower under control to a comfortable depth.','Drive through the floor and finish tall.'],
    mistake:'Avoid letting the knees collapse inward or rushing the bottom position.'
  },
  'hinge': {
    cue:'Push your hips back and keep the load close to your body.',
    setup:'Stand tall, brace your trunk, and begin with soft knees.',
    steps:['Send the hips backward while keeping a long spine.','Lower only as far as you can maintain control.','Squeeze the glutes and bring the hips forward to stand.'],
    mistake:'Avoid turning the hinge into a squat or rounding through the lower back.'
  },
  'single-leg': {
    cue:'Stay balanced over the working leg and control the descent.',
    setup:'Plant the working foot securely before beginning the rep.',
    steps:['Brace and lower with control.','Keep the front foot planted and knee tracking naturally.','Drive through the working leg to return.'],
    mistake:'Avoid bouncing or allowing the working knee to cave inward.'
  },
  'horizontal-push': {
    cue:'Set your shoulders, lower with control, then press smoothly.',
    setup:'Create a stable base and keep the shoulder blades supported.',
    steps:['Start with wrists stacked and shoulders set.','Lower under control without losing your upper-back position.','Press back to the start without slamming into lockout.'],
    mistake:'Avoid excessive elbow flare or shrugging the shoulders forward.'
  },
  'horizontal-pull': {
    cue:'Lead with your elbows and squeeze your shoulder blades back.',
    setup:'Brace your torso and begin with the shoulders relaxed, not shrugged.',
    steps:['Reach to a controlled starting stretch.','Pull the elbows toward your ribs.','Pause briefly, then return without losing posture.'],
    mistake:'Avoid yanking with momentum or turning the rep into a shrug.'
  },
  'vertical-pull': {
    cue:'Think elbows down toward your ribs instead of pulling with your hands.',
    setup:'Set your grip, keep the chest tall, and brace your trunk.',
    steps:['Begin from a controlled overhead stretch.','Drive the elbows down while keeping the torso stable.','Return slowly until the arms are long again.'],
    mistake:'Avoid swinging backward or jerking the weight.'
  },
  'vertical-push': {
    cue:'Brace your ribs down and press overhead without over-arching.',
    setup:'Start from a stable stance or seat with the weights under control.',
    steps:['Brace before the press.','Press upward through a comfortable path.','Lower slowly back to the starting position.'],
    mistake:'Avoid leaning back excessively to turn the press into an incline press.'
  },
  'hamstring-accessory': {
    cue:'Move slowly and squeeze the hamstrings through the working range.',
    setup:'Adjust the machine or position so your joints line up comfortably.',
    steps:['Begin from a controlled stretch.','Curl through the available range.','Return slowly without dropping the resistance.'],
    mistake:'Avoid using momentum to finish the rep.'
  },
  'quad-accessory': {
    cue:'Extend with control and squeeze the quads without kicking the weight.',
    setup:'Adjust the pad and seat so the knee moves comfortably.',
    steps:['Start from a controlled bent-knee position.','Extend smoothly and squeeze the quads.','Lower slowly to the start.'],
    mistake:'Avoid swinging the weight or snapping into lockout.'
  },
  'shoulder-accessory': {
    cue:'Lead with the elbows and keep the shoulders away from your ears.',
    setup:'Use a light load you can move without momentum.',
    steps:['Start with relaxed shoulders and soft elbows.','Raise through a comfortable shoulder range.','Lower slowly and stay in control.'],
    mistake:'Avoid shrugging or swinging the weight.'
  },
  'biceps': {
    cue:'Keep the upper arm quiet and curl without swinging.',
    setup:'Stand or sit tall with the elbows close to your sides.',
    steps:['Begin with the arm long but controlled.','Curl while keeping the elbow stable.','Squeeze briefly, then lower slowly.'],
    mistake:'Avoid using your hips or shoulders to throw the weight upward.'
  },
  'triceps': {
    cue:'Keep the upper arm stable and finish by straightening the elbow.',
    setup:'Brace your torso and choose a position that keeps the shoulders comfortable.',
    steps:['Start with tension on the triceps.','Extend the elbow through a controlled range.','Return slowly without letting the upper arm drift.'],
    mistake:'Avoid turning the movement into a shoulder swing.'
  },
  'calves': {
    cue:'Use a full controlled range instead of bouncing.',
    setup:'Place the ball of the foot securely and keep the ankle aligned.',
    steps:['Lower the heel into a comfortable stretch.','Rise onto the ball of the foot.','Pause briefly and lower under control.'],
    mistake:'Avoid short, bouncing repetitions.'
  },
  'core': {
    cue:'Brace first and move without losing trunk control.',
    setup:'Set your body position so you can breathe while staying braced.',
    steps:['Create tension through the trunk.','Perform the movement without letting the low back lose control.','Reset your brace before the next rep.'],
    mistake:'Avoid holding your breath or rushing through a position you cannot control.'
  }
};

function exerciseGuidance(ex){
  const base=MOVEMENT_GUIDANCE[ex?.movement]||{
    cue:'Move through a controlled, comfortable range.',
    setup:'Set up securely before beginning the set.',
    steps:['Brace before the movement.','Complete the rep under control.','Return to the starting position smoothly.'],
    mistake:'Avoid using momentum to force the movement.'
  };
  const loadNote=ex?.loadMode==='dumbbell-pair'?'Use the same dumbbell weight in each hand.':
    ex?.loadMode==='barbell'?'Secure the bar and plates before the set.':
    ex?.loadMode==='machine'?'Adjust the seat, pad, and starting position before loading the machine.':
    ex?.loadMode==='band'?'Anchor the band securely and check it before pulling.':
    ex?.loadMode==='assisted'?'Choose enough assistance to keep every rep controlled.':'';
  return {...base,setup:loadNote?base.setup+' '+loadNote:base.setup};
}

function exerciseDescription(ex){
  if(!ex)return 'A controlled movement used in today’s workout.';
  const muscleText=(ex.muscles||[]).slice(0,2).join(' and ').toLowerCase();
  const target=muscleText||'the target muscles';
  const descriptions={
    'squat':'A lower-body squat pattern that builds the quads and glutes while training controlled knee and hip movement.',
    'hinge':'A hip-hinge movement that trains the hamstrings, glutes, and back while keeping the load close and controlled.',
    'single-leg':'A single-leg movement that develops leg strength, balance, and hip stability one side at a time.',
    'horizontal-push':'A pressing movement that trains the chest, shoulders, and triceps by pushing resistance away from the body.',
    'horizontal-pull':'A rowing movement that trains the upper back and arms by pulling resistance toward the torso.',
    'vertical-push':'An overhead pressing pattern that trains the shoulders and triceps while the trunk stays braced.',
    'vertical-pull':'A pulling movement that trains the lats and upper back by driving the elbows down toward the body.',
    'quad-accessory':'A focused leg movement that emphasizes the quadriceps with a controlled range of motion.',
    'hamstring-accessory':'A focused lower-body movement that emphasizes the hamstrings through controlled bending or hinging.',
    'shoulder-accessory':'A lighter shoulder movement used to build control and strength through a comfortable range.',
    'biceps':'An arm exercise that trains the biceps by bending the elbow without swinging the upper arm.',
    'triceps':'An arm exercise that trains the triceps by straightening the elbow under control.',
    'calves':'A lower-leg exercise that trains the calves by raising and lowering the heel through a controlled range.',
    'core':'A trunk-stability exercise that trains the core to resist unwanted movement and maintain position.'
  };
  return descriptions[ex.movement]||('A controlled '+String(movements[ex.movement]||ex.movement||'strength').toLowerCase()+' exercise focused on '+target+'.');
}


const EXERCISE_EQUIPMENT = {
  'goblet-squat':'1 dumbbell or kettlebell',
  'back-squat':'Barbell · squat rack · weight plates',
  'leg-press':'Leg press machine',
  'bodyweight-squat':'No equipment',
  'romanian-deadlift':'Barbell · weight plates',
  'db-rdl':'Pair of dumbbells',
  'hip-thrust':'Barbell · weight plates · bench or hip-thrust station',
  'glute-bridge':'Exercise mat · optional dumbbell',
  'split-squat':'Pair of dumbbells · bench',
  'reverse-lunge':'Optional pair of dumbbells',
  'step-up':'Stable bench or box · optional dumbbells',
  'bench-press':'Flat bench · barbell · rack · weight plates',
  'db-bench':'Flat bench · pair of dumbbells',
  'db-floor-press':'Pair of dumbbells · floor space or mat',
  'chest-press-machine':'Chest press machine',
  'push-up':'Floor space or exercise mat',
  'cable-row':'Seated cable row station · row handle',
  'chest-row':'Incline bench · pair of dumbbells',
  'one-arm-row':'Dumbbell · bench or stable support',
  'band-row':'Resistance band · secure anchor',
  'lat-pulldown':'Lat pulldown machine · pulldown bar',
  'assisted-pullup':'Assisted pull-up machine',
  'pull-up':'Pull-up bar',
  'band-pulldown':'Resistance band · high secure anchor',
  'shoulder-press-machine':'Shoulder press machine',
  'db-shoulder-press':'Pair of dumbbells · bench optional',
  'overhead-press':'Barbell · rack · weight plates',
  'pike-pushup':'Floor space or exercise mat',
  'leg-curl':'Leg curl machine',
  'leg-extension':'Leg extension machine',
  'lateral-raise':'Pair of dumbbells',
  'band-lateral-raise':'Resistance band',
  'biceps-curl':'Pair of dumbbells',
  'cable-curl':'Cable station · curl attachment',
  'triceps-pushdown':'Cable station · rope or bar attachment',
  'db-triceps-extension':'1 dumbbell',
  'calf-raise':'Stable floor · optional pair of dumbbells',
  'plank':'Exercise mat or floor space',
  'dead-bug':'Exercise mat or floor space',
  'cable-crunch':'Cable station · rope attachment',
  'prone-w-raise':'Exercise mat · optional light band',
  'prone-lat-pull':'Exercise mat · optional resistance band',
  'band-overhead-press':'Resistance band'
};

function equipmentRequirement(ex){
  if(!ex)return 'Check the exercise setup.';
  return EXERCISE_EQUIPMENT[ex.id]||
    (ex.loadMode==='barbell'?'Barbell · rack or platform · weight plates':
    ex.loadMode==='dumbbell-pair'?'Pair of dumbbells':
    ex.loadMode==='dumbbell'?'Dumbbell':
    ex.loadMode==='machine'?'Matching resistance machine':
    ex.loadMode==='band'?'Resistance band · secure anchor if needed':
    ex.loadMode==='assisted'?'Assisted exercise machine':
    ex.loadMode==='bodyweight'||ex.loadMode==='timed'?'No special equipment':'Check the exercise setup.');
}
function exerciseSource(ex){
  return catalog.find(item=>item.id===ex?.id)||ex;
}
function exerciseDifficultyRank(value){
  return ({beginner:0,intermediate:1,advanced:2})[value]??1;
}
function muscleOverlap(a,b){
  const left=new Set(a?.muscles||[]);
  return (b?.muscles||[]).reduce((n,m)=>n+(left.has(m)?1:0),0);
}
function excludedExerciseIds(){
  return new Set(store.exercisePreferences?.excluded||[]);
}
function swapCandidates(ex,{includeOtherEquipment=true,limit=7}={}){
  const source=exerciseSource(ex);
  if(!source)return [];
  const profile=store.profile||{};
  const excluded=excludedExerciseIds();
  const activeIds=new Set((store.activeWorkout?.exercises||[]).map(item=>item.id));
  const planIds=new Set((store.plan?.days||[]).flatMap(day=>(day.exercises||[]).map(item=>item.id)));
  const scored=catalog
    .filter(candidate=>candidate.id!==source.id&&!excluded.has(candidate.id))
    .map(candidate=>{
      const sameMovement=candidate.movement===source.movement;
      const overlap=muscleOverlap(source,candidate);
      const available=equipmentAllows(candidate,profile.equipment||'full-gym');
      const difficultyGap=Math.abs(exerciseDifficultyRank(source.difficulty)-exerciseDifficultyRank(candidate.difficulty));
      const setupGap=Math.abs((candidate.setup||25)-(source.setup||25));
      const duplicatePenalty=(activeIds.has(candidate.id)||planIds.has(candidate.id))?6:0;
      const score=(sameMovement?60:0)+(overlap*12)+(available?24:0)+(candidate.style===source.style?4:0)-difficultyGap*5-Math.min(8,setupGap/10)-duplicatePenalty;
      const tier=sameMovement&&overlap?'Same movement + muscles':sameMovement?'Same movement':'Similar training purpose';
      return {exercise:candidate,available,score,tier,setupGap};
    })
    .filter(item=>item.score>18&&(includeOtherEquipment||item.available))
    .sort((a,b)=>(Number(b.available)-Number(a.available))||(b.score-a.score));
  return scored.slice(0,limit);
}
function swapReasonLabel(reason){
  return ({equipment:'Equipment unavailable',dislike:"Don't like this exercise",pain:'Pain or discomfort',difficulty:'Too difficult',easy:'Too easy',other:'Other'})[reason]||'Other';
}

function planSlotFromCandidate(candidate,template){
  const profile=store.profile||{};
  const start=estimateStartingLoad(candidate,profile);
  const settings=goalSettings(profile.goal||'muscle',candidate.movement,profile.experience||'beginner');
  const adaptive=adaptivePrescription(candidate);
  const calibrated=store.calibration?.[candidate.id]?.weight;
  const reps=adaptive?.reps||settings.reps;
  return {
    id:candidate.id,name:candidate.name,movement:candidate.movement,muscles:candidate.muscles,loadMode:candidate.loadMode,
    sets:template.sets,reps:reps,startReps:recommendedRepCount(reps),rest:Math.max(30,Math.min(60,template.rest||settings.rest)),
    setup:template.setup||candidate.setup||25,increment:candidate.increment||5,
    startWeight:adaptive?.weight??calibrated??start.weight,startLabel:adaptive?.label||start.label,startSource:adaptive?'learned progression':start.source||'',
    calibrationRequired:Boolean(start.calibrate&&!calibrated&&!adaptive),
    swappedFrom:{id:template.id,name:template.name},
    swapUndo:clone({...template,swapUndo:undefined})
  };
}
function workoutExerciseFromCandidate(candidate,template,setCount){
  const profile=store.profile||{};
  const start=estimateStartingLoad(candidate,profile);
  const adaptive=adaptivePrescription(candidate);
  const calibrated=store.calibration?.[candidate.id];
  const settings=goalSettings(profile.goal||'muscle',candidate.movement,profile.experience||'beginner');
  const suggestedWeight=adaptive?.weight??calibrated?.weight??start.weight??0;
  const suggestedReps=adaptive?.reps||recommendedRepCount(settings.reps);
  const rest=Math.max(30,Math.min(60,template.rest||settings.rest||45));
  const noWeight=['bodyweight','timed','band'].includes(candidate.loadMode);
  const weightValue=noWeight?'':(candidate.loadMode==='assisted'&&!suggestedWeight?'':String(suggestedWeight||''));
  return {
    id:candidate.id,name:candidate.name,movement:candidate.movement,muscles:candidate.muscles,loadMode:candidate.loadMode,
    reps:settings.reps,rest,setup:template.setup||candidate.setup||25,increment:candidate.increment||5,
    suggestedWeight,suggestedReps,
    adaptiveLabel:adaptive?.label||'',adaptiveReason:adaptive?.reason||'',
    calibrationRequired:Boolean(start.calibrate&&!calibrated&&!adaptive),
    swappedFrom:{id:template.id,name:template.name},
    swapUndo:clone({...template,swapUndo:undefined}),
    sets:Array.from({length:Math.max(1,setCount)},()=>({
      id:uid('set'),weight:weightValue,reps:String(suggestedReps||''),completed:false,completedAt:null
    }))
  };
}
function estimatePlanExerciseSeconds(ex){
  const setSeconds=goalSettings(store.profile?.goal||'muscle',ex.movement,store.profile?.experience||'beginner').setSeconds||40;
  return (ex.setup||25)+(ex.sets||2)*setSeconds+Math.max(0,(ex.sets||2)-1)*(ex.rest||45)+35;
}
function recalculatePlanDay(day){
  if(!day)return;
  day.warmup=buildWarmup(day.exercises||[]);
  day.cooldown=buildCooldown(day.exercises||[]);
  const prep=[...(day.warmup||[]),...(day.cooldown||[])].reduce((sum,item)=>sum+(Number(item.seconds)||0),0);
  const work=(day.exercises||[]).reduce((sum,ex)=>sum+estimatePlanExerciseSeconds(ex),0);
  day.warmupMinutes=Math.ceil((day.warmup||[]).reduce((sum,item)=>sum+(Number(item.seconds)||0),0)/60);
  day.cooldownMinutes=Math.ceil((day.cooldown||[]).reduce((sum,item)=>sum+(Number(item.seconds)||0),0)/60);
  day.estimatedMinutes=Math.max(10,Math.ceil((prep+work)/60));
}
function swapTarget(){
  if(!swapContext)return null;
  if(swapContext.mode==='plan'){
    const day=store.plan?.days?.find(item=>item.id===swapContext.dayId);
    const exercise=day?.exercises?.[swapContext.index];
    return exercise?{exercise,day,index:swapContext.index}:null;
  }
  const workout=store.activeWorkout;
  const exercise=workout?.exercises?.[swapContext.index];
  return exercise?{exercise,workout,index:swapContext.index}:null;
}
function openSwap(context){
  swapContext=context;
  exerciseDetailId=null;
  render();
}
function closeSwap(){
  swapContext=null;
  render();
}
function rememberSwap(original,replacement,reason,mode){
  store.exercisePreferences=store.exercisePreferences||{excluded:[],swapHistory:[]};
  store.exercisePreferences.swapHistory=Array.isArray(store.exercisePreferences.swapHistory)?store.exercisePreferences.swapHistory:[];
  store.exercisePreferences.swapHistory.unshift({
    fromId:original.id,fromName:original.name,toId:replacement.id,toName:replacement.name,
    reason,reasonLabel:swapReasonLabel(reason),mode,at:new Date().toISOString()
  });
  store.exercisePreferences.swapHistory=store.exercisePreferences.swapHistory.slice(0,100);
}
function applyExerciseSwap(candidateId,reason='other',neverShow=false){
  const target=swapTarget();
  const candidate=catalog.find(item=>item.id===candidateId);
  if(!target||!candidate)return;
  const original=target.exercise;
  if(neverShow){
    store.exercisePreferences=store.exercisePreferences||{excluded:[],swapHistory:[]};
    const set=new Set(store.exercisePreferences.excluded||[]);
    set.add(original.id);
    store.exercisePreferences.excluded=[...set];
  }
  if(swapContext.mode==='plan'){
    const replacement=planSlotFromCandidate(candidate,original);
    target.day.exercises[target.index]=replacement;
    recalculatePlanDay(target.day);
    rememberSwap(original,replacement,reason,'plan');
    swapContext=null;
    saveStore();render();
    toast(original.name+' swapped for '+replacement.name+'.');
    return;
  }

  const w=target.workout;
  const completed=(original.sets||[]).filter(set=>set.completed);
  const remaining=Math.max(1,(original.sets?.length||1)-completed.length);
  const replacement=workoutExerciseFromCandidate(candidate,original,remaining);
  rememberSwap(original,replacement,reason,'workout');

  if(target.index>w.currentExerciseIndex){
    w.exercises[target.index]=replacement;
    swapContext=null;
    saveStore();render();
    toast(original.name+' swapped for '+replacement.name+'.');
    return;
  }

  if(completed.length===0){
    w.exercises[target.index]=replacement;
    w.currentExerciseIndex=target.index;
    w.currentSetIndex=0;
    delete w.timedSetStartedAt;delete w.timedSetDuration;delete w.timedSetEndsAt;
    swapContext=null;
    saveStore();
    beginPreSetPosition(target.index,0,false);
    toast(original.name+' swapped for '+replacement.name+'.');
    return;
  }

  original.sets=completed;
  delete original.swapUndo;
  replacement.swapSplitFromIndex=target.index;
  w.exercises.splice(target.index+1,0,replacement);
  swapContext=null;
  saveStore();
  beginPreSetPosition(target.index+1,0,true);
  toast('Completed '+original.name+' sets kept. Remaining work moved to '+replacement.name+'.');
}
function undoExerciseSwap(mode,index,dayId=''){
  if(mode==='plan'){
    const day=store.plan?.days?.find(item=>item.id===dayId);
    const current=day?.exercises?.[index];
    if(!day||!current?.swapUndo)return;
    day.exercises[index]=clone({...current.swapUndo,swapUndo:undefined});
    recalculatePlanDay(day);
    saveStore();render();toast('Exercise swap undone.');
    return;
  }
  const w=store.activeWorkout,current=w?.exercises?.[index];
  if(!w||!current?.swapUndo||(current.sets||[]).some(set=>set.completed))return;
  const restored=clone({...current.swapUndo,swapUndo:undefined,swapSplitFromIndex:undefined});
  if(Number.isInteger(current.swapSplitFromIndex)){
    const originalIndex=current.swapSplitFromIndex;
    const completedCount=(w.exercises[originalIndex]?.sets||[]).filter(set=>set.completed).length;
    w.exercises[originalIndex]=restored;
    w.exercises.splice(index,1);
    w.currentExerciseIndex=originalIndex;
    w.currentSetIndex=Math.min(completedCount,Math.max(0,restored.sets.length-1));
    saveStore();
    beginPreSetPosition(originalIndex,w.currentSetIndex,false);
    toast('Exercise swap undone. Completed sets were restored to the original exercise.');
    return;
  }
  w.exercises[index]=restored;
  w.currentExerciseIndex=index;w.currentSetIndex=0;
  saveStore();
  beginPreSetPosition(index,0,false);
  toast('Exercise swap undone.');
}
function renderSwapModal(){
  const target=swapTarget();
  if(!target)return '';
  const source=exerciseSource(target.exercise);
  const candidates=swapCandidates(source);
  const available=candidates.filter(item=>item.available);
  const other=candidates.filter(item=>!item.available);
  const card=(item,index)=>{
    const ex=item.exercise;
    const src=exerciseImageUrl(ex,0,false),fallback=exerciseImageUrl(ex,0,true);
    return '<article class="swap-option">'+
      '<div class="swap-option-media">'+(src?'<img src="'+esc(src)+'" data-fallback-src="'+esc(fallback)+'" alt="'+esc(ex.name)+' demonstration">':'')+'</div>'+
      '<div class="swap-option-copy"><div class="swap-option-top"><span>'+esc(item.tier)+'</span>'+(index===0&&item.available?'<em>BEST MATCH</em>':'')+'</div>'+
      '<h3>'+esc(ex.name)+'</h3>'+
      '<p>'+esc(exerciseDescription(ex))+'</p>'+
      '<div class="swap-option-meta"><span>'+esc((ex.muscles||[]).join(' · '))+'</span><strong>'+esc(equipmentRequirement(ex))+'</strong></div>'+
      '<button class="button secondary" type="button" data-action="choose-swap" data-candidate-id="'+esc(ex.id)+'">USE THIS EXERCISE</button></div>'+
    '</article>';
  };
  return '<div class="exercise-modal-backdrop swap-modal-backdrop" data-action="close-swap">'+
    '<section class="exercise-modal swap-modal" role="dialog" aria-modal="true" aria-label="Swap '+esc(source.name)+'" data-swap-panel>'+
      '<button class="modal-close" type="button" data-action="close-swap" aria-label="Close exercise swap">×</button>'+
      '<div class="swap-head"><p class="eyebrow">SWAP EXERCISE</p><h2>'+esc(source.name)+'</h2><p>Choose a comparable movement. Your completed work stays intact and replacement loads are recalculated for the new exercise.</p></div>'+
      '<div class="swap-controls"><label>WHY ARE YOU SWAPPING?<select id="swap-reason"><option value="equipment">Equipment unavailable</option><option value="dislike">Don’t like this exercise</option><option value="pain">Pain or discomfort</option><option value="difficulty">Too difficult</option><option value="easy">Too easy</option><option value="other">Other</option></select></label>'+
      '<label class="swap-exclude"><input id="swap-never-show" type="checkbox"> Don’t show me '+esc(source.name)+' again</label></div>'+
      (available.length?'<div class="swap-section"><h3>AVAILABLE WITH YOUR SETUP</h3><div class="swap-options">'+available.map(card).join('')+'</div></div>':'')+
      (other.length?'<div class="swap-section other-equipment"><h3>REQUIRES OTHER EQUIPMENT</h3><div class="swap-options">'+other.map((item,index)=>card(item,index+available.length)).join('')+'</div></div>':'')+
      (!candidates.length?'<div class="empty-state"><strong>No close replacements found.</strong><span>Try changing your equipment profile or keeping this exercise.</span></div>':'')+
    '</section></div>';
}

function exerciseImageUrl(ex,index=0,useFallback=false){
  if(!ex)return '';
  const sourceId=useFallback?exerciseMediaFallbacks[ex.movement]:(exerciseMedia[ex.id]?.sourceId||exerciseMediaFallbacks[ex.movement]);
  return sourceId?EXERCISE_IMAGE_BASE+encodeURIComponent(sourceId)+'/'+index+'.jpg':'';
}

const TIMED_STAGE_MEDIA = {
  'Easy march + arm swing':'Arm_Circles',
  'Bodyweight squat stretch':'Bodyweight_Squat',
  'Dynamic hip hinge reach':'Romanian_Deadlift_from_Deficit',
  'Arm circles + shoulder sweep':'Arm_Circles',
  'Alternating reverse lunge reach':'Crossover_Reverse_Lunge',
  'Chest + shoulder stretch':'Chest_And_Front_Of_Shoulder_Stretch',
  'Lat + upper-back stretch':'Overhead_Lat',
  'Standing quad stretch':'Standing_Elevated_Quad_Stretch',
  'Hamstring stretch':'Hamstring_Stretch',
  'Glute stretch':'IT_Band_and_Glute_Stretch',
  'Calf stretch':'Standing_Gastrocnemius_Calf_Stretch',
  'Full-body reach + breathing':'Upward_Stretch'
};

const TIMED_STAGE_WHY = {
  'Easy march + arm swing':'Gets your whole body moving before the first loaded set.',
  'Bodyweight squat stretch':'Prepares the hips, knees, and ankles for lower-body work.',
  'Dynamic hip hinge reach':'Primes the hamstrings and hinge pattern before loaded pulls.',
  'Arm circles + shoulder sweep':'Warms the shoulders before pressing and pulling.',
  'Alternating reverse lunge reach':'Opens the hips and adds single-leg movement before training.',
  'Chest + shoulder stretch':'Lets the chest and front of the shoulders relax after pressing.',
  'Lat + upper-back stretch':'Lengthens the lats and upper back after rows and pulldowns.',
  'Standing quad stretch':'Gives the quads a gentle post-workout stretch.',
  'Hamstring stretch':'Helps the hamstrings relax after hinges and leg work.',
  'Glute stretch':'Releases the glutes after squats, hinges, and lunges.',
  'Calf stretch':'Lets the calf settle after standing and lower-body work.',
  'Full-body reach + breathing':'Brings your breathing down and finishes the session gradually.'
};

function timedStageImageUrl(item,index=0){
  const mediaId=item?.mediaId||TIMED_STAGE_MEDIA[item?.name];
  return mediaId?EXERCISE_IMAGE_BASE+encodeURIComponent(mediaId)+'/'+index+'.jpg':'';
}

function timedStageWhy(item){
  return item?.why||TIMED_STAGE_WHY[item?.name]||'This step prepares or recovers the muscles used in today’s session.';
}

function timedStageDescription(item){
  return item?.description||item?.cue||'Move through this stretch slowly and stay within a comfortable range.';
}

function exerciseImageButton(ex,className='exercise-media',index=0){
  const src=exerciseImageUrl(ex,index,false);
  const fallback=exerciseImageUrl(ex,index,true);
  if(!src)return '<button class="'+className+' exercise-media missing" type="button" data-exercise-detail="'+esc(ex.id)+'"><span>VIEW FORM</span></button>';
  return '<button class="'+className+' exercise-media" type="button" data-exercise-detail="'+esc(ex.id)+'" aria-label="View '+esc(ex.name)+' instructions">'+
    '<img src="'+esc(src)+'" data-fallback-src="'+esc(fallback)+'" loading="lazy" decoding="async" alt="'+esc(ex.name)+' exercise demonstration">'+
    '<span class="media-hint">VIEW FORM</span></button>';
}

function renderExerciseModal(){
  if(!exerciseDetailId)return '';
  const ex=catalog.find(item=>item.id===exerciseDetailId)||store.activeWorkout?.exercises?.find(item=>item.id===exerciseDetailId);
  if(!ex)return '';
  const guide=exerciseGuidance(ex);
  const primary=exerciseImageUrl(ex,0,false),secondary=exerciseImageUrl(ex,1,false);
  const primaryFallback=exerciseImageUrl(ex,0,true),secondaryFallback=exerciseImageUrl(ex,1,true);
  const images=[
    primary?'<img src="'+esc(primary)+'" data-fallback-src="'+esc(primaryFallback)+'" alt="'+esc(ex.name)+' starting position">':'',
    secondary?'<img src="'+esc(secondary)+'" data-fallback-src="'+esc(secondaryFallback)+'" alt="'+esc(ex.name)+' finishing position">':''
  ].join('');
  return '<div class="exercise-modal-backdrop" data-action="close-details">'+
    '<section class="exercise-modal" role="dialog" aria-modal="true" aria-label="'+esc(ex.name)+' exercise instructions" data-modal-panel>'+
      '<button class="modal-close" type="button" data-action="close-details" aria-label="Close exercise instructions">×</button>'+
      '<div class="exercise-modal-media">'+images+'</div>'+
      '<div class="exercise-modal-copy">'+
        '<p class="eyebrow">'+esc(movements[ex.movement]||ex.movement)+'</p>'+
        '<h2>'+esc(ex.name)+'</h2>'+
        '<p class="modal-muscles">'+(ex.muscles||[]).map(esc).join(' · ')+'</p>'+
        '<p class="exercise-description modal-description">'+esc(exerciseDescription(ex))+'</p>'+
        '<div class="coach-cue"><span>COACHING CUE</span><strong>'+esc(guide.cue)+'</strong></div>'+
        '<div class="instruction-block"><h3>Set up</h3><p>'+esc(guide.setup)+'</p></div>'+
        '<div class="instruction-block"><h3>How to move</h3><ol>'+guide.steps.map(step=>'<li>'+esc(step)+'</li>').join('')+'</ol></div>'+
        '<div class="instruction-block caution"><h3>Watch for</h3><p>'+esc(guide.mistake)+'</p></div>'+
        renderExerciseHistoryPanel(ex)+
        '<p class="media-credit">Exercise imagery: Free Exercise DB · public-domain dataset.</p>'+
      '</div>'+
    '</section>'+
  '</div>';
}


function goalSettings(goal,movement,experience){
  const accessory = ['biceps','triceps','calves','core','shoulder-accessory','quad-accessory','hamstring-accessory'].includes(movement);
  const compound = ['squat','hinge','single-leg','horizontal-push','horizontal-pull','vertical-push','vertical-pull'].includes(movement);
  const newLifter = experience === 'new';
  if (goal === 'strength') return {sets:accessory?2:(newLifter?2:3),reps:accessory?'8–12':'6–8',rest:accessory?30:(compound?60:45),setSeconds:40};
  if (goal === 'fat-loss') return {sets:newLifter?2:3,reps:accessory?'12–15':'10–15',rest:accessory?30:45,setSeconds:42};
  if (goal === 'general') return {sets:newLifter?2:3,reps:accessory?'10–15':'8–12',rest:accessory?30:(compound?45:30),setSeconds:40};
  return {sets:newLifter?2:3,reps:accessory?'10–15':'8–12',rest:accessory?30:(compound?60:45),setSeconds:42};
}

function recommendedRepCount(reps){
  const nums=String(reps).match(/\d+/g)?.map(Number) || [];
  if(!nums.length) return '';
  if(String(reps).toLowerCase().includes('sec')) return String(nums[0]);
  if(nums.length===1) return String(nums[0]);
  return String(Math.max(nums[0],Math.round((nums[0]+nums[1])/2)));
}
function repBounds(reps){
  const nums=String(reps||'').match(/\d+/g)?.map(Number)||[];
  if(!nums.length)return {low:0,high:0};
  if(nums.length===1)return {low:nums[0],high:nums[0]};
  return {low:Math.min(nums[0],nums[1]),high:Math.max(nums[0],nums[1])};
}
function isWeightedMode(mode){
  return ['barbell','dumbbell','dumbbell-pair','machine'].includes(mode);
}
function completedExerciseStats(ex){
  const sets=(ex?.sets||[]).filter(set=>set.completed);
  const reps=sets.map(set=>num(set.reps));
  const weights=sets.map(set=>num(set.weight));
  const bounds=repBounds(ex?.reps);
  const lastWeight=weights.length?weights[weights.length-1]:num(ex?.suggestedWeight);
  const firstReps=reps[0]||0,lastReps=reps[reps.length-1]||0;
  return {
    sets:sets,reps:reps,weights:weights,low:bounds.low,high:bounds.high,lastWeight:lastWeight,firstReps:firstReps,lastReps:lastReps,
    allAtTop:Boolean(sets.length&&bounds.high&&reps.every(value=>value>=bounds.high)),
    allAtLeastLow:Boolean(sets.length&&bounds.low&&reps.every(value=>value>=bounds.low)),
    missedLow:bounds.low?reps.filter(value=>value<bounds.low).length:0,
    repDrop:Math.max(0,firstReps-lastReps)
  };
}
function minimumLoad(ex){
  if(ex?.loadMode==='barbell')return 45;
  if(ex?.loadMode?.includes('dumbbell'))return 5;
  return Math.max(0,ex?.increment||5);
}
function adaptivePrescription(ex){
  const saved=store.progression?.[ex.id];
  if(!saved)return null;
  return {
    weight:Number.isFinite(saved.weight)?saved.weight:num(saved.weight),
    reps:saved.reps||'',
    rest:saved.rest||ex.rest,
    label:saved.label||'',
    reason:saved.reason||'',
    feedback:saved.feedback||''
  };
}

function planPrescriptionHtml(ex){
  const adaptive=adaptivePrescription(ex);
  if(adaptive){
    return '<small class="adaptive-plan-note"><strong>NEXT: '+esc(adaptive.label)+'</strong><em>'+esc(adaptive.reason)+'</em></small>';
  }
  const calibrated=store.calibration[ex.id]?.weight;
  const start=calibrated?((ex.loadMode==='dumbbell-pair'?calibrated+' lb each':calibrated+' lb')+' · calibrated'):ex.startLabel;
  return '<small>Start: '+esc(start)+' × '+esc(ex.startReps||recommendedRepCount(ex.reps))+'</small>';
}

function currentPrescriptionLabel(ex){
  if(ex.adaptiveLabel)return ex.adaptiveLabel;
  return suggestedLabel(ex)+' × '+String(ex.suggestedReps||recommendedRepCount(ex.reps))+' reps';
}
function progressionLabel(ex,weight,reps,labelOverride){
  if(labelOverride)return labelOverride;
  if(ex.loadMode==='timed')return String(reps||recommendedRepCount(ex.reps))+' sec';
  if(ex.loadMode==='bodyweight')return 'Bodyweight × '+String(reps||recommendedRepCount(ex.reps));
  if(ex.loadMode==='band')return 'Band resistance';
  if(ex.loadMode==='assisted')return weight?String(weight)+' lb assistance':'Choose assistance';
  if(ex.loadMode==='dumbbell-pair')return String(weight||0)+' lb each × '+String(reps||recommendedRepCount(ex.reps));
  return weight?String(weight)+' lb × '+String(reps||recommendedRepCount(ex.reps)):String(reps||recommendedRepCount(ex.reps))+' reps';
}
function feedbackLabel(value){
  return ({'too-easy':'Too easy',good:'Good',hard:'Hard, completed','too-hard':'Too hard','form-off':'Form felt off'})[value]||value||'Feedback';
}
function computeProgression(ex,feedback){
  const stats=completedExerciseStats(ex);
  const previous=store.progression?.[ex.id]||{};
  const increment=Math.max(1,num(ex.increment)||5);
  const baseWeight=stats.lastWeight||num(ex.suggestedWeight);
  let nextWeight=baseWeight;
  let nextReps=String(ex.suggestedReps||recommendedRepCount(ex.reps)||stats.high||stats.lastReps||'');
  let nextRest=Math.max(30,Math.min(60,num(ex.rest)||45));
  let labelOverride='';
  let reason='';
  const hardStreak=feedback==='hard'?(num(previous.hardStreak)+1):0;

  if(stats.repDrop>=3&&nextRest<60)nextRest=Math.min(60,nextRest+15);

  if(ex.loadMode==='timed'){
    const seconds=Math.max(5,stats.lastReps||num(nextReps)||30);
    if(feedback==='too-easy'){nextReps=String(seconds+10);reason='You rated the timed set too easy, so the next target adds 10 seconds.';}
    else if(feedback==='good'&&stats.allAtTop){nextReps=String(seconds+5);reason='You owned the target, so the next timed effort adds 5 seconds.';}
    else if(feedback==='too-hard'){nextReps=String(Math.max(5,seconds-10));reason='You rated it too hard, so the next timed target is shorter.';}
    else{nextReps=String(seconds);reason=feedback==='form-off'?'Keeping the same time while you clean up technique.':'Keeping the same time and building consistency.';}
  }else if(ex.loadMode==='bodyweight'){
    const current=Math.max(1,stats.lastReps||num(nextReps)||stats.high||8);
    if(feedback==='too-easy'||(feedback==='good'&&stats.allAtTop)){
      nextReps=String(current+2);
      reason=feedback==='too-easy'?'Bodyweight work felt too easy, so the next target adds 2 reps.':'You reached the top of the rep range across the exercise, so the next target adds 2 reps.';
    }else if(feedback==='too-hard'){
      nextReps=String(Math.max(1,current-2));
      reason='You rated it too hard, so the next bodyweight target drops by 2 reps.';
    }else{
      nextReps=String(current);
      reason=feedback==='form-off'?'Keeping the same rep target while you clean up technique.':'Keeping the same bodyweight target until it is clearly ready to progress.';
    }
  }else if(ex.loadMode==='band'){
    if(feedback==='too-easy'||(feedback==='good'&&stats.allAtTop)){labelOverride='Use the next stronger band';reason='The current band is ready to progress.';}
    else if(feedback==='too-hard'){labelOverride='Use a lighter band';reason='You rated the current resistance too hard.';}
    else{labelOverride='Use the same band';reason=feedback==='form-off'?'Keep the band the same while you clean up technique.':'Keep the same resistance and build consistency.';}
  }else if(ex.loadMode==='assisted'){
    if(baseWeight>0){
      if(feedback==='too-easy'||(feedback==='good'&&stats.allAtTop)){nextWeight=Math.max(0,roundTo(Math.max(0,baseWeight-increment),increment));reason='You are ready for less assistance next time.';}
      else if(feedback==='too-hard'){nextWeight=roundTo(baseWeight+increment,increment);reason='You rated it too hard, so the next session uses more assistance.';}
      else{reason=feedback==='form-off'?'Keeping assistance steady while you clean up technique.':'Keeping the same assistance and building reps.';}
    }else{
      labelOverride=feedback==='too-easy'?'Use slightly less assistance':feedback==='too-hard'?'Use slightly more assistance':'Use the same assistance';
      reason='Assistance changes are directional until you enter a numeric assistance amount.';
    }
  }else{
    const minLoad=minimumLoad(ex);
    if(feedback==='too-easy'){nextWeight=roundTo(baseWeight+increment,increment);nextReps=String(stats.low||num(nextReps)||1);reason='You rated the exercise too easy, so the next session moves up one load increment and resets to the bottom of the rep range.';}
    else if(feedback==='good'&&stats.allAtTop){nextWeight=roundTo(baseWeight+increment,increment);nextReps=String(stats.low||num(nextReps)||1);reason='You reached the top of the rep range on every completed set, so the next session moves up one increment and resets to the bottom of the range.';}
    else if(feedback==='too-hard'){nextWeight=Math.max(minLoad,roundTo(Math.max(minLoad,baseWeight-increment),increment));nextReps=String(stats.low||num(nextReps)||1);reason='You rated the exercise too hard, so the next session drops one load increment and targets the bottom of the rep range.';}
    else if(feedback==='hard'&&hardStreak>=2&&stats.missedLow>=2){nextWeight=Math.max(minLoad,roundTo(Math.max(minLoad,baseWeight-increment),increment));nextReps=String(stats.low||num(nextReps)||1);reason='This has been hard across repeated sessions and reps fell below target, so the next session backs off one increment and resets to the bottom of the range.';}
    else if(feedback==='form-off'){reason='Keeping the same load while you clean up technique before progressing.';}
    else if(feedback==='hard'){reason='Hard but completed is not a failure. Keep the same load and try to make the reps cleaner next time.';}
    else{reason=stats.allAtLeastLow?'You completed the target range. Keep this load until every set reaches the top of the range.':'Keep the same load and build the reps into the target range.';}
  }

  if(stats.repDrop>=3&&nextRest>num(ex.rest||45))reason+=' Rest moves to '+String(nextRest)+'s because reps dropped across sets.';
  return {
    exerciseId:ex.id,name:ex.name,feedback:feedback,weight:nextWeight,reps:nextReps,rest:nextRest,
    label:progressionLabel(ex,nextWeight,nextReps,labelOverride),reason:reason,hardStreak:hardStreak,
    updatedAt:new Date().toISOString(),session:{reps:stats.reps,weights:stats.weights}
  };
}

function buildWarmup(exercises){
  const moves=new Set(exercises.map(e=>e.movement));
  const items=[{
    name:'Easy march + arm swing',
    seconds:30,
    description:'March in place while swinging the arms naturally to gradually raise your heart rate and loosen the whole body.',
    cue:'Raise your temperature and breathe easily.',
    why:'Gets your whole body moving before the first loaded set.',
    mediaId:'Arm_Circles'
  }];
  if([...moves].some(m=>['squat','single-leg','quad-accessory'].includes(m))) items.push({
    name:'Bodyweight squat stretch',
    seconds:30,
    description:'Move through easy bodyweight squats to warm the hips, knees, and ankles before loaded lower-body work.',
    cue:'Controlled depth, knees tracking comfortably.',
    why:'Prepares the hips, knees, and ankles for lower-body work.',
    mediaId:'Bodyweight_Squat'
  });
  if([...moves].some(m=>['hinge','hamstring-accessory'].includes(m))) items.push({
    name:'Dynamic hip hinge reach',
    seconds:30,
    description:'Practice a gentle hip hinge by reaching the hips back and returning tall, keeping the movement smooth and unloaded.',
    cue:'Soft knees, reach hips back, stand tall.',
    why:'Primes the hamstrings and hinge pattern before loaded pulls.',
    mediaId:'Romanian_Deadlift_from_Deficit'
  });
  if([...moves].some(m=>['horizontal-push','horizontal-pull','vertical-push','vertical-pull','shoulder-accessory'].includes(m))) items.push({
    name:'Arm circles + shoulder sweep',
    seconds:30,
    description:'Circle and sweep the arms through a comfortable range to warm the shoulders before pressing or pulling.',
    cue:'Small circles into larger comfortable circles.',
    why:'Warms the shoulders before pressing and pulling.',
    mediaId:'Arm_Circles'
  });
  if(items.length<4) items.push({
    name:'Alternating reverse lunge reach',
    seconds:30,
    description:'Step back into an alternating reverse lunge while reaching to open the hips and prepare each leg individually.',
    cue:'Move slowly through a comfortable range.',
    why:'Opens the hips and adds single-leg movement before training.',
    mediaId:'Crossover_Reverse_Lunge'
  });
  return items.slice(0,4);
}

function buildCooldown(exercises){
  const muscles=new Set(exercises.flatMap(e=>e.muscles||[]));
  const items=[];
  if(muscles.has('Chest')||muscles.has('Shoulders')) items.push({
    name:'Chest + shoulder stretch',
    seconds:30,
    description:'Use a comfortable chest-opening position to gently lengthen the chest and front of the shoulders after pressing.',
    cue:'Gentle stretch only, no forcing the range.',
    why:'Lets the chest and front of the shoulders relax after pressing.',
    mediaId:'Chest_And_Front_Of_Shoulder_Stretch'
  });
  if(muscles.has('Back')||muscles.has('Lats')) items.push({
    name:'Lat + upper-back stretch',
    seconds:30,
    description:'Reach into a relaxed upper-back and lat stretch, allowing the shoulders to settle while you breathe slowly.',
    cue:'Breathe slowly and let the shoulders relax.',
    why:'Lengthens the lats and upper back after rows and pulldowns.',
    mediaId:'Overhead_Lat'
  });
  if(muscles.has('Quads')) items.push({
    name:'Standing quad stretch',
    seconds:30,
    description:'Stand tall and gently bend one knee to stretch the front of the thigh without pulling aggressively.',
    cue:'Keep knees close and posture tall.',
    why:'Gives the quads a gentle post-workout stretch.',
    mediaId:'Standing_Elevated_Quad_Stretch'
  });
  if(muscles.has('Hamstrings')) items.push({
    name:'Hamstring stretch',
    seconds:30,
    description:'Hinge forward gently with a long spine until you feel a mild stretch through the back of the thigh.',
    cue:'Hinge gently until you feel light tension.',
    why:'Helps the hamstrings relax after hinges and leg work.',
    mediaId:'Hamstring_Stretch'
  });
  if(muscles.has('Glutes')) items.push({
    name:'Glute stretch',
    seconds:30,
    description:'Settle into a comfortable hip position that creates a gentle stretch through the glutes without forcing the joint.',
    cue:'Stay relaxed and avoid forcing the hip.',
    why:'Releases the glutes after squats, hinges, and lunges.',
    mediaId:'IT_Band_and_Glute_Stretch'
  });
  if(muscles.has('Calves')) items.push({
    name:'Calf stretch',
    seconds:30,
    description:'Keep the heel planted while leaning into a gentle calf stretch, using steady breathing instead of bouncing.',
    cue:'Keep the heel down and breathe steadily.',
    why:'Lets the calf settle after standing and lower-body work.',
    mediaId:'Standing_Gastrocnemius_Calf_Stretch'
  });
  if(items.length<3) items.push({
    name:'Full-body reach + breathing',
    seconds:30,
    description:'Reach tall, breathe slowly, and let the shoulders relax to bring the session down gradually.',
    cue:'Slow inhale, longer exhale, relax the shoulders.',
    why:'Brings your breathing down and finishes the session gradually.',
    mediaId:'Upward_Stretch'
  });
  return items.slice(0,4);
}

function equipmentAllows(exercise,equipment){
  if (equipment === 'full-gym') return exercise.equipment.includes('full-gym');
  return exercise.equipment.includes(equipment);
}

function avoided(exercise,profile){
  if(excludedExerciseIds().has(exercise.id))return true;
  const avoid = profile.avoid || [];
  if (avoid.includes('overhead') && exercise.movement === 'vertical-push') return true;
  if (avoid.includes('knee') && ['squat','single-leg','quad-accessory'].includes(exercise.movement)) return true;
  if (avoid.includes('hinge') && ['hinge','hamstring-accessory'].includes(exercise.movement)) return true;
  if (avoid.includes('floor') && ['plank','dead-bug','glute-bridge','db-floor-press','push-up'].includes(exercise.id)) return true;
  return false;
}

function exerciseScore(exercise,profile,used){
  let score=0;
  if (!used.has(exercise.id)) score+=8;
  if (profile.experience === 'new' && exercise.difficulty === 'beginner') score+=7;
  if (profile.style === 'machines' && exercise.style === 'machine') score+=6;
  if (profile.style === 'free' && exercise.style === 'free') score+=6;
  if (profile.style === 'mixed') score+=2;
  if (exercise.style === 'bodyweight' && profile.equipment === 'bodyweight') score+=8;
  return score;
}

function pickExercise(pattern,profile,used){
  const allowed=e=>equipmentAllows(e,profile.equipment)&&!avoided(e,profile)&&!used.has(e.id);
  let candidates=catalog.filter(e=>e.movement===pattern&&allowed(e));
  if (!candidates.length && pattern === 'quad-accessory') candidates=catalog.filter(e=>e.movement==='squat'&&allowed(e));
  if (!candidates.length && pattern === 'hamstring-accessory') candidates=catalog.filter(e=>e.movement==='hinge'&&allowed(e));
  if (!candidates.length && pattern === 'shoulder-accessory') candidates=catalog.filter(e=>e.movement==='vertical-push'&&allowed(e));
  candidates.sort((a,b)=>exerciseScore(b,profile,used)-exerciseScore(a,profile,used));
  return candidates[0] || null;
}

function estimateStartingLoad(exercise,profile){
  if (exercise.loadMode === 'bodyweight') return {weight:0,label:'Bodyweight',calibrate:false};
  if (exercise.loadMode === 'timed') return {weight:0,label:'Bodyweight · timed',calibrate:false};
  if (exercise.loadMode === 'band') return {weight:0,label:'Light–medium band',calibrate:false};
  if (exercise.loadMode === 'assisted') return {weight:0,label:'Choose comfortable assistance',calibrate:true};
  const known = exercise.referenceKey && num(profile.lifts?.[exercise.referenceKey]);
  let raw=0;
  let source='body weight estimate';
  if (known && exercise.referenceMultiplier) {
    raw=known*exercise.referenceMultiplier;
    source='based on your recent lift';
  } else {
    const exp={new:.70,beginner:.85,intermediate:1,advanced:1.1}[profile.experience] || .8;
    raw=num(profile.weight)*num(exercise.baseLoadFactor)*exp;
  }
  if (exercise.loadMode === 'barbell') raw=Math.max(45,raw);
  if (exercise.loadMode.includes('dumbbell')) raw=Math.max(5,raw);
  const weight=roundTo(raw,exercise.increment||5);
  const each=exercise.loadMode==='dumbbell-pair';
  return {weight,label:`${weight} lb${each?' each':''}`,source,calibrate:true};
}

function estimateExerciseSeconds(item){
  const settings=item.settings;
  return (item.setup||25) + settings.sets*settings.setSeconds + Math.max(0,settings.sets-1)*settings.rest + 35;
}

function buildDay(blueprint,profile,index){
  const used=new Set();
  const selected=[];
  const budget=Math.max(20,num(profile.minutes)||45)*60;
  const targetFloor=budget*.93;
  const targetCeiling=budget*1.03;
  const maxExercises=profile.minutes<=20?3:profile.minutes<=30?5:profile.minutes<=45?8:profile.minutes<=60?10:12;

  const prepForSelected=()=>{
    const warmup=buildWarmup(selected);
    const cooldown=buildCooldown(selected);
    return {warmup,cooldown,seconds:[...warmup,...cooldown].reduce((sum,item)=>sum+(Number(item.seconds)||0),0)};
  };
  const total=()=>prepForSelected().seconds+selected.reduce((sum,e)=>sum+estimateExerciseSeconds(e),0);
  const addMovement=pattern=>{
    const exercise=pickExercise(pattern,profile,used);
    if(!exercise)return false;
    used.add(exercise.id);
    const settings=goalSettings(profile.goal,exercise.movement,profile.experience);
    selected.push({...exercise,settings:{...settings},start:estimateStartingLoad(exercise,profile)});
    return true;
  };

  // Cycle the workout's intended movement patterns so longer sessions gain
  // additional non-duplicate exercises instead of simply stopping early.
  const patternQueue=[];
  for(let round=0;round<3;round++) for(const pattern of blueprint.patterns) patternQueue.push(pattern);
  for(const pattern of patternQueue){
    if(selected.length>=maxExercises)break;
    addMovement(pattern);
    if(selected.length>=2&&total()>=targetFloor)break;
  }

  // If equipment limits prevent more exercise variety, use a little more
  // volume before accepting a session that is substantially shorter than requested.
  let changed=true;
  while(total()<targetFloor&&changed){
    changed=false;
    for(const exercise of selected){
      if(total()>=targetFloor)break;
      const current=exercise.settings.sets||2;
      if(current>=4)continue;
      exercise.settings.sets=current+1;
      if(total()>targetCeiling){
        exercise.settings.sets=current;
        continue;
      }
      changed=true;
    }
  }

  // Hard cap: trim set volume first, then the last exercise if the estimate
  // exceeds the user's selected session length.
  for(let i=selected.length-1;i>=0&&total()>targetCeiling;i--){
    while(selected[i]?.settings?.sets>2&&total()>targetCeiling)selected[i].settings.sets-=1;
  }
  while(selected.length>2&&total()>targetCeiling)selected.pop();

  const prep=prepForSelected();
  const estimatedSeconds=prep.seconds+selected.reduce((sum,e)=>sum+estimateExerciseSeconds(e),0);
  return {
    id:`day-${index+1}`,
    name:blueprint.name,
    focus:blueprint.focus,
    targetMinutes:profile.minutes,
    warmup:prep.warmup,
    cooldown:prep.cooldown,
    warmupMinutes:Math.ceil(prep.warmup.reduce((sum,item)=>sum+(Number(item.seconds)||0),0)/60),
    cooldownMinutes:Math.ceil(prep.cooldown.reduce((sum,item)=>sum+(Number(item.seconds)||0),0)/60),
    estimatedMinutes:Math.max(10,Math.ceil(estimatedSeconds/60)),
    exercises:selected.map(e=>({
      id:e.id,name:e.name,movement:e.movement,muscles:e.muscles,loadMode:e.loadMode,
      sets:e.settings.sets,reps:e.settings.reps,startReps:recommendedRepCount(e.settings.reps),rest:Math.max(30,Math.min(60,e.settings.rest)),
      setup:e.setup||25,increment:e.increment||5,
      startWeight:e.start.weight,startLabel:e.start.label,startSource:e.start.source||'',
      calibrationRequired:e.start.calibrate
    }))
  };
}

function generatePlan(profile){
  const blueprints=BLUEPRINTS[profile.days] || BLUEPRINTS[4];
  return {
    id:uid('plan'),
    createdAt:new Date().toISOString(),
    goal:profile.goal,
    daysPerWeek:profile.days,
    workoutDays:preferredWorkoutDays(profile),
    minutes:profile.minutes,
    days:blueprints.map((b,i)=>buildDay(b,profile,i))
  };
}

function planGoalLabel(goal){
  return ({muscle:'Build muscle',strength:'Get stronger','fat-loss':'Fat loss + conditioning',general:'General fitness'})[goal] || goal;
}
function experienceLabel(v){ return ({new:'New to lifting',beginner:'Beginner',intermediate:'Intermediate',advanced:'Advanced'})[v]||v; }
function equipmentLabel(v){ return ({'full-gym':'Full gym',dumbbells:'Dumbbells',bodyweight:'Bodyweight',bands:'Resistance bands','mixed-home':'Home mix'})[v]||v; }

function nextPlanDay(){
  return nextScheduledSession()?.adaptedDay||store.plan?.days?.[0]||null;
}

function plannedWarmup(day){
  return day?.warmup?.length?day.warmup:buildWarmup(day?.exercises||[]);
}
function plannedCooldown(day){
  return day?.cooldown?.length?day.cooldown:buildCooldown(day?.exercises||[]);
}
function renderPlanTimedRow(item,type,index){
  const image=timedStageImageUrl(item,0);
  return `<div class="plan-prep-row ${type}">
    <div class="plan-prep-media">${image?`<img src="${esc(image)}" loading="lazy" decoding="async" alt="${esc(item.name)} demonstration">`:''}</div>
    <div class="plan-prep-copy">
      <span>${type==='warmup'?'WARM-UP':'COOLDOWN'} ${index+1}</span>
      <strong>${esc(item.name)}</strong>
      <small class="plan-description">${esc(timedStageDescription(item))}</small>
      <small>${esc(item.cue||'Move through a comfortable range.')}</small>
    </div>
    <em>${Number(item.seconds)||30}s</em>
  </div>`;
}

function saveProfileFromForm(form){
  if(!form){toast('Plan builder could not find the profile form. Reload this page and try again.');return false;}
  let data;
  try{
    data=new FormData(form);
  }catch{
    toast('Chrome could not read the plan form. Reload this page and try again.');
    return false;
  }
  const profile={
    goal:data.get('goal')||'muscle',
    weight:num(data.get('weight')),
    heightFeet:num(data.get('heightFeet')),
    heightInches:num(data.get('heightInches')),
    ageRange:data.get('ageRange')||'25-34',
    experience:data.get('experience')||'new',
    days:num(data.get('days'))||4,
    workoutDays:data.getAll('workoutDays'),
    minutes:num(data.get('minutes'))||45,
    equipment:data.get('equipment')||'full-gym',
    style:data.get('style')||'mixed',
    avoid:data.getAll('avoid'),
    lifts:{
      bench:num(data.get('bench')),
      squat:num(data.get('squat')),
      deadlift:num(data.get('deadlift')),
      overhead:num(data.get('overhead')),
      row:num(data.get('row'))
    }
  };
  if(profile.workoutDays.length!==profile.days){
    toast('Choose exactly '+profile.days+' training days for your weekly schedule.');
    form.querySelector('.schedule-day-picker')?.scrollIntoView({behavior:'smooth',block:'center'});
    return false;
  }
    if(profile.weight<50||profile.weight>700){
    toast('Enter a body weight between 50 and 700 lb.');
    form.querySelector('[name="weight"]')?.scrollIntoView({behavior:'smooth',block:'center'});
    return false;
  }
  if(profile.heightFeet&&(profile.heightFeet<3||profile.heightFeet>8)){
    toast('Enter height feet between 3 and 8, or leave height blank.');
    return false;
  }
  if(profile.heightInches<0||profile.heightInches>11){
    toast('Enter height inches between 0 and 11.');
    return false;
  }
  let plan;
  try{
    plan=generatePlan(profile);
  }catch(error){
    console.error('Workout plan generation failed',error);
    toast('Could not build the plan. Please reload and try again.');
    return false;
  }
  if(!plan?.days?.length||plan.days.every(day=>!day.exercises?.length)){
    toast('No exercises matched those settings. Try another equipment option or fewer exclusions.');
    return false;
  }
  store.profile=profile;
  store.plan=plan;
  store.trainingProgram={scheduleOverrides:{},weekReviews:{}};
  const persisted=saveStore();
  currentTab='home';
  render();
  if(!persisted){
    setTimeout(()=>toast('Plan built. Chrome blocked local saving, so keep this tab open to preserve this session.'),100);
  }
  return true;
}

function editProfile(){
  if (store.activeWorkout) { toast('Finish or discard the active workout before rebuilding the plan.'); return; }
  currentTab='profile';
  render();
}

function regeneratePlan(){
  if (!store.profile || store.activeWorkout) return;
  store.plan=generatePlan(store.profile);
  store.trainingProgram={scheduleOverrides:{},weekReviews:{}};
  saveStore();
  toast('Plan rebuilt from your profile.');
  render();
}

function readinessScore(readiness){
  const values=[num(readiness?.energy),num(readiness?.sleep),6-num(readiness?.soreness)].filter(v=>v>0);
  return values.length?Math.round((values.reduce((a,b)=>a+b,0)/values.length)*10)/10:3;
}
function applyReadinessToDay(day,readiness){
  const adjusted=clone(day);
  const score=readinessScore(readiness);
  const available=Math.max(15,num(readiness?.timeAvailable)||num(store.profile?.minutes)||45);
  const notes=[];
  if(score<2.7){
    for(const ex of adjusted.exercises){
      if(ACCESSORY_MOVEMENTS.has(ex.movement)&&ex.sets>2)ex.sets-=1;
    }
    notes.push('Today’s readiness is lower, so accessory volume was trimmed.');
  }
  recalculatePlanDay(adjusted);
  while(adjusted.estimatedMinutes>available&&adjusted.exercises.length>2){
    const index=[...adjusted.exercises].reverse().findIndex(ex=>ACCESSORY_MOVEMENTS.has(ex.movement));
    if(index<0)break;
    adjusted.exercises.splice(adjusted.exercises.length-1-index,1);
    recalculatePlanDay(adjusted);
  }
  for(let i=adjusted.exercises.length-1;i>=0&&adjusted.estimatedMinutes>available;i--){
    while(adjusted.exercises[i]?.sets>2&&adjusted.estimatedMinutes>available){
      adjusted.exercises[i].sets-=1;
      recalculatePlanDay(adjusted);
    }
  }
  if(adjusted.estimatedMinutes>available)notes.push('This session is already at its minimum useful structure, so the estimate may run slightly past your available time.');
  else if(available<num(store.profile?.minutes)||45)notes.push('The session was shortened to fit the time you have today.');
  adjusted.readinessNotes=notes;
  adjusted.readinessScore=score;
  adjusted.availableMinutes=available;
  return adjusted;
}
function scheduledEntryFor(dayId,scheduledDate=''){
  const key=scheduledDate||dateKey();
  return currentWeekSchedule(dateFromKey(key)).find(entry=>entry.day.id===dayId&&entry.dateKey===key)||
    currentWeekSchedule(dateFromKey(key)).find(entry=>entry.day.id===dayId)||null;
}
function openReadiness(dayId,scheduledDate=''){
  if(store.activeWorkout){currentTab='workout';render();toast('Resume or finish your current workout first.');return;}
  const entry=scheduledEntryFor(dayId,scheduledDate);
  const baseDay=entry?.adaptedDay||adaptDayForProgramWeek(store.plan?.days?.find(day=>day.id===dayId),scheduledDate?dateFromKey(scheduledDate):new Date());
  if(!baseDay)return;
  readinessContext={dayId,scheduledDate:scheduledDate||entry?.dateKey||dateKey(),day:baseDay};
  render();
}
function closeReadiness(){readinessContext=null;render();}
function renderReadinessModal(){
  if(!readinessContext)return '';
  const day=readinessContext.day;
  const selectedMinutes=num(store.profile?.minutes)||45;
  const timeOptions=[20,30,45,60,75].filter(v=>v<=Math.max(75,selectedMinutes));
  if(!timeOptions.includes(selectedMinutes))timeOptions.push(selectedMinutes);
  timeOptions.sort((a,b)=>a-b);
  const scale=(name,left,right,selected=3)=>'<div class="readiness-scale"><div class="readiness-scale-head"><span>'+left+'</span><span>'+right+'</span></div><div class="readiness-buttons">'+[1,2,3,4,5].map(value=>'<label><input type="radio" name="'+name+'" value="'+value+'" '+(value===selected?'checked':'')+'><span>'+value+'</span></label>').join('')+'</div></div>';
  return '<div class="exercise-modal-backdrop readiness-backdrop" data-action="close-readiness">'+
    '<section class="exercise-modal readiness-modal" role="dialog" aria-modal="true" aria-label="Pre-workout readiness" data-readiness-panel>'+
      '<button class="modal-close" type="button" data-action="close-readiness" aria-label="Close readiness check">×</button>'+
      '<div class="readiness-head"><p class="eyebrow">TODAY · '+esc(formatDate(readinessContext.scheduledDate))+'</p><h2>'+esc(day.name)+'</h2><p>A quick check lets this session fit how you actually feel and how much time you have today.</p></div>'+
      '<form id="readiness-form" class="readiness-form">'+
        '<label class="readiness-question"><strong>Energy</strong><small>How much training energy do you have?</small>'+scale('energy','Low','High',3)+'</label>'+
        '<label class="readiness-question"><strong>Muscle soreness</strong><small>How sore do you feel overall?</small>'+scale('soreness','None','Very sore',2)+'</label>'+
        '<label class="readiness-question"><strong>Sleep</strong><small>How rested do you feel from last night?</small>'+scale('sleep','Poor','Great',3)+'</label>'+
        '<label class="field readiness-time"><span>TIME AVAILABLE TODAY</span><select name="timeAvailable">'+timeOptions.map(value=>'<option value="'+value+'" '+(value===selectedMinutes?'selected':'')+'>'+value+' minutes</option>').join('')+'</select></label>'+
        '<div class="readiness-preview"><span>PLANNED SESSION</span><strong>~'+esc(day.estimatedMinutes)+' min · '+day.exercises.length+' exercises</strong></div>'+
        '<button class="button primary-action" type="button" data-action="begin-workout">START TODAY’S WORKOUT</button>'+
      '</form>'+
    '</section></div>';
}
function startPreparedWorkout(){
  if(!readinessContext)return;
  const form=document.querySelector('#readiness-form');
  const data=new FormData(form);
  const readiness={
    energy:num(data.get('energy'))||3,
    soreness:num(data.get('soreness'))||2,
    sleep:num(data.get('sleep'))||3,
    timeAvailable:num(data.get('timeAvailable'))||num(store.profile?.minutes)||45
  };
  readiness.score=readinessScore(readiness);
  const day=applyReadinessToDay(readinessContext.day,readiness);
  const scheduledDate=readinessContext.scheduledDate;
  const context=programContext(dateFromKey(scheduledDate));
  readinessContext=null;
  unlockWorkoutCues();
  store.activeWorkout=createWorkout(day,{scheduledDate,readiness,programContext:context,adaptationNotes:[...(day.adaptationNotes||[]),...(day.readinessNotes||[])]});
  saveStore();currentTab='workout';render();
}

function createWorkout(day,meta={}){
  const now=new Date().toISOString();
  const workout={
    schemaVersion:ACTIVE_WORKOUT_SCHEMA,
    id:uid('workout'),planId:store.plan.id,planDayId:day.id,routineName:day.name,focus:day.focus,
    scheduledDate:meta.scheduledDate||dateKey(),actualStartDate:dateKey(),
    readiness:meta.readiness||null,programContext:meta.programContext||programContext(),adaptationNotes:meta.adaptationNotes||day.adaptationNotes||[],
    startedAt:now,currentExerciseIndex:0,currentSetIndex:0,furthestExerciseIndex:0,
    isPaused:false,pausedAt:null,
    phase:'intro',timedPhaseStartedAt:null,timedPhaseSkippedSeconds:0,
    warmup:plannedWarmup(day),cooldown:plannedCooldown(day),
    exerciseStartedAt:null,exerciseDurations:{},
    restEndsAt:null,restDuration:0,restPausedRemaining:null,pendingPosition:null,
    exercises:day.exercises.map(ex=>{
      const calibrated=store.calibration[ex.id];
      const adaptive=adaptivePrescription(ex);
      const suggestedWeight=adaptive?.weight ?? calibrated?.weight ?? ex.startWeight ?? 0;
      const suggestedReps=adaptive?.reps || ex.startReps || recommendedRepCount(ex.reps);
      const suggestedRest=Math.max(30,Math.min(60,adaptive?.rest || ex.rest || 45));
      const noWeight=['bodyweight','timed','band'].includes(ex.loadMode);
      const weightValue=noWeight?'':(ex.loadMode==='assisted'&&!suggestedWeight?'':String(suggestedWeight||''));
      return {
        ...ex,suggestedWeight,suggestedReps,rest:suggestedRest,
        adaptiveLabel:adaptive?.label||'',adaptiveReason:adaptive?.reason||'',
        calibrationRequired:ex.calibrationRequired && !calibrated && !adaptive,
        manualComplete:false,manualCompletedAt:null,skipped:false,skipReason:'',
        sets:Array.from({length:ex.sets},()=>({id:uid('set'),weight:weightValue,reps:String(suggestedReps||''),completed:false,completedAt:null}))
      };
    })
  };
  return workout;
}

function startWorkout(dayId,scheduledDate=''){
  openReadiness(dayId,scheduledDate);
}

function getActivePosition(){
  const w=store.activeWorkout;if(!w)return null;
  const ei=Math.min(Math.max(0,w.currentExerciseIndex||0),w.exercises.length-1);
  const ex=w.exercises[ei];
  const si=Math.min(Math.max(0,w.currentSetIndex||0),ex.sets.length-1);
  return {workout:w,ei,si,exercise:ex,set:ex.sets[si]};
}
function nextPosition(w,ei,si){
  if(si+1<w.exercises[ei].sets.length)return {ei,si:si+1,type:'set'};
  if(ei+1<w.exercises.length)return {ei:ei+1,si:0,type:'exercise'};
  return null;
}
function workoutNowMs(w,nowMs=Date.now()){
  const paused=Date.parse(w?.pausedAt||'');
  return w?.isPaused&&Number.isFinite(paused)?paused:nowMs;
}
function workoutElapsedSeconds(w){
  return Math.max(0,Math.floor((workoutNowMs(w)-new Date(w.startedAt).getTime())/1000));
}
function exerciseElapsedSeconds(w){
  if(!w?.exerciseStartedAt)return 0;
  return Math.max(0,Math.floor((workoutNowMs(w)-new Date(w.exerciseStartedAt).getTime())/1000));
}
function timedStageItems(w){
  if(!w) return [];
  return w.phase==='warmup'?(w.warmup||[]):w.phase==='cooldown'?(w.cooldown||[]):[];
}
function timedStageSnapshot(w,nowMs=Date.now()){
  if(!w||!['warmup','cooldown'].includes(w.phase)) return null;
  nowMs=workoutNowMs(w,nowMs);
  const items=timedStageItems(w);
  if(!items.length) return {complete:true,index:0,remaining:0,remainingExact:0,total:0};
  const startMs=Date.parse(w.timedPhaseStartedAt||'');
  if(!Number.isFinite(startMs)) return null;
  const skipped=Math.max(0,Number(w.timedPhaseSkippedSeconds)||0);
  const elapsed=Math.max(0,(nowMs-startMs)/1000+skipped);
  let cumulative=0;
  for(let i=0;i<items.length;i++){
    cumulative+=Number(items[i].seconds)||0;
    if(elapsed<cumulative){
      const remainingExact=Math.max(0,cumulative-elapsed);
      return {
        complete:false,
        index:i,
        remaining:Math.max(0,Math.ceil(remainingExact)),
        remainingExact,
        total:Number(items[i].seconds)||30
      };
    }
  }
  return {complete:true,index:items.length-1,remaining:0,remainingExact:0,total:Number(items[items.length-1]?.seconds)||30};
}
function stageRemaining(w){ return timedStageSnapshot(w)?.remaining||0; }

function recordExerciseDuration(w,index){
  if(!w?.exerciseStartedAt||index<0)return;
  const elapsed=Math.max(0,Math.floor((workoutNowMs(w)-new Date(w.exerciseStartedAt).getTime())/1000));
  w.exerciseDurations=w.exerciseDurations||{};
  w.exerciseDurations[w.exercises[index]?.id||String(index)]=elapsed;
}

function restRemaining(w){
  if(!w||w.phase!=='rest')return 0;
  if(Number.isFinite(w.restPausedRemaining))return Math.max(0,Math.ceil(w.restPausedRemaining));
  if(!w.restEndsAt)return 0;
  return Math.max(0,Math.ceil((new Date(w.restEndsAt).getTime()-workoutNowMs(w))/1000));
}
function restProgress(w){ const d=Math.max(1,w.restDuration||1);return Math.max(0,Math.min(100,(restRemaining(w)/d)*100)); }

function navigateToExercise(index,{announce=true}={}){
  const w=store.activeWorkout;if(!w||w.phase==='intro'||w.phase==='review')return;
  index=Math.max(0,Math.min(index,w.exercises.length-1));
  pauseInteractiveTimers(w);
  const previous=w.currentExerciseIndex||0;
  if(w.exerciseStartedAt&&previous!==index)recordExerciseDuration(w,previous);
  w.currentExerciseIndex=index;
  w.furthestExerciseIndex=Math.max(num(w.furthestExerciseIndex),index);
  const ex=w.exercises[index];
  w.currentSetIndex=firstIncompleteSetIndex(ex);
  w.pendingPosition=null;w.restEndsAt=null;w.restPausedRemaining=null;w.restDuration=0;
  delete w.timedSetStartedAt;delete w.timedSetEndsAt;delete w.timedSetDuration;delete w.timedSetPausedRemaining;
  delete w.preSetStartedAt;delete w.preSetSetupSeconds;delete w.preSetCountdownSeconds;delete w.preSetIsNewExercise;
  if(exerciseCountsAsResolved(ex)){
    w.phase='exercise-review';
    w.exerciseStartedAt=null;
  }else{
    w.phase='pre-set';
    w.preSetStartedAt=new Date().toISOString();
    w.preSetSetupSeconds=5;
    w.preSetCountdownSeconds=3;
    w.preSetIsNewExercise=true;
    w.exerciseStartedAt=null;
    if(announce)announceExercise(ex,index===0?'First exercise':'Next exercise');
  }
  workoutMapOpen=false;
  saveStore();render();
}
function navigateExercise(delta){
  const w=store.activeWorkout;if(!w||w.phase==='intro'||w.phase==='review')return;
  const target=Math.max(0,Math.min((w.currentExerciseIndex||0)+delta,w.exercises.length-1));
  if(target===w.currentExerciseIndex){toast(delta<0?'You are at the first exercise.':'You are at the last exercise.');return;}
  navigateToExercise(target);
}
function markExerciseManual(index){
  const w=store.activeWorkout,ex=w?.exercises?.[index];if(!ex)return;
  ex.manualComplete=true;ex.manualCompletedAt=new Date().toISOString();ex.skipped=false;ex.skipReason='';
  if(index===w.currentExerciseIndex){
    const next=nextUnresolvedExerciseIndex(w,index);
    if(next>=0){navigateToExercise(next);}
    else{w.phase='review';saveStore();render();}
  }else{saveStore();render();}
}
function undoManualExercise(index){
  const ex=store.activeWorkout?.exercises?.[index];if(!ex)return;
  ex.manualComplete=false;ex.manualCompletedAt=null;saveStore();render();
}
function skipExercise(index,reason='Skipped by user'){
  const w=store.activeWorkout,ex=w?.exercises?.[index];if(!ex)return;
  ex.skipped=true;ex.skipReason=reason;ex.manualComplete=false;ex.manualCompletedAt=null;
  if(index===w.currentExerciseIndex){
    const next=nextUnresolvedExerciseIndex(w,index);
    if(next>=0)navigateToExercise(next);
    else{w.phase='review';saveStore();render();}
  }else{saveStore();render();}
}
function restoreExercise(index){
  const ex=store.activeWorkout?.exercises?.[index];if(!ex)return;
  ex.skipped=false;ex.skipReason='';ex.manualComplete=false;ex.manualCompletedAt=null;saveStore();render();
}
function moveExerciseLater(index){
  const w=store.activeWorkout;if(!w||index<0||index>=w.exercises.length-1)return;
  const ex=w.exercises[index];if(exerciseCountsAsResolved(ex)){toast('Completed or skipped exercises stay in their logged position.');return;}
  w.exercises.splice(index,1);w.exercises.push(ex);
  if(w.currentExerciseIndex===index)w.currentExerciseIndex=Math.min(index,w.exercises.length-1);
  else if(w.currentExerciseIndex>index)w.currentExerciseIndex-=1;
  saveStore();render();toast(ex.name+' moved later in this workout.');
}
function addWorkingSet(index){
  const ex=store.activeWorkout?.exercises?.[index];if(!ex)return;
  const last=ex.sets?.[ex.sets.length-1]||{};
  ex.sets.push({id:uid('set'),weight:String(last.weight??ex.suggestedWeight??''),reps:String(last.reps??ex.suggestedReps??''),completed:false,completedAt:null});
  ex.manualComplete=false;
  saveStore();render();toast('One set added to '+ex.name+'.');
}
function openSetEditor(ei,si){
  const set=store.activeWorkout?.exercises?.[ei]?.sets?.[si];if(!set)return;
  setEditContext={ei,si};render();
}
function closeSetEditor(){setEditContext=null;render();}
function saveSetEdit(){
  if(!setEditContext)return;
  const ex=store.activeWorkout?.exercises?.[setEditContext.ei],set=ex?.sets?.[setEditContext.si];if(!set)return;
  const weight=(document.querySelector('#edit-set-weight')?.value||'').trim().replace(/[^0-9.]/g,'');
  const reps=(document.querySelector('#edit-set-reps')?.value||'').trim().replace(/[^0-9.]/g,'');
  if(num(reps)<=0){toast('Enter reps or seconds greater than zero.');return;}
  set.weight=weight;set.reps=reps;set.completed=true;set.completedAt=set.completedAt||new Date().toISOString();
  if(ex.feedback){
    const result=computeProgression(ex,ex.feedback);
    ex.nextRecommendation=result;store.progression[ex.id]=result;
  }
  setEditContext=null;saveStore();render();toast('Set updated.');
}
function deleteSetFromExercise(){
  if(!setEditContext)return;
  const ex=store.activeWorkout?.exercises?.[setEditContext.ei];if(!ex||ex.sets.length<=1){toast('An exercise needs at least one set.');return;}
  ex.sets.splice(setEditContext.si,1);
  setEditContext=null;saveStore();render();toast('Set removed.');
}
function renderSetEditor(){
  if(!setEditContext)return '';
  const ex=store.activeWorkout?.exercises?.[setEditContext.ei],set=ex?.sets?.[setEditContext.si];if(!ex||!set)return '';
  const noLoad=['bodyweight','timed','band'].includes(ex.loadMode);
  return '<div class="exercise-modal-backdrop set-edit-backdrop" data-action="close-set-editor"><section class="exercise-modal set-edit-modal" data-set-edit-panel role="dialog" aria-modal="true">'+
    '<button class="modal-close" data-action="close-set-editor" type="button">×</button><p class="eyebrow">EDIT SET '+(setEditContext.si+1)+'</p><h2>'+esc(ex.name)+'</h2>'+
    '<div class="input-grid"><label class="field"><span>WEIGHT (LB)'+(noLoad?' · OPTIONAL':'')+'</span><input id="edit-set-weight" inputmode="decimal" value="'+esc(set.weight||'')+'"></label>'+
    '<label class="field"><span>'+(ex.loadMode==='timed'?'SECONDS':'REPS')+'</span><input id="edit-set-reps" inputmode="numeric" value="'+esc(set.reps||'')+'"></label></div>'+
    '<div class="modal-actions"><button class="button" data-action="save-set-edit">SAVE CHANGES</button><button class="button danger" data-action="delete-set">REMOVE SET</button></div></section></div>';
}
function renderLoggedSets(ex,ei){
  const sets=(ex.sets||[]).map((set,si)=>{
    const label=set.completed?setPerformanceLabel(ex,set):'Not completed';
    return '<button type="button" class="logged-set '+(set.completed?'completed':'pending')+'" data-action="edit-set" data-exercise-index="'+ei+'" data-set-index="'+si+'"><span>SET '+(si+1)+'</span><strong>'+esc(label)+'</strong><em>'+(set.completed?'EDIT':'ENTER')+'</em></button>';
  }).join('');
  return '<div class="logged-sets"><div class="logged-sets-head"><span>SETS</span><button class="text-button" data-action="add-set" data-exercise-index="'+ei+'">+ ADD SET</button></div>'+sets+'</div>';
}
function renderExerciseReview(pos){
  const ex=pos.exercise,state=exerciseState(ex);
  return '<div class="exercise-review-stage">'+
    '<div class="exercise-review-hero">'+exerciseImageButton(ex,'active-exercise-media')+'<div><p class="eyebrow">EXERCISE '+(pos.ei+1)+' OF '+pos.workout.exercises.length+'</p><h2>'+esc(ex.name)+'</h2><span class="exercise-state-badge state-'+state+'">'+esc(exerciseStateLabel(ex))+'</span><p>'+esc(exerciseDescription(ex))+'</p><strong>'+esc(equipmentRequirement(exerciseSource(ex)))+'</strong></div></div>'+
    renderLoggedSets(ex,pos.ei)+
    '<div class="review-exercise-actions">'+
      (state==='completed-manually'?'<button class="button secondary" data-action="undo-manual-exercise" data-exercise-index="'+pos.ei+'">UNDO MANUAL COMPLETION</button>':'')+
      (state==='skipped'?'<button class="button secondary" data-action="restore-exercise" data-exercise-index="'+pos.ei+'">RETURN TO THIS EXERCISE</button>':'')+
      (state==='partial'||state==='not-started'?'<button class="button" data-action="continue-exercise" data-exercise-index="'+pos.ei+'">CONTINUE EXERCISE</button>':'')+
      '<button class="button secondary" data-action="open-workout-map">WORKOUT MAP</button>'+
    '</div></div>';
}
function renderWorkoutMap(){
  if(!workoutMapOpen||!store.activeWorkout)return '';
  const w=store.activeWorkout;
  return '<div class="exercise-modal-backdrop workout-map-backdrop" data-action="close-workout-map"><section class="exercise-modal workout-map-modal" data-workout-map-panel role="dialog" aria-modal="true">'+
    '<button class="modal-close" data-action="close-workout-map" type="button">×</button><div class="workout-map-head"><p class="eyebrow">WORKOUT MAP</p><h2>'+esc(w.routineName)+'</h2><p>Jump around without losing completed work. Moving an exercise later changes order, not its training target.</p></div>'+
    '<div class="workout-map-list">'+w.exercises.map((ex,index)=>{
      const state=exerciseState(ex),done=(ex.sets||[]).filter(set=>set.completed).length;
      return '<article class="workout-map-row '+(index===w.currentExerciseIndex?'current':'')+'"><div class="map-number">'+String(index+1).padStart(2,'0')+'</div><div class="map-copy"><strong>'+esc(ex.name)+'</strong><span>'+esc(exerciseStateLabel(ex))+' · '+done+'/'+ex.sets.length+' logged sets</span></div><div class="map-actions">'+
        (w.phase!=='intro'?'<button class="text-button" data-action="jump-exercise" data-exercise-index="'+index+'">OPEN</button>':'')+
        (!exerciseCountsAsResolved(ex)?'<button class="text-button" data-action="mark-exercise-complete" data-exercise-index="'+index+'">MARK COMPLETE</button>':'')+
        (state==='completed-manually'?'<button class="text-button muted" data-action="undo-manual-exercise" data-exercise-index="'+index+'">UNDO</button>':'')+
        (state==='skipped'?'<button class="text-button muted" data-action="restore-exercise" data-exercise-index="'+index+'">RESTORE</button>':'<button class="text-button muted" data-action="skip-exercise" data-exercise-index="'+index+'">SKIP</button>')+
        (index<w.exercises.length-1&&!exerciseCountsAsResolved(ex)?'<button class="text-button muted" data-action="move-exercise-later" data-exercise-index="'+index+'">MOVE LATER</button>':'')+
      '</div></article>';
    }).join('')+'</div></section></div>';
}

function beginPreSetPosition(ei,si,isNewExercise=true){
  const w=store.activeWorkout;if(!w)return;
  const previousIndex=w.currentExerciseIndex||0;
  if(isNewExercise&&w.exerciseStartedAt&&previousIndex!==ei)recordExerciseDuration(w,previousIndex);
  w.currentExerciseIndex=ei;
  w.furthestExerciseIndex=Math.max(num(w.furthestExerciseIndex),ei);
  w.currentSetIndex=si;
  w.phase='pre-set';
  w.preSetStartedAt=new Date().toISOString();
  w.preSetSetupSeconds=isNewExercise?5:0;
  w.preSetCountdownSeconds=3;
  w.preSetIsNewExercise=Boolean(isNewExercise);
  w.restEndsAt=null;w.restDuration=0;w.restPausedRemaining=null;w.pendingPosition=null;
  if(isNewExercise)w.exerciseStartedAt=null;
  w.lastProgressionResult=null;
  if(isNewExercise)announceExercise(w.exercises[ei],ei===0?'First exercise':'Next exercise');
  saveStore();render();
}
function preSetSnapshot(w,nowMs=Date.now()){
  if(!w||w.phase!=='pre-set')return null;
  nowMs=workoutNowMs(w,nowMs);
  const start=Date.parse(w.preSetStartedAt||'');
  if(!Number.isFinite(start))return null;
  const setup=Math.max(0,num(w.preSetSetupSeconds));
  const countdown=Math.max(1,num(w.preSetCountdownSeconds)||3);
  const total=setup+countdown;
  const elapsed=Math.max(0,(nowMs-start)/1000);
  const remainingExact=Math.max(0,total-elapsed);
  if(remainingExact<=0)return {complete:true,mode:'countdown',remaining:0,total:total};
  if(remainingExact>countdown){
    return {complete:false,mode:'setup',remaining:Math.max(1,Math.ceil(remainingExact-countdown)),total:total};
  }
  return {complete:false,mode:'countdown',remaining:Math.max(1,Math.ceil(remainingExact)),total:total};
}
function finishPreSet(){
  const w=store.activeWorkout;if(!w||w.phase!=='pre-set')return;
  const pos=getActivePosition();if(!pos)return;
  const now=new Date().toISOString();
  if(!w.exerciseStartedAt)w.exerciseStartedAt=now;
  delete w.preSetStartedAt;delete w.preSetSetupSeconds;delete w.preSetCountdownSeconds;delete w.preSetIsNewExercise;
  if(pos.exercise.loadMode==='timed'){
    const seconds=Math.max(1,num(pos.set.reps)||num(pos.exercise.suggestedReps)||recommendedRepCount(pos.exercise.reps)||30);
    pos.set.reps=String(seconds);
    w.phase='timed-set';
    w.timedSetStartedAt=now;
    w.timedSetDuration=seconds;
    w.timedSetEndsAt=new Date(Date.now()+seconds*1000).toISOString();
  }else{
    w.phase='work';
  }
  fireWorkoutSignal('go','go-'+w.id+'-'+pos.ei+'-'+pos.si,{voice:'Go',label:'GO'});
  saveStore();render();
}
function timedSetSnapshot(w,nowMs=Date.now()){
  if(!w||w.phase!=='timed-set')return null;
  nowMs=workoutNowMs(w,nowMs);
  const end=Date.parse(w.timedSetEndsAt||'');
  const duration=Math.max(1,num(w.timedSetDuration)||1);
  if(!Number.isFinite(end))return null;
  const remainingExact=Math.max(0,(end-nowMs)/1000);
  return {complete:remainingExact<=0,remaining:Math.max(0,Math.ceil(remainingExact)),remainingExact,total:duration};
}
function completeTimedSet(early=false){
  const pos=getActivePosition();if(!pos||pos.workout.phase!=='timed-set')return;
  const w=pos.workout;
  const duration=Math.max(1,num(w.timedSetDuration)||num(pos.set.reps)||30);
  if(early){
    const started=Date.parse(w.timedSetStartedAt||'');
    pos.set.reps=String(Math.max(1,Math.min(duration,Math.round((Date.now()-started)/1000))));
  }else{
    pos.set.reps=String(duration);
  }
  pos.set.completed=true;pos.set.completedAt=new Date().toISOString();
  delete w.timedSetStartedAt;delete w.timedSetDuration;delete w.timedSetEndsAt;
  fireWorkoutSignal('complete','complete-'+w.id+'-'+pos.ei+'-'+pos.si,{voice:'Done',label:'DONE'});
  const next=nextPosition(w,pos.ei,pos.si);
  if(!next||next.ei!==pos.ei){startExerciseFeedback(next);return;}
  beginRest(next,pos.exercise.rest||45);
}

function startCooldown(){
  const w=store.activeWorkout;if(!w)return;
  recordExerciseDuration(w,w.currentExerciseIndex);
  const now=new Date().toISOString();
  w.phase='cooldown';
  w.exerciseStartedAt=null;
  w.timedPhaseStartedAt=now;
  w.timedPhaseSkippedSeconds=0;
  if(!w.cooldown?.length){ openWorkoutReview(); return; }
  saveStore();render();
}

function completeTimedStagePhase(w){
  if(w.phase==='warmup'){
    w.timedPhaseStartedAt=null;
    w.timedPhaseSkippedSeconds=0;
    beginPreSetPosition(0,0,true);
    return;
  }
  w.timedPhaseStartedAt=null;
  w.timedPhaseSkippedSeconds=0;
  fireWorkoutSignal('complete','cooldown-complete-'+w.id,{voice:'Cooldown complete. Review your workout before saving.',label:'DONE'});
  openWorkoutReview();
}

function reconcileTimedStage(){
  const w=store.activeWorkout;
  if(!w||!['warmup','cooldown'].includes(w.phase)) return false;
  const snap=timedStageSnapshot(w);
  if(!snap) return false;
  if(snap.complete){ completeTimedStagePhase(w); return true; }
  return false;
}

function advanceTimedStage(){
  const w=store.activeWorkout;if(!w||!['warmup','cooldown'].includes(w.phase))return;
  const snap=timedStageSnapshot(w);
  if(!snap)return;
  if(snap.complete){ completeTimedStagePhase(w); return; }
  w.timedPhaseSkippedSeconds=(Number(w.timedPhaseSkippedSeconds)||0)+snap.remainingExact+0.001;
  const next=timedStageSnapshot(w);
  if(next?.complete){ completeTimedStagePhase(w); return; }
  saveStore();render();
}

function beginRest(next,seconds){
  const w=store.activeWorkout;
  if(!w)return;
  if(!next){ startCooldown();return; }
  const safeRest=Math.max(30,Math.min(60,seconds||45));
  w.phase='rest';w.restDuration=safeRest;w.restEndsAt=new Date(Date.now()+safeRest*1000).toISOString();
  w.restPausedRemaining=null;w.pendingPosition=next;saveStore();render();
}

function startExerciseFeedback(next){
  const w=store.activeWorkout;
  if(!w)return;
  w.phase='feedback';
  w.pendingPosition=next;
  saveStore();
  render();
}

function applyExerciseFeedback(feedback){
  const pos=getActivePosition();
  if(!pos||pos.workout.phase!=='feedback')return;
  const result=computeProgression(pos.exercise,feedback);
  store.progression=store.progression||{};
  store.progression[pos.exercise.id]=result;
  store.progressionLog=Array.isArray(store.progressionLog)?store.progressionLog:[];
  store.progressionLog.unshift({...result,workoutId:pos.workout.id,routineName:pos.workout.routineName,loggedAt:new Date().toISOString()});
  store.progressionLog=store.progressionLog.slice(0,200);
  pos.exercise.feedback=feedback;
  pos.exercise.nextRecommendation=result;
  pos.workout.lastProgressionResult=result;
  const next=pos.workout.pendingPosition;
  saveStore();
  beginRest(next,pos.exercise.rest||45);
}

function completeCurrentSet(){
  const pos=getActivePosition(); if(!pos||pos.workout.phase!=='work')return;
  const weight=(document.querySelector('#set-weight')?.value||'').trim().replace(/[^0-9.]/g,'');
  const reps=(document.querySelector('#set-reps')?.value||'').trim().replace(/[^0-9.]/g,'');
  if(num(reps)<=0){toast(pos.exercise.loadMode==='timed'?'Enter the seconds completed.':'Enter the reps completed.');return;}
  pos.set.weight=weight;pos.set.reps=reps;pos.set.completed=true;pos.set.completedAt=new Date().toISOString();
  fireWorkoutSignal('complete','complete-'+pos.workout.id+'-'+pos.ei+'-'+pos.si,{voice:'Set complete',label:'DONE'});
  const next=nextPosition(pos.workout,pos.ei,pos.si);

  if(next && next.ei===pos.ei){
    const nextSet=pos.exercise.sets[next.si];
    nextSet.weight=weight;
    nextSet.reps=reps;
  }

  if(pos.si===0 && pos.exercise.calibrationRequired && !['bodyweight','timed','band','assisted'].includes(pos.exercise.loadMode)){
    pos.workout.phase='calibrate';pos.workout.pendingPosition=next;saveStore();render();return;
  }
  if(!next||next.ei!==pos.ei){startExerciseFeedback(next);return;}
  beginRest(next,pos.exercise.rest||45);
}

function applyCalibration(rir){
  const pos=getActivePosition(); if(!pos||pos.workout.phase!=='calibrate')return;
  const actual=num(pos.exercise.sets[0].weight)||num(pos.exercise.suggestedWeight);
  const multiplier=rir==='5+'?1.12:rir==='3-4'?1.06:rir==='2'?1:rir==='1'?.95:.90;
  const adjusted=roundTo(actual*multiplier,pos.exercise.increment||5);
  store.calibration[pos.exercise.id]={weight:adjusted,updatedAt:new Date().toISOString(),rir};
  pos.exercise.suggestedWeight=adjusted;pos.exercise.calibrationRequired=false;
  const next=pos.workout.pendingPosition;
  if(next && next.ei===pos.ei){
    const nextSet=pos.exercise.sets[next.si];
    nextSet.weight=String(adjusted||'');
    nextSet.reps=pos.exercise.sets[0].reps||pos.exercise.suggestedReps||'';
  }
  saveStore();
  if(!next||next.ei!==pos.ei){startExerciseFeedback(next);return;}
  beginRest(next,pos.exercise.rest||45);
}

function advanceAfterRest(){
  const w=store.activeWorkout;if(!w||w.phase!=='rest')return;
  const next=w.pendingPosition;if(!next){startCooldown();return;}
  const isNewExercise=next.ei!==w.currentExerciseIndex;
  if(isNewExercise){
    w.phase='exercise-transition';
    w.restEndsAt=null;w.restPausedRemaining=null;w.restDuration=0;
    announceExercise(w.exercises[next.ei],'Next exercise');
    saveStore();render();return;
  }
  beginPreSetPosition(next.ei,next.si,false);
}
function adjustRest(delta){
  const w=store.activeWorkout;if(!w||w.phase!=='rest')return;
  const current=restRemaining(w);
  const nextRemaining=Math.max(30,Math.min(60,current+delta));
  if(Number.isFinite(w.restPausedRemaining)) w.restPausedRemaining=nextRemaining;
  else w.restEndsAt=new Date(Date.now()+nextRemaining*1000).toISOString();
  w.restDuration=Math.max(30,Math.min(60,Math.max(w.restDuration||30,nextRemaining)));
  saveStore();updateTimers();
}
function toggleRestPause(){
  const w=store.activeWorkout;if(!w||w.phase!=='rest')return;
  if(Number.isFinite(w.restPausedRemaining)){w.restEndsAt=new Date(Date.now()+w.restPausedRemaining*1000).toISOString();w.restPausedRemaining=null;}
  else{w.restPausedRemaining=restRemaining(w);w.restEndsAt=null;}
  saveStore();render();
}
function shiftWorkoutTimestamp(w,key,deltaMs){
  const value=Date.parse(w?.[key]||'');
  if(Number.isFinite(value))w[key]=new Date(value+deltaMs).toISOString();
}
function toggleWorkoutPause(){
  const w=store.activeWorkout;if(!w)return;
  if(!w.isPaused){
    w.isPaused=true;
    w.pausedAt=new Date().toISOString();
    if('speechSynthesis' in window){try{window.speechSynthesis.cancel?.();}catch{}}
    saveStore();
    fireWorkoutSignal('transition','workout-paused-'+w.id+'-'+Date.now(),{voice:'Workout paused',label:'PAUSED'});
    render();
    return;
  }
  const pausedMs=Date.parse(w.pausedAt||'');
  const delta=Math.max(0,Date.now()-(Number.isFinite(pausedMs)?pausedMs:Date.now()));
  ['startedAt','exerciseStartedAt','timedPhaseStartedAt','preSetStartedAt','timedSetStartedAt','timedSetEndsAt','restEndsAt'].forEach(key=>shiftWorkoutTimestamp(w,key,delta));
  w.isPaused=false;
  w.pausedAt=null;
  saveStore();
  fireWorkoutSignal('transition','workout-resumed-'+w.id+'-'+Date.now(),{voice:'Resume',label:'RESUME'});
  render();
}

function resetActiveTimer(){
  const w=store.activeWorkout;if(!w)return;
  const now=new Date();
  if(w.phase==='rest'){
    const duration=Math.max(1,num(w.restDuration)||30);
    if(Number.isFinite(w.restPausedRemaining))w.restPausedRemaining=duration;
    else w.restEndsAt=new Date(now.getTime()+duration*1000).toISOString();
  }else if(w.phase==='timed-set'){
    const duration=Math.max(1,num(w.timedSetDuration)||num(getActivePosition()?.set?.reps)||30);
    w.timedSetStartedAt=now.toISOString();
    w.timedSetEndsAt=new Date(now.getTime()+duration*1000).toISOString();
  }else if(w.phase==='pre-set'){
    w.preSetStartedAt=now.toISOString();
  }else if(w.phase==='warmup'||w.phase==='cooldown'){
    const snap=timedStageSnapshot(w);
    const items=timedStageItems(w);
    if(!snap||!items.length)return;
    const prior=items.slice(0,snap.index).reduce((sum,item)=>sum+(Number(item.seconds)||0),0);
    w.timedPhaseStartedAt=now.toISOString();
    w.timedPhaseSkippedSeconds=prior;
  }else return;
  saveStore();
  fireWorkoutSignal('transition','timer-reset-'+w.id+'-'+w.phase+'-'+Date.now(),{voice:'Timer reset',label:'RESET'});
  render();
}
function skipRest(){ advanceAfterRest(); }

function previousBest(exerciseId,exclude=null){
  let best=null;
  for(const w of store.history){
    if(w.id===exclude)continue;
    const ex=w.exercises.find(e=>e.id===exerciseId);if(!ex)continue;
    for(const s of ex.sets){if(!s.completed)continue;const c={weight:num(s.weight),reps:num(s.reps)};
      if(!best||c.weight>best.weight||(c.weight===best.weight&&c.reps>best.reps))best=c;
    }
  }
  return best;
}
function bestLabel(exerciseId){
  const b=previousBest(exerciseId);if(!b)return 'No previous sets';
  const ex=catalog.find(e=>e.id===exerciseId);
  if(ex?.loadMode==='timed')return `${b.reps} sec`;
  if(!b.weight)return `${b.reps} reps`;
  return `${b.weight} lb × ${b.reps}`;
}

function renderWorkoutReview(w){
  const actualSets=completedSets(w.exercises),resolved=workoutResolvedCount(w),fullyResolved=workoutIsFullyResolved(w);
  const rows=w.exercises.map((ex,index)=>{
    const state=exerciseState(ex),done=(ex.sets||[]).filter(set=>set.completed).length;
    return '<article class="final-review-row"><div class="review-index">'+String(index+1).padStart(2,'0')+'</div><div><strong>'+esc(ex.name)+'</strong><span>'+esc(exerciseStateLabel(ex))+' · '+done+'/'+ex.sets.length+' logged sets</span>'+(ex.skipReason?'<small>'+esc(ex.skipReason)+'</small>':'')+'</div><button class="text-button" data-action="jump-from-review" data-exercise-index="'+index+'">REVIEW</button></article>';
  }).join('');
  return '<div class="workout-final-review"><p class="eyebrow">FINAL REVIEW</p><h2>'+esc(w.routineName)+'</h2><p>Check the session before it becomes training history. Manual completions count for adherence but never invent weight, reps, volume, or PRs.</p>'+
    '<div class="review-summary-grid"><div><span>EXERCISES RESOLVED</span><strong>'+resolved+'/'+w.exercises.length+'</strong></div><div><span>LOGGED SETS</span><strong>'+actualSets+'</strong></div><div><span>STATUS</span><strong>'+(fullyResolved?'READY TO SAVE':'INCOMPLETE')+'</strong></div></div>'+
    '<div class="final-review-list">'+rows+'</div>'+
    '<div class="final-review-actions">'+
      (fullyResolved?'<button class="button primary-action" data-action="save-workout-complete">FINISH & SAVE</button>':'<button class="button primary-action" data-action="finish-workout-anyway">FINISH ANYWAY</button><button class="button secondary" data-action="save-workout-partial">SAVE AS PARTIAL</button>')+
      '<button class="button secondary" data-action="continue-workout">CONTINUE WORKOUT</button><button class="button danger" data-action="discard">DISCARD WORKOUT</button></div>'+
  '</div>';
}
function openWorkoutReview(){
  const w=store.activeWorkout;if(!w)return;
  pauseInteractiveTimers(w);
  w.returnPhase=w.phase;
  w.phase='review';saveStore();render();
}
function continueWorkoutFromReview(){
  const w=store.activeWorkout;if(!w||w.phase!=='review')return;
  const index=nextUnresolvedExerciseIndex(w,-1);
  if(index>=0){navigateToExercise(index);return;}
  w.phase=w.returnPhase&&w.returnPhase!=='review'?w.returnPhase:'exercise-review';
  delete w.returnPhase;saveStore();render();
}
function rebuildDerivedTrainingState(){
  const progression={};
  const ordered=[...store.history].sort((a,b)=>new Date(b.completedAt)-new Date(a.completedAt));
  for(const workout of ordered){
    for(const ex of workout.exercises||[]){
      if(ex.nextRecommendation&&!progression[ex.id])progression[ex.id]=ex.nextRecommendation;
    }
  }
  store.progression=progression;
  const valid=new Set(store.history.map(item=>item.id));
  store.progressionLog=(store.progressionLog||[]).filter(item=>!item.workoutId||valid.has(item.workoutId));
  ensureTrainingProgram().weekReviews={};
}
function finalizeWorkout(status='complete'){
  const w=store.activeWorkout;if(!w)return;
  if(status==='complete'&&!workoutIsFullyResolved(w)){
    for(const ex of w.exercises){
      if(!exerciseCountsAsResolved(ex)){ex.skipped=true;ex.skipReason='Finished without completing this exercise';}
    }
  }
  const count=completedSets(w.exercises);
  const old=new Map(w.exercises.map(e=>[e.id,previousBest(e.id)]));
  const completedAt=new Date().toISOString();
  const entry={...w,phase:'complete',completionStatus:status,completedAt,actualCompletedDate:dateKey(),durationMinutes:Math.max(1,Math.round((new Date(completedAt)-new Date(w.startedAt))/60000)),completedSets:count,resolvedExercises:workoutResolvedCount(w),totalVolume:volume(w.exercises),newPRs:[]};
  for(const ex of entry.exercises){
    let session=null;
    for(const set of ex.sets||[]){if(!set.completed)continue;const c={weight:num(set.weight),reps:num(set.reps)};
      if(!session||c.weight>session.weight||(c.weight===session.weight&&c.reps>session.reps))session=c;
    }
    const before=old.get(ex.id);
    if(session&&(!before||session.weight>before.weight||(session.weight===before.weight&&session.reps>before.reps)))entry.newPRs.push({exerciseId:ex.id,name:ex.name,...session});
  }
  ['pendingPosition','restEndsAt','restPausedRemaining','lastProgressionResult','preSetStartedAt','preSetSetupSeconds','preSetCountdownSeconds','preSetIsNewExercise','pausedAt','isPaused','timedSetStartedAt','timedSetDuration','timedSetEndsAt','timedSetPausedRemaining','returnPhase'].forEach(key=>delete entry[key]);
  store.history.unshift(entry);store.history=store.history.slice(0,100);store.lastSummaryId=entry.id;store.activeWorkout=null;
  rebuildDerivedTrainingState();saveStore();currentTab='summary';render();
}
function finishWorkout(auto=false){
  const w=store.activeWorkout;if(!w)return;
  if(auto){openWorkoutReview();return;}
  openWorkoutReview();
}

function discardWorkout(){if(!store.activeWorkout)return;if(!confirm('Discard this workout?'))return;store.activeWorkout=null;saveStore();currentTab='home';render();}

function renderProfile(){
  const p=store.profile||{};
  const lifts=p.lifts||{};
  const checked=(field,value)=>p[field]===value?'checked':'';
  const av=v=>(p.avoid||[]).includes(v)?'checked':'';
  const scheduledDays=preferredWorkoutDays(p);
  return `
  <div class="onboard-shell">
    <div class="page-head"><div><p class="eyebrow">BUILD YOUR PLAN</p><h2 class="page-title">Tell us how you train.</h2><p class="page-copy">We’ll use your goal, experience, body weight, equipment and real session length to build a starting plan. Weight suggestions are conservative estimates and get refined during your first workout.</p></div></div>
    <form id="profile-form" class="intake-form" novalidate>
      <section class="form-section"><div class="form-section-head"><span>01</span><div><h3>What do you want to accomplish?</h3><p>This changes reps, sets and rest periods.</p></div></div>
        <div class="choice-grid">
          ${[['muscle','Build muscle','Moderate reps + progressive overload'],['strength','Get stronger','Heavier work + longer recovery'],['fat-loss','Fat loss + conditioning','Higher reps + shorter recovery'],['general','General fitness','Balanced strength and work capacity']].map(([v,t,d])=>`<label class="choice-card"><input type="radio" name="goal" value="${v}" ${checked('goal',v)||(!p.goal&&v==='muscle'?'checked':'')}><span><strong>${t}</strong><small>${d}</small></span></label>`).join('')}
        </div>
      </section>

      <section class="form-section"><div class="form-section-head"><span>02</span><div><h3>About you</h3><p>Body weight helps create a conservative first estimate. It does not determine your strength.</p></div></div>
        <div class="form-grid three">
          <label class="field"><span>BODY WEIGHT (LB)</span><input name="weight" type="number" min="50" max="700" value="${esc(p.weight||'')}" required placeholder="180"></label>
          <label class="field"><span>HEIGHT</span><div class="inline-inputs"><input name="heightFeet" type="number" min="3" max="8" value="${esc(p.heightFeet||'')}" placeholder="5"><input name="heightInches" type="number" min="0" max="11" value="${esc(p.heightInches||'')}" placeholder="10"></div></label>
          <label class="field"><span>AGE RANGE</span><select name="ageRange">${['18-24','25-34','35-44','45-54','55-64','65+'].map(v=>`<option ${p.ageRange===v?'selected':''}>${v}</option>`).join('')}</select></label>
        </div>
      </section>

      <section class="form-section"><div class="form-section-head"><span>03</span><div><h3>Training experience</h3><p>This affects exercise complexity and initial volume.</p></div></div>
        <div class="choice-grid four">
          ${[['new','New','Little or no lifting'],['beginner','Beginner','Under ~1 year'],['intermediate','Intermediate','Consistent 1–3 years'],['advanced','Advanced','3+ consistent years']].map(([v,t,d])=>`<label class="choice-card"><input type="radio" name="experience" value="${v}" ${checked('experience',v)||(!p.experience&&v==='new'?'checked':'')}><span><strong>${t}</strong><small>${d}</small></span></label>`).join('')}
        </div>
      </section>

      <section class="form-section"><div class="form-section-head"><span>04</span><div><h3>Your real schedule</h3><p>Choose how many days you train, which days they actually are, and how long you normally have.</p></div></div>
        <div class="form-grid two">
          <label class="field"><span>DAYS PER WEEK</span><select name="days" id="training-days-count">${[2,3,4,5].map(v=>`<option value="${v}" ${num(p.days||4)===v?'selected':''}>${v} days</option>`).join('')}</select></label>
          <label class="field"><span>MINUTES PER WORKOUT</span><select name="minutes">${[20,30,45,60,75].map(v=>`<option value="${v}" ${num(p.minutes||45)===v?'selected':''}>${v} minutes</option>`).join('')}</select></label>
        </div>
        <div class="schedule-day-picker">
          <div class="schedule-day-head"><span>TRAINING DAYS</span><small>Select exactly ${num(p.days||4)} days. You can change them later.</small></div>
          <div class="weekday-pills">
            ${TRAINING_DAYS.map(day=>`<label class="weekday-pill"><input type="checkbox" name="workoutDays" value="${day.id}" ${scheduledDays.includes(day.id)?'checked':''}><span><strong>${day.label}</strong><small>${day.name}</small></span></label>`).join('')}
          </div>
        </div>
      </section>

      <section class="form-section"><div class="form-section-head"><span>05</span><div><h3>Where are you training?</h3><p>We only choose exercises your setup supports.</p></div></div>
        <div class="choice-grid">
          ${[['full-gym','Full gym'],['dumbbells','Dumbbells'],['mixed-home','Home mix'],['bands','Resistance bands'],['bodyweight','Bodyweight only']].map(([v,t])=>`<label class="choice-card compact"><input type="radio" name="equipment" value="${v}" ${checked('equipment',v)||(!p.equipment&&v==='full-gym'?'checked':'')}><span><strong>${t}</strong></span></label>`).join('')}
        </div>
        <div class="choice-grid three sub-choice">
          ${[['mixed','Mixed'],['machines','Prefer machines'],['free','Prefer free weights']].map(([v,t])=>`<label class="choice-card compact"><input type="radio" name="style" value="${v}" ${checked('style',v)||(!p.style&&v==='mixed'?'checked':'')}><span><strong>${t}</strong></span></label>`).join('')}
        </div>
      </section>

      <section class="form-section"><div class="form-section-head"><span>06</span><div><h3>Recent working weights <em>optional</em></h3><p>If you know them, they improve starting estimates. Leave blank if not.</p></div></div>
        <div class="form-grid five">
          ${[['bench','Bench press'],['squat','Squat'],['deadlift','Deadlift / RDL'],['overhead','Overhead press'],['row','Row / pulldown']].map(([n,l])=>`<label class="field"><span>${l.toUpperCase()}</span><input name="${n}" type="number" min="0" step="5" value="${esc(lifts[n]||'')}" placeholder="lb"></label>`).join('')}
        </div>
      </section>

      <section class="form-section"><div class="form-section-head"><span>07</span><div><h3>Movements to leave out</h3><p>These are preference/exclusion controls, not medical advice. If pain or an injury limits training, use guidance from a qualified clinician.</p></div></div>
        <div class="check-row">
          ${[['overhead','Overhead pressing'],['knee','Deep knee-dominant work'],['hinge','Hip hinging'],['floor','Floor exercises']].map(([v,t])=>`<label class="check-pill"><input type="checkbox" name="avoid" value="${v}" ${av(v)}><span>${t}</span></label>`).join('')}
        </div>
      </section>
      <div class="form-actions"><button type="button" class="button large" data-action="build-plan">${store.profile?'REBUILD MY PLAN':'BUILD MY PLAN'}</button>${store.profile?'<button type="button" class="button secondary large" data-action="home">CANCEL</button>':''}</div>
    </form>
  </div>`;
}

function skipScheduledSession(key){
  const program=ensureTrainingProgram();
  program.scheduleOverrides[key]={status:'skipped',updatedAt:new Date().toISOString()};
  saveStore();render();
}
function undoSkipScheduledSession(key){
  const program=ensureTrainingProgram();
  delete program.scheduleOverrides[key];
  saveStore();render();
}
function scheduleStatusLabel(entry){
  if(entry.status==='complete')return 'COMPLETED';
  if(entry.status==='today')return 'TODAY';
  if(entry.status==='missed')return 'MISSED';
  if(entry.status==='skipped')return 'SKIPPED';
  return 'UPCOMING';
}
function scheduleCompletionNote(entry){
  if(!entry.history)return '';
  const actual=entry.history.actualStartDate||dateKey(new Date(entry.history.completedAt));
  if(actual!==entry.dateKey)return 'Scheduled '+formatDate(entry.dateKey)+' · trained '+formatDate(actual);
  return 'Completed '+formatDate(entry.history.completedAt);
}
function renderWeekScheduleEntry(entry){
  const day=entry.adaptedDay;
  const status=scheduleStatusLabel(entry);
  const canStart=!store.activeWorkout&&!['complete','skipped'].includes(entry.status);
  const button=entry.status==='complete'?
    '<span class="schedule-done">✓ DONE</span>':
    entry.status==='skipped'?
      '<button class="text-button muted" data-action="undo-skip-scheduled" data-scheduled-date="'+esc(entry.dateKey)+'">UNDO SKIP</button>':
      '<div class="schedule-actions">'+
        (canStart?'<button class="button secondary" data-start="'+esc(entry.day.id)+'" data-scheduled-date="'+esc(entry.dateKey)+'">'+(entry.status==='missed'?'DO TODAY':entry.status==='today'?'START TODAY':'START EARLY')+'</button>':'')+
        (entry.status==='missed'?'<button class="text-button muted" data-action="skip-scheduled" data-scheduled-date="'+esc(entry.dateKey)+'">SKIP</button>':'')+
      '</div>';
  return '<article class="schedule-card status-'+entry.status+'">'+
    '<div class="schedule-date"><span>'+esc(entry.dayName.slice(0,3).toUpperCase())+'</span><strong>'+entry.date.getDate()+'</strong></div>'+
    '<div class="schedule-main"><div class="schedule-top"><span>'+status+'</span><em>~'+esc(day.estimatedMinutes)+' min</em></div>'+
    '<h3>'+esc(day.name)+'</h3><p>'+esc(day.focus)+'</p>'+
    '<div class="schedule-meta"><span>'+day.exercises.length+' exercises</span><span>'+day.exercises.reduce((sum,ex)=>sum+(ex.sets||0),0)+' working sets</span></div>'+
    (entry.history?'<small class="schedule-completion">'+esc(scheduleCompletionNote(entry))+'</small>':'')+
    '</div><div class="schedule-cta">'+button+'</div></article>';
}

function renderHome(){
  const p=store.profile,plan=store.plan;
  if(!p||!plan)return renderProfile();
  const context=programContext();
  const decision=adaptationDecision();
  const schedule=currentWeekSchedule();
  const week=weeklyHistory();
  const completed=schedule.filter(entry=>entry.status==='complete').length;
  const weeklyVolume=week.reduce((sum,item)=>sum+(item.totalVolume||0),0);
  const next=nextScheduledSession();
  const nextDay=next?.adaptedDay||null;
  const prior=decision.previous;
  const daysText=preferredWorkoutDays().map(id=>TRAINING_DAYS.find(day=>day.id===id)?.label).filter(Boolean).join(' · ');
  return `
    <div class="page-head"><div><p class="eyebrow">TRAINING BLOCK ${context.blockNumber} · WEEK ${context.blockWeek} OF 4</p><h2 class="page-title">${esc(planGoalLabel(p.goal))}.</h2><p class="page-copy">${esc(daysText)} · ${p.minutes}-minute sessions · ${esc(experienceLabel(p.experience))} · ${esc(equipmentLabel(p.equipment))}. Your calendar, performance, readiness, swaps, and feedback now shape the next week.</p></div><button class="button secondary" data-action="edit-profile">EDIT PROFILE</button></div>
    ${store.activeWorkout?`<button class="resume-card" data-action="resume"><div class="resume-dot"></div><div><span>WORKOUT IN PROGRESS</span><strong>${esc(store.activeWorkout.routineName)} · ${store.activeWorkout.phase==='rest'?'Resting':store.activeWorkout.phase==='calibrate'?'Calibrating':store.activeWorkout.isPaused?'Paused':store.activeWorkout.phase==='feedback'?'Exercise feedback':store.activeWorkout.phase==='pre-set'?'Getting ready':store.activeWorkout.phase==='timed-set'?'Timed set':store.activeWorkout.phase==='warmup'?'Warm-up':store.activeWorkout.phase==='cooldown'?'Cooldown':'Set in progress'}</strong></div><div class="resume-arrow">→</div></button>`:''}
    <section class="program-block-card">
      <div class="block-phase"><span>CURRENT PHASE</span><strong>${esc(blockPhaseLabel(context.blockWeek))}</strong><em>Block ${context.blockNumber} · Program week ${context.weekNumber}${context.calendarWeekNumber>context.weekNumber?' · calendar week '+context.calendarWeekNumber:''}</em></div>
      <div class="block-explainer"><span>THIS WEEK'S ADAPTATION</span><strong>${esc(decision.mode.toUpperCase())}</strong><p>${esc(decision.notes.join(' ')||'Keep building from the targets earned in your previous sessions.')}</p></div>
      ${prior?`<div class="prior-week-mini"><span>LAST WEEK</span><strong>${prior.completed}/${prior.scheduled} workouts · ${prior.averageMinutes||0} min avg</strong><small>${prior.prs||0} PRs · readiness ${prior.averageReadiness?prior.averageReadiness.toFixed(1):'—'}/5</small></div>`:''}
    </section>
    <div class="hero">
      <section class="hero-primary"><p class="eyebrow">THIS WEEK</p><div class="hero-metrics"><div class="hero-metric"><span class="hero-number">${completed}/${schedule.length}</span><span class="hero-label">scheduled workouts</span></div><div class="hero-divider"></div><div class="hero-metric"><span class="hero-number">${formatVolume(weeklyVolume)}</span><span class="hero-label">volume</span></div></div></section>
      <section class="hero-secondary"><div><p class="eyebrow">${next?.status==='missed'?'MISSED SESSION':'NEXT SESSION'}</p><h3>${esc(nextDay?.name||'Week complete')}</h3><p>${next?`${esc(next.dayName)} · ${esc(formatDate(next.dateKey))} · ~${nextDay?.estimatedMinutes||p.minutes} min`:'Your next training week will adapt from this one.'}</p></div>${next&&!store.activeWorkout?`<button class="button" data-start="${esc(next.day.id)}" data-scheduled-date="${esc(next.dateKey)}">${next.status==='missed'?'DO IT TODAY':next.status==='today'?'START TODAY':'START NEXT SESSION'}</button>`:''}</section>
    </div>
    <section class="section weekly-calendar"><div class="section-head"><div><p class="eyebrow">WEEK OF ${esc(formatDate(context.weekKey))}</p><h2>Your training days</h2></div><span class="calendar-phase">${esc(blockPhaseLabel(context.blockWeek))}</span></div>
      <div class="schedule-list">${schedule.map(renderWeekScheduleEntry).join('')}</div>
    </section>
    <section class="profile-strip"><div><span>GOAL</span><strong>${esc(planGoalLabel(p.goal))}</strong></div><div><span>TRAINING DAYS</span><strong>${esc(daysText)}</strong></div><div><span>SETUP</span><strong>${esc(equipmentLabel(p.equipment))}</strong></div><div><span>SESSION TARGET</span><strong>${p.minutes} min</strong></div></section>
    <section class="section"><div class="section-head"><div><p class="eyebrow">PROGRAM TEMPLATE</p><h2>${plan.days.length}-day rotation</h2><p class="section-copy">Anchor movements stay recognizable inside a block. Weekly volume adapts, and selected accessory movements can rotate when a new block begins.</p></div><button class="text-button" data-action="regenerate">Regenerate</button></div>
      <div class="routine-grid">${plan.days.map((day,i)=>{
        const scheduled=schedule.find(entry=>entry.day.id===day.id);
        return `
        <article class="routine-card">
          <div class="routine-top"><span class="routine-number">0${i+1}</span><span class="routine-time">~${day.estimatedMinutes} MIN BASE</span></div>
          <h3>${esc(day.name)}</h3><div class="routine-focus">${esc(day.focus)}</div>
          <div class="routine-sequence">
            <div class="routine-phase-head"><span>01</span><strong>WARM-UP</strong><em>${plannedWarmup(day).reduce((sum,item)=>sum+(Number(item.seconds)||0),0)} sec</em></div>
            <div class="plan-prep-list">${plannedWarmup(day).map((item,index)=>renderPlanTimedRow(item,'warmup',index)).join('')}</div>
            <div class="routine-phase-head work"><span>02</span><strong>WORKOUT</strong><em>${day.exercises.length} exercises</em></div>
            <div class="routine-plan">${day.exercises.map((ex,exIndex)=>`<div class="plan-row detailed visual-plan-row">${exerciseImageButton(ex,'plan-exercise-media')}<div class="plan-row-copy"><strong>${esc(ex.name)}</strong><small class="plan-description">${esc(exerciseDescription(ex))}</small><small class="plan-equipment">Equipment: ${esc(equipmentRequirement(exerciseSource(ex)))}</small>${planPrescriptionHtml(ex)}<div class="plan-swap-actions"><button class="text-button" type="button" data-action="swap-plan" data-day-id="${esc(day.id)}" data-swap-index="${exIndex}">Swap exercise</button>${ex.swapUndo?`<button class="text-button muted" type="button" data-action="undo-plan-swap" data-day-id="${esc(day.id)}" data-swap-index="${exIndex}">Undo swap</button>`:''}</div></div><span>${ex.sets} × ${esc(ex.reps)}<small>${adaptivePrescription(ex)?.rest||ex.rest}s rest</small></span></div>`).join('')}</div>
            <div class="routine-phase-head cooldown"><span>03</span><strong>COOLDOWN</strong><em>${plannedCooldown(day).reduce((sum,item)=>sum+(Number(item.seconds)||0),0)} sec</em></div>
            <div class="plan-prep-list">${plannedCooldown(day).map((item,index)=>renderPlanTimedRow(item,'cooldown',index)).join('')}</div>
          </div>
          <div class="routine-footer"><span class="routine-meta">Base template · ${day.exercises.length} exercises</span>${scheduled&&!store.activeWorkout?`<button class="button secondary" data-start="${esc(day.id)}" data-scheduled-date="${esc(scheduled.dateKey)}">PREPARE ${esc(scheduled.dayName.toUpperCase())}</button>`:''}</div>
        </article>`;
      }).join('')}</div>
    </section>`;
}

function renderCatalog(){
  const q=catalogQuery.trim().toLowerCase();
  const items=catalog.filter(e=>!q||[e.name,e.movement,...e.muscles,e.style,e.difficulty].join(' ').toLowerCase().includes(q));
  return `
    <div class="page-head"><div><p class="eyebrow">EXERCISE LIBRARY</p><h2 class="page-title">${catalog.length} movements.</h2><p class="page-copy">This catalog powers plan generation, equipment matching, starting-load estimates and progression.</p></div></div>
    <div class="catalog-search"><input id="catalog-search" type="search" placeholder="Search chest, squat, dumbbell..." value="${esc(catalogQuery)}"><span>${items.length} shown</span></div>
    <div class="catalog-grid">${items.map(e=>`<article class="catalog-card visual-catalog-card">${exerciseImageButton(e,'catalog-exercise-media')}<div class="catalog-card-copy"><div class="catalog-top"><span>${esc(movements[e.movement]||e.movement)}</span><span>${esc(e.difficulty)}</span></div><h3>${esc(e.name)}</h3><p>${e.muscles.map(esc).join(' · ')}</p><p class="catalog-description">${esc(exerciseDescription(e))}</p><div class="catalog-tags"><span>${esc(e.style)}</span><span>${esc(e.equipment.join(' / '))}</span></div><button class="text-button catalog-details" type="button" data-exercise-detail="${esc(e.id)}">View form & cues</button></div></article>`).join('')}</div>`;
}

function renderWorkoutIntro(w){
  const first=w.exercises?.[0];
  const equipment=[...new Set((w.exercises||[]).map(ex=>equipmentRequirement(exerciseSource(ex))))];
  const notes=(w.adaptationNotes||[]).filter(Boolean);
  return '<div class="workout-intro-stage">'+
    '<p class="eyebrow">TODAY’S SESSION</p><h2>'+esc(w.routineName)+'</h2><p class="intro-focus">'+esc(w.focus||'')+'</p>'+
    '<div class="intro-stats"><div><span>TIME</span><strong>~'+esc(w.readiness?.timeAvailable||store.profile?.minutes||45)+' min</strong></div><div><span>EXERCISES</span><strong>'+w.exercises.length+'</strong></div><div><span>WORKING SETS</span><strong>'+totalSets(w.exercises)+'</strong></div></div>'+
    (notes.length?'<div class="intro-adjustments"><span>TODAY’S ADJUSTMENTS</span>'+notes.map(note=>'<p>'+esc(note)+'</p>').join('')+'</div>':'')+
    (first?'<section class="intro-first-exercise">'+exerciseImageButton(first,'intro-exercise-media')+'<div><span>FIRST EXERCISE</span><h3>'+esc(first.name)+'</h3><p>'+esc(exerciseDescription(first))+'</p><strong>'+esc(equipmentRequirement(exerciseSource(first)))+'</strong></div></section>':'')+
    '<div class="intro-equipment"><span>EQUIPMENT YOU’LL USE</span><p>'+equipment.map(esc).join(' · ')+'</p></div>'+
    '<div class="intro-actions"><button class="button primary-action" data-action="begin-session">BEGIN WORKOUT</button><button class="button secondary" data-action="open-workout-map">REVIEW / REORDER SESSION</button></div>'+
  '</div>';
}
function beginWorkoutSession(){
  const w=store.activeWorkout;if(!w||w.phase!=='intro')return;
  unlockWorkoutCues();
  fireWorkoutSignal('go','session-intro-'+w.id,{voice:w.routineName+'. '+w.exercises.length+' exercises today. We will start with '+(w.warmup?.length?'your warm-up.':' '+(w.exercises[0]?.name||'your first exercise')+'.'),label:'READY'});
  if(w.warmup?.length){
    w.phase='warmup';
    w.timedPhaseStartedAt=new Date().toISOString();
    w.timedPhaseSkippedSeconds=0;
    saveStore();render();
  }else{
    beginPreSetPosition(0,0,true);
  }
}

function renderWorkout(){
  const pos=getActivePosition();
  if(!pos)return `<div class="page-head"><div><p class="eyebrow">GUIDED WORKOUT</p><h2 class="page-title">No active session.</h2><p class="page-copy">Start the next workout from your generated plan.</p></div><button class="button" data-action="home">VIEW PLAN</button></div>`;
  const w=pos.workout;
  const done=completedSets(w.exercises),total=totalSets(w.exercises),resolved=workoutResolvedCount(w),pct=Math.round(resolved/Math.max(1,w.exercises.length)*100);
  const inExercise=['work','rest','calibrate','feedback','pre-set','timed-set','exercise-review','exercise-transition'].includes(w.phase);
  const stageLabel=w.isPaused?'PAUSED':w.phase==='intro'?'SESSION INTRO':w.phase==='review'?'SESSION REVIEW':w.phase==='exercise-transition'?'NEXT EXERCISE':w.phase==='exercise-review'?'EXERCISE REVIEW':w.phase==='warmup'?'DYNAMIC STRETCH':w.phase==='cooldown'?'COOLDOWN':w.phase==='feedback'?'EXERCISE FEEDBACK':w.phase==='pre-set'?'GET READY':w.phase==='timed-set'?'TIMED SET':'CURRENT EXERCISE';
  return `<div class="guided-shell">
    <div id="workout-cue-flash" class="workout-cue-flash" aria-hidden="true"></div>
    <div class="session-status workout-status">
      <div class="session-title"><p class="eyebrow">ACTIVE WORKOUT</p><h2>${esc(w.routineName)}</h2><div class="session-meta"><span>${resolved}/${w.exercises.length} exercises</span><span>${done}/${total} logged sets</span><span>${pct}%</span><span>${esc(stageLabel)}</span></div></div>
      <div class="clock-pair">
        <div class="clock-card"><span>TOTAL</span><strong id="elapsed-clock">${formatClock(workoutElapsedSeconds(w))}</strong></div>
        <div class="clock-card"><span>EXERCISE</span><strong id="exercise-clock">${inExercise?formatClock(exerciseElapsedSeconds(w)):'--:--'}</strong></div>
      </div>
    </div>
    ${renderCueControls()}
    <div class="training-context-strip"><span>BLOCK ${w.programContext?.blockNumber||1} · WEEK ${w.programContext?.blockWeek||1}</span><strong>${esc(blockPhaseLabel(w.programContext?.blockWeek||1))}</strong>${w.readiness?.score?'<em>Readiness '+esc(w.readiness.score)+'/5 · '+esc(w.readiness.timeAvailable)+' min available</em>':''}</div>
    ${w.isPaused?'<div class="workout-pause-banner"><strong>WORKOUT PAUSED</strong><span>All workout timers are frozen. Resume when you are ready.</span></div>':''}
    <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
    <div class="step-strip">${w.exercises.map((ex,i)=>`<button type="button" class="step-pip ${exerciseCountsAsResolved(ex)?'done':''} ${i===pos.ei&&inExercise?'current':''} ${exerciseState(ex)==='partial'?'partial':''}" data-action="jump-exercise" data-exercise-index="${i}" aria-label="${esc(ex.name)} · ${esc(exerciseStateLabel(ex))}"></button>`).join('')}</div>
    <section class="exercise-stage">${w.phase==='intro'?renderWorkoutIntro(w):w.phase==='review'?renderWorkoutReview(w):w.phase==='exercise-transition'?renderExerciseTransition(w):w.phase==='exercise-review'?renderExerciseReview(pos):w.phase==='warmup'||w.phase==='cooldown'?renderTimedStage(w):w.phase==='pre-set'?renderPreSet(pos):w.phase==='timed-set'?renderTimedWorkSet(pos):w.phase==='rest'?renderRest(pos):w.phase==='calibrate'?renderCalibration(pos):w.phase==='feedback'?renderExerciseFeedback(pos):renderWorkSet(pos)}</section>
    <div class="session-controls"><button class="button secondary" data-action="previous-exercise">← PREVIOUS</button><button class="button secondary" data-action="open-workout-map">WORKOUT MAP</button><button class="button secondary" data-action="next-exercise">NEXT →</button><button class="button secondary pause-workout-button" data-action="toggle-workout-pause">${w.isPaused?'RESUME WORKOUT':'PAUSE WORKOUT'}</button><button class="button ghost" data-action="home">LEAVE & RESUME LATER</button><button class="button danger" data-action="finish">FINISH EARLY</button><button class="button danger" data-action="discard">DISCARD</button></div>
  </div>`;
}

function renderPreSet(pos){
  const snap=preSetSnapshot(pos.workout)||{mode:'countdown',remaining:3};
  const setup=snap.mode==='setup';
  const target=pos.exercise.loadMode==='timed'?(pos.set.reps||pos.exercise.suggestedReps||recommendedRepCount(pos.exercise.reps))+' sec':pos.exercise.reps;
  return `<div class="pre-set-stage" data-preset-mode="${esc(snap.mode)}">
    <div class="pre-set-media">${exerciseImageButton(pos.exercise,'pre-set-exercise-media')}</div>
    <div class="pre-set-copy">
      <p class="eyebrow">${setup?'GET IN POSITION':'SET STARTING'}</p>
      <div class="stage-count">SET ${pos.si+1} OF ${pos.exercise.sets.length} · ${esc(pos.exercise.name)}</div>
      <p class="exercise-description pre-set-description">${esc(exerciseDescription(pos.exercise))}</p>
      <div class="pre-set-equipment"><span>EQUIPMENT</span><strong>${esc(equipmentRequirement(exerciseSource(pos.exercise)))}</strong></div>
      ${renderExerciseHistoryPanel(pos.exercise)}
      <div class="exercise-inline-actions centered-actions"><button class="text-button" type="button" data-exercise-detail="${esc(pos.exercise.id)}">View form</button><button class="text-button" type="button" data-action="swap-active" data-swap-index="${pos.ei}">Swap exercise</button>${pos.exercise.swapUndo&&!pos.exercise.sets.some(set=>set.completed)?`<button class="text-button muted" type="button" data-action="undo-active-swap" data-swap-index="${pos.ei}">Undo swap</button>`:''}</div>
      <div class="pre-set-number" id="preset-count">${snap.remaining}</div>
      <h3 id="preset-label">${setup?'Set up your equipment':'Get ready'}</h3>
      <p>${setup?'You have a few seconds to get into position before the start countdown.':'The set begins automatically after 3 · 2 · 1.'}</p>
      <div class="pre-set-target"><span>TARGET</span><strong>${esc(target)}</strong></div>
      <div class="timer-actions compact-timer-actions"><button class="button secondary" type="button" data-action="reset-timer">RESET TIMER</button><button class="button secondary" type="button" data-action="start-set-now">START NOW</button></div>
    </div>
  </div>`;
}

function renderTimedWorkSet(pos){
  const snap=timedSetSnapshot(pos.workout)||{remaining:num(pos.set.reps)||30,total:num(pos.set.reps)||30};
  const pct=Math.max(0,Math.min(100,(snap.remaining/Math.max(1,snap.total))*100));
  return `<div class="timed-work-stage">
    <div class="timed-work-media">${exerciseImageButton(pos.exercise,'timed-work-exercise-media')}</div>
    <div class="timed-work-copy">
      <p class="eyebrow">TIMED SET · SET ${pos.si+1} OF ${pos.exercise.sets.length}</p>
      <h3>${esc(pos.exercise.name)}</h3>
      <p class="exercise-description timed-work-description">${esc(exerciseDescription(pos.exercise))}</p>
      <div class="pre-set-equipment"><span>EQUIPMENT</span><strong>${esc(equipmentRequirement(exerciseSource(pos.exercise)))}</strong></div>
      <div class="exercise-inline-actions centered-actions"><button class="text-button" type="button" data-exercise-detail="${esc(pos.exercise.id)}">View form</button><button class="text-button" type="button" data-action="swap-active" data-swap-index="${pos.ei}">Swap exercise</button></div>
      <p class="timed-work-cue">${esc(exerciseGuidance(pos.exercise).cue)}</p>
      <div class="timed-work-clock" id="timed-set-clock">${formatClock(snap.remaining)}</div>
      <div class="stage-progress"><span id="timed-set-progress" style="width:${pct}%"></span></div>
      <div class="timed-finish-note" id="timed-finish-note">${snap.remaining<=3&&snap.remaining>0?String(snap.remaining)+'…':'Stay controlled. You’ll get a finish cue at zero.'}</div>
      <div class="timer-actions compact-timer-actions"><button class="button secondary" type="button" data-action="reset-timer">RESET TIMER</button><button class="button secondary" type="button" data-action="end-timed-set">END SET EARLY</button></div>
    </div>
  </div>`;
}

function renderTimedStage(w){
  const items=timedStageItems(w);
  const snap=timedStageSnapshot(w)||{index:0,remaining:0,total:30};
  const index=Math.max(0,Math.min(snap.index||0,Math.max(0,items.length-1)));
  const item=items[index]||items[0];
  const remaining=snap.remaining||0;
  const isWarmup=w.phase==='warmup';
  const nextLabel=index+1<items.length?items[index+1].name:(isWarmup?w.exercises[0]?.name:'Workout summary');
  const image=timedStageImageUrl(item,0);
  return `<div class="timed-stage visual-timed-stage" data-stage-index="${index}">
    <div class="timed-stage-media">${image?`<img src="${esc(image)}" loading="eager" decoding="async" alt="${esc(item?.name||'Stretch')} demonstration">`:''}</div>
    <div class="timed-stage-copy">
      <p class="eyebrow">${isWarmup?'DYNAMIC STRETCH':'COOLDOWN'}</p>
      <div class="stage-count">STEP ${index+1} OF ${items.length} · TIMER V3</div>
      <h3>${esc(item?.name||'Get ready')}</h3>
      <p class="stretch-description">${esc(timedStageDescription(item))}</p>
      <p class="stage-cue">${esc(item?.cue||'Move through a comfortable range and breathe steadily.')}</p>
      <div class="stage-why"><span>WHY THIS STEP</span><strong>${esc(timedStageWhy(item))}</strong></div>
      <div class="stage-timer" id="stage-clock">${formatClock(remaining)}</div>
      <div class="stage-progress"><span id="stage-progress-fill" style="width:${Math.max(0,Math.min(100,(remaining/Math.max(1,item?.seconds||30))*100))}%"></span></div>
      <div class="next-preview"><div><span>UP NEXT</span><strong>${esc(nextLabel||'Begin workout')}</strong></div><div class="next-arrow">→</div></div>
      <div class="timer-actions compact-timer-actions"><button class="button secondary" data-action="reset-timer">RESET TIMER</button><button class="button secondary stage-skip" data-action="skip-stage">SKIP STEP</button></div>
    </div>
  </div>`;
}

function exerciseSessionHistory(exerciseId,limit=4){
  const rows=[];
  for(const workout of store.history){
    const ex=(workout.exercises||[]).find(item=>item.id===exerciseId);
    if(!ex)continue;
    const sets=(ex.sets||[]).filter(set=>set.completed);
    if(!sets.length)continue;
    let best=null;
    for(const set of sets){
      const current={weight:num(set.weight),reps:num(set.reps)};
      if(!best||current.weight>best.weight||(current.weight===best.weight&&current.reps>best.reps))best=current;
    }
    rows.push({
      workoutId:workout.id,
      date:workout.completedAt,
      scheduledDate:workout.scheduledDate||'',
      routineName:workout.routineName,
      sets:sets.map(set=>({weight:num(set.weight),reps:num(set.reps)})),
      best,
      feedback:ex.feedback||'',
      volume:sets.reduce((sum,set)=>sum+num(set.weight)*num(set.reps),0)
    });
    if(rows.length>=limit)break;
  }
  return rows;
}
function exerciseTrend(ex){
  const history=exerciseSessionHistory(ex.id,2);
  if(!history.length)return {label:'FIRST SESSION',detail:'This workout will establish your baseline.'};
  if(history.length===1)return {label:'BASELINE SET',detail:'One completed session is logged for this movement.'};
  const latest=history[0].best,previous=history[1].best;
  if(!latest||!previous)return {label:'BUILDING HISTORY',detail:'Keep logging clean sets to establish a trend.'};
  if(latest.weight>previous.weight)return {label:'TRENDING UP',detail:'Best working weight increased by '+Math.round(latest.weight-previous.weight)+' lb.'};
  if(latest.weight===previous.weight&&latest.reps>previous.reps)return {label:'TRENDING UP',detail:'Same load with '+Math.round(latest.reps-previous.reps)+' more rep'+(latest.reps-previous.reps===1?'':'s')+' at your best set.'};
  if(latest.weight<previous.weight)return {label:'REBUILDING',detail:'The latest session used a lighter best working load.'};
  if(latest.reps<previous.reps)return {label:'HOLDING LOAD',detail:'Load stayed the same while reps were lower last session.'};
  return {label:'STEADY',detail:'Your latest best set matched the previous session.'};
}
function setPerformanceLabel(ex,set){
  if(ex.loadMode==='timed')return String(set.reps)+' sec';
  if(!set.weight)return String(set.reps)+' reps';
  return String(set.weight)+' lb × '+String(set.reps);
}
function renderExerciseHistoryPanel(ex){
  const history=exerciseSessionHistory(ex.id,3);
  const trend=exerciseTrend(ex);
  const latest=history[0];
  const target=adaptivePrescription(ex);
  if(!latest)return '<div class="exercise-history-card first-session"><div><span>PROGRESSION</span><strong>'+esc(trend.label)+'</strong><p>'+esc(trend.detail)+'</p></div><em>Baseline today</em></div>';
  return '<div class="exercise-history-card">'+
    '<div class="exercise-history-head"><div><span>LAST TIME · '+esc(formatDate(latest.date))+'</span><strong>'+esc(trend.label)+'</strong></div><em>'+esc(trend.detail)+'</em></div>'+
    '<div class="last-set-strip">'+latest.sets.map((set,index)=>'<span><small>S'+(index+1)+'</small><strong>'+esc(setPerformanceLabel(ex,set))+'</strong></span>').join('')+'</div>'+
    '<div class="exercise-history-foot"><div><span>ALL-TIME BEST</span><strong>'+esc(bestLabel(ex.id))+'</strong></div><div><span>NEXT TARGET</span><strong>'+esc(target?.label||currentPrescriptionLabel(ex))+'</strong></div></div>'+
  '</div>';
}
function recentExerciseTrendCards(limit=6){
  const seen=new Set(),cards=[];
  for(const workout of store.history){
    for(const ex of workout.exercises||[]){
      if(seen.has(ex.id)||(ex.sets||[]).every(set=>!set.completed))continue;
      seen.add(ex.id);
      cards.push({ex,trend:exerciseTrend(ex),history:exerciseSessionHistory(ex.id,2)});
      if(cards.length>=limit)return cards;
    }
  }
  return cards;
}

function suggestedLabel(ex){
  if(ex.loadMode==='bodyweight'||ex.loadMode==='timed')return 'Bodyweight';
  if(ex.loadMode==='band')return 'Band resistance';
  if(ex.loadMode==='dumbbell-pair')return `${ex.suggestedWeight||0} lb each`;
  if(ex.loadMode==='assisted')return 'Set assistance';
  return ex.suggestedWeight?`${ex.suggestedWeight} lb`:'Calibration required';
}

function renderWorkSet(pos){
  const next=nextPosition(pos.workout,pos.ei,pos.si);
  const isTimed=pos.exercise.loadMode==='timed';
  const noLoad=['bodyweight','timed','band'].includes(pos.exercise.loadMode);
  const defaultWeight=pos.set.weight ?? (pos.exercise.suggestedWeight||'');
  const defaultReps=pos.set.reps ?? pos.exercise.suggestedReps ?? '';
  return `
    <div class="exercise-hero visual-exercise-hero"><div class="exercise-hero-layout">${exerciseImageButton(pos.exercise,'active-exercise-media')}<div class="exercise-hero-copy"><div class="exercise-kicker"><span class="current-label">CURRENT EXERCISE</span><span>EXERCISE ${pos.ei+1}/${pos.workout.exercises.length}</span></div><h3>${esc(pos.exercise.name)}</h3><p class="exercise-muscles">${(pos.exercise.muscles||[]).map(esc).join(' · ')}</p><p class="exercise-description">${esc(exerciseDescription(pos.exercise))}</p><p class="exercise-equipment-line"><span>EQUIPMENT</span><strong>${esc(equipmentRequirement(exerciseSource(pos.exercise)))}</strong></p><p class="exercise-target">${pos.exercise.sets.length} sets · target ${esc(pos.exercise.reps)} · ${pos.exercise.rest}s rest</p><div class="workout-cue"><span>FORM CUE</span><strong>${esc(exerciseGuidance(pos.exercise).cue)}</strong></div><div class="exercise-inline-actions"><button class="text-button exercise-details-link" type="button" data-exercise-detail="${esc(pos.exercise.id)}">View exercise details</button><button class="text-button" type="button" data-action="swap-active" data-swap-index="${pos.ei}">Swap exercise</button>${pos.exercise.swapUndo&&!pos.exercise.sets.some(set=>set.completed)?`<button class="text-button muted" type="button" data-action="undo-active-swap" data-swap-index="${pos.ei}">Undo swap</button>`:''}</div><div class="initial-prescription"><span>${pos.exercise.adaptiveLabel?'LEARNED PRESCRIPTION':'STARTING PRESCRIPTION'}</span><strong>${esc(currentPrescriptionLabel(pos.exercise))}</strong>${pos.exercise.adaptiveReason?`<small>${esc(pos.exercise.adaptiveReason)}</small>`:''}</div><div class="recommend-row"><div class="exercise-best"><span>Suggested start</span><strong>${esc(suggestedLabel(pos.exercise))}</strong></div><div class="exercise-best"><span>Previous best</span><strong>${esc(bestLabel(pos.exercise.id))}</strong></div></div>${renderExerciseHistoryPanel(pos.exercise)}</div></div></div>
    <div class="set-panel"><div class="set-heading"><h4>Set ${pos.si+1} of ${pos.exercise.sets.length}</h4><span>${pos.si===0&&pos.exercise.calibrationRequired?'Calibration set':'Working set'}</span></div>
      <div class="input-grid">
        <div class="field"><label>WEIGHT (LB)${noLoad?' · OPTIONAL':''}</label><input id="set-weight" inputmode="decimal" value="${esc(defaultWeight)}" placeholder="${noLoad?'Bodyweight':'0'}"></div>
        <div class="field"><label>${isTimed?'SECONDS':'REPS'}</label><input id="set-reps" inputmode="numeric" value="${esc(defaultReps)}" placeholder="${isTimed?'45':'0'}"></div>
      </div>
      <button class="button primary-action" data-action="complete-set">COMPLETE SET ${pos.si+1}</button>
      ${renderLoggedSets(pos.exercise,pos.ei)}
      <div class="active-exercise-controls"><button class="button secondary" data-action="mark-exercise-complete" data-exercise-index="${pos.ei}">MARK EXERCISE COMPLETE</button><button class="button secondary" data-action="move-exercise-later" data-exercise-index="${pos.ei}">EQUIPMENT BUSY · MOVE LATER</button><button class="button ghost" data-action="skip-exercise" data-exercise-index="${pos.ei}">SKIP EXERCISE</button></div>
      <div class="next-preview"><div><span>UP NEXT</span><strong>${next?(next.type==='set'?`Set ${next.si+1} · ${pos.exercise.name}`:pos.workout.exercises[next.ei].name):'Workout complete'}</strong></div><div class="next-arrow">→</div></div>
    </div>`;
}

function renderCalibration(pos){
  const first=pos.exercise.sets[0];
  return `<div class="calibration-stage"><p class="eyebrow">QUICK CALIBRATION</p><h3>How much did you have left?</h3><p>You completed ${esc(first.reps)} reps at ${first.weight?esc(first.weight)+' lb':'your chosen resistance'}. Estimate how many clean reps you could still have done. We’ll adjust the next sets and remember it.</p>
    <div class="rir-grid">
      <button data-rir="5+"><strong>5+</strong><span>Very easy</span></button>
      <button data-rir="3-4"><strong>3–4</strong><span>Easy</span></button>
      <button data-rir="2"><strong>2</strong><span>Right on target</span></button>
      <button data-rir="1"><strong>1</strong><span>Very hard</span></button>
      <button data-rir="0"><strong>0</strong><span>Max effort</span></button>
    </div><small class="calibration-note">This is a training estimate, not a strength test. Stop if a movement causes pain or feels unsafe.</small></div>`;
}

function renderExerciseFeedback(pos){
  const stats=completedExerciseStats(pos.exercise);
  const setSummary=stats.sets.map((set,index)=>{
    const weight=num(set.weight);
    const value=pos.exercise.loadMode==='timed'?esc(set.reps)+' sec':weight?esc(weight)+' lb × '+esc(set.reps):esc(set.reps)+' reps';
    return '<span><strong>Set '+String(index+1)+'</strong>'+value+'</span>';
  }).join('');
  return '<div class="exercise-feedback-stage">'+
    '<p class="eyebrow">EXERCISE COMPLETE</p>'+
    '<h3>How did '+esc(pos.exercise.name)+' feel?</h3>'+
    '<p class="feedback-copy">One tap helps set your next-session target. Hard is okay if you completed the work with solid form.</p>'+
    '<div class="feedback-set-summary">'+setSummary+'</div>'+
    '<div class="feedback-target">Target: <strong>'+esc(pos.exercise.reps)+'</strong> · Rest: <strong>'+esc(pos.exercise.rest)+'s</strong></div>'+
    '<div class="exercise-feedback-grid">'+
      '<button data-feedback="too-easy"><strong>Too easy</strong><span>Increase the challenge</span></button>'+
      '<button data-feedback="good"><strong>Good</strong><span>Right where it should be</span></button>'+
      '<button data-feedback="hard"><strong>Hard, completed</strong><span>Keep building here</span></button>'+
      '<button data-feedback="too-hard"><strong>Too hard</strong><span>Back off next time</span></button>'+
      '<button data-feedback="form-off"><strong>Form felt off</strong><span>Hold progression</span></button>'+
    '</div>'+
    '<small class="feedback-note">If a movement causes pain rather than normal training effort, stop that movement and choose a comfortable alternative.</small>'+
  '</div>';
}

function renderNextExerciseCard(nextEx,next){
  if(!nextEx||!next)return '';
  const src=exerciseImageUrl(nextEx,0,false),fallback=exerciseImageUrl(nextEx,0,true);
  const guide=exerciseGuidance(nextEx);
  return '<section class="next-exercise-card">'+
    '<div class="next-exercise-media">'+(src?'<img src="'+esc(src)+'" data-fallback-src="'+esc(fallback)+'" alt="'+esc(nextEx.name)+' demonstration">':'')+'</div>'+
    '<div class="next-exercise-copy"><p class="eyebrow">UP NEXT · EXERCISE '+String(next.ei+1)+'/'+String(store.activeWorkout?.exercises?.length||'')+'</p>'+
    '<h3>'+esc(nextEx.name)+'</h3><p>'+esc(exerciseDescription(nextEx))+'</p>'+
    '<div class="next-exercise-facts"><div><span>EQUIPMENT</span><strong>'+esc(equipmentRequirement(exerciseSource(nextEx)))+'</strong></div>'+
    '<div><span>TARGET</span><strong>'+String(nextEx.sets?.length||0)+' sets · '+esc(nextEx.reps)+'</strong></div>'+
    '<div><span>REST</span><strong>'+esc(nextEx.rest)+' sec</strong></div>'+
    '<div><span>WORKS</span><strong>'+esc((nextEx.muscles||[]).join(' · '))+'</strong></div></div>'+
    '<div class="next-setup-cue"><span>SETUP CUE</span><strong>'+esc(guide.setup)+'</strong></div>'+
    '<div class="next-exercise-actions"><button class="button secondary" type="button" data-exercise-detail="'+esc(nextEx.id)+'">VIEW FORM</button>'+
    '<button class="button secondary" type="button" data-action="swap-active" data-swap-index="'+next.ei+'">SWAP EXERCISE</button>'+
    (nextEx.swapUndo&&!nextEx.sets.some(set=>set.completed)?'<button class="text-button muted" type="button" data-action="undo-active-swap" data-swap-index="'+next.ei+'">Undo swap</button>':'')+
    '</div></div></section>';
}

function renderExerciseTransition(w){
  const next=w.pendingPosition;
  const ex=next?w.exercises[next.ei]:null;
  if(!next||!ex)return '<div class="empty-state"><h2>No next exercise.</h2><button class="button" data-action="open-workout-review">REVIEW WORKOUT</button></div>';
  return '<div class="exercise-transition-stage"><p class="eyebrow">NEXT EXERCISE</p>'+renderNextExerciseCard(ex,next)+
    '<div class="transition-ready-actions"><button class="button primary-action" data-action="ready-next-exercise">I’M READY · START COUNTDOWN</button>'+
    '<button class="button secondary" data-action="mark-exercise-complete" data-exercise-index="'+next.ei+'">ALREADY DONE · MARK COMPLETE</button>'+
    '<button class="button secondary" data-action="move-exercise-later" data-exercise-index="'+next.ei+'">EQUIPMENT BUSY · MOVE LATER</button></div></div>';
}

function renderRest(pos){
  const remaining=restRemaining(pos.workout),next=pos.workout.pendingPosition,nextEx=next?pos.workout.exercises[next.ei]:null,paused=Number.isFinite(pos.workout.restPausedRemaining);
  const changingExercise=Boolean(next&&next.ei!==pos.ei);
  const result=pos.workout.lastProgressionResult;
  const progression=result?`<div class="next-time-card"><span>NEXT TIME</span><strong>${esc(result.label)}</strong><p>${esc(result.reason)}</p></div>`:'';
  return `<div class="rest-stage"><div class="rest-label">${changingExercise?'EXERCISE COMPLETE · TRANSITION':'REST TIMER'}</div>${progression}<div class="timer-wrap" id="timer-ring" style="--timer-progress:${restProgress(pos.workout)}%"><div><div class="timer-value" id="rest-clock">${formatClock(remaining)}</div><div class="timer-sub">${paused?'PAUSED':changingExercise?'GET READY FOR NEXT EXERCISE':'UNTIL NEXT SET'}</div></div></div><h3>${changingExercise?'Move to your next station':'Recover, then go again'}</h3><p>${changingExercise?'Use this time to grab the equipment and review the next movement. The 3 · 2 · 1 start countdown follows automatically.':'When rest ends, the get-ready countdown starts automatically.'}</p><div class="timer-actions"><button class="button secondary" data-action="add-rest" ${remaining>=60?'disabled':''}>${remaining>=60?'60 SEC MAX':'+15 SEC'}</button><button class="button secondary" data-action="pause-rest">${paused?'RESUME':'PAUSE'}</button><button class="button secondary" data-action="reset-timer">RESET TIMER</button><button class="button" data-action="skip-rest">SKIP REST</button></div>${changingExercise?renderNextExerciseCard(nextEx,next):(nextEx?`<div class="up-next-card"><div class="up-next-number">${String(next.ei+1).padStart(2,'0')}</div><div><span>UP NEXT</span><strong>Set ${next.si+1} · ${esc(nextEx.name)}</strong></div><em>${esc(nextEx.reps)}</em></div>`:'')}</div>`;
}

function renderHistory(){
  const rows=store.history.map(x=>{
    const learned=(x.exercises||[]).filter(ex=>ex.nextRecommendation).length;
    const scheduled=x.scheduledDate||'';
    const actual=x.actualCompletedDate||x.actualStartDate||dateKey(new Date(x.completedAt));
    const timing=scheduled?(scheduled===actual?'Scheduled & completed '+formatDate(actual):'Scheduled '+formatDate(scheduled)+' · trained '+formatDate(actual)):'Completed '+formatDate(x.completedAt);
    const readiness=x.readiness?.score?'<span>•</span><span>readiness '+esc(x.readiness.score)+'/5</span>':'';
    const block=x.programContext?'<span>•</span><span>Block '+esc(x.programContext.blockNumber)+' · W'+esc(x.programContext.blockWeek)+'</span>':'';
    return '<article class="history-card"><div class="history-top"><div><h3>'+esc(x.routineName)+'</h3><div class="history-date">'+esc(timing)+'</div></div><div class="history-volume">'+formatVolume(x.totalVolume||0)+'</div></div><div class="history-stats"><span>'+x.completedSets+' sets</span><span>•</span><span>'+x.durationMinutes+' min</span>'+block+readiness+(learned?'<span>•</span><span>'+learned+' learned target'+(learned===1?'':'s')+'</span>':'')+(x.newPRs?.length?'<span>•</span><span>'+x.newPRs.length+' PR'+(x.newPRs.length===1?'':'s')+'</span>':'')+'</div></article>';
  }).join('');
  return '<div class="page-head"><div><p class="eyebrow">TRAINING LOG</p><h2 class="page-title">History by day.</h2><p class="page-copy">Scheduled date, actual training date, readiness, training block, duration, volume, PRs, and adaptive decisions all stay attached to the session.</p></div></div><div class="history-list">'+(rows||renderEmpty('No workout history','Complete your first scheduled workout and it will appear here.'))+'</div>';
}

function personalRecords(){
  const map=new Map();
  for(const w of store.history)for(const ex of w.exercises)for(const s of ex.sets){if(!s.completed)continue;const c={id:ex.id,name:ex.name,weight:num(s.weight),reps:num(s.reps)};const old=map.get(ex.id);if(!old||c.weight>old.weight||(c.weight===old.weight&&c.reps>old.reps))map.set(ex.id,c);}
  return [...map.values()].sort((a,b)=>b.weight-a.weight);
}
function renderProgress(){
  const week=weeklyHistory(),allVolume=store.history.reduce((sum,item)=>sum+(item.totalVolume||0),0),prs=personalRecords().slice(0,12),calibrated=Object.keys(store.calibration).length;
  const learnedAll=Object.values(store.progression||{}).sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));
  const learned=learnedAll.slice(0,10);
  const decisions=(Array.isArray(store.progressionLog)?store.progressionLog:[]).slice(0,12);
  const trends=recentExerciseTrendCards(8);
  const context=programContext();
  const schedule=currentWeekSchedule();
  return `<div class="page-head"><div><p class="eyebrow">PROGRESS · BLOCK ${context.blockNumber} WEEK ${context.blockWeek}</p><h2 class="page-title">Your training story.</h2><p class="page-copy">Progress includes stronger sets, more reps, consistency, readiness, adherence, and the adaptive choices your program makes next.</p></div></div>
    <div class="progress-grid">
      <section class="panel"><h3>This week</h3><div class="big-stat">${schedule.filter(entry=>entry.status==='complete').length}/${schedule.length}</div><div class="stat-label">scheduled workouts completed</div></section>
      <section class="panel"><h3>All-time volume</h3><div class="big-stat">${formatVolume(allVolume)}</div><div class="stat-label">logged volume</div></section>
      <section class="panel"><h3>Learned movements</h3><div class="big-stat">${learnedAll.length}</div><div class="stat-label">${calibrated} initially calibrated</div></section>
      <section class="panel"><h3>Personal records</h3>${prs.length?`<div class="pr-list">${prs.map(pr=>`<div class="pr-row"><span>${esc(pr.name)}</span><strong>${pr.weight?`${pr.weight} lb × ${pr.reps}`:`${pr.reps} reps`}</strong></div>`).join('')}</div>`:'<div class="stat-label">Complete workouts to establish PRs.</div>'}</section>
    </div>
    ${trends.length?`<section class="panel trend-panel"><div class="section-head"><div><p class="eyebrow">EXERCISE TRENDS</p><h3>More than PRs.</h3></div></div><div class="trend-grid">${trends.map(item=>`<article class="trend-card"><span>${esc(item.trend.label)}</span><strong>${esc(item.ex.name)}</strong><p>${esc(item.trend.detail)}</p><small>${item.history.length} recent session${item.history.length===1?'':'s'} analyzed</small></article>`).join('')}</div></section>`:''}
    ${learned.length?`<section class="panel learned-panel"><p class="eyebrow">NEXT-SESSION TARGETS</p><div class="learned-list">${learned.map(item=>`<div class="learned-row"><div><strong>${esc(item.name)}</strong><span>${esc(item.reason)}</span></div><em>${esc(item.label)}</em></div>`).join('')}</div></section>`:''}
    ${decisions.length?`<section class="panel decision-panel"><p class="eyebrow">RECENT ADAPTIVE DECISIONS</p><div class="decision-list">${decisions.map(item=>`<div class="decision-row"><div><strong>${esc(item.name)}</strong><span>${esc(feedbackLabel(item.feedback))} · ${esc(item.routineName||'Workout')} · ${esc(formatDate(item.loggedAt||item.updatedAt))}</span><small>${esc(item.reason)}</small></div><em>${esc(item.label)}</em></div>`).join('')}</div></section>`:''}`;
}

function renderSummary(){
  const x=store.history.find(h=>h.id===store.lastSummaryId)||store.history[0];if(!x)return renderHistory();
  const recommendations=(x.exercises||[]).filter(ex=>ex.nextRecommendation).map(ex=>ex.nextRecommendation);
  return `<div class="summary-hero"><div class="summary-check">✓</div><p class="eyebrow">WORKOUT COMPLETE</p><h2>${esc(x.routineName)} done.</h2><p>Your history and next-session targets are updated from what you actually did.</p><div class="summary-grid"><div class="summary-card"><strong>${x.durationMinutes}</strong><span>Minutes</span></div><div class="summary-card"><strong>${x.completedSets}</strong><span>Sets</span></div><div class="summary-card"><strong>${formatVolume(x.totalVolume||0)}</strong><span>Volume</span></div></div>${recommendations.length?`<section class="panel adaptive-summary"><p class="eyebrow">NEXT TIME</p><div class="learned-list">${recommendations.map(item=>`<div class="learned-row"><div><strong>${esc(item.name)}</strong><span>${esc(item.reason)}</span></div><em>${esc(item.label)}</em></div>`).join('')}</div></section>`:''}${x.newPRs?.length?`<section class="panel summary-prs"><p class="eyebrow">NEW PERSONAL RECORDS</p><div class="pr-list">${x.newPRs.map(pr=>`<div class="pr-row"><span>${esc(pr.name)}</span><strong>${pr.weight?`${pr.weight} lb × ${pr.reps}`:`${pr.reps} reps`}</strong></div>`).join('')}</div></section>`:''}<div class="summary-actions"><button class="button" data-action="home">BACK TO PLAN</button><button class="button secondary" data-action="history">VIEW HISTORY</button></div></div>`;
}
function renderEmpty(title,copy){return `<div class="empty-state"><div class="empty-glyph">W/</div><h2>${esc(title)}</h2><p>${esc(copy)}</p></div>`;}

function setTab(tab){
  if(!store.profile&&tab!=='profile'){currentTab='profile';}else currentTab=tab;
  render();updateTimers();window.scrollTo({top:0,behavior:'smooth'});
}
function syncNav(){
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.tab===currentTab||(currentTab==='summary'&&b.dataset.tab==='history')));
  const nav=document.querySelector('.bottom-nav');if(nav)nav.classList.toggle('nav-disabled',!store.profile);
}
function syncLiveBadge(){const b=document.querySelector('.nav-live');if(b)b.hidden=!store.activeWorkout;}
function toast(message){const r=document.querySelector('#toast-region')||document.body;r.querySelector('.toast')?.remove();const n=document.createElement('div');n.className='toast';n.textContent=message;r.append(n);setTimeout(()=>n.remove(),2300);}

function render(){
  const app=document.querySelector('#app');if(!app)return;
  if(currentTab==='profile')app.innerHTML=renderProfile();
  else if(currentTab==='home')app.innerHTML=renderHome();
  else if(currentTab==='catalog')app.innerHTML=renderCatalog();
  else if(currentTab==='workout')app.innerHTML=renderWorkout();
  else if(currentTab==='history')app.innerHTML=renderHistory();
  else if(currentTab==='progress')app.innerHTML=renderProgress();
  else if(currentTab==='summary')app.innerHTML=renderSummary();
  else app.innerHTML=renderHome();
  if(exerciseDetailId) app.insertAdjacentHTML('beforeend',renderExerciseModal());
  if(swapContext) app.insertAdjacentHTML('beforeend',renderSwapModal());
  if(readinessContext) app.insertAdjacentHTML('beforeend',renderReadinessModal());
  if(workoutMapOpen) app.insertAdjacentHTML('beforeend',renderWorkoutMap());
  if(setEditContext) app.insertAdjacentHTML('beforeend',renderSetEditor());
  document.body.classList.toggle('modal-open',Boolean(exerciseDetailId||swapContext||readinessContext||workoutMapOpen||setEditContext));
  syncNav();syncLiveBadge();
}

function updateTimers(){
  const w=store.activeWorkout;
  if(!w)return;

  const elapsed=document.querySelector('#elapsed-clock');
  const exerciseClock=document.querySelector('#exercise-clock');
  if(elapsed)elapsed.textContent=formatClock(workoutElapsedSeconds(w));
  if(exerciseClock&&['work','rest','calibrate','feedback','pre-set','timed-set'].includes(w.phase))exerciseClock.textContent=formatClock(exerciseElapsedSeconds(w));
  if(w.isPaused)return;

  if(['warmup','cooldown'].includes(w.phase)){
    const snap=timedStageSnapshot(w);
    if(!snap)return;
    if(snap.complete){reconcileTimedStage();return;}
    const stage=document.querySelector('.timed-stage');
    const renderedIndex=Number(stage?.dataset.stageIndex);
    if(Number.isFinite(renderedIndex)&&renderedIndex!==snap.index){
      fireWorkoutSignal('transition','stage-'+w.id+'-'+w.phase+'-'+snap.index,{voice:'Next',label:'NEXT'});
      render();return;
    }
    if(snap.remaining>0&&snap.remaining<=3)fireWorkoutSignal('warning','stage-warning-'+w.id+'-'+w.phase+'-'+snap.index+'-'+snap.remaining,{voice:String(snap.remaining),label:String(snap.remaining)});
    const stageClock=document.querySelector('#stage-clock');
    const fill=document.querySelector('#stage-progress-fill');
    if(stageClock)stageClock.textContent=formatClock(snap.remaining);
    if(fill)fill.style.width=`${Math.max(0,Math.min(100,(snap.remaining/Math.max(1,snap.total))*100))}%`;
    return;
  }

  if(w.phase==='pre-set'){
    const snap=preSetSnapshot(w);
    if(!snap)return;
    if(snap.complete){finishPreSet();return;}
    const stage=document.querySelector('.pre-set-stage');
    if(stage?.dataset.presetMode!==snap.mode){render();return;}
    if(snap.mode==='countdown'&&snap.remaining<=3)fireWorkoutSignal('tick','preset-tick-'+w.id+'-'+w.currentExerciseIndex+'-'+w.currentSetIndex+'-'+snap.remaining,{voice:String(snap.remaining),label:String(snap.remaining)});
    const count=document.querySelector('#preset-count');
    const label=document.querySelector('#preset-label');
    if(count)count.textContent=String(snap.remaining);
    if(label)label.textContent=snap.mode==='setup'?'Set up your equipment':'Get ready';
    return;
  }

  if(w.phase==='timed-set'){
    const snap=timedSetSnapshot(w);
    if(!snap)return;
    if(snap.complete){completeTimedSet(false);return;}
    if(snap.remaining<=3&&snap.remaining>0)fireWorkoutSignal('warning','timed-set-warning-'+w.id+'-'+w.currentExerciseIndex+'-'+w.currentSetIndex+'-'+snap.remaining,{voice:String(snap.remaining),label:String(snap.remaining)});
    const clock=document.querySelector('#timed-set-clock');
    const fill=document.querySelector('#timed-set-progress');
    const note=document.querySelector('#timed-finish-note');
    if(clock)clock.textContent=formatClock(snap.remaining);
    if(fill)fill.style.width=`${Math.max(0,Math.min(100,(snap.remaining/Math.max(1,snap.total))*100))}%`;
    if(note)note.textContent=snap.remaining<=3?String(snap.remaining)+'…':'Stay controlled. You’ll get a finish cue at zero.';
    return;
  }

  if(w.phase!=='rest')return;
  const remaining=restRemaining(w),clock=document.querySelector('#rest-clock'),ring=document.querySelector('#timer-ring');
  if(clock)clock.textContent=formatClock(remaining);
  if(ring)ring.style.setProperty('--timer-progress',`${restProgress(w)}%`);
  if(remaining>0&&remaining<=3&&!Number.isFinite(w.restPausedRemaining))fireWorkoutSignal('warning','rest-warning-'+w.id+'-'+w.currentExerciseIndex+'-'+w.currentSetIndex+'-'+remaining,{voice:String(remaining),label:String(remaining)});
  if(remaining<=0&&!Number.isFinite(w.restPausedRemaining))advanceAfterRest();
}

function handleClick(event){
  const readinessClose=event.target.closest('[data-action="close-readiness"]');
  if(readinessClose){
    const inside=event.target.closest('[data-readiness-panel]');
    const explicit=event.target.closest('.modal-close');
    if(!inside||explicit){closeReadiness();return;}
  }
  const swapClose=event.target.closest('[data-action="close-swap"]');
  if(swapClose){
    const insideSwap=event.target.closest('[data-swap-panel]');
    const explicitClose=event.target.closest('.modal-close');
    if(!insideSwap||explicitClose){closeSwap();return;}
  }
  const detail=event.target.closest('[data-exercise-detail]');
  if(detail){exerciseDetailId=detail.dataset.exerciseDetail;render();return;}
  const close=event.target.closest('[data-action="close-details"]');
  if(close){
    const insidePanel=event.target.closest('[data-modal-panel]');
    const explicitClose=event.target.closest('.modal-close');
    if(!insidePanel||explicitClose){exerciseDetailId=null;render();return;}
  }
  const tab=event.target.closest('[data-tab]');if(tab){setTab(tab.dataset.tab);return;}
  const start=event.target.closest('[data-start]');if(start){startWorkout(start.dataset.start,start.dataset.scheduledDate||'');return;}
  const rir=event.target.closest('[data-rir]');if(rir){applyCalibration(rir.dataset.rir);return;}
  const feedback=event.target.closest('[data-feedback]');if(feedback){applyExerciseFeedback(feedback.dataset.feedback);return;}
  const node=event.target.closest('[data-action]');if(!node)return;
  const a=node.dataset.action;
  const allowedWhilePaused=['toggle-workout-pause','home','go-home','finish','discard','toggle-sound','toggle-voice','toggle-flash','toggle-haptics','test-cues'];
  if(store.activeWorkout?.isPaused&&!allowedWhilePaused.includes(a)){
    toast('Resume the workout before changing the active set or timer.');
    return;
  }
  if(a==='go-home'||a==='home')setTab('home');
  else if(a==='history')setTab('history');
  else if(a==='resume'){unlockWorkoutCues();setTab('workout');}
  else if(a==='edit-profile')editProfile();
  else if(a==='build-plan')saveProfileFromForm(document.querySelector('#profile-form'));
  else if(a==='skip-scheduled')skipScheduledSession(node.dataset.scheduledDate);
  else if(a==='undo-skip-scheduled')undoSkipScheduledSession(node.dataset.scheduledDate);
  else if(a==='begin-workout')startPreparedWorkout();
  else if(a==='regenerate')regeneratePlan();
  else if(a==='swap-plan')openSwap({mode:'plan',dayId:node.dataset.dayId,index:Number(node.dataset.swapIndex)});
  else if(a==='swap-active')openSwap({mode:'active',index:Number(node.dataset.swapIndex)});
  else if(a==='choose-swap'){
    const reason=document.querySelector('#swap-reason')?.value||'other';
    const neverShow=Boolean(document.querySelector('#swap-never-show')?.checked);
    applyExerciseSwap(node.dataset.candidateId,reason,neverShow);
  }
  else if(a==='undo-plan-swap')undoExerciseSwap('plan',Number(node.dataset.swapIndex),node.dataset.dayId||'');
  else if(a==='undo-active-swap')undoExerciseSwap('active',Number(node.dataset.swapIndex));
  else if(a==='toggle-workout-pause')toggleWorkoutPause();
  else if(a==='complete-set')completeCurrentSet();
  else if(a==='start-set-now')finishPreSet();
  else if(a==='end-timed-set')completeTimedSet(true);
  else if(a==='toggle-sound')toggleCueSetting('sound');
  else if(a==='toggle-voice')toggleCueSetting('voice');
  else if(a==='toggle-flash')toggleCueSetting('flash');
  else if(a==='toggle-haptics')toggleCueSetting('haptics');
  else if(a==='test-cues'){
    unlockWorkoutCues();
    fireWorkoutSignal('go','cue-test-'+Date.now(),{voice:'Cue test. Ready.',label:'READY'});
  }
  else if(a==='add-rest')adjustRest(15);
  else if(a==='pause-rest')toggleRestPause();
  else if(a==='skip-rest')skipRest();
  else if(a==='reset-timer')resetActiveTimer();
  else if(a==='skip-stage')advanceTimedStage();
  else if(a==='finish')finishWorkout(false);
  else if(a==='discard')discardWorkout();
}
document.addEventListener('click',handleClick);
document.addEventListener('error',event=>{
  const img=event.target.closest?.('img[data-fallback-src]');
  if(!img)return;
  const fallback=img.dataset.fallbackSrc;
  if(fallback&&img.src!==fallback&&!img.dataset.fallbackAttempted){
    img.dataset.fallbackAttempted='1';
    img.src=fallback;
  }else{
    img.closest('.exercise-media, .exercise-modal-media')?.classList.add('image-unavailable');
    img.remove();
  }
},true);
document.addEventListener('submit',event=>{
  if(event.target.id==='profile-form'){
    event.preventDefault();
    saveProfileFromForm(event.target);
  }
});
document.addEventListener('input',event=>{if(event.target.id==='catalog-search'){catalogQuery=event.target.value;const caret=event.target.selectionStart;render();const input=document.querySelector('#catalog-search');if(input){input.focus();input.setSelectionRange(caret,caret);}}});
document.addEventListener('change',event=>{
  if(event.target.id==='training-days-count'){
    const desired=num(event.target.value)||4;
    const defaults=defaultWorkoutDays(desired);
    document.querySelectorAll('input[name="workoutDays"]').forEach(input=>{input.checked=defaults.includes(input.value);});
    const note=document.querySelector('.schedule-day-head small');
    if(note)note.textContent='Select exactly '+desired+' days. Default days were updated for this schedule.';
  }else if(event.target.name==='workoutDays'){
    const desired=num(document.querySelector('#training-days-count')?.value)||4;
    const selected=document.querySelectorAll('input[name="workoutDays"]:checked').length;
    const note=document.querySelector('.schedule-day-head small');
    if(note)note.textContent=selected+' of '+desired+' days selected.';
  }
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&readinessContext){readinessContext=null;render();return;}
  if(event.key==='Escape'&&swapContext){swapContext=null;render();return;}
  if(event.key==='Escape'&&exerciseDetailId){exerciseDetailId=null;render();return;}
  if(event.key==='Enter'&&currentTab==='workout'&&store.activeWorkout?.phase==='work'&&document.activeElement?.tagName==='INPUT'){event.preventDefault();completeCurrentSet();}
});
tickHandle=window.setInterval(updateTimers,500);
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible') updateTimers();
});
window.addEventListener('pageshow',event=>{
  if(event.persisted){
    window.location.reload();
  }
});
window.addEventListener('beforeunload',()=>tickHandle&&clearInterval(tickHandle));
render();
updateTimers();
if(clearedLegacyActiveWorkout){
  setTimeout(()=>toast('Previous test session cleared so this build can start with clean timer state.'),100);
}
