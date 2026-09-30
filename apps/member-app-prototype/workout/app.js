const STORAGE_KEY = 'workout-web-store-v3';
const UI_STATE_KEY = 'workout-web-ui-v1';
const LEGACY_KEYS = ['workout-web-store-v2','workout-web-store-v1'];
const ACTIVE_WORKOUT_SCHEMA = 4;
const PROGRAM_ENGINE_STORE_SCHEMA = 1;
const programEngine = window.GoWorkoutProgramEngine || null;
const catalog = window.EXERCISE_CATALOG || [];
const movements = window.EXERCISE_MOVEMENTS || {};
const exerciseMedia = window.EXERCISE_MEDIA || {};
const exerciseMediaFallbacks = window.EXERCISE_MEDIA_FALLBACKS || {};
const avatarExerciseMedia = window.EXERCISE_AVATAR_MEDIA || {};
const avatarLibraryMedia = window.EXERCISE_AVATAR_LIBRARY || null;
const TRAINING_AVATARS = [
  {id:'masc-athletic',name:'Malik',presentation:'Masculine',build:'Lean / athletic',tone:'medium-dark',hair:'short textured curls'},
  {id:'masc-full',name:'Drew',presentation:'Masculine',build:'Stocky / fuller',tone:'dark',hair:'bald / clean head'},
  {id:'fem-athletic',name:'Nia',presentation:'Feminine',build:'Lean / athletic',tone:'medium-dark',hair:'long braids / locs'},
  {id:'fem-full',name:'Maya',presentation:'Feminine',build:'Curvy / fuller',tone:'medium-dark',hair:'natural curls'}
];
const EXERCISE_IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
const WORKOUT_SUPABASE_URL = 'https://iftnwzqlofhujzulmofu.supabase.co';
const WORKOUT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_JCb6OcXTZcvjSfhHohWGZw__96BdfIB';
let workoutSupabase = null;
let authReady=false;
const sharedRuntime = {channel:null,sessionId:'',syncTimer:null,restoreUserId:'',syncMuted:false,lastPresenceSignature:''};
let cloudSyncTimer=null;
let cloudHydrating=false;
let exerciseDetailId = null;
let swapContext = null;
let readinessContext = null;
let workoutMapOpen = false;
let workoutMapView = 'strength';
let setEditContext = null;
let cueSettingsOpen = false;
let exerciseActionsIndex = null;
let historyMenuId = null;
let accountSheetOpen = false;
let sessionSetupOpen = false;
let avatarPickerOpen = false;
let accountEntryMode = 'sign-in';
let accountEntryBusy = false;
let accountEntryError = '';
let accountEntryEmail = '';
let accountEntryDisplay = '';
let historyFilter = 'all';

const defaultStore = {
  profile: null,
  plan: null,
  history: [],
  activeWorkout: null,
  calibration: {},
  progression: {},
  progressionLog: [],
  exercisePreferences: {excluded:[],swapHistory:[]},
  trainingProgram: {scheduleOverrides:{},weekReviews:{},engine:null},
  cueSettings: {sound:true,voice:true,haptics:true,flash:true},
  account: {displayName:'',email:'',authProvider:'',status:'local',userId:''},
  sharedTraining: {partners:[],draft:null,history:[]},
  lastSummaryId: null
};

const RESUMABLE_WORKOUT_PHASES=new Set(['intro','warmup-routine','warmup','warmup-complete','pre-set','work','timed-set','rest','calibrate','feedback','exercise-transition','exercise-review','cooldown','review']);

