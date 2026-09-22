const STORAGE_KEY = 'workout-web-store-v3';
const UI_STATE_KEY = 'workout-web-ui-v1';
const LEGACY_KEYS = ['workout-web-store-v2','workout-web-store-v1'];
const ACTIVE_WORKOUT_SCHEMA = 4;
const catalog = window.EXERCISE_CATALOG || [];
const movements = window.EXERCISE_MOVEMENTS || {};
const exerciseMedia = window.EXERCISE_MEDIA || {};
const exerciseMediaFallbacks = window.EXERCISE_MEDIA_FALLBACKS || {};
const EXERCISE_IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
const WORKOUT_SUPABASE_URL = 'https://iftnwzqlofhujzulmofu.supabase.co';
const WORKOUT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_JCb6OcXTZcvjSfhHohWGZw__96BdfIB';
let workoutSupabase = null;
let authReady=false;
let authMode='entry';
const sharedRuntime = {channel:null,sessionId:'',syncTimer:null,reconcileTimer:null,reconcileBusy:false,restoreUserId:'',syncMuted:false,lastPresenceSignature:''};
let cloudSyncTimer=null;
let cloudHydrating=false;
let exerciseDetailId = null;
let swapContext = null;
let readinessContext = null;
let workoutMapOpen = false;
let setEditContext = null;
let cueSettingsOpen = false;
let exerciseActionsIndex = null;
let historyMenuId = null;
let accountSheetOpen = false;
let historyFilter = 'all';
let analyticsRange = '3m';
let workoutPreviewIndex = null;
let workoutFormMode = false;
let planImportOpen = false;
let planImportDraft = null;
let customExerciseOpen = false;
let draftAutosaveTimer = null;
let exerciseDetailMetric = 'weight';
let exerciseDetailRange = '8';

const defaultStore = {
  profile: null,
  plan: null,
  history: [],
  activeWorkout: null,
  calibration: {},
  progression: {},
  progressionLog: [],
  exercisePreferences: {excluded:[],swapHistory:[],details:{}},
  trainingProgram: {scheduleOverrides:{},weekReviews:{},customExercises:[],importHistory:[]},
  cueSettings: {sound:true,voice:true,haptics:true,flash:true},
  account: {displayName:'',email:'',authProvider:'',status:'local',userId:''},
  sharedTraining: {partners:[],draft:null,history:[]},
  lastSummaryId: null
};

let store = loadStore();
let clearedLegacyActiveWorkout = false;
if (store.activeWorkout && store.activeWorkout.schemaVersion !== ACTIVE_WORKOUT_SCHEMA) {
  store.activeWorkout = null;
  clearedLegacyActiveWorkout = true;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}
const restoredUiState=loadUiState();
const allowedTabs=new Set(['home','train','together','progress','profile','profile-edit','catalog','workout','history','summary']);
let restoredTab=allowedTabs.has(restoredUiState.currentTab)?restoredUiState.currentTab:'';
if(!store.profile||!store.plan)restoredTab='profile-edit';
else if(restoredTab==='workout'&&!store.activeWorkout)restoredTab='home';
let currentTab=restoredTab||(store.activeWorkout?'workout':'home');
accountSheetOpen=Boolean(restoredUiState.accountSheetOpen);
if(['4w','3m','6m','1y','all'].includes(restoredUiState.analyticsRange))analyticsRange=restoredUiState.analyticsRange;
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

function loadUiState(){
  try{
    const value=JSON.parse(localStorage.getItem(UI_STATE_KEY)||'{}');
    return value&&typeof value==='object'?value:{};
  }catch{return {};}
}
function persistUiState(){
  try{
    localStorage.setItem(UI_STATE_KEY,JSON.stringify({
      currentTab,
      accountSheetOpen:Boolean(accountSheetOpen),
      analyticsRange,
      savedAt:new Date().toISOString()
    }));
  }catch{}
}
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
function cloudStatePayload(){
  return {user_id:store.account?.userId,profile:store.profile,plan:store.plan,calibration:store.calibration||{},progression:store.progression||{},progression_log:store.progressionLog||[],exercise_preferences:store.exercisePreferences||{},training_program:store.trainingProgram||{},cue_settings:store.cueSettings||{},history:store.history||[],active_workout:store.activeWorkout||null,last_summary_id:store.lastSummaryId||null,onboarding_complete:Boolean(store.profile&&store.plan),onboarding_step:store.profile&&store.plan?'complete':'profile',updated_at:new Date().toISOString()};
}
function scheduleCloudStateSync(){
  if(cloudHydrating||!workoutSupabase||store.account?.status!=='connected'||!store.account?.userId)return;
  clearTimeout(cloudSyncTimer);
  cloudSyncTimer=setTimeout(()=>syncCloudState().catch(error=>console.warn('Workout cloud sync failed',error)),350);
}
async function syncCloudState(){
  if(!workoutSupabase||store.account?.status!=='connected'||!store.account?.userId)return;
  const {error}=await workoutSupabase.from('workout_user_state').upsert(cloudStatePayload(),{onConflict:'user_id'});
  if(error)throw error;
}
async function hydrateCloudState(userId){
  if(!workoutSupabase||!userId)return false;
  const {data,error}=await workoutSupabase.from('workout_user_state').select('*').eq('user_id',userId).maybeSingle();
  if(error)throw error;
  if(!data){
    cloudHydrating=false;
    await syncCloudState();
    if(!store.profile||!store.plan)currentTab='profile-edit';
    render();
    return false;
  }
  cloudHydrating=true;
  for(const [remote,local] of [['profile','profile'],['plan','plan'],['calibration','calibration'],['progression','progression'],['progression_log','progressionLog'],['exercise_preferences','exercisePreferences'],['training_program','trainingProgram'],['cue_settings','cueSettings'],['history','history'],['active_workout','activeWorkout'],['last_summary_id','lastSummaryId']]) if(data[remote]!==null&&data[remote]!==undefined)store[local]=data[remote];
  localStorage.setItem(STORAGE_KEY,JSON.stringify(store));cloudHydrating=false;
  if(store.profile&&store.plan&&currentTab==='profile-edit')currentTab=store.activeWorkout?'workout':'home';
  render();return true;
}
function saveStore(){
  let persisted=true;
  try{
    localStorage.setItem(STORAGE_KEY,JSON.stringify(store));
  }catch{
    persisted=false;
  }
  syncLiveBadge();
  if(!sharedRuntime.syncMuted)scheduleSharedStateSync();
  scheduleCloudStateSync();
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
  store.trainingProgram.customExercises=Array.isArray(store.trainingProgram.customExercises)?store.trainingProgram.customExercises:[];
  store.trainingProgram.importHistory=Array.isArray(store.trainingProgram.importHistory)?store.trainingProgram.importHistory:[];
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
      .filter(item=>item.planId===store.plan?.id&&item.scheduledDate&&item.completionStatus!=='partial')
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
    const referenceDate=new Date(date);referenceDate.setHours(0,0,0,0);
    const todayKey=dateKey(referenceDate);
    let status=history?(history.completionStatus==='partial'?'partial':'complete'):entry.override?.status==='skipped'?'skipped':key===todayKey?'today':scheduledDate<referenceDate?'missed':'upcoming';
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
  const completedSessions=sessions.filter(item=>item.completionStatus!=='partial');
  const feedback=[];
  for(const session of sessions)for(const ex of session.exercises||[])if(ex.feedback)feedback.push(ex.feedback);
  const readiness=sessions.map(item=>num(item.readiness?.score)).filter(Boolean);
  const completionRate=entries.length?completedSessions.filter(item=>entries.some(entry=>entry.dateKey===(item.scheduledDate||dateKey(new Date(item.completedAt))))).length/entries.length:0;
  const tooHard=feedback.filter(value=>value==='too-hard'||value==='form-off').length;
  const hard=feedback.filter(value=>value==='hard').length;
  const swapHistory=store.exercisePreferences?.swapHistory||[];
  const swaps=swapHistory.filter(item=>{const at=new Date(item.at);return at>=start&&at<end;}).length;
  return {
    weekKey:dateKey(start),
    scheduled:entries.length,
    completed:completedSessions.length,
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
  if(store.plan?.imported&&store.plan?.importStrategy==='follow'){
    const day=clone(baseDay);recalculatePlanDay(day);day.programContext=programContext(date);day.adaptationMode='follow-import';day.adaptationNotes=['Following the imported program as written.'];return day;
  }
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
  const prep=saved.prep||{};
  return {
    sound:saved.sound!==false,
    voice:saved.voice!==false,
    haptics:saved.haptics!==false,
    flash:saved.flash!==false,
    prep:{
      warmup:['quick','standard','extended'].includes(prep.warmup)?prep.warmup:'standard',
      cooldown:['quick','standard','extended'].includes(prep.cooldown)?prep.cooldown:'standard',
      preferReps:prep.preferReps!==false,
      skipStatic:Boolean(prep.skipStatic),
      alwaysMobility:Boolean(prep.alwaysMobility)
    }
  };
}
function prepSettings(){return workoutCueSettings().prep;}
function setPrepSetting(key,value){
  const settings=workoutCueSettings();
  settings.prep={...settings.prep,[key]:value};
  store.cueSettings=settings;
  if(store.plan?.days?.length){
    for(const day of store.plan.days){day.warmup=buildWarmup(day.exercises||[]);day.cooldown=buildCooldown(day.exercises||[]);recalculatePlanDay(day);}
  }
  saveStore();render();
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
function pulseLocalCountdown(label=''){
  const target=document.querySelector('#preset-count, #timed-set-clock, #rest-clock, #stage-clock');
  if(!target)return;
  target.classList.remove('countdown-pulse');
  requestAnimationFrame(()=>target.classList.add('countdown-pulse'));
  setTimeout(()=>target.classList.remove('countdown-pulse'),180);
  if(label&&target.id!=='preset-count'&&/^\d+$/.test(String(label)))target.dataset.lastCue=String(label);
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
  const className=type==='go'?'cue-flash-go':type==='complete'?'cue-flash-complete':type==='transition'?'cue-flash-transition':'cue-flash-warning';
  requestAnimationFrame(()=>{
    root.classList.add(className);
    if(flash){
      flash.textContent=label||'';
      flash.dataset.cueType=type;
      flash.classList.add('show');
    }
  });
  cueRuntime.visualTimer=setTimeout(()=>{
    root.classList.remove(className);
    flash?.classList.remove('show');
  },type==='go'||type==='complete'?700:440);
}
function fireWorkoutSignal(type,token,{voice='',label=''}={}){
  playWorkoutCue(type,token);
  if(voice)speakWorkoutCue(voice,'voice-'+token);
  const numericCue=/^\d+$/.test(String(label||''));
  if(type==='tick'||(type==='warning'&&numericCue))pulseLocalCountdown(label);
  else triggerVisualCue(type,label,'visual-'+token);
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
  const current=workoutCueSettings();
  store.cueSettings={...current,[key]:!current[key],prep:current.prep};
  saveStore();
  if((key==='sound'||key==='voice')&&store.cueSettings[key])unlockWorkoutCues();
  if(key==='voice'&&!store.cueSettings.voice&&'speechSynthesis' in window){
    try{window.speechSynthesis.cancel?.();}catch{}
  }
  render();
}
function renderCueControls(){
  const settings=workoutCueSettings();
  const active=[settings.voice?'Voice':'',settings.sound?'Sound':'',settings.haptics?'Haptics':'',settings.flash?'Flash':''].filter(Boolean);
  return '<button type="button" class="workout-cue-compact" data-action="open-cue-settings"><span>◉</span><div><strong>Workout cues</strong><small>'+esc(active.join(' · ')||'All cues off')+'</small></div><em>›</em></button>';
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
  return findExercise(ex?.id)||ex;
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
  const prep=[...(day.warmup||[]),...(day.cooldown||[])].reduce((sum,item)=>sum+stageEstimatedSeconds(item),0);
  const work=(day.exercises||[]).reduce((sum,ex)=>sum+estimatePlanExerciseSeconds(ex),0);
  day.warmupMinutes=Math.ceil((day.warmup||[]).reduce((sum,item)=>sum+stageEstimatedSeconds(item),0)/60);
  day.cooldownMinutes=Math.ceil((day.cooldown||[]).reduce((sum,item)=>sum+stageEstimatedSeconds(item),0)/60);
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
  const media=exerciseMedia[ex.id]||{};
  const curated=index===0?media.startUrl:media.finishUrl;
  if(curated)return curated;
  const sourceId=media.sourceId||'';
  if(!sourceId)return '';
  return EXERCISE_IMAGE_BASE+encodeURIComponent(sourceId)+'/'+index+'.jpg';
}

const TIMED_STAGE_MEDIA = {
  'Bodyweight squat warm-up':{id:'Bodyweight_Squat',verified:true},
  'Arm circles + shoulder sweep':{id:'Arm_Circles',verified:true},
  'Full-body reach + breathing':{id:'Upward_Stretch',verified:true}
};

const TIMED_STAGE_WHY = {
  'Easy march + arm swing':'Raises your temperature before loaded work.',
  'Bodyweight squat warm-up':'Prepares the squat pattern and lower-body joints.',
  'Dynamic hip hinge reach':'Primes the hamstrings and hinge pattern before loaded pulls.',
  'Arm circles + shoulder sweep':'Warms the shoulders before pressing and pulling.',
  'Alternating reverse lunge reach':'Adds hip mobility and single-leg preparation.',
  'Chest + front-shoulder stretch':'Lets the chest and front of the shoulders settle after pressing.',
  'Lat + upper-back stretch':'Lengthens the lats and upper back after rows and pulldowns.',
  'Standing quad stretch':'Gives the quads a gentle post-workout stretch.',
  'Single-leg hamstring stretch':'Helps the hamstrings relax after hinges and leg work.',
  'Figure-four glute stretch':'Lets the glutes settle after squats, hinges, and lunges.',
  'Standing calf stretch':'Lets the calves settle after lower-body work.',
  'Full-body reach + breathing':'Brings your breathing down and finishes the session gradually.'
};

function timedStageImageUrl(item,index=0){
  const mapped=TIMED_STAGE_MEDIA[item?.name]||{};
  const mediaId=item?.mediaId||mapped.id||'';
  const verified=item?.mediaVerified===true||(!Object.prototype.hasOwnProperty.call(item||{},'mediaVerified')&&mapped.verified===true);
  if(!verified||!mediaId)return '';
  return EXERCISE_IMAGE_BASE+encodeURIComponent(mediaId)+'/'+index+'.jpg';
}

function timedStageWhy(item){
  return item?.why||TIMED_STAGE_WHY[item?.name]||'This step prepares or recovers the muscles used in today’s session.';
}

function timedStageDescription(item){
  return item?.description||item?.cue||'Move slowly and stay within a comfortable range.';
}

function timedStageSteps(item){
  return Array.isArray(item?.steps)&&item.steps.length?item.steps:[item?.cue||'Move through a comfortable range and breathe steadily.'];
}

function exerciseImageButton(ex,className='exercise-media',index=0){
  const src=exerciseImageUrl(ex,index,false);
  const fallback=exerciseImageUrl(ex,index,true);
  const animate=/active-exercise-media|pre-set-exercise-media|timed-work-exercise-media/.test(className);
  const second=animate?exerciseImageUrl(ex,index===0?1:0,false):'';
  const secondFallback=animate?exerciseImageUrl(ex,index===0?1:0,true):'';
  if(!src)return '<button class="'+className+' exercise-media missing" type="button" data-exercise-detail="'+esc(ex.id)+'"><span>VIEW FORM</span></button>';
  const media=animate&&second
    ?'<span class="exercise-motion-frames"><img class="motion-frame motion-frame-a" src="'+esc(src)+'" data-fallback-src="'+esc(fallback)+'" loading="eager" decoding="async" alt="'+esc(ex.name)+' starting position"><img class="motion-frame motion-frame-b" src="'+esc(second)+'" data-fallback-src="'+esc(secondFallback)+'" loading="eager" decoding="async" alt="" aria-hidden="true"></span>'
    :'<img src="'+esc(src)+'" data-fallback-src="'+esc(fallback)+'" loading="lazy" decoding="async" alt="'+esc(ex.name)+' exercise demonstration">';
  return '<button class="'+className+' exercise-media'+(animate?' motion-enabled':'')+'" type="button" data-exercise-detail="'+esc(ex.id)+'" aria-label="View '+esc(ex.name)+' instructions">'+media+
    '<span class="media-hint">VIEW FORM</span></button>';
}

function renderExerciseModal(){
  if(!exerciseDetailId)return '';
  const ex=findExercise(exerciseDetailId)||store.activeWorkout?.exercises?.find(item=>item.id===exerciseDetailId);
  if(!ex)return '';
  const guide=exerciseGuidance(ex);
  const primary=exerciseImageUrl(ex,0,false),secondary=exerciseImageUrl(ex,1,false);
  const primaryFallback=exerciseImageUrl(ex,0,true),secondaryFallback=exerciseImageUrl(ex,1,true);
  const images=[
    primary?'<img src="'+esc(primary)+'" data-fallback-src="'+esc(primaryFallback)+'" alt="'+esc(ex.name)+' starting position">':'',
    secondary?'<img src="'+esc(secondary)+'" data-fallback-src="'+esc(secondaryFallback)+'" alt="'+esc(ex.name)+' finishing position">':''
  ].join('');
  return '<div class="exercise-modal-backdrop" data-action="close-details">'+
    '<section class="exercise-modal exercise-detail-modal" role="dialog" aria-modal="true" aria-label="'+esc(ex.name)+' exercise instructions" data-modal-panel>'+
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
        renderExerciseDetailProgress(ex)+
        '<p class="media-credit">'+(exerciseMedia[ex.id]?.startUrl?'Curated Workout exercise demonstration.':exerciseMedia[ex.id]?.sourceId?'Exercise reference: Free Exercise DB · public-domain dataset.':'No verified demonstration image is assigned yet.')+'</p>'+
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
  if (['general','mobility','athletic','consistency','sport','partner','energy'].includes(goal)) return {sets:newLifter?2:3,reps:accessory?'10–15':'8–12',rest:accessory?30:(compound?45:30),setSeconds:40};
  if (goal === 'endurance') return {sets:newLifter?2:3,reps:accessory?'12–15':'10–15',rest:accessory?25:40,setSeconds:42};
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

function normalizeTimedStage(items,targetSeconds,minSeconds,maxSeconds){
  if(!items.length)return items;
  const timed=items.filter(item=>item.mode!=='reps');
  if(!timed.length)return items;
  const target=Math.max(minSeconds,Math.min(maxSeconds,targetSeconds));
  const each=Math.max(15,Math.round(target/timed.length/5)*5);
  return items.map(item=>item.mode==='reps'?item:{...item,seconds:each});
}
function timedStageGroupId(name){return String(name||'movement').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');}
function sideCopy(value,side){return String(value||'').replace(/\{side\}/g,side);}
function addTimedSides(target,item){
  const groupId=item.groupId||timedStageGroupId(item.name);
  ['left','right'].forEach((side,index)=>target.push({...item,groupId,side,sideLabel:side.toUpperCase()+' SIDE',sideIndex:index+1,sideCount:2,mode:'time',seconds:item.secondsPerSide||item.seconds||18,description:sideCopy(item.description,side),cue:sideCopy(item.cue,side),steps:(item.steps||[]).map(step=>sideCopy(step,side))}));
}
function prepLevel(kind){const value=prepSettings()[kind]||'standard';return value==='quick'?0:value==='extended'?2:1;}
function stageEstimatedSeconds(item){if(item?.mode==='reps')return Math.max(12,(num(item.reps)||num(item.repsPerSide)*2||8)*2.5);return Math.max(0,num(item?.seconds));}
function stagePrescription(item){if(item?.mode==='reps')return item.repsLabel||((item.repsPerSide?item.repsPerSide+' each side':item.reps+' reps'));return (num(item?.seconds)||0)+' sec';}

function buildWarmup(exercises){
  const moves=new Set(exercises.map(e=>e.movement));
  const level=prepLevel('warmup'),preferReps=prepSettings().preferReps;
  const reps=[6,8,10],side=[4,5,6],march=[20,25,35];
  const items=[{name:'Easy march + arm swing',groupId:'easy-march-arm-swing',mode:'time',seconds:march[level],kind:'dynamic',description:'March in place at an easy pace while the arms swing naturally.',cue:'Stay relaxed, breathe easily, and let the arms swing naturally.',steps:['Stand tall with room to move.','March smoothly in place.','Let the arms swing forward and back without forcing the shoulders.'],why:'Raises your temperature before loaded work.',mediaId:'',mediaVerified:false}];
  if([...moves].some(m=>['squat','single-leg','quad-accessory'].includes(m)))items.push({name:'Bodyweight squat warm-up',groupId:'bodyweight-squat-warmup',mode:preferReps?'reps':'time',reps:reps[level],repsLabel:reps[level]+' controlled reps',seconds:[20,25,30][level],kind:'dynamic',description:'Use easy bodyweight squats to warm the hips, knees, and ankles.',cue:'Controlled depth. Keep the knees tracking comfortably over the feet.',steps:['Stand around shoulder width.','Sit the hips down and back through a comfortable range.','Stand tall without rushing the rep.'],why:'Prepares the squat pattern and lower-body joints.',mediaId:'Bodyweight_Squat',mediaVerified:true});
  if([...moves].some(m=>['hinge','hamstring-accessory'].includes(m)))items.push({name:'Dynamic hip hinge reach',groupId:'dynamic-hip-hinge-reach',mode:preferReps?'reps':'time',reps:reps[level],repsLabel:reps[level]+' controlled reps',seconds:[20,25,30][level],kind:'dynamic',description:'Practice the hinge pattern unloaded by sending the hips back, reaching forward, and returning tall.',cue:'Soft knees. Hips travel back while the spine stays long.',steps:['Stand tall with soft knees.','Push the hips back as your hands reach forward.','Squeeze the glutes lightly to return to standing.'],why:'Primes the hamstrings and hinge pattern before loaded pulls.',mediaId:'',mediaVerified:false});
  if([...moves].some(m=>['horizontal-push','horizontal-pull','vertical-push','vertical-pull','shoulder-accessory'].includes(m)))items.push({name:'Arm circles + shoulder sweep',groupId:'arm-circles-shoulder-sweep',mode:preferReps?'reps':'time',reps:reps[level],repsLabel:reps[level]+' forward + '+reps[level]+' backward',seconds:[20,25,30][level],kind:'dynamic',description:'Circle the arms through a comfortable range, then sweep them forward and overhead.',cue:'Start small and gradually make the circles larger without shrugging.',steps:['Make controlled forward arm circles.','Reverse the circles.','Finish with slow forward-to-overhead shoulder sweeps.'],why:'Warms the shoulders before pressing and pulling.',mediaId:'Arm_Circles',mediaVerified:true});
  if(items.length<4||prepSettings().alwaysMobility)items.push({name:'Alternating reverse lunge reach',groupId:'alternating-reverse-lunge-reach',mode:preferReps?'reps':'time',repsPerSide:side[level],repsLabel:side[level]+' each side',seconds:[20,25,30][level],kind:'dynamic',description:'Alternate a gentle step back with an overhead reach to open the hips.',cue:'Keep the motion smooth and use only a comfortable lunge depth.',steps:['Step one foot back into a shallow reverse lunge.','Reach overhead without leaning aggressively.','Return to standing and alternate sides.'],why:'Adds hip mobility and single-leg preparation.',mediaId:'',mediaVerified:false});
  return items.slice(0,[2,4,5][level]).map(item=>({...item,coachingVersion:4}));
}
function buildCooldown(exercises){
  const muscles=new Set(exercises.flatMap(e=>e.muscles||[])),level=prepLevel('cooldown');
  const sideSeconds=[12,18,25][level],bilateral=[15,20,30][level],breath=[20,25,30][level];
  const movements=[];
  if(muscles.has('Chest')||muscles.has('Shoulders'))movements.push({name:'Chest + front-shoulder stretch',groupId:'chest-front-shoulder-stretch',sided:true,secondsPerSide:sideSeconds,kind:'static',description:'Use a gentle one-arm chest-opening position on the {side} side.',cue:'Keep the {side} shoulder down and breathe slowly.',steps:['Place the {side} forearm or hand against a stable support.','Turn the torso away slightly until the chest feels mild tension.','Hold without bouncing or forcing the shoulder.'],why:'Lets the chest and front of the shoulders settle after pressing.',mediaId:'',mediaVerified:false});
  if(muscles.has('Back')||muscles.has('Lats'))movements.push({name:'Lat + upper-back stretch',groupId:'lat-upper-back-stretch',mode:'time',seconds:bilateral,kind:'static',description:'Reach forward into a relaxed upper-back and lat stretch while breathing slowly.',cue:'Let the shoulders relax away from the ears.',steps:['Reach both hands forward onto a stable support or toward the floor.','Send the hips back slightly.','Breathe into the upper back without forcing the range.'],why:'Lets the lats and upper back settle after rows and pulldowns.',mediaId:'',mediaVerified:false});
  if(muscles.has('Quads'))movements.push({name:'Standing quad stretch',groupId:'standing-quad-stretch',sided:true,secondsPerSide:sideSeconds,kind:'static',description:'Stand tall and bend the {side} knee until you feel mild tension through the front of the thigh.',cue:'Keep the knees close and the pelvis neutral on the {side} side.',steps:['Use a wall or rack for balance if needed.','Hold the {side} ankle or pant leg behind you.','Stand tall and keep the stretch gentle.'],why:'Lets the quads settle after lower-body work.',mediaId:'',mediaVerified:false});
  if(muscles.has('Hamstrings'))movements.push({name:'Single-leg hamstring stretch',groupId:'single-leg-hamstring-stretch',sided:true,secondsPerSide:sideSeconds,kind:'static',description:'Extend the {side} leg slightly forward and hinge gently until you feel mild tension.',cue:'Hinge at the hips instead of rounding toward the {side} foot.',steps:['Place the {side} heel slightly forward with the knee soft.','Send the hips back with a long spine.','Stop at mild tension and breathe.'],why:'Lets the hamstrings settle after hinges and leg work.',mediaId:'',mediaVerified:false});
  if(muscles.has('Glutes'))movements.push({name:'Figure-four glute stretch',groupId:'figure-four-glute-stretch',sided:true,secondsPerSide:sideSeconds,kind:'static',description:'Set the {side} ankle across the opposite thigh and settle back gently.',cue:'Keep the {side} knee comfortable and avoid forcing the hip.',steps:['Cross the {side} ankle over the opposite thigh.','Sit the hips back or draw the legs in gently.','Hold where the glute feels mild tension.'],why:'Lets the glutes settle after squats, hinges, and lunges.',mediaId:'',mediaVerified:false});
  if(muscles.has('Calves'))movements.push({name:'Standing calf stretch',groupId:'standing-calf-stretch',sided:true,secondsPerSide:sideSeconds,kind:'static',description:'Step the {side} foot back and keep that heel planted while leaning forward gently.',cue:'Keep the {side} heel down and avoid bouncing.',steps:['Step the {side} foot behind you.','Keep the back heel planted and toes forward.','Lean forward until the calf feels mild tension.'],why:'Lets the calves settle after lower-body work.',mediaId:'',mediaVerified:false});
  const breathing={name:'Full-body reach + breathing',groupId:'full-body-reach-breathing',mode:'time',seconds:breath,kind:'breathing',description:'Reach tall, breathe slowly, then let the arms fall as the shoulders relax.',cue:'Slow inhale. Longer exhale. Let the shoulders drop.',steps:['Stand comfortably and reach overhead without straining.','Take a slow breath in.','Exhale longer than you inhaled and relax the shoulders.'],why:'Brings your breathing down and finishes the session gradually.',mediaId:'Upward_Stretch',mediaVerified:true};
  if(prepSettings().skipStatic)return [{...breathing,coachingVersion:4}];
  const selected=movements.slice(0,[1,2,3][level]),items=[];
  selected.forEach(item=>item.sided?addTimedSides(items,item):items.push({...item,mode:'time'}));
  items.push(breathing);
  return items.map(item=>({...item,coachingVersion:4}));
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
  if (avoid.includes('running') && /run|treadmill/i.test(exercise.name||'')) return true;
  if (avoid.includes('jumping') && /jump|plyo|box/i.test(exercise.name||'')) return true;
  if (avoid.includes('squat') && /barbell.*squat|back squat|front squat/i.test(exercise.name||'')) return true;
  if (avoid.includes('deadlift') && /conventional deadlift|barbell deadlift/i.test(exercise.name||'')) return true;
  if (avoid.includes('pullup') && /pull.?up|chin.?up/i.test(exercise.name||'')) return true;
  if (avoid.includes('dip') && /dip/i.test(exercise.name||'')) return true;
  if (avoid.includes('lunge') && /lunge|split squat/i.test(exercise.name||'')) return true;
  if (avoid.includes('burpee') && /burpee/i.test(exercise.name||'')) return true;
  if (avoid.includes('timed') && exercise.loadMode==='timed') return true;
  const custom=(profile.customAvoid||[]).map(value=>String(value).toLowerCase());
  if(custom.some(value=>value&&String(exercise.name||'').toLowerCase().includes(value)))return true;
  return false;
}

function exerciseScore(exercise,profile,used){
  let score=0;
  if (!used.has(exercise.id)) score+=8;
  const priorityMap={chest:['horizontal-push'],back:['horizontal-pull','vertical-pull'],shoulders:['vertical-push','shoulder-accessory'],arms:['biceps','triceps'],legs:['squat','hinge','single-leg','quad-accessory','hamstring-accessory','calves'],glutes:['hinge','single-leg'],core:['core']};
  if((profile.priorities||[]).some(p=>(priorityMap[p]||[]).includes(exercise.movement)))score+=10;
  const secondaryGoals=(profile.goals||[]).filter(goal=>goal!==(profile.primaryGoal||profile.goal));
  if(secondaryGoals.includes('mobility')&&['single-leg','core','shoulder-accessory'].includes(exercise.movement))score+=2;
  if(secondaryGoals.includes('athletic')&&['squat','hinge','single-leg','core'].includes(exercise.movement))score+=2;
  if(secondaryGoals.includes('endurance')&&['core','single-leg','horizontal-pull'].includes(exercise.movement))score+=1;
  if (profile.experience === 'new' && exercise.difficulty === 'beginner') score+=7;
  if (profile.style === 'machines' && exercise.style === 'machine') score+=6;
  if (profile.style === 'free' && exercise.style === 'free') score+=6;
  if (profile.style === 'mixed') score+=2;
  const prefer=profile.preferAvoid||[];
  if(prefer.includes('overhead')&&exercise.movement==='vertical-push')score-=12;
  if(prefer.includes('knee')&&['squat','single-leg','quad-accessory'].includes(exercise.movement))score-=12;
  if(prefer.includes('hinge')&&['hinge','hamstring-accessory'].includes(exercise.movement))score-=12;
  if(prefer.includes('floor')&&['plank','dead-bug','glute-bridge','db-floor-press','push-up'].includes(exercise.id))score-=12;
  if(prefer.includes('running')&&/run|treadmill/i.test(exercise.name||''))score-=12;
  if(prefer.includes('jumping')&&/jump|plyo|box/i.test(exercise.name||''))score-=12;
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
  return ({muscle:'Build muscle',strength:'Get stronger','fat-loss':'Lose body fat',endurance:'Improve endurance',mobility:'Improve mobility / flexibility',athletic:'Athletic performance',general:'Overall fitness',consistency:'Rebuild consistency',sport:'Support another sport / activity',partner:'Train with a partner',energy:'Feel better / more energy'})[goal] || goal;
}
function experienceLabel(v){ return ({new:'New to lifting',beginner:'Beginner',intermediate:'Intermediate',advanced:'Advanced'})[v]||v; }
function equipmentLabel(v){ return ({'full-gym':'Full gym',dumbbells:'Dumbbells',bodyweight:'Bodyweight',bands:'Resistance bands','mixed-home':'Home mix'})[v]||v; }

function nextPlanDay(){
  return nextScheduledSession()?.adaptedDay||store.plan?.days?.[0]||null;
}

function plannedWarmup(day){
  const current=Array.isArray(day?.warmup)?day.warmup:[];
  if(current.length&&current.every(item=>num(item.coachingVersion)>=4))return current;
  const upgraded=buildWarmup(day?.exercises||[]);
  if(day)day.warmup=upgraded;
  return upgraded;
}
function plannedCooldown(day){
  const current=Array.isArray(day?.cooldown)?day.cooldown:[];
  if(current.length&&current.every(item=>num(item.coachingVersion)>=4))return current;
  const upgraded=buildCooldown(day?.exercises||[]);
  if(day)day.cooldown=upgraded;
  return upgraded;
}
function renderPlanTimedRow(item,type,index){
  const image=timedStageImageUrl(item,0);
  const side=item.sideLabel?'<span class="plan-side-label">'+esc(item.sideLabel)+'</span>':'';
  const steps=timedStageSteps(item);
  return '<div class="plan-prep-row '+type+'">'+
    '<div class="plan-prep-media '+(image?'':'verified-missing')+'">'+(image?'<img src="'+esc(image)+'" loading="lazy" decoding="async" alt="'+esc(item.name)+' demonstration">':'<span>GUIDE</span>')+'</div>'+
    '<div class="plan-prep-copy">'+
      '<span>'+(type==='warmup'?'WARM-UP':'COOLDOWN')+' '+(index+1)+'</span>'+side+
      '<strong>'+esc(item.name)+'</strong>'+
      '<small class="plan-description">'+esc(timedStageDescription(item))+'</small>'+
      '<small>'+esc(steps[0]||item.cue||'Move through a comfortable range.')+'</small>'+
    '</div>'+
    '<em>'+esc(stagePrescription(item))+'</em>'+
  '</div>';
}
function saveProfileFromForm(form){
  if(!form){toast('Plan builder could not find the profile form. Reload this page and try again.');return false;}
  const previousProfile=clone(store.profile||{});
  const previousPlan=clone(store.plan||null);
  const previousProgram=clone(store.trainingProgram||{scheduleOverrides:{},weekReviews:{}});
  let data;
  try{
    data=new FormData(form);
  }catch{
    toast('Chrome could not read the plan form. Reload this page and try again.');
    return false;
  }
  const goals=data.getAll('goals');
  const primaryGoal=data.get('primaryGoal')||goals[0]||'muscle';
  if(!goals.includes(primaryGoal))goals.unshift(primaryGoal);
  const csv=name=>String(data.get(name)||'').split(',').map(value=>value.trim()).filter(Boolean);
  const connectionInputs=[...form.querySelectorAll('[data-fitness-provider]')].filter(input=>input.checked).map(input=>input.dataset.fitnessProvider);
  const profile={
    goal:primaryGoal,
    primaryGoal,
    goals:[...new Set(goals)],
    customGoal:String(data.get('customGoal')||'').trim(),
    displayName:String(data.get('displayName')||'').trim(),
    email:String(data.get('email')||'').trim(),
    gender:data.get('gender')||'',
    pronouns:String(data.get('pronouns')||'').trim(),
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
    preferAvoid:data.getAll('preferAvoid'),
    customAvoid:csv('customAvoid'),
    customPreferAvoid:csv('customPreferAvoid'),
    cautionAreas:csv('cautionAreas'),
    formatAvoid:csv('formatAvoid'),
    fitnessConnections:connectionInputs,
    priorities:data.getAll('priorities').slice(0,2),
    lifts:{
      bench:num(data.get('bench')),
      squat:num(data.get('squat')),
      deadlift:num(data.get('deadlift')),
      overhead:num(data.get('overhead')),
      row:num(data.get('row'))
    }
  };
  if(!profile.goals.length&&!profile.customGoal){
    toast('Choose at least one training goal or add your own.');
    form.querySelector('[name="goals"]')?.scrollIntoView({behavior:'smooth',block:'center'});
    return false;
  }
  if(!profile.displayName){
    toast('Enter the display name you want to use in training and shared workouts.');
    form.querySelector('[name="displayName"]')?.scrollIntoView({behavior:'smooth',block:'center'});
    return false;
  }
  if(!profile.gender){
    toast('Choose a gender option, including Prefer not to say if you do not want to provide one.');
    form.querySelector('[name="gender"]')?.scrollIntoView({behavior:'smooth',block:'center'});
    return false;
  }
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
  store.account={...(store.account||{}),displayName:profile.displayName,email:profile.email,status:store.account?.status||'local'};
  store.plan=plan;
  store.trainingProgram=previousPlan?previousProgram:{scheduleOverrides:{},weekReviews:{}};
  const persisted=saveStore();
  if(store.account?.status!=='connected'){
    accountSheetOpen=true;
    currentTab='profile-edit';
    render();
    setTimeout(()=>toast('Create or sign in to your Workout account to finish setup and sync your plan.'),100);
    return true;
  }
  currentTab='home';
  render();
  if(previousPlan){
    setTimeout(()=>toast('Profile updated. Future workouts were rebuilt; history and progression were preserved.'),100);
  }
  if(!persisted){
    setTimeout(()=>toast('Plan built. Chrome blocked local saving, so keep this tab open to preserve this session.'),100);
  }
  return true;
}

function editProfile(){
  if (store.activeWorkout) { toast('Finish or discard the active workout before rebuilding the plan.'); return; }
  currentTab='profile-edit';
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
  const adjusted=clone(day),score=readinessScore(readiness);
  const available=Math.max(15,num(readiness?.timeAvailable)||num(store.profile?.minutes)||45);
  const energy=num(readiness?.energy)||3,sleep=num(readiness?.sleep)||3,soreness=num(readiness?.soreness)||2,notes=[];
  adjusted.readinessLoadFactor=1;adjusted.readinessRestBonus=0;adjusted.holdProgression=false;
  if(energy<=2){adjusted.readinessLoadFactor=.95;for(const ex of adjusted.exercises)if(ACCESSORY_MOVEMENTS.has(ex.movement)&&ex.sets>2)ex.sets-=1;adjusted.readinessRestBonus=15;notes.push('Low energy: accessory volume reduced and rest extended.');}
  if(sleep<=2){adjusted.readinessLoadFactor=Math.min(adjusted.readinessLoadFactor,.95);adjusted.holdProgression=true;adjusted.readinessRestBonus=Math.max(adjusted.readinessRestBonus,15);notes.push('Poor sleep: today holds load progression and uses a conservative prescription.');}
  if(soreness>=4){adjusted.readinessLoadFactor=Math.min(adjusted.readinessLoadFactor,.9);adjusted.holdProgression=true;for(const ex of adjusted.exercises)if(ex.sets>2)ex.sets-=1;notes.push('High soreness: working volume and loading were reduced for recovery.');}
  else if(soreness===3){for(const ex of adjusted.exercises)if(ACCESSORY_MOVEMENTS.has(ex.movement)&&ex.sets>2)ex.sets-=1;notes.push('Moderate soreness: optional accessory volume was trimmed.');}
  recalculatePlanDay(adjusted);
  while(adjusted.estimatedMinutes>available&&adjusted.exercises.length>2){const index=[...adjusted.exercises].reverse().findIndex(ex=>ACCESSORY_MOVEMENTS.has(ex.movement));if(index<0)break;adjusted.exercises.splice(adjusted.exercises.length-1-index,1);recalculatePlanDay(adjusted);}
  for(let i=adjusted.exercises.length-1;i>=0&&adjusted.estimatedMinutes>available;i--)while(adjusted.exercises[i]?.sets>2&&adjusted.estimatedMinutes>available){adjusted.exercises[i].sets-=1;recalculatePlanDay(adjusted);}
  if(adjusted.estimatedMinutes>available)notes.push('The minimum useful session may run slightly past your available time.');
  else if(available<(num(store.profile?.minutes)||45))notes.push('Time available: the session was shortened while protecting priority work.');
  adjusted.readinessNotes=notes;adjusted.readinessScore=score;adjusted.availableMinutes=available;return adjusted;
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
async function startPreparedWorkout(){
  if(!readinessContext)return;
  const form=document.querySelector('#readiness-form');
  const data=new FormData(form);
  const readiness={
    energy:num(data.get('energy'))||3,soreness:num(data.get('soreness'))||2,
    sleep:num(data.get('sleep'))||3,timeAvailable:num(data.get('timeAvailable'))||num(store.profile?.minutes)||45
  };
  readiness.score=readinessScore(readiness);
  const sharedDraft=readinessContext.sharedDraft?clone(readinessContext.sharedDraft):null;
  if(sharedDraft?.backendId&&workoutSupabase&&store.account?.userId){
    const latestDay=readinessContext.day;
    await workoutSupabase.from('workout_shared_private_state').update({planned_day:safeSharedPlanSnapshot(latestDay),updated_at:new Date().toISOString()}).eq('session_id',sharedDraft.backendId).eq('user_id',store.account.userId);
    const {error:privateError}=await workoutSupabase.from('workout_shared_private_state').update({
      readiness,updated_at:new Date().toISOString()
    }).eq('session_id',sharedDraft.backendId).eq('user_id',store.account.userId);
    if(privateError){toast(privateError.message||'Could not save your private check-in.');return;}
    const {error:readyError}=await workoutSupabase.from('workout_shared_participant_state').update({
      ready:true,phase:'ready',updated_at:new Date().toISOString()
    }).eq('session_id',sharedDraft.backendId).eq('user_id',store.account.userId);
    if(readyError){toast(readyError.message||'Could not complete your check-in.');return;}
    const live=sharedTrainingState().draft;
    if(live?.backendId===sharedDraft.backendId){live.userStatus='ready';live.userConfirmed=false;saveSharedBackendDraft(live);}
    try{
      await sharedRuntime.channel?.send({
        type:'broadcast',event:'participant-state',
        payload:{...currentSharedCoordinationState(),ready:true,planConfirmed:false,phase:'ready'}
      });
    }catch{}
    readinessContext=null;
    const plan=await tryBuildTogetherPlan(live||sharedDraft);
    currentTab='together';
    if(plan?.slots?.length)toast('Your Together plan is ready to review.');
    else toast('Check-in complete. Waiting for your partner.');
    render();return;
  }
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
      let suggestedWeight=adaptive?.weight ?? calibrated?.weight ?? ex.startWeight ?? 0;
      const suggestedReps=adaptive?.reps || ex.startReps || recommendedRepCount(ex.reps);
      if(day.holdProgression&&adaptive?.weight&&calibrated?.weight)suggestedWeight=Math.min(adaptive.weight,calibrated.weight);
      if(day.readinessLoadFactor<1&&isWeightedMode(ex.loadMode)&&suggestedWeight)suggestedWeight=roundTo(suggestedWeight*day.readinessLoadFactor,ex.increment||5);
      const suggestedRest=Math.max(30,Math.min(90,(adaptive?.rest || ex.rest || 45)+(day.readinessRestBonus||0)));
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
  const ex=w.exercises[ei];
  for(let setIndex=si+1;setIndex<(ex.sets||[]).length;setIndex++)if(!ex.sets[setIndex].completed)return {ei,si:setIndex,type:'set'};
  for(let index=ei+1;index<w.exercises.length;index++){
    if(!exerciseCountsAsResolved(w.exercises[index]))return {ei:index,si:firstIncompleteSetIndex(w.exercises[index]),type:'exercise'};
  }
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
function initializeTimedStageRuntime(w){
  w.timedStageIndex=0;
  w.timedStageStartedAt=new Date(Date.now()+3000).toISOString();
}
function timedStageSnapshot(w,nowMs=Date.now()){
  if(!w||!['warmup','cooldown'].includes(w.phase))return null;
  nowMs=workoutNowMs(w,nowMs);
  const items=timedStageItems(w);
  if(!items.length)return {complete:true,index:0,remaining:0,remainingExact:0,total:0};
  let index=Number.isInteger(w.timedStageIndex)?w.timedStageIndex:0;
  if(index>=items.length)return {complete:true,index:items.length-1,remaining:0,remainingExact:0,total:0};
  index=Math.max(0,index);
  const item=items[index]||{};
  let startMs=Date.parse(w.timedStageStartedAt||'');
  if(!Number.isFinite(startMs)){w.timedStageStartedAt=new Date(nowMs).toISOString();startMs=nowMs;}
  if(startMs>nowMs){const remainingExact=(startMs-nowMs)/1000;return {complete:false,ready:true,index,remaining:Math.ceil(remainingExact),remainingExact,total:3,item};}
  if(item.mode==='reps')return {complete:false,manual:true,index,remaining:0,remainingExact:0,total:num(item.reps)||num(item.repsPerSide)||0,item};
  const total=Math.max(1,num(item.seconds)||20),elapsed=Math.max(0,(nowMs-startMs)/1000),remainingExact=Math.max(0,total-elapsed);
  return {complete:false,stageComplete:remainingExact<=0,index,remaining:Math.max(0,Math.ceil(remainingExact)),remainingExact,total,item};
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
  workoutPreviewIndex=null;workoutFormMode=false;
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
function previewExercise(index){
  const w=store.activeWorkout;if(!w||w.phase==='intro'||w.phase==='review')return;
  const safe=Math.max(0,Math.min(num(index),w.exercises.length-1));
  persistActiveSetDraft();
  workoutPreviewIndex=safe;
  workoutFormMode=false;
  workoutMapOpen=false;
  render();
}
function navigateExercise(delta){
  const w=store.activeWorkout;if(!w||w.phase==='intro'||w.phase==='review')return;
  const base=workoutPreviewIndex===null?(w.currentExerciseIndex||0):workoutPreviewIndex;
  const target=Math.max(0,Math.min(base+delta,w.exercises.length-1));
  if(target===base){toast(delta<0?'You are at the first exercise.':'You are at the last exercise.');return;}
  previewExercise(target);
}
function backToWorkout(){
  persistActiveSetDraft();
  workoutPreviewIndex=null;workoutFormMode=false;render();
}
function startPreviewedExercise(){
  if(workoutPreviewIndex===null)return;
  const target=workoutPreviewIndex;
  persistActiveSetDraft();
  workoutPreviewIndex=null;workoutFormMode=false;
  navigateToExercise(target);
}
function persistActiveSetDraft(){
  const pos=getActivePosition();if(!pos||!store.activeWorkout)return;
  const weightInput=document.querySelector('#set-weight');
  const repsInput=document.querySelector('#set-reps');
  if(weightInput)pos.set.weight=String(weightInput.value||'').trim().replace(/[^0-9.]/g,'');
  if(repsInput)pos.set.reps=String(repsInput.value||'').trim().replace(/[^0-9.]/g,'');
}
function autosaveCurrentSetDraft(){
  const pos=getActivePosition();if(!pos||pos.workout.phase!=='work')return;
  persistActiveSetDraft();
  clearTimeout(draftAutosaveTimer);
  draftAutosaveTimer=setTimeout(()=>saveStore(),180);
}

function markExerciseManual(index){
  const w=store.activeWorkout,ex=w?.exercises?.[index];if(!ex)return;
  ex.manualComplete=true;ex.manualCompletedAt=new Date().toISOString();ex.skipped=false;ex.skipReason='';
  if(w.phase==='intro'){saveStore();render();return;}
  if(w.phase==='exercise-transition'&&w.pendingPosition?.ei===index){
    const next=nextUnresolvedExerciseIndex(w,index);
    if(next>=0){
      w.pendingPosition={ei:next,si:firstIncompleteSetIndex(w.exercises[next]),type:'exercise'};
      announceExercise(w.exercises[next],'Next exercise');saveStore();render();
    }else startCooldown();
    return;
  }
  if(index===w.currentExerciseIndex){
    const next=nextUnresolvedExerciseIndex(w,index);
    if(next>=0){navigateToExercise(next);}
    else{startCooldown();}
  }else{saveStore();render();}
}

function undoManualExercise(index){
  const ex=store.activeWorkout?.exercises?.[index];if(!ex)return;
  ex.manualComplete=false;ex.manualCompletedAt=null;saveStore();render();
}
function skipExercise(index,reason='Skipped by user'){
  const w=store.activeWorkout,ex=w?.exercises?.[index];if(!ex)return;
  ex.skipped=true;ex.skipReason=reason;ex.manualComplete=false;ex.manualCompletedAt=null;
  if(w.phase==='intro'){saveStore();render();return;}
  if(w.phase==='exercise-transition'&&w.pendingPosition?.ei===index){
    const next=nextUnresolvedExerciseIndex(w,index);
    if(next>=0){
      w.pendingPosition={ei:next,si:firstIncompleteSetIndex(w.exercises[next]),type:'exercise'};
      announceExercise(w.exercises[next],'Next exercise');saveStore();render();
    }else startCooldown();
    return;
  }
  if(index===w.currentExerciseIndex){
    const next=nextUnresolvedExerciseIndex(w,index);
    if(next>=0)navigateToExercise(next);
    else startCooldown();
  }else{saveStore();render();}
}

function restoreExercise(index){
  const ex=store.activeWorkout?.exercises?.[index];if(!ex)return;
  ex.skipped=false;ex.skipReason='';ex.manualComplete=false;ex.manualCompletedAt=null;saveStore();render();
}
function moveExerciseLater(index){
  const w=store.activeWorkout;if(!w||index<0||index>=w.exercises.length-1)return;
  const ex=w.exercises[index];if(exerciseCountsAsResolved(ex)){toast('Completed or skipped exercises stay in their logged position.');return;}
  const wasCurrent=w.currentExerciseIndex===index;
  const wasPending=w.phase==='exercise-transition'&&w.pendingPosition?.ei===index;
  w.exercises.splice(index,1);w.exercises.push(ex);
  if(w.currentExerciseIndex>index)w.currentExerciseIndex-=1;
  if(wasCurrent){
    w.currentExerciseIndex=Math.min(index,w.exercises.length-1);
    saveStore();
    navigateToExercise(w.currentExerciseIndex);
    toast(ex.name+' moved later in this workout.');
    return;
  }
  if(wasPending){
    const newNext=w.exercises[index];
    w.pendingPosition={ei:index,si:firstIncompleteSetIndex(newNext),type:'exercise'};
    announceExercise(newNext,'Next exercise');
  }
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
  const ex=pos.exercise,state=exerciseState(ex),done=(ex.sets||[]).filter(set=>set.completed).length;
  return '<div class="clean-exercise-review">'+
    '<div class="clean-exercise-heading"><div><p class="eyebrow">EXERCISE '+(pos.ei+1)+' OF '+pos.workout.exercises.length+'</p><h2>'+esc(ex.name)+'</h2><p>'+esc(exerciseStateLabel(ex))+' · '+done+'/'+ex.sets.length+' sets logged</p></div><button class="more-action" data-action="open-exercise-actions" data-exercise-index="'+pos.ei+'">•••</button></div>'+
    '<div class="clean-exercise-media">'+exerciseImageButton(ex,'active-exercise-media')+'</div>'+
    renderLoggedSets(ex,pos.ei)+
    (state==='partial'||state==='not-started'?'<button class="button primary-action" data-action="continue-exercise" data-exercise-index="'+pos.ei+'">CONTINUE EXERCISE</button>':'')+
    (state==='skipped'?'<button class="button secondary" data-action="restore-exercise" data-exercise-index="'+pos.ei+'">RETURN TO EXERCISE</button>':'')+
    '<button class="text-button" data-action="open-workout-map">BACK TO WORKOUT MAP</button>'+
  '</div>';
}
function renderWorkoutMap(){
  if(!workoutMapOpen||!store.activeWorkout)return '';
  const w=store.activeWorkout;
  return '<div class="exercise-modal-backdrop workout-map-backdrop" data-action="close-workout-map"><section class="exercise-modal workout-map-modal clean-workout-map" data-workout-map-panel role="dialog" aria-modal="true">'+
    '<button class="modal-close" data-action="close-workout-map" type="button">×</button><div class="workout-map-head"><p class="eyebrow">WORKOUT MAP</p><h2>'+esc(w.routineName)+'</h2><p>Tap an exercise to open it. Use ••• for swap, move, complete, or skip.</p></div>'+
    '<div class="workout-map-list">'+w.exercises.map((ex,index)=>{
      const state=exerciseState(ex),done=(ex.sets||[]).filter(set=>set.completed).length;
      const status=state==='complete'?'✓':state==='completed-manually'?'✓ MANUAL':state==='partial'?done+'/'+ex.sets.length:state==='skipped'?'SKIPPED':'';
      return '<article class="workout-map-row '+(index===w.currentExerciseIndex?'current':'')+'"><button class="map-open" type="button" '+(w.phase!=='intro'?'data-action="preview-exercise" data-exercise-index="'+index+'"':'')+'><span class="map-number">'+String(index+1).padStart(2,'0')+'</span><div class="map-copy"><strong>'+esc(ex.name)+'</strong><span>'+esc(ex.sets.length+' × '+ex.reps)+'</span></div><em class="map-status">'+esc(status)+'</em></button><button class="map-more" type="button" data-action="open-exercise-actions" data-exercise-index="'+index+'" aria-label="Options for '+esc(ex.name)+'">•••</button></article>';
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
  initializeTimedStageRuntime(w);
  if(!w.cooldown?.length){ openWorkoutReview(); return; }
  saveStore();render();
}

function completeTimedStagePhase(w){
  const wasWarmup=w.phase==='warmup';
  delete w.timedStageIndex;delete w.timedStageStartedAt;
  w.timedPhaseStartedAt=null;w.timedPhaseSkippedSeconds=0;
  if(wasWarmup){w.warmupCompleted=true;beginPreSetPosition(0,0,true);return;}
  w.cooldownCompleted=true;
  fireWorkoutSignal('complete','cooldown-complete-'+w.id,{voice:'Cooldown complete. Review your workout before saving.',label:'DONE'});
  openWorkoutReview();
}
function reconcileTimedStage(){
  const w=store.activeWorkout;if(!w||!['warmup','cooldown'].includes(w.phase))return false;
  const snap=timedStageSnapshot(w);if(!snap)return false;
  if(snap.complete){completeTimedStagePhase(w);return true;}
  if(snap.stageComplete){advanceTimedStage(false);return true;}
  return false;
}
function advanceTimedStage(skipped=true){
  const w=store.activeWorkout;if(!w||!['warmup','cooldown'].includes(w.phase))return;
  const items=timedStageItems(w),current=Math.max(0,Number.isInteger(w.timedStageIndex)?w.timedStageIndex:0),nextIndex=current+1;
  if(nextIndex>=items.length){completeTimedStagePhase(w);return;}
  w.timedStageIndex=nextIndex;
  w.timedStageStartedAt=new Date(Date.now()+3000).toISOString();
  const next=items[nextIndex]||{},voice=next.sideLabel?'Switch to '+String(next.sideLabel).toLowerCase():('Next. '+(next.name||'Movement'));
  fireWorkoutSignal('transition','stage-'+w.id+'-'+w.phase+'-'+nextIndex+'-'+Date.now(),{voice,label:next.sideLabel?'SWITCH SIDES':'NEXT'});
  saveStore();render();
}
function skipRemainingPrep(){
  const w=store.activeWorkout;if(!w)return;
  if(w.phase==='warmup'){w.warmupSkipped=true;delete w.timedStageIndex;delete w.timedStageStartedAt;beginPreSetPosition(0,0,true);return;}
  if(w.phase==='cooldown'){w.cooldownSkipped=true;delete w.timedStageIndex;delete w.timedStageStartedAt;openWorkoutReview();}
}
function recordPrepFeedback(value){
  const w=store.activeWorkout;if(!w)return;
  const program=ensureTrainingProgram();program.prepFeedback=Array.isArray(program.prepFeedback)?program.prepFeedback:[];
  program.prepFeedback.unshift({workoutId:w.id,value,at:new Date().toISOString(),warmup:prepSettings().warmup,cooldown:prepSettings().cooldown});
  program.prepFeedback=program.prepFeedback.slice(0,50);w.prepFeedback=value;saveStore();render();
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
  ['startedAt','exerciseStartedAt','timedPhaseStartedAt','timedStageStartedAt','preSetStartedAt','timedSetStartedAt','timedSetEndsAt','restEndsAt'].forEach(key=>shiftWorkoutTimestamp(w,key,delta));
  w.isPaused=false;
  w.pausedAt=null;
  saveStore();
  fireWorkoutSignal('transition','workout-resumed-'+w.id+'-'+Date.now(),{voice:'Resume',label:'RESUME'});
  render();
}

function resetActiveTimer(){
  const w=store.activeWorkout;if(!w)return;
  const now=new Date();
  if(w.phase==='rest'){const duration=Math.max(1,num(w.restDuration)||30);if(Number.isFinite(w.restPausedRemaining))w.restPausedRemaining=duration;else w.restEndsAt=new Date(now.getTime()+duration*1000).toISOString();}
  else if(w.phase==='timed-set'){const duration=Math.max(1,num(w.timedSetDuration)||num(getActivePosition()?.set?.reps)||30);w.timedSetStartedAt=now.toISOString();w.timedSetEndsAt=new Date(now.getTime()+duration*1000).toISOString();}
  else if(w.phase==='pre-set'){w.preSetStartedAt=now.toISOString();}
  else if(w.phase==='warmup'||w.phase==='cooldown'){const snap=timedStageSnapshot(w);if(!snap||snap.manual)return;w.timedStageStartedAt=now.toISOString();}
  else return;
  saveStore();fireWorkoutSignal('transition','timer-reset-'+w.id+'-'+w.phase+'-'+Date.now(),{voice:'Timer reset',label:'RESET'});render();
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
  const skipped=w.exercises.filter(ex=>exerciseState(ex)==='skipped').length;
  const rows=w.exercises.map((ex,index)=>{
    const state=exerciseState(ex),done=(ex.sets||[]).filter(set=>set.completed).length;
    const status=state==='complete'?'✓':state==='completed-manually'?'✓ Manual':state==='partial'?done+'/'+ex.sets.length:state==='skipped'?'Skipped':'Not finished';
    return '<button class="final-review-row clean-review-row" data-action="jump-from-review" data-exercise-index="'+index+'"><div class="review-index">'+String(index+1).padStart(2,'0')+'</div><div><strong>'+esc(ex.name)+'</strong><span>'+esc(status)+'</span></div><em>›</em></button>';
  }).join('');
  return '<div class="workout-final-review clean-final-review"><div class="summary-check">'+(fullyResolved?'✓':'◐')+'</div><p class="eyebrow">WORKOUT REVIEW</p><h2>'+esc(w.routineName)+'</h2><p>Check anything that needs correcting before this session becomes training history.</p>'+
    '<div class="review-summary-grid clean-review-summary"><div><span>EXERCISES</span><strong>'+resolved+'/'+w.exercises.length+'</strong></div><div><span>SETS LOGGED</span><strong>'+actualSets+'/'+totalSets(w.exercises)+'</strong></div><div><span>SKIPPED</span><strong>'+skipped+'</strong></div></div>'+
    '<div class="final-review-list">'+rows+'</div>'+
    '<section class="prep-feedback-card"><span>PREP & RECOVERY</span><strong>How did the warm-up and cooldown feel?</strong><div>'+['too-much','right','too-little'].map(value=>'<button data-action="prep-feedback" data-prep-feedback="'+value+'" class="'+(w.prepFeedback===value?'active':'')+'">'+(value==='too-much'?'Too much':value==='right'?'About right':'Too little')+'</button>').join('')+'</div></section>'+
    '<div class="final-review-actions">'+
      (fullyResolved?'<button class="button primary-action" data-action="save-workout-complete">FINISH & SAVE</button>':'<button class="button primary-action" data-action="finish-workout-anyway">FINISH ANYWAY</button><button class="button secondary" data-action="save-workout-partial">SAVE AS PARTIAL</button>')+
      '<button class="text-button" data-action="continue-workout">CONTINUE WORKOUT</button><button class="text-button danger-text" data-action="discard">DISCARD WORKOUT</button></div>'+
  '</div>';
}

function openWorkoutReview(){
  const w=store.activeWorkout;if(!w)return;
  pauseInteractiveTimers(w);
  w.returnPhase=w.phase;
  w.phase='review';saveStore();render();
}
function jumpFromReview(index){
  const w=store.activeWorkout;if(!w||w.phase!=='review')return;
  w.phase='exercise-review';
  delete w.returnPhase;
  navigateToExercise(index);
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
  ['pendingPosition','restEndsAt','restPausedRemaining','lastProgressionResult','preSetStartedAt','preSetSetupSeconds','preSetCountdownSeconds','preSetIsNewExercise','pausedAt','isPaused','timedSetStartedAt','timedSetDuration','timedSetEndsAt','timedSetPausedRemaining','timedStageIndex','timedStageStartedAt','returnPhase'].forEach(key=>delete entry[key]);
  store.history.unshift(entry);store.history=store.history.slice(0,100);store.lastSummaryId=entry.id;
  if(entry.sharedSession){
    const shared=sharedTrainingState();
    shared.history.unshift({id:entry.sharedSession.id,workoutId:entry.id,partnerName:entry.sharedSession.partnerName,routineName:entry.routineName,completedAt,completionStatus:status});
    shared.history=shared.history.slice(0,50);
    if(shared.draft?.id===entry.sharedSession.id)shared.draft=null;
    if(entry.sharedSession.backendId)completeSharedParticipant(entry.sharedSession,status).catch(error=>console.warn('Shared completion sync failed',error));
  }
  store.activeWorkout=null;
  rebuildDerivedTrainingState();saveStore();currentTab='summary';render();
}
function finishWorkout(auto=false){
  const w=store.activeWorkout;if(!w)return;
  if(auto){openWorkoutReview();return;}
  openWorkoutReview();
}

function discardWorkout(){if(!store.activeWorkout)return;if(!confirm('Discard this workout?'))return;store.activeWorkout=null;saveStore();currentTab='home';render();}

function renderProfileEditor(){
  const p=store.profile||{};
  const lifts=p.lifts||{};
  const goals=Array.isArray(p.goals)&&p.goals.length?p.goals:[p.goal||'muscle'];
  const primaryGoal=p.primaryGoal||p.goal||goals[0]||'muscle';
  const av=v=>(p.avoid||[]).includes(v)?'checked':'';
  const pref=v=>(p.preferAvoid||[]).includes(v)?'checked':'';
  const scheduledDays=preferredWorkoutDays(p);
  const goalOptions=[
    ['muscle','Build muscle','Progressive overload + hypertrophy'],
    ['strength','Get stronger','Heavier work + longer recovery'],
    ['fat-loss','Lose body fat','Strength plus conditioning support'],
    ['endurance','Improve endurance','More work capacity and conditioning'],
    ['mobility','Improve mobility / flexibility','More movement preparation and mobility'],
    ['athletic','Athletic performance','Strength, power and movement quality'],
    ['general','Overall fitness','Balanced strength and work capacity'],
    ['consistency','Rebuild consistency','Approachable sessions and repeatability'],
    ['sport','Support another sport / activity','Training that complements another activity'],
    ['partner','Train with a partner','Keep Together training in the mix'],
    ['energy','Feel better / more energy','Sustainable movement and fitness']
  ];
  const avoidOptions=[
    ['overhead','Overhead pressing'],['knee','Deep knee-dominant work'],['hinge','Hip hinging'],['floor','Floor exercises'],
    ['running','Running'],['jumping','Jumping / high impact'],['squat','Barbell squats'],['deadlift','Conventional deadlifts'],
    ['pullup','Pull-ups'],['dip','Dips'],['lunge','Lunges / split squats'],['burpee','Burpees'],['timed','Timed exercises']
  ];
  return `
  <div class="onboard-shell">
    <div class="page-head"><div><p class="eyebrow">${store.profile?'EDIT TRAINING PROFILE':'GET STARTED'}</p><h2 class="page-title">${store.profile?'Update how Workout trains you.':'Build your training profile.'}</h2><p class="page-copy">Everything here stays editable later. Changes rebuild future programming without deleting your workout history, PRs or progression.</p></div></div>
    <form id="profile-form" class="intake-form" novalidate>
      <section class="form-section"><div class="form-section-head"><span>01</span><div><h3>What do you want from your training?</h3><p>Select everything that matters. Then choose the primary goal that should drive your programming.</p></div></div>
        <div class="choice-grid goal-multi-grid">
          ${goalOptions.map(([v,t,d])=>`<label class="choice-card"><input type="checkbox" name="goals" value="${v}" ${goals.includes(v)?'checked':''}><span><strong>${t}</strong><small>${d}</small></span></label>`).join('')}
        </div>
        <div class="form-grid two sub-choice">
          <label class="field"><span>PRIMARY GOAL</span><select name="primaryGoal">${goalOptions.map(([v,t])=>`<option value="${v}" ${primaryGoal===v?'selected':''}>${t}</option>`).join('')}</select></label>
          <label class="field"><span>SOMETHING ELSE <em>OPTIONAL</em></span><input name="customGoal" value="${esc(p.customGoal||'')}" placeholder="e.g. prepare for hiking season"></label>
        </div>
      </section>

      <section class="form-section"><div class="form-section-head"><span>02</span><div><h3>About you</h3><p>Identity stays separate from performance. Gender and pronouns are presentation data and never used to guess strength.</p></div></div>
        <div class="form-grid two identity-grid">
          <label class="field"><span>DISPLAY NAME</span><input name="displayName" autocomplete="name" value="${esc(store.account?.displayName||p.displayName||'')}" placeholder="How you want to appear"></label>
          <label class="field"><span>EMAIL</span><input name="email" type="email" autocomplete="email" value="${esc(store.account?.email||p.email||'')}" readonly></label>
          <label class="field"><span>GENDER</span><select name="gender">${[['','Choose'],['woman','Woman'],['man','Man'],['nonbinary','Nonbinary'],['another','Another identity'],['prefer-not','Prefer not to say']].map(([v,label])=>`<option value="${v}" ${p.gender===v?'selected':''}>${label}</option>`).join('')}</select></label>
          <label class="field"><span>PRONOUNS <em>OPTIONAL</em></span><input name="pronouns" value="${esc(p.pronouns||'')}" placeholder="e.g. he/him"></label>
        </div>
        <div class="form-grid three body-grid">
          <label class="field"><span>BODY WEIGHT (LB)</span><input name="weight" type="number" min="50" max="700" value="${esc(p.weight||'')}" required placeholder="180"></label>
          <label class="field"><span>HEIGHT</span><div class="inline-inputs"><input name="heightFeet" type="number" min="3" max="8" value="${esc(p.heightFeet||'')}" placeholder="5"><input name="heightInches" type="number" min="0" max="11" value="${esc(p.heightInches||'')}" placeholder="10"></div></label>
          <label class="field"><span>AGE RANGE</span><select name="ageRange">${['18-24','25-34','35-44','45-54','55-64','65+'].map(v=>`<option ${p.ageRange===v?'selected':''}>${v}</option>`).join('')}</select></label>
        </div>
      </section>

      <section class="form-section"><div class="form-section-head"><span>03</span><div><h3>Training experience</h3><p>This affects exercise complexity and initial volume.</p></div></div>
        <div class="choice-grid four">${[['new','New','Little or no lifting'],['beginner','Beginner','Under ~1 year'],['intermediate','Intermediate','Consistent 1–3 years'],['advanced','Advanced','3+ consistent years']].map(([v,t,d])=>`<label class="choice-card"><input type="radio" name="experience" value="${v}" ${p.experience===v||(!p.experience&&v==='new'?'checked':'')}><span><strong>${t}</strong><small>${d}</small></span></label>`).join('')}</div>
      </section>

      <section class="form-section"><div class="form-section-head"><span>04</span><div><h3>Your real schedule</h3><p>Choose how often you train and the days that actually fit your week.</p></div></div>
        <div class="form-grid two">
          <label class="field"><span>DAYS PER WEEK</span><select name="days" id="training-days-count">${[2,3,4,5].map(v=>`<option value="${v}" ${num(p.days||4)===v?'selected':''}>${v} days</option>`).join('')}</select></label>
          <label class="field"><span>MINUTES PER WORKOUT</span><select name="minutes">${[20,30,45,60,75].map(v=>`<option value="${v}" ${num(p.minutes||45)===v?'selected':''}>${v} minutes</option>`).join('')}</select></label>
        </div>
        <div class="schedule-day-picker"><div class="schedule-day-head"><span>TRAINING DAYS</span><small>Select exactly ${num(p.days||4)} days.</small></div><div class="weekday-pills">${TRAINING_DAYS.map(day=>`<label class="weekday-pill"><input type="checkbox" name="workoutDays" value="${day.id}" ${scheduledDays.includes(day.id)?'checked':''}><span><strong>${day.label}</strong><small>${day.name}</small></span></label>`).join('')}</div></div>
      </section>

      <section class="form-section"><div class="form-section-head"><span>05</span><div><h3>Where are you training?</h3><p>We only choose exercises your setup supports.</p></div></div>
        <div class="choice-grid">${[['full-gym','Full gym'],['dumbbells','Dumbbells'],['mixed-home','Home mix'],['bands','Resistance bands'],['bodyweight','Bodyweight only']].map(([v,t])=>`<label class="choice-card compact"><input type="radio" name="equipment" value="${v}" ${p.equipment===v||(!p.equipment&&v==='full-gym'?'checked':'')}><span><strong>${t}</strong></span></label>`).join('')}</div>
        <div class="choice-grid three sub-choice">${[['mixed','Mixed'],['machines','Prefer machines'],['free','Prefer free weights']].map(([v,t])=>`<label class="choice-card compact"><input type="radio" name="style" value="${v}" ${p.style===v||(!p.style&&v==='mixed'?'checked':'')}><span><strong>${t}</strong></span></label>`).join('')}</div>
      </section>

      <section class="form-section"><div class="form-section-head"><span>06</span><div><h3>Training priorities</h3><p>Choose up to two body areas to emphasize.</p></div></div>
        <div class="check-row">${[['chest','Chest'],['back','Back'],['shoulders','Shoulders'],['arms','Arms'],['legs','Legs'],['glutes','Glutes'],['core','Core']].map(([v,t])=>`<label class="check-pill"><input type="checkbox" name="priorities" value="${v}" ${(p.priorities||[]).includes(v)?'checked':''}><span>${t}</span></label>`).join('')}</div>
      </section>

      <section class="form-section"><div class="form-section-head"><span>07</span><div><h3>Recent working weights <em>optional</em></h3><p>These improve starting estimates. Leave blank if you do not know them.</p></div></div>
        <div class="form-grid five">${[['bench','Bench press'],['squat','Squat'],['deadlift','Deadlift / RDL'],['overhead','Overhead press'],['row','Row / pulldown']].map(([n,l])=>`<label class="field"><span>${l.toUpperCase()}</span><input name="${n}" type="number" min="0" step="5" value="${esc(lifts[n]||'')}" placeholder="lb"></label>`).join('')}</div>
      </section>

      <section class="form-section"><div class="form-section-head"><span>08</span><div><h3>Exercise preferences & limitations</h3><p>Use <strong>Leave out</strong> for hard exclusions and <strong>Prefer alternatives</strong> when an exercise is okay but not your first choice.</p></div></div>
        <p class="field-group-label">LEAVE OUT</p><div class="check-row">${avoidOptions.map(([v,t])=>`<label class="check-pill"><input type="checkbox" name="avoid" value="${v}" ${av(v)}><span>${t}</span></label>`).join('')}</div>
        <label class="field custom-preference-field"><span>CUSTOM LEAVE-OUTS</span><input name="customAvoid" value="${esc((p.customAvoid||[]).join(', '))}" placeholder="Comma-separated, e.g. box jumps, skull crushers"></label>
        <p class="field-group-label">PREFER ALTERNATIVES</p><div class="check-row">${avoidOptions.map(([v,t])=>`<label class="check-pill soft"><input type="checkbox" name="preferAvoid" value="${v}" ${pref(v)}><span>${t}</span></label>`).join('')}</div>
        <label class="field custom-preference-field"><span>CUSTOM PREFERENCES</span><input name="customPreferAvoid" value="${esc((p.customPreferAvoid||[]).join(', '))}" placeholder="Comma-separated exercises you would rather replace"></label>
        <div class="form-grid two sub-choice">
          <label class="field"><span>BODY AREAS TO BE CAREFUL WITH</span><input name="cautionAreas" value="${esc((p.cautionAreas||[]).join(', '))}" placeholder="e.g. knees, lower back, wrists"></label>
          <label class="field"><span>TRAINING FORMAT TO AVOID</span><input name="formatAvoid" value="${esc((p.formatAvoid||[]).join(', '))}" placeholder="e.g. circuits, supersets, high impact"></label>
        </div>
      </section>

      <section class="form-section"><div class="form-section-head"><span>09</span><div><h3>Connected health & fitness</h3><p>Optional. Workout is designed for both iPhone and Android. Connections enhance training but are never required.</p></div></div>
        <div class="fitness-connection-grid">
          ${[
            ['apple-health','Apple Health','iPhone','Native app bridge required'],
            ['health-connect','Health Connect','Android','Native app bridge required'],
            ['fitbit','Fitbit','iPhone + Android','Provider connection planned'],
            ['garmin','Garmin','iPhone + Android','Provider connection planned'],
            ['strava','Strava','iPhone + Android','Provider connection planned']
          ].map(([id,name,platform,status])=>`<label class="fitness-connection-card"><div><span>${platform}</span><strong>${name}</strong><small>${status}</small></div><input class="fitness-provider-toggle" type="checkbox" data-fitness-provider="${id}" ${(p.fitnessConnections||[]).includes(id)?'checked':''}><b>${(p.fitnessConnections||[]).includes(id)?'SELECTED':'ADD'}</b></label>`).join('')}
        </div>
        <div class="profile-privacy-note"><strong>Web prototype note</strong><span>Apple Health and Android Health Connect require a native app bridge. This build stores connection preferences and prepares the account model without pretending browser access exists.</span></div>
      </section>

      <div class="form-actions"><button type="button" class="button large" data-action="build-plan">${store.profile?'SAVE & REBUILD FUTURE PLAN':'BUILD MY PLAN'}</button>${store.profile?'<button type="button" class="button secondary large" data-action="home">CANCEL</button>':''}</div>
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
function markScheduledWorkoutComplete(dayId,scheduledDate){
  const entry=scheduledEntryFor(dayId,scheduledDate);if(!entry)return;
  const existing=scheduleHistoryMatch(entry);
  if(existing){
    if(existing.completionStatus!=='partial'){toast('That scheduled workout is already marked complete.');return;}
    existing.completionStatus='complete';
    existing.manualWorkoutCompletion=true;
    existing.manuallyCompletedSchedule=true;
    existing.actualCompletedDate=existing.actualCompletedDate||scheduledDate;
    existing.completedAt=existing.completedAt||new Date().toISOString();
    rebuildDerivedTrainingState();saveStore();render();toast('Partial workout marked complete.');
    return;
  }
  const day=entry.adaptedDay||entry.day;
  const now=new Date().toISOString();
  const historyEntry={
    schemaVersion:ACTIVE_WORKOUT_SCHEMA,id:uid('manual-workout'),planId:store.plan.id,planDayId:entry.day.id,
    routineName:day.name,focus:day.focus,scheduledDate,actualStartDate:scheduledDate,actualCompletedDate:scheduledDate,
    startedAt:now,completedAt:now,durationMinutes:0,completionStatus:'complete',manualWorkoutCompletion:true,
    readiness:null,programContext:programContext(dateFromKey(scheduledDate)),adaptationNotes:['Marked complete manually. No performance data was invented.'],
    exercises:(day.exercises||[]).map(ex=>({...clone(ex),manualComplete:true,manualCompletedAt:now,skipped:false,skipReason:'',sets:Array.from({length:Math.max(0,num(ex.sets)||0)},()=>({id:uid('set'),weight:'',reps:'',completed:false,completedAt:null}))})),
    completedSets:0,resolvedExercises:(day.exercises||[]).length,totalVolume:0,newPRs:[]
  };
  store.history.unshift(historyEntry);store.history=store.history.slice(0,100);
  rebuildDerivedTrainingState();saveStore();render();toast(day.name+' marked complete.');
}
function removeHistoryWorkout(id){
  const workout=store.history.find(item=>item.id===id);if(!workout)return;
  if(!confirm('Remove '+workout.routineName+' from history? Weekly status, PR context, and adaptive recommendations will recalculate from the remaining workouts.'))return;
  store.history=store.history.filter(item=>item.id!==id);
  if(store.lastSummaryId===id)store.lastSummaryId=null;
  rebuildDerivedTrainingState();saveStore();render();toast('Workout removed from history.');
}

function scheduleStatusLabel(entry){
  if(entry.status==='complete')return 'COMPLETED';
  if(entry.status==='today')return 'TODAY';
  if(entry.status==='missed')return 'MISSED';
  if(entry.status==='skipped')return 'SKIPPED';
  if(entry.status==='partial')return 'PARTIAL';
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
  const completeButton='<button class="text-button" data-action="mark-scheduled-complete" data-day-id="'+esc(entry.day.id)+'" data-scheduled-date="'+esc(entry.dateKey)+'">MARK COMPLETE</button>';
  const button=entry.status==='complete'?
    '<span class="schedule-done">✓ DONE</span>':
    entry.status==='skipped'?
      '<button class="text-button muted" data-action="undo-skip-scheduled" data-scheduled-date="'+esc(entry.dateKey)+'">UNDO SKIP</button>':
      entry.status==='partial'?
        '<div class="schedule-actions"><span class="schedule-partial">PARTIAL</span>'+completeButton+'</div>':
      '<div class="schedule-actions">'+
        (canStart?'<button class="button secondary" data-start="'+esc(entry.day.id)+'" data-scheduled-date="'+esc(entry.dateKey)+'">'+(entry.status==='missed'?'MAKE UP':entry.status==='today'?'START TODAY':'START EARLY')+'</button>':'')+
        completeButton+
        (entry.status==='missed'?'<button class="text-button muted" data-action="skip-scheduled" data-scheduled-date="'+esc(entry.dateKey)+'">SKIP</button>':'')+
      '</div>';
  return '<article class="schedule-card status-'+entry.status+'">'+
    '<div class="schedule-date"><span>'+esc(entry.dayName.slice(0,3).toUpperCase())+'</span><strong>'+entry.date.getDate()+'</strong></div>'+
    '<div class="schedule-main"><div class="schedule-top"><span>'+status+'</span><em>~'+esc(day.estimatedMinutes)+' min</em></div>'+
    '<h3>'+esc(day.name)+'</h3><p>'+esc(day.focus)+'</p>'+
    '<div class="schedule-meta"><span>'+day.exercises.length+' exercises</span><span>'+day.exercises.reduce((sum,ex)=>sum+(ex.sets||0),0)+' working sets</span></div>'+
    (entry.history?'<small class="schedule-completion">'+esc(entry.history.manualWorkoutCompletion?'Marked complete manually. No set data assumed.':scheduleCompletionNote(entry))+'</small>':'')+
    '</div><div class="schedule-cta">'+button+'</div></article>';
}

function displayName(){
  return store.account?.displayName||store.profile?.displayName||'there';
}
async function initWorkoutAuth(){
  try{
    if(/(?:[?#&])type=recovery(?:[&#]|$)|[?&]recovery=1/.test(window.location.href))authMode='reset';
    if(!window.supabase?.createClient){authReady=true;render();return;}
    workoutSupabase=window.supabase.createClient(WORKOUT_SUPABASE_URL,WORKOUT_SUPABASE_PUBLISHABLE_KEY,{
      auth:{
        storage:window.localStorage,
        persistSession:true,
        autoRefreshToken:true,
        detectSessionInUrl:true
      }
    });
    const {data,error}=await workoutSupabase.auth.getSession();
    if(error)console.warn('Workout session restore warning',error);
    applyWorkoutSession(data?.session||null);
    workoutSupabase.auth.onAuthStateChange((event,session)=>{
      if(event==='PASSWORD_RECOVERY')authMode='reset';
      applyWorkoutSession(session||null);
    });
  }catch(error){
    console.error('Workout auth initialization failed',error);
    toast('Account service could not start. Reload and try again.');
  }
}
function applyWorkoutSession(session){
  authReady=true;
  cloudHydrating=Boolean(session?.user);
  const previousUserId=store.account?.userId||'';
  if(session?.user){
    const user=session.user;
    store.account={
      ...(store.account||{}),
      userId:user.id||'',
      email:user.email||store.account?.email||'',
      displayName:user.user_metadata?.display_name||store.account?.displayName||store.profile?.displayName||'',
      authProvider:user.app_metadata?.provider||'email',
      status:'connected'
    };
  }else{
    store.account={...(store.account||{}),userId:'',authProvider:'',status:'local'};
  }
  sharedRuntime.syncMuted=true;
  saveStore();
  sharedRuntime.syncMuted=false;
  render();
  if(session?.user?.id){
    queueMicrotask(async()=>{try{await hydrateCloudState(session.user.id);await restoreSharedWorkoutSession(session.user.id);}catch(error){cloudHydrating=false;console.warn('Workout account restore failed',error);}});
  }else if(previousUserId){
    unsubscribeSharedSession();
  }
}
async function signInEntryAccount(){
  if(!workoutSupabase){toast('Account service is unavailable. Reload and try again.');return;}
  const email=(document.querySelector('#entry-email')?.value||'').trim().toLowerCase();
  const password=document.querySelector('#entry-password')?.value||'';
  if(!email||!password){toast('Enter your email and password.');return;}
  const {data,error}=await workoutSupabase.auth.signInWithPassword({email,password});
  if(error){toast(error.message||'Could not sign in.');return;}
  if(!data?.session){toast('Sign-in did not create a session. Try again.');return;}
  authMode='entry';
  if(!store.profile||!store.plan)currentTab='profile-edit';
  applyWorkoutSession(data.session);
  persistUiState();
  toast('Signed in.');
}
async function createConfirmedWorkoutAccount(email,password,display){
  const response=await fetch(WORKOUT_SUPABASE_URL+'/functions/v1/workout-signup',{
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':WORKOUT_SUPABASE_PUBLISHABLE_KEY},
    body:JSON.stringify({email,password,displayName:display})
  });
  let payload={};try{payload=await response.json();}catch{}
  if(!response.ok)throw new Error(payload.error||'Could not create the account.');
  const {data,error}=await workoutSupabase.auth.signInWithPassword({email,password});
  if(error||!data?.session)throw new Error(error?.message||'Account was created, but sign-in failed. Use Sign In to continue.');
  authMode='entry';
  if(!store.profile||!store.plan)currentTab='profile-edit';
  applyWorkoutSession(data.session);
  persistUiState();
  return data;
}
async function createEntryAccount(){
  if(!workoutSupabase){toast('Account service is unavailable. Reload and try again.');return;}
  const display=(document.querySelector('#entry-display-name')?.value||'').trim();
  const email=(document.querySelector('#entry-email')?.value||'').trim().toLowerCase();
  const password=document.querySelector('#entry-password')?.value||'';
  if(!display){toast('Enter your display name.');return;}
  if(!email||password.length<6){toast('Enter a valid email and a password with at least 6 characters.');return;}
  try{
    await createConfirmedWorkoutAccount(email,password,display);
    store.account={...(store.account||{}),email,displayName:display,status:'connected'};saveStore();
    toast('Workout account created and signed in.');
  }catch(error){toast(error.message||'Could not create the account.');}
}
function beginForgotPassword(){
  authMode='forgot';render();
}
function cancelForgotPassword(){
  authMode='entry';render();
}
async function sendWorkoutPasswordReset(){
  if(!workoutSupabase){toast('Account service is unavailable.');return;}
  const email=(document.querySelector('#forgot-email')?.value||'').trim().toLowerCase();
  if(!email){toast('Enter the email for your Workout account.');return;}
  const redirectTo=window.location.origin+window.location.pathname+'?recovery=1';
  const {error}=await workoutSupabase.auth.resetPasswordForEmail(email,{redirectTo});
  if(error){toast(error.message||'Could not send the reset email.');return;}
  store.account={...(store.account||{}),email};saveStore();
  toast('Password reset email sent. Check your inbox.');
}
async function saveRecoveredPassword(){
  if(!workoutSupabase){toast('Account service is unavailable.');return;}
  const password=document.querySelector('#reset-password')?.value||'';
  const confirm=document.querySelector('#reset-password-confirm')?.value||'';
  if(password.length<6){toast('Use a password with at least 6 characters.');return;}
  if(password!==confirm){toast('The passwords do not match.');return;}
  const {error}=await workoutSupabase.auth.updateUser({password});
  if(error){toast(error.message||'Could not update the password.');return;}
  authMode='entry';
  try{history.replaceState({},'',window.location.pathname);}catch{}
  toast('Password updated.');
  render();
}
async function signInWorkoutAccount(){
  if(!workoutSupabase){toast('Account service is not available in this build.');return;}
  const email=(document.querySelector('#account-email')?.value||'').trim().toLowerCase();
  const password=document.querySelector('#account-password')?.value||'';
  if(!email||!password){toast('Enter your email and password.');return;}
  const {data,error}=await workoutSupabase.auth.signInWithPassword({email,password});
  if(error){
    toast(error.message||'Could not sign in.');return;
  }
  if(!data?.session){toast('Sign-in did not create a browser session. Try again.');return;}
  accountSheetOpen=false;
  authMode='entry';
  if(!store.profile||!store.plan)currentTab='profile-edit';
  applyWorkoutSession(data.session);
  persistUiState();
  toast('Signed in.');
}
async function createOnboardingAccount(){
  if(!workoutSupabase){toast('Account service is not available.');return;}
  const email=(document.querySelector('#onboard-account-email')?.value||document.querySelector('[name="email"]')?.value||'').trim().toLowerCase();
  const password=document.querySelector('#onboard-account-password')?.value||'';
  const display=(document.querySelector('[name="displayName"]')?.value||'').trim();
  if(!display){toast('Enter your display name first.');return;}
  if(!email||password.length<6){toast('Enter a valid email and a password with at least 6 characters.');return;}
  try{await createConfirmedWorkoutAccount(email,password,display);toast('Account created. Finish your training setup.');render();}
  catch(error){toast(error.message||'Could not create the account.');}
}
async function createWorkoutAccount(){
  if(!workoutSupabase){toast('Account service is not available in this build.');return;}
  const email=(document.querySelector('#account-email')?.value||'').trim().toLowerCase();
  const password=document.querySelector('#account-password')?.value||'';
  const display=(store.profile?.displayName||store.account?.displayName||'Workout member').trim();
  if(!email||password.length<6){toast('Enter a valid email and a password with at least 6 characters.');return;}
  try{await createConfirmedWorkoutAccount(email,password,display);accountSheetOpen=false;persistUiState();toast('Account created and signed in.');render();}
  catch(error){toast(error.message||'Could not create the account.');}
}
async function signOutWorkoutAccount(){
  if(!workoutSupabase){toast('Account service is not available in this build.');return;}
  await unsubscribeSharedSession();
  const {error}=await workoutSupabase.auth.signOut({scope:'local'});
  if(error){toast(error.message||'Could not sign out.');return;}
  accountSheetOpen=false;
  persistUiState();
  toast('Signed out on this browser.');
  render();
}

function weeklyVolumeValue(){
  return weeklyHistory().reduce((sum,item)=>sum+(item.totalVolume||0),0);
}
function renderCompactWeek(schedule){
  const context=programContext();
  return '<div class="compact-week">'+TRAINING_DAYS.map(dayDef=>{
    const entry=schedule.find(item=>item.dayId===dayDef.id);
    const date=addDays(context.weekStart,dayOffsetFromMonday(dayDef.id));
    const status=entry?.status||'rest';
    const marker=status==='complete'?'✓':status==='partial'?'½':status==='missed'?'!':status==='today'?'TODAY':'';
    return '<button class="compact-day status-'+status+'" type="button" '+(entry&&!store.activeWorkout&&!['complete','skipped'].includes(status)?'data-start="'+esc(entry.day.id)+'" data-scheduled-date="'+esc(entry.dateKey)+'"':'')+'><span>'+esc(dayDef.label)+'</span><strong>'+date.getDate()+'</strong><em>'+marker+'</em></button>';
  }).join('')+'</div>';
}


function customExercises(){return ensureTrainingProgram().customExercises||[];}
function allExerciseCatalog(){return [...catalog,...customExercises()];}
function findExercise(id){return allExerciseCatalog().find(item=>item.id===id)||null;}
function normalizeExerciseName(value){
  return String(value||'').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,' ').trim();
}
const IMPORT_ALIASES={
  'bench press':'bench-press','barbell bench press':'bench-press','dumbbell bench press':'db-bench','db bench press':'db-bench',
  'incline dumbbell press':'db-bench','goblet squat':'goblet-squat','back squat':'back-squat','barbell squat':'back-squat',
  'romanian deadlift':'romanian-deadlift','rdl':'romanian-deadlift','dumbbell rdl':'db-rdl','db rdl':'db-rdl',
  'seated cable row':'cable-row','cable row':'cable-row','one arm dumbbell row':'one-arm-row','one arm row':'one-arm-row',
  'lat pulldown':'lat-pulldown','pull up':'pull-up','pullup':'pull-up','shoulder press':'db-shoulder-press',
  'dumbbell shoulder press':'db-shoulder-press','overhead press':'overhead-press','lateral raise':'lateral-raise',
  'dumbbell lateral raise':'lateral-raise','bicep curl':'biceps-curl','biceps curl':'biceps-curl','dumbbell curl':'biceps-curl',
  'tricep pushdown':'triceps-pushdown','triceps pushdown':'triceps-pushdown','leg press':'leg-press','leg curl':'leg-curl',
  'leg extension':'leg-extension','calf raise':'calf-raise','plank':'plank','dead bug':'dead-bug','hip thrust':'hip-thrust',
  'glute bridge':'glute-bridge','bulgarian split squat':'split-squat','reverse lunge':'reverse-lunge','step up':'step-up',
  'push up':'push-up','pushup':'push-up'
};
function guessMovementFromName(name){
  const n=normalizeExerciseName(name);
  if(/squat|leg press/.test(n))return 'squat';
  if(/deadlift|rdl|hip thrust|bridge/.test(n))return 'hinge';
  if(/lunge|split squat|step up/.test(n))return 'single-leg';
  if(/bench|chest press|push up|pushup/.test(n))return 'horizontal-push';
  if(/row/.test(n))return 'horizontal-pull';
  if(/pulldown|pull up|pullup/.test(n))return 'vertical-pull';
  if(/shoulder press|overhead press|pike/.test(n))return 'vertical-push';
  if(/lateral raise/.test(n))return 'shoulder-accessory';
  if(/curl/.test(n))return 'biceps';
  if(/tricep/.test(n))return 'triceps';
  if(/calf/.test(n))return 'calves';
  if(/plank|crunch|dead bug|core|ab/.test(n))return 'core';
  if(/leg curl|hamstring/.test(n))return 'hamstring-accessory';
  if(/leg extension|quad/.test(n))return 'quad-accessory';
  return 'custom';
}
function matchImportedExercise(name){
  const normalized=normalizeExerciseName(name);
  const aliasId=IMPORT_ALIASES[normalized];
  if(aliasId)return findExercise(aliasId);
  let exact=allExerciseCatalog().find(ex=>normalizeExerciseName(ex.name)===normalized);
  if(exact)return exact;
  const words=new Set(normalized.split(' ').filter(Boolean));
  let best=null,bestScore=0;
  for(const ex of allExerciseCatalog()){
    const candidate=normalizeExerciseName(ex.name).split(' ').filter(Boolean);
    const score=candidate.reduce((sum,word)=>sum+(words.has(word)?1:0),0)/Math.max(words.size,candidate.length,1);
    if(score>bestScore){best=ex;bestScore=score;}
  }
  return bestScore>=.67?best:null;
}
function customExerciseFromImport(name){
  const movement=guessMovementFromName(name);
  return {
    id:'custom-'+uid('ex').replace(/[^a-z0-9-]/gi,'').toLowerCase(),
    name:String(name||'Custom Exercise').trim(),
    movement,
    muscles:[movement==='custom'?'Custom':(movements[movement]||movement)],
    equipment:[store.profile?.equipment||'full-gym'],
    style:'custom',difficulty:'custom',loadMode:'dumbbell',increment:5,setup:25,custom:true
  };
}
function parseSetsReps(value){
  const text=String(value||'').trim();
  const match=text.match(/(\d+)\s*[x×]\s*(\d+(?:\s*[-–]\s*\d+)?)/i);
  if(match)return {sets:num(match[1])||3,reps:String(match[2]).replace(/\s+/g,'')};
  const reps=text.match(/(\d+(?:\s*[-–]\s*\d+)?)\s*(?:reps?)?/i);
  return {sets:3,reps:reps?String(reps[1]).replace(/\s+/g,''):'8–12'};
}
function importedExerciseRow(name,sets=3,reps='8–12',weight='',rest=45){
  const match=matchImportedExercise(name);
  const source=match||customExerciseFromImport(name);
  return {
    sourceId:match?.id||'',
    custom:!match,
    id:source.id,
    name:source.name,
    movement:source.movement,
    muscles:clone(source.muscles||[]),
    equipment:clone(source.equipment||[]),
    style:source.style||'custom',
    difficulty:source.difficulty||'custom',
    loadMode:source.loadMode||'dumbbell',
    increment:num(source.increment)||5,
    setup:num(source.setup)||25,
    sets:Math.max(1,num(sets)||3),
    reps:String(reps||'8–12'),
    startWeight:num(weight)||0,
    rest:Math.max(20,Math.min(180,num(rest)||45))
  };
}
function parseImportedPlanText(text){
  const raw=String(text||'').trim();
  if(!raw)return null;
  if(raw.startsWith('{')||raw.startsWith('[')){
    try{
      const parsed=JSON.parse(raw),days=Array.isArray(parsed)?parsed:(parsed.days||[]);
      if(days.length)return {name:parsed.name||'Imported Workout Plan',days:days.map((day,index)=>({
        name:day.name||'Day '+(index+1),focus:day.focus||'Imported training',
        exercises:(day.exercises||[]).map(ex=>importedExerciseRow(ex.name||ex.exercise,ex.sets,ex.reps,ex.weight||ex.startWeight,ex.rest))
      }))};
    }catch{}
  }
  const lines=raw.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  if(!lines.length)return null;
  const csvLike=lines.filter(line=>line.includes(',')).length>=Math.max(2,Math.floor(lines.length*.6));
  if(csvLike){
    const rows=lines.map(line=>line.split(',').map(cell=>cell.trim()));
    const header=rows[0].map(normalizeExerciseName);
    const hasHeader=header.some(cell=>['day','exercise','sets','reps','weight','rest'].includes(cell));
    const start=hasHeader?1:0;
    const col=name=>hasHeader?header.indexOf(name):-1;
    const dayMap=new Map();
    for(let i=start;i<rows.length;i++){
      const row=rows[i];if(!row.length)continue;
      const dayName=(col('day')>=0?row[col('day')]:row[0])||'Day 1';
      const exName=(col('exercise')>=0?row[col('exercise')]:row[hasHeader?0:1])||'';
      if(!exName)continue;
      const sets=col('sets')>=0?row[col('sets')]:row[2];
      const reps=col('reps')>=0?row[col('reps')]:row[3];
      const weight=col('weight')>=0?row[col('weight')]:row[4];
      const rest=col('rest')>=0?row[col('rest')]:row[5];
      if(!dayMap.has(dayName))dayMap.set(dayName,{name:dayName,focus:'Imported training',exercises:[]});
      dayMap.get(dayName).exercises.push(importedExerciseRow(exName,sets,reps,weight,rest));
    }
    if(dayMap.size)return {name:'Imported Workout Plan',days:[...dayMap.values()]};
  }
  const days=[];let current=null;
  const looksLikeDay=line=>/^(day\s*\d+|monday|tuesday|wednesday|thursday|friday|saturday|sunday|push|pull|legs|upper|lower|full body|workout\s*\d+)/i.test(line.replace(/[:\-]+$/,''));
  for(const line of lines){
    const clean=line.replace(/^[-•*]\s*/,'').trim();
    if(looksLikeDay(clean)&&!/(\d+\s*[x×]\s*\d+)/i.test(clean)){
      current={name:clean.replace(/[:\-]+$/,'').trim(),focus:'Imported training',exercises:[]};days.push(current);continue;
    }
    if(!current){current={name:'Day 1',focus:'Imported training',exercises:[]};days.push(current);}
    const match=clean.match(/^(.*?)\s*[-:·]?\s*(\d+)\s*[x×]\s*(\d+(?:\s*[-–]\s*\d+)?)(?:\s*(?:@|at)?\s*(\d+(?:\.\d+)?)\s*(?:lb|lbs)?)?/i);
    if(match){
      current.exercises.push(importedExerciseRow(match[1].trim(),match[2],match[3],match[4]||'',45));continue;
    }
    if(clean.length>2&&!/^(sets?|reps?|rest|notes?)[:\s]/i.test(clean)){
      const parsed=parseSetsReps(clean);
      const name=clean.replace(/\s+\d+\s*[x×]\s*\d+(?:\s*[-–]\s*\d+)?.*$/i,'').trim();
      if(name&&name!==clean)current.exercises.push(importedExerciseRow(name,parsed.sets,parsed.reps,'',45));
    }
  }
  const useful=days.filter(day=>day.exercises.length);
  return useful.length?{name:'Imported Workout Plan',days:useful}:null;
}
function importedPlanToNative(draft,strategy='follow'){
  const customToSave=[];
  const days=(draft.days||[]).map((day,index)=>{
    const exercises=(day.exercises||[]).map(row=>{
      let source=findExercise(row.sourceId||row.id);
      if(!source&&row.custom){
        source={...row,custom:true};
        if(!customExercises().some(ex=>normalizeExerciseName(ex.name)===normalizeExerciseName(source.name)))customToSave.push(source);
      }
      source=source||row;
      const settings={sets:row.sets,reps:row.reps,rest:row.rest,setSeconds:40};
      return {
        ...clone(source),
        sets:Math.max(1,num(settings.sets)||3),
        reps:String(settings.reps||'8–12'),
        rest:Math.max(20,Math.min(180,num(settings.rest)||45)),
        setup:num(source.setup)||25,
        startWeight:num(row.startWeight)||0,
        startLabel:num(row.startWeight)?String(num(row.startWeight))+' lb':'Choose a comfortable starting load',
        startSource:'imported plan',
        startReps:recommendedRepCount(row.reps),
        calibrationRequired:!num(row.startWeight)&&isWeightedMode(source.loadMode)
      };
    });
    const native={id:'imported-day-'+(index+1)+'-'+Date.now(),name:day.name||'Day '+(index+1),focus:day.focus||'Imported training',exercises,warmup:[],cooldown:[]};
    recalculatePlanDay(native);return native;
  }).filter(day=>day.exercises.length);
  const program=ensureTrainingProgram();
  for(const ex of customToSave)program.customExercises.push(ex);
  const plan={id:uid('plan'),createdAt:new Date().toISOString(),name:draft.name||'Imported Workout Plan',days,imported:true,importStrategy:strategy,importSource:draft.source||'paste'};
  program.importHistory.unshift({id:uid('import'),name:plan.name,source:plan.importSource,strategy,importedAt:new Date().toISOString(),dayCount:days.length});
  program.importHistory=program.importHistory.slice(0,20);
  return plan;
}
function applyImportedPlan(strategy='follow'){
  if(!planImportDraft?.days?.length){toast('Import a workout plan first.');return;}
  const previousPlan=store.plan;
  store.plan=importedPlanToNative(planImportDraft,strategy);
  if(store.plan.days.length>=2&&store.plan.days.length<=5){store.profile.days=store.plan.days.length;store.profile.workoutDays=defaultWorkoutDays(store.profile.days);}
  if(!store.plan.days.length){store.plan=previousPlan;toast('No usable workout days were found.');return;}
  planImportOpen=false;planImportDraft=null;saveStore();render();toast('Workout plan imported. Your existing history and PRs were preserved.');
}
function renderPlanImportModal(){
  if(!planImportOpen)return '';
  const draft=planImportDraft;
  const review=draft?.days?.length?'<div class="import-review">'+
    '<div class="import-review-head"><div><span>REVIEW BEFORE IMPORT</span><strong>'+esc(draft.name||'Imported Workout Plan')+'</strong></div><em>'+draft.days.length+' day'+(draft.days.length===1?'':'s')+'</em></div>'+
    draft.days.map((day,di)=>'<section class="import-day"><div><span>DAY '+(di+1)+'</span><input data-import-day-name="'+di+'" value="'+esc(day.name)+'" aria-label="Imported day name"></div><div class="import-exercises">'+day.exercises.map((ex,ei)=>'<article class="'+(ex.custom?'custom':'matched')+'"><div><input data-import-exercise-name="'+di+':'+ei+'" value="'+esc(ex.name)+'" aria-label="Exercise name"><small>'+(ex.custom?'CUSTOM EXERCISE · review match':'MATCHED · '+esc(findExercise(ex.sourceId)?.name||ex.name))+'</small></div><label>Sets<input data-import-field="sets" data-import-index="'+di+':'+ei+'" inputmode="numeric" value="'+esc(ex.sets)+'"></label><label>Reps<input data-import-field="reps" data-import-index="'+di+':'+ei+'" value="'+esc(ex.reps)+'"></label><label>Rest<input data-import-field="rest" data-import-index="'+di+':'+ei+'" inputmode="numeric" value="'+esc(ex.rest)+'"></label></article>').join('')+'</div></section>').join('')+
    '<div class="import-strategy"><p class="eyebrow">HOW SHOULD WORKOUT HANDLE IT?</p><button class="button primary-action" data-action="apply-imported-plan" data-import-strategy="follow">FOLLOW AS WRITTEN</button><button class="button secondary" data-action="apply-imported-plan" data-import-strategy="adapt">ADAPT IT FOR ME</button><button class="button secondary" data-action="apply-imported-plan" data-import-strategy="starting">USE AS A STARTING POINT</button><small>Follow as written preserves the imported structure. Adapt keeps the structure but allows readiness/progression changes. Starting point allows broader future program changes.</small></div>'+
  '</div>':'';
  return '<div class="exercise-modal-backdrop import-backdrop" data-action="close-plan-import"><section class="exercise-modal import-modal" data-plan-import-panel role="dialog" aria-modal="true">'+
    '<button class="modal-close" data-action="close-plan-import">×</button><div class="import-head"><p class="eyebrow">IMPORT WORKOUT PLAN</p><h2>Bring your program with you.</h2><p>Paste a plan or import TXT, CSV, or JSON. Nothing replaces your current program until you review and approve it.</p></div>'+
    '<label class="import-drop"><span>FILE</span><input id="plan-import-file" type="file" accept=".txt,.csv,.json,text/plain,text/csv,application/json"><strong>Choose TXT, CSV or JSON</strong><small>PDF, spreadsheet and photo extraction need the document-recognition service before they can be interpreted safely.</small></label>'+
    '<div class="import-or"><span>OR PASTE IT</span></div>'+
    '<textarea id="plan-import-text" class="import-textarea" rows="10" placeholder="Monday Push&#10;Bench Press 4x8&#10;Dumbbell Shoulder Press 3x10&#10;Triceps Pushdown 3x12"></textarea>'+
    '<button class="button secondary" data-action="parse-plan-import">REVIEW IMPORT</button>'+review+
  '</section></div>';
}
function renderCustomExerciseModal(){
  if(!customExerciseOpen)return '';
  return '<div class="exercise-modal-backdrop" data-action="close-custom-exercise"><section class="exercise-modal custom-exercise-modal" data-custom-exercise-panel role="dialog" aria-modal="true">'+
    '<button class="modal-close" data-action="close-custom-exercise">×</button><p class="eyebrow">CUSTOM EXERCISE</p><h2>Add a movement.</h2><div class="form-grid two">'+
    '<label class="field"><span>NAME</span><input id="custom-ex-name" placeholder="e.g. Landmine Press"></label>'+
    '<label class="field"><span>MOVEMENT</span><select id="custom-ex-movement">'+Object.entries({...movements,custom:'Custom / other'}).map(([value,label])=>'<option value="'+esc(value)+'">'+esc(label)+'</option>').join('')+'</select></label>'+
    '<label class="field"><span>PRIMARY MUSCLE</span><input id="custom-ex-muscle" placeholder="e.g. Shoulders"></label>'+
    '<label class="field"><span>EQUIPMENT</span><input id="custom-ex-equipment" placeholder="e.g. landmine"></label></div>'+
    '<button class="button primary-action" data-action="save-custom-exercise">SAVE EXERCISE</button></section></div>';
}
function saveCustomExercise(){
  const name=(document.querySelector('#custom-ex-name')?.value||'').trim();
  if(!name){toast('Enter an exercise name.');return;}
  const movement=document.querySelector('#custom-ex-movement')?.value||'custom';
  const muscle=(document.querySelector('#custom-ex-muscle')?.value||movements[movement]||'Custom').trim();
  const equipment=(document.querySelector('#custom-ex-equipment')?.value||store.profile?.equipment||'custom').trim();
  const ex={id:'custom-'+uid('ex').replace(/[^a-z0-9-]/gi,'').toLowerCase(),name,movement,muscles:[muscle],equipment:[equipment,store.profile?.equipment||'full-gym'],style:'custom',difficulty:'custom',loadMode:'dumbbell',increment:5,setup:25,custom:true};
  ensureTrainingProgram().customExercises.push(ex);customExerciseOpen=false;saveStore();render();toast(name+' added to your exercise library.');
}
function renderTrain(){
  const p=store.profile,plan=store.plan;if(!p||!plan)return renderProfileEditor();
  const schedule=currentWeekSchedule();
  const context=programContext();
  return '<div class="clean-page">'+
    '<div class="clean-page-head"><div><p class="eyebrow">TRAIN</p><h2>Your program.</h2><p>Start a scheduled session, import a program, review the rotation, or browse exercises without cluttering Home.</p></div><div class="train-head-actions"><button class="button secondary" data-action="open-plan-import">IMPORT PLAN</button><button class="button secondary" data-action="edit-profile">EDIT PLAN</button></div></div>'+
    (store.activeWorkout?'<button class="clean-resume-card" data-action="resume"><div><span>WORKOUT IN PROGRESS</span><strong>'+esc(store.activeWorkout.routineName)+'</strong></div><em>RESUME →</em></button>':'')+
    '<section class="clean-panel block-summary"><div><span>CURRENT BLOCK</span><strong>Block '+context.blockNumber+' · Week '+context.blockWeek+'</strong><small>'+esc(blockPhaseLabel(context.blockWeek))+'</small></div><button class="text-button" data-action="home">VIEW WEEK</button></section>'+
    '<section class="clean-section"><div class="clean-section-head"><div><p class="eyebrow">PROGRAM</p><h3>'+plan.days.length+'-day rotation</h3></div><button class="text-button" data-action="regenerate">Regenerate</button></div>'+
    '<div class="clean-routine-list">'+plan.days.map((day,index)=>{
      const scheduled=schedule.find(entry=>entry.day.id===day.id);
      const first=day.exercises[0];
      return '<article class="clean-routine-card"><div class="routine-card-main"><span class="routine-index">'+String(index+1).padStart(2,'0')+'</span><div><h3>'+esc(day.name)+'</h3><p>'+esc(day.focus)+'</p><small>'+day.exercises.length+' exercises · ~'+day.estimatedMinutes+' min'+(first?' · starts '+esc(first.name):'')+'</small></div></div>'+
        '<div class="routine-card-actions">'+(scheduled&&!store.activeWorkout?'<button class="button secondary" data-start="'+esc(day.id)+'" data-scheduled-date="'+esc(scheduled.dateKey)+'">'+(scheduled.status==='today'?'START TODAY':'PREPARE')+'</button>':'')+'<button class="text-button" data-action="catalog">LIBRARY</button></div></article>';
    }).join('')+'</div></section>'+
    '<section class="clean-panel train-library-card"><div><p class="eyebrow">EXERCISE LIBRARY</p><h3>'+allExerciseCatalog().length+' movements</h3><p>Verified demonstrations where available, custom movements, form cues, equipment requirements, muscle groups, and exercise history.</p></div><div class="train-library-actions"><button class="button secondary" data-action="catalog">BROWSE</button><button class="text-button" data-action="open-custom-exercise">+ CUSTOM</button></div></section>'+
  '</div>';
}
function sharedTrainingState(){
  store.sharedTraining=store.sharedTraining||{partners:[],draft:null,history:[]};
  store.sharedTraining.partners=Array.isArray(store.sharedTraining.partners)?store.sharedTraining.partners:[];
  store.sharedTraining.history=Array.isArray(store.sharedTraining.history)?store.sharedTraining.history:[];
  return store.sharedTraining;
}
function sharedJoinCode(){
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code='';
  for(let i=0;i<6;i++)code+=alphabet[Math.floor(Math.random()*alphabet.length)];
  return code;
}
function safeSharedPlanSnapshot(day){
  if(!day)return {};
  return {
    id:day.id||'shared-plan',
    name:day.name||'Shared workout',
    focus:day.focus||'Shared training',
    estimatedMinutes:num(day.estimatedMinutes)||num(store.profile?.minutes)||45,
    warmup:clone(day.warmup||[]),
    cooldown:clone(day.cooldown||[]),
    exercises:(day.exercises||[]).map(ex=>({
      id:ex.id,
      name:ex.name,
      movement:ex.movement,
      muscles:clone(ex.muscles||[]),
      loadMode:ex.loadMode,
      sets:num(ex.sets)||2,
      reps:ex.reps||'8–12',
      rest:Math.max(30,Math.min(60,num(ex.rest)||45)),
      setup:num(ex.setup)||25,
      increment:num(ex.increment)||5
    }))
  };
}
function localizeSharedPlan(snapshot){
  if(!snapshot?.exercises?.length)return null;
  const exercises=snapshot.exercises.map(sharedEx=>{
    const source=catalog.find(item=>item.id===sharedEx.id)||sharedEx;
    const adaptive=adaptivePrescription(source);
    const calibrated=store.calibration?.[sharedEx.id]?.weight;
    const estimated=catalog.find(item=>item.id===sharedEx.id)?estimateStartingLoad(source,store.profile||{}):{weight:0,label:'Choose a comfortable starting load',source:'shared plan',calibrate:true};
    const startWeight=adaptive?.weight??calibrated??estimated.weight??0;
    return {
      ...source,
      ...sharedEx,
      startWeight,
      startLabel:adaptive?.label||(startWeight?(sharedEx.loadMode==='dumbbell-pair'?startWeight+' lb each':startWeight+' lb'):(estimated.label||'Choose a comfortable starting load')),
      startSource:adaptive?'your learned progression':(calibrated?'your calibration':estimated.source||'shared plan'),
      startReps:adaptive?.reps||recommendedRepCount(sharedEx.reps),
      calibrationRequired:Boolean(estimated.calibrate&&!calibrated&&!adaptive)
    };
  });
  return {...snapshot,exercises,warmup:clone(snapshot.warmup||[]),cooldown:clone(snapshot.cooldown||[])};
}
function sharedDraftFromRow(row,role=''){
  const userId=store.account?.userId||'';
  const resolvedRole=role||(row.host_user_id===userId?'host':'partner');
  const partnerName=resolvedRole==='host'?(row.partner_name||'Workout partner'):(row.host_name||'Workout partner');
  return {
    id:row.id,
    backendId:row.id,
    createdAt:row.created_at||new Date().toISOString(),
    dayId:row.plan_day_id||row.plan_snapshot?.id||'shared-plan',
    scheduledDate:row.scheduled_date||dateKey(),
    routineName:row.routine_name||row.plan_snapshot?.name||'Shared workout',
    partnerId:resolvedRole==='host'?(row.partner_user_id||''):(row.host_user_id||''),
    partnerName,
    partnerContact:'',
    partnerStatus:row.partner_user_id?'joined':'invited',
    userStatus:'joined',
    mode:row.mode||'same-gym',
    pace:row.pace||'stay-together',
    setFlow:row.set_flow||'alternating',
    leadAudio:row.lead_audio_user_id===userId?'you':'partner',
    code:row.join_code||'',
    role:resolvedRole,
    sessionStatus:row.status||'lobby',
    planSnapshot:row.plan_snapshot||{},
    sharedPlan:row.shared_plan||{},
    remoteState:null
  };
}
function saveSharedBackendDraft(draft){
  const shared=sharedTrainingState();
  shared.draft=draft;
  sharedRuntime.syncMuted=true;
  saveStore();
  sharedRuntime.syncMuted=false;
}
async function fetchSharedSessionState(sessionId,{renderNow=true}={}){
  if(!workoutSupabase||!sessionId||store.account?.status!=='connected')return null;
  const [{data:session,error},{data:participants, error:participantError}]=await Promise.all([
    workoutSupabase.from('workout_shared_sessions').select('*').eq('id',sessionId).maybeSingle(),
    workoutSupabase.from('workout_shared_participant_state').select('session_id,user_id,display_name,ready,plan_confirmed,connection_state,exercise_index,set_index,phase,is_paused,updated_at').eq('session_id',sessionId)
  ]);
  if(error){console.warn('Shared session refresh failed',error);return null;}
  if(participantError)console.warn('Shared participant refresh failed',participantError);
  if(!session)return null;
  const shared=sharedTrainingState();
  let draft=shared.draft?.backendId===sessionId?shared.draft:sharedDraftFromRow(session);
  const ownId=store.account?.userId||'';
  const role=session.host_user_id===ownId?'host':'partner';
  const remote=(participants||[]).find(item=>item.user_id!==ownId)||null;
  const own=(participants||[]).find(item=>item.user_id===ownId)||null;
  draft={
    ...draft,
    ...sharedDraftFromRow(session,role),
    userStatus:own?.plan_confirmed?'confirmed':own?.ready?'ready':(draft.userStatus||'joined'),
    userConfirmed:Boolean(own?.plan_confirmed),
    partnerName:remote?.display_name||draft.partnerName||'Workout partner',
    partnerId:remote?.user_id||draft.partnerId||'',
    partnerStatus:remote?(remote.ready?'ready':'joined'):(session.partner_user_id?'joined':'invited'),
    remoteState:remote?{
      userId:remote.user_id,
      displayName:remote.display_name,
      ready:Boolean(remote.ready),
      planConfirmed:Boolean(remote.plan_confirmed),
      connectionState:remote.connection_state,
      exerciseIndex:num(remote.exercise_index),
      setIndex:num(remote.set_index),
      phase:remote.phase||'lobby',
      isPaused:Boolean(remote.is_paused),
      updatedAt:remote.updated_at
    }:draft.remoteState||null
  };
  saveSharedBackendDraft(draft);
  if(remote?.display_name){
    const existing=shared.partners.find(item=>item.userId===remote.user_id);
    if(!existing)shared.partners.push({id:uid('partner'),userId:remote.user_id,name:remote.display_name,contact:'',status:'connected'});
  }
  if(own?.plan_confirmed){draft.userStatus='confirmed';draft.userConfirmed=true;}
  else if(own?.ready)draft.userStatus='ready';

  if(remote?.ready&&own?.ready&&!draft.sharedPlan?.slots?.length){
    try{
      const plan=await tryBuildTogetherPlan(draft);
      if(plan?.slots?.length)draft.sharedPlan=plan;
    }catch(error){console.warn('Together plan build refresh failed',error);}
  }

  if(draft.sessionStatus==='active'&&draft.userConfirmed&&!store.activeWorkout){
    try{
      const {data:privateOwn}=await workoutSupabase.from('workout_shared_private_state').select('readiness').eq('session_id',sessionId).eq('user_id',ownId).maybeSingle();
      if(privateOwn?.readiness){
        await launchTogetherPlan(draft,privateOwn.readiness);
        return draft;
      }
    }catch(error){console.warn('Together active launch failed',error);}
  }
  if(renderNow&&currentTab==='together')render();
  return draft;
}
function stopSharedReconciliation(){
  if(sharedRuntime.reconcileTimer){clearInterval(sharedRuntime.reconcileTimer);sharedRuntime.reconcileTimer=null;}
  sharedRuntime.reconcileBusy=false;
}
function startSharedReconciliation(sessionId){
  stopSharedReconciliation();
  if(!sessionId)return;
  sharedRuntime.reconcileTimer=setInterval(async()=>{
    if(document.visibilityState==='hidden'||sharedRuntime.reconcileBusy||sharedRuntime.sessionId!==sessionId)return;
    sharedRuntime.reconcileBusy=true;
    try{await fetchSharedSessionState(sessionId,{renderNow:currentTab==='together'});}
    catch(error){console.warn('Together reconciliation failed',error);}
    finally{sharedRuntime.reconcileBusy=false;}
  },4000);
}
async function refreshTogetherFromSource(){
  const draft=sharedTrainingState().draft;
  if(!draft?.backendId||!workoutSupabase)return;
  try{await fetchSharedSessionState(draft.backendId,{renderNow:currentTab==='together'});}
  catch(error){console.warn('Together foreground refresh failed',error);}
}
async function unsubscribeSharedSession(){
  stopSharedReconciliation();
  if(sharedRuntime.syncTimer){clearTimeout(sharedRuntime.syncTimer);sharedRuntime.syncTimer=null;}
  const channel=sharedRuntime.channel;
  sharedRuntime.channel=null;
  sharedRuntime.sessionId='';
  sharedRuntime.lastPresenceSignature='';
  if(channel&&workoutSupabase){
    try{await channel.untrack();}catch{}
    try{await workoutSupabase.removeChannel(channel);}catch{}
  }
}
function updateSharedFromPresence(){
  const channel=sharedRuntime.channel;
  const draft=sharedTrainingState().draft;
  if(!channel||!draft)return;
  const state=channel.presenceState?.()||{};
  const entries=Object.values(state).flat().filter(Boolean);
  const ownId=store.account?.userId||'';
  const remote=entries.find(item=>item.userId&&item.userId!==ownId);
  const signature=JSON.stringify(remote||{});
  if(signature===sharedRuntime.lastPresenceSignature)return;
  sharedRuntime.lastPresenceSignature=signature;
  if(remote){
    draft.partnerName=remote.displayName||draft.partnerName||'Workout partner';
    draft.partnerId=remote.userId||draft.partnerId||'';
    draft.partnerStatus=remote.ready?'ready':'joined';
    draft.remoteState={...(draft.remoteState||{}),userId:remote.userId,displayName:remote.displayName||draft.partnerName,ready:Boolean(remote.ready),planConfirmed:Boolean(remote.planConfirmed),connectionState:'online'};
  }else if(draft.remoteState){
    draft.remoteState={...draft.remoteState,connectionState:'offline'};
  }
  saveSharedBackendDraft(draft);
  if(currentTab==='together')render();
  fetchSharedSessionState(draft.backendId,{renderNow:currentTab==='together'}).catch(error=>console.warn('Together presence reconcile failed',error));
}
async function subscribeSharedSession(draft){
  if(!workoutSupabase||!draft?.backendId||store.account?.status!=='connected')return;
  if(sharedRuntime.sessionId===draft.backendId&&sharedRuntime.channel)return;
  await unsubscribeSharedSession();
  try{await workoutSupabase.realtime.setAuth();}catch{}
  const channel=workoutSupabase.channel('workout:'+draft.backendId,{
    config:{
      private:true,
      presence:{key:store.account.userId},
      broadcast:{self:false}
    }
  });
  sharedRuntime.channel=channel;
  sharedRuntime.sessionId=draft.backendId;
  startSharedReconciliation(draft.backendId);
  channel
    .on('postgres_changes',{event:'*',schema:'public',table:'workout_shared_sessions',filter:'id=eq.'+draft.backendId},()=>fetchSharedSessionState(draft.backendId,{renderNow:currentTab==='together'}).catch(error=>console.warn('Together session change refresh failed',error)))
    .on('postgres_changes',{event:'*',schema:'public',table:'workout_shared_participant_state',filter:'session_id=eq.'+draft.backendId},()=>fetchSharedSessionState(draft.backendId,{renderNow:currentTab==='together'}).catch(error=>console.warn('Together participant change refresh failed',error)))
    .on('presence',{event:'sync'},()=>updateSharedFromPresence())
    .on('presence',{event:'join'},()=>updateSharedFromPresence())
    .on('presence',{event:'leave'},()=>updateSharedFromPresence())
    .on('broadcast',{event:'participant-state'},({payload})=>{
      if(!payload||payload.userId===store.account?.userId)return;
      const current=sharedTrainingState().draft;
      if(!current||current.backendId!==draft.backendId)return;
      current.partnerName=payload.displayName||current.partnerName;
      current.partnerId=payload.userId||current.partnerId;
      current.partnerStatus=payload.ready?'ready':'joined';
      current.remoteState={
        userId:payload.userId,
        displayName:payload.displayName||current.partnerName,
        ready:Boolean(payload.ready),
        planConfirmed:Boolean(payload.planConfirmed),
        connectionState:'online',
        exerciseIndex:num(payload.exerciseIndex),
        setIndex:num(payload.setIndex),
        phase:payload.phase||'lobby',
        isPaused:Boolean(payload.isPaused),
        updatedAt:payload.updatedAt||new Date().toISOString()
      };
      saveSharedBackendDraft(current);
      if(payload.ready||payload.planConfirmed){
        fetchSharedSessionState(current.backendId,{renderNow:true}).catch(error=>console.warn('Together participant refresh failed',error));
      }else if(currentTab==='together')render();
    })
    .on('broadcast',{event:'session-settings'},({payload})=>{
      const current=sharedTrainingState().draft;
      if(!current||current.backendId!==draft.backendId||!payload)return;
      current.mode=payload.mode||current.mode;
      current.pace=payload.pace||current.pace;
      current.setFlow=payload.setFlow||current.setFlow;
      saveSharedBackendDraft(current);
      if(currentTab==='together')render();
    })
    .on('broadcast',{event:'session-state'},({payload})=>{
      const current=sharedTrainingState().draft;
      if(!current||current.backendId!==draft.backendId||!payload)return;
      current.sessionStatus=payload.status||current.sessionStatus;
      if(payload.startedAt)current.startedAt=payload.startedAt;
      saveSharedBackendDraft(current);
      if(currentTab==='together')render();
      if(payload.status==='active'){
        toast('Both confirmed. Starting your Together workout.');
        fetchSharedSessionState(current.backendId,{renderNow:true}).catch(error=>console.warn('Together launch refresh failed',error));
      }
    })
    .subscribe(async status=>{
      if(status!=='SUBSCRIBED')return;
      try{
        await channel.track({
          userId:store.account.userId,
          displayName:displayName(),
          role:draft.role||'partner',
          ready:Boolean(['ready','confirmed','training'].includes(sharedTrainingState().draft?.userStatus)||store.activeWorkout?.sharedSession),
          planConfirmed:Boolean(sharedTrainingState().draft?.userConfirmed),
          onlineAt:new Date().toISOString()
        });
      }catch(error){console.warn('Shared presence track failed',error);}
      await fetchSharedSessionState(draft.backendId,{renderNow:true});
      scheduleSharedStateSync();
    });
}
function currentSharedCoordinationState(){
  const draft=sharedTrainingState().draft;
  if(!draft?.backendId||store.account?.status!=='connected')return null;
  const w=store.activeWorkout?.sharedSession?.backendId===draft.backendId?store.activeWorkout:null;
  return {
    sessionId:draft.backendId,
    userId:store.account.userId,
    displayName:displayName(),
    ready:Boolean(['ready','confirmed','training'].includes(draft.userStatus)||w),
    planConfirmed:Boolean(draft.userConfirmed),
    connectionState:'online',
    exerciseIndex:w?num(w.currentExerciseIndex):0,
    setIndex:w?num(w.currentSetIndex):0,
    phase:w?(w.phase||'workout'):(draft.userStatus||'lobby'),
    isPaused:Boolean(w?.isPaused),
    updatedAt:new Date().toISOString()
  };
}
function scheduleSharedStateSync(){
  if(sharedRuntime.syncMuted||store.account?.status!=='connected')return;
  const state=currentSharedCoordinationState();
  if(!state)return;
  if(sharedRuntime.syncTimer)clearTimeout(sharedRuntime.syncTimer);
  sharedRuntime.syncTimer=setTimeout(()=>syncSharedParticipantState().catch(error=>console.warn('Shared state sync failed',error)),140);
}
async function syncSharedParticipantState(){
  sharedRuntime.syncTimer=null;
  if(!workoutSupabase)return;
  const state=currentSharedCoordinationState();
  if(!state)return;
  const {error}=await workoutSupabase
    .from('workout_shared_participant_state')
    .update({
      display_name:state.displayName,
      ready:state.ready,
      plan_confirmed:state.planConfirmed,
      connection_state:state.connectionState,
      exercise_index:state.exerciseIndex,
      set_index:state.setIndex,
      phase:state.phase,
      is_paused:state.isPaused,
      updated_at:state.updatedAt
    })
    .eq('session_id',state.sessionId)
    .eq('user_id',state.userId);
  if(error){console.warn('Participant state update failed',error);return;}
  try{
    await sharedRuntime.channel?.send({
      type:'broadcast',
      event:'participant-state',
      payload:state
    });
  }catch{}
}
async function restoreSharedWorkoutSession(userId=store.account?.userId||''){
  if(!workoutSupabase||!userId||store.account?.status!=='connected')return;
  if(sharedRuntime.restoreUserId===userId&&sharedRuntime.channel)return;
  sharedRuntime.restoreUserId=userId;
  const existing=sharedTrainingState().draft;
  if(existing?.backendId){
    const refreshed=await fetchSharedSessionState(existing.backendId,{renderNow:false});
    if(refreshed&&['lobby','review','active'].includes(refreshed.sessionStatus)){
      await subscribeSharedSession(refreshed);
      return;
    }
    sharedTrainingState().draft=null;
    sharedRuntime.syncMuted=true;
    saveStore();
    sharedRuntime.syncMuted=false;
  }
  const {data,error}=await workoutSupabase
    .from('workout_shared_sessions')
    .select('*')
    .in('status',['lobby','review','active'])
    .gt('expires_at',new Date().toISOString())
    .order('created_at',{ascending:false})
    .limit(1);
  if(error){console.warn('Shared session restore query failed',error);return;}
  const row=data?.[0];
  if(!row)return;
  const draft=sharedDraftFromRow(row);
  saveSharedBackendDraft(draft);
  await subscribeSharedSession(draft);
  if(currentTab==='together')render();
}
async function cancelSharedDraft(){
  const shared=sharedTrainingState();
  const draft=shared.draft;
  if(draft?.backendId&&workoutSupabase&&store.account?.status==='connected'){
    const {error}=await workoutSupabase.rpc('leave_workout_shared_session',{p_session_id:draft.backendId});
    if(error)console.warn('Shared session leave failed',error);
  }
  shared.draft=null;
  sharedRuntime.syncMuted=true;
  saveStore();
  sharedRuntime.syncMuted=false;
  await unsubscribeSharedSession();
  render();
}
async function startSharedWorkout(){
  const draft=sharedTrainingState().draft;if(!draft)return;
  if(!draft.partnerId){toast('Your workout partner has not joined yet.');return;}
  if(['ready','confirmed','training'].includes(draft.userStatus)){toast(draft.userStatus==='confirmed'?'Your plan is confirmed. Waiting for your partner.':'Your check-in is already complete.');return;}
  let day=sharedDraftDay(draft);
  if(!day){toast('Your planned workout could not be loaded.');return;}
  openReadiness(day.id,draft.scheduledDate);
  if(readinessContext){readinessContext.sharedDraft=clone(draft);readinessContext.day=day;}
  render();
}
function localTogetherDay(prescription){
  if(!prescription?.exercises?.length)return null;
  const day={
    id:prescription.id||'together-'+(sharedTrainingState().draft?.backendId||dateKey()),
    name:prescription.name||'Together Workout',
    focus:prescription.focus||'Compatible shared training',
    estimatedMinutes:num(prescription.estimatedMinutes)||num(store.profile?.minutes)||45,
    warmup:clone(prescription.warmup||[]),
    cooldown:clone(prescription.cooldown||[]),
    exercises:clone(prescription.exercises||[])
  };
  recalculatePlanDay(day);
  return localizeSharedPlan(safeSharedPlanSnapshot(day));
}
async function tryBuildTogetherPlan(draft){
  if(!draft?.backendId||!workoutSupabase)return null;
  const {data,error}=await workoutSupabase.rpc('build_workout_shared_plan',{p_session_id:draft.backendId});
  if(error){
    if(/Both check-ins|Waiting for partner/i.test(error.message||''))return null;
    toast(error.message||'Could not build the Together workout.');return null;
  }
  draft.sharedPlan=data||{};draft.sessionStatus='review';draft.userConfirmed=false;if(draft.userStatus!=='confirmed')draft.userStatus='ready';saveSharedBackendDraft(draft);
  return data||null;
}
async function launchTogetherPlan(draft,readiness){
  if(!draft?.backendId||!workoutSupabase)return false;
  const {data:prescription,error}=await workoutSupabase.rpc('get_workout_shared_prescription',{p_session_id:draft.backendId});
  if(error){toast(error.message||'Could not load your private Together prescription.');return false;}
  const localized=localTogetherDay(prescription);
  if(!localized?.exercises?.length){toast('Your Together prescription could not be loaded.');return false;}
  const finalReadiness=readiness||prescription?.readiness||{};
  const adjusted=applyReadinessToDay(localized,finalReadiness);
  const context=programContext(dateFromKey(draft.scheduledDate||dateKey()));
  unlockWorkoutCues();
  store.activeWorkout=createWorkout(adjusted,{
    scheduledDate:draft.scheduledDate||dateKey(),
    readiness:finalReadiness,
    programContext:context,
    adaptationNotes:[...(adjusted.adaptationNotes||[]),...(adjusted.readinessNotes||[])]
  });
  store.activeWorkout.sharedSession={
    backendId:draft.backendId,
    partnerId:draft.partnerId,
    partnerName:draft.partnerName,
    mode:draft.mode,
    pace:draft.pace,
    setFlow:draft.setFlow,
    role:draft.role
  };
  saveStore();
  currentTab='workout';
  render();
  const live=sharedTrainingState().draft;
  if(live){live.userStatus='training';live.sessionStatus='active';saveSharedBackendDraft(live);}
  scheduleSharedStateSync();
  return true;
}
async function saveTogetherSettings({silent=false}={}){
  const draft=sharedTrainingState().draft;
  if(!draft?.backendId||draft.role!=='host'||!workoutSupabase)return;
  const mode=document.querySelector('#together-mode')?.value||draft.mode||'same-gym';
  const pace=document.querySelector('#together-pace')?.value||draft.pace||'stay-together';
  const setFlow=document.querySelector('#together-set-flow')?.value||draft.setFlow||'alternating';
  const {error}=await workoutSupabase.from('workout_shared_sessions').update({
    mode,pace,set_flow:setFlow,updated_at:new Date().toISOString()
  }).eq('id',draft.backendId);
  if(error){toast(error.message||'Could not update Together settings.');return;}
  draft.mode=mode;draft.pace=pace;draft.setFlow=setFlow;saveSharedBackendDraft(draft);
  try{await sharedRuntime.channel?.send({type:'broadcast',event:'session-settings',payload:{mode,pace,setFlow}});}catch{}
  if(!silent)toast('Together settings updated.');
  render();
}
async function confirmTogetherPlan(){
  const draft=sharedTrainingState().draft;
  if(!draft?.backendId||!draft.sharedPlan?.slots?.length||!workoutSupabase)return;
  if(draft.role==='host')await saveTogetherSettings({silent:true});
  const {data,error}=await workoutSupabase.rpc('confirm_workout_shared_plan',{p_session_id:draft.backendId});
  if(error){toast(error.message||'Could not confirm the Together plan.');return;}
  draft.userConfirmed=true;draft.userStatus='confirmed';
  if(data?.status)draft.sessionStatus=data.status;
  if(data?.startedAt)draft.startedAt=data.startedAt;
  saveSharedBackendDraft(draft);
  try{
    await sharedRuntime.channel?.send({
      type:'broadcast',event:'participant-state',
      payload:{...currentSharedCoordinationState(),ready:true,planConfirmed:true,phase:'confirmed'}
    });
    if(data?.bothConfirmed){
      await sharedRuntime.channel?.send({
        type:'broadcast',event:'session-state',
        payload:{status:'active',startedAt:data.startedAt||new Date().toISOString()}
      });
    }
  }catch{}
  if(data?.bothConfirmed){
    toast('Both confirmed. Starting Together.');
    await fetchSharedSessionState(draft.backendId,{renderNow:true});
  }else{
    toast('Plan confirmed. Waiting for your partner.');
    render();
  }
}
function copySharedCode(){
  const code=sharedTrainingState().draft?.code;if(!code)return;
  if(navigator?.clipboard?.writeText){
    navigator.clipboard.writeText(code).then(()=>toast('Join code copied.')).catch(()=>toast('Join code: '+code));
  }else toast('Join code: '+code);
}
async function createSharedDraft(){
  if(store.account?.status!=='connected'){accountSheetOpen=true;render();toast('Sign in before creating a Together workout.');return;}
  if(!workoutSupabase){toast('Together service is unavailable.');return;}
  const next=nextScheduledSession();
  if(!next){toast('You need a scheduled workout before creating Together.');return;}
  const shared=sharedTrainingState();
  const day=next.adaptedDay||next.day;
  const snapshot=safeSharedPlanSnapshot(day);
  let created=null,lastError=null;
  for(let attempt=0;attempt<4&&!created;attempt++){
    const code=sharedJoinCode();
    const {data,error}=await workoutSupabase.from('workout_shared_sessions').insert({
      join_code:code,
      host_user_id:store.account.userId,
      host_name:displayName(),
      routine_name:'Together Workout',
      scheduled_date:next.dateKey,
      plan_day_id:null,
      plan_snapshot:{},
      mode:'same-gym',
      pace:'stay-together',
      set_flow:'alternating',
      lead_audio_user_id:store.account.userId,
      status:'lobby'
    }).select('*').single();
    if(error){lastError=error;continue;}
    created=data;
  }
  if(!created){toast(lastError?.message||'Could not create the Together lobby.');return;}
  const {error:participantError}=await workoutSupabase.from('workout_shared_participant_state').insert({
    session_id:created.id,user_id:store.account.userId,display_name:displayName(),ready:false,plan_confirmed:false,connection_state:'online',phase:'planning'
  });
  if(participantError){toast(participantError.message||'Could not open the lobby.');return;}
  const {error:privateError}=await workoutSupabase.from('workout_shared_private_state').upsert({
    session_id:created.id,user_id:store.account.userId,
    planning_profile:{goal:store.profile?.goal,goals:store.profile?.goals||[],experience:store.profile?.experience,equipment:store.profile?.equipment,style:store.profile?.style,minutes:store.profile?.minutes,priorities:store.profile?.priorities||[],avoid:store.profile?.avoid||[],preferAvoid:store.profile?.preferAvoid||[],customAvoid:store.profile?.customAvoid||[],cautionAreas:store.profile?.cautionAreas||[],formatAvoid:store.profile?.formatAvoid||[],day_name:day.name,day_focus:day.focus},
    planned_day:snapshot,updated_at:new Date().toISOString()
  });
  if(privateError){toast(privateError.message||'Could not save your private Together profile.');return;}
  const draft={...sharedDraftFromRow(created,'host'),partnerName:'Workout partner',partnerStatus:'invited',userStatus:'joined',userConfirmed:false,planSnapshot:snapshot};
  saveSharedBackendDraft(draft);
  await subscribeSharedSession(draft);
  toast('Lobby created. Share the code with your workout partner.');
  render();
}
async function joinSharedSession(){
  if(store.account?.status!=='connected'){accountSheetOpen=true;render();toast('Sign in before joining a shared workout.');return;}
  if(!workoutSupabase){toast('Shared workout service is unavailable.');return;}
  const code=(document.querySelector('#shared-join-code')?.value||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(code.length!==6){toast('Enter the 6-character join code.');return;}
  const {data,error}=await workoutSupabase.rpc('join_workout_shared_session',{p_join_code:code,p_display_name:displayName()});
  if(error){toast(error.message?.includes('unavailable')?'That shared workout is unavailable or already full.':(error.message||'Could not join the shared workout.'));return;}
  const row=Array.isArray(data)?data[0]:data;
  if(!row){toast('Could not load that shared workout.');return;}
  const draft=sharedDraftFromRow(row,'partner');
  draft.partnerStatus='joined';draft.userStatus='joined';draft.userConfirmed=false;
  const next=nextScheduledSession();
  const day=next?.adaptedDay||next?.day||store.plan?.days?.[0];
  if(!day){toast('Build your training plan before joining Together.');return;}
  const snapshot=safeSharedPlanSnapshot(day);
  const {error:privateError}=await workoutSupabase.from('workout_shared_private_state').upsert({
    session_id:draft.backendId,user_id:store.account.userId,
    planning_profile:{goal:store.profile?.goal,goals:store.profile?.goals||[],experience:store.profile?.experience,equipment:store.profile?.equipment,style:store.profile?.style,minutes:store.profile?.minutes,priorities:store.profile?.priorities||[],avoid:store.profile?.avoid||[],preferAvoid:store.profile?.preferAvoid||[],customAvoid:store.profile?.customAvoid||[],cautionAreas:store.profile?.cautionAreas||[],formatAvoid:store.profile?.formatAvoid||[],day_name:day.name,day_focus:day.focus},
    planned_day:snapshot,updated_at:new Date().toISOString()
  });
  if(privateError){toast(privateError.message||'Could not save your private Together profile.');return;}
  saveSharedBackendDraft(draft);
  await subscribeSharedSession(draft);
  toast('Joined Together. Complete your check-in when ready.');
  render();
}
function sharedDraftDay(draft){
  if(!draft)return null;
  if(draft.role==='partner'&&draft.planSnapshot?.exercises?.length)return localizeSharedPlan(draft.planSnapshot);
  const entry=scheduledEntryFor(draft.dayId,draft.scheduledDate);
  return entry?.adaptedDay||store.plan?.days?.find(day=>day.id===draft.dayId)||localizeSharedPlan(draft.planSnapshot)||null;
}
async function activateSharedWorkout(draft){
  if(!draft?.backendId||!workoutSupabase)return;
  const shared=sharedTrainingState();
  if(shared.draft?.backendId===draft.backendId){
    shared.draft.userStatus='training';
    saveSharedBackendDraft(shared.draft);
  }
  const startedAt=new Date().toISOString();
  if(draft.role==='host'){
    const {error}=await workoutSupabase.from('workout_shared_sessions').update({
      status:'active',started_at:startedAt,updated_at:startedAt
    }).eq('id',draft.backendId);
    if(!error){
      if(shared.draft?.backendId===draft.backendId){
        shared.draft.sessionStatus='active';shared.draft.startedAt=startedAt;saveSharedBackendDraft(shared.draft);
      }
      try{await sharedRuntime.channel?.send({type:'broadcast',event:'session-state',payload:{status:'active',startedAt}});}catch{}
    }
  }
  scheduleSharedStateSync();
}
async function completeSharedParticipant(sharedSession,completionStatus){
  if(!sharedSession?.backendId||!workoutSupabase||store.account?.status!=='connected')return;
  const now=new Date().toISOString();
  await workoutSupabase.from('workout_shared_participant_state').update({
    ready:false,
    phase:'complete',
    is_paused:false,
    updated_at:now
  }).eq('session_id',sharedSession.backendId).eq('user_id',store.account.userId);
  try{
    await sharedRuntime.channel?.send({
      type:'broadcast',
      event:'participant-state',
      payload:{userId:store.account.userId,displayName:displayName(),ready:false,connectionState:'online',exerciseIndex:999,setIndex:999,phase:'complete',isPaused:false,updatedAt:now}
    });
  }catch{}
  if(sharedSession.role==='host'){
    await workoutSupabase.from('workout_shared_sessions').update({
      status:'completed',
      completed_at:now,
      updated_at:now
    }).eq('id',sharedSession.backendId);
    try{await sharedRuntime.channel?.send({type:'broadcast',event:'session-state',payload:{status:'completed',completedAt:now,completionStatus}});}catch{}
  }
  setTimeout(()=>unsubscribeSharedSession(),500);
}
function sharedRemotePositionLabel(draft=sharedTrainingState().draft){
  const remote=draft?.remoteState;
  if(!remote)return draft?.partnerStatus==='ready'?'Partner ready':'Waiting for partner';
  if(remote.connectionState==='offline')return 'Partner reconnecting';
  if(remote.phase==='complete')return 'Partner finished';
  if(remote.isPaused)return 'Partner paused';
  if(remote.phase==='lobby')return 'Partner ready';
  const day=sharedDraftDay(draft);
  const ex=day?.exercises?.[remote.exerciseIndex];
  if(!ex)return 'Partner connected';
  return ex.name+' · Set '+(num(remote.setIndex)+1);
}
function renderSharedMatches(draft){
  const slots=draft?.sharedPlan?.slots||[];
  if(!slots.length)return '';
  const isHost=draft.role==='host';
  return '<div class="shared-match-list">'+slots.map((slot,index)=>{
    const ownName=isHost?slot.hostExerciseName:slot.partnerExerciseName;
    const partnerName=isHost?slot.partnerExerciseName:slot.hostExerciseName;
    return '<article class="shared-match-row"><span>'+String(index+1).padStart(2,'0')+'</span><div><strong>'+esc(ownName||movements[slot.movement]||slot.movement)+'</strong><small>'+esc(movements[slot.movement]||slot.movement)+' · Partner: '+esc(partnerName||'matched variation')+'</small></div><em>SHARED</em></article>';
  }).join('')+'</div>';
}
function renderTogether(){
  if(!store.profile||!store.plan)return renderProfileEditor();
  if(store.account?.status!=='connected'){
    return '<div class="clean-page together-page together-v2"><section class="together-v2-intro"><div class="together-v2-mark">◎</div><p class="eyebrow">TOGETHER</p><h2>One workout. Built for both of you.</h2><p>Sign in so both people can keep their own plan, readiness, weights and progression while training in sync.</p><button class="button primary-action" data-action="account-info">SIGN IN / CREATE ACCOUNT</button></section></div>';
  }

  const shared=sharedTrainingState(),draft=shared.draft,next=nextScheduledSession();

  if(!draft){
    return '<div class="clean-page together-page together-v2">'+
      '<section class="together-v2-intro"><div class="together-v2-mark">◎</div><p class="eyebrow">TOGETHER</p><h2>Train together. Built for both of you.</h2><p>Create a lobby or join one. We wait until both people are connected and checked in before building the workout.</p></section>'+
      '<section class="together-choice-grid">'+
        '<article class="together-choice-card create"><span class="together-choice-number">01</span><div><p class="eyebrow">START A SESSION</p><h3>Create a workout</h3><p>Open a private lobby and get a 6-character code to share.</p></div><button class="button primary-action" data-action="create-shared-draft" '+(!next?'disabled':'')+'>CREATE WORKOUT</button></article>'+
        '<article class="together-choice-card join"><span class="together-choice-number">02</span><div><p class="eyebrow">HAVE A CODE?</p><h3>Join a workout</h3><p>Enter the code from your workout partner.</p></div><div class="together-code-row"><input id="shared-join-code" inputmode="text" maxlength="6" autocomplete="off" autocapitalize="characters" placeholder="ABC234"><button class="button secondary" data-action="join-shared-session">JOIN</button></div></article>'+
      '</section>'+
      (next?'<section class="together-source-strip"><div><span>YOUR NEXT TRAINING</span><strong>'+esc(next.adaptedDay?.name||next.day?.name||'Workout')+'</strong></div><small>'+esc(next.dayName)+' · '+esc(formatDate(next.dateKey))+' · ~'+esc(next.adaptedDay?.estimatedMinutes||store.profile.minutes)+' min</small></section>':'<section class="prototype-note"><strong>No workout scheduled.</strong><span>Build or schedule your individual program first. Together uses both people’s real training plans as its starting point.</span></section>')+
      '<section class="together-privacy-line"><span>PRIVATE BY DEFAULT</span><p>Your raw readiness, body data, weights, reps, notes, PRs and history are never shown to your partner.</p></section>'+
    '</div>';
  }

  const role=draft.role||'host';
  const connected=Boolean(draft.partnerId);
  const userReady=['ready','confirmed','training'].includes(draft.userStatus);
  const partnerReady=Boolean(draft.remoteState?.ready)||draft.partnerStatus==='ready';
  const userConfirmed=Boolean(draft.userConfirmed);
  const partnerConfirmed=Boolean(draft.remoteState?.planConfirmed);
  const hasPlan=Boolean(draft.sharedPlan?.slots?.length);
  const remoteOnline=draft.remoteState?.connectionState!=='offline'&&Boolean(draft.remoteState);
  const stage=draft.sessionStatus==='active'?'starting':hasPlan?'review':userReady&&partnerReady?'building':connected?'checkin':'connect';
  const stageCopy={
    connect:'Share your code to connect your workout partner.',
    checkin:'Both connected. Each person completes a private Quick Check-In.',
    building:'Both check-ins are complete. Building your compatible workout.',
    review:'Your compatible workout is ready. Review it, then both confirm.',
    starting:'Both confirmed. Starting your Together workout.'
  }[stage];

  return '<div class="clean-page together-page together-v2">'+
    '<section class="together-lobby-top"><div><p class="eyebrow">TOGETHER LOBBY</p><h2>'+esc(stageCopy)+'</h2></div><button class="text-button danger-text" data-action="cancel-shared-draft">'+(role==='host'?'CANCEL':'LEAVE')+'</button></section>'+
    (role==='host'?'<section class="together-code-hero"><div><span>JOIN CODE</span><strong>'+esc(draft.code)+'</strong><small>Share this code with one workout partner.</small></div><button class="button secondary" data-action="copy-shared-code">COPY CODE</button></section>':'')+
    '<section class="together-stage-track">'+
      '<div class="'+(connected?'done':'active')+'"><span>1</span><strong>Connect</strong></div>'+
      '<i></i><div class="'+(userReady&&partnerReady?'done':connected?'active':'')+'"><span>2</span><strong>Check in</strong></div>'+
      '<i></i><div class="'+(hasPlan?'done':userReady&&partnerReady?'active':'')+'"><span>3</span><strong>Build</strong></div>'+
      '<i></i><div class="'+(userConfirmed&&partnerConfirmed?'done':hasPlan?'active':'')+'"><span>4</span><strong>Confirm</strong></div>'+
    '</section>'+
    '<section class="together-people">'+
      '<article class="together-person '+(userReady?'complete':'')+'"><div class="participant-avatar">'+esc((displayName()[0]||'Y').toUpperCase())+'</div><div><span>YOU</span><strong>'+esc(displayName())+'</strong><small>'+(!connected?'Connected':userConfirmed?'Plan confirmed':userReady?'Check-in complete':'Check-in needed')+'</small></div><em>'+(userConfirmed?'✓':userReady?'✓':connected?'YOUR TURN':'●')+'</em></article>'+
      '<article class="together-person '+(partnerReady?'complete':'')+'"><div class="participant-avatar">'+esc((draft.partnerName?.[0]||'P').toUpperCase())+'</div><div><span>PARTNER</span><strong>'+esc(connected?draft.partnerName:'Waiting for partner')+'</strong><small>'+(!connected?'Not connected':partnerConfirmed?'Plan confirmed':partnerReady?'Check-in complete':remoteOnline?'Connected · check-in needed':'Connected')+'</small></div><em>'+(partnerConfirmed?'✓':partnerReady?'✓':connected?'…':'○')+'</em></article>'+
    '</section>'+

    (!connected?'<section class="together-wait-card"><div class="together-wait-pulse"></div><div><span>WAITING FOR PARTNER</span><strong>They join with your 6-character code.</strong><p>No workout is generated until both profiles are here.</p></div></section>':'')+

    (connected&&!userReady?'<section class="together-next-action"><div><p class="eyebrow">YOUR TURN</p><h3>Quick Check-In</h3><p>Energy, soreness, sleep and available time stay private. They help shape only your side of the shared workout.</p></div><button class="button primary-action" data-action="start-shared-workout">START MY CHECK-IN</button></section>':'')+

    (connected&&userReady&&!partnerReady?'<section class="together-wait-card"><div class="together-wait-pulse"></div><div><span>YOUR CHECK-IN IS DONE</span><strong>Waiting for '+esc(draft.partnerName)+'.</strong><p>We’ll build the workout as soon as their private check-in is complete.</p></div></section>':'')+

    (connected&&userReady&&partnerReady&&!hasPlan?'<section class="together-building-card"><div class="together-building-orbit">◎</div><div><span>BUILDING TOGETHER</span><strong>Finding the overlap without flattening either plan.</strong><p>Matching movement patterns, equipment, session time and today’s readiness.</p></div></section>':'')+

    (hasPlan?'<section class="together-plan-card"><div class="clean-section-head"><div><p class="eyebrow">YOUR TOGETHER PLAN</p><h3>'+draft.sharedPlan.slots.length+' shared movement stations · ~'+esc(draft.sharedPlan.minutes||store.profile.minutes)+' min</h3><p>Same structure, individualized exercise prescriptions.</p></div></div>'+renderSharedMatches(draft)+'</section>':'')+

    (hasPlan?'<section class="together-session-style"><div><p class="eyebrow">SESSION STYLE</p><h3>How do you want to move through it?</h3></div>'+
      (role==='host'&&!userConfirmed?'<div class="together-style-grid"><label><span>LOCATION</span><select id="together-mode"><option value="same-gym" '+(draft.mode==='same-gym'?'selected':'')+'>Same Gym</option><option value="remote" '+(draft.mode==='remote'?'selected':'')+'>Remote Together</option></select></label><label><span>PACE</span><select id="together-pace"><option value="stay-together" '+(draft.pace==='stay-together'?'selected':'')+'>Stay Together</option><option value="flexible" '+(draft.pace==='flexible'?'selected':'')+'>Flexible Pace</option></select></label><label><span>SETS</span><select id="together-set-flow"><option value="alternating" '+(draft.setFlow==='alternating'?'selected':'')+'>Alternating Sets</option><option value="parallel" '+(draft.setFlow==='parallel'?'selected':'')+'>Parallel Sets</option></select></label></div><button class="text-button" data-action="save-together-settings">SAVE SESSION STYLE</button>':'<div class="together-style-summary"><span>'+esc(draft.mode==='remote'?'Remote Together':'Same Gym')+'</span><span>'+esc(draft.pace==='flexible'?'Flexible Pace':'Stay Together')+'</span><span>'+esc(draft.setFlow==='parallel'?'Parallel Sets':'Alternating Sets')+'</span></div>')+
    '</section>':'')+

    (hasPlan?'<section class="together-confirm-card"><div><span>'+((userConfirmed&&partnerConfirmed)?'BOTH CONFIRMED':userConfirmed?'YOU’RE CONFIRMED':partnerConfirmed?'PARTNER CONFIRMED':'READY WHEN YOU ARE')+'</span><strong>'+((userConfirmed&&partnerConfirmed)?'Starting Together…':userConfirmed?'Waiting for '+esc(draft.partnerName):'Review your matched workout, then lock it in.')+'</strong></div>'+
      (!userConfirmed?'<button class="button primary-action" data-action="confirm-together-plan">CONFIRM MY PLAN</button>':'<button class="button secondary" disabled>CONFIRMED ✓</button>')+
    '</section>':'')+
    (draft.sessionStatus==='active'?'<section class="together-building-card"><div class="together-building-orbit">✓</div><div><span>STARTING TOGETHER</span><strong>Both plans are locked in.</strong><p>Each phone is loading its own weights, reps, warm-up and readiness adjustments now.</p></div></section>':'')+

    '<section class="together-privacy-line"><span>WHAT YOUR PARTNER CAN SEE</span><p>Connection, check-in completion, shared movement stations and live workout position. Your private performance data stays yours.</p></section>'+
  '</div>';
}
function renderProfileHub(){
  const p=store.profile;if(!p)return renderProfileEditor();
  const context=programContext(),shared=sharedTrainingState();
  const name=displayName()==='there'?'Your profile':displayName();
  return '<div class="clean-page profile-hub"><section class="profile-identity"><div class="profile-avatar-large">'+esc((name[0]||'Y').toUpperCase())+'</div><div><p class="eyebrow">TRAINING PROFILE</p><h2>'+esc(name)+'</h2><p>'+esc(planGoalLabel(p.goal))+' · '+p.days+' days/week · '+esc(equipmentLabel(p.equipment))+'</p></div></section>'+
    '<div class="profile-stat-grid"><div><strong>'+store.history.length+'</strong><span>Workouts</span></div><div><strong>'+context.blockNumber+'</strong><span>Current block</span></div><div><strong>'+shared.partners.length+'</strong><span>Partners</span></div></div>'+
    '<section class="settings-list">'+
      '<button data-action="edit-profile"><div><span>TRAINING PROFILE</span><strong>Goals, schedule, equipment, preferences & limitations</strong></div><em>›</em></button>'+
      '<button data-action="edit-profile"><div><span>CONNECTED FITNESS</span><strong>'+((p.fitnessConnections||[]).length?((p.fitnessConnections||[]).length+' connection'+((p.fitnessConnections||[]).length===1?'':'s')):'Apple Health, Health Connect, Fitbit, Garmin, Strava')+'</strong></div><em>›</em></button>'+
      '<button data-action="train"><div><span>CURRENT PROGRAM</span><strong>Block '+context.blockNumber+' · Week '+context.blockWeek+'</strong></div><em>›</em></button>'+
      '<button data-action="together"><div><span>WORKOUT PARTNERS</span><strong>'+shared.partners.length+' saved partner'+(shared.partners.length===1?'':'s')+'</strong></div><em>›</em></button>'+
      '<button data-action="open-cue-settings"><div><span>WORKOUT SETTINGS</span><strong>Voice, sound, haptics, flash</strong></div><em>›</em></button>'+
      '<button data-action="account-info"><div><span>ACCOUNT</span><strong>'+(store.account?.email?esc(store.account.email):'Local prototype · backend sign-in foundation')+'</strong></div><em>›</em></button>'+
      '<button data-action="history"><div><span>WORKOUT HISTORY</span><strong>'+store.history.length+' saved session'+(store.history.length===1?'':'s')+'</strong></div><em>›</em></button>'+
    '</section>'+
    '<section class="prototype-note"><strong>Account model prepared for shared authentication.</strong><span>Detailed workout data remains browser-local in this prototype. The parent project already has Supabase infrastructure for the later account-backed migration.</span></section>'+
  '</div>';
}
function renderAccountSheet(){
  const account=store.account||{},connected=account.status==='connected';
  return '<div class="exercise-modal-backdrop sheet-backdrop" data-action="close-account-sheet"><section class="bottom-sheet account-sheet" data-account-sheet-panel>'+
    '<div class="sheet-handle"></div><div class="sheet-head"><div><p class="eyebrow">ACCOUNT</p><h2>'+(connected?'Your account':'Sign in to sync & share')+'</h2></div><button class="modal-close" data-action="close-account-sheet">×</button></div>'+
    '<div class="account-status-card"><span>STATUS</span><strong>'+(connected?'CONNECTED':'SIGNED OUT')+'</strong><p>'+(connected?'Your Workout account is connected on this browser.':'Sign in or create a Workout account. New accounts do not require email confirmation.')+'</p></div>'+
    (connected?
      '<div class="account-identity-preview"><div class="profile-avatar-large small">'+esc((displayName()[0]||'Y').toUpperCase())+'</div><div><strong>'+esc(displayName())+'</strong><span>'+esc(account.email||'Connected account')+'</span></div></div><button class="button secondary account-signout" data-action="account-sign-out">SIGN OUT</button>'
      :
      '<div class="account-auth-form"><label class="field"><span>EMAIL</span><input id="account-email" type="email" autocomplete="email" value="'+esc(account.email||store.profile?.email||'')+'" placeholder="you@example.com"></label><label class="field"><span>PASSWORD</span><input id="account-password" type="password" autocomplete="current-password" placeholder="••••••••"></label></div><button class="text-button account-forgot" data-action="account-forgot-password">FORGOT PASSWORD?</button><div class="auth-choice-grid"><button class="button" data-action="account-sign-in">SIGN IN</button><button class="button secondary" data-action="account-create">CREATE ACCOUNT</button></div>')+
    '<div class="privacy-list"><div><span>PRIVATE BY DEFAULT</span><strong>Readiness, body data, notes, and full training history</strong></div><div><span>SHARED SESSION</span><strong>Partner sees session state and only the data required to train together</strong></div></div>'+
  '</section></div>';
}

function renderCueSettingsSheet(){
  const settings=workoutCueSettings(),prep=settings.prep;
  const lengthButtons=(kind,value)=>['quick','standard','extended'].map(option=>'<button type="button" data-action="set-prep-length" data-prep-kind="'+kind+'" data-prep-value="'+option+'" class="'+(value===option?'active':'')+'">'+option.toUpperCase()+'</button>').join('');
  return '<div class="exercise-modal-backdrop sheet-backdrop" data-action="close-cue-settings"><section class="bottom-sheet" data-cue-settings-panel><div class="sheet-handle"></div><div class="sheet-head"><div><p class="eyebrow">WORKOUT SETTINGS</p><h2>Guidance & prep</h2></div><button class="modal-close" data-action="close-cue-settings">×</button></div>'+
    '<div class="prep-settings-block"><div><span>WARM-UP LENGTH</span><small>Quick trims movements. Extended adds more prep.</small></div><div class="prep-length-toggle">'+lengthButtons('warmup',prep.warmup)+'</div></div>'+
    '<div class="prep-settings-block"><div><span>COOLDOWN LENGTH</span><small>Standard targets roughly 1–2 minutes.</small></div><div class="prep-length-toggle">'+lengthButtons('cooldown',prep.cooldown)+'</div></div>'+
    '<div class="settings-toggle-list">'+
      '<button data-action="toggle-prefer-reps" class="settings-toggle"><div><strong>Prefer reps</strong><span>Use reps instead of timers for squats, hinges, circles, and lunges.</span></div><em>'+(prep.preferReps?'ON':'OFF')+'</em></button>'+
      '<button data-action="toggle-skip-static" class="settings-toggle"><div><strong>Skip static stretching</strong><span>Cooldown becomes a short breathing/reset finish.</span></div><em>'+(prep.skipStatic?'ON':'OFF')+'</em></button>'+
      '<button data-action="toggle-always-mobility" class="settings-toggle"><div><strong>Always include mobility</strong><span>Add a mobility movement even when the workout is short.</span></div><em>'+(prep.alwaysMobility?'ON':'OFF')+'</em></button>'+
      [['sound','Sound','Timer and completion tones'],['voice','Voice','Exercise names and coaching announcements'],['haptics','Haptics','Supported-device vibration cues'],['flash','Flash','Visual workout cue flash']].map(([key,label,copy])=>'<button data-action="toggle-'+key+'" class="settings-toggle"><div><strong>'+label+'</strong><span>'+copy+'</span></div><em>'+(settings[key]?'ON':'OFF')+'</em></button>').join('')+
    '</div><button class="button secondary" data-action="test-cues">TEST CUES</button></section></div>';
}

function renderExerciseActionsSheet(){
  const w=store.activeWorkout,index=exerciseActionsIndex,ex=w?.exercises?.[index];if(!ex)return '';
  const state=exerciseState(ex);
  return '<div class="exercise-modal-backdrop sheet-backdrop" data-action="close-exercise-actions"><section class="bottom-sheet" data-exercise-actions-panel><div class="sheet-handle"></div><div class="sheet-head"><div><p class="eyebrow">EXERCISE OPTIONS</p><h2>'+esc(ex.name)+'</h2></div><button class="modal-close" data-action="close-exercise-actions">×</button></div><div class="sheet-action-list">'+
    '<button data-exercise-detail="'+esc(ex.id)+'"><span>ⓘ</span><div><strong>View exercise details</strong><small>Form, setup, cues, history</small></div></button>'+
    (!exerciseCountsAsResolved(ex)?'<button data-action="swap-active" data-swap-index="'+index+'"><span>⇄</span><div><strong>Swap exercise</strong><small>Choose a compatible alternative</small></div></button><button data-action="move-exercise-later" data-exercise-index="'+index+'"><span>↓</span><div><strong>Move to later</strong><small>Keep it in the workout, change the order</small></div></button><button data-action="mark-exercise-complete" data-exercise-index="'+index+'"><span>✓</span><div><strong>Mark as complete</strong><small>No fake weight or rep data</small></div></button><button data-action="skip-exercise" data-exercise-index="'+index+'"><span>⊘</span><div><strong>Skip exercise</strong><small>Leave it unresolved for performance data</small></div></button>':'')+
    (state==='completed-manually'?'<button data-action="undo-manual-exercise" data-exercise-index="'+index+'"><span>↺</span><div><strong>Undo manual completion</strong><small>Return the exercise to an unfinished state</small></div></button>':'')+
    (state==='skipped'?'<button data-action="restore-exercise" data-exercise-index="'+index+'"><span>↺</span><div><strong>Restore exercise</strong><small>Return it to the workout</small></div></button>':'')+
    '</div></section></div>';
}
function renderHistoryMenuSheet(){
  const item=store.history.find(entry=>entry.id===historyMenuId);if(!item)return '';
  const rows=(item.exercises||[]).map(ex=>{
    const done=(ex.sets||[]).filter(set=>set.completed).length;
    return '<div class="history-detail-row"><strong>'+esc(ex.name)+'</strong><span>'+done+'/'+(ex.sets?.length||0)+' sets'+(ex.feedback?' · '+esc(feedbackLabel(ex.feedback)):'')+'</span></div>';
  }).join('');
  return '<div class="exercise-modal-backdrop sheet-backdrop" data-action="close-history-menu"><section class="bottom-sheet history-detail-sheet" data-history-menu-panel><div class="sheet-handle"></div><div class="sheet-head"><div><p class="eyebrow">WORKOUT DETAILS</p><h2>'+esc(item.routineName)+'</h2><p>'+esc(formatDate(item.completedAt))+'</p></div><button class="modal-close" data-action="close-history-menu">×</button></div>'+
    '<div class="history-detail-summary"><div><span>TIME</span><strong>'+item.durationMinutes+' min</strong></div><div><span>SETS</span><strong>'+item.completedSets+'</strong></div><div><span>VOLUME</span><strong>'+formatVolume(item.totalVolume||0)+'</strong></div></div>'+
    '<div class="history-detail-list">'+rows+'</div>'+
    '<div class="sheet-action-list"><button class="danger-sheet-action" data-action="remove-history" data-history-id="'+esc(item.id)+'"><span>⌫</span><div><strong>Remove from history</strong><small>Recalculates calendar and adaptive data</small></div></button></div></section></div>';
}

function renderHome(){
  const p=store.profile,plan=store.plan;if(!p||!plan)return renderProfileEditor();
  const context=programContext(),decision=adaptationDecision(),schedule=currentWeekSchedule();
  const completed=schedule.filter(entry=>entry.status==='complete').length;
  const next=nextScheduledSession(),day=next?.adaptedDay||next?.day||null;
  const missed=schedule.filter(entry=>entry.status==='missed');
  const volume=weeklyVolumeValue();
  const name=displayName()==='there'?'':displayName();
  const shared=sharedTrainingState();
  return '<div class="clean-page home-clean">'+
    '<section class="home-greeting"><div><p class="eyebrow">TRAINING</p><h2>'+(name?'Hey, '+esc(name)+'.':'Your training week.')+'</h2><p>'+esc(blockPhaseLabel(context.blockWeek))+' phase · Block '+context.blockNumber+', Week '+context.blockWeek+'</p></div><button class="shell-icon-button" data-action="open-cue-settings" aria-label="Workout settings">◉</button></section>'+
    (store.activeWorkout?'<button class="clean-resume-card" data-action="resume"><div><span>WORKOUT IN PROGRESS</span><strong>'+esc(store.activeWorkout.routineName)+'</strong><small>'+esc(store.activeWorkout.phase==='rest'?'Resting':store.activeWorkout.phase==='pre-set'?'Getting ready':store.activeWorkout.phase==='exercise-transition'?'Next exercise':store.activeWorkout.phase==='review'?'Final review':'Session active')+'</small></div><em>RESUME →</em></button>':'')+
    '<section class="today-card '+(next?.status==='missed'?'missed':'')+'"><div class="today-card-top"><div><span>'+(next?.status==='missed'?'MISSED WORKOUT':next?.status==='today'?'TODAY’S WORKOUT':'NEXT WORKOUT')+'</span><em>'+esc(blockPhaseLabel(context.blockWeek))+'</em></div><strong>~'+esc(day?.estimatedMinutes||p.minutes)+' min</strong></div>'+
      '<div class="today-card-body"><div><h3>'+esc(day?.name||'Week complete')+'</h3><p>'+esc(day?.focus||'Your next training week will adapt from this one.')+'</p>'+(day?'<small>'+day.exercises.length+' exercises · '+day.exercises.reduce((sum,ex)=>sum+(ex.sets||0),0)+' working sets</small>':'')+'</div></div>'+
      (next&&!store.activeWorkout?'<button class="button primary-action today-start" data-start="'+esc(next.day.id)+'" data-scheduled-date="'+esc(next.dateKey)+'">'+(next.status==='missed'?'MAKE UP WORKOUT':next.status==='today'?'START WORKOUT':'PREPARE WORKOUT')+'</button>':'')+
      (next?'<div class="today-secondary-actions"><button class="text-button" data-action="mark-scheduled-complete" data-day-id="'+esc(next.day.id)+'" data-scheduled-date="'+esc(next.dateKey)+'">✓ MARK COMPLETE</button><button class="text-button" data-action="share-next-workout">◎ WORK OUT TOGETHER</button></div>':'')+
    '</section>'+
    '<section class="clean-section week-overview"><div class="clean-section-head"><div><p class="eyebrow">THIS WEEK</p><h3>'+completed+'/'+schedule.length+' workouts</h3></div><button class="text-button" data-action="train">SEE PROGRAM</button></div>'+renderCompactWeek(schedule)+
      (missed.length?'<div class="missed-summary"><strong>'+missed.length+' missed session'+(missed.length===1?'':'s')+'</strong><span>They stay available to make up, complete manually, or skip.</span></div>':'')+
    '</section>'+
    '<section class="home-progress-grid"><button class="mini-metric-card" data-action="progress"><span>WORKOUTS</span><strong>'+completed+'/'+schedule.length+'</strong><small>This week</small></button><button class="mini-metric-card" data-action="progress"><span>VOLUME</span><strong>'+formatVolume(volume)+'</strong><small>This week</small></button></section>'+
    '<section class="clean-panel adaptation-card"><div><span>THIS WEEK’S ADAPTATION</span><strong>'+esc(decision.mode.toUpperCase())+'</strong><p>'+esc(decision.notes.join(' ')||'Keep building from the targets earned in your previous sessions.')+'</p></div><button class="text-button" data-action="progress">WHY?</button></section>'+
    (shared.draft?'<button class="shared-home-card" data-action="together"><div class="shared-avatar-stack small"><div class="shared-avatar you">'+esc((displayName()[0]||'Y').toUpperCase())+'</div><div class="shared-avatar partner">'+esc((shared.draft.partnerName[0]||'P').toUpperCase())+'</div></div><div><span>SHARED WORKOUT</span><strong>'+esc(shared.draft.routineName)+' with '+esc(shared.draft.partnerName)+'</strong><small>'+esc(shared.draft.partnerStatus==='ready'?'Both ready':'Invite pending')+'</small></div><em>→</em></button>':'')+
  '</div>';
}
function renderCatalog(){
  const q=catalogQuery.trim().toLowerCase();
  const items=allExerciseCatalog().filter(e=>!q||[e.name,e.movement,...(e.muscles||[]),e.style,e.difficulty].join(' ').toLowerCase().includes(q));
  return `
    <div class="page-head"><div><p class="eyebrow">EXERCISE LIBRARY</p><h2 class="page-title">${allExerciseCatalog().length} movements.</h2><p class="page-copy">Verified movement references, your custom exercises, form cues, equipment matching and progression history.</p></div><button class="button secondary" data-action="open-custom-exercise">+ CUSTOM EXERCISE</button></div>
    <div class="catalog-search"><input id="catalog-search" type="search" placeholder="Search chest, squat, dumbbell..." value="${esc(catalogQuery)}"><span>${items.length} shown</span></div>
    <div class="catalog-grid">${items.map(e=>`<article class="catalog-card visual-catalog-card">${exerciseImageButton(e,'catalog-exercise-media')}<div class="catalog-card-copy"><div class="catalog-top"><span>${esc(movements[e.movement]||e.movement)}</span><span>${esc(e.difficulty)}</span></div><h3>${esc(e.name)}</h3><p>${e.muscles.map(esc).join(' · ')}</p><p class="catalog-description">${esc(exerciseDescription(e))}</p><div class="catalog-tags"><span>${esc(e.style)}</span><span>${esc(e.equipment.join(' / '))}</span></div><button class="text-button catalog-details" type="button" data-exercise-detail="${esc(e.id)}">View form & cues</button></div></article>`).join('')}</div>`;
}

function renderWorkoutIntro(w){
  const first=w.exercises?.[0];
  const notes=(w.adaptationNotes||[]).filter(Boolean);
  const topNote=notes[0]||'Targets are based on your recent training and readiness.';
  const warmupGroups=timedStageGroups(w.warmup||[]);
  const cooldownGroups=timedStageGroups(w.cooldown||[]);
  const warmupSeconds=(w.warmup||[]).reduce((sum,item)=>sum+stageEstimatedSeconds(item),0);
  return '<div class="clean-session-intro">'+
    '<div class="session-intro-heading"><p class="eyebrow">TODAY’S SESSION</p><h2>'+esc(w.routineName)+'</h2><p>'+esc(w.focus||'')+'</p></div>'+
    '<div class="intro-stats clean-intro-stats"><div><span>TIME</span><strong>~'+esc(w.readiness?.timeAvailable||store.profile?.minutes||45)+' min</strong></div><div><span>EXERCISES</span><strong>'+w.exercises.length+'</strong></div><div><span>SETS</span><strong>'+totalSets(w.exercises)+'</strong></div></div>'+
    (warmupGroups.length?'<section class="clean-panel intro-warmup-card"><div class="intro-prep-head"><div><span>STARTS WITH</span><h3>Dynamic Warm-Up</h3></div><strong>'+warmupGroups.length+' movements · ~'+Math.max(1,Math.ceil(warmupSeconds/60))+' min</strong></div><div class="intro-prep-pills">'+warmupGroups.map(group=>'<span>'+esc(group.name)+'</span>').join('')+'</div><p>Reps are used where they make more sense, timed movements stay short, and side-specific work is separated automatically.</p></section>':'')+
    (cooldownGroups.length?'<div class="intro-cooldown-note"><span>FINISHES WITH</span><strong>'+cooldownGroups.length+' recovery movement'+(cooldownGroups.length===1?'':'s')+'</strong></div>':'')+
    (first?'<section class="clean-first-exercise">'+exerciseImageButton(first,'intro-exercise-media')+'<div><span>FIRST WORKING EXERCISE</span><h3>'+esc(first.name)+'</h3><p>'+esc(first.sets.length+' × '+first.reps)+' · '+esc(equipmentRequirement(exerciseSource(first)))+'</p></div></section>':'')+
    '<section class="clean-panel intro-update-card"><span>TODAY’S UPDATE</span><strong>'+esc(topNote)+'</strong>'+(notes.length>1?'<button class="text-button" data-action="open-workout-map">Review session</button>':'')+'</section>'+
    '<button class="button primary-action intro-begin" data-action="begin-session">BEGIN WORKOUT</button>'+
    '<button class="text-button intro-review" data-action="open-workout-map">REVIEW / REORDER SESSION</button>'+
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
    initializeTimedStageRuntime(w);
    saveStore();render();
  }else{
    beginPreSetPosition(0,0,true);
  }
}

function renderWorkoutPreview(w,index){
  const ex=w.exercises[index];if(!ex)return '';
  const state=exerciseState(ex),done=(ex.sets||[]).filter(set=>set.completed).length;
  const guide=exerciseGuidance(ex);
  return '<div class="workout-preview-stage">'+
    '<div class="preview-banner"><div><span>PREVIEW · EXERCISE '+(index+1)+' OF '+w.exercises.length+'</span><strong>Viewing only. Your workout position has not changed.</strong></div><button class="text-button" data-action="back-to-workout">BACK TO WORKOUT</button></div>'+
    '<div class="clean-exercise-heading"><div><p class="eyebrow">'+esc(exerciseStateLabel(ex))+'</p><h2>'+esc(ex.name)+'</h2><p>'+esc((ex.muscles||[]).join(' · '))+' · '+esc(equipmentRequirement(exerciseSource(ex)))+'</p></div></div>'+
    '<div class="clean-exercise-media">'+exerciseImageButton(ex,'active-exercise-media')+'</div>'+
    '<div class="preview-facts"><div><span>TARGET</span><strong>'+esc(ex.sets.length+' × '+ex.reps)+'</strong></div><div><span>REST</span><strong>'+esc(ex.rest||45)+' sec</strong></div><div><span>LOGGED</span><strong>'+done+'/'+ex.sets.length+' sets</strong></div></div>'+
    '<section class="preview-cues"><span>FORM CUE</span><strong>'+esc(guide.cue)+'</strong><p>'+esc(guide.setup)+'</p></section>'+
    renderLoggedSets(ex,index)+
    '<div class="preview-actions"><button class="button secondary" data-exercise-detail="'+esc(ex.id)+'">VIEW FULL FORM</button>'+
    (index!==(w.currentExerciseIndex||0)&&!exerciseCountsAsResolved(ex)?'<button class="button primary-action" data-action="start-previewed-exercise">START THIS EXERCISE NOW</button>':'')+
    '<button class="text-button" data-action="back-to-workout">BACK TO CURRENT EXERCISE</button></div>'+
  '</div>';
}
function renderFormMode(pos){
  const ex=pos.exercise,guide=exerciseGuidance(ex);
  return '<div class="form-mode-stage"><div class="form-mode-head"><div><p class="eyebrow">FORM MODE · SET '+(pos.si+1)+' OF '+ex.sets.length+'</p><h2>'+esc(ex.name)+'</h2></div><button class="text-button" data-action="toggle-form-mode">EXIT FORM MODE</button></div>'+
    '<div class="form-mode-media">'+exerciseImageButton(ex,'active-exercise-media')+'</div>'+
    '<div class="form-mode-target"><span>CURRENT TARGET</span><strong>'+esc(currentPrescriptionLabel(ex))+'</strong></div>'+
    '<div class="form-mode-cues"><article><span>SETUP</span><p>'+esc(guide.setup)+'</p></article><article><span>MOVE</span><p>'+esc(guide.steps?.[0]||guide.cue)+'</p></article><article><span>WATCH FOR</span><p>'+esc(guide.mistake)+'</p></article></div>'+
    '<button class="button primary-action" data-action="toggle-form-mode">BACK TO SET</button></div>';
}
function renderWorkout(){
  const pos=getActivePosition();
  if(!pos)return '<div class="clean-page empty-workout-page"><p class="eyebrow">TRAIN</p><h2>No active session.</h2><p>Start today’s workout from Home or Train.</p><button class="button" data-action="home">GO HOME</button></div>';
  const w=pos.workout,previewing=workoutPreviewIndex!==null,viewIndex=previewing?workoutPreviewIndex:pos.ei;
  const inExercise=['work','rest','calibrate','feedback','pre-set','timed-set','exercise-review','exercise-transition'].includes(w.phase);
  const stageLabel=previewing?'Previewing exercise':w.isPaused?'Paused':w.phase==='intro'?'Session intro':w.phase==='review'?'Review':w.phase==='exercise-transition'?'Next exercise':w.phase==='exercise-review'?'Exercise review':w.phase==='warmup'?'Warm-up':w.phase==='cooldown'?'Cooldown':w.phase==='feedback'?'Feedback':w.phase==='pre-set'?'Get ready':w.phase==='timed-set'?'Timed set':'Working';
  const current=Math.min(w.exercises.length,Math.max(1,(w.currentExerciseIndex||0)+1)),isPrep=w.phase==='warmup'||w.phase==='cooldown';
  const prepProgress=isPrep?(()=>{const snap=timedStageSnapshot(w)||{index:0},items=timedStageItems(w),groups=timedStageGroups(items),meta=timedStageGroupMeta(items,snap.index||0);return '<div class="clean-progress-head prep-progress-head"><span>'+esc(stageLabel)+'</span><strong>Movement '+(meta.groupIndex+1)+' of '+Math.max(1,groups.length)+'</strong></div><div class="prep-step-strip">'+groups.map((group,index)=>'<span class="'+(index<meta.groupIndex?'done':index===meta.groupIndex?'current':'')+'"></span>').join('')+'</div>';})():'<div class="clean-progress-head"><span>'+esc(stageLabel)+'</span><strong>Current '+current+' of '+w.exercises.length+'</strong></div><div class="step-strip clean-step-strip">'+w.exercises.map((ex,i)=>'<button type="button" class="step-pip '+(exerciseCountsAsResolved(ex)?'done':'')+' '+(i===pos.ei&&inExercise?'current':'')+' '+(i===viewIndex&&previewing?'viewing':'')+' '+(exerciseState(ex)==='partial'?'partial':'')+'" data-action="preview-exercise" data-exercise-index="'+i+'" aria-label="Preview '+esc(ex.name)+' · '+esc(exerciseStateLabel(ex))+'"></button>').join('')+'</div>';
  return '<div class="guided-shell cleaned-workout">'+
    '<div id="workout-cue-flash" class="workout-cue-flash" aria-hidden="true"></div>'+
    '<header class="clean-workout-header"><button class="workout-back" data-action="'+(previewing?'back-to-workout':'home')+'" aria-label="'+(previewing?'Back to current workout':'Leave workout and resume later')+'">‹</button><div><span>'+esc(w.routineName)+'</span><strong id="elapsed-clock">'+formatClock(workoutElapsedSeconds(w))+'</strong></div><div class="workout-header-actions"><button class="circle-action" data-action="open-cue-settings" aria-label="Workout settings">◉</button><button class="circle-action" data-action="toggle-workout-pause" aria-label="'+(w.isPaused?'Resume':'Pause')+' workout">'+(w.isPaused?'▶':'Ⅱ')+'</button></div></header>'+
    (w.sharedSession?(()=>{const live=sharedTrainingState().draft?.backendId===w.sharedSession.backendId?sharedTrainingState().draft:w.sharedSession;return '<button class="shared-session-strip" data-action="together"><div class="shared-avatar-stack tiny"><div class="shared-avatar you">'+esc((displayName()[0]||'Y').toUpperCase())+'</div><div class="shared-avatar partner">'+esc((live.partnerName?.[0]||'P').toUpperCase())+'</div></div><div><span>SHARED SESSION</span><strong>With '+esc(live.partnerName||'Partner')+'</strong><small>'+esc(sharedRemotePositionLabel(live))+'</small></div><em>'+esc(live.remoteState?.connectionState==='offline'?'Reconnecting':'Live')+'</em></button>'})():'')+
    prepProgress+
    (w.isPaused?'<div class="workout-pause-banner"><strong>WORKOUT PAUSED</strong><span>Timers are frozen.</span></div>':'')+
    '<section class="exercise-stage clean-exercise-stage">'+(previewing?renderWorkoutPreview(w,viewIndex):workoutFormMode?renderFormMode(pos):w.phase==='intro'?renderWorkoutIntro(w):w.phase==='review'?renderWorkoutReview(w):w.phase==='exercise-transition'?renderExerciseTransition(w):w.phase==='exercise-review'?renderExerciseReview(pos):isPrep?renderTimedStage(w):w.phase==='pre-set'?renderPreSet(pos):w.phase==='timed-set'?renderTimedWorkSet(pos):w.phase==='rest'?renderRest(pos):w.phase==='calibrate'?renderCalibration(pos):w.phase==='feedback'?renderExerciseFeedback(pos):renderWorkSet(pos))+'</section>'+
    (isPrep?'':'<nav class="workout-bottom-nav"><button data-action="previous-exercise" '+(viewIndex<=0?'disabled':'')+'>‹ <span>Preview previous</span></button><button class="workout-map-trigger" data-action="open-workout-map"><span>'+current+' / '+w.exercises.length+'</span><strong>Workout Map</strong></button><button data-action="next-exercise" '+(viewIndex>=w.exercises.length-1?'disabled':'')+'><span>Preview next</span> ›</button></nav>')+
    '<div class="workout-quiet-actions">'+(previewing?'<button class="text-button" data-action="back-to-workout">BACK TO WORKOUT</button>':isPrep?'<button class="text-button" data-action="open-workout-map">VIEW WORKOUT MAP</button>':'<button class="text-button" data-action="finish">END SESSION</button><button class="text-button muted" data-action="home">LEAVE & RESUME LATER</button>')+'</div>'+
  '</div>';
}

function renderPreSet(pos){
  const snap=preSetSnapshot(pos.workout)||{mode:'countdown',remaining:3};
  const setup=snap.mode==='setup';
  const target=pos.exercise.loadMode==='timed'?(pos.set.reps||pos.exercise.suggestedReps||recommendedRepCount(pos.exercise.reps))+' sec':currentPrescriptionLabel(pos.exercise);
  return '<div class="clean-preset-stage" data-preset-mode="'+esc(snap.mode)+'">'+
    '<p class="eyebrow" id="preset-label">'+(setup?'GET IN POSITION':'SET STARTING')+'</p>'+
    '<h2>'+esc(pos.exercise.name)+'</h2>'+
    '<div class="clean-preset-media">'+exerciseImageButton(pos.exercise,'pre-set-exercise-media')+'</div>'+
    '<div class="clean-preset-target"><span>SET '+(pos.si+1)+' OF '+pos.exercise.sets.length+'</span><strong>'+esc(target)+'</strong><small>'+esc(equipmentRequirement(exerciseSource(pos.exercise)))+'</small></div>'+
    '<div class="pre-set-number clean-countdown" id="preset-count">'+snap.remaining+'</div>'+
    '<p class="preset-cue">'+esc(exerciseGuidance(pos.exercise).cue)+'</p>'+
    '<button class="button secondary" type="button" data-action="start-set-now">START NOW</button>'+
    '<div class="preset-tertiary"><button class="text-button" data-exercise-detail="'+esc(pos.exercise.id)+'">Form</button><button class="text-button" data-action="open-exercise-actions" data-exercise-index="'+pos.ei+'">Options</button><button class="text-button muted" data-action="reset-timer">Reset</button></div>'+
  '</div>';
}
function renderTimedWorkSet(pos){
  const snap=timedSetSnapshot(pos.workout)||{remaining:num(pos.set.reps)||30,total:num(pos.set.reps)||30};
  const pct=Math.max(0,Math.min(100,(snap.remaining/Math.max(1,snap.total))*100));
  return '<div class="clean-timed-set">'+
    '<p class="eyebrow">TIMED SET · '+(pos.si+1)+' OF '+pos.exercise.sets.length+'</p>'+
    '<h2>'+esc(pos.exercise.name)+'</h2>'+
    '<div class="clean-timed-media">'+exerciseImageButton(pos.exercise,'timed-work-exercise-media')+'</div>'+
    '<div class="timed-work-clock clean-timed-clock" id="timed-set-clock">'+formatClock(snap.remaining)+'</div>'+
    '<div class="stage-progress"><span id="timed-set-progress" style="width:'+pct+'%"></span></div>'+
    '<p class="preset-cue">'+esc(exerciseGuidance(pos.exercise).cue)+'</p>'+
    '<button class="button secondary" data-action="end-timed-set">END SET EARLY</button>'+
    '<div class="preset-tertiary"><button class="text-button" data-exercise-detail="'+esc(pos.exercise.id)+'">Form</button><button class="text-button" data-action="open-exercise-actions" data-exercise-index="'+pos.ei+'">Options</button><button class="text-button muted" data-action="reset-timer">Reset</button></div>'+
  '</div>';
}
function timedStageGroups(items){
  const groups=[];
  (items||[]).forEach((item,index)=>{
    const key=item?.groupId||('stage-'+index);
    if(!groups.some(group=>group.key===key))groups.push({key,name:item?.name||'Movement',indices:[]});
    groups.find(group=>group.key===key).indices.push(index);
  });
  return groups;
}
function timedStageGroupMeta(items,index){
  const groups=timedStageGroups(items);
  const item=items[index]||{};
  const key=item.groupId||('stage-'+index);
  const groupIndex=Math.max(0,groups.findIndex(group=>group.key===key));
  const group=groups[groupIndex]||{indices:[index]};
  const withinIndex=Math.max(0,group.indices.indexOf(index));
  return {groupIndex,groupCount:groups.length,withinIndex,withinCount:group.indices.length};
}
function renderTimedStage(w){
  const items=timedStageItems(w),snap=timedStageSnapshot(w)||{index:0,remaining:0,total:20};
  const index=Math.max(0,Math.min(snap.index||0,Math.max(0,items.length-1))),item=items[index]||items[0]||{},isWarmup=w.phase==='warmup';
  const meta=timedStageGroupMeta(items,index),nextItem=items[index+1],sameGroup=nextItem&&nextItem.groupId&&nextItem.groupId===item.groupId;
  const nextLabel=nextItem?(sameGroup&&nextItem.sideLabel?'Switch to '+nextItem.sideLabel:nextItem.name):(isWarmup?w.exercises[0]?.name:'Workout review');
  const image=timedStageImageUrl(item,0),steps=timedStageSteps(item),stageMode=snap.ready?'ready':snap.manual?'manual':'timed';
  const prescription=snap.ready?'GET SET':stagePrescription(item),metric=snap.ready?String(snap.remaining):(snap.manual?prescription:formatClock(snap.remaining));
  return '<div class="clean-timed-stage timed-stage compact-prep-stage" data-stage-index="'+index+'" data-stage-mode="'+stageMode+'">'+
    '<div class="stage-heading-row"><div><p class="eyebrow">'+(isWarmup?'WARM-UP':'COOLDOWN')+' · '+(meta.groupIndex+1)+' OF '+meta.groupCount+'</p><h2>'+esc(item.name||'Get ready')+'</h2></div>'+(item.sideLabel?'<span class="stage-side-badge">'+esc(item.sideLabel)+'</span>':'')+'</div>'+
    '<div class="prep-primary-row"><div class="prep-main-metric"><span>'+esc(prescription)+'</span><strong id="stage-clock">'+esc(metric)+'</strong>'+(snap.manual?'<small>Complete at a controlled pace, then tap Done.</small>':snap.ready?'<small>Position yourself before the work starts.</small>':'<small>'+esc(item.sideLabel||'Current movement')+'</small>')+'</div>'+
    (image?'<div class="prep-compact-media"><img src="'+esc(image)+'" loading="eager" decoding="async" alt="'+esc(item.name)+' demonstration"></div>':'<div class="prep-compact-guide"><span>FORM</span><strong>Follow the steps</strong></div>')+'</div>'+
    (!snap.ready?'<div class="stage-instructions compact"><p class="stage-description">'+esc(timedStageDescription(item))+'</p><ol class="stage-step-list">'+steps.map(step=>'<li>'+esc(step)+'</li>').join('')+'</ol><div class="stage-coach-cue"><span>CUE</span><strong>'+esc(item.cue||'Move comfortably and stay controlled.')+'</strong></div><details class="stage-why compact"><summary>Why this?</summary><strong>'+esc(timedStageWhy(item))+'</strong></details></div>':'')+
    (!snap.manual&&!snap.ready?'<div class="stage-progress"><span id="stage-progress-fill" style="width:'+Math.max(0,Math.min(100,(snap.remaining/Math.max(1,snap.total))*100))+'%"></span></div>':'')+
    '<div class="rest-next-copy compact-next"><span>UP NEXT</span><h3>'+esc(nextLabel||'Begin workout')+'</h3></div>'+
    '<div class="prep-stage-actions">'+(snap.manual?'<button class="button primary-action" data-action="stage-done">DONE</button>':snap.ready?'<button class="button secondary" data-action="stage-start-now">START NOW</button>':'<button class="button secondary" data-action="reset-timer">RESET</button>')+'<button class="button secondary" data-action="skip-stage">SKIP</button></div>'+
    '<button class="text-button prep-skip-all" data-action="skip-remaining-prep">'+(isWarmup?'SKIP REMAINING WARM-UP':'SKIP REMAINING COOLDOWN')+'</button>'+
  '</div>';
}

function exerciseSessionHistory(exerciseId,limit=4){
  const rows=[];
  for(const workout of store.history){
    const exercises=workout.exercises||[];
    const exerciseIndex=exercises.findIndex(item=>item.id===exerciseId);
    if(exerciseIndex<0)continue;
    const ex=exercises[exerciseIndex];
    const sets=(ex.sets||[]).filter(set=>set.completed);
    if(!sets.length)continue;
    let best=null;
    for(const set of sets){
      const current={weight:num(set.weight),reps:num(set.reps)};
      if(!best||current.weight>best.weight||(current.weight===best.weight&&current.reps>best.reps))best=current;
    }
    const strength=sets.reduce((max,set)=>Math.max(max,estimatedStrength(set.weight,set.reps)),0);
    rows.push({
      workoutId:workout.id,date:workout.completedAt,scheduledDate:workout.scheduledDate||'',routineName:workout.routineName,
      exerciseIndex,exerciseCount:exercises.length,rest:num(ex.rest||0),duration:num(workout.exerciseDurations?.[ex.id]||0),
      sets:sets.map(set=>({weight:num(set.weight),reps:num(set.reps)})),best,feedback:ex.feedback||'',
      volume:sets.reduce((sum,set)=>sum+num(set.weight)*num(set.reps),0),strength
    });
    if(limit!==Infinity&&rows.length>=limit)break;
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
function exerciseDetailPreference(exerciseId){
  store.exercisePreferences=store.exercisePreferences||{excluded:[],swapHistory:[],details:{}};
  store.exercisePreferences.details=store.exercisePreferences.details||{};
  return store.exercisePreferences.details[exerciseId]||{setup:'',note:'',updatedAt:null};
}
function saveExerciseDetailMemory(exerciseId){
  if(!exerciseId)return;
  const setup=String(document.querySelector('#exercise-memory-setup')?.value||'').trim();
  const note=String(document.querySelector('#exercise-memory-note')?.value||'').trim();
  store.exercisePreferences=store.exercisePreferences||{excluded:[],swapHistory:[],details:{}};
  store.exercisePreferences.details=store.exercisePreferences.details||{};
  store.exercisePreferences.details[exerciseId]={setup,note,updatedAt:new Date().toISOString()};
  saveStore();render();toast('Exercise setup and notes saved.');
}
function exerciseFeedbackLabel(value){
  return ({'easy':'Easy','right':'Right on target','hard':'Hard','very-hard':'Very hard','form-off':'Form off','5+':'Very easy','3-4':'Easy','2':'Right on target','1':'Very hard','0':'Max effort'})[value]||String(value||'Not rated');
}
function defaultExerciseDetailMetric(ex){
  if(ex?.loadMode==='timed')return 'seconds';
  if(['bodyweight','band','assisted'].includes(ex?.loadMode))return 'reps';
  return 'weight';
}
function exerciseMetricOptions(ex){
  if(ex?.loadMode==='timed')return [{id:'seconds',label:'Seconds'}];
  if(['bodyweight','band'].includes(ex?.loadMode))return [{id:'reps',label:'Reps'}];
  if(ex?.loadMode==='assisted')return [{id:'reps',label:'Reps'},{id:'volume',label:'Volume'}];
  return [{id:'weight',label:'Weight'},{id:'reps',label:'Reps'},{id:'strength',label:'Strength'},{id:'volume',label:'Volume'}];
}
function activeExerciseDetailMetric(ex){
  const options=exerciseMetricOptions(ex);
  return options.some(option=>option.id===exerciseDetailMetric)?exerciseDetailMetric:defaultExerciseDetailMetric(ex);
}
function exerciseMetricInfo(ex,metric){
  const map={
    weight:{label:'Working weight',unit:'lb'},reps:{label:'Reps at best set',unit:'reps'},
    strength:{label:'Estimated strength',unit:'lb'},volume:{label:'Session volume',unit:'lb'},seconds:{label:'Best hold / interval',unit:'sec'}
  };
  return map[metric]||map[defaultExerciseDetailMetric(ex)];
}
function exerciseProgressRows(ex){
  const all=exerciseSessionHistory(ex.id,200);
  const requested=exerciseDetailRange==='all'?all.length:Math.max(1,num(exerciseDetailRange)||8);
  const metric=activeExerciseDetailMetric(ex);
  return all.slice(0,requested).reverse().map(row=>{
    const maxReps=row.sets.reduce((max,set)=>Math.max(max,num(set.reps)),0);
    const bestTimed=maxReps;
    const value=metric==='weight'?num(row.best?.weight):metric==='reps'?num(row.best?.reps||maxReps):metric==='strength'?num(row.strength):metric==='volume'?num(row.volume):bestTimed;
    return {...row,value};
  });
}
function shortChartDate(value){
  const date=new Date(value);
  return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(date):'';
}
function exerciseMetricValueLabel(value,metric){
  if(metric==='volume')return formatVolume(value);
  if(metric==='weight'||metric==='strength')return Math.round(value)+' lb';
  if(metric==='seconds')return Math.round(value)+' sec';
  return Math.round(value)+' reps';
}
function renderExerciseProgressChart(ex){
  const metric=activeExerciseDetailMetric(ex);
  const options=exerciseMetricOptions(ex);
  const info=exerciseMetricInfo(ex,metric);
  const rows=exerciseProgressRows(ex);
  const allHistory=exerciseSessionHistory(ex.id,200);
  const metricButtons=options.map(option=>'<button type="button" data-action="set-exercise-detail-metric" data-metric="'+esc(option.id)+'" class="'+(metric===option.id?'active':'')+'">'+esc(option.label)+'</button>').join('');
  const rangeButtons=['6','8','12','all'].map(value=>'<button type="button" data-action="set-exercise-detail-range" data-range="'+value+'" class="'+(exerciseDetailRange===value?'active':'')+'">'+(value==='all'?'All':value)+'</button>').join('');
  if(!rows.length)return '<section class="exercise-progress-panel"><div class="exercise-progress-head"><div><span>PROGRESS</span><h3>Build your first trend</h3></div></div><p class="progress-empty">Complete this exercise and your weight, reps, strength, and volume history will start appearing here.</p></section>';
  const values=rows.map(row=>row.value);
  const latest=rows[rows.length-1],first=rows[0],best=Math.max(...values);
  const delta=latest.value-first.value;
  const width=560,height=230,left=46,right=18,top=20,bottom=42,innerW=width-left-right,innerH=height-top-bottom;
  const maxValue=Math.max(1,best*1.12);
  const points=rows.map((row,index)=>{
    const x=rows.length===1?left+innerW/2:left+(index/(rows.length-1))*innerW;
    const y=top+innerH-(row.value/maxValue)*innerH;
    return {...row,x,y};
  });
  let runningBest=-Infinity;
  points.forEach(point=>{point.isPr=point.value>runningBest;runningBest=Math.max(runningBest,point.value);});
  const polyline=points.map(point=>point.x.toFixed(1)+','+point.y.toFixed(1)).join(' ');
  const grid=[0,.5,1].map(ratio=>{const y=top+innerH-(ratio*innerH);const value=maxValue*ratio;return '<g><line x1="'+left+'" y1="'+y.toFixed(1)+'" x2="'+(width-right)+'" y2="'+y.toFixed(1)+'" class="progress-grid-line"/><text x="'+(left-8)+'" y="'+(y+3).toFixed(1)+'" text-anchor="end" class="progress-axis-label">'+esc(metric==='volume'?Math.round(value/100)/10+'k':Math.round(value))+'</text></g>';}).join('');
  const labels=points.map((point,index)=>{const show=points.length<=6||index===0||index===points.length-1||index===Math.floor(points.length/2);return show?'<text x="'+point.x.toFixed(1)+'" y="'+(height-13)+'" text-anchor="middle" class="progress-axis-label">'+esc(shortChartDate(point.date))+'</text>':'';}).join('');
  const circles=points.map(point=>'<g><circle cx="'+point.x.toFixed(1)+'" cy="'+point.y.toFixed(1)+'" r="'+(point.isPr?5:4)+'" class="progress-point '+(point.isPr?'pr':'')+'"><title>'+esc(shortChartDate(point.date)+' · '+exerciseMetricValueLabel(point.value,metric))+'</title></circle>'+(point.isPr?'<text x="'+point.x.toFixed(1)+'" y="'+Math.max(12,point.y-10).toFixed(1)+'" text-anchor="middle" class="progress-pr-label">PR</text>':'')+'</g>').join('');
  const changeText=(delta>0?'+':'')+exerciseMetricValueLabel(delta,metric);
  const latestEffort=allHistory[0]?.feedback?exerciseFeedbackLabel(allHistory[0].feedback):'Not rated';
  return '<section class="exercise-progress-panel">'+
    '<div class="exercise-progress-head"><div><span>PROGRESS</span><h3>'+esc(info.label)+'</h3></div><div class="exercise-progress-range">'+rangeButtons+'</div></div>'+
    '<div class="exercise-progress-tabs">'+metricButtons+'</div>'+
    '<div class="progress-summary-grid"><div><span>CURRENT</span><strong>'+esc(exerciseMetricValueLabel(latest.value,metric))+'</strong></div><div><span>START</span><strong>'+esc(exerciseMetricValueLabel(first.value,metric))+'</strong></div><div><span>BEST</span><strong>'+esc(exerciseMetricValueLabel(best,metric))+'</strong></div><div><span>CHANGE</span><strong class="'+(delta>0?'positive':'')+'">'+esc(changeText)+'</strong></div></div>'+
    '<div class="progress-chart-wrap"><svg class="exercise-progress-chart" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="'+esc(ex.name+' '+info.label+' progression over previous sessions')+'">'+grid+'<polyline points="'+polyline+'" class="progress-line"/>'+circles+labels+'</svg></div>'+
    '<div class="progress-insight-card"><div><span>WHAT CHANGED?</span><strong>'+esc(delta>0?info.label+' is up across this view.':delta<0?info.label+' is lower than the start of this view.':'This metric is holding steady across this view.')+'</strong></div><p>'+esc(allHistory.length+' completed session'+(allHistory.length===1?'':'s')+' logged · latest effort: '+latestEffort+'.')+'</p></div>'+
  '</section>';
}
function renderExercisePrGrid(ex){
  const history=exerciseSessionHistory(ex.id,200);
  if(!history.length)return '';
  const sets=history.flatMap(row=>row.sets.map(set=>({...set,date:row.date})));
  const heaviest=sets.reduce((max,set)=>Math.max(max,num(set.weight)),0);
  const mostReps=sets.reduce((max,set)=>Math.max(max,num(set.reps)),0);
  const maxVolume=history.reduce((max,row)=>Math.max(max,num(row.volume)),0);
  const maxStrength=history.reduce((max,row)=>Math.max(max,num(row.strength)),0);
  const cards=[];
  if(ex.loadMode==='timed')cards.push(['LONGEST',mostReps+' sec']);
  else if(['bodyweight','band'].includes(ex.loadMode))cards.push(['MOST REPS',mostReps+' reps']);
  else{cards.push(['HEAVIEST',heaviest+' lb']);cards.push(['MOST REPS',mostReps+' reps']);if(maxStrength)cards.push(['EST. STRENGTH',Math.round(maxStrength)+' lb']);if(maxVolume)cards.push(['VOLUME PR',formatVolume(maxVolume)]);}
  return '<section class="exercise-pr-panel"><div class="detail-section-title"><span>PERSONAL BESTS</span><strong>Milestones from your logged sessions</strong></div><div class="exercise-pr-grid">'+cards.map(card=>'<div><span>'+esc(card[0])+'</span><strong>'+esc(card[1])+'</strong></div>').join('')+'</div></section>';
}
function renderExerciseHistoryTable(ex){
  const history=exerciseSessionHistory(ex.id,8);
  if(!history.length)return '';
  return '<section class="exercise-session-log"><div class="detail-section-title"><span>SESSION HISTORY</span><strong>Tap the chart for the trend. Use this log for the actual sets.</strong></div><div class="exercise-session-list">'+history.map(row=>{
    const sets=row.sets.map(set=>setPerformanceLabel(ex,set)).join(' · ');
    return '<article><div><strong>'+esc(formatDate(row.date))+'</strong><span>'+esc(row.routineName||'Workout')+' · exercise '+(row.exerciseIndex+1)+' of '+row.exerciseCount+'</span></div><div class="session-log-sets">'+esc(sets)+'</div><div class="session-log-meta"><span>'+esc(row.feedback?exerciseFeedbackLabel(row.feedback):'Not rated')+'</span>'+(row.rest?'<span>'+row.rest+'s rest</span>':'')+(row.volume?'<span>'+esc(formatVolume(row.volume))+' volume</span>':'')+'</div></article>';
  }).join('')+'</div></section>';
}
function exerciseRoleExplanation(ex){
  const muscleText=(ex.muscles||[]).slice(0,2).join(' and ').toLowerCase();
  const movement=movements[ex.movement]||String(ex.movement||'training movement');
  return 'This is your '+String(movement).toLowerCase()+(muscleText?' for '+muscleText:'')+'. Your prescription can change as your logged performance and effort change.';
}
function renderExerciseHistoryFlags(ex){
  const history=exerciseSessionHistory(ex.id,20);
  const formOff=history.some(row=>row.feedback==='form-off');
  const painSwaps=(store.exercisePreferences?.swapHistory||[]).filter(item=>item.fromId===ex.id&&item.reason==='pain');
  if(!formOff&&!painSwaps.length)return '';
  const messages=[];
  if(formOff)messages.push('You previously marked form as off on this movement. Prioritize clean technique before progressing.');
  if(painSwaps.length)messages.push('You previously swapped this movement because of pain or discomfort. Review your setup or choose a replacement if needed.');
  return '<div class="exercise-history-alert"><span>PAST FLAG</span><p>'+esc(messages.join(' '))+'</p></div>';
}
function renderExerciseMemoryPanel(ex){
  const memory=exerciseDetailPreference(ex.id);
  return '<section class="exercise-memory-panel"><div class="detail-section-title"><span>YOUR SETUP MEMORY</span><strong>Saved to this exercise and synced with your Workout account.</strong></div>'+
    '<label><span>SETUP / MACHINE POSITION</span><input id="exercise-memory-setup" value="'+esc(memory.setup||'')+'" placeholder="Example: seat 4 · cable height 11 · bench notch 3"></label>'+
    '<label><span>PERSONAL NOTE</span><textarea id="exercise-memory-note" rows="3" placeholder="Example: neutral grip feels better · keep elbows tucked">'+esc(memory.note||'')+'</textarea></label>'+
    '<button class="button secondary" type="button" data-action="save-exercise-memory">SAVE EXERCISE MEMORY</button>'+
  '</section>';
}
function renderExerciseDetailProgress(ex){
  return '<div class="exercise-intelligence">'+
    '<section class="exercise-role-card"><span>WHY IT’S IN YOUR PLAN</span><p>'+esc(exerciseRoleExplanation(ex))+'</p></section>'+
    renderExerciseHistoryFlags(ex)+renderExerciseProgressChart(ex)+renderExercisePrGrid(ex)+renderExerciseHistoryTable(ex)+renderExerciseMemoryPanel(ex)+
  '</div>';
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
  const ex=pos.exercise;
  const isTimed=ex.loadMode==='timed';
  const noLoad=['bodyweight','timed','band'].includes(ex.loadMode);
  const defaultWeight=pos.set.weight ?? (ex.suggestedWeight||'');
  const defaultReps=pos.set.reps ?? ex.suggestedReps ?? '';
  const previous=exerciseSessionHistory(ex.id,1)[0];
  const finalSet=pos.si===Math.max(0,ex.sets.length-1);
  const nextPreview=finalSet?nextExercisePreview(pos.workout,pos.ei):null;
  const lastLabel=previous?.sets?.length?previous.sets.map(set=>set.weight?set.weight+' × '+set.reps:set.reps+' reps').join(' · '):bestLabel(ex.id);
  const setRows=ex.sets.map((set,index)=>{
    const active=index===pos.si&&!set.completed;
    if(active){
      return '<div class="clean-set-row current"><span>SET '+(index+1)+'</span><label><input id="set-weight" inputmode="decimal" value="'+esc(defaultWeight)+'" placeholder="'+(noLoad?'—':'0')+'"><small>lb</small></label><label><input id="set-reps" inputmode="numeric" value="'+esc(defaultReps)+'" placeholder="'+(isTimed?'45':'0')+'"><small>'+(isTimed?'sec':'reps')+'</small></label><em>CURRENT</em></div>';
    }
    if(set.completed){
      return '<button class="clean-set-row completed" data-action="edit-set" data-exercise-index="'+pos.ei+'" data-set-index="'+index+'"><span>SET '+(index+1)+'</span><strong>'+esc(setPerformanceLabel(ex,set))+'</strong><em>✓</em></button>';
    }
    return '<div class="clean-set-row pending"><span>SET '+(index+1)+'</span><strong>'+esc(set.weight||ex.suggestedWeight||'')+(set.weight||ex.suggestedWeight?' lb · ':'')+esc(set.reps||ex.suggestedReps||'')+' '+(isTimed?'sec':'reps')+'</strong><em>UP NEXT</em></div>';
  }).join('');
  return '<div class="clean-active-exercise">'+
    '<div class="clean-exercise-heading"><div><p class="eyebrow">EXERCISE '+(pos.ei+1)+' OF '+pos.workout.exercises.length+'</p><h2>'+esc(ex.name)+'</h2><p>'+esc((ex.muscles||[]).join(' · '))+' · '+esc(equipmentRequirement(exerciseSource(ex)))+'</p></div><button class="more-action" data-action="open-exercise-actions" data-exercise-index="'+pos.ei+'" aria-label="More exercise options">•••</button></div>'+
    '<div class="clean-exercise-media">'+exerciseImageButton(ex,'active-exercise-media')+'</div>'+
    '<div class="clean-target-strip"><div><span>TARGET</span><strong>'+esc(currentPrescriptionLabel(ex))+'</strong></div><div class="target-actions"><button class="text-button" data-action="toggle-form-mode">FORM MODE</button><button class="text-button" data-exercise-detail="'+esc(ex.id)+'">DETAILS</button></div></div>'+
    '<div class="clean-set-list">'+setRows+'</div>'+
    '<button class="button primary-action clean-complete-set" data-action="complete-set">COMPLETE SET '+(pos.si+1)+'</button>'+
    '<div class="clean-performance-note"><div><span>LAST TIME</span><strong>'+esc(lastLabel||'First session')+'</strong></div><div><span>TODAY</span><strong>'+esc(ex.adaptiveReason||'Hit the target with solid form.')+'</strong></div></div>'+
    (nextPreview?'<button class="last-set-next-card" type="button" data-action="preview-exercise" data-exercise-index="'+nextPreview.index+'"><span>UP NEXT · AFTER THIS FINAL SET</span><strong>'+esc(nextPreview.exercise.name)+'</strong><small>'+esc(equipmentRequirement(exerciseSource(nextPreview.exercise)))+' · tap to preview without advancing</small></button>':'')+
    '<button class="workout-cue-compact" data-action="open-exercise-actions" data-exercise-index="'+pos.ei+'"><span>•••</span><div><strong>More options</strong><small>Swap · move later · mark complete · skip</small></div><em>›</em></button>'+
  '</div>';
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
  const total=stats.sets.length;
  return '<div class="clean-feedback-stage">'+
    '<div class="summary-check small-check">✓</div><p class="eyebrow">EXERCISE COMPLETE</p><h2>'+esc(pos.exercise.name)+'</h2>'+
    '<p>How did that movement feel? One tap updates the next-session recommendation.</p>'+
    '<div class="feedback-mini-summary"><span>'+total+' set'+(total===1?'':'s')+' completed</span><strong>'+esc(currentPrescriptionLabel(pos.exercise))+'</strong></div>'+
    '<div class="exercise-feedback-grid clean-feedback-grid">'+
      '<button data-feedback="too-easy"><strong>Too easy</strong><span>Increase next time</span></button>'+
      '<button data-feedback="good"><strong>Good</strong><span>Right on target</span></button>'+
      '<button data-feedback="hard"><strong>Hard</strong><span>Completed with form</span></button>'+
      '<button data-feedback="too-hard"><strong>Too hard</strong><span>Reduce next time</span></button>'+
      '<button data-feedback="form-off"><strong>Form off</strong><span>Hold progression</span></button>'+
    '</div>'+
    '<small class="feedback-note">Pain is different from normal training effort. Stop or change a movement that causes pain.</small>'+
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
  return '<div class="exercise-transition-stage clean-transition-stage"><p class="eyebrow">UP NEXT · EXERCISE '+(next.ei+1)+' OF '+w.exercises.length+'</p>'+
    '<div class="transition-hero">'+exerciseImageButton(ex,'next-exercise-media')+'<div><h2>'+esc(ex.name)+'</h2><p>'+esc(exerciseDescription(ex))+'</p><div class="transition-facts"><span>'+ex.sets.length+' sets · '+esc(ex.reps)+'</span><span>'+esc(equipmentRequirement(exerciseSource(ex)))+'</span></div></div></div>'+
    '<div class="transition-target"><span>TODAY’S TARGET</span><strong>'+esc(currentPrescriptionLabel(ex))+'</strong></div>'+
    '<button class="button primary-action" data-action="ready-next-exercise">I’M READY</button>'+
    '<button class="workout-cue-compact" data-action="open-exercise-actions" data-exercise-index="'+next.ei+'"><span>•••</span><div><strong>Exercise options</strong><small>Swap · move later · already completed</small></div><em>›</em></button>'+
  '</div>';
}

function nextExercisePreview(w,currentExerciseIndex){
  for(let index=currentExerciseIndex+1;index<w.exercises.length;index++){
    if(!exerciseCountsAsResolved(w.exercises[index]))return {index,exercise:w.exercises[index]};
  }
  return null;
}
function renderRest(pos){
  const remaining=restRemaining(pos.workout),next=pos.workout.pendingPosition,nextEx=next?pos.workout.exercises[next.ei]:null,paused=Number.isFinite(pos.workout.restPausedRemaining);
  const changingExercise=Boolean(next&&next.ei!==pos.ei);
  const preview=changingExercise&&nextEx?{index:next.ei,exercise:nextEx}:null;
  const previewEx=preview?.exercise||null;
  const immediateLabel=changingExercise?'NEXT EXERCISE':next?'NEXT SET':'AFTER REST';
  const immediateName=changingExercise?(nextEx?.name||'Next exercise'):next?('Set '+(next.si+1)+' · '+(nextEx?.name||pos.exercise.name)):'Cooldown';
  return '<div class="rest-stage clean-rest-stage"><p class="eyebrow">'+(changingExercise?'TRANSITION':'REST')+'</p><div class="timer-wrap clean-timer-ring" id="timer-ring" style="--timer-progress:'+restProgress(pos.workout)+'%"><div><div class="timer-value" id="rest-clock">'+formatClock(remaining)+'</div><div class="timer-sub">'+(paused?'PAUSED':changingExercise?'NEXT EXERCISE':'RECOVER')+'</div></div></div>'+
    '<div class="rest-next-copy"><span>'+immediateLabel+'</span><h3>'+esc(immediateName)+'</h3><p>'+(changingExercise?'Set up the next station. The app will wait until you are ready.':next?'Recover for the next set. The next exercise stays hidden until your final set.':'Finish strong, then move into cooldown.')+'</p></div>'+
    (previewEx?'<div class="rest-next-exercise-card">'+exerciseImageButton(previewEx,'rest-next-exercise-media')+'<button class="rest-next-exercise-copy" type="button" data-action="preview-exercise" data-exercise-index="'+preview.index+'"><span>NEXT EXERCISE · '+(preview.index+1)+' OF '+pos.workout.exercises.length+'</span><strong>'+esc(previewEx.name)+'</strong><small>'+esc(equipmentRequirement(exerciseSource(previewEx)))+' · '+esc(currentPrescriptionLabel(previewEx))+'</small></button><em>›</em></div>':'<div class="rest-next-exercise-card cooldown-preview"><div><span>UP NEXT</span><strong>Cooldown</strong><small>Finish the session with guided recovery.</small></div></div>')+
    '<div class="clean-rest-actions"><button class="button secondary" data-action="add-rest" '+(remaining>=60?'disabled':'')+'>+15 SEC</button><button class="button" data-action="skip-rest">SKIP</button></div>'+
    '<div class="rest-tertiary"><button class="text-button" data-action="pause-rest">'+(paused?'Resume timer':'Pause timer')+'</button><button class="text-button muted" data-action="reset-timer">Reset</button></div>'+
  '</div>';
}


function renderHistory(){
  const context=programContext();
  const cutoff=new Date();cutoff.setDate(cutoff.getDate()-30);
  let items=[...store.history];
  if(historyFilter==='block')items=items.filter(item=>item.programContext?.blockNumber===context.blockNumber);
  if(historyFilter==='30')items=items.filter(item=>new Date(item.completedAt)>=cutoff);
  const rows=items.map(x=>{
    const scheduled=x.scheduledDate||'';
    const actual=x.actualCompletedDate||x.actualStartDate||dateKey(new Date(x.completedAt));
    const timing=x.manualWorkoutCompletion&&scheduled?'Marked complete for '+formatDate(scheduled):scheduled?(scheduled===actual?formatDate(actual):formatDate(scheduled)+' · trained '+formatDate(actual)):formatDate(x.completedAt);
    const status=x.completionStatus==='partial'?'PARTIAL':x.manualWorkoutCompletion?'MANUAL':'';
    return '<article class="history-card clean-history-card"><button class="history-main" data-action="history-details" data-history-id="'+esc(x.id)+'"><div><div class="history-title-line"><h3>'+esc(x.routineName)+'</h3>'+(status?'<span>'+status+'</span>':'')+(x.newPRs?.length?'<em>'+x.newPRs.length+' PR'+(x.newPRs.length===1?'':'s')+'</em>':'')+'</div><p>'+esc(timing)+'</p><small>'+x.durationMinutes+' min · '+x.completedSets+' sets · '+formatVolume(x.totalVolume||0)+'</small></div><strong>›</strong></button><button class="history-more" data-action="open-history-menu" data-history-id="'+esc(x.id)+'" aria-label="Workout options">•••</button></article>';
  }).join('');
  const filters=[['all','All'],['block','This Block'],['30','Last 30 Days']];
  return '<div class="clean-page"><div class="clean-page-head"><div><p class="eyebrow">HISTORY</p><h2>Workout history.</h2><p>Every session stays tied to the day it was scheduled and the day you actually trained.</p></div><button class="text-button" data-action="progress">PROGRESS</button></div>'+
    '<div class="history-filter-row">'+filters.map(([value,label])=>'<button class="'+(historyFilter===value?'active':'')+'" data-action="set-history-filter" data-history-filter="'+value+'">'+label+'</button>').join('')+'</div>'+
    '<div class="history-list clean-history-list">'+(rows||renderEmpty('No workouts here','Try another filter or complete a workout.'))+'</div></div>';
}

function personalRecords(){
  const map=new Map();
  for(const w of store.history)for(const ex of w.exercises)for(const s of ex.sets){if(!s.completed)continue;const c={id:ex.id,name:ex.name,weight:num(s.weight),reps:num(s.reps)};const old=map.get(ex.id);if(!old||c.weight>old.weight||(c.weight===old.weight&&c.reps>old.reps))map.set(ex.id,c);}
  return [...map.values()].sort((a,b)=>b.weight-a.weight);
}

function analyticsRangeStart(range=analyticsRange){
  const now=new Date();
  if(range==='all'){
    const dates=(store.history||[]).map(item=>new Date(item.completedAt)).filter(date=>Number.isFinite(date.getTime()));
    const oldest=dates.length?new Date(Math.min(...dates.map(date=>date.getTime()))):programOriginDate();
    return oldest<programOriginDate()?oldest:programOriginDate();
  }
  const days=range==='4w'?28:range==='3m'?90:range==='6m'?180:365;
  const start=new Date(now);start.setDate(start.getDate()-days+1);start.setHours(0,0,0,0);return start;
}
function analyticsRangeLabel(range=analyticsRange){
  return ({'4w':'4 Weeks','3m':'3 Months','6m':'6 Months','1y':'Year','all':'All Time'})[range]||'3 Months';
}
function analyticsHistory(range=analyticsRange){
  const start=analyticsRangeStart(range);
  return (store.history||[]).filter(item=>{const date=new Date(item.completedAt);return Number.isFinite(date.getTime())&&date>=start;});
}
function analyticsPlannedDates(range=analyticsRange){
  if(!store.profile||!store.plan)return [];
  const today=new Date();today.setHours(23,59,59,999);
  let from=analyticsRangeStart(range);
  const origin=programOriginDate();
  if(from<origin)from=origin;
  const preferred=preferredWorkoutDays();
  const overrides=ensureTrainingProgram().scheduleOverrides||{};
  const dates=[];
  for(let cursor=startOfWeek(from);cursor<=today;cursor=addDays(cursor,7)){
    for(const dayId of preferred){
      const date=addDays(cursor,dayOffsetFromMonday(dayId));
      if(date<from||date>today)continue;
      const key=dateKey(date);
      dates.push({date,key,status:overrides[key]?.status||'scheduled'});
    }
  }
  return dates;
}
function analyticsAdherence(range=analyticsRange){
  const planned=analyticsPlannedDates(range);
  const plannedSet=new Set(planned.map(item=>item.key));
  const completed=new Set();
  const partial=new Set();
  for(const item of analyticsHistory(range)){
    const key=item.scheduledDate||dateKey(new Date(item.completedAt));
    if(!plannedSet.has(key))continue;
    if(item.completionStatus==='partial')partial.add(key);else completed.add(key);
  }
  const scheduled=planned.length;
  return {
    scheduled,
    completed:completed.size,
    partial:partial.size,
    rate:scheduled?Math.min(1,completed.size/scheduled):0
  };
}
function analyticsWeeklySeries(range=analyticsRange,limit=8){
  const start=analyticsRangeStart(range),now=new Date(),rows=[];
  let cursor=startOfWeek(now);
  for(let i=0;i<limit;i++){
    const weekStart=addDays(cursor,-7*(limit-1-i));
    if(weekStart<start&&i<limit-1)continue;
    const weekEnd=addDays(weekStart,7);
    const sessions=(store.history||[]).filter(item=>{const d=new Date(item.completedAt);return d>=weekStart&&d<weekEnd;});
    rows.push({
      key:dateKey(weekStart),
      label:weekStart.toLocaleDateString(undefined,{month:'short',day:'numeric'}),
      workouts:sessions.filter(item=>item.completionStatus!=='partial').length,
      sets:sessions.reduce((sum,item)=>sum+num(item.completedSets),0),
      volume:sessions.reduce((sum,item)=>sum+num(item.totalVolume),0)
    });
  }
  return rows;
}
function analyticsMuscleSets(range=analyticsRange){
  const map=new Map();
  for(const workout of analyticsHistory(range)){
    for(const ex of workout.exercises||[]){
      const primary=(ex.muscles||[])[0]||movements[ex.movement]||'Other';
      const sets=(ex.sets||[]).filter(set=>set.completed).length;
      if(!sets)continue;
      map.set(primary,(map.get(primary)||0)+sets);
    }
  }
  return [...map.entries()].map(([name,sets])=>({name,sets})).sort((a,b)=>b.sets-a.sets);
}
function analyticsExerciseRows(range=analyticsRange){
  const map=new Map();
  const history=[...analyticsHistory(range)].sort((a,b)=>new Date(a.completedAt)-new Date(b.completedAt));
  for(const workout of history){
    for(const ex of workout.exercises||[]){
      const completed=(ex.sets||[]).filter(set=>set.completed);
      if(!completed.length)continue;
      let best=null;
      for(const set of completed){
        const point={weight:num(set.weight),reps:num(set.reps)};
        if(!best||point.weight>best.weight||(point.weight===best.weight&&point.reps>best.reps))best=point;
      }
      let row=map.get(ex.id);
      if(!row)row={id:ex.id,name:ex.name,loadMode:ex.loadMode||exerciseSource(ex)?.loadMode||'',sessions:0,first:null,latest:null,totalSets:0,totalVolume:0,feedback:[]};
      row.sessions+=1;row.first=row.first||best;row.latest=best;row.totalSets+=completed.length;
      row.totalVolume+=completed.reduce((sum,set)=>sum+num(set.weight)*num(set.reps),0);
      if(ex.feedback)row.feedback.push(ex.feedback);
      map.set(ex.id,row);
    }
  }
  return [...map.values()].sort((a,b)=>b.sessions-a.sessions||b.totalSets-a.totalSets);
}
function analyticsStrengthLabel(row){
  if(!row?.first||!row?.latest)return 'Building baseline';
  if(row.latest.weight>0||row.first.weight>0){
    const delta=row.latest.weight-row.first.weight;
    if(delta>0)return '+'+Math.round(delta*10)/10+' lb working load';
    if(delta<0)return Math.round(delta*10)/10+' lb working load';
    const repDelta=row.latest.reps-row.first.reps;
    if(repDelta>0)return '+'+repDelta+' reps at '+row.latest.weight+' lb';
    if(repDelta<0)return repDelta+' reps at '+row.latest.weight+' lb';
    return 'Holding steady';
  }
  const repDelta=row.latest.reps-row.first.reps;
  if(repDelta>0)return '+'+repDelta+' reps';
  if(repDelta<0)return repDelta+' reps';
  return 'Holding steady';
}
function analyticsFriction(range=analyticsRange){
  const map=new Map();
  const touch=(id,name,kind,amount=1)=>{
    if(!id)return;
    const row=map.get(id)||{id,name:name||id,score:0,swaps:0,skips:0,hard:0,form:0};
    row[kind]=(row[kind]||0)+amount;row.score+=amount;map.set(id,row);
  };
  for(const workout of analyticsHistory(range)){
    for(const ex of workout.exercises||[]){
      if(ex.skipped)touch(ex.id,ex.name,'skips',2);
      if(ex.feedback==='too-hard')touch(ex.id,ex.name,'hard',2);
      if(ex.feedback==='form-off')touch(ex.id,ex.name,'form',2);
    }
  }
  const start=analyticsRangeStart(range);
  for(const swap of store.exercisePreferences?.swapHistory||[]){
    const at=new Date(swap.at);if(!Number.isFinite(at.getTime())||at<start)continue;
    touch(swap.fromId,swap.fromName,'swaps',1);
  }
  return [...map.values()].sort((a,b)=>b.score-a.score).filter(row=>row.score>1);
}
function analyticsReadiness(range=analyticsRange){
  const rows=analyticsHistory(range).filter(item=>num(item.readiness?.score)>0);
  if(rows.length<5)return {count:rows.length,ready:false,message:'Log at least 5 workouts with Quick Check-In data to unlock readiness patterns.'};
  const low=rows.filter(item=>num(item.readiness?.score)<3);
  const high=rows.filter(item=>num(item.readiness?.score)>=3);
  const avgSets=list=>list.length?list.reduce((sum,item)=>sum+num(item.completedSets),0)/list.length:0;
  const avgMinutes=list=>list.length?list.reduce((sum,item)=>sum+num(item.durationMinutes),0)/list.length:0;
  if(low.length<2||high.length<2)return {count:rows.length,ready:false,message:'You have '+rows.length+' readiness check-ins. More low- and high-readiness days are needed before comparing them.'};
  const lowSets=avgSets(low),highSets=avgSets(high),delta=highSets-lowSets;
  const message=Math.abs(delta)<1
    ?'Completed set volume has stayed similar across lower- and higher-readiness days.'
    :'Higher-readiness sessions have averaged '+Math.abs(delta).toFixed(1)+' '+(delta>0?'more':'fewer')+' completed sets than lower-readiness sessions.';
  return {count:rows.length,ready:true,lowSets,highSets,lowMinutes:avgMinutes(low),highMinutes:avgMinutes(high),message};
}
function analyticsTogether(range=analyticsRange){
  const sessions=analyticsHistory(range).filter(item=>item.sharedSession);
  return {
    sessions:sessions.length,
    minutes:sessions.reduce((sum,item)=>sum+num(item.durationMinutes),0),
    sets:sessions.reduce((sum,item)=>sum+num(item.completedSets),0),
    prs:sessions.reduce((sum,item)=>sum+(item.newPRs?.length||0),0)
  };
}
function analyticsProgram(range=analyticsRange){
  const history=analyticsHistory(range);
  const adherence=analyticsAdherence(range);
  return {
    adherence,
    sessions:history.filter(item=>item.completionStatus!=='partial').length,
    partial:history.filter(item=>item.completionStatus==='partial').length,
    sets:history.reduce((sum,item)=>sum+num(item.completedSets),0),
    minutes:history.reduce((sum,item)=>sum+num(item.durationMinutes),0),
    prs:history.reduce((sum,item)=>sum+(item.newPRs?.length||0),0),
    averageMinutes:history.length?Math.round(history.reduce((sum,item)=>sum+num(item.durationMinutes),0)/history.length):0
  };
}
function analyticsRecentPRs(range=analyticsRange,limit=8){
  const rows=[];
  for(const workout of analyticsHistory(range)){
    for(const pr of workout.newPRs||[])rows.push({...pr,date:workout.completedAt});
  }
  return rows.slice(0,limit);
}
function analyticsHeatmap(days=28){
  const out=[],today=new Date();today.setHours(0,0,0,0);
  const historyByDate=new Map();
  for(const item of store.history||[]){
    const key=item.actualCompletedDate||dateKey(new Date(item.completedAt));
    const previous=historyByDate.get(key);
    if(!previous||previous.completionStatus==='partial')historyByDate.set(key,item);
  }
  const planned=new Set(analyticsPlannedDates('4w').map(item=>item.key));
  for(let i=days-1;i>=0;i--){
    const date=addDays(today,-i),key=dateKey(date),history=historyByDate.get(key);
    let state=history?(history.completionStatus==='partial'?'partial':'complete'):planned.has(key)&&date<today?'missed':planned.has(key)?'planned':'rest';
    out.push({key,date,state,label:date.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})});
  }
  return out;
}
function analyticsInsights(range=analyticsRange){
  const program=analyticsProgram(range),weekly=analyticsWeeklySeries(range,4),friction=analyticsFriction(range),readiness=analyticsReadiness(range);
  const insights=[];
  if(program.adherence.scheduled){
    const pct=Math.round(program.adherence.rate*100);
    insights.push({label:'CONSISTENCY',title:pct+'% scheduled-session adherence',copy:program.adherence.completed+' of '+program.adherence.scheduled+' planned sessions were completed in this view.'});
  }
  if(weekly.length>=4){
    const recent=weekly.slice(-2).reduce((sum,row)=>sum+row.sets,0);
    const prior=weekly.slice(-4,-2).reduce((sum,row)=>sum+row.sets,0);
    if(prior>0){
      const change=Math.round(((recent-prior)/prior)*100);
      insights.push({label:'TRAINING LOAD',title:(change>=0?'+':'')+change+'% completed sets',copy:'Comparing the latest two weeks with the two weeks before them.'});
    }
  }
  if(friction[0]){
    const f=friction[0];
    insights.push({label:'EXERCISE FIT',title:f.name+' needs attention',copy:[f.swaps?f.swaps+' swap'+(f.swaps===1?'':'s'):'',f.skips?f.skips+' skip'+(f.skips===1?'':'s'):'',f.hard?f.hard+' too-hard rating'+(f.hard===1?'':'s'):'',f.form?f.form+' form concern'+(f.form===1?'':'s'):''].filter(Boolean).join(' · ')});
  }else if(readiness.ready){
    insights.push({label:'READINESS',title:'Your check-ins are becoming useful',copy:readiness.message});
  }
  return insights.slice(0,3);
}
function workoutSummaryInsight(item){
  if(!item)return '';
  const previous=(store.history||[]).find(other=>other.id!==item.id&&other.routineName===item.routineName&&new Date(other.completedAt)<new Date(item.completedAt));
  if(!previous)return 'This session establishes a comparison point for '+item.routineName+'.';
  const setDelta=num(item.completedSets)-num(previous.completedSets);
  const minuteDelta=num(item.durationMinutes)-num(previous.durationMinutes);
  if(setDelta>0)return 'You completed '+setDelta+' more working set'+(setDelta===1?'':'s')+' than the previous '+item.routineName+' session.';
  if(setDelta===0&&minuteDelta<0)return 'You completed the same number of sets '+Math.abs(minuteDelta)+' minute'+(Math.abs(minuteDelta)===1?'':'s')+' faster than last time.';
  if(item.newPRs?.length)return 'You matched the session structure and added '+item.newPRs.length+' new personal record'+(item.newPRs.length===1?'':'s')+'.';
  return 'This session is now part of your trend data for the next program decision.';
}
function renderAnalyticsBars(rows,key,labelKey,formatter=value=>String(value)){
  if(!rows.length)return '<div class="analytics-empty">Complete workouts to populate this view.</div>';
  const max=Math.max(1,...rows.map(row=>num(row[key])));
  return '<div class="analytics-bars">'+rows.map(row=>'<div class="analytics-bar-row"><span>'+esc(row[labelKey])+'</span><div><i style="width:'+Math.max(2,Math.round(num(row[key])/max*100))+'%"></i></div><strong>'+esc(formatter(num(row[key])))+'</strong></div>').join('')+'</div>';
}
function renderProgress(){
  const history=analyticsHistory(),program=analyticsProgram(),weekly=analyticsWeeklySeries(),muscles=analyticsMuscleSets(),exerciseRows=analyticsExerciseRows();
  const prs=analyticsRecentPRs(),readiness=analyticsReadiness(),together=analyticsTogether(),friction=analyticsFriction(),insights=analyticsInsights();
  const heatmap=analyticsHeatmap(),context=programContext();
  const allVolume=history.reduce((sum,item)=>sum+num(item.totalVolume),0);
  const periodOptions=[['4w','4 Weeks'],['3m','3 Months'],['6m','6 Months'],['1y','Year'],['all','All Time']];
  const topExercises=exerciseRows.slice(0,6);
  const topMuscles=muscles.slice(0,8);
  return '<div class="clean-page progress-clean analytics-page">'+
    '<div class="clean-page-head analytics-head"><div><p class="eyebrow">PROGRESS</p><h2>Are you actually improving?</h2><p>Training trends, consistency, strength, recovery patterns and what your program should learn next.</p></div><button class="button secondary" data-action="history">HISTORY</button></div>'+
    '<div class="analytics-range">'+periodOptions.map(([value,label])=>'<button class="'+(analyticsRange===value?'active':'')+'" data-action="set-analytics-range" data-analytics-range="'+value+'">'+label+'</button>').join('')+'</div>'+
    '<div class="progress-overview-grid analytics-kpis">'+
      '<section class="clean-panel metric-panel"><span>WORKOUTS</span><strong>'+program.sessions+'</strong><small>'+analyticsRangeLabel()+'</small></section>'+
      '<section class="clean-panel metric-panel"><span>ADHERENCE</span><strong>'+(program.adherence.scheduled?Math.round(program.adherence.rate*100)+'%':'—')+'</strong><small>'+program.adherence.completed+'/'+program.adherence.scheduled+' scheduled</small></section>'+
      '<section class="clean-panel metric-panel"><span>WORKING SETS</span><strong>'+program.sets+'</strong><small>'+formatVolume(allVolume)+' volume</small></section>'+
      '<section class="clean-panel metric-panel"><span>PERSONAL RECORDS</span><strong>'+program.prs+'</strong><small>'+program.minutes+' training minutes</small></section>'+
    '</div>'+
    (insights.length?'<section class="analytics-insight-grid">'+insights.map(item=>'<article class="clean-panel analytics-insight"><span>'+esc(item.label)+'</span><strong>'+esc(item.title)+'</strong><p>'+esc(item.copy)+'</p></article>').join('')+'</section>':'')+
    '<section class="clean-section analytics-section"><div class="clean-section-head"><div><p class="eyebrow">CONSISTENCY</p><h3>Last 28 days</h3><p>Completed, partial and missed scheduled days. Rest days stay quiet.</p></div></div>'+
      '<div class="analytics-heatmap">'+heatmap.map(day=>'<div class="analytics-day '+day.state+'" title="'+esc(day.label+' · '+day.state)+'"><span>'+day.date.getDate()+'</span></div>').join('')+'</div>'+
      '<div class="analytics-legend"><span><i class="complete"></i>Completed</span><span><i class="partial"></i>Partial</span><span><i class="missed"></i>Missed</span><span><i class="rest"></i>Rest / upcoming</span></div>'+
    '</section>'+
    '<section class="analytics-two-col">'+
      '<article class="clean-panel analytics-chart-card"><div><p class="eyebrow">TRAINING LOAD</p><h3>Completed sets by week</h3></div>'+renderAnalyticsBars(weekly,'sets','label',value=>String(Math.round(value)))+'</article>'+
      '<article class="clean-panel analytics-chart-card"><div><p class="eyebrow">MUSCLE EMPHASIS</p><h3>Primary working sets</h3><p>Counts the primary muscle listed for each completed exercise set.</p></div>'+renderAnalyticsBars(topMuscles,'sets','name',value=>String(Math.round(value)))+'</article>'+
    '</section>'+
    '<section class="clean-section analytics-section"><div class="clean-section-head"><div><p class="eyebrow">STRENGTH & EXERCISES</p><h3>Movements you train most</h3><p>Change compares the first and latest best logged set inside this time range.</p></div></div>'+
      (topExercises.length?'<div class="analytics-exercise-list">'+topExercises.map(row=>'<button data-exercise-detail="'+esc(row.id)+'"><div><strong>'+esc(row.name)+'</strong><span>'+row.sessions+' session'+(row.sessions===1?'':'s')+' · '+row.totalSets+' sets</span></div><em>'+esc(analyticsStrengthLabel(row))+'</em></button>').join('')+'</div>':'<div class="analytics-empty">Complete a few workouts to establish exercise trends.</div>')+
    '</section>'+
    '<section class="analytics-two-col">'+
      '<article class="clean-panel analytics-readiness-card"><p class="eyebrow">READINESS × PERFORMANCE</p><h3>'+readiness.count+' check-in'+(readiness.count===1?'':'s')+'</h3><p>'+esc(readiness.message)+'</p>'+(readiness.ready?'<div class="readiness-compare"><div><span>LOWER READINESS</span><strong>'+readiness.lowSets.toFixed(1)+' sets</strong><small>average completed</small></div><div><span>3+ READINESS</span><strong>'+readiness.highSets.toFixed(1)+' sets</strong><small>average completed</small></div></div>':'')+'</article>'+
      '<article class="clean-panel analytics-program-card"><p class="eyebrow">CURRENT PROGRAM</p><h3>Block '+context.blockNumber+' · Week '+context.blockWeek+'</h3><div class="analytics-program-grid"><div><span>AVG SESSION</span><strong>'+program.averageMinutes+' min</strong></div><div><span>PARTIAL</span><strong>'+program.partial+'</strong></div><div><span>PRS</span><strong>'+program.prs+'</strong></div><div><span>PHASE</span><strong>'+esc(blockPhaseLabel(context.blockWeek))+'</strong></div></div><p>'+esc(adaptationDecision().notes.join(' ')||'Keep building from your logged performance and feedback.')+'</p></article>'+
    '</section>'+
    (friction.length?'<section class="clean-section analytics-section"><div class="clean-section-head"><div><p class="eyebrow">EXERCISE FIT</p><h3>Patterns worth reviewing</h3><p>Repeated swaps, skips, difficulty ratings or form concerns can signal that a movement does not fit your program well.</p></div></div><div class="analytics-friction-list">'+friction.slice(0,5).map(row=>'<article><div><strong>'+esc(row.name)+'</strong><span>'+[row.swaps?row.swaps+' swaps':'',row.skips?row.skips+' skips':'',row.hard?row.hard+' too hard':'',row.form?row.form+' form concerns':''].filter(Boolean).join(' · ')+'</span></div><em>REVIEW</em></article>').join('')+'</div></section>':'')+
    '<section class="analytics-two-col">'+
      '<article class="clean-panel analytics-together-card"><p class="eyebrow">TOGETHER</p><h3>'+together.sessions+' shared workout'+(together.sessions===1?'':'s')+'</h3><div class="analytics-program-grid"><div><span>TIME</span><strong>'+together.minutes+' min</strong></div><div><span>SETS</span><strong>'+together.sets+'</strong></div><div><span>PRS</span><strong>'+together.prs+'</strong></div></div><p>Shared sessions stay collaborative. Each person’s detailed performance remains in their own history.</p></article>'+
      '<article class="clean-panel analytics-pr-card"><p class="eyebrow">PR TROPHY ROOM</p><h3>Recent personal records</h3>'+(prs.length?'<div class="analytics-pr-list">'+prs.map(pr=>'<div><span>'+esc(pr.name)+'</span><strong>'+(pr.weight?esc(pr.weight+' lb × '+pr.reps):esc(pr.reps+' reps'))+'</strong><small>'+esc(formatDate(pr.date))+'</small></div>').join('')+'</div>':'<p>No new PRs in this range yet.</p>')+'</article>'+
    '</section>'+
    '<section class="clean-panel analytics-engine-card"><div><span>PROGRAM INTELLIGENCE</span><strong>Track → understand → recommend → you approve.</strong><p>Analytics can inform future programming, but Workout should explain the pattern before changing your plan.</p></div></section>'+
  '</div>';
}

function renderSummary(){
  const x=store.history.find(h=>h.id===store.lastSummaryId)||store.history[0];if(!x)return renderHistory();
  const partial=x.completionStatus==='partial';
  return '<div class="summary-hero clean-summary"><div class="summary-check">'+(partial?'◐':'✓')+'</div><p class="eyebrow">'+(partial?'PARTIAL WORKOUT SAVED':'WORKOUT COMPLETE')+'</p><h2>'+esc(x.routineName)+'</h2><p>'+(partial?'Your completed work is preserved. This scheduled session remains partial.':'History and progression were updated from what you actually logged.')+'</p><div class="summary-grid"><div class="summary-card"><strong>'+x.durationMinutes+'</strong><span>Minutes</span></div><div class="summary-card"><strong>'+x.completedSets+'</strong><span>Sets</span></div><div class="summary-card"><strong>'+formatVolume(x.totalVolume||0)+'</strong><span>Volume</span></div></div>'+
    (x.newPRs?.length?'<section class="clean-panel summary-prs"><p class="eyebrow">NEW PERSONAL RECORDS</p><div class="pr-list">'+x.newPRs.map(pr=>'<div class="pr-row"><span>'+esc(pr.name)+'</span><strong>'+(pr.weight?pr.weight+' lb × '+pr.reps:pr.reps+' reps')+'</strong></div>').join('')+'</div></section>':'')+
    (x.sharedSession?'<section class="clean-panel shared-summary-card"><span>SHARED SESSION</span><strong>With '+esc(x.sharedSession.partnerName||'Partner')+'</strong><small>Your performance remains in your own history.</small></section>':'')+
    '<div class="summary-actions"><button class="button" data-action="home">BACK HOME</button><button class="button secondary" data-action="history">VIEW HISTORY</button></div></div>';
}

function renderEmpty(title,copy){return `<div class="empty-state"><div class="empty-glyph">W/</div><h2>${esc(title)}</h2><p>${esc(copy)}</p></div>`;}

function setTab(tab){
  if(!store.profile&&!['profile','profile-edit'].includes(tab)){currentTab='profile-edit';}
  else currentTab=tab;
  persistUiState();
  render();updateTimers();window.scrollTo({top:0,behavior:'smooth'});
}
function syncNav(){
  const navTab=currentTab==='workout'?'train':currentTab==='catalog'?'train':currentTab==='history'||currentTab==='summary'?'progress':currentTab==='profile-edit'?'profile':currentTab;
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.tab===navTab));
  const nav=document.querySelector('.bottom-nav');if(nav)nav.classList.toggle('nav-disabled',!store.profile);
}
function syncShellIdentity(){
  const avatar=document.querySelector('.avatar');
  if(avatar){
    const name=store.account?.displayName||store.profile?.displayName||'Me';
    const initials=String(name).split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase();
    avatar.textContent=initials||'ME';
  }
}
function syncLiveBadge(){const b=document.querySelector('.nav-live');if(b)b.hidden=!store.activeWorkout;}
function toast(message){const r=document.querySelector('#toast-region')||document.body;r.querySelector('.toast')?.remove();const n=document.createElement('div');n.className='toast';n.textContent=message;r.append(n);setTimeout(()=>n.remove(),2300);}

function renderAccountEntry(){
  const email=esc(store.account?.email||store.profile?.email||'');
  if(authMode==='forgot'){
    return '<div class="onboard-shell account-entry-shell">'+
      '<section class="account-entry-hero"><p class="eyebrow">WORKOUT</p><h1>Reset your password.</h1><p>Enter the email for your Workout account. We’ll send a secure password-reset link.</p></section>'+
      '<section class="form-section account-entry-card"><div class="form-section-head"><span>RESET</span><div><h3>Forgot password</h3><p>The reset email is only for this Workout app.</p></div></div>'+
        '<label class="field"><span>EMAIL</span><input id="forgot-email" type="email" autocomplete="email" value="'+email+'" placeholder="you@example.com"></label>'+
        '<button class="button" data-action="auth-send-reset">SEND RESET LINK</button>'+
        '<button class="text-button" data-action="auth-back-to-sign-in">BACK TO SIGN IN</button>'+
      '</section></div>';
  }
  if(authMode==='reset'){
    return '<div class="onboard-shell account-entry-shell">'+
      '<section class="account-entry-hero"><p class="eyebrow">WORKOUT</p><h1>Choose a new password.</h1><p>Set the new password for your Workout account.</p></section>'+
      '<section class="form-section account-entry-card"><div class="form-section-head"><span>RESET</span><div><h3>New password</h3><p>Use at least 6 characters.</p></div></div>'+
        '<label class="field"><span>NEW PASSWORD</span><input id="reset-password" type="password" autocomplete="new-password" placeholder="At least 6 characters"></label>'+
        '<label class="field"><span>CONFIRM PASSWORD</span><input id="reset-password-confirm" type="password" autocomplete="new-password" placeholder="Enter it again"></label>'+
        '<button class="button" data-action="auth-save-password">SAVE NEW PASSWORD</button>'+
      '</section></div>';
  }
  return '<div class="onboard-shell account-entry-shell">'+
    '<section class="account-entry-hero"><p class="eyebrow">WORKOUT</p><h1>Training that learns you.</h1><p>Sign in to continue your program on this device, or create a Workout account before building your first plan.</p></section>'+
    '<section class="form-section account-entry-card"><div class="form-section-head"><span>01</span><div><h3>Account</h3><p>Your profile, program, progress, history and active workout sync through your Workout account.</p></div></div>'+
      '<div class="form-grid two">'+
        '<label class="field"><span>DISPLAY NAME</span><input id="entry-display-name" autocomplete="name" value="'+esc(store.account?.displayName||store.profile?.displayName||'')+'" placeholder="Needed when creating an account"></label>'+
        '<label class="field"><span>EMAIL</span><input id="entry-email" type="email" autocomplete="email" value="'+email+'" placeholder="you@example.com"></label>'+
      '</div>'+
      '<label class="field"><span>PASSWORD</span><input id="entry-password" type="password" autocomplete="current-password" placeholder="At least 6 characters"></label>'+
      '<button class="text-button account-forgot" data-action="entry-forgot-password">FORGOT PASSWORD?</button>'+
      '<div class="auth-choice-grid"><button class="button" data-action="entry-sign-in">SIGN IN</button><button class="button secondary" data-action="entry-create-account">CREATE ACCOUNT</button></div>'+
    '</section>'+
    '<div class="profile-privacy-note"><strong>No email verification step.</strong><span>New Workout accounts are ready to use immediately after creation.</span></div>'+
  '</div>';
}

function render(){
  const app=document.querySelector('#app');if(!app)return;
  if(!authReady){app.innerHTML='<div class="clean-page empty-workout-page"><p class="eyebrow">WORKOUT</p><h2>Loading your training account…</h2></div>';return;}
  if(authMode==='reset'){app.innerHTML=renderAccountEntry();document.body.classList.remove('modal-open','workout-mode');return;}
  if(store.account?.status!=='connected'){app.innerHTML=renderAccountEntry();document.body.classList.remove('modal-open','workout-mode');return;}
  if(currentTab==='profile-edit')app.innerHTML=renderProfileEditor();
  else if(currentTab==='profile')app.innerHTML=renderProfileHub();
  else if(currentTab==='home')app.innerHTML=renderHome();
  else if(currentTab==='train')app.innerHTML=renderTrain();
  else if(currentTab==='together')app.innerHTML=renderTogether();
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
  if(cueSettingsOpen) app.insertAdjacentHTML('beforeend',renderCueSettingsSheet());
  if(exerciseActionsIndex!==null) app.insertAdjacentHTML('beforeend',renderExerciseActionsSheet());
  if(historyMenuId) app.insertAdjacentHTML('beforeend',renderHistoryMenuSheet());
  if(planImportOpen) app.insertAdjacentHTML('beforeend',renderPlanImportModal());
  if(customExerciseOpen) app.insertAdjacentHTML('beforeend',renderCustomExerciseModal());
  if(accountSheetOpen) app.insertAdjacentHTML('beforeend',renderAccountSheet());
  document.body.classList.toggle('modal-open',Boolean(exerciseDetailId||swapContext||readinessContext||workoutMapOpen||setEditContext||cueSettingsOpen||exerciseActionsIndex!==null||historyMenuId||planImportOpen||customExerciseOpen||accountSheetOpen));
  document.body.classList.toggle('workout-mode',currentTab==='workout'&&Boolean(store.activeWorkout));
  syncNav();syncLiveBadge();syncShellIdentity();persistUiState();
}

function updateTimers(){
  const w=store.activeWorkout;if(!w)return;
  const elapsed=document.querySelector('#elapsed-clock'),exerciseClock=document.querySelector('#exercise-clock');
  if(elapsed)elapsed.textContent=formatClock(workoutElapsedSeconds(w));
  if(exerciseClock&&['work','rest','calibrate','feedback','pre-set','timed-set'].includes(w.phase))exerciseClock.textContent=formatClock(exerciseElapsedSeconds(w));
  if(w.isPaused)return;
  if(['warmup','cooldown'].includes(w.phase)){
    const snap=timedStageSnapshot(w);if(!snap)return;
    if(snap.complete){completeTimedStagePhase(w);return;}
    if(snap.stageComplete){advanceTimedStage(false);return;}
    const stage=document.querySelector('.timed-stage'),renderedIndex=Number(stage?.dataset.stageIndex),expectedMode=snap.ready?'ready':snap.manual?'manual':'timed';
    if((Number.isFinite(renderedIndex)&&renderedIndex!==snap.index)||stage?.dataset.stageMode!==expectedMode){render();return;}
    if(snap.ready){const clock=document.querySelector('#stage-clock');if(clock)clock.textContent=String(snap.remaining);if(snap.remaining<=3)fireWorkoutSignal('tick','prep-ready-'+w.id+'-'+w.phase+'-'+snap.index+'-'+snap.remaining,{voice:String(snap.remaining),label:String(snap.remaining)});return;}
    if(snap.manual)return;
    if(snap.remaining>0&&snap.remaining<=3)fireWorkoutSignal('warning','stage-warning-'+w.id+'-'+w.phase+'-'+snap.index+'-'+snap.remaining,{voice:String(snap.remaining),label:String(snap.remaining)});
    const clock=document.querySelector('#stage-clock'),fill=document.querySelector('#stage-progress-fill');if(clock)clock.textContent=formatClock(snap.remaining);if(fill)fill.style.width=`${Math.max(0,Math.min(100,(snap.remaining/Math.max(1,snap.total))*100))}%`;return;
  }
  if(w.phase==='pre-set'){const snap=preSetSnapshot(w);if(!snap)return;if(snap.complete){finishPreSet();return;}const stage=document.querySelector('.clean-preset-stage');if(stage?.dataset.presetMode!==snap.mode){render();return;}if(snap.mode==='countdown'&&snap.remaining<=3)fireWorkoutSignal('tick','preset-tick-'+w.id+'-'+w.currentExerciseIndex+'-'+w.currentSetIndex+'-'+snap.remaining,{voice:String(snap.remaining),label:String(snap.remaining)});const count=document.querySelector('#preset-count'),label=document.querySelector('#preset-label');if(count)count.textContent=String(snap.remaining);if(label)label.textContent=snap.mode==='setup'?'Set up your equipment':'Get ready';return;}
  if(w.phase==='timed-set'){const snap=timedSetSnapshot(w);if(!snap)return;if(snap.complete){completeTimedSet(false);return;}if(snap.remaining<=3&&snap.remaining>0)fireWorkoutSignal('warning','timed-set-warning-'+w.id+'-'+w.currentExerciseIndex+'-'+w.currentSetIndex+'-'+snap.remaining,{voice:String(snap.remaining),label:String(snap.remaining)});const clock=document.querySelector('#timed-set-clock'),fill=document.querySelector('#timed-set-progress'),note=document.querySelector('#timed-finish-note');if(clock)clock.textContent=formatClock(snap.remaining);if(fill)fill.style.width=`${Math.max(0,Math.min(100,(snap.remaining/Math.max(1,snap.total))*100))}%`;if(note)note.textContent=snap.remaining<=3?String(snap.remaining)+'…':'Stay controlled. You’ll get a finish cue at zero.';return;}
  if(w.phase!=='rest')return;
  const remaining=restRemaining(w),clock=document.querySelector('#rest-clock'),ring=document.querySelector('#timer-ring');
  if(clock)clock.textContent=formatClock(remaining);if(ring)ring.style.setProperty('--timer-progress',`${restProgress(w)}%`);
  if(remaining>0&&remaining<=3&&!Number.isFinite(w.restPausedRemaining))fireWorkoutSignal('warning','rest-warning-'+w.id+'-'+w.currentExerciseIndex+'-'+w.currentSetIndex+'-'+remaining,{voice:String(remaining),label:String(remaining)});
  if(remaining<=0&&!Number.isFinite(w.restPausedRemaining))advanceAfterRest();
}

function handleClick(event){
  const accountClose=event.target.closest('[data-action="close-account-sheet"]');
  if(accountClose){
    const inside=event.target.closest('[data-account-sheet-panel]');
    const explicit=event.target.closest('.modal-close');
    if(!inside||explicit){accountSheetOpen=false;render();return;}
  }
  const cueClose=event.target.closest('[data-action="close-cue-settings"]');
  if(cueClose){
    const inside=event.target.closest('[data-cue-settings-panel]');
    const explicit=event.target.closest('.modal-close');
    if(!inside||explicit){cueSettingsOpen=false;render();return;}
  }
  const exerciseActionsClose=event.target.closest('[data-action="close-exercise-actions"]');
  if(exerciseActionsClose){
    const inside=event.target.closest('[data-exercise-actions-panel]');
    const explicit=event.target.closest('.modal-close');
    if(!inside||explicit){exerciseActionsIndex=null;render();return;}
  }
  const historyClose=event.target.closest('[data-action="close-history-menu"]');
  if(historyClose){
    const inside=event.target.closest('[data-history-menu-panel]');
    const explicit=event.target.closest('.modal-close');
    if(!inside||explicit){historyMenuId=null;render();return;}
  }
  const setClose=event.target.closest('[data-action="close-set-editor"]');
  if(setClose){
    const inside=event.target.closest('[data-set-edit-panel]');
    const explicit=event.target.closest('.modal-close');
    if(!inside||explicit){closeSetEditor();return;}
  }
  const mapClose=event.target.closest('[data-action="close-workout-map"]');
  if(mapClose){
    const inside=event.target.closest('[data-workout-map-panel]');
    const explicit=event.target.closest('.modal-close');
    if(!inside||explicit){workoutMapOpen=false;render();return;}
  }
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
  const importClose=event.target.closest('[data-action="close-plan-import"]');
  if(importClose){
    const inside=event.target.closest('[data-plan-import-panel]');
    const explicit=event.target.closest('.modal-close');
    if(!inside||explicit){planImportOpen=false;planImportDraft=null;render();return;}
  }
  const customClose=event.target.closest('[data-action="close-custom-exercise"]');
  if(customClose){
    const inside=event.target.closest('[data-custom-exercise-panel]');
    const explicit=event.target.closest('.modal-close');
    if(!inside||explicit){customExerciseOpen=false;render();return;}
  }
  const detail=event.target.closest('[data-exercise-detail]');
  if(detail){exerciseActionsIndex=null;exerciseDetailId=detail.dataset.exerciseDetail;const opened=findExercise(exerciseDetailId)||store.activeWorkout?.exercises?.find(item=>item.id===exerciseDetailId);exerciseDetailMetric=defaultExerciseDetailMetric(opened);exerciseDetailRange='8';render();return;}
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
  const allowedWhilePaused=['toggle-workout-pause','home','go-home','finish','discard','toggle-sound','toggle-voice','toggle-flash','toggle-haptics','test-cues','open-workout-map','close-workout-map','edit-set','close-set-editor','open-cue-settings','close-cue-settings','open-exercise-actions','close-exercise-actions','preview-exercise','previous-exercise','next-exercise','back-to-workout','toggle-form-mode','set-exercise-detail-metric','set-exercise-detail-range','save-exercise-memory','set-prep-length','toggle-prefer-reps','toggle-skip-static','toggle-always-mobility'];
  if(store.activeWorkout?.isPaused&&!allowedWhilePaused.includes(a)){
    toast('Resume the workout before changing the active set or timer.');
    return;
  }
  if(a==='go-home'||a==='home')setTab('home');
  else if(a==='train')setTab('train');
  else if(a==='together')setTab('together');
  else if(a==='progress')setTab('progress');
  else if(a==='profile')setTab('profile');
  else if(a==='catalog'||a==='open-routine-details')setTab('catalog');
  else if(a==='history')setTab('history');
  else if(a==='share-next-workout')setTab('together');
  else if(a==='create-shared-draft')createSharedDraft();
  else if(a==='join-shared-session')joinSharedSession();
  else if(a==='cancel-shared-draft')cancelSharedDraft();
  else if(a==='start-shared-workout')startSharedWorkout();
  else if(a==='copy-shared-code')copySharedCode();
  else if(a==='save-together-settings')saveTogetherSettings();
  else if(a==='confirm-together-plan')confirmTogetherPlan();

  else if(a==='account-info'){accountSheetOpen=true;render();}
  else if(a==='entry-sign-in')signInEntryAccount();
  else if(a==='entry-create-account')createEntryAccount();
  else if(a==='entry-forgot-password')beginForgotPassword();
  else if(a==='account-forgot-password'){accountSheetOpen=false;beginForgotPassword();}
  else if(a==='auth-back-to-sign-in')cancelForgotPassword();
  else if(a==='auth-send-reset')sendWorkoutPasswordReset();
  else if(a==='auth-save-password')saveRecoveredPassword();
  else if(a==='account-sign-in')signInWorkoutAccount();
  else if(a==='account-create')createWorkoutAccount();
  else if(a==='onboard-create-account')createOnboardingAccount();
  else if(a==='account-sign-out')signOutWorkoutAccount();
  else if(a==='open-cue-settings'){cueSettingsOpen=true;render();}
  else if(a==='open-exercise-actions'){exerciseActionsIndex=Number(node.dataset.exerciseIndex);render();}
  else if(a==='open-history-menu'||a==='history-details'){historyMenuId=node.dataset.historyId;render();}
  else if(a==='set-history-filter'){historyFilter=node.dataset.historyFilter||'all';render();}
  else if(a==='set-analytics-range'){analyticsRange=node.dataset.analyticsRange||'3m';persistUiState();render();}
  else if(a==='set-exercise-detail-metric'){exerciseDetailMetric=node.dataset.metric||exerciseDetailMetric;render();}
  else if(a==='set-exercise-detail-range'){exerciseDetailRange=node.dataset.range||'8';render();}
  else if(a==='save-exercise-memory')saveExerciseDetailMemory(exerciseDetailId);
  else if(a==='open-plan-import'){planImportOpen=true;planImportDraft=null;render();}
  else if(a==='parse-plan-import'){
    const parsed=parseImportedPlanText(document.querySelector('#plan-import-text')?.value||'');
    if(!parsed){toast('I could not find workout days and set/rep lines in that text.');return;}
    parsed.source='paste';planImportDraft=parsed;render();
  }
  else if(a==='apply-imported-plan')applyImportedPlan(node.dataset.importStrategy||'follow');
  else if(a==='open-custom-exercise'){customExerciseOpen=true;render();}
  else if(a==='save-custom-exercise')saveCustomExercise();
  else if(a==='resume'){unlockWorkoutCues();setTab('workout');}
  else if(a==='edit-profile')editProfile();
  else if(a==='build-plan')saveProfileFromForm(document.querySelector('#profile-form'));
  else if(a==='skip-scheduled')skipScheduledSession(node.dataset.scheduledDate);
  else if(a==='undo-skip-scheduled')undoSkipScheduledSession(node.dataset.scheduledDate);
  else if(a==='mark-scheduled-complete')markScheduledWorkoutComplete(node.dataset.dayId,node.dataset.scheduledDate);
  else if(a==='remove-history'){historyMenuId=null;removeHistoryWorkout(node.dataset.historyId);}
  else if(a==='begin-workout')startPreparedWorkout();
  else if(a==='begin-session')beginWorkoutSession();
  else if(a==='open-workout-map'){workoutMapOpen=true;render();}
  else if(a==='previous-exercise')navigateExercise(-1);
  else if(a==='next-exercise')navigateExercise(1);
  else if(a==='preview-exercise')previewExercise(Number(node.dataset.exerciseIndex));
  else if(a==='back-to-workout')backToWorkout();
  else if(a==='start-previewed-exercise')startPreviewedExercise();
  else if(a==='toggle-form-mode'){workoutFormMode=!workoutFormMode;render();}
  else if(a==='jump-exercise')previewExercise(Number(node.dataset.exerciseIndex));
  else if(a==='jump-from-review')jumpFromReview(Number(node.dataset.exerciseIndex));
  else if(a==='continue-exercise')navigateToExercise(Number(node.dataset.exerciseIndex));
  else if(a==='mark-exercise-complete'){exerciseActionsIndex=null;markExerciseManual(Number(node.dataset.exerciseIndex));}
  else if(a==='undo-manual-exercise')undoManualExercise(Number(node.dataset.exerciseIndex));
  else if(a==='skip-exercise'){exerciseActionsIndex=null;skipExercise(Number(node.dataset.exerciseIndex));}
  else if(a==='restore-exercise'){exerciseActionsIndex=null;restoreExercise(Number(node.dataset.exerciseIndex));}
  else if(a==='move-exercise-later'){exerciseActionsIndex=null;moveExerciseLater(Number(node.dataset.exerciseIndex));}
  else if(a==='add-set')addWorkingSet(Number(node.dataset.exerciseIndex));
  else if(a==='edit-set')openSetEditor(Number(node.dataset.exerciseIndex),Number(node.dataset.setIndex));
  else if(a==='save-set-edit')saveSetEdit();
  else if(a==='delete-set')deleteSetFromExercise();
  else if(a==='ready-next-exercise'){
    const w=store.activeWorkout,next=w?.pendingPosition;
    if(next)beginPreSetPosition(next.ei,next.si,true);
  }
  else if(a==='open-workout-review')openWorkoutReview();
  else if(a==='continue-workout')continueWorkoutFromReview();
  else if(a==='save-workout-complete')finalizeWorkout('complete');
  else if(a==='finish-workout-anyway')finalizeWorkout('complete');
  else if(a==='save-workout-partial')finalizeWorkout('partial');
  else if(a==='regenerate')regeneratePlan();
  else if(a==='swap-plan')openSwap({mode:'plan',dayId:node.dataset.dayId,index:Number(node.dataset.swapIndex)});
  else if(a==='swap-active'){exerciseActionsIndex=null;openSwap({mode:'active',index:Number(node.dataset.swapIndex)});}
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
  else if(a==='set-prep-length')setPrepSetting(node.dataset.prepKind,node.dataset.prepValue);
  else if(a==='toggle-prefer-reps')setPrepSetting('preferReps',!prepSettings().preferReps);
  else if(a==='toggle-skip-static')setPrepSetting('skipStatic',!prepSettings().skipStatic);
  else if(a==='toggle-always-mobility')setPrepSetting('alwaysMobility',!prepSettings().alwaysMobility);
  else if(a==='test-cues'){
    unlockWorkoutCues();
    fireWorkoutSignal('go','cue-test-'+Date.now(),{voice:'Cue test. Ready.',label:'READY'});
  }
  else if(a==='add-rest')adjustRest(15);
  else if(a==='pause-rest')toggleRestPause();
  else if(a==='skip-rest')skipRest();
  else if(a==='reset-timer')resetActiveTimer();
  else if(a==='skip-stage')advanceTimedStage(true);
  else if(a==='stage-done')advanceTimedStage(false);
  else if(a==='stage-start-now'){if(store.activeWorkout)store.activeWorkout.timedStageStartedAt=new Date().toISOString();saveStore();render();}
  else if(a==='skip-remaining-prep')skipRemainingPrep();
  else if(a==='prep-feedback')recordPrepFeedback(node.dataset.prepFeedback||'right');
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
    const media=img.closest('.exercise-media, .exercise-modal-media');
    img.remove();
    if(media&&!media.querySelector('img'))media.classList.add('image-unavailable');
  }
},true);
document.addEventListener('submit',event=>{
  if(event.target.id==='profile-form'){
    event.preventDefault();
    saveProfileFromForm(event.target);
  }
});
document.addEventListener('input',event=>{
  if(event.target.id==='catalog-search'){
    catalogQuery=event.target.value;const caret=event.target.selectionStart;render();const input=document.querySelector('#catalog-search');if(input){input.focus();input.setSelectionRange(caret,caret);}return;
  }
  if(event.target.id==='set-weight'||event.target.id==='set-reps'){autosaveCurrentSetDraft();return;}
  if(event.target.dataset.importDayName!==undefined&&planImportDraft){
    const di=num(event.target.dataset.importDayName);if(planImportDraft.days?.[di])planImportDraft.days[di].name=event.target.value;return;
  }
  if(event.target.dataset.importExerciseName!==undefined&&planImportDraft){
    const [di,ei]=String(event.target.dataset.importExerciseName).split(':').map(Number);
    const row=planImportDraft.days?.[di]?.exercises?.[ei];if(!row)return;
    row.name=event.target.value;
    const match=matchImportedExercise(row.name);
    if(match){Object.assign(row,{sourceId:match.id,id:match.id,movement:match.movement,muscles:clone(match.muscles||[]),equipment:clone(match.equipment||[]),style:match.style,difficulty:match.difficulty,loadMode:match.loadMode,increment:match.increment,setup:match.setup,custom:false});}
    else row.custom=true;
    return;
  }
  if(event.target.dataset.importField&&planImportDraft){
    const [di,ei]=String(event.target.dataset.importIndex||'').split(':').map(Number);
    const row=planImportDraft.days?.[di]?.exercises?.[ei];if(!row)return;
    const field=event.target.dataset.importField;
    row[field]=field==='reps'?event.target.value:num(event.target.value);
  }
});
document.addEventListener('change',event=>{
  if(event.target.id==='plan-import-file'){
    const file=event.target.files?.[0];if(!file)return;
    const name=String(file.name||'').toLowerCase();
    if(!/\.(txt|csv|json)$/.test(name)){toast('This build can safely parse TXT, CSV, and JSON. PDF/photo recognition needs the document import service.');event.target.value='';return;}
    const reader=new FileReader();
    reader.onload=()=>{const text=String(reader.result||'');const area=document.querySelector('#plan-import-text');if(area)area.value=text;const parsed=parseImportedPlanText(text);if(parsed){parsed.source=name.endsWith('.csv')?'csv':name.endsWith('.json')?'json':'text';planImportDraft=parsed;render();}else toast('I could not interpret that file as a workout plan.');};
    reader.onerror=()=>toast('That file could not be read.');
    reader.readAsText(file);return;
  }
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
  if(event.key==='Escape'&&planImportOpen){planImportOpen=false;planImportDraft=null;render();return;}
  if(event.key==='Escape'&&customExerciseOpen){customExerciseOpen=false;render();return;}
  if(event.key==='Escape'&&accountSheetOpen){accountSheetOpen=false;render();return;}
  if(event.key==='Escape'&&historyMenuId){historyMenuId=null;render();return;}
  if(event.key==='Escape'&&exerciseActionsIndex!==null){exerciseActionsIndex=null;render();return;}
  if(event.key==='Escape'&&cueSettingsOpen){cueSettingsOpen=false;render();return;}
  if(event.key==='Escape'&&setEditContext){setEditContext=null;render();return;}
  if(event.key==='Escape'&&workoutMapOpen){workoutMapOpen=false;render();return;}
  if(event.key==='Escape'&&readinessContext){readinessContext=null;render();return;}
  if(event.key==='Escape'&&swapContext){swapContext=null;render();return;}
  if(event.key==='Escape'&&exerciseDetailId){exerciseDetailId=null;render();return;}
  if(event.key==='Enter'&&currentTab==='workout'&&store.activeWorkout?.phase==='work'&&document.activeElement?.tagName==='INPUT'){event.preventDefault();completeCurrentSet();}
});
tickHandle=window.setInterval(updateTimers,500);
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'){
    updateTimers();
    refreshTogetherFromSource();
    const draft=sharedTrainingState().draft;
    if(draft?.backendId&&!sharedRuntime.reconcileTimer)startSharedReconciliation(draft.backendId);
  }
});
window.addEventListener('pageshow',event=>{
  if(event.persisted){window.location.reload();return;}
  refreshTogetherFromSource();
});
window.addEventListener('beforeunload',()=>{
  persistUiState();
  if(tickHandle)clearInterval(tickHandle);
  stopSharedReconciliation();
  try{sharedRuntime.channel?.untrack();}catch{}
});
render();
updateTimers();
initWorkoutAuth();
if(clearedLegacyActiveWorkout){
  setTimeout(()=>toast('Previous test session cleared so this build can start with clean timer state.'),100);
}