let store = loadStore();
let clearedLegacyActiveWorkout = false;
if(store.activeWorkout){const bootRecovery=validateActiveWorkoutCandidate(store.activeWorkout,store.history);if(bootRecovery.valid)store.activeWorkout=bootRecovery.workout;else{store.activeWorkout=null;clearedLegacyActiveWorkout=true;localStorage.setItem(STORAGE_KEY,JSON.stringify(store));}}
const restoredUiState=loadUiState();
const allowedTabs=new Set(['home','train','together','progress','profile','profile-edit','catalog','workout','history','summary']);
let restoredTab=allowedTabs.has(restoredUiState.currentTab)?restoredUiState.currentTab:'';
if(!store.profile||!store.plan)restoredTab='profile-edit';
else if(restoredTab==='workout'&&!store.activeWorkout)restoredTab='home';
let currentTab=restoredTab||(store.activeWorkout?'workout':'home');
accountSheetOpen=Boolean(restoredUiState.accountSheetOpen);
let trainView=['week','program','exercises'].includes(restoredUiState.trainView)?restoredUiState.trainView:'week';
let trainExpandedWeek=[1,2,3].includes(Number(restoredUiState.trainExpandedWeek))?Number(restoredUiState.trainExpandedWeek):0;
let programWhyOpen=Boolean(restoredUiState.programWhyOpen);
let progressExerciseId=String(restoredUiState.progressExerciseId||'');
let progressMetric=['weight','reps','volume'].includes(restoredUiState.progressMetric)?restoredUiState.progressMetric:'weight';
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
      trainView,
      trainExpandedWeek,
      programWhyOpen,
      progressExerciseId,
      progressMetric,
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
function validateActiveWorkoutCandidate(candidate,history=store.history){
 if(!candidate)return {valid:false,reason:'missing'};
 if(candidate.schemaVersion!==ACTIVE_WORKOUT_SCHEMA)return {valid:false,reason:'schema'};
 if(!candidate.id||!candidate.startedAt||!Array.isArray(candidate.exercises)||!candidate.exercises.length)return {valid:false,reason:'shape'};
 if((history||[]).some(item=>item.id===candidate.id))return {valid:false,reason:'already-completed'};
 if(candidate.phase==='complete'||!RESUMABLE_WORKOUT_PHASES.has(candidate.phase))return {valid:false,reason:'phase'};
 const started=Date.parse(candidate.startedAt);if(!Number.isFinite(started))return {valid:false,reason:'started-at'};
 const ageHours=(Date.now()-started)/3600000;if(ageHours>24)return {valid:false,reason:'stale',stale:true};
 const w=clone(candidate);w.currentExerciseIndex=Math.max(0,Math.min(num(w.currentExerciseIndex),w.exercises.length-1));
 const ex=w.exercises[w.currentExerciseIndex];if(!Array.isArray(ex?.sets)||!ex.sets.length)return {valid:false,reason:'sets'};
 w.currentSetIndex=Math.max(0,Math.min(num(w.currentSetIndex),ex.sets.length-1));w.processedActions=w.processedActions||{};w.revision=Math.max(1,num(w.revision)||1);w.finalizing=false;w.recoveryCheckpointAt=w.recoveryCheckpointAt||w.startedAt;
 if(w.phase==='rest'&&!w.pendingPosition){w.phase='pre-set';w.restEndsAt=null;w.restPausedRemaining=null;w.restToken=null;}
 if(w.phase==='rest'&&!w.restToken)w.restToken=newTimerToken('rest',w);
 return {valid:true,workout:w,ageHours};
}
function reconcileActiveWorkout(source='local'){
 const check=validateActiveWorkoutCandidate(store.activeWorkout,store.history);
 if(check.valid){store.activeWorkout=check.workout;return {action:'resume',source,...check};}
 if(store.activeWorkout)store.activeWorkout=null;
 return {action:check.stale?'discard-stale':'clear-invalid',source,...check};
}
function historyRecordTime(item){
 const value=Date.parse(item?.completedAt||item?.updatedAt||item?.startedAt||'');
 return Number.isFinite(value)?value:0;
}
function mergeWorkoutHistory(localHistory=[],remoteHistory=[]){
 const byId=new Map();
 for(const item of [...(Array.isArray(localHistory)?localHistory:[]),...(Array.isArray(remoteHistory)?remoteHistory:[])]){
  if(!item?.id)continue;
  const current=byId.get(item.id);
  if(!current||historyRecordTime(item)>=historyRecordTime(current))byId.set(item.id,clone(item));
 }
 return [...byId.values()].sort((a,b)=>historyRecordTime(b)-historyRecordTime(a)).slice(0,100);
}
function workoutRecoveryCheckpoint(workout){
 const value=Date.parse(workout?.recoveryCheckpointAt||workout?.updatedAt||workout?.startedAt||'');
 return Number.isFinite(value)?value:0;
}
function workoutRecoveryProgress(workout){
 if(!workout)return 0;
 let completedSets=0,resolvedExercises=0;
 for(const ex of workout.exercises||[]){
  const sets=Array.isArray(ex?.sets)?ex.sets:[];
  completedSets+=sets.filter(set=>set?.completed||set?.skipped).length;
  if(ex?.skipped||sets.length&&sets.every(set=>set?.completed||set?.skipped))resolvedExercises+=1;
 }
 return completedSets+(resolvedExercises*10)+(Math.max(0,num(workout.revision)||0)*100);
}
function chooseRecoveredWorkout(localCandidate,cloudCandidate,history){
 const localCheck=validateActiveWorkoutCandidate(localCandidate,history);
 const cloudCheck=validateActiveWorkoutCandidate(cloudCandidate,history);
 if(!localCheck.valid&&!cloudCheck.valid)return {workout:null,source:'none',localCheck,cloudCheck};
 if(localCheck.valid&&!cloudCheck.valid)return {workout:localCheck.workout,source:'local',localCheck,cloudCheck};
 if(!localCheck.valid&&cloudCheck.valid)return {workout:cloudCheck.workout,source:'cloud',localCheck,cloudCheck};
 const local=localCheck.workout,cloud=cloudCheck.workout;
 if(local.id===cloud.id){
  const localProgress=workoutRecoveryProgress(local),cloudProgress=workoutRecoveryProgress(cloud);
  if(localProgress!==cloudProgress)return {workout:localProgress>cloudProgress?local:cloud,source:localProgress>cloudProgress?'local':'cloud',localCheck,cloudCheck};
 }
 const localCheckpoint=workoutRecoveryCheckpoint(local),cloudCheckpoint=workoutRecoveryCheckpoint(cloud);
 if(localCheckpoint!==cloudCheckpoint)return {workout:localCheckpoint>cloudCheckpoint?local:cloud,source:localCheckpoint>cloudCheckpoint?'local':'cloud',localCheck,cloudCheck};
 return {workout:local,source:'local',localCheck,cloudCheck};
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
  const localHistory=clone(store.history||[]),localActive=store.activeWorkout?clone(store.activeWorkout):null;
  const {data,error}=await workoutSupabase.from('workout_user_state').select('*').eq('user_id',userId).maybeSingle();
  if(error)throw error;
  if(!data){await syncCloudState();cloudHydrating=false;return false;}
  cloudHydrating=true;
  for(const [remote,local] of [['profile','profile'],['plan','plan'],['calibration','calibration'],['progression','progression'],['progression_log','progressionLog'],['exercise_preferences','exercisePreferences'],['training_program','trainingProgram'],['cue_settings','cueSettings'],['last_summary_id','lastSummaryId']]) if(data[remote]!==null&&data[remote]!==undefined)store[local]=data[remote];
  const remoteHistory=Array.isArray(data.history)?data.history:[];
  const mergedHistory=mergeWorkoutHistory(localHistory,remoteHistory);
  store.history=mergedHistory;
  const recovery=chooseRecoveredWorkout(localActive,data.active_workout,mergedHistory);
  store.activeWorkout=recovery.workout;
  reconcileActiveWorkout('cloud');
  const cloudActive=data.active_workout||null;
  const shouldConverge=recovery.source==='local'||JSON.stringify(mergedHistory)!==JSON.stringify(remoteHistory)||JSON.stringify(store.activeWorkout||null)!==JSON.stringify(cloudActive);
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(store));}catch{}
  cloudHydrating=false;
  if(shouldConverge)scheduleCloudStateSync();
  if(store.profile&&store.plan&&currentTab==='profile-edit')currentTab=store.activeWorkout?'workout':'home';
  render();return true;
}
function saveStore(){
  let persisted=true;
  if(store.activeWorkout)store.activeWorkout.recoveryCheckpointAt=new Date().toISOString();
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
function trainingAvatarId(profile=store.profile){
  const id=String(profile?.visualAvatarId||'');
  if(TRAINING_AVATARS.some(item=>item.id===id))return id;
  if(profile?.gender==='woman')return 'fem-athletic';
  if(profile?.gender==='man')return 'masc-athletic';
  return 'masc-athletic';
}
function trainingAvatar(profile=store.profile){return TRAINING_AVATARS.find(item=>item.id===trainingAvatarId(profile))||TRAINING_AVATARS[0];}
function renderAvatarFigure(avatarId,className=''){
  const avatar=TRAINING_AVATARS.find(item=>item.id===avatarId)||TRAINING_AVATARS[0];
  return '<span class="training-avatar-figure '+esc(avatar.id)+' '+esc(className)+'" aria-hidden="true"><i class="avatar-head"></i><i class="avatar-hair"></i><i class="avatar-neck"></i><i class="avatar-torso"></i><i class="avatar-arm left"></i><i class="avatar-arm right"></i><i class="avatar-leg left"></i><i class="avatar-leg right"></i></span>';
}
function renderAvatarChoices(selectedId='',inputName='visualAvatarId'){
  return '<div class="training-avatar-grid">'+TRAINING_AVATARS.map(avatar=>
    '<label class="training-avatar-card"><input type="radio" name="'+esc(inputName)+'" value="'+esc(avatar.id)+'" '+(selectedId===avatar.id?'checked':'')+'><span>'+
      renderAvatarFigure(avatar.id,'card-avatar')+
      '<span class="training-avatar-copy"><strong>'+esc(avatar.name)+'</strong><small>'+esc(avatar.presentation)+' · '+esc(avatar.build)+'</small></span>'+
      '<em>SELECTED</em>'+
    '</span></label>'
  ).join('')+'</div>';
}
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
  if(!('engine' in store.trainingProgram))store.trainingProgram.engine=null;
  store.trainingProgram.enginePerformance=store.trainingProgram.enginePerformance||[];
  store.trainingProgram.engineReadiness=store.trainingProgram.engineReadiness||[];
  store.trainingProgram.engineAdaptations=store.trainingProgram.engineAdaptations||[];
  store.trainingProgram.engineVersions=store.trainingProgram.engineVersions||[];
  store.trainingProgram.engineBlockVersion=store.trainingProgram.engineBlockVersion||1;
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
    const fallbackDay=store.plan.days[index%store.plan.days.length];
    const day=engineDayForSchedule(scheduledDate,index,fallbackDay);
    const entry={dayId,date:scheduledDate,dateKey:key,day,index,override:overrides[key]||null,engineBacked:Boolean(day?.engineBacked)};
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
  const decision=adaptationDecision(date);
  const engineBacked=Boolean(baseDay?.engineBacked);
  const day=engineBacked?clone(baseDay):rotateAccessoriesForBlock(clone(baseDay),decision.context.blockNumber);
  const compounds=day.exercises.filter(ex=>!ACCESSORY_MOVEMENTS.has(ex.movement));
  if(!engineBacked)for(let i=0;i<Math.min(decision.addSets,compounds.length);i++)compounds[i].sets=Math.min(4,(compounds[i].sets||2)+1);
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
  day.adaptationNotes=engineBacked?[...decision.notes,'Program Engine week prescription retained; legacy progression bump skipped.']:decision.notes;
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
  if(['warmup','cooldown'].includes(w.phase)){
    const snap=timedStageSnapshot(w);
    if(snap&&!snap.complete)w.reviewPausedTimedStage={phase:w.phase,index:snap.index,mode:snap.mode,remainingExact:snap.remainingExact,total:snap.total,completedReps:snap.completedReps||0};
  }
  if(w.phase==='pre-set'){
    const snap=preSetSnapshot(w);
    if(snap&&!snap.complete)w.reviewPausedPreSetRemaining=(
      snap.mode==='setup'
        ? Number(snap.remaining||0)+Math.max(0,num(w.preSetCountdownSeconds)||3)
        : Number(snap.remaining||0)
    );
  }
  if(w.phase==='rest'&&!Number.isFinite(w.restPausedRemaining))w.restPausedRemaining=restRemaining(w);
  if(w.phase==='timed-set'){
    const snap=timedSetSnapshot(w);
    if(snap&&!snap.complete)w.reviewPausedTimedSetRemaining=snap.remainingExact;
  }
  delete w.preSetStartedAt;
  delete w.timedSetStartedAt;
  delete w.timedSetEndsAt;
  delete w.timedPhaseStartedAt;
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
function activeSwapSetup(){
  if(swapContext?.mode!=='workout')return null;
  const context=store.activeWorkout?.trainingContext;
  if(!context?.modes?.length)return null;
  return context;
}
function swapCandidateAvailable(candidate,setup=null){
  if(setup)return setupAllowsExercise(candidate,setup);
  return equipmentAllows(candidate,store.profile?.equipment||'full-gym');
}
function swapCandidates(ex,{includeOtherEquipment=true,limit=7,setup=null}={}){
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
      const available=swapCandidateAvailable(candidate,setup);
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
    swappedFrom:{id:template.id,name:template.name},swapReason:swapReason||template.swapReason||'',
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
  const prep=[...(day.warmup||[]),...(day.cooldown||[])].reduce((sum,item)=>sum+timedStageEstimateSeconds(item),0);
  const work=(day.exercises||[]).reduce((sum,ex)=>sum+estimatePlanExerciseSeconds(ex),0);
  day.warmupMinutes=Math.ceil((day.warmup||[]).reduce((sum,item)=>sum+timedStageEstimateSeconds(item),0)/60);
  day.cooldownMinutes=Math.ceil((day.cooldown||[]).reduce((sum,item)=>sum+timedStageEstimateSeconds(item),0)/60);
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
  const activeSetup=swapContext.mode==='workout'?activeSwapSetup():null;
  if(activeSetup&&!setupAllowsExercise(candidate,activeSetup)){
    toast(candidate.name+' is not available with today’s '+sessionSetupLabel(activeSetup).toLowerCase()+' setup.');
    return;
  }
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
  const effectiveCandidate=activeSetup?effectiveExerciseForSetup(candidate,activeSetup):candidate;
  const replacement=workoutExerciseFromCandidate(effectiveCandidate,original,remaining);
  if(effectiveCandidate.sessionLoadOverride){
    replacement.loadMode='bodyweight';
    replacement.suggestedWeight=0;
    replacement.calibrationRequired=false;
    replacement.sets.forEach(set=>{set.weight='';});
    replacement.sessionLoadOverride='bodyweight';
  }
  replacement.swapReason=reason;replacement.engineOriginalExerciseId=original.engineExerciseId||null;
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
  const activeSetup=activeSwapSetup();
  let candidates=swapCandidates(source,{setup:activeSetup});
  const preferredIds=engineSubstitutionCatalogIds(target.exercise);
  if(preferredIds.length)candidates=[...candidates].sort((a,b)=>(preferredIds.includes(b.exercise.id)?1:0)-(preferredIds.includes(a.exercise.id)?1:0));
  const available=candidates.filter(item=>item.available);
  const other=candidates.filter(item=>!item.available);
  const card=(item,index)=>{
    const raw=item.exercise;
    const ex=activeSetup&&item.available?effectiveExerciseForSetup(raw,activeSetup):raw;
    const src=exerciseImageUrl(ex,0,false),fallback=exerciseImageUrl(ex,0,true);
    return '<article class="swap-option">'+
      '<div class="swap-option-media">'+(src?'<img src="'+esc(src)+'" data-fallback-src="'+esc(fallback)+'" alt="'+esc(ex.name)+' demonstration">':'')+'</div>'+
      '<div class="swap-option-copy"><div class="swap-option-top"><span>'+esc(item.tier)+'</span>'+(index===0&&item.available?'<em>BEST MATCH</em>':'')+'</div>'+
      '<h3>'+esc(ex.name)+'</h3>'+
      '<p>'+esc(exerciseDescription(ex))+'</p>'+
      '<div class="swap-option-meta"><span>'+esc((ex.muscles||[]).join(' · '))+'</span><strong>'+esc(ex.sessionLoadOverride==='bodyweight'?'No special equipment':equipmentRequirement(ex))+'</strong></div>'+
      (item.available?'<button class="button secondary" type="button" data-action="choose-swap" data-candidate-id="'+esc(raw.id)+'">USE THIS EXERCISE</button>':'<span class="swap-unavailable-label">NOT AVAILABLE TODAY</span>')+'</div>'+
    '</article>';
  };
  return '<div class="exercise-modal-backdrop swap-modal-backdrop" data-action="close-swap">'+
    '<section class="exercise-modal swap-modal" role="dialog" aria-modal="true" aria-label="Swap '+esc(source.name)+'" data-swap-panel>'+
      '<button class="modal-close" type="button" data-action="close-swap" aria-label="Close exercise swap">×</button>'+
      '<div class="swap-head"><p class="eyebrow">SWAP EXERCISE</p><h2>'+esc(source.name)+'</h2><p>Choose a comparable movement. Your completed work stays intact and replacement loads are recalculated for the new exercise.</p></div>'+
      '<div class="swap-controls"><label>WHY ARE YOU SWAPPING?<select id="swap-reason"><option value="equipment">Equipment unavailable</option><option value="dislike">Don’t like this exercise</option><option value="pain">Pain or discomfort</option><option value="difficulty">Too difficult</option><option value="easy">Too easy</option><option value="other">Other</option></select></label>'+
      '<label class="swap-exclude"><input id="swap-never-show" type="checkbox"> Don’t show me '+esc(source.name)+' again</label></div>'+
      (activeSetup?'<div class="swap-active-context"><span>TODAY’S SETUP</span><strong>'+esc(sessionSetupLabel(activeSetup))+'</strong><small>Available replacements are filtered to what you have right now.</small></div>':'')+
      (available.length?'<div class="swap-section"><h3>AVAILABLE WITH '+esc(activeSetup?sessionSetupLabel(activeSetup).toUpperCase():'YOUR SETUP')+'</h3><div class="swap-options">'+available.map(card).join('')+'</div></div>':'')+
      (other.length?'<div class="swap-section other-equipment"><h3>NOT AVAILABLE WITH TODAY’S SETUP</h3><div class="swap-options">'+other.map((item,index)=>card(item,index+available.length)).join('')+'</div></div>':'')+
      (!candidates.length?'<div class="empty-state"><strong>No close replacements found.</strong><span>Try changing your equipment profile or keeping this exercise.</span></div>':'')+
    '</section></div>';
}

function avatarLibraryMediaSpec(ex){
  if(!ex||!avatarLibraryMedia)return null;
  const mapped=avatarLibraryMedia.exercises?.[ex.id];
  const row=avatarLibraryMedia.avatars?.[trainingAvatarId()];
  if(!mapped||!Number.isInteger(row))return null;
  const spriteUrl=typeof mapped==='object'?mapped.spriteUrl:avatarLibraryMedia.spriteUrl;
  const column=typeof mapped==='object'?Number(mapped.column):Number(mapped);
  const columns=typeof mapped==='object'?Number(mapped.columns||avatarLibraryMedia.columns):Number(avatarLibraryMedia.columns);
  const rows=typeof mapped==='object'?Number(mapped.rows||avatarLibraryMedia.rows):Number(avatarLibraryMedia.rows);
  if(!spriteUrl||!Number.isInteger(column)||columns<1||rows<1)return null;
  const x=columns===1?0:(column/(columns-1))*100;
  const y=rows===1?0:(row/(rows-1))*100;
  return {spriteUrl,columns,rows,x,y,avatarId:trainingAvatarId()};
}
function renderAvatarLibraryMedia(ex,className='catalog-exercise-media'){
  const spec=avatarLibraryMediaSpec(ex);
  if(!spec)return '';
  const style='background-image:url('+JSON.stringify(spec.spriteUrl)+');background-size:'+(spec.columns*100)+'% '+(spec.rows*100)+'%;background-position:'+spec.x+'% '+spec.y+'%;';
  return '<button class="'+className+' exercise-media avatar-library-media" type="button" data-exercise-detail="'+esc(ex.id)+'" aria-label="View '+esc(ex.name)+' instructions">'+
    '<span class="avatar-library-sprite" style="'+esc(style)+'" aria-hidden="true"></span>'+
    '<span class="media-status direct avatar">YOUR AVATAR</span><span class="media-hint">VIEW FORM</span></button>';
}
function avatarExerciseMediaSpec(ex){
  if(!ex)return null;
  const avatarId=trainingAvatarId();
  const mapped=avatarExerciseMedia?.[ex.id]?.[avatarId]||null;
  const frames=Array.isArray(mapped?.frames)?mapped.frames.filter(Boolean):[];
  if(mapped?.status!=='approved'||!frames.length)return null;
  return {status:'avatar',frames:frames.map((_,index)=>index),directUrls:frames,sourceId:'',avatarId,note:mapped.note||'Approved GoWorkout avatar demonstration.'};
}
function exerciseMediaSpec(ex){
  if(!ex)return {status:'missing',frames:[],sourceId:'',note:'No exercise selected.'};
  const avatarMapped=avatarExerciseMediaSpec(ex);
  if(avatarMapped)return avatarMapped;
  const mapped=exerciseMedia[ex.id]||null;
  if(!mapped?.sourceId){
    return {
      status:'missing',
      frames:[],
      sourceId:'',
      note:'No direct demonstration image has been mapped for this exercise.',
      movementFallback:exerciseMediaFallbacks[ex.movement]||''
    };
  }
  const status=mapped.status||'direct';
  const frames=Array.isArray(mapped.frames)&&mapped.frames.length?mapped.frames:[0,1];
  return {
    status,
    sourceId:mapped.sourceId,
    frames,
    note:mapped.note||'',
    movementFallback:exerciseMediaFallbacks[ex.movement]||''
  };
}
function exerciseMediaFrameUrl(ex,frameIndex=0){
  const spec=exerciseMediaSpec(ex);
  if(spec.status==='reference'||!spec.frames.length)return '';
  const selected=Math.max(0,Math.min(frameIndex,spec.frames.length-1));
  if(Array.isArray(spec.directUrls))return spec.directUrls[selected]||'';
  if(!spec.sourceId)return '';
  const frame=spec.frames[selected];
  return EXERCISE_IMAGE_BASE+encodeURIComponent(spec.sourceId)+'/'+frame+'.jpg';
}
function exerciseImageUrl(ex,index=0,useFallback=false){
  if(useFallback)return '';
  return exerciseMediaFrameUrl(ex,index);
}
function exerciseMediaState(ex){
  const spec=exerciseMediaSpec(ex);
  if(spec.status==='avatar')return {kind:'direct avatar',label:'YOUR AVATAR',note:'This approved demonstration uses your selected training avatar.'};
  if(spec.status==='reference')return {kind:'review',label:'IMAGE UNDER REVIEW',note:spec.note||'This available source does not directly demonstrate the exercise.'};
  if(spec.status==='missing')return {kind:'missing',label:'DEMO COMING SOON',note:spec.note};
  return {kind:'direct',label:'MOVEMENT DEMO',note:'Mapped directly to this exercise. Frame order stays neutral until start and finish positions are individually reviewed.'};
}
function renderExerciseMediaPlaceholder(ex,className,state){
  const label=state?.label||'DEMO COMING SOON';
  const note=state?.note||'Use the form cues below until a direct demonstration is available.';
  const restMini=/rest-next-exercise-media/.test(className);
  if(restMini){
    return '<button class="'+className+' exercise-media media-placeholder mini-workout-media media-'+esc(state?.kind||'missing')+'" type="button" data-exercise-detail="'+esc(ex.id)+'" aria-label="View '+esc(ex.name)+' instructions"><span>FORM</span><strong>DEMO PENDING</strong></button>';
  }
  const workoutCompact=/active-exercise-media|pre-set-exercise-media|timed-work-exercise-media|next-exercise-media/.test(className);
  if(workoutCompact){
    const guide=exerciseGuidance(ex);
    return '<button class="'+className+' exercise-media media-placeholder compact-workout-media media-'+esc(state?.kind||'missing')+'" type="button" data-exercise-detail="'+esc(ex.id)+'" aria-label="View '+esc(ex.name)+' instructions">'+
      '<div class="compact-form-mark"><span>FORM DEMO PENDING</span><strong>'+esc(ex.name)+'</strong></div>'+
      '<div class="compact-form-cues"><span>SETUP</span><strong>'+esc(guide.setup||exerciseDescription(ex))+'</strong><small>'+esc(guide.cue||note)+'</small></div>'+
      '<em>VIEW FORM →</em></button>';
  }
  return '<button class="'+className+' exercise-media media-placeholder media-'+esc(state?.kind||'missing')+'" type="button" data-exercise-detail="'+esc(ex.id)+'" aria-label="View '+esc(ex.name)+' instructions">'+
    '<span class="media-placeholder-mark" aria-hidden="true">FORM</span><strong>'+esc(label)+'</strong><small>'+esc(note)+'</small><em>VIEW FORM →</em></button>';
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
  if(/catalog-exercise-media/.test(className)){
    const avatarLibrary=renderAvatarLibraryMedia(ex,className);
    if(avatarLibrary)return avatarLibrary;
  }
  const spec=exerciseMediaSpec(ex);
  const state=exerciseMediaState(ex);
  const src=exerciseMediaFrameUrl(ex,index);
  const animate=/active-exercise-media|pre-set-exercise-media|timed-work-exercise-media/.test(className);
  const runnerEager=/active-exercise-media|pre-set-exercise-media|timed-work-exercise-media|next-exercise-media|rest-next-exercise-media|warmup-complete-media/.test(className);
  const second=animate&&spec.frames.length>1?exerciseMediaFrameUrl(ex,index===0?1:0):'';
  if(!src)return renderExerciseMediaPlaceholder(ex,className,state);
  const media=animate&&second
    ?'<span class="exercise-motion-frames"><img class="motion-frame motion-frame-a" src="'+esc(src)+'" loading="eager" decoding="async" alt="'+esc(ex.name)+' demonstration, position 1"><img class="motion-frame motion-frame-b" src="'+esc(second)+'" loading="eager" decoding="async" alt="'+esc(ex.name)+' demonstration, position 2"></span>'
    :'<img src="'+esc(src)+'" loading="lazy" decoding="async" alt="'+esc(ex.name)+' exercise demonstration">';
  return '<button class="'+className+' exercise-media'+(animate&&second?' motion-enabled':'')+'" type="button" data-exercise-detail="'+esc(ex.id)+'" aria-label="View '+esc(ex.name)+' instructions">'+media+
    '<span class="media-status '+esc(state.kind)+'">'+esc(state.label)+'</span><span class="media-hint">VIEW FORM</span></button>';
}

function renderExerciseModal(){
  if(!exerciseDetailId)return '';
  const ex=catalog.find(item=>item.id===exerciseDetailId)||store.activeWorkout?.exercises?.find(item=>item.id===exerciseDetailId);
  if(!ex)return '';
  const guide=exerciseGuidance(ex),spec=exerciseMediaSpec(ex),state=exerciseMediaState(ex);
  const primary=exerciseMediaFrameUrl(ex,0),secondary=exerciseMediaFrameUrl(ex,1);
  const media=primary
    ?'<div class="runner-detail-positions"><figure><img src="'+esc(primary)+'" loading="eager" decoding="async" alt="'+esc(ex.name)+' position 1"></figure>'+(secondary?'<figure><img src="'+esc(secondary)+'" loading="eager" decoding="async" alt="'+esc(ex.name)+' position 2"></figure>':'')+'</div>'
    :'<div class="exercise-modal-placeholder"><span>'+esc(state.label)+'</span><strong>'+esc(ex.name)+'</strong><p>'+esc(state.note)+'</p></div>';
  return '<div class="exercise-modal-backdrop" data-action="close-details"><section class="exercise-modal runner-exercise-detail" role="dialog" aria-modal="true" aria-label="'+esc(ex.name)+' exercise instructions" data-modal-panel>'+
    '<button class="modal-close" type="button" data-action="close-details" aria-label="Close exercise instructions">×</button>'+
    '<div class="runner-detail-head"><p class="eyebrow">'+esc(movements[ex.movement]||ex.movement)+'</p><h2>'+esc(ex.name)+'</h2><p>'+esc((ex.muscles||[]).join(' · '))+'</p></div>'+
    '<div class="exercise-modal-media runner-detail-media">'+media+'</div>'+
    '<div class="runner-detail-body"><div class="runner-detail-cue"><span>COACHING CUE</span><strong>'+esc(guide.cue)+'</strong></div>'+
      '<section><span>SETUP</span><p>'+esc(guide.setup)+'</p></section>'+
      '<section><span>HOW TO MOVE</span><ol>'+guide.steps.map(step=>'<li>'+esc(step)+'</li>').join('')+'</ol></section>'+
      '<section class="watch"><span>WATCH FOR</span><p>'+esc(guide.mistake)+'</p></section>'+
      (ex.engineReason?.length?'<section><span>WHY THIS EXERCISE</span><p>'+esc(ex.engineReason.join(' · '))+'</p></section>':'')+
      renderExerciseHistoryPanel(ex)+
    '</div></section></div>';
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
  return String(Math.max(...nums));
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


function recommendedRepTarget(ex){
  const bounds=repBounds(ex?.reps||ex?.suggestedReps||'');
  return Math.max(1,bounds.high||0,num(ex?.suggestedReps)||0,num(recommendedRepCount(ex?.reps))||0);
}
function recommendedWeightTarget(ex){
  if(['bodyweight','timed','band'].includes(ex?.loadMode))return 0;
  return Math.max(0,num(ex?.suggestedWeight)||num(ex?.startWeight)||0);
}
function prepareSetTarget(ex,set,setIndex=0){
  if(!ex||!set||set.completed||set.targetPrepared)return set;
  const prior=setIndex>0?ex.sets?.[setIndex-1]:null;
  if(prior?.completed){
    set.weight=prior.weight??set.weight;
    set.reps=prior.reps??set.reps;
    set.targetSource='previous-set';
  }else{
    if(!['bodyweight','timed','band'].includes(ex.loadMode))set.weight=String(recommendedWeightTarget(ex)||'');
    set.reps=String(ex.loadMode==='timed'?(num(set.reps)||num(ex.suggestedReps)||recommendedRepTarget(ex)):recommendedRepTarget(ex));
    set.targetSource='recommended-max';
  }
  set.targetPrepared=true;
  return set;
}
function setTargetValue(ex,set,type){
  if(type==='weight')return Math.max(0,num(set?.weight));
  return Math.max(1,num(set?.reps)||recommendedRepTarget(ex));
}
function adjustSetTarget(type,delta){
  const pos=getActivePosition();
  if(!pos||!['pre-set','work'].includes(pos.workout.phase))return;
  prepareSetTarget(pos.exercise,pos.set,pos.si);
  if(type==='weight'){
    if(['bodyweight','timed','band'].includes(pos.exercise.loadMode))return;
    const step=Math.max(1,num(pos.exercise.increment)||5);
    const next=Math.max(0,setTargetValue(pos.exercise,pos.set,'weight')+(delta*step));
    pos.set.weight=String(next);
  }else{
    const step=pos.exercise.loadMode==='timed'?5:1;
    const next=Math.max(1,setTargetValue(pos.exercise,pos.set,'reps')+(delta*step));
    pos.set.reps=String(next);
  }
  pos.set.targetAdjusted=true;
  pos.set.targetPrepared=true;
  saveStore();render();
}
function setElapsedSeconds(w){
  if(!w||w.phase!=='work')return 0;
  const start=Date.parse(w.setStartedAt||w.exerciseStartedAt||'');
  if(!Number.isFinite(start))return 0;
  return Math.max(0,Math.floor((workoutNowMs(w)-start)/1000));
}
function warmupElapsedSeconds(w){
  if(!w)return 0;
  const started=Date.parse(w.warmupStartedAt||w.startedAt||'');
  if(!Number.isFinite(started))return 0;
  const ended=Date.parse(w.warmupCompletedAt||'');
  const end=Number.isFinite(ended)?ended:workoutNowMs(w);
  return Math.max(0,Math.floor((end-started)/1000));
}
function completedSetLine(ex,set){
  if(!set?.completed)return '';
  const duration=num(set.durationSeconds);
  return setPerformanceLabel(ex,set)+(duration?' · '+formatClock(duration):'');
}
const prefetchedExerciseMedia=new Set();
function prefetchExerciseMedia(ex){
  if(!ex||typeof Image==='undefined')return;
  const spec=exerciseMediaSpec(ex);
  if(!['direct','avatar'].includes(spec.status))return;
  [0,1].forEach(index=>{
    const src=exerciseMediaFrameUrl(ex,index);
    if(!src||prefetchedExerciseMedia.has(src))return;
    prefetchedExerciseMedia.add(src);
    const img=new Image();
    img.decoding='async';
    img.src=src;
  });
}
function prefetchUpcomingWorkoutMedia(){
  const w=store.activeWorkout;
  if(!w||currentTab!=='workout')return;
  const pos=getActivePosition();
  if(pos?.exercise)prefetchExerciseMedia(pos.exercise);
  const candidates=[];
  if(w.pendingPosition?.ei!==undefined)candidates.push(w.exercises?.[w.pendingPosition.ei]);
  const next=nextExercisePreview(w,w.currentExerciseIndex||0);
  if(next?.exercise)candidates.push(next.exercise);
  if(w.exercises?.[(w.currentExerciseIndex||0)+1])candidates.push(w.exercises[(w.currentExerciseIndex||0)+1]);
  candidates.filter(Boolean).forEach(prefetchExerciseMedia);
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

function timedStageEstimateSeconds(item){
  if(!item)return 0;
  const transition=8;
  if(item.mode==='reps'||item.reps){
    const reps=Math.max(1,Number(item.reps)||8);
    const sides=item.side?2:1;
    return Math.max(25,reps*sides*3)+transition;
  }
  return Math.max(1,Number(item.seconds)||30)+transition;
}

function normalizeTimedStage(items,targetSeconds,minSeconds,maxSeconds){
  if(!items.length)return items;
  const target=Math.max(minSeconds,Math.min(maxSeconds,targetSeconds));
  const each=Math.max(20,Math.round(target/items.length/5)*5);
  return items.map(item=>({...item,seconds:each}));
}
function buildWarmup(exercises){
  const moves=new Set(exercises.map(e=>e.movement));
  const lower=[...moves].some(m=>['squat','hinge','single-leg','quad-accessory','hamstring-accessory','calves'].includes(m));
  const upper=[...moves].some(m=>['horizontal-push','horizontal-pull','vertical-push','vertical-pull','shoulder-accessory','biceps','triceps'].includes(m));
  const items=[{
    name:'Easy march + arm swing',
    mode:'time',
    seconds:30,
    description:'March in place while the arms swing naturally.',
    cue:'Raise your temperature. Keep your shoulders loose.',
    why:'Gently raises body temperature before training.',
    mediaId:'Arm_Circles'
  }];
  if(lower){
    items.push(
      {name:'Ankle rocks',mode:'reps',reps:8,side:'each side',description:'Drive the knee forward over the toes while the heel stays down.',cue:'Keep the heel planted and move through a comfortable range.',why:'Prepares the ankles for squats, lunges, and leg work.',mediaId:'Standing_Gastrocnemius_Calf_Stretch'},
      {name:'Bodyweight squat',mode:'reps',reps:8,description:'Sit between the hips and stand tall without load.',cue:'Keep your knees tracking over your toes.',why:'Warms the squat pattern before loaded lower-body work.',mediaId:'Bodyweight_Squat'}
    );
    if([...moves].some(m=>['hinge','hamstring-accessory'].includes(m))){
      items.push({name:'Hip hinge reach',mode:'reps',reps:8,description:'Reach the hips back with soft knees, then return tall.',cue:'Keep your spine long and feel the hamstrings load lightly.',why:'Primes the hinge pattern without external load.'});
    }
    items.push(
      {name:'Reverse lunge reach',mode:'reps',reps:5,side:'each side',description:'Step back into a controlled reverse lunge with an easy reach.',cue:'Stay tall and use a comfortable range.',why:'Adds single-leg motion and opens the hips.',mediaId:'Crossover_Reverse_Lunge'},
      {name:'Glute bridge',mode:'reps',reps:8,description:'Press through the feet and lift the hips under control.',cue:'Squeeze the glutes without arching the lower back.',why:'Turns on the glutes before loaded lower-body work.'}
    );
  }else if(upper){
    items.push(
      {name:'Arm circles',mode:'time',seconds:30,description:'Move from small circles into a comfortable larger range.',cue:'Keep the neck relaxed.',why:'Warms the shoulders before pressing and pulling.',mediaId:'Arm_Circles'},
      {name:'Shoulder sweep',mode:'reps',reps:8,description:'Sweep the arms through a comfortable overhead range.',cue:'Move smoothly without shrugging.',why:'Prepares overhead shoulder motion.'},
      {name:'Thoracic rotation',mode:'reps',reps:5,side:'each side',description:'Rotate through the upper back while the hips stay quiet.',cue:'Breathe out as you rotate.',why:'Prepares the upper back for rows and presses.'},
      {name:'Scapular squeeze',mode:'reps',reps:8,description:'Draw the shoulder blades gently back and down, then release.',cue:'Keep the ribs quiet and neck long.',why:'Primes shoulder-blade control before upper-body work.'},
      {name:'Wall push-up',mode:'reps',reps:8,description:'Use an easy wall push-up to warm the pressing pattern.',cue:'Keep a straight line from head to heels.',why:'Prepares the chest, shoulders, and triceps.'}
    );
  }else{
    items.push(
      {name:'Bodyweight squat',mode:'reps',reps:8,cue:'Move through a comfortable range.',why:'Adds gentle full-body movement.',mediaId:'Bodyweight_Squat'},
      {name:'Shoulder sweep',mode:'reps',reps:8,cue:'Keep the shoulders relaxed.',why:'Warms the upper body.'},
      {name:'Reverse lunge reach',mode:'reps',reps:5,side:'each side',cue:'Move slowly and stay tall.',why:'Adds hip and single-leg motion.',mediaId:'Crossover_Reverse_Lunge'}
    );
  }
  return items.slice(0,6);
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
  return normalizeTimedStage(items.slice(0,4),exercises.length<=3?60:exercises.length>=7?180:120,60,180);
}


const SESSION_SETUP_PRESETS = {
  'full-gym':{label:'Gym',shortLabel:'Gym',modes:['full-gym']},
  'bodyweight':{label:'Bodyweight only',shortLabel:'Bodyweight',modes:['bodyweight']},
  'dumbbells':{label:'Dumbbells + bodyweight',shortLabel:'Dumbbells',modes:['dumbbells','bodyweight']},
  'bands':{label:'Bands + bodyweight',shortLabel:'Bands',modes:['bands','bodyweight']},
  'mixed-home':{label:'Home mix',shortLabel:'Home mix',modes:['mixed-home','dumbbells','bands','bodyweight']},
  'custom':{label:'Custom equipment',shortLabel:'Custom',modes:[]}
};
const FLOOR_EXERCISE_IDS=new Set(['push-up','glute-bridge','plank','dead-bug','pike-pushup','prone-w-raise','prone-lat-pull','db-floor-press']);
const CHAIR_STEP_EXERCISE_IDS=new Set(['step-up']);
const PULLUP_BAR_EXERCISE_IDS=new Set(['pull-up']);
const SESSION_MOVEMENT_ALTERNATIVES={
  'vertical-pull':['horizontal-pull'],
  'horizontal-pull':['vertical-pull'],
  'quad-accessory':['squat','single-leg'],
  'hamstring-accessory':['hinge','single-leg'],
  'shoulder-accessory':['vertical-push','horizontal-pull'],
  'biceps':['horizontal-pull','vertical-pull'],
  'triceps':['horizontal-push','vertical-push']
};
function normalSessionSetupKey(){
  const key=store.profile?.equipment||'full-gym';
  return SESSION_SETUP_PRESETS[key]?key:'full-gym';
}
function sessionSetupLabel(setup){
  return SESSION_SETUP_PRESETS[setup?.key]?.label||setup?.label||'Custom equipment';
}
function buildSessionSetup(key,{customModes=[],floor=true,chair=false,pullupBar=false}={}){
  const preset=SESSION_SETUP_PRESETS[key]||SESSION_SETUP_PRESETS['full-gym'];
  let modes=key==='custom'?customModes.filter(mode=>['bodyweight','dumbbells','bands'].includes(mode)):[...preset.modes];
  if(!modes.length)modes=['bodyweight'];
  const fullGym=modes.includes('full-gym');
  return {
    key:SESSION_SETUP_PRESETS[key]?key:'custom',
    label:key==='custom'?'Custom equipment':preset.label,
    modes:[...new Set(modes)],
    floor:fullGym?true:Boolean(floor),
    chair:fullGym?true:Boolean(chair),
    pullupBar:fullGym?true:Boolean(pullupBar),
    temporary:key!==normalSessionSetupKey()||key==='custom'
  };
}
function sessionSetupFromForm(form,fallbackKey=normalSessionSetupKey()){
  if(!form)return buildSessionSetup(fallbackKey);
  const data=new FormData(form);
  const key=String(data.get('sessionSetup')||fallbackKey);
  return buildSessionSetup(key,{
    customModes:data.getAll('customEquipment').map(String),
    floor:data.get('sessionFloor')==='on',
    chair:data.get('sessionChair')==='on',
    pullupBar:data.get('sessionPullupBar')==='on'
  });
}
function setupAllowsExercise(exercise,setup){
  if(!exercise||!setup)return false;
  if(!setup.modes.some(mode=>(exercise.equipment||[]).includes(mode)))return false;
  if(FLOOR_EXERCISE_IDS.has(exercise.id)&&!setup.floor)return false;
  if(CHAIR_STEP_EXERCISE_IDS.has(exercise.id)&&!setup.chair&&!setup.modes.includes('full-gym'))return false;
  if(PULLUP_BAR_EXERCISE_IDS.has(exercise.id)&&!setup.pullupBar&&!setup.modes.includes('full-gym'))return false;
  return !avoided(exercise,store.profile||{});
}
function effectiveExerciseForSetup(exercise,setup){
  const out=clone(exercise);
  const bodyweightOnly=setup.modes.length===1&&setup.modes[0]==='bodyweight';
  if(bodyweightOnly&&(out.equipment||[]).includes('bodyweight')&&!['bodyweight','timed'].includes(out.loadMode)){
    out.loadMode='bodyweight';
    out.style='bodyweight';
    out.increment=0;
    out.baseLoadFactor=0;
    out.referenceKey='';
    out.referenceMultiplier=0;
    out.sessionLoadOverride='bodyweight';
  }
  return out;
}
function sessionReplacementQuality(source,candidate){
  if(source.id===candidate.id)return 'Original';
  const overlap=muscleOverlap(source,candidate);
  if(source.movement===candidate.movement&&overlap>0)return 'Direct match';
  if(source.movement===candidate.movement)return 'Close match';
  return 'Training alternative';
}
function sessionReplacementReason(source,candidate,quality){
  if(quality==='Original')return 'This movement works with today’s setup.';
  if(quality==='Direct match')return 'Same movement pattern with overlapping target muscles.';
  if(quality==='Close match')return 'Same movement pattern with a different exercise setup.';
  return 'No direct equipment-free match was available, so this keeps the closest useful training purpose.';
}
function findSessionReplacement(source,setup,used=new Set()){
  const allowed=candidate=>!used.has(candidate.id)&&setupAllowsExercise(candidate,setup);
  const alternatives=SESSION_MOVEMENT_ALTERNATIVES[source.movement]||[];
  const scored=catalog
    .filter(allowed)
    .map(candidate=>{
      const sameId=candidate.id===source.id;
      const sameMovement=candidate.movement===source.movement;
      const alternativeIndex=alternatives.indexOf(candidate.movement);
      if(!sameId&&!sameMovement&&alternativeIndex<0)return null;
      const overlap=muscleOverlap(source,candidate);
      if(!sameId&&!sameMovement&&alternativeIndex>=0&&overlap===0)return null;
      const difficultyGap=Math.abs(exerciseDifficultyRank(source.difficulty)-exerciseDifficultyRank(candidate.difficulty));
      const score=(sameId?200:0)+(sameMovement?100:0)+(overlap*18)+(alternativeIndex>=0?40-(alternativeIndex*5):0)-difficultyGap*6-(candidate.setup||20)/30;
      return {candidate,score};
    })
    .filter(Boolean)
    .sort((a,b)=>b.score-a.score);
  if(!scored.length)return null;
  const candidate=effectiveExerciseForSetup(scored[0].candidate,setup);
  const quality=candidate.sessionLoadOverride?'Direct match':sessionReplacementQuality(source,candidate);
  const reason=candidate.sessionLoadOverride?'Same movement performed without external load for today’s setup.':sessionReplacementReason(source,candidate,quality);
  return {candidate,quality,reason};
}
function sessionPlanExerciseFromCandidate(source,template,replacement,setup){
  const candidate=replacement.candidate;
  const profile=store.profile||{};
  const settings=goalSettings(profile.goal||'muscle',candidate.movement,profile.experience||'beginner');
  const start=estimateStartingLoad(candidate,profile);
  const sameExercise=candidate.id===source.id&&!candidate.sessionLoadOverride;
  const reps=sameExercise?(template.reps||settings.reps):settings.reps;
  const sets=Math.max(1,num(template.sets)||settings.sets||2);
  return {
    ...candidate,
    sets,
    reps,
    startReps:recommendedRepCount(reps),
    rest:Math.max(30,Math.min(60,num(template.rest)||settings.rest||45)),
    setup:template.setup||candidate.setup||25,
    startWeight:start.weight||0,
    startLabel:start.label||'Bodyweight',
    startSource:sameExercise?(template.startSource||start.source||''):'temporary session setup',
    calibrationRequired:Boolean(start.calibrate),
    sessionAdapted:!sameExercise,
    sessionOriginalExerciseId:source.id,
    sessionOriginalName:source.name,
    sessionMatchQuality:replacement.quality,
    sessionMatchReason:replacement.reason,
    sessionSetupKey:setup.key,
    engineOriginalExerciseId:template.engineExerciseId||template.engineOriginalExerciseId||null,
    engineExerciseId:sameExercise?(template.engineExerciseId||null):null
  };
}
function fitSessionDayToTime(day,available){
  recalculatePlanDay(day);
  const notes=day.adaptationNotes=Array.isArray(day.adaptationNotes)?day.adaptationNotes:[];
  while(day.estimatedMinutes>available&&day.exercises.length>2){
    const reverse=[...day.exercises].reverse();
    const offset=reverse.findIndex(ex=>ACCESSORY_MOVEMENTS.has(ex.movement));
    if(offset<0)break;
    day.exercises.splice(day.exercises.length-1-offset,1);
    recalculatePlanDay(day);
  }
  for(let i=day.exercises.length-1;i>=0&&day.estimatedMinutes>available;i--){
    while(day.exercises[i]?.sets>2&&day.estimatedMinutes>available){
      day.exercises[i].sets-=1;
      recalculatePlanDay(day);
    }
  }
  return day;
}
function adaptDayForSessionSetup(day,setup,availableMinutes=null){
  const adjusted=clone(day);
  const originalExercises=clone(day.exercises||[]);
  const used=new Set(),changes=[],nextExercises=[];
  for(const template of originalExercises){
    const source=exerciseSource(template)||template;
    const replacement=findSessionReplacement(source,setup,used);
    if(!replacement){
      changes.push({type:'unavailable',fromId:source.id,fromName:source.name,quality:'Unavailable',reason:'No useful movement from the current catalog fits this setup.'});
      continue;
    }
    used.add(replacement.candidate.id);
    const next=sessionPlanExerciseFromCandidate(source,template,replacement,setup);
    nextExercises.push(next);
    if(next.sessionAdapted){
      changes.push({type:'replacement',fromId:source.id,fromName:source.name,toId:next.id,toName:next.name,quality:replacement.quality,reason:replacement.reason});
    }
  }
  adjusted.exercises=nextExercises;
  recalculatePlanDay(adjusted);
  if(availableMinutes)fitSessionDayToTime(adjusted,availableMinutes);
  const keptIds=new Set((adjusted.exercises||[]).map(ex=>ex.id));
  const relevantChanges=changes.filter(change=>change.type==='unavailable'||keptIds.has(change.toId));
  adjusted.trainingContext={
    ...setup,
    originalExercises,
    changes:relevantChanges,
    adapted:relevantChanges.length>0,
    changedCount:relevantChanges.filter(item=>item.type==='replacement').length,
    unavailableCount:relevantChanges.filter(item=>item.type==='unavailable').length
  };
  adjusted.adaptationNotes=[...(adjusted.adaptationNotes||[])];
  if(setup.key!==normalSessionSetupKey()||relevantChanges.length){
    adjusted.adaptationNotes.unshift('Today’s setup: '+sessionSetupLabel(setup)+'. '+(relevantChanges.length?relevantChanges.length+' planned movement'+(relevantChanges.length===1?' was':'s were')+' adjusted for this session.':'Your planned movements already fit.'));
  }
  return adjusted;
}
function runtimeExerciseFromSessionReplacement(source,template,replacement,setup){
  const effective=replacement.candidate;
  const next=workoutExerciseFromCandidate(effective,template,Math.max(1,template.sets?.length||2));
  next.sessionAdapted=effective.id!==source.id||Boolean(effective.sessionLoadOverride);
  next.sessionOriginalExerciseId=source.id;
  next.sessionOriginalName=source.name;
  next.sessionMatchQuality=replacement.quality;
  next.sessionMatchReason=replacement.reason;
  next.sessionSetupKey=setup.key;
  next.engineOriginalExerciseId=template.engineOriginalExerciseId||template.engineExerciseId||null;
  next.engineExerciseId=next.sessionAdapted?null:(template.engineExerciseId||null);
  next.manualComplete=false;
  next.manualCompletedAt=null;
  next.skipped=false;
  next.skipReason='';
  next.sessionSetupUnavailable=false;
  return next;
}
function applySetupToActiveWorkout(setup){
  const w=store.activeWorkout;
  if(!w)return {changed:0,unavailable:0};
  if(w.phase==='intro'&&w.trainingContext?.originalExercises?.length){
    const baseDay={
      id:w.planDayId,
      name:w.routineName,
      focus:w.focus,
      targetMinutes:w.readiness?.timeAvailable||store.profile?.minutes||45,
      estimatedMinutes:w.readiness?.timeAvailable||store.profile?.minutes||45,
      exercises:clone(w.trainingContext.originalExercises),
      adaptationNotes:clone(w.adaptationNotes||[]),
      engineBacked:w.engineBacked,
      engineSessionId:w.engineSessionId,
      engineWeek:w.engineWeek,
      engineBlockNumber:w.engineBlockNumber,
      engineMinimumViable:clone(w.engineMinimumViable||[]),
      engineStretch:clone(w.engineStretch||null)
    };
    const adapted=adaptDayForSessionSetup(baseDay,setup,w.readiness?.timeAvailable||store.profile?.minutes||45);
    if(!adapted.exercises.length)return {changed:0,unavailable:adapted.trainingContext?.unavailableCount||baseDay.exercises.length,blocked:true};
    const rebuilt=createWorkout(adapted,{
      scheduledDate:w.scheduledDate,
      readiness:w.readiness,
      programContext:w.programContext,
      trainingContext:adapted.trainingContext,
      adaptationNotes:adapted.adaptationNotes
    });
    w.exercises=rebuilt.exercises;
    w.warmup=rebuilt.warmup;
    w.cooldown=rebuilt.cooldown;
    w.trainingContext=adapted.trainingContext;
    w.adaptationNotes=adapted.adaptationNotes;
    w.currentExerciseIndex=0;
    w.currentSetIndex=0;
    w.furthestExerciseIndex=0;
    w.pendingPosition=null;
    w.revision=(num(w.revision)||0)+1;
    return {changed:num(adapted.trainingContext?.changedCount),unavailable:num(adapted.trainingContext?.unavailableCount)};
  }

  const used=new Set();
  for(const ex of w.exercises||[])if(exerciseState(ex)!=='not-started'&&!ex.sessionSetupUnavailable)used.add(ex.id);
  let changed=0,unavailable=0;
  const changes=[];
  for(let index=0;index<w.exercises.length;index++){
    const ex=w.exercises[index];
    const state=exerciseState(ex);
    if(!['not-started','skipped'].includes(state)&&!ex.sessionSetupUnavailable){used.add(ex.id);continue;}
    if(state==='skipped'&&!ex.sessionSetupUnavailable){used.add(ex.id);continue;}
    const source=catalog.find(item=>item.id===(ex.sessionOriginalExerciseId||ex.id))||exerciseSource(ex)||ex;
    const replacement=findSessionReplacement(source,setup,used);
    if(!replacement){
      ex.skipped=true;
      ex.skipReason='Unavailable with '+sessionSetupLabel(setup);
      ex.sessionSetupUnavailable=true;
      ex.sessionOriginalExerciseId=source.id;
      ex.sessionOriginalName=source.name;
      unavailable++;
      changes.push({type:'unavailable',fromId:source.id,fromName:source.name,quality:'Unavailable'});
      continue;
    }
    const next=runtimeExerciseFromSessionReplacement(source,ex,replacement,setup);
    w.exercises[index]=next;
    used.add(next.id);
    if(next.sessionAdapted){
      changed++;
      changes.push({type:'replacement',fromId:source.id,fromName:source.name,toId:next.id,toName:next.name,quality:replacement.quality,reason:replacement.reason});
    }
  }
  w.trainingContext={...(w.trainingContext||{}),...setup,changes,adapted:changed>0||unavailable>0,changedCount:changed,unavailableCount:unavailable,changedAt:new Date().toISOString()};
  const current=w.exercises[w.currentExerciseIndex||0];
  if(current)w.currentSetIndex=Math.max(0,Math.min(num(w.currentSetIndex),Math.max(0,(current.sets?.length||1)-1)));
  w.revision=(num(w.revision)||0)+1;
  return {changed,unavailable};
}
function renderSessionSetupOptions(selectedKey=normalSessionSetupKey(),prefix=''){
  const name=prefix+'sessionSetup';
  const options=['full-gym','bodyweight','dumbbells','bands','mixed-home','custom'];
  return '<div class="session-setup-grid">'+options.map(key=>{
    const preset=SESSION_SETUP_PRESETS[key];
    const copy=key==='full-gym'?'Machines, cables, barbells and more':key==='bodyweight'?'No gym equipment required':key==='dumbbells'?'Dumbbells plus bodyweight':key==='bands'?'Resistance bands plus bodyweight':key==='mixed-home'?'Dumbbells, bands and bodyweight':'Choose what is available';
    return '<label class="session-setup-card"><input type="radio" name="'+name+'" value="'+key+'" '+(key===selectedKey?'checked':'')+'><span><strong>'+esc(preset.label)+'</strong><small>'+copy+'</small></span></label>';
  }).join('')+'</div>';
}
function renderSessionSetupExtras(context={}){
  return '<div class="session-setup-extras"><div><span>AVAILABLE EXTRAS</span><small>These prevent the app from assuming equipment you do not have.</small></div>'+
    '<label><input type="checkbox" name="sessionFloor" '+(context.floor===false?'':'checked')+'> Floor space</label>'+
    '<label><input type="checkbox" name="sessionChair" '+(context.chair?'checked':'')+'> Sturdy chair / step</label>'+
    '<label><input type="checkbox" name="sessionPullupBar" '+(context.pullupBar?'checked':'')+'> Pull-up bar</label>'+
    '<div class="custom-equipment-row"><span>CUSTOM EQUIPMENT</span>'+
      '<label><input type="checkbox" name="customEquipment" value="bodyweight" '+((context.modes||['bodyweight']).includes('bodyweight')?'checked':'')+'> Bodyweight</label>'+
      '<label><input type="checkbox" name="customEquipment" value="dumbbells" '+((context.modes||[]).includes('dumbbells')?'checked':'')+'> Dumbbells</label>'+
      '<label><input type="checkbox" name="customEquipment" value="bands" '+((context.modes||[]).includes('bands')?'checked':'')+'> Bands</label>'+
    '</div></div>';
}
function renderTrainingContextSummary(context,compact=false){
  if(!context)return '';
  const changed=num(context.changedCount),unavailable=num(context.unavailableCount);
  return '<div class="training-context-summary '+(compact?'compact':'')+'"><div><span>TODAY’S SETUP</span><strong>'+esc(sessionSetupLabel(context))+'</strong><small>'+(changed?changed+' movement'+(changed===1?'':'s')+' changed':'Plan fits this setup')+(unavailable?' · '+unavailable+' unavailable':'')+'</small></div>'+(context.temporary?'<em>TODAY ONLY</em>':'')+'</div>';
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
  const priorityMap={chest:['horizontal-push'],back:['horizontal-pull','vertical-pull'],shoulders:['vertical-push','shoulder-accessory'],arms:['biceps','triceps'],legs:['squat','hinge','single-leg','quad-accessory','hamstring-accessory','calves'],glutes:['hinge','single-leg'],core:['core']};
  if((profile.priorities||[]).some(p=>(priorityMap[p]||[]).includes(exercise.movement)))score+=10;
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
    return {warmup,cooldown,seconds:[...warmup,...cooldown].reduce((sum,item)=>sum+timedStageEstimateSeconds(item),0)};
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
    warmupMinutes:Math.ceil(prep.warmup.reduce((sum,item)=>sum+timedStageEstimateSeconds(item),0)/60),
    cooldownMinutes:Math.ceil(prep.cooldown.reduce((sum,item)=>sum+timedStageEstimateSeconds(item),0)/60),
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

function engineGoal(goal){return ({muscle:'hypertrophy',strength:'strength','fat-loss':'general_fitness',general:'general_fitness'})[goal]||'general_fitness';}
function engineEquipment(equipment){
  const map={'full-gym':['dumbbell','bench','cable','machine','band'],'dumbbells':['dumbbell','bench'],'bodyweight':['bodyweight'],'bands':['band'],'mixed-home':['dumbbell','bench','band']};
  return map[equipment]||['bodyweight'];
}
function engineExperience(experience){return experience==='new'?'beginner':(experience||'beginner');}
function buildEngineProgram(profile){
  if(!programEngine)return null;
  try{
    const engineProfile={goal:engineGoal(profile.goal),experience:engineExperience(profile.experience),sessionsPerWeek:profile.days,sessionMinutes:profile.minutes,equipment:engineEquipment(profile.equipment),priorities:clone(profile.priorities||[]),exclusions:clone(store.exercisePreferences?.excluded||[]),stretchMinutes:10,mobilitySessionsPerWeek:1};
    const built=programEngine.rebalancePriorityVolume(programEngine.buildProgram(engineProfile));
    const validation=programEngine.validateProgram(built);
    if(!validation.valid)throw new Error(validation.errors.join('; '));
    return {storageSchema:PROGRAM_ENGINE_STORE_SCHEMA,engineVersion:built.version,createdAt:new Date().toISOString(),source:'program-engine',profile:engineProfile,program:built,validation};
  }catch(error){console.warn('Program Engine generation failed; legacy plan remains available.',error);return null;}
}
function refreshEngineProgram(profile=store.profile){
  const training=ensureTrainingProgram();
  const next=buildEngineProgram(profile);
  if(next)training.engine=next;
  return next;
}
function currentEngineProgram(){const e=ensureTrainingProgram().engine;return e?.storageSchema===PROGRAM_ENGINE_STORE_SCHEMA&&e?.program?e:null;}
function engineVersionForBlock(blockNumber){
 const training=ensureTrainingProgram(),versions=training.engineVersions||[];
 if(blockNumber<=1)return currentEngineProgram();
 return versions.find(v=>v.blockNumber===blockNumber)||currentEngineProgram();
}
function engineWeekForContext(context=programContext()){const e=engineVersionForBlock(context.blockNumber);if(!e)return null;return e.program.weeks?.[(Math.max(1,context.blockWeek)-1)%4]||null;}
function maybeCreateNextEngineBlock(completedEntry){
 const training=ensureTrainingProgram(),context=programContext(completedEntry?.scheduledDate?dateFromKey(completedEntry.scheduledDate):new Date());
 if(!programEngine||context.blockWeek!==4)return null;
 const current=engineVersionForBlock(context.blockNumber);if(!current?.program)return null;
 const blockRecords=(training.enginePerformance||[]).filter(r=>r.blockNumber===context.blockNumber);const finalWeekDone=blockRecords.filter(r=>r.engineWeek===4&&r.completionStatus!=='partial').length;
 if(finalWeekDone<Math.max(1,num(store.profile?.days)||4))return null;
 const nextBlock=context.blockNumber+1;if((training.engineVersions||[]).some(v=>v.blockNumber===nextBlock))return null;
 const records=blockRecords;
 const readiness=(training.engineReadiness||[]).filter(r=>r.blockNumber===context.blockNumber&&records.some(p=>p.workoutId===r.workoutId));
 const adaptation=programEngine.adaptationDecision(current.program,records,readiness);
 const nextProgram=programEngine.createProgramVersion(current.program,adaptation);
 const validation=programEngine.validateProgram(nextProgram);if(!validation.valid)return null;
 const version={storageSchema:PROGRAM_ENGINE_STORE_SCHEMA,engineVersion:nextProgram.version,createdAt:new Date().toISOString(),source:'program-engine-adaptation',blockNumber:nextBlock,parentBlockNumber:context.blockNumber,profile:clone(current.profile),program:nextProgram,validation,adaptation:clone(adaptation)};
 training.engineVersions.push(version);training.engineVersions=training.engineVersions.slice(-12);training.engineBlockVersion=nextBlock;
 return version;
}
const ENGINE_EXERCISE_TO_CATALOG={db_bench:'db-bench',pushup:'push-up',machine_press:'chest-press-machine',db_shoulder_press:'db-shoulder-press',cable_row:'cable-row',db_row:'one-arm-row',lat_pulldown:'lat-pulldown',goblet_squat:'goblet-squat',leg_press:'leg-press',db_rdl:'db-rdl',reverse_lunge:'reverse-lunge',leg_curl:'leg-curl',lateral_raise:'lateral-raise',db_curl:'biceps-curl',triceps_pressdown:'triceps-pushdown',calf_raise:'calf-raise',dead_bug:'dead-bug',incline_pushup:'push-up',inverted_row:'prone-w-raise',band_pulldown:'band-pulldown',split_squat:'split-squat',glute_bridge:'glute-bridge',pallof_press:'dead-bug',suitcase_carry:'plank'};
function engineSessionForDate(date,index){const context=programContext(date),week=engineWeekForContext(context);return week?.sessions?.[index%Math.max(1,week.sessions.length)]||null;}
function engineCatalogExercise(engineExercise){if(!engineExercise)return null;const mapped=ENGINE_EXERCISE_TO_CATALOG[engineExercise.id];return catalog.find(item=>item.id===mapped)||catalog.find(item=>item.name.toLowerCase()===String(engineExercise.name||'').toLowerCase())||null;}
const ENGINE_STRETCH_MEDIA={doorway_chest:'Chest_And_Front_Of_Shoulder_Stretch',thread_needle:'Thread_the_Needle',kneeling_lat:'Overhead_Lat',cross_body_shoulder:'Cross_Body_Shoulder_Stretch',triceps_overhead:'Triceps_Stretch',child_lat:'Childs_Pose',hip_flexor:'Kneeling_Hip_Flexor',adductor_rockback:'Adductor',hamstring_fold:'Hamstring_Stretch',figure_four:'IT_Band_and_Glute_Stretch',calf_wall:'Standing_Gastrocnemius_Calf_Stretch','90_90':'90_90_Hamstring'};
function engineStretchToLegacy(stretch){return (stretch?.activities||[]).map(item=>({name:item.name,seconds:Number(item.seconds)||30,description:'Hold a comfortable stretch and breathe steadily.',cue:item.perSide?'Complete both sides evenly.':'Stay relaxed and avoid forcing the range.',why:'Program Engine selected this for the muscles and movement patterns trained today.',mediaId:ENGINE_STRETCH_MEDIA[item.id]||''}));}
function engineSubstitutionCatalogIds(ex){return (ex?.engineSubstitutions||[]).map(item=>ENGINE_EXERCISE_TO_CATALOG[item.id]).filter(Boolean);}
function engineSessionToLegacyDay(session,fallbackDay,index=0,blockNumber=programContext().blockNumber){
  if(!session)return clone(fallbackDay);
  const exercises=(session.strength||[]).filter(item=>item.exercise).map(item=>{const source=engineCatalogExercise(item.exercise);if(!source)return null;const pr=item.prescription||{},repRange=Array.isArray(pr.reps)?pr.reps.join('–'):(pr.reps||'8–12'),estimated=estimateStartingLoad(source,store.profile||{});return {...source,sets:Math.max(1,num(pr.sets)||3),reps:repRange,startReps:Array.isArray(pr.reps)?pr.reps[0]:recommendedRepCount(repRange),rest:Math.max(30,Math.min(120,num(pr.restSeconds)||60)),startWeight:estimated.weight,startLabel:estimated.label,startSource:estimated.source||'Program Engine',calibrationRequired:estimated.calibrate,engineExerciseId:item.exercise.id,engineReason:clone(item.reason||[]),engineSubstitutions:clone(item.substitutions||[]),engineIntensityTarget:pr.intensityTarget||''};}).filter(Boolean);
  const fallback=clone(fallbackDay||{});if(!exercises.length)return fallback;
  const day={...fallback,id:fallback.id||('engine-day-'+(index+1)),name:fallback.name||session.label||'Training',focus:fallback.focus||'Program Engine session',targetMinutes:num(session.timeBudget?.targetMinutes)||num(store.profile?.minutes)||45,exercises,engineSessionId:session.id,engineWeek:session.week,engineBlockNumber:blockNumber,engineBacked:true,engineMinimumViable:clone(session.minimumViableWorkout||[]),engineStretch:clone(session.stretch||null)};
  recalculatePlanDay(day);
  day.warmup=(session.warmup||[]).map(item=>({name:item.name,seconds:Number(item.seconds)||30,description:'Program Engine movement preparation.',cue:'Move smoothly through a comfortable range.',why:'Prepares the movement patterns used in this session.'}));
  day.cooldown=engineStretchToLegacy(session.stretch);
  day.warmupMinutes=Math.ceil(day.warmup.reduce((sum,item)=>sum+timedStageEstimateSeconds(item),0)/60);
  day.cooldownMinutes=Math.ceil(day.cooldown.reduce((sum,item)=>sum+timedStageEstimateSeconds(item),0)/60);
  day.estimatedMinutes=num(session.timeBudget?.targetMinutes)||day.estimatedMinutes;return day;
}
function engineDayForSchedule(date,index,fallbackDay){const context=programContext(date),session=engineSessionForDate(date,index);return session?engineSessionToLegacyDay(session,fallbackDay,index,context.blockNumber):clone(fallbackDay);}
function engineProgramSetCount(engine){return (engine?.program?.weeks||[]).reduce((sum,w)=>sum+(w.sessions||[]).reduce((s,session)=>s+(session.strength||[]).filter(x=>x.exercise).reduce((n,x)=>n+(num(x.prescription?.sets)||0),0),0),0);}
function engineEvolutionData(){
 const context=programContext(),training=ensureTrainingProgram(),current=engineVersionForBlock(context.blockNumber),next=(training.engineVersions||[]).find(v=>v.blockNumber===context.blockNumber+1);
 if(!current)return null;
 const latest=(training.engineAdaptations||[]).filter(x=>x.workoutId).slice(-1)[0]||null;
 const source=next?.adaptation||latest;
 const before=engineProgramSetCount(current),after=next?engineProgramSetCount(next):null;
 const records=(training.enginePerformance||[]).filter(x=>x.blockNumber===context.blockNumber);
 const readiness=(training.engineReadiness||[]).filter(x=>x.blockNumber===context.blockNumber);
 const adherence=records.length?Math.round(records.reduce((s,x)=>s+(num(x.adherence)||0),0)/records.length):null;
 const lowRecovery=readiness.length?Math.round(readiness.filter(x=>(num(x.energy)||3)<=2||(num(x.sleep)||3)<=2||(num(x.soreness)||2)>=4).length/readiness.length*100):null;
 return {context,current,next,source,before,after,records:records.length,adherence,lowRecovery,readiness};
}
function currentWeekDecisionExperience(){
 const decision=adaptationDecision();
 const map={
   steady:{label:'Follow the planned week',copy:'No weekly adjustment is needed right now.'},
   repeat:{label:'Keep this week conservative',copy:'Last week was incomplete, so accessory work stays conservative instead of increasing.'},
   recover:{label:'Give recovery more room',copy:'Accessory volume is trimmed this week while the main work stays in place.'},
   build:{label:'Build this week',copy:'One primary movement gets an additional working set.'},
   push:{label:'Push this week',copy:'Up to two primary movements get one additional working set.'},
   consolidate:{label:'Consolidate this week',copy:'Accessory volume comes down while productive anchor work stays in place.'}
 };
 const display=map[decision.mode]||map.steady;
 const evidence=[];
 const previous=decision.previous;
 if(previous){
   evidence.push(Math.round(previous.completionRate*100)+'% of last week’s planned workouts completed');
   if(previous.averageReadiness)evidence.push('Average readiness '+previous.averageReadiness.toFixed(1)+'/5');
   if(previous.tooHardRate)evidence.push(Math.round(previous.tooHardRate*100)+'% of exercise feedback flagged too hard or form-off');
 }
 return {...display,mode:decision.mode,evidence,context:decision.context};
}
function nextBlockDecisionExperience(){
 const d=engineEvolutionData();
 if(!d)return {action:'maintain',signal:'Program learning is starting',decision:'No next-block change is locked yet',copy:'Complete workouts and readiness check-ins to give GoWorkout enough evidence to adapt the next block.',evidence:[],next:'Your current block stays in place.'};
 const action=d.next?.adaptation?.action||d.source?.action||'maintain';
 const labels={
   progress:{signal:'Performance is trending up',decision:d.next?'Progress the next block':'Keep learning before progressing'},
   reduce:{signal:'Recovery needs more room',decision:d.next?'Reduce next-block volume':'Keep this block steady while recovery is watched'},
   simplify:{signal:'Consistency is the priority',decision:d.next?'Simplify the next block':'Keep the current structure while consistency is watched'},
   maintain:{signal:'Your program is holding steady',decision:d.next?'Keep the next block steady':'No next-block change is locked yet'}
 };
 const selected=labels[action]||labels.maintain;
 const recent=(d.readiness||[]).slice(-3);
 const average=key=>recent.length?recent.reduce((sum,item)=>sum+num(item[key]),0)/recent.length:null;
 const flagged=recent.filter(item=>(num(item.energy)||3)<=2||(num(item.sleep)||3)<=2||(num(item.soreness)||2)>=4).length;
 const evidence=[];
 if(d.records)evidence.push(d.records+' completed session'+(d.records===1?'':'s')+' considered');
 if(recent.length){
   evidence.push('Recent energy '+average('energy').toFixed(1)+'/5');
   evidence.push('Recent sleep '+average('sleep').toFixed(1)+'/5');
   evidence.push('Recent soreness '+average('soreness').toFixed(1)+'/5');
   if(flagged)evidence.push(flagged+' of '+recent.length+' recent check-ins showed higher recovery demand');
 }else{
   if(d.adherence!==null)evidence.push(d.adherence+'% average adherence');
   if(d.lowRecovery!==null)evidence.push(d.lowRecovery+'% of readiness check-ins showed higher recovery demand');
 }
 const change=d.next&&d.after!==null?d.after-d.before:null;
 let next='Your current block stays unchanged.';
 if(d.next){
   if(change>0)next='Block '+d.next.blockNumber+' is ready with '+change+' more planned working set'+(change===1?'':'s')+' across the four-week block.';
   else if(change<0)next='Block '+d.next.blockNumber+' is ready with '+Math.abs(change)+' fewer planned working set'+(Math.abs(change)===1?'':'s')+' across the four-week block.';
   else next='Block '+d.next.blockNumber+' is ready with about the same total planned volume.';
 }
 const copy=action==='progress'
   ?'Completed work is supporting more progression, but changes stay at the block level so today’s plan does not keep moving underneath you.'
   :action==='reduce'
     ?'Recent readiness or workout feedback is pointing toward more recovery. GoWorkout keeps the current block stable and uses that pattern when the next block is created.'
     :action==='simplify'
       ?'Consistency matters more than adding complexity right now. GoWorkout is protecting the highest-priority work before adding more.'
       :'The current evidence does not call for a block-level change yet. GoWorkout will keep learning from completed sessions and readiness.';
 return {action,signal:selected.signal,decision:selected.decision,copy,evidence,next,ready:Boolean(d.next)};
}
function getProgramDecisionExperience(){
 return {week:currentWeekDecisionExperience(),block:nextBlockDecisionExperience()};
}
function renderProgramEvolution(){
 const x=getProgramDecisionExperience();
 return '<section class="clean-panel program-decision-card decision-'+esc(x.block.action)+'">'+
   '<div class="program-decision-head"><div><p class="eyebrow">PROGRAM DECISION</p><h3>'+esc(x.week.label)+'</h3><p>'+esc(x.week.copy)+'</p></div><span class="program-decision-status">'+(x.block.ready?'NEXT BLOCK READY':'LEARNING')+'</span></div>'+
   '<div class="program-decision-grid">'+
     '<div><span>THIS WEEK</span><strong>'+esc(x.week.label)+'</strong></div>'+
     '<div><span>SIGNAL</span><strong>'+esc(x.block.signal)+'</strong></div>'+
     '<div><span>NEXT BLOCK</span><strong>'+esc(x.block.decision)+'</strong></div>'+
   '</div>'+
   '<button class="program-why-toggle" type="button" data-action="toggle-program-why" aria-expanded="'+(programWhyOpen?'true':'false')+'"><span>Why this decision?</span><em>'+(programWhyOpen?'−':'+')+'</em></button>'+
   (programWhyOpen?'<div class="program-why-panel"><p>'+esc(x.block.copy)+'</p>'+
     ((x.week.evidence.length||x.block.evidence.length)?'<div class="program-evidence">'+[...x.week.evidence,...x.block.evidence].map(item=>'<span>'+esc(item)+'</span>').join('')+'</div>':'<small>GoWorkout needs more completed sessions before it can show stronger evidence.</small>')+
     '<div class="program-next-step"><span>WHAT HAPPENS NEXT</span><strong>'+esc(x.block.next)+'</strong></div></div>':'')+
 '</section>';
}
function renderEngineProgramSummary(){
 const engine=currentEngineProgram();
 const context=programContext(),profile=store.profile||{},goal=planGoalLabel(profile.goal||'general');
 const week=engine?engineWeekForContext(context):null;
 const sessions=week?.sessions?.length||num(profile.days)||store.plan?.days?.length||0;
 const phase=week?.label||blockPhaseLabel(context.blockWeek);
 const priorities=(profile.priorities||[]).map(x=>String(x).replaceAll('_',' '));
 const focus=priorities.length?priorities.join(' · '):'Balanced development';
 return '<section class="clean-panel human-program-card"><div><p class="eyebrow">YOUR PROGRAM</p><h3>'+esc(goal)+'</h3><p>'+sessions+' workouts/week · '+(num(profile.minutes)||45)+' min target · '+esc(equipmentLabel(profile.equipment||'full-gym'))+'</p><small>Current focus: '+esc(String(phase).toLowerCase())+' · '+esc(focus)+'</small></div><span class="human-program-phase">WEEK '+context.blockWeek+' OF 4</span></section>';
}
function workoutLearningExperience(learning){
 const action=learning?.adaptation?.action||'maintain';
 const map={
   progress:{title:'Your performance is trending up',copy:'This workout adds evidence that your next block can progress.'},
   reduce:{title:'Recovery needs more room',copy:'This workout adds evidence that your next block may need less volume.'},
   simplify:{title:'Consistency is the priority',copy:'This workout supports protecting the highest-priority work before adding more.'},
   maintain:{title:'Your program is holding steady',copy:'This workout supports keeping the current direction while GoWorkout learns more.'}
 };
 return map[action]||map.maintain;
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
  const existing=Array.isArray(day?.warmup)?day.warmup:[];
  const hasGuidedModel=existing.length&&existing.every(item=>item.mode||item.reps);
  return hasGuidedModel?existing:buildWarmup(day?.exercises||[]);
}
function plannedCooldown(day){
  return day?.cooldown?.length?day.cooldown:buildCooldown(day?.exercises||[]);
}
function renderPlanTimedRow(item,type,index){
  const image=timedStageImageUrl(item,0);
  const target=item.mode==='reps'||item.reps
    ? String(item.reps)+' reps'+(item.side?' '+item.side:'')
    : String(Number(item.seconds)||30)+'s';
  return `<div class="plan-prep-row ${type}">
    <div class="plan-prep-media">${image?`<img src="${esc(image)}" loading="lazy" decoding="async" alt="${esc(item.name)} demonstration">`:''}</div>
    <div class="plan-prep-copy">
      <span>${type==='warmup'?'WARM-UP':'COOLDOWN'} ${index+1}</span>
      <strong>${esc(item.name)}</strong>
      <small class="plan-description">${esc(timedStageDescription(item))}</small>
      <small>${esc(item.cue||'Move through a comfortable range.')}</small>
    </div>
    <em>${esc(target)}</em>
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
    displayName:String(data.get('displayName')||'').trim(),
    email:String(data.get('email')||'').trim(),
    gender:data.get('gender')||'',
    pronouns:String(data.get('pronouns')||'').trim(),
    visualAvatarId:String(data.get('visualAvatarId')||''),
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
    priorities:data.getAll('priorities').slice(0,2),
    lifts:{
      bench:num(data.get('bench')),
      squat:num(data.get('squat')),
      deadlift:num(data.get('deadlift')),
      overhead:num(data.get('overhead')),
      row:num(data.get('row'))
    }
  };
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
  if(!TRAINING_AVATARS.some(item=>item.id===profile.visualAvatarId)){
    toast('Choose the training avatar you want reflected in your workout visuals.');
    form.querySelector('.avatar-setup-section')?.scrollIntoView({behavior:'smooth',block:'center'});
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
  store.trainingProgram={scheduleOverrides:{},weekReviews:{},engine:null};
  refreshEngineProgram(profile);
  const persisted=saveStore();
  if(store.account?.status!=='connected'){
    accountSheetOpen=true;
    currentTab='profile-edit';
    render();
    setTimeout(()=>toast(store.account?.status==='pending'?'Confirm your email and sign in so this plan can follow you between browsers.':'Create or sign in to your account to finish setup and sync your plan.'),100);
    return true;
  }
  currentTab='home';
  render();
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
  store.trainingProgram={scheduleOverrides:{},weekReviews:{},engine:null};
  refreshEngineProgram(store.profile);
  saveStore();
  toast(currentEngineProgram()?'Plan rebuilt with Program Engine '+currentEngineProgram().engineVersion+'.':'Plan rebuilt from your profile.');
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
function openReadiness(dayId,scheduledDate='',preferredSetup=''){
  if(store.activeWorkout){currentTab='workout';render();toast('Resume or finish your current workout first.');return;}
  const entry=scheduledEntryFor(dayId,scheduledDate);
  const scheduledBase=entry?.day||store.plan?.days?.find(day=>day.id===dayId);
  const baseDay=entry?.adaptedDay||adaptDayForProgramWeek(scheduledBase,scheduledDate?dateFromKey(scheduledDate):new Date());
  if(!baseDay)return;
  readinessContext={dayId,scheduledDate:scheduledDate||entry?.dateKey||dateKey(),day:baseDay,preferredSetup:preferredSetup||normalSessionSetupKey()};
  render();
}
function closeReadiness(){readinessContext=null;render();}
function renderReadinessModal(){
  if(!readinessContext)return '';
  const day=readinessContext.day;
  const selectedMinutes=num(store.profile?.minutes)||45;
  const selectedSetup=readinessContext.preferredSetup||normalSessionSetupKey();
  const timeOptions=[20,30,45,60,75].filter(v=>v<=Math.max(75,selectedMinutes));
  if(!timeOptions.includes(selectedMinutes))timeOptions.push(selectedMinutes);
  timeOptions.sort((a,b)=>a-b);
  const scale=(name,left,right,selected=3)=>'<div class="readiness-scale"><div class="readiness-scale-head"><span>'+left+'</span><span>'+right+'</span></div><div class="readiness-buttons">'+[1,2,3,4,5].map(value=>'<label><input type="radio" name="'+name+'" value="'+value+'" '+(value===selected?'checked':'')+'><span>'+value+'</span></label>').join('')+'</div></div>';
  return '<div class="exercise-modal-backdrop readiness-backdrop" data-action="close-readiness">'+
    '<section class="exercise-modal readiness-modal train-anywhere-readiness" role="dialog" aria-modal="true" aria-label="Pre-workout readiness" data-readiness-panel>'+
      '<button class="modal-close" type="button" data-action="close-readiness" aria-label="Close readiness check">×</button>'+
      '<div class="readiness-head"><p class="eyebrow">TODAY · '+esc(formatDate(readinessContext.scheduledDate))+'</p><h2>'+esc(day.name)+'</h2><p>Set today’s time, recovery, and equipment. These choices affect this session only.</p></div>'+
      '<form id="readiness-form" class="readiness-form">'+
        '<section class="today-context-section"><div class="today-context-head"><div><span>TODAY’S SETUP</span><strong>Where are you training?</strong></div><em>TEMPORARY</em></div>'+
          renderSessionSetupOptions(selectedSetup)+renderSessionSetupExtras()+
          '<p class="session-context-note">Your normal training profile stays unchanged. GoWorkout will preserve the session’s movement intent and show any substitutions before you begin.</p>'+
        '</section>'+
        '<label class="readiness-question"><strong>Energy</strong><small>How much training energy do you have?</small>'+scale('energy','Low','High',3)+'</label>'+
        '<label class="readiness-question"><strong>Muscle soreness</strong><small>How sore do you feel overall?</small>'+scale('soreness','None','Very sore',2)+'</label>'+
        '<label class="readiness-question"><strong>Sleep</strong><small>How rested do you feel from last night?</small>'+scale('sleep','Poor','Great',3)+'</label>'+
        '<label class="field readiness-time"><span>TIME AVAILABLE TODAY</span><select name="timeAvailable">'+timeOptions.map(value=>'<option value="'+value+'" '+(value===selectedMinutes?'selected':'')+'>'+value+' minutes</option>').join('')+'</select></label>'+
        '<div class="readiness-preview"><span>PLANNED SESSION</span><strong>~'+esc(day.estimatedMinutes)+' min · '+day.exercises.length+' exercises</strong><small>You’ll review all temporary changes before the workout timer begins.</small></div>'+
        '<button class="button primary-action" type="button" data-action="begin-workout">PREPARE TODAY’S WORKOUT</button>'+
      '</form>'+
    '</section></div>';
}
async function startPreparedWorkout(){
  if(!readinessContext)return;
  const form=document.querySelector('#readiness-form');
  if(!form){toast('The readiness check could not be loaded. Please close it and try again.');return;}
  const data=new FormData(form);
  const readiness={
    energy:num(data.get('energy'))||3,
    soreness:num(data.get('soreness'))||2,
    sleep:num(data.get('sleep'))||3,
    timeAvailable:num(data.get('timeAvailable'))||num(store.profile?.minutes)||45
  };
  const setup=sessionSetupFromForm(form,readinessContext.preferredSetup||normalSessionSetupKey());
  readiness.score=readinessScore(readiness);
  readiness.sessionSetup={key:setup.key,label:sessionSetupLabel(setup),modes:clone(setup.modes)};
  if(readinessContext.sharedDraft?.backendId&&workoutSupabase&&store.account?.userId){
    await workoutSupabase.from('workout_shared_participant_state').update({readiness,ready:true,phase:'ready',updated_at:new Date().toISOString()}).eq('session_id',readinessContext.sharedDraft.backendId).eq('user_id',store.account.userId);
  }
  const sourceDay=clone(readinessContext.day);
  let day=applyReadinessToDay(sourceDay,readiness);
  if(day.engineBacked&&readiness.timeAvailable&&readiness.timeAvailable<(day.targetMinutes||store.profile?.minutes||45)&&programEngine?.compressSession){
    const engine=currentEngineProgram(),week=engine?.program?.weeks?.find(w=>w.week===day.engineWeek),session=week?.sessions?.find(s=>s.id===day.engineSessionId);
    if(session){
      const compressed=programEngine.compressSession(session,readiness.timeAvailable);
      day=engineSessionToLegacyDay(compressed,day);
      day.adaptationNotes=[...(day.adaptationNotes||[]),'Program Engine protected priority movements and trimmed lower-priority work for '+readiness.timeAvailable+' available minutes.'];
    }
  }
  day=adaptDayForSessionSetup(day,setup,readiness.timeAvailable);
  if(!day.exercises.length){toast('No usable exercises match that setup. Add floor space, equipment, or choose another setup.');return;}
  const scheduledDate=readinessContext.scheduledDate;
  const context=programContext(dateFromKey(scheduledDate));
  const sharedDraft=readinessContext.sharedDraft?clone(readinessContext.sharedDraft):null;
  readinessContext=null;
  unlockWorkoutCues();
  store.activeWorkout=createWorkout(day,{
    scheduledDate,
    readiness,
    programContext:context,
    trainingContext:day.trainingContext,
    adaptationNotes:[...(day.adaptationNotes||[]),...(day.readinessNotes||[])]
  });
  if(sharedDraft)store.activeWorkout.sharedSession={...sharedDraft,startedTogetherAt:new Date().toISOString()};
  saveStore();currentTab='workout';render();
  if(sharedDraft?.backendId)activateSharedWorkout(sharedDraft).catch(error=>console.warn('Shared workout activation failed',error));
}

function createWorkout(day,meta={}){
  const now=new Date().toISOString();
  const workout={
    schemaVersion:ACTIVE_WORKOUT_SCHEMA,
    id:uid('workout'),planId:store.plan.id,planDayId:day.id,routineName:day.name,focus:day.focus,
    scheduledDate:meta.scheduledDate||dateKey(),actualStartDate:dateKey(),
    readiness:meta.readiness||null,trainingContext:meta.trainingContext||day.trainingContext||null,programContext:meta.programContext||programContext(),adaptationNotes:meta.adaptationNotes||day.adaptationNotes||[],
    startedAt:now,currentExerciseIndex:0,currentSetIndex:0,furthestExerciseIndex:0,
    isPaused:false,pausedAt:null,
    phase:'intro',timedPhaseStartedAt:null,timedPhaseSkippedSeconds:0,timedStageIndex:0,timedStageReps:0,
    warmup:plannedWarmup(day),cooldown:plannedCooldown(day),
    engineBacked:Boolean(day.engineBacked),engineSessionId:day.engineSessionId||null,engineWeek:day.engineWeek||null,engineBlockNumber:day.engineBlockNumber||null,engineMinimumViable:clone(day.engineMinimumViable||[]),engineStretch:clone(day.engineStretch||null),
    exerciseStartedAt:null,exerciseDurations:{},
    restEndsAt:null,restDuration:0,restPausedRemaining:null,restToken:null,pendingPosition:null,
    revision:1,processedActions:{},finalizing:false,
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
  const w=store.activeWorkout;
  if(!w||!Array.isArray(w.exercises)||!w.exercises.length)return null;
  const ei=Math.min(Math.max(0,Number(w.currentExerciseIndex)||0),w.exercises.length-1);
  const ex=w.exercises[ei];
  if(!ex||!Array.isArray(ex.sets)||!ex.sets.length)return null;
  const si=Math.min(Math.max(0,Number(w.currentSetIndex)||0),ex.sets.length-1);
  const set=ex.sets[si];
  if(!set)return null;
  return {workout:w,ei,si,exercise:ex,set};
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
function timedStageSnapshot(w,nowMs=Date.now()){
  if(!w||!['warmup','cooldown'].includes(w.phase)) return null;
  const items=timedStageItems(w);
  if(!items.length) return {complete:true,index:0,remaining:0,remainingExact:0,total:0};
  const index=Math.max(0,Math.min(Number(w.timedStageIndex)||0,items.length-1));
  const item=items[index];
  if(w.reviewPausedTimedStage&&w.reviewPausedTimedStage.phase===w.phase){
    const paused=w.reviewPausedTimedStage;
    if(paused.mode==='reps'){
      return {complete:false,itemComplete:false,index,mode:'reps',completedReps:Number(paused.completedReps)||0,totalReps:Number(item.reps)||8,total:0,remaining:0,remainingExact:0};
    }
    return {complete:false,itemComplete:false,index,mode:'time',remaining:Math.max(0,Math.ceil(Number(paused.remainingExact)||0)),remainingExact:Math.max(0,Number(paused.remainingExact)||0),total:Number(paused.total)||Number(item.seconds)||30};
  }
  if(item.mode==='reps'||item.reps){
    const completedReps=Math.max(0,Number(w.timedStageReps)||0);
    const totalReps=Math.max(1,Number(item.reps)||8);
    return {complete:false,itemComplete:completedReps>=totalReps,index,mode:'reps',completedReps,totalReps,total:0,remaining:0,remainingExact:0};
  }
  nowMs=workoutNowMs(w,nowMs);
  const startMs=Date.parse(w.timedPhaseStartedAt||'');
  if(!Number.isFinite(startMs)) return null;
  const total=Math.max(1,Number(item.seconds)||30);
  const elapsed=Math.max(0,(nowMs-startMs)/1000);
  const remainingExact=Math.max(0,total-elapsed);
  return {complete:false,itemComplete:remainingExact<=0,index,mode:'time',remaining:Math.max(0,Math.ceil(remainingExact)),remainingExact,total};
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
  w.pendingPosition=null;w.restEndsAt=null;w.restPausedRemaining=null;w.restDuration=0;w.restToken=null;
  delete w.timedSetStartedAt;delete w.timedSetEndsAt;delete w.timedSetDuration;delete w.timedSetPausedRemaining;delete w.setStartedAt;
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
  set.performanceInsight=setPerformanceInsight(ex,set,setEditContext.si);
  if(store.activeWorkout)store.activeWorkout.lastSetInsight=set.performanceInsight;
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
  const w=store.activeWorkout,tabs=[['warmup','Warm-up'],['strength','Strength'],['cooldown','Cooldown']];
  const warmRows=(w.warmup||[]).map((item,index)=>'<div class="map-simple-row"><span>'+String(index+1)+'</span><div><strong>'+esc(item.name)+'</strong><small>'+(item.mode==='reps'||item.reps?esc(item.reps+' reps'+(item.side?' '+item.side:'')):formatClock(item.seconds||30))+'</small></div></div>').join('');
  const coolRows=(w.cooldown||[]).map((item,index)=>'<div class="map-simple-row"><span>'+String(index+1)+'</span><div><strong>'+esc(item.name)+'</strong><small>'+formatClock(item.seconds||30)+'</small></div></div>').join('');
  const strengthRows=w.exercises.map((ex,index)=>{
    const state=exerciseState(ex),done=(ex.sets||[]).filter(set=>set.completed).length;
    const status=state==='complete'?'✓':state==='completed-manually'?'✓':state==='partial'?done+'/'+ex.sets.length:state==='skipped'?'SKIP':'';
    return '<article class="workout-map-row '+(index===w.currentExerciseIndex?'current':'')+'"><button class="map-open" type="button" '+(!['intro','warmup-routine','warmup','warmup-complete'].includes(w.phase)?'data-action="jump-exercise" data-exercise-index="'+index+'"':'')+'><span class="map-number">'+String(index+1)+'</span><div class="map-copy"><strong>'+esc(ex.name)+'</strong><span>'+esc(ex.sets.length+' × '+ex.reps)+(ex.suggestedWeight?' · '+esc(ex.suggestedWeight)+' lb':'')+'</span></div><em class="map-status">'+esc(status)+'</em></button><button class="map-more" type="button" data-action="open-exercise-actions" data-exercise-index="'+index+'">•••</button></article>';
  }).join('');
  const body=workoutMapView==='warmup'?warmRows:workoutMapView==='cooldown'?coolRows:strengthRows;
  return '<div class="exercise-modal-backdrop workout-map-backdrop" data-action="close-workout-map"><section class="exercise-modal workout-map-modal runner-map-modal" data-workout-map-panel role="dialog" aria-modal="true"><button class="modal-close" data-action="close-workout-map" type="button">×</button><div class="workout-map-head"><h2>'+esc(w.routineName)+'</h2></div><div class="runner-map-tabs">'+tabs.map(([id,label])=>'<button class="'+(workoutMapView===id?'active':'')+'" data-action="set-workout-map-view" data-map-view="'+id+'">'+label+'</button>').join('')+'</div><div class="workout-map-list">'+body+'</div></section></div>';
}

function beginPreSetPosition(ei,si,isNewExercise=true){
  const w=store.activeWorkout;if(!w)return;
  const previousIndex=w.currentExerciseIndex||0;
  if(isNewExercise&&w.exerciseStartedAt&&previousIndex!==ei)recordExerciseDuration(w,previousIndex);
  w.currentExerciseIndex=ei;
  w.furthestExerciseIndex=Math.max(num(w.furthestExerciseIndex),ei);
  w.currentSetIndex=si;
  prepareSetTarget(w.exercises[ei],w.exercises[ei]?.sets?.[si],si);
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
  const setup=Math.max(0,num(w.preSetSetupSeconds));
  const countdown=Math.max(1,num(w.preSetCountdownSeconds)||3);
  const total=setup+countdown;
  if(Number.isFinite(w.reviewPausedPreSetRemaining)){
    const remainingExact=Math.max(0,Number(w.reviewPausedPreSetRemaining));
    if(remainingExact<=0)return {complete:true,mode:'countdown',remaining:0,total};
    if(remainingExact>countdown)return {complete:false,mode:'setup',remaining:Math.max(1,Math.ceil(remainingExact-countdown)),total};
    return {complete:false,mode:'countdown',remaining:Math.max(1,Math.ceil(remainingExact)),total};
  }
  nowMs=workoutNowMs(w,nowMs);
  const start=Date.parse(w.preSetStartedAt||'');
  if(!Number.isFinite(start))return null;
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
  prepareSetTarget(pos.exercise,pos.set,pos.si);
  const now=new Date().toISOString();
  if(!w.exerciseStartedAt)w.exerciseStartedAt=now;
  pos.set.plannedWeight=String(pos.set.weight??'');
  pos.set.plannedReps=String(pos.set.reps??'');
  pos.set.startedAt=now;
  delete w.preSetStartedAt;delete w.preSetSetupSeconds;delete w.preSetCountdownSeconds;delete w.preSetIsNewExercise;
  if(pos.exercise.loadMode==='timed'){
    const seconds=Math.max(1,num(pos.set.reps)||num(pos.exercise.suggestedReps)||recommendedRepCount(pos.exercise.reps)||30);
    pos.set.reps=String(seconds);
    w.phase='timed-set';
    w.timedSetStartedAt=now;
    w.timedSetDuration=seconds;
    w.timedSetEndsAt=new Date(Date.now()+seconds*1000).toISOString();
    delete w.setStartedAt;
  }else{
    w.phase='work';
    w.setStartedAt=now;
  }
  fireWorkoutSignal('go','go-'+w.id+'-'+pos.ei+'-'+pos.si,{voice:'Go',label:'GO'});
  saveStore();render();
}
function timedSetSnapshot(w,nowMs=Date.now()){
  if(!w||w.phase!=='timed-set')return null;
  const duration=Math.max(1,num(w.timedSetDuration)||1);
  if(Number.isFinite(w.reviewPausedTimedSetRemaining)){
    const remainingExact=Math.max(0,Number(w.reviewPausedTimedSetRemaining));
    return {complete:remainingExact<=0,remaining:Math.max(0,Math.ceil(remainingExact)),remainingExact,total:duration};
  }
  nowMs=workoutNowMs(w,nowMs);
  const end=Date.parse(w.timedSetEndsAt||'');
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
  pos.set.plannedReps=String(pos.set.plannedReps??duration);
  pos.set.completed=true;pos.set.completedAt=new Date().toISOString();
  pos.set.durationSeconds=num(pos.set.reps);
  w.lastCompletedSet={exerciseId:pos.exercise.id,exerciseName:pos.exercise.name,weight:String(pos.set.weight||''),reps:String(pos.set.reps||''),durationSeconds:pos.set.durationSeconds,plannedWeight:String(pos.set.plannedWeight||''),plannedReps:String(pos.set.plannedReps||duration)};
  const insight=setPerformanceInsight(pos.exercise,pos.set,pos.si);
  pos.set.performanceInsight=insight;
  w.lastSetInsight=insight;
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
  w.timedStageIndex=0;
  w.timedStageReps=0;
  w.timedPhaseStartedAt=now;
  w.timedPhaseSkippedSeconds=0;
  delete w.reviewPausedTimedStage;
  if(!w.cooldown?.length){openWorkoutReview();return;}
  saveStore();render();
}

function completeTimedStagePhase(w){
  if(w.phase==='warmup'){
    w.timedPhaseStartedAt=null;
    w.timedPhaseSkippedSeconds=0;
    completeWarmup();
    return;
  }
  w.timedPhaseStartedAt=null;
  w.timedPhaseSkippedSeconds=0;
  fireWorkoutSignal('complete','cooldown-complete-'+w.id,{voice:'Cooldown complete. Review your workout before saving.',label:'DONE'});
  openWorkoutReview();
}

function reconcileTimedStage(){
  const w=store.activeWorkout;
  if(!w||!['warmup','cooldown'].includes(w.phase))return false;
  const snap=timedStageSnapshot(w);
  if(!snap)return false;
  if(snap.mode==='time'&&snap.itemComplete){advanceTimedStage();return true;}
  if(snap.mode==='reps'&&snap.itemComplete){advanceTimedStage();return true;}
  return false;
}

function advanceTimedStage(){
  const w=store.activeWorkout;if(!w||!['warmup','cooldown'].includes(w.phase))return;
  const items=timedStageItems(w);
  if(!items.length){completeTimedStagePhase(w);return;}
  const index=Math.max(0,Math.min(Number(w.timedStageIndex)||0,items.length-1));
  if(index>=items.length-1){completeTimedStagePhase(w);return;}
  w.timedStageIndex=index+1;
  w.timedStageReps=0;
  w.timedPhaseStartedAt=new Date().toISOString();
  delete w.reviewPausedTimedStage;
  fireWorkoutSignal('transition','stage-'+w.id+'-'+w.phase+'-'+w.timedStageIndex,{voice:'Next',label:'NEXT'});
  saveStore();render();
}

function workoutActionKey(w,type,ei,si){return [w?.id,type,ei??'',si??''].join(':');}
function claimWorkoutAction(w,key){
 if(!w||!key)return false;w.processedActions=w.processedActions||{};
 if(w.processedActions[key])return false;w.processedActions[key]=new Date().toISOString();
 const keys=Object.keys(w.processedActions);if(keys.length>120)keys.slice(0,keys.length-120).forEach(k=>delete w.processedActions[k]);
 w.revision=(num(w.revision)||0)+1;return true;
}
function newTimerToken(type,w){return [type,w?.id||'workout',Date.now(),Math.random().toString(36).slice(2,7)].join(':');}
function beginRest(next,seconds){
  const w=store.activeWorkout;
  if(!w)return;
  if(!next){ startCooldown();return; }
  const safeRest=Math.max(30,Math.min(60,seconds||45));
  w.phase='rest';w.restDuration=safeRest;w.restEndsAt=new Date(Date.now()+safeRest*1000).toISOString();
  w.restPausedRemaining=null;w.restToken=newTimerToken('rest',w);w.pendingPosition=next;saveStore();render();
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
  if(pos.set.completed){toast('That set is already logged.');return;}
  const weight=String(pos.set.weight??document.querySelector('#set-weight')?.value??'').trim().replace(/[^0-9.]/g,'');
  const reps=String(pos.set.reps??document.querySelector('#set-reps')?.value??'').trim().replace(/[^0-9.]/g,'');
  if(num(reps)<=0){toast(pos.exercise.loadMode==='timed'?'Enter the seconds completed.':'Enter the reps completed.');return;}
  const actionKey=workoutActionKey(pos.workout,'complete-set',pos.ei,pos.si);
  if(!claimWorkoutAction(pos.workout,actionKey)){toast('That set is already logged.');return;}
  pos.set.plannedWeight=String(pos.set.plannedWeight??weight);
  pos.set.plannedReps=String(pos.set.plannedReps??reps);
  pos.set.weight=weight;pos.set.reps=reps;pos.set.completed=true;pos.set.completedAt=new Date().toISOString();
  pos.set.durationSeconds=Math.max(1,setElapsedSeconds(pos.workout));
  delete pos.workout.setStartedAt;
  const insight=setPerformanceInsight(pos.exercise,pos.set,pos.si);
  pos.set.performanceInsight=insight;
  pos.workout.lastSetInsight=insight;
  pos.workout.lastCompletedSet={exerciseId:pos.exercise.id,exerciseName:pos.exercise.name,weight,reps,durationSeconds:pos.set.durationSeconds,plannedWeight:pos.set.plannedWeight,plannedReps:pos.set.plannedReps};
  fireWorkoutSignal('complete','complete-'+pos.workout.id+'-'+pos.ei+'-'+pos.si,{voice:'Set complete',label:'DONE'});
  const next=nextPosition(pos.workout,pos.ei,pos.si);
  if(next && next.ei===pos.ei){
    const nextSet=pos.exercise.sets[next.si];
    nextSet.weight=weight;
    nextSet.reps=reps;
    nextSet.targetPrepared=true;
    nextSet.targetSource='previous-set';
  }
  if(pos.si===0 && pos.exercise.calibrationRequired && !['bodyweight','timed','band','assisted'].includes(pos.exercise.loadMode)){
    pos.workout.phase='calibrate';pos.workout.pendingPosition=next;saveStore();render();return;
  }
  if(!next||next.ei!==pos.ei){startExerciseFeedback(next);return;}
  beginRest(next,pos.exercise.rest||45);
}

function skipCurrentSet(reason='Skipped by user'){
 const pos=getActivePosition();if(!pos||pos.workout.phase!=='work')return;
 const key=workoutActionKey(pos.workout,'skip-set',pos.ei,pos.si);if(!claimWorkoutAction(pos.workout,key))return;
 pos.set.skipped=true;pos.set.skipReason=reason;pos.set.completed=false;pos.set.completedAt=null;
 delete pos.workout.setStartedAt;
 const next=nextPosition(pos.workout,pos.ei,pos.si);
 if(!next||next.ei!==pos.ei){startExerciseFeedback(next);return;}
 beginRest(next,Math.min(30,pos.exercise.rest||30));
}
function skipRest(){
 const w=store.activeWorkout;if(!w||w.phase!=='rest')return;
 const token=w.restToken;w.restEndsAt=new Date().toISOString();w.restPausedRemaining=null;saveStore();advanceAfterRest(token);
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

function advanceAfterRest(expectedToken=null){
  const w=store.activeWorkout;if(!w||w.phase!=='rest')return;
  if(expectedToken&&w.restToken!==expectedToken)return;
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
  ['startedAt','exerciseStartedAt','setStartedAt','warmupStartedAt','timedPhaseStartedAt','preSetStartedAt','timedSetStartedAt','timedSetEndsAt','restEndsAt'].forEach(key=>shiftWorkoutTimestamp(w,key,delta));
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
  }else if(w.phase==='work'){
    w.setStartedAt=now.toISOString();
  }else if(w.phase==='warmup'||w.phase==='cooldown'){
    const snap=timedStageSnapshot(w);if(!snap)return;
    if(snap.mode==='reps')w.timedStageReps=0;
    else w.timedPhaseStartedAt=now.toISOString();
  }else return;
  saveStore();
  fireWorkoutSignal('transition','timer-reset-'+w.id+'-'+w.phase+'-'+Date.now(),{voice:'Timer reset',label:'RESET'});
  render();
}


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
function resumeReviewedPhase(w,phase){
  if(!w)return;
  const now=Date.now();
  if(['warmup','cooldown'].includes(phase)&&w.reviewPausedTimedStage){
    const items=phase==='warmup'?(w.warmup||[]):(w.cooldown||[]);
    const index=Math.max(0,Math.min(Number(w.reviewPausedTimedStage.index)||0,Math.max(0,items.length-1)));
    w.timedStageIndex=index;
    if(w.reviewPausedTimedStage.mode==='reps'){
      w.timedStageReps=Math.max(0,Number(w.reviewPausedTimedStage.completedReps)||0);
      w.timedPhaseStartedAt=new Date(now).toISOString();
    }else{
      const total=Number(items[index]?.seconds)||Number(w.reviewPausedTimedStage.total)||30;
      const remaining=Math.max(0,Number(w.reviewPausedTimedStage.remainingExact)||0);
      w.timedPhaseStartedAt=new Date(now-(total-remaining)*1000).toISOString();
    }
    delete w.reviewPausedTimedStage;
  }
  if(phase==='pre-set'&&Number.isFinite(w.reviewPausedPreSetRemaining)){
    const setup=Math.max(0,num(w.preSetSetupSeconds)),countdown=Math.max(1,num(w.preSetCountdownSeconds)||3);
    const total=setup+countdown,remaining=Math.max(0,Number(w.reviewPausedPreSetRemaining));
    w.preSetStartedAt=new Date(now-(total-remaining)*1000).toISOString();
    delete w.reviewPausedPreSetRemaining;
  }
  if(phase==='timed-set'&&Number.isFinite(w.reviewPausedTimedSetRemaining)){
    const duration=Math.max(1,num(w.timedSetDuration)||1),remaining=Math.max(0,Number(w.reviewPausedTimedSetRemaining));
    w.timedSetStartedAt=new Date(now-(duration-remaining)*1000).toISOString();
    w.timedSetEndsAt=new Date(now+remaining*1000).toISOString();
    delete w.reviewPausedTimedSetRemaining;
  }
  if(phase==='rest'&&Number.isFinite(w.restPausedRemaining)){
    w.restEndsAt=new Date(now+Math.max(0,Number(w.restPausedRemaining))*1000).toISOString();
    delete w.restPausedRemaining;
  }
}
function continueWorkoutFromReview(){
  const w=store.activeWorkout;if(!w||w.phase!=='review')return;
  const index=nextUnresolvedExerciseIndex(w,-1);
  if(index>=0){navigateToExercise(index);return;}
  const phase=w.returnPhase&&w.returnPhase!=='review'?w.returnPhase:'exercise-review';
  w.phase=phase;
  resumeReviewedPhase(w,phase);
  delete w.returnPhase;saveStore();render();updateTimers();
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
function engineSessionById(id){const engine=currentEngineProgram();if(!engine||!id)return null;for(const week of engine.program.weeks||[])for(const session of week.sessions||[])if(session.id===id)return session;return null;}
function engineFeedbackFromWorkout(entry){const feedback=(entry.exercises||[]).map(ex=>ex.feedback).filter(Boolean);const difficulty=feedback.includes('too-hard')?5:feedback.includes('hard')||feedback.includes('form-off')?4:feedback.includes('too-easy')?2:3;const pain=(entry.exercises||[]).some(ex=>ex.swapReason==='pain'||ex.skipReason==='pain'||ex.feedback==='form-off');const enjoyment=feedback.includes('too-hard')?2:feedback.includes('too-easy')?4:3;return {difficulty,energyAfter:Math.max(1,Math.min(5,num(entry.readiness?.energy)||3)),pain,enjoyment};}
function ingestEngineWorkout(entry){
 if(!entry?.engineBacked||!entry.engineSessionId||!programEngine)return null;const session=engineSessionById(entry.engineSessionId);if(!session)return null;
 const performed={completedAt:entry.completedAt,exercises:(entry.exercises||[]).map(ex=>({exerciseId:ex.engineExerciseId||ex.id,sets:(ex.sets||[]).map(set=>({reps:num(set.reps),weight:num(set.weight),completed:Boolean(set.completed)}))})),feedback:engineFeedbackFromWorkout(entry)};
 const performance=programEngine.ingestPerformance(session,performed);performance.workoutId=entry.id;performance.completionStatus=entry.completionStatus;performance.blockNumber=entry.engineBlockNumber||1;performance.engineWeek=entry.engineWeek||null;performance.engineVersion=engineVersionForBlock(entry.engineBlockNumber||1)?.engineVersion||null;performance.interpretation=programEngine.interpretPostWorkoutFeedback(performed.feedback);
 const training=ensureTrainingProgram();training.enginePerformance.push(performance);training.enginePerformance=training.enginePerformance.slice(-100);
 const readiness={energy:num(entry.readiness?.energy)||3,sleep:num(entry.readiness?.sleep)||3,soreness:num(entry.readiness?.soreness)||2,stress:3,workoutId:entry.id,blockNumber:entry.engineBlockNumber||1,completedAt:entry.completedAt};training.engineReadiness.push(readiness);training.engineReadiness=training.engineReadiness.slice(-100);
 const adaptation=programEngine.adaptationDecision(currentEngineProgram().program,training.enginePerformance,training.engineReadiness);training.engineAdaptations.push({...adaptation,workoutId:entry.id,at:entry.completedAt});training.engineAdaptations=training.engineAdaptations.slice(-50);
 entry.engineLearning={performance:clone(performance),adaptation:clone(adaptation)};return entry.engineLearning;
}
function finalizeWorkout(status='complete'){
  const w=store.activeWorkout;if(!w||w.finalizing)return;
  const finalizeKey=workoutActionKey(w,'finalize');if(!claimWorkoutAction(w,finalizeKey))return;w.finalizing=true;
  if(status==='complete'&&!workoutIsFullyResolved(w)){
    for(const ex of w.exercises){
      if(!exerciseCountsAsResolved(ex)){ex.skipped=true;ex.skipReason='Finished without completing this exercise';}
    }
  }
  const count=completedSets(w.exercises);
  const old=new Map(w.exercises.map(e=>[e.id,previousBest(e.id)]));
  const completedAt=new Date().toISOString();
  const entry={...w,phase:'complete',completionStatus:status,completedAt,actualCompletedDate:dateKey(),durationMinutes:Math.max(1,Math.round((new Date(completedAt)-new Date(w.startedAt))/60000)),completedSets:count,resolvedExercises:workoutResolvedCount(w),totalVolume:volume(w.exercises),newPRs:[],baselines:[]};
  for(const ex of entry.exercises){
    let session=null;
    for(const set of ex.sets||[]){if(!set.completed)continue;const c={weight:num(set.weight),reps:num(set.reps)};
      if(!session||c.weight>session.weight||(c.weight===session.weight&&c.reps>session.reps))session=c;
    }
    const before=old.get(ex.id);
    if(session&&!before)entry.baselines.push({exerciseId:ex.id,name:ex.name,...session});
    else if(session&&(session.weight>before.weight||(session.weight===before.weight&&session.reps>before.reps)))entry.newPRs.push({exerciseId:ex.id,name:ex.name,...session});
  }
  if(entry.engineBacked){ingestEngineWorkout(entry);maybeCreateNextEngineBlock(entry);}
  ['pendingPosition','restEndsAt','restPausedRemaining','lastProgressionResult','preSetStartedAt','preSetSetupSeconds','preSetCountdownSeconds','preSetIsNewExercise','pausedAt','isPaused','timedSetStartedAt','timedSetDuration','timedSetEndsAt','timedSetPausedRemaining','returnPhase'].forEach(key=>delete entry[key]);
  if(store.history.some(item=>item.id===entry.id)){store.activeWorkout=null;saveStore();currentTab='summary';render();return;}
  store.history.unshift(entry);store.history=store.history.slice(0,100);store.lastSummaryId=entry.id;
  if(entry.sharedSession){
    const shared=sharedTrainingState();
    shared.history.unshift({id:entry.sharedSession.id,workoutId:entry.id,partnerName:entry.sharedSession.partnerName,routineName:entry.routineName,completedAt,completionStatus:status});
    shared.history=shared.history.slice(0,50);
    if(shared.draft?.id===entry.sharedSession.id)shared.draft=null;
    if(entry.sharedSession.backendId)completeSharedParticipant(entry.sharedSession,status).catch(error=>console.warn('Shared completion sync failed',error));
  }
  store.activeWorkout=null;
  rebuildDerivedTrainingState();const persisted=saveStore();if(!persisted){store.activeWorkout=w;w.finalizing=false;toast('Workout could not be saved. Your active session is still available.');return;}currentTab='summary';render();
}
function finishWorkout(auto=false){
  const w=store.activeWorkout;if(!w)return;
  if(auto){openWorkoutReview();return;}
  openWorkoutReview();
}

function discardRecoveredWorkout(startNew=false){
 if(!store.activeWorkout)return;
 const name=store.activeWorkout.routineName||'current workout';
 if(!confirm('Discard '+name+'? Logged progress in this unfinished session will be removed.'))return;
 store.activeWorkout=null;saveStore();currentTab=startNew?'train':'home';render();
 if(startNew)toast('Choose the workout you want to start.');
}
function discardWorkout(){if(!store.activeWorkout)return;if(!confirm('Discard this workout?'))return;store.activeWorkout=null;saveStore();currentTab='home';render();}

function renderProfileEditor(){
  const p=store.profile||{};
  const lifts=p.lifts||{};
  const checked=(field,value)=>p[field]===value?'checked':'';
  const av=v=>(p.avoid||[]).includes(v)?'checked':'';
  const scheduledDays=preferredWorkoutDays(p);
  return `
  <div class="onboard-shell">
    <div class="page-head"><div><p class="eyebrow">GET STARTED</p><h2 class="page-title">Build your training profile.</h2><p class="page-copy">Your actual performance drives progression. Profile details help personalize scheduling, presentation, exercise selection, and future shared workouts without assuming strength from identity.</p></div></div>
    <form id="profile-form" class="intake-form" novalidate>
      <section class="form-section"><div class="form-section-head"><span>01</span><div><h3>What do you want to accomplish?</h3><p>This changes reps, sets and rest periods.</p></div></div>
        <div class="choice-grid">
          ${[['muscle','Build muscle','Moderate reps + progressive overload'],['strength','Get stronger','Heavier work + longer recovery'],['fat-loss','Fat loss + conditioning','Higher reps + shorter recovery'],['general','General fitness','Balanced strength and work capacity']].map(([v,t,d])=>`<label class="choice-card"><input type="radio" name="goal" value="${v}" ${checked('goal',v)||(!p.goal&&v==='muscle'?'checked':'')}><span><strong>${t}</strong><small>${d}</small></span></label>`).join('')}
        </div>
      </section>

      <section class="form-section"><div class="form-section-head"><span>02</span><div><h3>About you</h3><p>Identity and body information stay separate from performance. Gender is stored for profile personalization and future relevant context, not used to guess your strength.</p></div></div>
        <div class="form-grid two identity-grid">
          <label class="field"><span>DISPLAY NAME</span><input name="displayName" autocomplete="name" value="${esc(store.account?.displayName||p.displayName||'')}" placeholder="How you want to appear"></label>
          <label class="field"><span>EMAIL</span><input name="email" type="email" autocomplete="email" value="${esc(store.account?.email||p.email||'')}" placeholder="Used for future account sign-in"></label>
          <label class="field"><span>GENDER</span><select name="gender">${[['','Choose'],['woman','Woman'],['man','Man'],['nonbinary','Nonbinary'],['another','Another identity'],['prefer-not','Prefer not to say']].map(([v,label])=>`<option value="${v}" ${p.gender===v?'selected':''}>${label}</option>`).join('')}</select></label>
          <label class="field"><span>PRONOUNS <em>OPTIONAL</em></span><input name="pronouns" value="${esc(p.pronouns||'')}" placeholder="e.g. he/him"></label>
        </div>
        <div class="form-grid three body-grid">
          <label class="field"><span>BODY WEIGHT (LB)</span><input name="weight" type="number" min="50" max="700" value="${esc(p.weight||'')}" required placeholder="180"></label>
          <label class="field"><span>HEIGHT</span><div class="inline-inputs"><input name="heightFeet" type="number" min="3" max="8" value="${esc(p.heightFeet||'')}" placeholder="5"><input name="heightInches" type="number" min="0" max="11" value="${esc(p.heightInches||'')}" placeholder="10"></div></label>
          <label class="field"><span>AGE RANGE</span><select name="ageRange">${['18-24','25-34','35-44','45-54','55-64','65+'].map(v=>`<option ${p.ageRange===v?'selected':''}>${v}</option>`).join('')}</select></label>
        </div>
        <div class="profile-privacy-note"><strong>Private training data stays private by default.</strong><span>Shared workout partners only need session status and whatever current-session data you choose to expose.</span></div>
      </section>

      <section class="form-section avatar-setup-section"><div class="form-section-head"><span>03</span><div><h3>Choose your training avatar</h3><p>Your avatar changes workout and exercise visuals only. It never changes your weights, difficulty, progression, or exercise recommendations.</p></div></div>
        ${renderAvatarChoices(p.visualAvatarId||'')}
        <div class="avatar-setup-note"><strong>VISUAL PREFERENCE ONLY</strong><span>Exercise performance stays tied to your training history, not the avatar you choose.</span></div>
      </section>

      <section class="form-section account-first-section"><div class="form-section-head"><span>ACCOUNT</span><div><h3>Training account connected</h3><p>${esc(store.account?.email||'Signed in')} · Your setup and training state sync through this account.</p></div></div>
        <div class="profile-privacy-note"><strong>CONNECTED</strong><span>You can manage or sign out from your profile account controls after setup.</span></div>
      </section>
      <section class="form-section"><div class="form-section-head"><span>04</span><div><h3>Training experience</h3><p>This affects exercise complexity and initial volume.</p></div></div>
        <div class="choice-grid four">
          ${[['new','New','Little or no lifting'],['beginner','Beginner','Under ~1 year'],['intermediate','Intermediate','Consistent 1–3 years'],['advanced','Advanced','3+ consistent years']].map(([v,t,d])=>`<label class="choice-card"><input type="radio" name="experience" value="${v}" ${checked('experience',v)||(!p.experience&&v==='new'?'checked':'')}><span><strong>${t}</strong><small>${d}</small></span></label>`).join('')}
        </div>
      </section>

      <section class="form-section"><div class="form-section-head"><span>05</span><div><h3>Your real schedule</h3><p>Choose how many days you train, which days they actually are, and how long you normally have.</p></div></div>
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

      <section class="form-section"><div class="form-section-head"><span>06</span><div><h3>Where are you training?</h3><p>We only choose exercises your setup supports.</p></div></div>
        <div class="choice-grid">
          ${[['full-gym','Full gym'],['dumbbells','Dumbbells'],['mixed-home','Home mix'],['bands','Resistance bands'],['bodyweight','Bodyweight only']].map(([v,t])=>`<label class="choice-card compact"><input type="radio" name="equipment" value="${v}" ${checked('equipment',v)||(!p.equipment&&v==='full-gym'?'checked':'')}><span><strong>${t}</strong></span></label>`).join('')}
        </div>
        <div class="choice-grid three sub-choice">
          ${[['mixed','Mixed'],['machines','Prefer machines'],['free','Prefer free weights']].map(([v,t])=>`<label class="choice-card compact"><input type="radio" name="style" value="${v}" ${checked('style',v)||(!p.style&&v==='mixed'?'checked':'')}><span><strong>${t}</strong></span></label>`).join('')}
        </div>
      </section>

      <section class="form-section"><div class="form-section-head"><span>07</span><div><h3>Training priorities</h3><p>Choose up to two areas to emphasize. These choices influence exercise ranking.</p></div></div>
        <div class="check-row">${[['chest','Chest'],['back','Back'],['shoulders','Shoulders'],['arms','Arms'],['legs','Legs'],['glutes','Glutes'],['core','Core']].map(([v,t])=>`<label class="check-pill"><input type="checkbox" name="priorities" value="${v}" ${(p.priorities||[]).includes(v)?'checked':''}><span>${t}</span></label>`).join('')}</div>
      </section>
      <section class="form-section"><div class="form-section-head"><span>08</span><div><h3>Recent working weights <em>optional</em></h3><p>If you know them, they improve starting estimates. Leave blank if not.</p></div></div>
        <div class="form-grid five">
          ${[['bench','Bench press'],['squat','Squat'],['deadlift','Deadlift / RDL'],['overhead','Overhead press'],['row','Row / pulldown']].map(([n,l])=>`<label class="field"><span>${l.toUpperCase()}</span><input name="${n}" type="number" min="0" step="5" value="${esc(lifts[n]||'')}" placeholder="lb"></label>`).join('')}
        </div>
      </section>

      <section class="form-section"><div class="form-section-head"><span>09</span><div><h3>Movements to leave out</h3><p>These are preference/exclusion controls, not medical advice. If pain or an injury limits training, use guidance from a qualified clinician.</p></div></div>
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
    workoutSupabase.auth.onAuthStateChange((_event,session)=>{
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
    store.account={...(store.account||{}),userId:'',authProvider:'',status:store.account?.status==='pending'?'pending':'local'};
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
  if(accountEntryBusy)return;
  accountEntryError='';
  if(!workoutSupabase){accountEntryError='Account service is unavailable. Reload and try again.';render();return;}
  const email=(document.querySelector('#entry-email')?.value||'').trim().toLowerCase();
  const password=document.querySelector('#entry-password')?.value||'';
  accountEntryEmail=email;
  if(!email||!password){accountEntryError='Enter your email and password.';render();return;}
  accountEntryBusy=true;
  const button=document.querySelector('[data-action="entry-sign-in"]');
  if(button){button.disabled=true;button.textContent='SIGNING IN…';}
  try{
    const timeout=new Promise((_,reject)=>setTimeout(()=>reject(new Error('Sign-in request timed out. Check your connection and try again.')),15000));
    const {data,error}=await Promise.race([workoutSupabase.auth.signInWithPassword({email,password}),timeout]);
    if(error){
      accountEntryError=error.code==='email_not_confirmed'?'Confirm your email first, then sign in.':(error.message||'Could not sign in.');
      return;
    }
    if(!data?.session){
      accountEntryError='Sign-in did not create a session. Try again.';
      return;
    }
    if(store.account?.status!=='connected'||store.account?.userId!==data.session.user?.id){
      applyWorkoutSession(data.session);
    }
    toast('Signed in.');
  }catch(error){
    console.error('Workout sign-in failed',error);
    accountEntryError=error?.message||'Could not sign in. Try again.';
  }finally{
    accountEntryBusy=false;
    if(store.account?.status!=='connected')render();
  }
}
async function createEntryAccount(){
  if(accountEntryBusy)return;
  accountEntryError='';
  if(!workoutSupabase){accountEntryError='Account service is unavailable. Reload and try again.';render();return;}
  const display=(document.querySelector('#entry-display-name')?.value||'').trim();
  const email=(document.querySelector('#entry-email')?.value||'').trim().toLowerCase();
  accountEntryDisplay=display;
  accountEntryEmail=email;
  const password=document.querySelector('#entry-password')?.value||'';
  if(!display){accountEntryError='Enter your display name.';render();return;}
  if(!email||password.length<6){accountEntryError='Enter a valid email and a password with at least 6 characters.';render();return;}
  accountEntryBusy=true;
  const button=document.querySelector('[data-action="entry-create-account"]');
  if(button){button.disabled=true;button.textContent='CREATING ACCOUNT…';}
  try{
    const redirectTo=window.location.origin+window.location.pathname;
    let result=await workoutSupabase.auth.signUp({email,password,options:{data:{display_name:display},emailRedirectTo:redirectTo}});
    if(result.error&&/redirect/i.test(result.error.message||''))result=await workoutSupabase.auth.signUp({email,password,options:{data:{display_name:display}}});
    const {data,error}=result;
    if(error){accountEntryError=error.message||'Could not create the account.';return;}
    if(data?.user&&Array.isArray(data.user.identities)&&data.user.identities.length===0){accountEntryError='That email already has an account. Sign in instead.';return;}
    store.account={...(store.account||{}),email,userId:data?.user?.id||'',displayName:display,status:data?.session?'connected':'pending'};
    saveStore();
    if(data?.session){
      applyWorkoutSession(data.session);
      toast('Account created. Now build your training profile.');
    }else{
      toast('Account created. Check your email to confirm it, then sign in here.');
      accountEntryMode='sign-in';
    }
  }catch(error){
    console.error('Workout account creation failed',error);
    accountEntryError=error?.message||'Could not create the account.';
  }finally{
    accountEntryBusy=false;
    if(store.account?.status!=='connected')render();
  }
}
async function resendEntryConfirmation(){
  if(!workoutSupabase){toast('Account service is unavailable.');return;}
  const email=(store.account?.email||document.querySelector('#entry-email')?.value||'').trim().toLowerCase();
  if(!email){toast('Enter the email used for this account.');return;}
  const redirectTo=window.location.origin+window.location.pathname;
  const {error}=await workoutSupabase.auth.resend({type:'signup',email,options:{emailRedirectTo:redirectTo}});
  if(error){toast(error.message||'Could not resend the confirmation email.');return;}
  toast('Confirmation email sent again.');
}
async function signInWorkoutAccount(){
  if(!workoutSupabase){toast('Account service is not available in this build.');return;}
  const email=(document.querySelector('#account-email')?.value||'').trim().toLowerCase();
  const password=document.querySelector('#account-password')?.value||'';
  if(!email||!password){toast('Enter your email and password.');return;}
  const {data,error}=await workoutSupabase.auth.signInWithPassword({email,password});
  if(error){
    const message=error.code==='email_not_confirmed'?'Confirm your email first, then sign in.':(error.message||'Could not sign in.');
    toast(message);return;
  }
  if(!data?.session){toast('Sign-in did not create a browser session. Try again.');return;}
  accountSheetOpen=false;
  persistUiState();
  toast('Signed in.');
  render();
}
async function createOnboardingAccount(){
  if(!workoutSupabase){toast('Account service is not available.');return;}
  const email=(document.querySelector('#onboard-account-email')?.value||document.querySelector('[name="email"]')?.value||'').trim().toLowerCase();
  const password=document.querySelector('#onboard-account-password')?.value||'';
  const display=(document.querySelector('[name="displayName"]')?.value||'').trim();
  if(!display){toast('Enter your display name first.');return;}
  if(!email||password.length<6){toast('Enter a valid email and a password with at least 6 characters.');return;}
  const redirectTo=window.location.origin+window.location.pathname;
  const {data,error}=await workoutSupabase.auth.signUp({email,password,options:{data:{display_name:display},emailRedirectTo:redirectTo}});
  if(error){toast(error.message||'Could not create the account.');return;}
  if(data?.user&&Array.isArray(data.user.identities)&&data.user.identities.length===0){toast('That email already has an account. Sign in instead.');accountSheetOpen=true;render();return;}
  store.account={...(store.account||{}),email,userId:data?.user?.id||'',displayName:display,status:data?.session?'connected':'pending'};saveStore();
  toast(data?.session?'Account created. Finish your training setup.':'Account created. Confirm your email, then sign in to sync this setup.');render();
}
async function createWorkoutAccount(){
  if(!workoutSupabase){toast('Account service is not available in this build.');return;}
  const email=(document.querySelector('#account-email')?.value||'').trim().toLowerCase();
  const password=document.querySelector('#account-password')?.value||'';
  const display=(store.profile?.displayName||store.account?.displayName||'').trim();
  if(!email||!password){toast('Enter an email and password.');return;}
  if(password.length<6){toast('Use a password with at least 6 characters.');return;}
  const redirectTo=window.location.origin+window.location.pathname;
  let signUpResult=await workoutSupabase.auth.signUp({
    email,
    password,
    options:{
      data:{display_name:display},
      emailRedirectTo:redirectTo
    }
  });
  if(signUpResult.error&&/redirect/i.test(signUpResult.error.message||'')){
    signUpResult=await workoutSupabase.auth.signUp({
      email,
      password,
      options:{data:{display_name:display}}
    });
  }
  const {data,error}=signUpResult;
  if(error){toast(error.message||'Could not create the account.');return;}
  if(data?.user&&Array.isArray(data.user.identities)&&data.user.identities.length===0){
    store.account={...(store.account||{}),email,status:'local'};
    saveStore();
    toast('That email already has an account. Use Sign In instead.');
    render();
    return;
  }
  store.account={
    ...(store.account||{}),
    email,
    userId:data?.user?.id||store.account?.userId||'',
    displayName:display||store.account?.displayName||'',
    status:data?.session?'connected':'pending'
  };
  saveStore();
  if(data?.session){
    accountSheetOpen=false;
    persistUiState();
    toast('Account created and signed in.');
  }else{
    accountSheetOpen=true;
    persistUiState();
    toast('Account created. Check your email to confirm it, then return here.');
  }
  render();
}
async function resendWorkoutConfirmation(){
  if(!workoutSupabase){toast('Account service is not available in this build.');return;}
  const email=(store.account?.email||document.querySelector('#account-email')?.value||'').trim().toLowerCase();
  if(!email){toast('Enter the email used for this account.');return;}
  const redirectTo=window.location.origin+window.location.pathname;
  const {error}=await workoutSupabase.auth.resend({
    type:'signup',
    email,
    options:{emailRedirectTo:redirectTo}
  });
  if(error){toast(error.message||'Could not resend the confirmation email.');return;}
  toast('Confirmation email sent again.');
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
function renderProgramWeek(date,label,expanded=true){
  const schedule=currentWeekSchedule(date);
  const context=programContext(date);
  const completed=schedule.filter(entry=>entry.status==='complete').length;
  const title=label||('Week '+context.weekNumber);
  return '<section class="program-week-card '+(expanded?'expanded':'compact')+'">'+
    '<div class="program-week-head"><div><p class="eyebrow">'+esc(title)+'</p><h3>'+esc(context.weekStart.toLocaleDateString(undefined,{month:'short',day:'numeric'}))+' – '+esc(addDays(context.weekStart,6).toLocaleDateString(undefined,{month:'short',day:'numeric'}))+'</h3></div><span>'+completed+'/'+schedule.length+' complete</span></div>'+
    (expanded?'<div class="program-week-days">'+schedule.map(entry=>{
      const status=entry.status||'rest';
      const day=entry.adaptedDay||entry.day;
      return '<article class="program-day-row status-'+status+'"><div class="program-day-date"><span>'+esc(entry.date.toLocaleDateString(undefined,{weekday:'short'}).toUpperCase())+'</span><strong>'+entry.date.getDate()+'</strong></div><div class="program-day-main"><span>'+esc(status==='today'?'TODAY':status==='upcoming'?'UPCOMING':status.toUpperCase())+'</span><strong>'+esc(day?.name||'Training')+'</strong><small>'+esc(day?.focus||'Recovery')+' · '+(day?.exercises?.length||0)+' exercises · ~'+(day?.estimatedMinutes||store.profile?.minutes||45)+' min</small></div>'+(entry&&!store.activeWorkout&&!['complete','skipped'].includes(status)?'<button class="button secondary small-button" data-start="'+esc(entry.day.id)+'" data-scheduled-date="'+esc(entry.dateKey)+'">'+(status==='today'?'START':'PREPARE')+'</button>':'')+'</article>';
    }).join('')+'</div>':'<div class="program-week-compact"><span>'+schedule.map(entry=>esc((entry.day?.name||'Rest')+' · '+entry.date.toLocaleDateString(undefined,{weekday:'short'}))).join('</span><span>')+'</span></div>')+
  '</section>';
}
function renderProgramHorizon(){
  const start=startOfWeek(new Date());
  return '<div class="program-horizon">'+
    renderProgramWeek(start,'THIS WEEK',true)+
    renderProgramWeek(addDays(start,7),'NEXT WEEK',true)+
    '<div class="program-horizon-grid">'+
      renderProgramWeek(addDays(start,14),'WEEK 3',false)+
      renderProgramWeek(addDays(start,21),'WEEK 4',false)+
    '</div>'+
  '</div>';
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

function renderTrainTabs(){
  const tabs=[['week','Week'],['program','Program'],['exercises','Exercises']];
  return '<div class="train-tabs" role="tablist" aria-label="Train sections">'+tabs.map(([id,label])=>
    '<button type="button" role="tab" aria-selected="'+(trainView===id?'true':'false')+'" class="train-tab '+(trainView===id?'active':'')+'" data-action="set-train-view" data-train-view="'+id+'">'+label+'</button>'
  ).join('')+'</div>';
}
function renderTrainCurrentWeek(){
  const schedule=currentWeekSchedule();
  const completed=schedule.filter(entry=>entry.status==='complete').length;
  const start=startOfWeek(new Date()),end=addDays(start,6);
  return '<section class="train-current-week">'+
    '<div class="train-week-title"><div><p class="eyebrow">THIS WEEK</p><h3>'+esc(start.toLocaleDateString(undefined,{month:'short',day:'numeric'}))+' – '+esc(end.toLocaleDateString(undefined,{month:'short',day:'numeric'}))+'</h3></div><span>'+completed+'/'+schedule.length+' complete</span></div>'+
    '<div class="train-week-list">'+schedule.map(entry=>{
      const day=entry.adaptedDay||entry.day,status=entry.status||'upcoming';
      const statusLabel=status==='complete'?'COMPLETED':status==='today'?'TODAY':status==='missed'?'AVAILABLE':status==='partial'?'PARTIAL':status==='skipped'?'SKIPPED':'UPCOMING';
      const action=!store.activeWorkout&&!['complete','skipped'].includes(status)
        ? '<button class="button '+(status==='today'?'':'secondary')+' small-button" data-start="'+esc(entry.day.id)+'" data-scheduled-date="'+esc(entry.dateKey)+'">'+(status==='today'?'START':status==='missed'?'DO TODAY':'PREPARE')+'</button>'
        : status==='complete'?'<span class="train-day-done">✓</span>':'';
      return '<article class="train-day-card status-'+status+'">'+
        '<div class="train-day-date"><span>'+esc(entry.date.toLocaleDateString(undefined,{weekday:'short'}).toUpperCase())+'</span><strong>'+entry.date.getDate()+'</strong></div>'+
        '<div class="train-day-copy"><span>'+statusLabel+'</span><strong>'+esc(day?.name||'Training')+'</strong><small>'+esc(day?.focus||'Training')+' · '+(day?.exercises?.length||0)+' exercises · ~'+(day?.estimatedMinutes||store.profile?.minutes||45)+' min</small></div>'+
        '<div class="train-day-action">'+action+'</div>'+
      '</article>';
    }).join('')+'</div>'+
  '</section>';
}
function trainFutureWeekData(offset){
  const weekStart=addDays(startOfWeek(new Date()),offset*7);
  const entries=scheduledEntriesForWeek(weekStart).map(entry=>({...entry,adaptedDay:adaptDayForProgramWeek(entry.day,entry.date)}));
  return {offset,weekStart,weekEnd:addDays(weekStart,6),entries};
}
function renderTrainFutureWeek(offset){
  const data=trainFutureWeekData(offset),expanded=trainExpandedWeek===offset;
  const label=offset===1?'NEXT WEEK':'WEEK '+(offset+1);
  const totalMinutes=data.entries.reduce((sum,entry)=>sum+(entry.adaptedDay?.estimatedMinutes||store.profile?.minutes||45),0);
  return '<section class="train-future-week '+(expanded?'expanded':'')+'">'+
    '<button class="train-future-toggle" type="button" data-action="toggle-train-week" data-week-offset="'+offset+'" aria-expanded="'+(expanded?'true':'false')+'">'+
      '<div><span>'+label+'</span><strong>'+esc(data.weekStart.toLocaleDateString(undefined,{month:'short',day:'numeric'}))+' – '+esc(data.weekEnd.toLocaleDateString(undefined,{month:'short',day:'numeric'}))+'</strong><small>'+data.entries.length+' workouts · ~'+totalMinutes+' min planned</small></div><em>'+((expanded?'−':'+'))+'</em>'+
    '</button>'+
    (expanded?'<div class="train-future-list">'+data.entries.map(entry=>{
      const day=entry.adaptedDay||entry.day;
      return '<div class="train-future-row"><span>'+esc(entry.date.toLocaleDateString(undefined,{weekday:'short'}))+' '+entry.date.getDate()+'</span><div><strong>'+esc(day?.name||'Training')+'</strong><small>'+esc(day?.focus||'Training')+' · '+(day?.exercises?.length||0)+' exercises · ~'+(day?.estimatedMinutes||store.profile?.minutes||45)+' min</small></div></div>';
    }).join('')+'</div>':'')+
  '</section>';
}
function renderTrainWeekView(){
  return '<div class="train-view train-week-view">'+
    renderTrainCurrentWeek()+
    '<div class="train-future-stack">'+[1,2,3].map(renderTrainFutureWeek).join('')+'</div>'+
  '</div>';
}
function renderTrainBlockTimeline(context){
  const labels=['Establish','Build','Progress','Consolidate'];
  return '<section class="train-block-timeline"><div class="train-block-head"><div><p class="eyebrow">CURRENT BLOCK</p><h3>Block '+context.blockNumber+'</h3></div><span>Week '+context.blockWeek+' of 4</span></div>'+
    '<div class="train-block-track">'+labels.map((label,index)=>{
      const week=index+1,state=week<context.blockWeek?'done':week===context.blockWeek?'current':'future';
      return '<div class="train-block-step '+state+'"><i></i><strong>Week '+week+'</strong><span>'+label+'</span></div>';
    }).join('')+'</div></section>';
}
function renderTrainProgramView(){
  const context=programContext(),plan=store.plan;
  return '<div class="train-view train-program-view">'+
    renderTrainBlockTimeline(context)+
    renderEngineProgramSummary()+
    renderProgramEvolution()+
    '<section class="clean-section train-rotation-section"><div class="clean-section-head"><div><p class="eyebrow">WORKOUT ROTATION</p><h3>'+plan.days.length+' workouts</h3></div><button class="text-button" data-action="edit-profile">EDIT PLAN</button></div>'+
      '<div class="train-rotation-list">'+plan.days.map((day,index)=>{
        const first=day.exercises?.[0];
        return '<article class="train-rotation-row"><span>'+String(index+1).padStart(2,'0')+'</span><div><strong>'+esc(day.name)+'</strong><small>'+esc(day.focus)+' · '+day.exercises.length+' exercises · ~'+day.estimatedMinutes+' min'+(first?' · starts '+esc(first.name):'')+'</small></div></article>';
      }).join('')+'</div>'+
    '</section>'+
  '</div>';
}
function renderTrainExercisesView(){
  const q=catalogQuery.trim().toLowerCase();
  const items=catalog.filter(e=>!q||[e.name,e.movement,...e.muscles,e.style,e.difficulty,...(e.equipment||[])].join(' ').toLowerCase().includes(q));
  return '<div class="train-view train-exercises-view">'+
    '<section class="train-library-head"><div><p class="eyebrow">EXERCISES</p><h3>'+catalog.length+' movements</h3><p>Search by movement, muscle, or equipment. Tap an exercise for form cues and details.</p></div></section>'+
    '<div class="catalog-search train-catalog-search"><input id="catalog-search" type="search" placeholder="Search chest, squat, dumbbell..." value="'+esc(catalogQuery)+'"><span>'+items.length+' shown</span></div>'+
    '<div class="catalog-grid train-catalog-grid">'+items.map(e=>'<article class="catalog-card visual-catalog-card">'+exerciseImageButton(e,'catalog-exercise-media')+'<div class="catalog-card-copy"><div class="catalog-top"><span>'+esc(movements[e.movement]||e.movement)+'</span><span>'+esc(e.difficulty)+'</span></div><h3>'+esc(e.name)+'</h3><p>'+e.muscles.map(esc).join(' · ')+'</p><div class="catalog-tags"><span>'+esc(e.style)+'</span><span>'+esc(e.equipment.join(' / '))+'</span></div><button class="text-button catalog-details" type="button" data-exercise-detail="'+esc(e.id)+'">View form & cues</button></div></article>').join('')+'</div>'+
  '</div>';
}
function renderTrain(){
  const p=store.profile,plan=store.plan;if(!p||!plan)return renderProfileEditor();
  return '<div class="clean-page train-reframed">'+
    '<div class="clean-page-head train-page-head"><div><p class="eyebrow">TRAIN</p><h2>Your training.</h2><p>See what is coming up, understand your program, or find an exercise without scrolling through all three at once.</p></div></div>'+
    (store.activeWorkout?'<button class="clean-resume-card" data-action="resume"><div><span>WORKOUT IN PROGRESS</span><strong>'+esc(store.activeWorkout.routineName)+'</strong></div><em>RESUME →</em></button>':'')+
    renderTrainTabs()+
    (trainView==='program'?renderTrainProgramView():trainView==='exercises'?renderTrainExercisesView():renderTrainWeekView())+
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
    partnerStatus:row.partner_user_id?'ready':'invited',
    userStatus:'ready',
    mode:row.mode||'same-gym',
    pace:row.pace||'stay-together',
    setFlow:row.set_flow||'alternating',
    leadAudio:row.lead_audio_user_id===userId?'you':'partner',
    code:row.join_code||'',
    role:resolvedRole,
    sessionStatus:row.status||'lobby',
    planSnapshot:row.plan_snapshot||{},
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
    workoutSupabase.from('workout_shared_participant_state').select('session_id,user_id,display_name,ready,connection_state,exercise_index,set_index,phase,is_paused,updated_at').eq('session_id',sessionId)
  ]);
  if(error){console.warn('Shared session refresh failed',error);return null;}
  if(participantError)console.warn('Shared participant refresh failed',participantError);
  if(!session)return null;
  const shared=sharedTrainingState();
  let draft=shared.draft?.backendId===sessionId?shared.draft:sharedDraftFromRow(session);
  const ownId=store.account?.userId||'';
  const role=session.host_user_id===ownId?'host':'partner';
  const remote=(participants||[]).find(item=>item.user_id!==ownId)||null;
  draft={
    ...draft,
    ...sharedDraftFromRow(session,role),
    partnerName:remote?.display_name||draft.partnerName||'Workout partner',
    partnerId:remote?.user_id||draft.partnerId||'',
    partnerStatus:remote?(remote.ready?'ready':'joined'):(session.partner_user_id?'joined':'invited'),
    remoteState:remote?{
      userId:remote.user_id,
      displayName:remote.display_name,
      ready:Boolean(remote.ready),
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
  if(renderNow&&currentTab==='together')render();
  return draft;
}
async function unsubscribeSharedSession(){
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
    draft.remoteState={...(draft.remoteState||{}),userId:remote.userId,displayName:remote.displayName||draft.partnerName,ready:Boolean(remote.ready),connectionState:'online'};
  }else if(draft.remoteState){
    draft.remoteState={...draft.remoteState,connectionState:'offline'};
  }
  saveSharedBackendDraft(draft);
  if(currentTab==='together')render();
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
  channel
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
        connectionState:'online',
        exerciseIndex:num(payload.exerciseIndex),
        setIndex:num(payload.setIndex),
        phase:payload.phase||'lobby',
        isPaused:Boolean(payload.isPaused),
        updatedAt:payload.updatedAt||new Date().toISOString()
      };
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
      if(current.role==='partner'&&payload.status==='active')toast('Your partner started the shared workout. You can begin when ready.');
    })
    .subscribe(async status=>{
      if(status!=='SUBSCRIBED')return;
      try{
        await channel.track({
          userId:store.account.userId,
          displayName:displayName(),
          role:draft.role||'partner',
          ready:true,
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
    ready:true,
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
    if(refreshed&&['lobby','active'].includes(refreshed.sessionStatus)){
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
    .in('status',['lobby','active'])
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
  if(draft.mode!=='share-plan'&&draft.partnerStatus!=='ready'){toast('Your workout partner has not joined the lobby yet.');return;}
  if(draft.role==='partner'&&draft.mode!=='share-plan'&&draft.sessionStatus!=='active'){
    toast('Your partner has not started the shared workout yet.');
    return;
  }
  let sharedDay=sharedDraftDay(draft);
  if(draft.backendId&&workoutSupabase){
    const {data:participants}=await workoutSupabase.from('workout_shared_participant_state').select('user_id,planning_profile,planned_day,readiness').eq('session_id',draft.backendId);
    const partner=(participants||[]).find(p=>p.user_id!==store.account?.userId);
    if(partner?.planned_day?.exercises?.length){
      const partnerIds=new Set(partner.planned_day.exercises.map(ex=>ex.id));
      const common=(sharedDay?.exercises||[]).filter(ex=>partnerIds.has(ex.id));
      if(common.length>=2){sharedDay=clone(sharedDay);sharedDay.exercises=common;sharedDay.name='Shared '+sharedDay.name;recalculatePlanDay(sharedDay);}
    }
  }
  openReadiness(draft.dayId,draft.scheduledDate);
  if(readinessContext){readinessContext.sharedDraft=clone(draft);if(sharedDay)readinessContext.day=sharedDay;}
  render();
}
function copySharedCode(){
  const code=sharedTrainingState().draft?.code;if(!code)return;
  if(navigator?.clipboard?.writeText){
    navigator.clipboard.writeText(code).then(()=>toast('Join code copied.')).catch(()=>toast('Join code: '+code));
  }else toast('Join code: '+code);
}
async function createSharedDraft(){
  if(store.account?.status!=='connected'){accountSheetOpen=true;render();toast('Sign in before creating a shared workout.');return;}
  if(!workoutSupabase){toast('Shared workout service is unavailable.');return;}
  const next=nextScheduledSession();
  if(!next){toast('No scheduled workout is available to share right now.');return;}
  const name=(document.querySelector('#shared-partner-name')?.value||'').trim();
  const contact=(document.querySelector('#shared-partner-contact')?.value||'').trim();
  const mode=document.querySelector('#shared-mode')?.value||'same-gym';
  const pace=document.querySelector('#shared-pace')?.value||'stay-together';
  const setFlow=document.querySelector('#shared-set-flow')?.value||'alternating';
  if(!name){toast('Enter your workout partner’s name.');return;}
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
      routine_name:day.name,
      scheduled_date:next.dateKey,
      plan_day_id:day.id,
      plan_snapshot:snapshot,
      mode,
      pace,
      set_flow:setFlow,
      lead_audio_user_id:store.account.userId,
      status:'lobby'
    }).select('*').single();
    if(error){lastError=error;continue;}
    created=data;
  }
  if(!created){toast(lastError?.message||'Could not create the shared lobby.');return;}
  const {error:participantError}=await workoutSupabase.from('workout_shared_participant_state').insert({
    session_id:created.id,
    user_id:store.account.userId,
    display_name:displayName(),
    ready:false,
    connection_state:'online',
    phase:'planning',
    planning_profile:{goal:store.profile?.goal,experience:store.profile?.experience,equipment:store.profile?.equipment,minutes:store.profile?.minutes,priorities:store.profile?.priorities||[],avoid:store.profile?.avoid||[],day_name:day.name,day_focus:day.focus},
    planned_day:snapshot
  });
  if(participantError){toast(participantError.message||'Could not open the lobby.');return;}
  const partner={id:uid('partner'),name,contact,status:'invited'};
  const existing=shared.partners.find(item=>item.contact&&contact&&item.contact.toLowerCase()===contact.toLowerCase());
  if(!existing)shared.partners.push(partner);
  const draft={...sharedDraftFromRow(created,'host'),partnerId:(existing||partner).id,partnerName:name,partnerContact:contact,partnerStatus:'invited',planSnapshot:snapshot};
  saveSharedBackendDraft(draft);
  await subscribeSharedSession(draft);
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
  draft.partnerStatus='ready';
  saveSharedBackendDraft(draft);
  await subscribeSharedSession(draft);
  toast('Joined '+draft.partnerName+'’s workout.');
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
  if(draft.role==='host'){
    const startedAt=new Date().toISOString();
    const {error}=await workoutSupabase.from('workout_shared_sessions').update({
      status:'active',
      started_at:startedAt,
      updated_at:startedAt
    }).eq('id',draft.backendId);
    if(!error){
      if(shared.draft?.backendId===draft.backendId){
        shared.draft.sessionStatus='active';
        shared.draft.startedAt=startedAt;
        saveSharedBackendDraft(shared.draft);
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
  const day=sharedDraftDay(draft);if(!day)return '';
  return '<div class="shared-match-list">'+day.exercises.map((ex,index)=>'<article class="shared-match-row"><span>'+String(index+1).padStart(2,'0')+'</span><div><strong>'+esc(ex.name)+'</strong><small>'+esc(movements[ex.movement]||ex.movement)+' · '+esc(equipmentRequirement(exerciseSource(ex)))+'</small></div><em>SHARED</em></article>').join('')+'</div>';
}
function renderTogether(){
  if(!store.profile||!store.plan)return renderProfileEditor();
  if(store.account?.status!=='connected'){
    return '<div class="clean-page together-page"><div class="clean-page-head"><div><p class="eyebrow">TOGETHER</p><h2>Train with your people.</h2><p>Shared workouts use account identity so each person keeps their own readiness, weights, reps, progression, and history.</p></div></div>'+
      '<section class="account-required-card"><div class="together-icon">◎</div><div><span>ACCOUNT REQUIRED</span><h3>Sign in before starting a shared workout.</h3><p>Your training stays private by default. Partners only receive the session information needed to train together.</p></div><button class="button" data-action="account-info">SIGN IN / CREATE ACCOUNT</button></section>'+
      '<section class="clean-panel shared-preview-card"><div><span>REALTIME SHARED TRAINING</span><strong>Same Gym · Remote Together · Share Plan</strong><p>Join codes, participant presence, session starts, and workout position now synchronize through your account.</p></div></section>'+
    '</div>';
  }
  const shared=sharedTrainingState(),draft=shared.draft,next=nextScheduledSession();
  if(draft){
    const partnerReady=draft.partnerStatus==='ready';
    const remoteOnline=draft.remoteState?.connectionState!=='offline'&&Boolean(draft.remoteState);
    const role=draft.role||'host';
    const canStart=draft.mode==='share-plan'||(role==='host'?partnerReady:draft.sessionStatus==='active');
    const statusCopy=draft.sessionStatus==='active'?'Workout in progress':draft.sessionStatus==='completed'?'Session completed':partnerReady?'Both connected':'Waiting for partner';
    const partnerPhase=draft.remoteState?.phase&&draft.remoteState.phase!=='lobby'?draft.remoteState.phase.replace(/-/g,' '):'Lobby';
    return '<div class="clean-page together-page"><div class="clean-page-head"><div><p class="eyebrow">TOGETHER</p><h2>Shared session lobby.</h2><p>'+esc(statusCopy)+'. Each person keeps their own weights, reps, readiness, history, and progression.</p></div><button class="text-button danger-text" data-action="cancel-shared-draft">'+(role==='host'?'CANCEL':'LEAVE')+'</button></div>'+
      '<section class="shared-lobby-hero"><div class="shared-avatar-stack"><div class="shared-avatar you">'+esc((displayName()[0]||'Y').toUpperCase())+'</div><div class="shared-link-mark">+</div><div class="shared-avatar partner">'+esc((draft.partnerName?.[0]||'P').toUpperCase())+'</div></div><p class="eyebrow">'+esc(draft.mode==='same-gym'?'SAME GYM':draft.mode==='remote'?'REMOTE TOGETHER':'SHARE PLAN')+'</p><h3>'+esc(draft.routineName)+'</h3><p>'+esc(formatDate(draft.scheduledDate))+' · '+esc(draft.pace==='stay-together'?'Stay Together':'Flexible Pace')+'</p>'+(role==='host'?'<div class="shared-code"><span>JOIN CODE</span><strong>'+esc(draft.code)+'</strong></div>':'')+'</section>'+
      '<div class="participant-grid"><article class="participant-card ready"><div class="participant-avatar">'+esc((displayName()[0]||'Y').toUpperCase())+'</div><div><span>YOU · '+esc(role.toUpperCase())+'</span><strong>'+esc(displayName())+'</strong><small>'+(store.activeWorkout?.sharedSession?'Training':'Ready')+'</small></div><em>✓</em></article><article class="participant-card '+(partnerReady?'ready':'pending')+'"><div class="participant-avatar">'+esc((draft.partnerName?.[0]||'P').toUpperCase())+'</div><div><span>PARTNER</span><strong>'+esc(draft.partnerName||'Workout partner')+'</strong><small>'+(partnerReady?(remoteOnline?'Online · '+esc(partnerPhase):'Joined · reconnecting'):'Invite pending')+'</small></div><em>'+(partnerReady?'✓':'…')+'</em></article></div>'+
      '<section class="clean-panel shared-settings-summary"><div><span>PACE</span><strong>'+esc(draft.pace==='stay-together'?'Stay Together':'Flexible Pace')+'</strong></div><div><span>SETS</span><strong>'+esc(draft.setFlow==='parallel'?'Parallel':'Alternating')+'</strong></div><div><span>LEAD AUDIO</span><strong>'+esc(draft.leadAudio==='you'?'Your phone':'Partner phone')+'</strong></div><div><span>PRIVACY</span><strong>Performance stays individual</strong></div></section>'+
      '<section class="clean-section"><div class="clean-section-head"><div><p class="eyebrow">REVIEW MATCHES</p><h3>'+((sharedDraftDay(draft)?.exercises||[]).length)+' shared stations</h3></div></div>'+renderSharedMatches(draft)+'</section>'+
      '<div class="shared-lobby-actions">'+(canStart?'<button class="button primary-action" data-action="start-shared-workout">'+(role==='partner'&&draft.mode!=='share-plan'?'START MY WORKOUT':'START TOGETHER')+'</button>':'<button class="button secondary" disabled>'+(role==='partner'?'WAITING FOR HOST':'WAITING FOR PARTNER')+'</button>')+(role==='host'?'<button class="button secondary" data-action="copy-shared-code">COPY JOIN CODE</button>':'')+'</div>'+
      '<section class="prototype-note compact"><strong>Realtime connected.</strong><span>Only lobby state, online status, workout phase, and exercise/set position synchronize. Readiness answers, body data, weights, reps, notes, PRs, and history stay private.</span></section>'+
    '</div>';
  }
  return '<div class="clean-page together-page"><div class="clean-page-head"><div><p class="eyebrow">TOGETHER</p><h2>Train with your people.</h2><p>Start in the same gym, train remotely, or share a plan. Your performance record always remains your own.</p></div></div>'+
    '<section class="together-hero"><div class="together-icon">◎</div><div><span>NEXT AVAILABLE WORKOUT</span><h3>'+esc(next?.adaptedDay?.name||next?.day?.name||'No session scheduled')+'</h3><p>'+(next?esc(next.dayName)+' · '+esc(formatDate(next.dateKey))+' · ~'+esc(next.adaptedDay?.estimatedMinutes||store.profile.minutes)+' min':'Schedule a workout first.')+'</p></div></section>'+
    '<section class="clean-panel shared-create-panel"><div class="clean-section-head"><div><p class="eyebrow">CREATE SHARED SESSION</p><h3>Invite one workout partner</h3></div></div><div class="form-grid two"><label class="field"><span>PARTNER NAME</span><input id="shared-partner-name" placeholder="Name"></label><label class="field"><span>EMAIL OR HANDLE <em>OPTIONAL</em></span><input id="shared-partner-contact" placeholder="For your own saved partner list"></label><label class="field"><span>MODE</span><select id="shared-mode"><option value="same-gym">Same Gym</option><option value="remote">Remote Together</option><option value="share-plan">Share Plan</option></select></label><label class="field"><span>PACE</span><select id="shared-pace"><option value="stay-together">Stay Together</option><option value="flexible">Flexible Pace</option></select></label><label class="field"><span>SET FLOW</span><select id="shared-set-flow"><option value="alternating">Alternating Sets</option><option value="parallel">Parallel Sets</option></select></label></div><button class="button primary-action" data-action="create-shared-draft" '+(!next?'disabled':'')+'>CREATE LOBBY</button></section>'+
    '<section class="clean-panel shared-create-panel"><div class="clean-section-head"><div><p class="eyebrow">JOIN A SESSION</p><h3>Enter the code from your workout partner</h3></div></div><label class="field shared-code-input"><span>6-CHARACTER JOIN CODE</span><input id="shared-join-code" inputmode="text" maxlength="6" autocomplete="off" autocapitalize="characters" placeholder="ABC234"></label><button class="button secondary" data-action="join-shared-session">JOIN WORKOUT</button></section>'+
    (shared.partners.length?'<section class="clean-section"><div class="clean-section-head"><div><p class="eyebrow">WORKOUT PARTNERS</p><h3>Recent partners</h3></div></div><div class="partner-list">'+shared.partners.slice(-5).reverse().map(item=>'<div class="partner-row"><div class="participant-avatar">'+esc((item.name[0]||'P').toUpperCase())+'</div><div><strong>'+esc(item.name)+'</strong><small>'+esc(item.contact||'Shared workout partner')+'</small></div></div>').join('')+'</div></section>':'')+
    (shared.history.length?'<section class="clean-section"><div class="clean-section-head"><div><p class="eyebrow">RECENT SHARED SESSIONS</p><h3>Trained together</h3></div></div><div class="partner-list">'+shared.history.slice(0,5).map(item=>'<div class="partner-row"><div class="participant-avatar">✓</div><div><strong>'+esc(item.routineName)+'</strong><small>With '+esc(item.partnerName)+' · '+esc(formatDate(item.completedAt))+'</small></div></div>').join('')+'</div></section>':'')+
    '<section class="prototype-note"><strong>Realtime shared training is live.</strong><span>Create or join from another signed-in browser or phone. Detailed workout performance remains on each person’s own device.</span></section>'+
  '</div>';
}

function renderProfileHub(){
  const p=store.profile;if(!p)return renderProfileEditor();
  const context=programContext(),shared=sharedTrainingState(),avatar=trainingAvatar(p);
  const name=displayName()==='there'?'Your profile':displayName();
  return '<div class="clean-page profile-hub"><section class="profile-identity"><div class="profile-avatar-large training-avatar-profile">'+renderAvatarFigure(avatar.id,'profile-avatar-figure')+'</div><div><p class="eyebrow">TRAINING PROFILE</p><h2>'+esc(name)+'</h2><p>'+esc(planGoalLabel(p.goal))+' · '+p.days+' days/week · '+esc(equipmentLabel(p.equipment))+'</p><small class="profile-avatar-label">'+esc(avatar.name)+' · '+esc(avatar.build)+'</small></div></section>'+
    '<div class="profile-stat-grid"><div><strong>'+store.history.length+'</strong><span>Workouts</span></div><div><strong>'+context.blockNumber+'</strong><span>Current block</span></div><div><strong>'+shared.partners.length+'</strong><span>Partners</span></div></div>'+
    '<section class="settings-list">'+
      '<button data-action="open-avatar-picker"><i class="settings-icon avatar-settings-icon" aria-hidden="true">'+renderAvatarFigure(avatar.id,'settings-avatar-figure')+'</i><div><span>TRAINING AVATAR</span><strong>'+esc(avatar.name)+' · '+esc(avatar.presentation)+' · '+esc(avatar.build)+'</strong></div><em>›</em></button>'+
      '<button data-action="edit-profile"><i class="settings-icon" aria-hidden="true">◌</i><div><span>TRAINING PROFILE</span><strong>Goals, schedule, identity, equipment, preferences</strong></div><em>›</em></button>'+
      '<button data-action="train"><i class="settings-icon" aria-hidden="true">▦</i><div><span>CURRENT PROGRAM</span><strong>Block '+context.blockNumber+' · Week '+context.blockWeek+'</strong></div><em>›</em></button>'+
      '<button data-action="together"><i class="settings-icon" aria-hidden="true">◎</i><div><span>WORKOUT PARTNERS</span><strong>'+shared.partners.length+' saved partner'+(shared.partners.length===1?'':'s')+'</strong></div><em>›</em></button>'+
      '<button data-action="open-cue-settings"><i class="settings-icon" aria-hidden="true">◉</i><div><span>WORKOUT SETTINGS</span><strong>Voice, sound, haptics, flash</strong></div><em>›</em></button>'+
      '<button data-action="account-info"><i class="settings-icon" aria-hidden="true">○</i><div><span>ACCOUNT</span><strong>'+(store.account?.email?esc(store.account.email):'Local prototype · backend sign-in foundation')+'</strong></div><em>›</em></button>'+
      '<button data-action="history"><i class="settings-icon" aria-hidden="true">≡</i><div><span>WORKOUT HISTORY</span><strong>'+store.history.length+' saved session'+(store.history.length===1?'':'s')+'</strong></div><em>›</em></button>'+
    '</section>'+
    '<section class="prototype-note"><strong>Account model prepared for shared authentication.</strong><span>Detailed workout data remains browser-local in this prototype. The parent project already has Supabase infrastructure for the later account-backed migration.</span></section>'+
  '</div>';
}
function renderAvatarPickerSheet(){
  const current=trainingAvatarId();
  return '<div class="exercise-modal-backdrop sheet-backdrop" data-action="close-avatar-picker"><section class="bottom-sheet avatar-picker-sheet" data-avatar-picker-panel>'+
    '<div class="sheet-handle"></div><div class="sheet-head"><div><p class="eyebrow">VISUAL PREFERENCE</p><h2>Choose your training avatar</h2><p>This changes workout imagery only. Your training plan and performance data stay exactly the same.</p></div><button class="modal-close" data-action="close-avatar-picker">×</button></div>'+
    '<div class="training-avatar-grid sheet-avatar-grid">'+TRAINING_AVATARS.map(avatar=>
      '<button class="training-avatar-card button-card '+(current===avatar.id?'selected':'')+'" type="button" data-action="choose-avatar" data-avatar-id="'+esc(avatar.id)+'">'+
        '<span>'+renderAvatarFigure(avatar.id,'card-avatar')+'<span class="training-avatar-copy"><strong>'+esc(avatar.name)+'</strong><small>'+esc(avatar.presentation)+' · '+esc(avatar.build)+'</small></span><em>'+(current===avatar.id?'CURRENT':'CHOOSE')+'</em></span>'+
      '</button>'
    ).join('')+'</div>'+
    '<div class="avatar-setup-note"><strong>REPRESENTATION, NOT PROGRAMMING</strong><span>Avatar selection never changes load, reps, difficulty, readiness adjustments, or progression.</span></div>'+
  '</section></div>';
}
function renderAccountSheet(){
  const account=store.account||{},connected=account.status==='connected';
  return '<div class="exercise-modal-backdrop sheet-backdrop" data-action="close-account-sheet"><section class="bottom-sheet account-sheet" data-account-sheet-panel>'+
    '<div class="sheet-handle"></div><div class="sheet-head"><div><p class="eyebrow">ACCOUNT</p><h2>'+(connected?'Your account':'Sign in to sync & share')+'</h2></div><button class="modal-close" data-action="close-account-sheet">×</button></div>'+
    '<div class="account-status-card"><span>STATUS</span><strong>'+(connected?'CONNECTED':account.status==='pending'?'EMAIL CONFIRMATION PENDING':'LOCAL ONLY')+'</strong><p>'+(connected?'Your Supabase session is active and shared-workout identity can restore on this browser.':account.status==='pending'?'Confirm your email, then return here and sign in. Your local workouts stay intact while confirmation is pending.':'Your workouts remain stored locally until the account layer is connected.')+'</p></div>'+
    (connected?
      '<div class="account-identity-preview"><div class="profile-avatar-large small">'+esc((displayName()[0]||'Y').toUpperCase())+'</div><div><strong>'+esc(displayName())+'</strong><span>'+esc(account.email||'Connected account')+'</span></div></div><button class="button secondary account-signout" data-action="account-sign-out">SIGN OUT</button>'
      :
      '<div class="account-auth-form"><label class="field"><span>EMAIL</span><input id="account-email" type="email" autocomplete="email" value="'+esc(account.email||store.profile?.email||'')+'" placeholder="you@example.com"></label><label class="field"><span>PASSWORD</span><input id="account-password" type="password" autocomplete="'+(account.status==='pending'?'new-password':'current-password')+'" placeholder="••••••••"></label></div><div class="auth-choice-grid"><button class="button" data-action="account-sign-in">SIGN IN</button><button class="button secondary" data-action="account-create">CREATE ACCOUNT</button></div>'+(account.status==='pending'?'<button class="text-button account-resend" data-action="account-resend-confirmation">RESEND CONFIRMATION EMAIL</button>':''))+
    '<div class="privacy-list"><div><span>PRIVATE BY DEFAULT</span><strong>Readiness, body data, notes, and full training history</strong></div><div><span>SHARED SESSION</span><strong>Partner sees session state and only the data required to train together</strong></div></div>'+
  '</section></div>';
}
function renderCueSettingsSheet(){
  const settings=workoutCueSettings();
  return '<div class="exercise-modal-backdrop sheet-backdrop" data-action="close-cue-settings"><section class="bottom-sheet" data-cue-settings-panel><div class="sheet-handle"></div><div class="sheet-head"><div><p class="eyebrow">WORKOUT SETTINGS</p><h2>Audio & cues</h2></div><button class="modal-close" data-action="close-cue-settings">×</button></div><div class="settings-toggle-list">'+
    [['sound','Sound','Timer and completion tones'],['voice','Voice','Exercise names and coaching announcements'],['haptics','Haptics','Supported-device vibration cues'],['flash','Flash','Visual workout cue flash']].map(([key,label,copy])=>'<button data-action="toggle-'+key+'" class="settings-toggle"><div><strong>'+label+'</strong><span>'+copy+'</span></div><em>'+(settings[key]?'ON':'OFF')+'</em></button>').join('')+
    '</div><button class="button secondary" data-action="test-cues">TEST CUES</button></section></div>';
}
function renderExerciseActionsSheet(){
  const w=store.activeWorkout,index=exerciseActionsIndex,ex=w?.exercises?.[index];if(!ex)return '';
  const state=exerciseState(ex);
  return '<div class="exercise-modal-backdrop sheet-backdrop" data-action="close-exercise-actions"><section class="bottom-sheet" data-exercise-actions-panel><div class="sheet-handle"></div><div class="sheet-head"><div><p class="eyebrow">EXERCISE OPTIONS</p><h2>'+esc(ex.name)+'</h2></div><button class="modal-close" data-action="close-exercise-actions">×</button></div><div class="sheet-action-list">'+
    '<button data-exercise-detail="'+esc(ex.id)+'"><span>ⓘ</span><div><strong>View exercise details</strong><small>Form, setup, cues, history</small></div></button>'+
    '<button data-action="open-session-setup"><span>⌂</span><div><strong>Change equipment for this workout</strong><small>Adapt unfinished exercises only</small></div></button>'+
    (!exerciseCountsAsResolved(ex)?'<button data-action="swap-active" data-swap-index="'+index+'"><span>⇄</span><div><strong>Swap exercise</strong><small>Choose a compatible alternative</small></div></button><button data-action="move-exercise-later" data-exercise-index="'+index+'"><span>↓</span><div><strong>Move to later</strong><small>Keep it in the workout, change the order</small></div></button><button data-action="mark-exercise-complete" data-exercise-index="'+index+'"><span>✓</span><div><strong>Mark as complete</strong><small>No fake weight or rep data</small></div></button><button data-action="skip-exercise" data-exercise-index="'+index+'"><span>⊘</span><div><strong>Skip exercise</strong><small>Leave it unresolved for performance data</small></div></button>':'')+
    (state==='completed-manually'?'<button data-action="undo-manual-exercise" data-exercise-index="'+index+'"><span>↺</span><div><strong>Undo manual completion</strong><small>Return the exercise to an unfinished state</small></div></button>':'')+
    (state==='skipped'?'<button data-action="restore-exercise" data-exercise-index="'+index+'"><span>↺</span><div><strong>Restore exercise</strong><small>Return it to the workout</small></div></button>':'')+
    '</div></section></div>';
}

function renderSessionSetupSheet(){
  if(!sessionSetupOpen||!store.activeWorkout)return '';
  const current=store.activeWorkout.trainingContext?.key||normalSessionSetupKey();
  return '<div class="exercise-modal-backdrop sheet-backdrop" data-action="close-session-setup"><section class="bottom-sheet session-setup-sheet" data-session-setup-panel>'+
    '<div class="sheet-handle"></div><div class="sheet-head"><div><p class="eyebrow">TRAIN ANYWHERE</p><h2>Change today’s setup</h2><p>Completed work stays untouched. GoWorkout adapts unfinished movements only.</p></div><button class="modal-close" data-action="close-session-setup">×</button></div>'+
    '<form id="session-setup-form" class="session-setup-form">'+
      renderSessionSetupOptions(current)+renderSessionSetupExtras(store.activeWorkout.trainingContext||{})+
      '<div class="session-setup-warning"><strong>TODAY ONLY</strong><span>Your normal program and profile equipment will not change.</span></div>'+
      '<button type="button" class="button primary-action" data-action="apply-session-setup">ADAPT REMAINING WORKOUT</button>'+
    '</form>'+
  '</section></div>';
}
function renderHistoryMenuSheet(){
  const item=store.history.find(entry=>entry.id===historyMenuId);if(!item)return '';
  const rows=(item.exercises||[]).map(ex=>{
    const done=(ex.sets||[]).filter(set=>set.completed).length;
    return '<div class="history-detail-row"><strong>'+esc(ex.name)+'</strong><span>'+done+'/'+(ex.sets?.length||0)+' sets'+(ex.feedback?' · '+esc(feedbackLabel(ex.feedback)):'')+'</span></div>';
  }).join('');
  return '<div class="exercise-modal-backdrop sheet-backdrop" data-action="close-history-menu"><section class="bottom-sheet history-detail-sheet" data-history-menu-panel><div class="sheet-handle"></div><div class="sheet-head"><div><p class="eyebrow">WORKOUT DETAILS</p><h2>'+esc(item.routineName)+'</h2><p>'+esc(formatDate(item.completedAt))+'</p></div><button class="modal-close" data-action="close-history-menu">×</button></div>'+
    '<div class="history-detail-summary"><div><span>TIME</span><strong>'+item.durationMinutes+' min</strong></div><div><span>SETS</span><strong>'+item.completedSets+'</strong></div><div><span>VOLUME</span><strong>'+formatVolume(item.totalVolume||0)+'</strong></div></div>'+
    ((item.trainingContext?.temporary||item.trainingContext?.adapted)?renderTrainingContextSummary(item.trainingContext,false):'')+
    '<div class="history-detail-list">'+rows+'</div>'+
    '<div class="sheet-action-list"><button class="danger-sheet-action" data-action="remove-history" data-history-id="'+esc(item.id)+'"><span>⌫</span><div><strong>Remove from history</strong><small>Recalculates calendar and adaptive data</small></div></button></div></section></div>';
}

function latestCompletedWorkout(){
  return [...(store.history||[])].filter(item=>item?.completedAt).sort((a,b)=>Date.parse(b.completedAt)-Date.parse(a.completedAt))[0]||null;
}
function daysSince(iso,date=new Date()){
  const value=Date.parse(iso||'');if(!Number.isFinite(value))return null;
  const today=new Date(date);today.setHours(0,0,0,0);
  const then=new Date(value);then.setHours(0,0,0,0);
  return Math.max(0,Math.floor((today-then)/86400000));
}
function getHomeExperience(date=new Date()){
  const schedule=currentWeekSchedule(date);
  const todayKey=dateKey(date);
  const completedToday=schedule.find(entry=>entry.dateKey===todayKey&&entry.status==='complete');
  const today=schedule.find(entry=>entry.dateKey===todayKey&&entry.status==='today');
  const missed=schedule.find(entry=>entry.status==='missed');
  const upcoming=schedule.find(entry=>entry.status==='upcoming');
  const last=latestCompletedWorkout();
  const awayDays=daysSince(last?.completedAt,date);
  const context=programContext(date);
  if(store.activeWorkout){
    const w=store.activeWorkout;
    const resolved=workoutResolvedCount(w);
    return {state:'active',context,schedule,eyebrow:'WORKOUT IN PROGRESS',title:w.routineName||'Current workout',copy:resolved+' of '+(w.exercises?.length||0)+' exercises resolved',meta:workoutElapsedSeconds(w)>60?formatClock(workoutElapsedSeconds(w))+' elapsed':'Ready when you are',primaryLabel:'RESUME WORKOUT',primaryAction:'resume',entry:null,last};
  }
  if(completedToday){
    const history=completedToday.history||last;
    const improvements=(history?.newPRs?.length||0);
    return {state:'completed',context,schedule,eyebrow:'YOU’RE DONE FOR TODAY',title:history?.routineName||completedToday.day?.name||'Workout complete',copy:(history?.durationMinutes?history.durationMinutes+' min · ':'')+(history?.completedSets||0)+' sets completed',meta:improvements?improvements+' improvement'+(improvements===1?'':'s')+' recorded':'Your work is saved',primaryLabel:'SEE YOUR WORKOUT',primaryAction:'history',entry:completedToday,last};
  }
  if(awayDays!==null&&awayDays>=7){
    const entry=today||missed||upcoming||null;
    const day=entry?.adaptedDay||entry?.day;
    return {state:'returning',context,schedule,eyebrow:'WELCOME BACK',title:day?.name||'Your program is ready',copy:'It’s been '+awayDays+' days since your last workout.',meta:day?'~'+(day.estimatedMinutes||store.profile?.minutes||45)+' min · '+day.exercises.length+' exercises':'Pick up from your current program',primaryLabel:entry&&(entry.status==='missed'||entry.status==='today')?(entry.status==='missed'?'START COMEBACK WORKOUT':'START WORKOUT'):'VIEW NEXT WORKOUT',primaryAction:entry&&(entry.status==='missed'||entry.status==='today')?'start':'train',entry,last};
  }
  if(missed){
    const day=missed.adaptedDay||missed.day;
    return {state:'missed',context,schedule,eyebrow:'STILL AVAILABLE',title:day?.name||'Missed workout',copy:'This session can move with you. You do not have to abandon the week.',meta:'~'+(day?.estimatedMinutes||store.profile?.minutes||45)+' min · '+(day?.exercises?.length||0)+' exercises',primaryLabel:'DO IT TODAY',primaryAction:'start',entry:missed,last};
  }
  if(today){
    const day=today.adaptedDay||today.day;
    const previous=(store.history||[]).find(item=>item.routineName===day?.name);
    return {state:'today',context,schedule,eyebrow:'TODAY',title:day?.name||'Today’s workout',copy:day?.focus||'Your planned training session',meta:'~'+(day?.estimatedMinutes||store.profile?.minutes||45)+' min · '+(day?.exercises?.length||0)+' exercises'+(previous?' · last done '+(daysSince(previous.completedAt,date)||0)+' days ago':''),primaryLabel:'START WORKOUT',primaryAction:'start',entry:today,last};
  }
  if(upcoming){
    const day=upcoming.adaptedDay||upcoming.day;
    const when=upcoming.date.toLocaleDateString(undefined,{weekday:'long'});
    return {state:'rest',context,schedule,eyebrow:'RECOVERY DAY',title:'No workout scheduled today',copy:'Your next session is '+day?.name+' on '+when+'.',meta:'Rest is part of the program.',primaryLabel:'VIEW NEXT WORKOUT',primaryAction:'train',entry:upcoming,last};
  }
  return {state:'week-complete',context,schedule,eyebrow:'WEEK COMPLETE',title:'Your planned sessions are done',copy:'Your next training week will build from what you completed.',meta:'Block '+context.blockNumber+' · Week '+context.blockWeek,primaryLabel:'VIEW PROGRESS',primaryAction:'progress',entry:null,last};
}
function renderHomePrimaryAction(x){
  if(x.primaryAction==='start'&&x.entry)return '<button class="button primary-action home-state-cta" data-start="'+esc(x.entry.day.id)+'" data-scheduled-date="'+esc(x.entry.dateKey)+'">'+esc(x.primaryLabel)+'</button>';
  return '<button class="button primary-action home-state-cta" data-action="'+esc(x.primaryAction)+'">'+esc(x.primaryLabel)+'</button>';
}
function renderHomeWeekPulse(schedule){
  const context=programContext();
  return '<div class="home-week-pulse">'+TRAINING_DAYS.map(dayDef=>{
    const entry=schedule.find(item=>item.dayId===dayDef.id);
    const date=addDays(context.weekStart,dayOffsetFromMonday(dayDef.id));
    const status=entry?.status||'rest';
    const marker=status==='complete'?'✓':status==='partial'?'½':status==='missed'?'!':status==='today'?'•':status==='upcoming'?'○':'';
    return '<div class="home-pulse-day status-'+status+'"><span>'+esc(dayDef.label)+'</span><strong>'+date.getDate()+'</strong><em>'+marker+'</em></div>';
  }).join('')+'</div>';
}
function renderHome(){
  const p=store.profile,plan=store.plan;if(!p||!plan)return renderProfileEditor();
  const x=getHomeExperience(),schedule=x.schedule,context=x.context;
  const completed=schedule.filter(entry=>entry.status==='complete').length;
  const planned=schedule.length;
  const shared=sharedTrainingState();
  const name=displayName()==='there'?'':displayName();
  const todayLabel=name?'Hey, '+esc(name)+'.':'Your training.';
  return '<div class="clean-page home-clean home-contextual">'+
    '<section class="home-greeting contextual-greeting"><div><p class="eyebrow">GOWORKOUT</p><h2>'+todayLabel+'</h2><p>'+esc(blockPhaseLabel(context.blockWeek))+' · Block '+context.blockNumber+', Week '+context.blockWeek+'</p></div></section>'+
    '<section class="home-state-hero state-'+esc(x.state)+'">'+
      '<div class="home-state-copy"><span>'+esc(x.eyebrow)+'</span><h1>'+esc(x.title)+'</h1><p>'+esc(x.copy)+'</p><small>'+esc(x.meta)+'</small></div>'+
      renderHomePrimaryAction(x)+
      (x.entry&&['today','missed','returning'].includes(x.state)&&normalSessionSetupKey()!=='bodyweight'?'<button class="home-train-anywhere" data-action="train-anywhere-home" data-day-id="'+esc(x.entry.day.id)+'" data-scheduled-date="'+esc(x.entry.dateKey)+'">CAN’T MAKE THE GYM? <strong>TRAIN ANYWHERE</strong></button>':'')+
      (x.state==='active'?'<div class="home-state-secondary"><button class="text-button" data-action="discard-recovered">DISCARD</button><button class="text-button" data-action="discard-and-new">START NEW</button></div>':'')+
    '</section>'+
    '<section class="clean-section home-week-section"><div class="clean-section-head"><div><p class="eyebrow">THIS WEEK</p><h3>'+completed+' of '+planned+' workouts complete</h3></div><button class="text-button" data-action="train">SEE WEEK</button></div>'+
      renderHomeWeekPulse(schedule)+
      '<div class="home-week-progress" aria-label="'+completed+' of '+planned+' workouts complete"><span style="width:'+Math.round((completed/Math.max(1,planned))*100)+'%"></span></div>'+
    '</section>'+
    (x.last&&x.state!=='completed'?'<button class="home-continuity-card" data-action="history"><div><span>LAST WORKOUT</span><strong>'+esc(x.last.routineName||'Workout')+'</strong><small>'+esc(formatDate(x.last.completedAt))+(x.last.durationMinutes?' · '+x.last.durationMinutes+' min':'')+'</small></div><em>VIEW →</em></button>':'')+
    (shared.draft?'<button class="shared-home-card" data-action="together"><div class="shared-avatar-stack small"><div class="shared-avatar you">'+esc((displayName()[0]||'Y').toUpperCase())+'</div><div class="shared-avatar partner">'+esc((shared.draft.partnerName[0]||'P').toUpperCase())+'</div></div><div><span>SHARED WORKOUT</span><strong>'+esc(shared.draft.routineName)+' with '+esc(shared.draft.partnerName)+'</strong><small>'+esc(shared.draft.partnerStatus==='ready'?'Both ready':'Invite pending')+'</small></div><em>→</em></button>':'')+
  '</div>';
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
  const warmCount=w.warmup?.length||0,coolCount=w.cooldown?.length||0;
  const strengthMinutes=Math.max(1,(w.readiness?.timeAvailable||store.profile?.minutes||45)-runnerPhaseMinutes(w.warmup)-runnerPhaseMinutes(w.cooldown));
  const setup=w.trainingContext?sessionSetupLabel(w.trainingContext):(store.profile?.equipment==='full-gym'?'Gym':'Training');
  return '<div class="runner-overview">'+
    '<div class="runner-overview-title"><h2>'+esc(w.routineName)+'</h2><p>'+esc(w.readiness?.timeAvailable||store.profile?.minutes||45)+' minutes · '+esc(setup)+'</p></div>'+
    '<div class="runner-phase-list">'+
      (warmCount?'<button class="runner-phase-row active" data-action="begin-session"><span class="runner-phase-icon">●</span><div><strong>Warm-up</strong><small>'+warmCount+' movements · '+runnerPhaseMinutes(w.warmup)+' minutes</small></div><em>›</em></button>':'')+
      '<div class="runner-phase-row"><span class="runner-phase-icon">▰</span><div><strong>Strength</strong><small>'+w.exercises.length+' exercises · ~'+strengthMinutes+' minutes</small></div></div>'+
      (coolCount?'<div class="runner-phase-row"><span class="runner-phase-icon">✦</span><div><strong>Cooldown</strong><small>'+coolCount+' movements · '+runnerPhaseMinutes(w.cooldown)+' minutes</small></div></div>':'')+
    '</div>'+
    (w.trainingContext?.changes?.length?'<div class="runner-overview-note"><span>TODAY’S ADAPTATION</span><strong>'+w.trainingContext.changes.length+' movement'+(w.trainingContext.changes.length===1?'':'s')+' adjusted for '+esc(sessionSetupLabel(w.trainingContext))+'</strong></div>':'')+
    '<button class="button primary-action runner-gold-action" data-action="begin-session">START WORKOUT</button>'+
    '<button class="text-button runner-map-link" data-action="open-workout-map">VIEW WORKOUT MAP</button>'+
  '</div>';
}
function beginWorkoutSession(){
  const w=store.activeWorkout;if(!w||w.phase!=='intro')return;
  unlockWorkoutCues();
  fireWorkoutSignal('go','session-intro-'+w.id,{voice:w.routineName+'. '+w.exercises.length+' exercises today.',label:'READY'});
  if(w.warmup?.length){
    w.phase='warmup-routine';
    w.timedStageIndex=0;
    w.timedStageReps=0;
    w.timedPhaseStartedAt=null;
    saveStore();render();
  }else beginPreSetPosition(0,0,true);
}

function startWarmupRoutine(){
  const w=store.activeWorkout;if(!w||w.phase!=='warmup-routine')return;
  w.phase='warmup';w.timedStageIndex=0;w.timedStageReps=0;w.timedPhaseStartedAt=new Date().toISOString();w.warmupStartedAt=w.timedPhaseStartedAt;w.warmupCompletedAt=null;w.timedPhaseSkippedSeconds=0;
  fireWorkoutSignal('go','warmup-start-'+w.id,{voice:'Warm-up starts now.',label:'GO'});
  saveStore();render();
}
function completeWarmup(){
  const w=store.activeWorkout;if(!w)return;
  w.phase='warmup-complete';w.warmupCompletedAt=new Date().toISOString();w.timedPhaseStartedAt=null;w.timedStageReps=0;
  fireWorkoutSignal('complete','warmup-complete-'+w.id,{voice:'Warm-up complete.',label:'READY'});
  saveStore();render();
}
function startStrengthWork(){
  const w=store.activeWorkout;if(!w||w.phase!=='warmup-complete')return;
  beginPreSetPosition(0,0,true);
}
function addWarmupRep(){
  const w=store.activeWorkout;if(!w||w.phase!=='warmup')return;
  const snap=timedStageSnapshot(w);if(!snap||snap.mode!=='reps')return;
  w.timedStageReps=Math.min(snap.totalReps,(Number(w.timedStageReps)||0)+1);
  if(w.timedStageReps>=snap.totalReps){
    fireWorkoutSignal('complete','warmup-reps-'+w.id+'-'+snap.index,{voice:'Done',label:'DONE'});
    advanceTimedStage();return;
  }
  saveStore();render();
}
function removeWarmupRep(){
  const w=store.activeWorkout;if(!w||w.phase!=='warmup')return;
  w.timedStageReps=Math.max(0,(Number(w.timedStageReps)||0)-1);
  saveStore();render();
}
function runnerPhaseMinutes(items=[]){
  return Math.max(1,Math.round(items.reduce((sum,item)=>sum+timedStageEstimateSeconds(item),0)/60));
}
function renderWarmupRoutine(w){
  return '<div class="runner-warmup-routine">'+
    '<div class="runner-routine-head"><h2>'+esc(w.routineName)+' Warm-up</h2><p>'+runnerPhaseMinutes(w.warmup)+' minutes · '+w.warmup.length+' movements</p><small>Get your body ready for today’s workout with dynamic movement and mobility.</small></div>'+
    '<div class="runner-routine-list">'+w.warmup.map((item,index)=>{
      const image=timedStageImageUrl(item,0);
      const target=item.mode==='reps'||item.reps?(item.reps+' reps'+(item.side?' '+item.side:'')):formatClock(item.seconds||30);
      return '<div class="runner-routine-row"><div class="runner-routine-thumb">'+(image?'<img src="'+esc(image)+'" alt="">':'<span>'+String(index+1).padStart(2,'0')+'</span>')+'</div><div><strong>'+esc(item.name)+'</strong><small>'+esc(target)+'</small></div><em>≡</em></div>';
    }).join('')+'</div>'+
    '<button class="button primary-action runner-gold-action" data-action="start-warmup">START WARM-UP</button>'+
  '</div>';
}
function renderWarmupComplete(w){
  const first=w.exercises?.[0];
  return '<div class="runner-warmup-complete"><div class="runner-complete-mark">✓</div><h2>You’re warm.</h2><p>'+esc(w.routineName)+' starts with</p>'+
    (first?'<div class="runner-first-strength">'+exerciseImageButton(first,'warmup-complete-media')+'<div><strong>'+esc(first.name)+'</strong><small>'+esc(currentPrescriptionLabel(first))+'</small></div></div>':'')+
    '<button class="button primary-action runner-gold-action" data-action="start-strength">START WORKOUT</button><button class="text-button runner-map-link" data-action="open-workout-map">VIEW WORKOUT MAP</button></div>';
}

function renderWorkout(){
  const pos=getActivePosition();
  if(!pos)return '<div class="clean-page empty-workout-page"><p class="eyebrow">TRAIN</p><h2>No active session.</h2><p>Start today’s workout from Home or Train.</p><button class="button" data-action="home">GO HOME</button></div>';
  const w=pos.workout,guided=['intro','warmup-routine','warmup','warmup-complete'].includes(w.phase);
  const activeStrength=['pre-set','work','timed-set','rest','calibrate','feedback','exercise-transition','exercise-review'].includes(w.phase);
  const warmSnap=w.phase==='warmup'?timedStageSnapshot(w):null;
  const headerTitle=w.phase==='warmup'?'Warm-up':w.phase==='cooldown'?'Cooldown':w.routineName;
  const headerProgress=w.phase==='warmup'&&warmSnap?(warmSnap.index+1)+' of '+(w.warmup?.length||0):activeStrength?(pos.ei+1)+' of '+w.exercises.length:'';
  const warmElapsed=w.phase==='warmup'?(' · Warm-up <b id="warmup-elapsed-clock">'+formatClock(warmupElapsedSeconds(w))+'</b>'):'';
  return '<div class="guided-shell cleaned-workout runner-v2 phase-'+esc(w.phase)+'"><div id="workout-cue-flash" class="workout-cue-flash" aria-hidden="true"></div>'+
    '<header class="runner-v2-header"><button class="workout-back" data-action="home" aria-label="Leave workout and resume later">‹</button><div><strong>'+esc(headerTitle)+'</strong>'+(headerProgress?'<span>'+esc(headerProgress)+'</span>':'')+'<small>Workout <b id="elapsed-clock">'+formatClock(workoutElapsedSeconds(w))+'</b>'+warmElapsed+'</small></div><button class="circle-action" data-action="open-workout-map" aria-label="Workout map">•••</button></header>'+
    (w.phase==='warmup'?'<div class="runner-top-progress"><span style="width:'+(((warmSnap?.index||0)+1)/Math.max(1,w.warmup.length)*100)+'%"></span></div>':activeStrength?'<div class="runner-top-progress"><span style="width:'+((pos.ei+1)/Math.max(1,w.exercises.length)*100)+'%"></span></div>':'')+
    (w.isPaused?'<div class="workout-pause-banner"><strong>WORKOUT PAUSED</strong><span>Timers are frozen.</span></div>':'')+
    '<section class="exercise-stage runner-v2-stage">'+(w.phase==='intro'?renderWorkoutIntro(w):w.phase==='warmup-routine'?renderWarmupRoutine(w):w.phase==='warmup-complete'?renderWarmupComplete(w):w.phase==='review'?renderWorkoutReview(w):w.phase==='exercise-transition'?renderExerciseTransition(w):w.phase==='exercise-review'?renderExerciseReview(pos):w.phase==='warmup'||w.phase==='cooldown'?renderTimedStage(w):w.phase==='pre-set'?renderPreSet(pos):w.phase==='timed-set'?renderTimedWorkSet(pos):w.phase==='rest'?renderRest(pos):w.phase==='calibrate'?renderCalibration(pos):w.phase==='feedback'?renderExerciseFeedback(pos):renderWorkSet(pos))+'</section>'+
    (!guided&&w.phase!=='cooldown'&&w.phase!=='review'?'<div class="runner-v2-quiet"><button class="text-button" data-action="open-workout-map">WORKOUT MAP</button><button class="text-button muted" data-action="home">LEAVE & RESUME</button></div>':'')+'</div>';
}

function renderPreSet(pos){
  const ex=pos.exercise,set=prepareSetTarget(ex,pos.set,pos.si),previous=previousSetForPosition(ex,pos.si);
  const previousLabel=previous.set?setPerformanceLabel(ex,previous.set):'No previous set';
  const bounds=repBounds(ex.reps);
  const noWeight=['bodyweight','timed','band'].includes(ex.loadMode);
  const repLabel=ex.loadMode==='timed'?'sec':'reps';
  const targetReps=recommendedRepTarget(ex);
  const recommendedReps=bounds.low&&bounds.high&&bounds.low!==bounds.high
    ?(targetReps>bounds.high?(targetReps+' reps · base '+bounds.low+'–'+bounds.high):(bounds.low+'–'+bounds.high+' reps'))
    :(targetReps+' '+repLabel);
  const recommendedWeight=noWeight?(ex.loadMode==='bodyweight'?'Bodyweight':ex.loadMode==='band'?'Band resistance':'Timed'):(recommendedWeightTarget(ex)+' lb');
  return '<div class="runner-set-ready">'+
    '<div class="runner-set-ready-head"><div><h2>'+esc(ex.name)+'</h2><p>Set '+(pos.si+1)+' of '+ex.sets.length+'</p></div><button class="more-action" data-action="open-exercise-actions" data-exercise-index="'+pos.ei+'">•••</button></div>'+
    '<div class="runner-set-ready-media '+(exerciseMediaSpec(ex).status==='direct'?'':'compact-fallback')+'">'+exerciseImageButton(ex,'pre-set-exercise-media')+'</div>'+
    '<div class="runner-recommended-line"><span>RECOMMENDED</span><strong>'+esc(recommendedWeight)+' · '+esc(recommendedReps)+'</strong><small>Previous: '+esc(previousLabel)+'</small></div>'+
    '<div class="runner-target-steppers '+(noWeight?'single':'')+'">'+
      (!noWeight?'<div class="runner-target-stepper"><span>WEIGHT</span><div><button data-action="adjust-set-target" data-target-type="weight" data-target-delta="-1" aria-label="Decrease weight">−</button><strong>'+esc(setTargetValue(ex,set,'weight'))+' lb</strong><button data-action="adjust-set-target" data-target-type="weight" data-target-delta="1" aria-label="Increase weight">+</button></div></div>':'')+
      '<div class="runner-target-stepper"><span>'+(ex.loadMode==='timed'?'TIME':'REPS')+'</span><div><button data-action="adjust-set-target" data-target-type="reps" data-target-delta="-1" aria-label="Decrease '+repLabel+'">−</button><strong>'+esc(setTargetValue(ex,set,'reps'))+' '+repLabel+'</strong><button data-action="adjust-set-target" data-target-type="reps" data-target-delta="1" aria-label="Increase '+repLabel+'">+</button></div></div>'+
    '</div>'+
    '<button class="button primary-action runner-gold-action" type="button" data-action="start-set-now">START SET</button>'+
    '<div class="runner-set-links"><button class="text-button" data-exercise-detail="'+esc(ex.id)+'">FORM</button><button class="text-button" data-action="open-exercise-actions" data-exercise-index="'+pos.ei+'">OPTIONS</button></div>'+
  '</div>';
}
function renderTimedWorkSet(pos){
  const snap=timedSetSnapshot(pos.workout)||{remaining:num(pos.set.reps)||30,total:num(pos.set.reps)||30};
  const pct=Math.max(0,Math.min(100,(snap.remaining/Math.max(1,snap.total))*100));
  return '<div class="clean-timed-set">'+
    '<p class="eyebrow">TIMED SET · '+(pos.si+1)+' OF '+pos.exercise.sets.length+'</p>'+
    '<h2>'+esc(pos.exercise.name)+'</h2>'+
    '<div class="clean-timed-media '+(exerciseMediaSpec(pos.exercise).status==='direct'?'':'compact-fallback')+'">'+exerciseImageButton(pos.exercise,'timed-work-exercise-media')+'</div>'+
    '<div class="timed-work-clock clean-timed-clock" id="timed-set-clock">'+formatClock(snap.remaining)+'</div>'+
    '<div class="stage-progress"><span id="timed-set-progress" style="width:'+pct+'%"></span></div>'+
    '<p class="preset-cue">'+esc(exerciseGuidance(pos.exercise).cue)+'</p>'+
    '<button class="button secondary" data-action="end-timed-set">END SET EARLY</button>'+
    '<div class="preset-tertiary"><button class="text-button" data-exercise-detail="'+esc(pos.exercise.id)+'">Form</button><button class="text-button" data-action="open-exercise-actions" data-exercise-index="'+pos.ei+'">Options</button><button class="text-button muted" data-action="reset-timer">Reset</button></div>'+
  '</div>';
}
function renderTimedStage(w){
  const items=timedStageItems(w),snap=timedStageSnapshot(w)||{index:0,remaining:0,total:30,mode:'time'};
  const index=Math.max(0,Math.min(snap.index||0,Math.max(0,items.length-1))),item=items[index]||items[0],next=index+1<items.length?items[index+1]:null;
  const image=timedStageImageUrl(item,0);
  const pct=snap.mode==='reps'?Math.max(0,Math.min(100,(snap.completedReps/Math.max(1,snap.totalReps))*100)):Math.max(0,Math.min(100,((snap.total-snap.remaining)/Math.max(1,snap.total))*100));
  return '<div class="timed-stage runner-guided-stage" data-stage-index="'+index+'" data-stage-mode="'+esc(snap.mode)+'">'+
    '<div class="runner-stage-media">'+(image?'<img src="'+esc(image)+'" loading="eager" decoding="async" alt="'+esc(item?.name||'Movement')+' demonstration">':'<div class="runner-stage-placeholder"><span>'+String(index+1).padStart(2,'0')+'</span></div>')+'</div>'+
    '<div class="runner-stage-copy"><h2>'+esc(item?.name||'Get ready')+'</h2><p>'+esc(item?.cue||'Move through a comfortable range.')+'</p></div>'+
    (snap.mode==='reps'?'<div class="runner-rep-stepper"><button data-action="warmup-rep-minus" '+(snap.completedReps<=0?'disabled':'')+' aria-label="Remove rep">−</button><div><strong>'+snap.completedReps+' / '+snap.totalReps+'</strong><span>reps'+(item?.side?' · '+esc(item.side):'')+'</span></div><button data-action="warmup-rep" aria-label="Log rep">+</button></div>':'<div class="runner-stage-time" id="stage-clock">'+formatClock(snap.remaining)+'</div>')+
    '<div class="runner-stage-progress"><span id="stage-progress-fill" style="width:'+pct+'%"></span></div>'+
    '<div class="runner-stage-controls"><button class="runner-stage-skip" data-action="skip-stage"><span>◀|</span><small>Skip</small></button>'+
      '<button class="runner-stage-pause" data-action="toggle-workout-pause">'+(w.isPaused?'▶':'Ⅱ')+'</button>'+
      '<button class="runner-stage-next" data-action="skip-stage"><span>|▶</span><small>Next</small></button></div>'+
    (next?'<div class="runner-up-next"><span>Up next</span><div class="runner-routine-thumb">'+(timedStageImageUrl(next,0)?'<img src="'+esc(timedStageImageUrl(next,0))+'" alt="">':'<b>'+String(index+2).padStart(2,'0')+'</b>')+'</div><div><strong>'+esc(next.name)+'</strong><small>'+(next.mode==='reps'||next.reps?esc(next.reps+' reps'+(next.side?' '+next.side:'')):formatClock(next.seconds||30))+'</small></div></div>':'')+
  '</div>';
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
      sets:sets.map(set=>({weight:num(set.weight),reps:num(set.reps),durationSeconds:num(set.durationSeconds),plannedWeight:num(set.plannedWeight),plannedReps:num(set.plannedReps)})),
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
    '<div class="last-set-strip">'+latest.sets.map((set,index)=>'<span><small>S'+(index+1)+'</small><strong>'+esc(setPerformanceLabel(ex,set))+'</strong>'+(set.durationSeconds?'<em>'+formatClock(set.durationSeconds)+'</em>':'')+'</span>').join('')+'</div>'+
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

function previousSetForPosition(ex,setIndex){
  const previous=exerciseSessionHistory(ex.id,1)[0];
  const set=previous?.sets?.[setIndex]||previous?.sets?.[previous.sets.length-1]||null;
  return {session:previous,set};
}
function setTargetBounds(ex){
  const primary=repBounds(ex?.reps||'');
  if(primary.low||primary.high)return primary;
  return repBounds(ex?.suggestedReps||'');
}
function setPerformanceInsight(ex,set,setIndex){
  const reps=num(set?.reps),weight=num(set?.weight);
  const bounds=setTargetBounds(ex);
  const previous=previousSetForPosition(ex,setIndex);
  const previousSet=previous.set;
  const previousReps=num(previousSet?.reps),previousWeight=num(previousSet?.weight);
  const targetLabel=currentPrescriptionLabel(ex);
  const previousLabel=previousSet?setPerformanceLabel(ex,previousSet):'No previous set';
  let tone='steady',label='Set logged',detail='This set is saved and will count toward your exercise result.';

  if(bounds.low&&reps<bounds.low){
    tone='caution';
    label='Below target range';
    detail='You logged '+reps+' '+(ex.loadMode==='timed'?'seconds':'reps')+' against a target of '+bounds.low+(bounds.high&&bounds.high!==bounds.low?'–'+bounds.high:'')+'. Keep the next set controlled. You can lower the load if clean reps are falling away.';
  }else if(bounds.high&&reps>bounds.high){
    tone='progress';
    label='Above target range';
    detail='You moved past the top of today’s target. Finish the exercise before GoWorkout decides whether the next session should progress.';
  }else if(!previousSet){
    tone='baseline';
    label='Baseline established';
    detail='This is your first recorded Set '+(setIndex+1)+' for '+ex.name+'. Future sessions can now compare against it.';
  }else if(ex.loadMode==='timed'&&reps>previousReps){
    tone='progress';
    label='Longer than last time';
    detail='You added '+Math.round(reps-previousReps)+' second'+(Math.round(reps-previousReps)===1?'':'s')+' to the matching set.';
  }else if(isWeightedMode(ex.loadMode)&&weight>previousWeight&&(!bounds.low||reps>=bounds.low)){
    tone='progress';
    label='Heavier than last time';
    detail='You added '+Math.round((weight-previousWeight)*10)/10+' lb to the matching set and stayed in the working range.';
  }else if(reps>previousReps&&(!isWeightedMode(ex.loadMode)||weight===previousWeight)){
    tone='progress';
    label='More reps than last time';
    detail='You added '+Math.round(reps-previousReps)+' rep'+(Math.round(reps-previousReps)===1?'':'s')+(weight?' at the same load.':'.');
  }else if(bounds.low&&reps>=bounds.low&&(!bounds.high||reps<=bounds.high)){
    tone='success';
    label='Target reached';
    detail='You are inside today’s rep range. Keep the next set controlled and repeat the quality.';
  }else if(previousSet&&reps===previousReps&&weight===previousWeight){
    tone='steady';
    label='Matched last time';
    detail='The matching set is steady. That still counts as useful consistency.';
  }

  return {
    exerciseId:ex.id,
    exerciseName:ex.name,
    setIndex,
    tone,
    label,
    detail,
    targetLabel,
    previousLabel,
    weight,
    reps,
    at:new Date().toISOString()
  };
}
function renderSetPerformanceInsight(insight,compact=false){
  if(!insight)return '';
  return '<section class="runner-set-insight tone-'+esc(insight.tone||'steady')+' '+(compact?'compact':'')+'" role="status">'+
    '<span>SET FEEDBACK</span><strong>'+esc(insight.label||'Set logged')+'</strong><p>'+esc(insight.detail||'')+'</p>'+
    (!compact?'<div><small>PREVIOUS</small><em>'+esc(insight.previousLabel||'No previous set')+'</em></div>':'')+
  '</section>';
}
function renderWorkSet(pos){
  const ex=pos.exercise,set=pos.set;
  const noWeight=['bodyweight','timed','band'].includes(ex.loadMode);
  const repLabel=ex.loadMode==='timed'?'sec':'reps';
  const plannedWeight=set.plannedWeight??set.weight??'';
  const plannedReps=set.plannedReps??set.reps??'';
  const displayLoad=noWeight?(ex.loadMode==='band'?'Band resistance':'Bodyweight'):(String(setTargetValue(ex,set,'weight'))+' lb');
  return '<div class="runner-work-clean">'+
    '<div class="runner-work-clean-head"><button class="text-button" data-exercise-detail="'+esc(ex.id)+'">FORM</button><div><strong>'+esc(ex.name)+'</strong><span>Set '+(pos.si+1)+' of '+ex.sets.length+'</span></div><button class="more-action" data-action="open-exercise-actions" data-exercise-index="'+pos.ei+'">•••</button></div>'+
    '<div class="runner-target-ring runner-set-timer"><strong id="set-clock">'+formatClock(setElapsedSeconds(pos.workout))+'</strong><span>set time</span></div>'+
    '<div class="runner-live-plan"><span>PLANNED</span><strong>'+(noWeight?'':esc(plannedWeight||0)+' lb × ')+esc(plannedReps)+' '+repLabel+'</strong></div>'+
    '<div class="runner-load-focus"><strong>'+esc(displayLoad)+'</strong><span>'+esc(exerciseGuidance(ex).cue||'Keep the movement controlled.')+'</span></div>'+
    '<div class="runner-target-steppers '+(noWeight?'single':'')+' compact">'+
      (!noWeight?'<div class="runner-target-stepper"><span>ACTUAL WEIGHT</span><div><button data-action="adjust-set-target" data-target-type="weight" data-target-delta="-1">−</button><strong>'+esc(setTargetValue(ex,set,'weight'))+' lb</strong><button data-action="adjust-set-target" data-target-type="weight" data-target-delta="1">+</button></div></div>':'')+
      '<div class="runner-target-stepper"><span>ACTUAL '+(ex.loadMode==='timed'?'TIME':'REPS')+'</span><div><button data-action="adjust-set-target" data-target-type="reps" data-target-delta="-1">−</button><strong>'+esc(setTargetValue(ex,set,'reps'))+' '+repLabel+'</strong><button data-action="adjust-set-target" data-target-type="reps" data-target-delta="1">+</button></div></div>'+
    '</div>'+
    '<input id="set-weight" type="hidden" value="'+esc(set.weight??'')+'"><input id="set-reps" type="hidden" value="'+esc(set.reps??'')+'">'+
    '<section class="runner-live-log"><button class="button primary-action runner-gold-action" data-action="complete-set">COMPLETE SET</button><button class="text-button" data-action="skip-current-set">SKIP SET</button></section>'+
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
  const latest=[...(pos.exercise.sets||[])].reverse().find(set=>set.completed)?.performanceInsight||null;
  return '<div class="clean-feedback-stage">'+
    '<div class="summary-check small-check">✓</div><p class="eyebrow">EXERCISE COMPLETE</p><h2>'+esc(pos.exercise.name)+'</h2>'+
    '<p>How did that movement feel? One tap updates the next-session recommendation.</p>'+
    renderSetPerformanceInsight(latest,true)+
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
  const next=w.pendingPosition,ex=next?w.exercises[next.ei]:null;
  if(!next||!ex)return '<div class="empty-state"><h2>No next exercise.</h2><button class="button" data-action="open-workout-review">REVIEW WORKOUT</button></div>';
  const guide=exerciseGuidance(ex);
  return '<div class="runner-transition-stage compact-transition">'+
    '<div class="runner-transition-heading"><p class="eyebrow">UP NEXT · '+(next.ei+1)+' OF '+w.exercises.length+'</p><h2>'+esc(ex.name)+'</h2></div>'+
    '<div class="runner-transition-media '+(exerciseMediaSpec(ex).status==='direct'?'':'compact-fallback')+'">'+exerciseImageButton(ex,'next-exercise-media')+'</div>'+
    '<div class="runner-transition-target"><span>TODAY’S TARGET</span><strong>'+esc(currentPrescriptionLabel(ex))+'</strong></div>'+
    '<div class="runner-setup-cue"><span>SETUP</span><strong>'+esc(guide.setup||exerciseDescription(ex))+'</strong></div>'+
    '<button class="button primary-action runner-ready-next" data-action="ready-next-exercise">I’M READY</button>'+
    '<div class="runner-transition-actions"><button class="text-button" data-exercise-detail="'+esc(ex.id)+'">FORM</button><button class="text-button" data-action="open-exercise-actions" data-exercise-index="'+next.ei+'">OPTIONS</button></div></div>';
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
  const nextName=changingExercise?(nextEx?.name||'Next exercise'):next?pos.exercise.name:'Cooldown';
  const nextSet=changingExercise?1:next?(next.si+1):0;
  const last=pos.workout.lastCompletedSet;
  const completed=last&&last.exerciseId===pos.exercise.id
    ?((last.weight?last.weight+' lb × ':'')+last.reps+' reps'+(last.durationSeconds?' · '+formatClock(last.durationSeconds):''))
    :'Set logged';
  const planned=last&&last.exerciseId===pos.exercise.id
    ?((last.plannedWeight?last.plannedWeight+' lb × ':'')+last.plannedReps+' reps')
    :'';
  const changed=Boolean(planned&&completed&&!completed.startsWith(planned));
  return '<div class="runner-rest-clean"><div class="runner-rest-check">✓</div><h2>Great set.</h2><p>'+esc(completed)+'</p>'+
    (changed?'<div class="runner-rest-plan"><span>PLANNED</span><strong>'+esc(planned)+'</strong></div>':'')+
    '<div class="timer-wrap runner-rest-ring" id="timer-ring" style="--timer-progress:'+restProgress(pos.workout)+'%"><div><div class="timer-value" id="rest-clock">'+formatClock(remaining)+'</div><div class="timer-sub">'+(paused?'PAUSED':'REST')+'</div></div></div>'+
    '<div class="runner-rest-next">'+(nextEx?exerciseImageButton(nextEx,'rest-next-exercise-media'):'')+'<div><span>Up next</span><strong>'+esc(nextName)+'</strong><small>'+(nextSet?'Set '+nextSet+' of '+(nextEx?.sets?.length||pos.exercise.sets.length)+' · ':'')+esc(nextEx?currentPrescriptionLabel(nextEx):next?currentPrescriptionLabel(pos.exercise):'Guided cooldown')+'</small></div></div>'+
    '<div class="runner-rest-actions-clean three"><button data-action="skip-rest">SKIP REST</button><button data-action="pause-rest">'+(paused?'RESUME':'PAUSE')+'</button><button data-action="add-rest" '+(remaining>=60?'disabled':'')+'>+15 SEC</button></div></div>';
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
    return '<article class="history-card clean-history-card"><button class="history-main" data-action="history-details" data-history-id="'+esc(x.id)+'"><div><div class="history-title-line"><h3>'+esc(x.routineName)+'</h3>'+(status?'<span>'+status+'</span>':'')+(x.newPRs?.length?'<em>'+x.newPRs.length+' PR'+(x.newPRs.length===1?'':'s')+'</em>':'')+'</div><p>'+esc(timing)+'</p><small>'+x.durationMinutes+' min · '+x.completedSets+' sets · '+formatVolume(x.totalVolume||0)+((x.trainingContext?.temporary||x.trainingContext?.adapted)?' · '+esc(sessionSetupLabel(x.trainingContext))+' adaptation':'')+'</small></div><strong>›</strong></button><button class="history-more" data-action="open-history-menu" data-history-id="'+esc(x.id)+'" aria-label="Workout options">•••</button></article>';
  }).join('');
  const filters=[['all','All'],['block','This Block'],['30','Last 30 Days']];
  return '<div class="clean-page"><div class="clean-page-head"><div><p class="eyebrow">HISTORY</p><h2>Workout history.</h2><p>Every session stays tied to the day it was scheduled and the day you actually trained.</p></div><button class="text-button" data-action="progress">PROGRESS</button></div>'+
    '<div class="history-filter-row">'+filters.map(([value,label])=>'<button class="'+(historyFilter===value?'active':'')+'" data-action="set-history-filter" data-history-filter="'+value+'">'+label+'</button>').join('')+'</div>'+
    '<div class="history-list clean-history-list">'+(rows||renderEmpty('No workouts here','Try another filter or complete a workout.'))+'</div></div>';
}

function exerciseProgressSeries(exerciseId){
  const sessions=[];
  const ordered=[...(store.history||[])].reverse();
  for(const workout of ordered){
    const ex=(workout.exercises||[]).find(item=>item.id===exerciseId);
    if(!ex)continue;
    const sets=(ex.sets||[]).filter(set=>set.completed);
    if(!sets.length)continue;
    let best=null;
    for(const set of sets){
      const current={weight:num(set.weight),reps:num(set.reps)};
      if(!best||current.weight>best.weight||(current.weight===best.weight&&current.reps>best.reps))best=current;
    }
    sessions.push({
      workoutId:workout.id,
      date:workout.completedAt,
      routineName:workout.routineName,
      bestWeight:best?.weight||0,
      bestReps:best?.reps||0,
      volume:sets.reduce((sum,set)=>sum+num(set.weight)*num(set.reps),0),
      totalReps:sets.reduce((sum,set)=>sum+num(set.reps),0),
      setCount:sets.length
    });
  }
  return sessions;
}
function exerciseProgressSummary(exerciseId){
  const series=exerciseProgressSeries(exerciseId);
  if(!series.length)return null;
  const ex=catalog.find(item=>item.id===exerciseId)||(store.history||[]).flatMap(item=>item.exercises||[]).find(item=>item.id===exerciseId)||null;
  const first=series[0],latest=series[series.length-1];
  let best=series[0];
  for(const session of series){
    if(session.bestWeight>best.bestWeight||(session.bestWeight===best.bestWeight&&session.bestReps>best.bestReps))best=session;
  }
  const weighted=series.some(item=>item.bestWeight>0);
  const loadChange=weighted?best.bestWeight-first.bestWeight:0;
  const repChange=!weighted?best.bestReps-first.bestReps:0;
  return {
    exerciseId,
    name:ex?.name||exerciseId,
    loadMode:ex?.loadMode||'',
    series,
    first,
    latest,
    best,
    weighted,
    sessions:series.length,
    baselineLabel:weighted?(first.bestWeight+' lb × '+first.bestReps):(first.bestReps+(ex?.loadMode==='timed'?' sec':' reps')),
    bestLabel:weighted?(best.bestWeight+' lb × '+best.bestReps):(best.bestReps+(ex?.loadMode==='timed'?' sec':' reps')),
    changeLabel:weighted?(loadChange>0?'+'+Math.round(loadChange*10)/10+' lb from baseline':best.bestReps>first.bestReps?'+'+(best.bestReps-first.bestReps)+' reps at best load':'Holding baseline'):repChange>0?'+'+repChange+(ex?.loadMode==='timed'?' sec':' reps')+' from baseline':'Holding baseline',
    status:series.length===1?'baseline':(best.bestWeight>first.bestWeight||best.bestReps>first.bestReps?'improved':'steady')
  };
}
function personalRecords(){
  const ids=new Set();
  for(const w of store.history)for(const ex of w.exercises||[])if((ex.sets||[]).some(set=>set.completed))ids.add(ex.id);
  return [...ids].map(exerciseProgressSummary).filter(Boolean).sort((a,b)=>{
    if(a.status!==b.status)return a.status==='improved'?-1:b.status==='improved'?1:0;
    return b.sessions-a.sessions;
  });
}
function progressMetricValue(session,metric){
  if(metric==='reps')return num(session?.bestReps);
  if(metric==='volume')return num(session?.volume);
  return num(session?.bestWeight);
}
function progressMetricLabel(metric){
  return metric==='reps'?'Best reps':metric==='volume'?'Session volume':'Working weight';
}
function formatProgressMetric(value,metric,summary){
  if(metric==='weight')return value?Math.round(value*10)/10+' lb':'No load';
  if(metric==='volume')return formatVolume(value||0);
  return Math.round(value||0)+(summary?.loadMode==='timed'?' sec':' reps');
}
function progressChartPath(series,metric,width=320,height=118){
  if(!series.length)return {path:'',points:[],min:0,max:0};
  const values=series.map(item=>progressMetricValue(item,metric));
  const max=Math.max(...values),min=Math.min(...values);
  const range=Math.max(1,max-min);
  const left=10,right=width-10,top=10,bottom=height-18;
  const points=values.map((value,index)=>{
    const x=series.length===1?(left+right)/2:left+(right-left)*(index/(series.length-1));
    const y=bottom-((value-min)/range)*(bottom-top);
    return {x:Math.round(x*10)/10,y:Math.round(y*10)/10,value,index};
  });
  return {path:points.map((point,index)=>(index?'L':'M')+point.x+' '+point.y).join(' '),points,min,max};
}
function renderProgressChart(summary,metric,compact=false){
  const series=summary?.series||[];
  if(!series.length)return '';
  const values=series.map(item=>progressMetricValue(item,metric));
  const supported=metric==='weight'?summary.weighted:metric==='volume'?values.some(Boolean):true;
  if(!supported)return '<div class="progress-chart-empty"><strong>No '+esc(progressMetricLabel(metric).toLowerCase())+' data</strong><span>This movement is better tracked with '+(summary.loadMode==='timed'?'time':'reps')+'.</span></div>';
  const chart=progressChartPath(series,metric,compact?180:320,compact?54:118);
  const width=compact?180:320,height=compact?54:118;
  return '<div class="progress-chart '+(compact?'compact':'')+'">'+
    '<svg viewBox="0 0 '+width+' '+height+'" role="img" aria-label="'+esc(progressMetricLabel(metric))+' trend for '+esc(summary.name)+'">'+
      '<path class="progress-chart-line" d="'+chart.path+'"></path>'+
      chart.points.map(point=>'<circle class="progress-chart-point" cx="'+point.x+'" cy="'+point.y+'" r="'+(compact?2.4:3.4)+'"></circle>').join('')+
    '</svg>'+
    (!compact?'<div class="progress-chart-axis"><span>'+esc(formatDate(series[0].date))+'</span><span>'+esc(formatDate(series[series.length-1].date))+'</span></div>':'')+
  '</div>';
}
function renderExerciseProgressDetail(summary){
  if(!summary)return '';
  const metric=progressMetric;
  const latestValue=progressMetricValue(summary.latest,metric);
  const firstValue=progressMetricValue(summary.first,metric);
  const delta=latestValue-firstValue;
  return '<section class="exercise-progress-detail">'+
    '<div class="exercise-progress-head"><div><p class="eyebrow">EXERCISE PROGRESS</p><h3>'+esc(summary.name)+'</h3><p>'+summary.sessions+' logged session'+(summary.sessions===1?'':'s')+' · '+(summary.status==='baseline'?'Baseline only':summary.status==='improved'?'Improved from baseline':'Holding steady')+'</p></div><button class="text-button" data-action="close-progress-exercise">CLOSE</button></div>'+
    '<div class="exercise-progress-kpis">'+
      '<div><span>CURRENT BEST</span><strong>'+esc(summary.bestLabel)+'</strong></div>'+
      '<div><span>STARTED AT</span><strong>'+esc(summary.baselineLabel)+'</strong></div>'+
      '<div><span>CHANGE</span><strong>'+esc(summary.changeLabel)+'</strong></div>'+
    '</div>'+
    '<div class="progress-metric-tabs" role="tablist" aria-label="Exercise progress metric">'+
      [['weight','Weight'],['reps','Reps'],['volume','Volume']].map(([value,label])=>'<button role="tab" aria-selected="'+(metric===value?'true':'false')+'" class="'+(metric===value?'active':'')+'" data-action="set-progress-metric" data-progress-metric="'+value+'">'+label+'</button>').join('')+
    '</div>'+
    '<div class="exercise-chart-wrap">'+
      '<div class="exercise-chart-heading"><span>'+esc(progressMetricLabel(metric))+'</span><strong>'+esc(formatProgressMetric(latestValue,metric,summary))+'</strong><small>'+((delta>0?'+':'')+(metric==='volume'?formatVolume(delta):Math.round(delta*10)/10)+(metric==='weight'?' lb':metric==='reps'?(summary.loadMode==='timed'?' sec':' reps'):'') )+' vs first session</small></div>'+
      renderProgressChart(summary,metric,false)+
    '</div>'+
    '<div class="exercise-session-timeline">'+summary.series.slice(-6).reverse().map((session,index)=>{
      const value=progressMetricValue(session,metric);
      return '<div class="exercise-session-row"><div><span>'+esc(formatDate(session.date))+'</span><strong>'+esc(session.routineName||'Workout')+'</strong></div><em>'+esc(formatProgressMetric(value,metric,summary))+'</em></div>';
    }).join('')+'</div>'+
    '<button class="button secondary progress-form-button" data-exercise-detail="'+esc(summary.exerciseId)+'">VIEW FORM & EXERCISE HISTORY</button>'+
  '</section>';
}
function workoutRecordClassification(workout){
  if(!workout)return {baselines:[],prs:[]};
  const workoutTime=Date.parse(workout.completedAt||'');
  const baselines=[],prs=[];
  for(const ex of workout.exercises||[]){
    const sets=(ex.sets||[]).filter(set=>set.completed);
    if(!sets.length)continue;
    let current=null;
    for(const set of sets){
      const candidate={weight:num(set.weight),reps:num(set.reps)};
      if(!current||candidate.weight>current.weight||(candidate.weight===current.weight&&candidate.reps>current.reps))current=candidate;
    }
    let before=null;
    for(const prior of store.history||[]){
      if(prior.id===workout.id)continue;
      const priorTime=Date.parse(prior.completedAt||'');
      if(Number.isFinite(workoutTime)&&Number.isFinite(priorTime)&&priorTime>=workoutTime)continue;
      const priorEx=(prior.exercises||[]).find(item=>item.id===ex.id);
      for(const set of priorEx?.sets||[]){
        if(!set.completed)continue;
        const candidate={weight:num(set.weight),reps:num(set.reps)};
        if(!before||candidate.weight>before.weight||(candidate.weight===before.weight&&candidate.reps>before.reps))before=candidate;
      }
    }
    const event={exerciseId:ex.id,name:ex.name,...current};
    if(!before)baselines.push(event);
    else if(current.weight>before.weight||(current.weight===before.weight&&current.reps>before.reps))prs.push(event);
  }
  return {baselines,prs};
}
function progressRecordEvents(){
  const events=[];
  for(const workout of store.history||[]){
    const classified=workoutRecordClassification(workout);
    for(const item of classified.baselines)events.push({type:'baseline',date:workout.completedAt,title:'Baseline established',...item});
    for(const item of classified.prs)events.push({type:'pr',date:workout.completedAt,title:'New personal record',...item});
  }
  return events.sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
}
function progressMoments(limit=6){
  return progressRecordEvents().slice(0,limit).map(item=>({
    ...item,
    value:item.weight?item.weight+' lb × '+item.reps:item.reps+' reps'
  }));
}
function renderProgress(){
  const week=weeklyHistory(),allVolume=store.history.reduce((sum,item)=>sum+(item.totalVolume||0),0),records=personalRecords(),calibrated=Object.keys(store.calibration).length;
  const trends=records.slice(0,6);
  const context=programContext(),schedule=currentWeekSchedule();
  const completed=schedule.filter(entry=>entry.status==='complete').length;
  const thisWeekVolume=week.reduce((sum,item)=>sum+(item.totalVolume||0),0);
  const recordEvents=progressRecordEvents();
  const truePRCount=recordEvents.filter(item=>item.type==='pr').length;
  const moments=recordEvents.slice(0,6).map(item=>({...item,value:item.weight?item.weight+' lb × '+item.reps:item.reps+' reps'}));
  if(progressExerciseId&&!records.some(item=>item.exerciseId===progressExerciseId))progressExerciseId='';
  const selected=(progressExerciseId?records.find(item=>item.exerciseId===progressExerciseId):null)||trends[0]||null;
  if(selected&&!progressExerciseId)progressExerciseId=selected.exerciseId;
  return '<div class="clean-page progress-clean"><div class="clean-page-head"><div><p class="eyebrow">PROGRESS</p><h2>Your training story.</h2><p>See what changed, where you started, and which movements are moving forward.</p></div><button class="button secondary" data-action="history">HISTORY</button></div>'+
    '<div class="progress-overview-grid progress-story-grid"><section class="clean-panel metric-panel"><span>CONSISTENCY</span><strong>'+completed+'/'+schedule.length+'</strong><small>planned workouts completed this week</small></section><section class="clean-panel metric-panel"><span>THIS WEEK</span><strong>'+formatVolume(thisWeekVolume)+'</strong><small>'+formatVolume(allVolume)+' total logged volume</small></section><section class="clean-panel metric-panel"><span>WORKOUTS</span><strong>'+store.history.length+'</strong><small>'+truePRCount+' true PR'+(truePRCount===1?'':'s')+' after baseline</small></section><section class="clean-panel metric-panel"><span>CURRENT BLOCK</span><strong>'+context.blockNumber+' · W'+context.blockWeek+'</strong><small>'+esc(blockPhaseLabel(context.blockWeek))+' · '+calibrated+' calibrated movements</small></section></div>'+
    (trends.length?'<section class="clean-section progress-movements-section"><div class="clean-section-head"><div><p class="eyebrow">MOVEMENT PROGRESS</p><h3>What is changing</h3></div></div><div class="progress-movement-grid">'+trends.map(item=>{
      const metric=item.weighted?'weight':'reps';
      return '<button class="progress-movement-card '+(selected?.exerciseId===item.exerciseId?'selected':'')+'" data-action="progress-exercise" data-progress-exercise="'+esc(item.exerciseId)+'"><div class="progress-movement-copy"><span>'+esc(item.status==='baseline'?'BASELINE':item.status==='improved'?'IMPROVED':'STEADY')+'</span><strong>'+esc(item.name)+'</strong><small>'+esc(item.changeLabel)+'</small></div>'+renderProgressChart(item,metric,true)+'</button>';
    }).join('')+'</div></section>':'')+
    (selected?renderExerciseProgressDetail(selected):'<div class="clean-empty-inline">Complete a workout to start an exercise trend.</div>')+
    (moments.length?'<section class="clean-section"><div class="clean-section-head"><div><p class="eyebrow">RECENT MOMENTS</p><h3>Baselines and records</h3></div></div><div class="progress-moment-list">'+moments.map(moment=>'<div class="progress-moment-row '+moment.type+'"><div><span>'+esc(moment.title)+'</span><strong>'+esc(moment.name)+'</strong><small>'+esc(formatDate(moment.date))+'</small></div><em>'+esc(moment.value)+'</em></div>').join('')+'</div></section>':'')+
    (()=>{const decision=getProgramDecisionExperience();return '<section class="clean-panel progress-engine-card human-learning-card"><div><span>WHAT GOWORKOUT IS LEARNING</span><strong>'+esc(decision.block.signal)+'</strong><p>'+esc(decision.block.decision)+'. '+esc(decision.block.next)+'</p></div><button class="text-button" data-action="train-program">SEE WHY</button></section>';})()+
  '</div>';
}

function renderSummary(){
  const x=store.history.find(h=>h.id===store.lastSummaryId)||store.history[0];if(!x)return renderHistory();
  const partial=x.completionStatus==='partial';
  const records=workoutRecordClassification(x);
  return '<div class="summary-hero clean-summary"><div class="summary-check">'+(partial?'◐':'✓')+'</div><p class="eyebrow">'+(partial?'PARTIAL WORKOUT SAVED':'WORKOUT COMPLETE')+'</p><h2>'+esc(x.routineName)+'</h2><p>'+(partial?'Your completed work is preserved. This scheduled session remains partial.':'History and progression were updated from what you actually logged.')+'</p><div class="summary-grid"><div class="summary-card"><strong>'+x.durationMinutes+'</strong><span>Minutes</span></div><div class="summary-card"><strong>'+x.completedSets+'</strong><span>Sets</span></div><div class="summary-card"><strong>'+formatVolume(x.totalVolume||0)+'</strong><span>Volume</span></div></div>'+
    (records.baselines.length?'<section class="clean-panel summary-prs baseline-summary"><p class="eyebrow">BASELINES ESTABLISHED</p><div class="pr-list">'+records.baselines.map(pr=>'<div class="pr-row"><span>'+esc(pr.name)+'</span><strong>'+(pr.weight?pr.weight+' lb × '+pr.reps:pr.reps+' reps')+'</strong></div>').join('')+'</div></section>':'')+
    (records.prs.length?'<section class="clean-panel summary-prs"><p class="eyebrow">NEW PERSONAL RECORDS</p><div class="pr-list">'+records.prs.map(pr=>'<div class="pr-row"><span>'+esc(pr.name)+'</span><strong>'+(pr.weight?pr.weight+' lb × '+pr.reps:pr.reps+' reps')+'</strong></div>').join('')+'</div></section>':'')+
    (x.engineLearning?(()=>{const learning=workoutLearningExperience(x.engineLearning);return '<section class="clean-panel workout-learning-card human-learning-card"><p class="eyebrow">WHAT GOWORKOUT LEARNED</p><h3>'+esc(learning.title)+'</h3><p>'+esc(learning.copy)+'</p><small>Your current block stays stable. Any block-level change begins with a future block, not in the workout you just finished.</small></section>';})():'')+
    ((x.trainingContext?.temporary||x.trainingContext?.adapted)?'<section class="clean-panel summary-training-context">'+renderTrainingContextSummary(x.trainingContext,false)+'</section>':'')+
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
  const pending=store.account?.status==='pending';
  const createMode=accountEntryMode==='create';
  const knownEmail=accountEntryEmail||store.account?.email||store.profile?.email||'';
  return '<div class="onboard-shell account-entry-shell">'+
    '<section class="account-entry-hero"><p class="eyebrow">WORKOUT</p><h1>Training that learns you.</h1><p>'+(createMode?'Create your account, then build your training profile.':'Sign in to continue your program on this device.')+'</p></section>'+
    (pending?'<div class="account-status-card"><span>EMAIL CONFIRMATION PENDING</span><strong>Check your inbox, then sign in here.</strong><p>Your setup on this browser stays intact while confirmation is pending.</p></div>':'')+
    '<section class="form-section account-entry-card"><div class="form-section-head"><span>01</span><div><h3>'+(createMode?'Create account':'Sign in')+'</h3><p>'+(createMode?'Your display name is used for your profile and shared workout identity.':'Use the email and password for your GoWorkout account.')+'</p></div></div>'+
      (createMode?'<label class="field"><span>DISPLAY NAME</span><input id="entry-display-name" autocomplete="name" value="'+esc(accountEntryDisplay||store.account?.displayName||store.profile?.displayName||'')+'" placeholder="How you want to appear"></label>':'')+
      '<label class="field"><span>EMAIL</span><input id="entry-email" type="email" autocomplete="email" value="'+esc(knownEmail)+'" placeholder="you@example.com"></label>'+
      '<label class="field"><span>PASSWORD</span><input id="entry-password" type="password" autocomplete="'+(createMode?'new-password':'current-password')+'" placeholder="'+(createMode?'At least 6 characters':'Your password')+'"></label>'+
      (accountEntryError?'<div class="auth-entry-error" role="alert">'+esc(accountEntryError)+'</div>':'')+
      (createMode?'<div class="auth-choice-grid"><button class="button" data-action="entry-create-account" '+(accountEntryBusy?'disabled':'')+'>'+(accountEntryBusy?'CREATING ACCOUNT…':'CREATE ACCOUNT')+'</button><button class="button secondary" data-action="entry-show-sign-in" '+(accountEntryBusy?'disabled':'')+'>BACK TO SIGN IN</button></div>':'<div class="auth-choice-grid"><button class="button" data-action="entry-sign-in" '+(accountEntryBusy?'disabled':'')+'>'+(accountEntryBusy?'SIGNING IN…':'SIGN IN')+'</button><button class="button secondary" data-action="entry-show-create" '+(accountEntryBusy?'disabled':'')+'>CREATE ACCOUNT</button></div>')+
      (pending&&!createMode?'<button class="text-button account-resend" data-action="entry-resend-confirmation">RESEND CONFIRMATION EMAIL</button>':'')+
    '</section>'+
    '<div class="profile-privacy-note"><strong>Private by default.</strong><span>Your readiness, body data, notes and full training history are not exposed to workout partners.</span></div>'+
  '</div>';
}

function render(){
  const app=document.querySelector('#app');if(!app)return;
  if(!authReady){app.innerHTML='<div class="clean-page empty-workout-page"><p class="eyebrow">WORKOUT</p><h2>Loading your training account…</h2></div>';return;}
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
  if(sessionSetupOpen) app.insertAdjacentHTML('beforeend',renderSessionSetupSheet());
  if(historyMenuId) app.insertAdjacentHTML('beforeend',renderHistoryMenuSheet());
  if(accountSheetOpen) app.insertAdjacentHTML('beforeend',renderAccountSheet());
  if(avatarPickerOpen) app.insertAdjacentHTML('beforeend',renderAvatarPickerSheet());
  document.body.classList.toggle('modal-open',Boolean(exerciseDetailId||swapContext||readinessContext||workoutMapOpen||setEditContext||cueSettingsOpen||exerciseActionsIndex!==null||sessionSetupOpen||historyMenuId||accountSheetOpen||avatarPickerOpen));
  document.body.classList.toggle('workout-mode',currentTab==='workout'&&Boolean(store.activeWorkout));
  syncNav();syncLiveBadge();syncShellIdentity();persistUiState();
  prefetchUpcomingWorkoutMedia();
}

function updateTimers(){
  const w=store.activeWorkout;
  if(!w)return;
  const nowMs=Date.now();

  const elapsed=document.querySelector('#elapsed-clock');
  const exerciseClock=document.querySelector('#exercise-clock');
  if(elapsed)elapsed.textContent=formatClock(workoutElapsedSeconds(w));
  const warmupElapsed=document.querySelector('#warmup-elapsed-clock');
  if(warmupElapsed&&w.phase==='warmup')warmupElapsed.textContent=formatClock(warmupElapsedSeconds(w));
  if(exerciseClock&&['work','rest','calibrate','feedback','pre-set','timed-set'].includes(w.phase))exerciseClock.textContent=formatClock(exerciseElapsedSeconds(w));
  if(w.isPaused)return;

  if(['warmup','cooldown'].includes(w.phase)){
    const snap=timedStageSnapshot(w);
    if(!snap)return;
    if(snap.mode==='reps')return;
    if(snap.itemComplete){advanceTimedStage();return;}
    if(snap.remaining>0&&snap.remaining<=3)fireWorkoutSignal('warning','stage-warning-'+w.id+'-'+w.phase+'-'+snap.index+'-'+snap.remaining,{voice:String(snap.remaining),label:String(snap.remaining)});
    const stageClock=document.querySelector('#stage-clock');
    const fill=document.querySelector('#stage-progress-fill');
    if(stageClock)stageClock.textContent=formatClock(snap.remaining);
    if(fill)fill.style.width=`${Math.max(0,Math.min(100,((snap.total-snap.remaining)/Math.max(1,snap.total))*100))}%`;
    return;
  }

  if(w.phase==='pre-set')return;

  if(w.phase==='work'){
    const setClock=document.querySelector('#set-clock');
    if(setClock)setClock.textContent=formatClock(setElapsedSeconds(w));
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
  if(remaining<=0&&!Number.isFinite(w.restPausedRemaining))advanceAfterRest(w.restToken);
}

function handleClick(event){
  const avatarClose=event.target.closest('[data-action="close-avatar-picker"]');
  if(avatarClose){
    const inside=event.target.closest('[data-avatar-picker-panel]');
    const explicit=event.target.closest('.modal-close');
    if(!inside||explicit){avatarPickerOpen=false;render();return;}
  }
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
  const sessionSetupClose=event.target.closest('[data-action="close-session-setup"]');
  if(sessionSetupClose){
    const inside=event.target.closest('[data-session-setup-panel]');
    const explicit=event.target.closest('.modal-close');
    if(!inside||explicit){sessionSetupOpen=false;render();return;}
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
  const detail=event.target.closest('[data-exercise-detail]');
  if(detail){exerciseActionsIndex=null;exerciseDetailId=detail.dataset.exerciseDetail;render();return;}
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
  const allowedWhilePaused=['toggle-workout-pause','home','go-home','finish','discard','toggle-sound','toggle-voice','toggle-flash','toggle-haptics','test-cues','open-workout-map','close-workout-map','set-workout-map-view','edit-set','close-set-editor','open-cue-settings','close-cue-settings','open-exercise-actions','close-exercise-actions','open-session-setup','close-session-setup','apply-session-setup'];
  if(store.activeWorkout?.isPaused&&!allowedWhilePaused.includes(a)){
    toast('Resume the workout before changing the active set or timer.');
    return;
  }
  if(a==='go-home'||a==='home')setTab('home');
  else if(a==='train-anywhere-home')openReadiness(node.dataset.dayId,node.dataset.scheduledDate||'','bodyweight');
  else if(a==='open-session-setup'){exerciseActionsIndex=null;sessionSetupOpen=true;render();}
  else if(a==='apply-session-setup'){
    const form=document.querySelector('#session-setup-form');
    const setup=sessionSetupFromForm(form,store.activeWorkout?.trainingContext?.key||normalSessionSetupKey());
    const result=applySetupToActiveWorkout(setup);
    if(result.blocked){toast('That setup has no usable exercises for this session. Choose another setup or add available equipment.');return;}
    sessionSetupOpen=false;
    saveStore();
    render();
    toast(result.changed+' movement'+(result.changed===1?'':'s')+' adapted'+(result.unavailable?' · '+result.unavailable+' unavailable':'')+'.');
  }
  else if(a==='toggle-program-why'){programWhyOpen=!programWhyOpen;persistUiState();render();}
  else if(a==='train-program'){trainView='program';programWhyOpen=true;persistUiState();setTab('train');}
  else if(a==='set-train-view'){trainView=['week','program','exercises'].includes(node.dataset.trainView)?node.dataset.trainView:'week';persistUiState();render();}
  else if(a==='toggle-train-week'){const offset=Number(node.dataset.weekOffset);trainExpandedWeek=trainExpandedWeek===offset?0:offset;persistUiState();render();}
  else if(a==='train')setTab('train');
  else if(a==='together')setTab('together');
  else if(a==='progress')setTab('progress');
  else if(a==='progress-exercise'){
    progressExerciseId=node.dataset.progressExercise||'';
    const source=catalog.find(item=>item.id===progressExerciseId);
    progressMetric=['bodyweight','timed','band'].includes(source?.loadMode)?'reps':'weight';
    persistUiState();render();
  }
  else if(a==='set-progress-metric'){progressMetric=['weight','reps','volume'].includes(node.dataset.progressMetric)?node.dataset.progressMetric:'weight';persistUiState();render();}
  else if(a==='close-progress-exercise'){progressExerciseId='';persistUiState();render();}
  else if(a==='profile')setTab('profile');
  else if(a==='open-avatar-picker'){avatarPickerOpen=true;render();}
  else if(a==='close-avatar-picker'){avatarPickerOpen=false;render();}
  else if(a==='choose-avatar'){
    const id=String(node.dataset.avatarId||'');
    if(!TRAINING_AVATARS.some(item=>item.id===id)){toast('That avatar is not available.');return;}
    store.profile={...(store.profile||{}),visualAvatarId:id};
    saveStore();avatarPickerOpen=false;render();toast('Training avatar updated.');
  }
  else if(a==='catalog'||a==='open-routine-details')setTab('catalog');
  else if(a==='history')setTab('history');
  else if(a==='share-next-workout')setTab('together');
  else if(a==='create-shared-draft')createSharedDraft();
  else if(a==='join-shared-session')joinSharedSession();
  else if(a==='cancel-shared-draft')cancelSharedDraft();
  else if(a==='start-shared-workout')startSharedWorkout();
  else if(a==='copy-shared-code')copySharedCode();
  else if(a==='account-info'){accountSheetOpen=true;render();}
  else if(a==='entry-show-create'){accountEntryError='';accountEntryMode='create';render();}
  else if(a==='entry-show-sign-in'){accountEntryError='';accountEntryMode='sign-in';render();}
  else if(a==='entry-sign-in')signInEntryAccount();
  else if(a==='entry-create-account')createEntryAccount();
  else if(a==='entry-resend-confirmation')resendEntryConfirmation();
  else if(a==='account-sign-in')signInWorkoutAccount();
  else if(a==='account-create')createWorkoutAccount();
  else if(a==='onboard-create-account')createOnboardingAccount();
  else if(a==='account-resend-confirmation')resendWorkoutConfirmation();
  else if(a==='account-sign-out')signOutWorkoutAccount();
  else if(a==='open-cue-settings'){cueSettingsOpen=true;render();}
  else if(a==='open-exercise-actions'){exerciseActionsIndex=Number(node.dataset.exerciseIndex);render();}
  else if(a==='open-history-menu'||a==='history-details'){historyMenuId=node.dataset.historyId;render();}
  else if(a==='set-history-filter'){historyFilter=node.dataset.historyFilter||'all';render();}
  else if(a==='resume'){unlockWorkoutCues();setTab('workout');}
  else if(a==='edit-profile')editProfile();
  else if(a==='build-plan')saveProfileFromForm(document.querySelector('#profile-form'));
  else if(a==='skip-scheduled')skipScheduledSession(node.dataset.scheduledDate);
  else if(a==='undo-skip-scheduled')undoSkipScheduledSession(node.dataset.scheduledDate);
  else if(a==='mark-scheduled-complete')markScheduledWorkoutComplete(node.dataset.dayId,node.dataset.scheduledDate);
  else if(a==='remove-history'){historyMenuId=null;removeHistoryWorkout(node.dataset.historyId);}
  else if(a==='begin-workout')startPreparedWorkout();
  else if(a==='begin-session')beginWorkoutSession();
  else if(a==='start-warmup')startWarmupRoutine();
  else if(a==='start-strength')startStrengthWork();
  else if(a==='warmup-rep')addWarmupRep();
  else if(a==='warmup-rep-minus')removeWarmupRep();
  else if(a==='set-workout-map-view'){workoutMapView=['warmup','strength','cooldown'].includes(node.dataset.mapView)?node.dataset.mapView:'strength';render();}
  else if(a==='open-workout-map'){workoutMapView=['warmup-routine','warmup'].includes(store.activeWorkout?.phase)?'warmup':store.activeWorkout?.phase==='cooldown'?'cooldown':'strength';workoutMapOpen=true;render();}
  else if(a==='previous-exercise')navigateExercise(-1);
  else if(a==='next-exercise')navigateExercise(1);
  else if(a==='jump-exercise')navigateToExercise(Number(node.dataset.exerciseIndex));
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
  else if(a==='discard-recovered')discardRecoveredWorkout(false);
  else if(a==='discard-and-new')discardRecoveredWorkout(true);
  else if(a==='skip-current-set')skipCurrentSet();
  else if(a==='adjust-set-target')adjustSetTarget(node.dataset.targetType,Number(node.dataset.targetDelta)||0);
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
  const img=event.target.closest?.('img');
  if(!img)return;
  const fallback=img.dataset.fallbackSrc;
  if(fallback&&img.src!==fallback&&!img.dataset.fallbackAttempted){
    img.dataset.fallbackAttempted='1';
    img.src=fallback;
    return;
  }
  const media=img.closest('.exercise-media, .exercise-modal-media');
  if(media){
    img.remove();
    if(!media.querySelector('img')){
      media.classList.add('image-unavailable');
      const detail=media.closest('[data-exercise-detail]')||media;
      if(!media.querySelector('.media-load-failed')){
        media.insertAdjacentHTML('beforeend','<span class="media-load-failed">IMAGE UNAVAILABLE · VIEW FORM</span>');
      }
    }
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
  if(event.key==='Enter'&&store.account?.status!=='connected'&&document.activeElement?.matches?.('#entry-email,#entry-password,#entry-display-name')){event.preventDefault();if(accountEntryMode==='create')createEntryAccount();else signInEntryAccount();return;}
  if(event.key==='Escape'&&accountSheetOpen){accountSheetOpen=false;render();return;}
  if(event.key==='Escape'&&avatarPickerOpen){avatarPickerOpen=false;render();return;}
  if(event.key==='Escape'&&sessionSetupOpen){sessionSetupOpen=false;render();return;}
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
  if(document.visibilityState==='visible') updateTimers();
});
window.addEventListener('pageshow',event=>{
  if(event.persisted){
    window.location.reload();
  }
});
window.addEventListener('beforeunload',()=>{
  persistUiState();
  if(tickHandle)clearInterval(tickHandle);
  try{sharedRuntime.channel?.untrack();}catch{}
});
render();
updateTimers();
initWorkoutAuth();
if(clearedLegacyActiveWorkout){
  setTimeout(()=>toast('Previous test session cleared so this build can start with clean timer state.'),100);
}
