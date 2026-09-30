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
let trainPreviewContext = null;
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
let historyStatusFilter = 'all';
let historyView = 'list';
let historySearch = '';
let historyCalendarOffset = 0;
let historyRoutineFilter = 'all';
let historyMuscleFilter = 'all';
let historySetupFilter = 'all';
let historyLastRemoved = null;

const defaultStore = {
  profile: null,
  plan: null,
  history: [],
  activeWorkout: null,
  calibration: {},
  progression: {},
  progressionLog: [],
  exercisePreferences: {excluded:[],swapHistory:[]},
  trainingProgram: {scheduleOverrides:{},weekReviews:{},engine:null,learner:null},
  cueSettings: {sound:true,voice:true,aiCoach:true,coachPreset:'guide',coachStyle:'balanced',coachVibe:'warm-familiar',coachFrequency:'normal',coachDetail:'short',coachVoice:'cedar',talkSpeed:'normal',nameUsage:'occasional',formCues:'basic',performanceFeedback:'session',motivation:'moderate',countdownMode:'full',warmupGuidance:'guided',cooldownGuidance:'guided',nextSetPreview:'target',exerciseInstruction:'quick',autoStartWarmup:true,autoStartCooldown:true,autoStartTimedExercise:true,adaptiveCoach:true,haptics:true,flash:true},
  account: {displayName:'',email:'',authProvider:'',status:'local',userId:''},
  sharedTraining: {partners:[],draft:null,history:[]},
  lastSummaryId: null
};

const RESUMABLE_WORKOUT_PHASES=new Set(['intro','warmup-routine','warmup','warmup-complete','pre-set','work','timed-set','side-switch','rest','calibrate','feedback','exercise-transition','exercise-review','cooldown','review']);

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
function formatTimeStamp(iso){
  const value=Date.parse(iso||'');
  if(!Number.isFinite(value))return '';
  return new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit'}).format(new Date(value));
}
function formatTimeRange(start,end){
  const left=formatTimeStamp(start),right=formatTimeStamp(end);
  return left&&right?left+' – '+right:left||right||'';
}
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
function trainingLearnerEngine(){return window.GoWorkoutLearner||null;}
function ensureTrainingLearner({backfill=true}={}){
  const training=ensureTrainingProgram(),engine=trainingLearnerEngine();
  if(!engine)return null;
  training.learner=engine.normalizeLearner(training.learner);
  if(backfill){
    const processed=new Set(training.learner.processedWorkoutIds||[]);
    const pending=[...(store.history||[])].filter(item=>item?.id&&!processed.has(item.id)).sort((a,b)=>Date.parse(a.completedAt||0)-Date.parse(b.completedAt||0));
    for(const workout of pending){
      const result=engine.recordWorkout(training.learner,workout);
      training.learner=result.learner;
    }
    if(pending.length){
      try{localStorage.setItem(STORAGE_KEY,JSON.stringify(store));}catch{}
      scheduleCloudStateSync();
    }
  }
  return training.learner;
}
function trainingLearnerOverview(){
  const engine=trainingLearnerEngine(),learner=ensureTrainingLearner();
  return engine&&learner?engine.overview(learner):{modeledExercises:0,highConfidence:0,mediumConfidence:0,lowConfidence:0,predictionsEvaluated:0,predictionHitRate:null,events:0,version:''};
}
function trainingLearnerModel(exerciseId){
  const learner=ensureTrainingLearner();
  return learner?.models?.[exerciseId]||null;
}
function registerWorkoutLearningPredictions(workout){
  const engine=trainingLearnerEngine(),learner=ensureTrainingLearner();
  if(!engine||!learner||!workout?.id)return [];
  const context={workoutId:workout.id,createdAt:workout.preparedAt||new Date().toISOString(),scheduledDate:workout.scheduledDate||'',routineName:workout.routineName||''};
  const predictions=(workout.exercises||[]).map(ex=>engine.predictionForExercise(ex,learner.models?.[ex.id]||null,context));
  workout.learningPredictions=clone(predictions);
  ensureTrainingProgram().learner=engine.addPredictions(learner,predictions);
  return predictions;
}
function ingestLearnerWorkout(entry){
  const engine=trainingLearnerEngine(),learner=ensureTrainingLearner();
  if(!engine||!learner||!entry?.id)return null;
  const result=engine.recordWorkout(learner,entry);
  ensureTrainingProgram().learner=result.learner;
  return result.summary;
}
function learnerConfidenceLabel(model){
  const confidence=model?.confidence;
  if(!confidence)return 'LOW';
  return String(confidence.level||'low').toUpperCase();
}
function learnerNextTarget(exerciseId){
  const learned=store.progression?.[exerciseId];
  if(!learned)return '';
  if(learned.label)return learned.label;
  const ex=catalog.find(item=>item.id===exerciseId);
  if(!ex)return '';
  const weight=Number.isFinite(Number(learned.weight))?num(learned.weight):0;
  const reps=learned.reps||'';
  if(ex.loadMode==='timed')return reps?reps+' sec':'';
  if(ex.loadMode==='bodyweight')return reps?'Bodyweight × '+reps:'';
  if(ex.loadMode==='band')return learned.reason?'Same band unless feedback changes':'';
  if(ex.loadMode==='dumbbell-pair')return weight?(weight+' lb each'+(reps?' × '+reps:'')):'';
  return weight?(weight+' lb'+(reps?' × '+reps:'')):(reps?reps+' reps':'');
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
  if(['complete','completed-manually','skipped'].includes(exerciseState(ex)))return true;
  const sets=ex?.sets||[];
  return Boolean(sets.length&&sets.every(setIsResolved));
}
function workoutResolvedCount(w){
  return (w?.exercises||[]).filter(exerciseCountsAsResolved).length;
}
function workoutIsFullyResolved(w){
  return Boolean(w?.exercises?.length)&&w.exercises.every(exerciseCountsAsResolved);
}
function setIsResolved(set){
  return Boolean(set?.completed||set?.skipped);
}
function firstIncompleteSetIndex(ex){
  const index=(ex?.sets||[]).findIndex(set=>!setIsResolved(set));
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
    if(snap&&!snap.complete)w.reviewPausedTimedStage={phase:w.phase,index:snap.index,mode:snap.mode,side:snap.side||'',remainingExact:snap.remainingExact,total:snap.total,completedReps:snap.completedReps||0};
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
  if(w.phase==='side-switch'&&!Number.isFinite(w.sideSwitchPausedRemaining))w.sideSwitchPausedRemaining=sideSwitchRemaining(w);

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
  if(!ex)return Promise.resolve();
  const target=(ex.sets?.length||0)+' sets of '+String(ex.reps||ex.suggestedReps||'your target');
  const equipment=equipmentRequirement(exerciseSource(ex));
  const exerciseIndex=store.activeWorkout?.currentExerciseIndex||0;
  const token='exercise-announce-'+(store.activeWorkout?.id||'')+'-'+exerciseIndex+'-'+ex.id;
  const settings=workoutCueSettings();
  const extra=coachExerciseExtra(ex,exerciseIndex);
  const key=coachPrefetchKey('exercise_started',extra,settings);
  fireWorkoutSignal('transition',token,{voice:'',label:'NEXT'});
  const prepared=cueRuntime.coachPrefetchCache.get(key);
  if(prepared?.audioBase64){
    cueRuntime.coachPrefetchCache.delete(key);
    return window.GoWorkoutCoach?.playClip?.(prepared.audioBase64,prepared.mimeType||'audio/wav')||Promise.resolve();
  }
  return emitWorkoutCoach('exercise_started',extra,prefix+': '+ex.name+'. '+target+'. You will need '+equipment+'.','coach-'+token);
}
let workoutAudioContext=null;
const cueRuntime={lastToken:'',lastVoiceToken:'',lastVisualToken:'',visualTimer:null,lastCoachConfigNoticeAt:0,coachCuePack:null,coachCuePackKey:'',coachCuePackPromise:null,coachPrefetchCache:new Map(),coachPrefetchPending:new Map(),coachTimelineTokens:new Map(),coachTimelineEpoch:0,lastCoachLine:'',lastCoachAudio:null,lastCoachMime:'audio/wav',recentSignalTokens:new Map()};

const COACH_VOICES=[
  {id:'marin',label:'Marin',recommended:true},
  {id:'cedar',label:'Cedar',recommended:true},
  {id:'alloy',label:'Alloy'},
  {id:'ash',label:'Ash'},
  {id:'ballad',label:'Ballad'},
  {id:'coral',label:'Coral'},
  {id:'echo',label:'Echo'},
  {id:'fable',label:'Fable'},
  {id:'nova',label:'Nova'},
  {id:'onyx',label:'Onyx'},
  {id:'sage',label:'Sage'},
  {id:'shimmer',label:'Shimmer'},
  {id:'verse',label:'Verse'}
];
const COACH_VOICE_IDS=COACH_VOICES.map(item=>item.id);
const COACH_PRESETS={
  guide:{label:'Just Guide Me',coachStyle:'balanced',coachVibe:'warm-familiar',coachFrequency:'normal',coachDetail:'short',talkSpeed:'normal',nameUsage:'occasional',formCues:'basic',performanceFeedback:'session',motivation:'moderate',countdownMode:'full',warmupGuidance:'guided',cooldownGuidance:'guided',nextSetPreview:'target',exerciseInstruction:'quick',autoStartWarmup:true,autoStartCooldown:true,autoStartTimedExercise:true,adaptiveCoach:true},
  hype:{label:'Hype Me Up',coachStyle:'energetic',coachVibe:'gym-partner',coachFrequency:'high',coachDetail:'standard',talkSpeed:'fast',nameUsage:'often',formCues:'basic',performanceFeedback:'history',motivation:'high',countdownMode:'full',warmupGuidance:'guided',cooldownGuidance:'guided',nextSetPreview:'full',exerciseInstruction:'quick',autoStartWarmup:true,autoStartCooldown:true,autoStartTimedExercise:true,adaptiveCoach:true},
  coach:{label:'Coach Me',coachStyle:'technical',coachVibe:'warm-familiar',coachFrequency:'normal',coachDetail:'detailed',talkSpeed:'normal',nameUsage:'occasional',formCues:'detailed',performanceFeedback:'history',motivation:'moderate',countdownMode:'full',warmupGuidance:'detailed',cooldownGuidance:'guided',nextSetPreview:'full',exerciseInstruction:'detailed',autoStartWarmup:true,autoStartCooldown:true,autoStartTimedExercise:true,adaptiveCoach:true},
  quiet:{label:'Keep It Quiet',coachStyle:'direct',coachVibe:'neutral',coachFrequency:'minimal',coachDetail:'short',talkSpeed:'normal',nameUsage:'never',formCues:'off',performanceFeedback:'off',motivation:'low',countdownMode:'compact',warmupGuidance:'simple',cooldownGuidance:'simple',nextSetPreview:'exercise',exerciseInstruction:'off',autoStartWarmup:true,autoStartCooldown:true,autoStartTimedExercise:true,adaptiveCoach:false},
  recovery:{label:'Recovery',coachStyle:'calm',coachVibe:'soulful',coachFrequency:'normal',coachDetail:'standard',talkSpeed:'slow',nameUsage:'occasional',formCues:'basic',performanceFeedback:'session',motivation:'low',countdownMode:'full',warmupGuidance:'detailed',cooldownGuidance:'detailed',nextSetPreview:'target',exerciseInstruction:'quick',autoStartWarmup:false,autoStartCooldown:false,autoStartTimedExercise:false,adaptiveCoach:true}
};
const COACH_SETTING_VALUES={
  coachStyle:['balanced','direct','supportive','energetic','calm','technical'],
  coachVibe:['warm-familiar','gym-partner','southern-warmth','east-coast-direct','west-coast-smooth','soulful','neutral'],
  coachFrequency:['minimal','normal','high'],
  coachDetail:['short','standard','detailed'],
  talkSpeed:['slow','normal','fast'],
  nameUsage:['never','occasional','often'],
  formCues:['off','basic','detailed'],
  performanceFeedback:['off','session','history'],
  motivation:['low','moderate','high'],
  countdownMode:['full','compact','beep','off'],
  warmupGuidance:['simple','guided','detailed'],
  cooldownGuidance:['simple','guided','detailed'],
  nextSetPreview:['off','exercise','target','full'],
  exerciseInstruction:['off','quick','detailed']
};
const COACH_SETTING_LABELS={
  coachStyle:{balanced:'Balanced',direct:'Direct',supportive:'Supportive',energetic:'Energetic',calm:'Calm',technical:'Technical'},
  coachVibe:{'warm-familiar':'Warm & Familiar','gym-partner':'Gym Partner','southern-warmth':'Southern Warmth','east-coast-direct':'East Coast Direct','west-coast-smooth':'West Coast Smooth',soulful:'Soulful',neutral:'Neutral'},
  coachFrequency:{minimal:'Minimal',normal:'Normal',high:'High'},
  coachDetail:{short:'Short',standard:'Standard',detailed:'Detailed'},
  talkSpeed:{slow:'Slow',normal:'Normal',fast:'Fast'},
  nameUsage:{never:'Never',occasional:'Occasionally',often:'Often'},
  formCues:{off:'Off',basic:'Basic',detailed:'Detailed'},
  performanceFeedback:{off:'Off',session:'This session',history:'Workout history'},
  motivation:{low:'Low',moderate:'Moderate',high:'High'},
  countdownMode:{full:'Full voice',compact:'Compact voice',beep:'Beep + Go',off:'Off'},
  warmupGuidance:{simple:'Simple',guided:'Guided',detailed:'Detailed'},
  cooldownGuidance:{simple:'Simple',guided:'Guided',detailed:'Detailed'},
  nextSetPreview:{off:'Off',exercise:'Exercise only',target:'Exercise + target',full:'Full preview'},
  exerciseInstruction:{off:'Off',quick:'Quick cue',detailed:'Detailed'}
};
function coachVoiceLabel(id){
  return COACH_VOICES.find(item=>item.id===id)?.label||'Cedar';
}
function normalizeCoachSetting(key,value,fallback){
  const values=COACH_SETTING_VALUES[key]||[];
  return values.includes(value)?value:fallback;
}
function workoutCueSettings(){
  const saved=store.cueSettings||{};
  const legacyStyle=saved.coachStyle==='hype'?'energetic':saved.coachStyle==='tough'?'direct':saved.coachStyle;
  const legacyFrequency=saved.coachFrequency==='talkative'?'high':saved.coachFrequency;
  return {
    sound:saved.sound!==false,
    voice:saved.voice!==false,
    aiCoach:saved.aiCoach!==false,
    coachPreset:COACH_PRESETS[saved.coachPreset]?saved.coachPreset:(saved.coachPreset==='custom'?'custom':'guide'),
    coachStyle:normalizeCoachSetting('coachStyle',legacyStyle,'balanced'),
    coachVibe:normalizeCoachSetting('coachVibe',saved.coachVibe,'warm-familiar'),
    coachFrequency:normalizeCoachSetting('coachFrequency',legacyFrequency,'normal'),
    coachDetail:normalizeCoachSetting('coachDetail',saved.coachDetail,'short'),
    coachVoice:COACH_VOICE_IDS.includes(saved.coachVoice)?saved.coachVoice:'cedar',
    talkSpeed:normalizeCoachSetting('talkSpeed',saved.talkSpeed,'normal'),
    nameUsage:normalizeCoachSetting('nameUsage',saved.nameUsage,'occasional'),
    formCues:normalizeCoachSetting('formCues',saved.formCues,'basic'),
    performanceFeedback:normalizeCoachSetting('performanceFeedback',saved.performanceFeedback,'session'),
    motivation:normalizeCoachSetting('motivation',saved.motivation,'moderate'),
    countdownMode:normalizeCoachSetting('countdownMode',saved.countdownMode,'full'),
    warmupGuidance:normalizeCoachSetting('warmupGuidance',saved.warmupGuidance,'guided'),
    cooldownGuidance:normalizeCoachSetting('cooldownGuidance',saved.cooldownGuidance,'guided'),
    nextSetPreview:normalizeCoachSetting('nextSetPreview',saved.nextSetPreview,'target'),
    exerciseInstruction:normalizeCoachSetting('exerciseInstruction',saved.exerciseInstruction,'quick'),
    autoStartWarmup:saved.autoStartWarmup!==false,
    autoStartCooldown:saved.autoStartCooldown!==false,
    autoStartTimedExercise:saved.autoStartTimedExercise!==false,
    adaptiveCoach:saved.adaptiveCoach!==false,
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
  window.GoWorkoutCoach?.unlock?.();
  const settings=workoutCueSettings();
  if(settings.voice&&!settings.aiCoach&&'speechSynthesis' in window){
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

function coachEventAllowed(event,frequency){
  const required=new Set(['test','session_started','warmup_started','stretch_started','warmup_completed','exercise_started','cooldown_started','cooldown_completed','workout_completed','timeline_cue']);
  if(required.has(event))return true;
  if(frequency==='minimal')return event==='exercise_feedback';
  if(frequency==='normal')return event!=='set_completed';
  return true;
}
function coachShouldUseName(event,settings,extra={}){
  if(settings.nameUsage==='never')return false;
  if(event==='test'||event==='session_started'||event==='workout_completed')return true;
  if(settings.nameUsage!=='often')return false;
  if(['warmup_started','warmup_completed','cooldown_started'].includes(event))return true;
  if(event==='exercise_started'){
    const index=Number(extra.exerciseIndex??store.activeWorkout?.currentExerciseIndex??0);
    return index===0||index%2===1;
  }
  return event==='exercise_feedback';
}
function coachEventContext(event,settings,extra={}){
  const pos=getActivePosition();
  const ex=pos?.exercise;
  const set=pos?.set;
  return {
    name:coachShouldUseName(event,settings,extra)?displayName():'',
    goal:store.profile?.goal||'',
    routineName:store.activeWorkout?.routineName||'',
    phase:store.activeWorkout?.phase||'',
    readiness:store.activeWorkout?.readiness||null,
    exercise:ex?{
      name:ex.name,
      setNumber:(pos.si||0)+1,
      totalSets:ex.sets?.length||0,
      weight:String(set?.weight||ex.suggestedWeight||''),
      reps:String(set?.reps||ex.suggestedReps||''),
      target:currentPrescriptionLabel(ex),
      loadMode:ex.loadMode||''
    }:undefined,
    ...extra
  };
}
async function invokeWorkoutCoach(payload){
  if(!workoutSupabase||store.account?.status!=='connected')throw new Error('AI coach requires a connected workout account');
  const {data,error}=await workoutSupabase.functions.invoke('workout-coach',{body:payload});
  if(error){
    let detail=null;
    try{detail=await error.context?.json?.();}catch{}
    const coachError=new Error(String(detail?.error||error.message||'AI coach request failed'));
    if(detail?.code)coachError.code=String(detail.code);
    throw coachError;
  }
  if(data?.error){
    const coachError=new Error(String(data.error));
    if(data?.code)coachError.code=String(data.code);
    throw coachError;
  }
  return data||{};
}
function emitWorkoutCoach(event,extra={},fallbackLine='',token=''){
  const settings=workoutCueSettings();
  if(!settings.voice)return Promise.resolve();
  if(event==='exercise_feedback'&&settings.performanceFeedback==='off')return Promise.resolve();
  if(!settings.aiCoach){
    if(fallbackLine)speakWorkoutCue(fallbackLine,'classic-'+token);
    return Promise.resolve();
  }
  if(!coachEventAllowed(event,settings.coachFrequency))return Promise.resolve();
  const coach=window.GoWorkoutCoach;
  if(!coach?.emit){
    console.warn('AI coach engine is unavailable');
    return Promise.resolve();
  }
  return coach.emit({
    event,
    context:coachEventContext(event,settings,extra),
    token,
    settings,
    invoke:invokeWorkoutCoach,
    fallbackSpeak:speakWorkoutCue,
    fallbackLine,
    onLine:(line,data)=>rememberCoachCue(line,data),
    onError:error=>{
      if(error?.code==='ai_not_configured'||error?.code==='ai_quota_exhausted'){
        const now=Date.now();
        if(!cueRuntime.lastCoachConfigNoticeAt||now-cueRuntime.lastCoachConfigNoticeAt>15000){
          cueRuntime.lastCoachConfigNoticeAt=now;
          toast(error.code==='ai_quota_exhausted'
            ?'AI voice is connected, but the OpenAI API account has no credits remaining.'
            :'AI voice needs an OpenAI API key in Workout App Supabase.');
        }
      }
    },
    onPlaybackError:()=>toast('AI coach audio arrived, but iPhone blocked playback. Tap AI Coach & cues, then Preview once to unlock audio.')
  }).catch(error=>console.warn('Workout coach event failed',error));
}
function selectCoachVoice(voice){
  if(!COACH_VOICE_IDS.includes(voice))return;
  store.cueSettings={...workoutCueSettings(),coachVoice:voice,coachPreset:'custom'};
  clearCoachCuePack();
  saveStore();
  unlockWorkoutCues();
  primeCoachCuePack();
  render();
}
function previewCoachVoice(voice){
  if(!COACH_VOICE_IDS.includes(voice))return;
  const coach=window.GoWorkoutCoach;
  const settings={...workoutCueSettings(),voice:true,aiCoach:true,coachVoice:voice};
  const name=displayName()==='there'?'':displayName();
  const fallback='Alright'+(name?' '+name:'')+'. '+coachVoiceLabel(voice)+' is ready. Three, two, one, go.';
  if(!coach?.emit){
    toast('AI voice playback is unavailable. Reload GoWorkout and try again.');
    return;
  }
  coach.stop?.();
  unlockWorkoutCues();
  coach.emit({
    event:'test',
    context:coachEventContext('test',settings,{previewVoice:voice}),
    token:'voice-preview-'+voice+'-'+Date.now(),
    settings,
    invoke:invokeWorkoutCoach,
    fallbackSpeak:speakWorkoutCue,
    fallbackLine:fallback,
    onError:error=>toast(error?.code==='ai_quota_exhausted'
      ?'AI voice is connected, but the OpenAI API account has no credits remaining.'
      :(error?.code==='ai_not_configured'?'AI voice needs an OpenAI API key in Workout App Supabase.':(error?.message||'Voice preview failed.'))),
    onPlaybackError:()=>toast('AI voice arrived, but iPhone blocked audio playback. Tap Preview again.')
  }).catch(error=>console.warn('Voice preview failed',error));
}
function feedbackCoachFallback(feedback,result){
  if(feedback==='too-easy')return result?.label?'Looks like I’m taking it easy on you. '+result.label+' next time.':'Looks like I’m taking it easy on you. We’ll bump this up next time.';
  if(feedback==='too-hard')return 'That was too much today. We’ll back the next target down.';
  if(feedback==='hard')return 'That made you work. We’ll keep the next target controlled.';
  if(feedback==='form-off')return 'Keep the target steady. Clean reps come first.';
  return 'That target looks right. We’ll build from there.';
}
function pulseLocalCountdown(label=''){
  const target=document.querySelector('#preset-count, #preset-countdown, #timed-set-clock, #rest-clock, #stage-clock, #side-switch-clock');
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
  if(token){
    const now=Date.now();
    const lastAt=cueRuntime.recentSignalTokens.get(token)||0;
    if(now-lastAt<1500)return Promise.resolve(false);
    cueRuntime.recentSignalTokens.set(token,now);
    if(cueRuntime.recentSignalTokens.size>160){
      const oldest=cueRuntime.recentSignalTokens.keys().next().value;
      cueRuntime.recentSignalTokens.delete(oldest);
    }
  }
  playWorkoutCue(type,token);
  const settings=workoutCueSettings();
  let voicePromise=Promise.resolve(false);
  if(voice){
    if(settings.aiCoach)voicePromise=playCoachFunctionalCue(voice);
    else speakWorkoutCue(voice,'voice-'+token);
  }
  const numericCue=/^\d+$/.test(String(label||''));
  if(type==='tick'||(type==='warning'&&numericCue))pulseLocalCountdown(label);
  else triggerVisualCue(type,label,'visual-'+token);
  return voicePromise;
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
function clearCoachCuePack(){
  cueRuntime.coachCuePack=null;
  cueRuntime.coachCuePackKey='';
  cueRuntime.coachCuePackPromise=null;
  cueRuntime.coachPrefetchCache.clear();
  cueRuntime.coachPrefetchPending.clear();
}
function coachCuePackCacheKey(settings=workoutCueSettings()){
  return [settings.coachVoice,settings.coachStyle,settings.coachVibe,settings.talkSpeed].join('|');
}
function coachPayloadSettings(settings=workoutCueSettings()){
  return {
    style:settings.coachStyle,
    vibe:settings.coachVibe,
    frequency:settings.coachFrequency,
    voice:settings.coachVoice,
    detail:settings.coachDetail,
    talkSpeed:settings.talkSpeed,
    nameUsage:settings.nameUsage,
    formCues:settings.formCues,
    performanceFeedback:settings.performanceFeedback,
    motivation:settings.motivation,
    countdownMode:settings.countdownMode,
    warmupGuidance:settings.warmupGuidance,
    cooldownGuidance:settings.cooldownGuidance,
    adaptiveCoach:settings.adaptiveCoach
  };
}
function coachPrefetchKey(event,extra={},settings=workoutCueSettings()){
  const exercise=extra?.exercise||{};
  const stage=extra?.stage||{};
  return [
    event,
    store.activeWorkout?.id||'',
    extra?.exerciseIndex??'',
    exercise.id||exercise.name||'',
    stage.phase||'',
    stage.index??'',
    stage.name||'',
    extra?.timelineKey||'',
    extra?.line||'',
    settings.coachVoice,
    settings.coachStyle,
    settings.coachVibe,
    settings.coachDetail,
    settings.talkSpeed,
    settings.nameUsage
  ].join('|');
}
function coachExerciseExtra(ex,index){
  if(!ex)return {};
  return {
    exerciseIndex:index,
    exercise:{
      id:ex.id||'',
      name:ex.name,
      setNumber:1,
      totalSets:ex.sets?.length||0,
      weight:String(ex.sets?.[0]?.weight||ex.suggestedWeight||''),
      reps:String(ex.sets?.[0]?.reps||ex.suggestedReps||''),
      target:(ex.sets?.length||0)+' sets of '+String(ex.reps||ex.suggestedReps||'your target'),
      loadMode:ex.loadMode||''
    }
  };
}
function prefetchWorkoutCoach(event,extra={}){
  const settings=workoutCueSettings();
  if(!settings.voice||!settings.aiCoach||store.account?.status!=='connected'||!coachEventAllowed(event,settings.coachFrequency))return Promise.resolve(null);
  const key=coachPrefetchKey(event,extra,settings);
  if(cueRuntime.coachPrefetchCache.has(key))return Promise.resolve(cueRuntime.coachPrefetchCache.get(key));
  if(cueRuntime.coachPrefetchPending.has(key))return cueRuntime.coachPrefetchPending.get(key);
  const promise=invokeWorkoutCoach({
    event,
    context:coachEventContext(event,settings,extra),
    ...coachPayloadSettings(settings)
  }).then(data=>{
    if(data?.audioBase64)cueRuntime.coachPrefetchCache.set(key,data);
    return data||null;
  }).catch(error=>{
    console.warn('Coach prefetch failed',event,error);
    return null;
  }).finally(()=>cueRuntime.coachPrefetchPending.delete(key));
  cueRuntime.coachPrefetchPending.set(key,promise);
  return promise;
}
function rememberCoachCue(line,data=null){
  line=String(line||'').trim();
  if(!line)return;
  cueRuntime.lastCoachLine=line;
  if(data?.audioBase64){
    cueRuntime.lastCoachAudio=data.audioBase64;
    cueRuntime.lastCoachMime=data.mimeType||'audio/wav';
  }
  const text=document.querySelector('#coach-live-text');
  if(text)text.textContent=line;
  const row=document.querySelector('#coach-live-line');
  if(row)row.hidden=false;
}
function replayLastCoachCue(){
  if(!cueRuntime.lastCoachAudio){toast('No coach cue is ready to replay yet.');return;}
  unlockWorkoutCues();
  window.GoWorkoutCoach?.playClip?.(cueRuntime.lastCoachAudio,cueRuntime.lastCoachMime||'audio/wav');
}
function cancelCoachTimeline(clearCaption=false){
  cueRuntime.coachTimelineEpoch+=1;
  cueRuntime.coachTimelineTokens.clear();
  cueRuntime.coachPrefetchCache.clear();
  cueRuntime.coachPrefetchPending.clear();
  window.GoWorkoutCoach?.cancel?.();
  if(clearCaption){
    cueRuntime.lastCoachLine='';
    cueRuntime.lastCoachAudio=null;
  }
}
function timelineComposite(key){return cueRuntime.coachTimelineEpoch+'|'+String(key||'');}
function timelineMark(key){
  if(!key)return false;
  const composite=timelineComposite(key);
  if(cueRuntime.coachTimelineTokens.has(composite))return false;
  cueRuntime.coachTimelineTokens.set(composite,Date.now());
  if(cueRuntime.coachTimelineTokens.size>180){
    cueRuntime.coachTimelineTokens.delete(cueRuntime.coachTimelineTokens.keys().next().value);
  }
  return true;
}
function timelineWasPlayed(key){
  return cueRuntime.coachTimelineTokens.has(timelineComposite(key));
}
function coachSpeechLeadSeconds(line,settings=workoutCueSettings()){
  const words=String(line||'').trim().split(/\s+/).filter(Boolean).length;
  const wordsPerSecond=settings.talkSpeed==='fast'?3.2:settings.talkSpeed==='slow'?2.15:2.65;
  return Math.max(6,Math.min(13,Math.ceil(words/Math.max(1,wordsPerSecond))+4));
}
function timelineExtra(line,key,extra={}){
  return {line:String(line||'').trim(),timelineKey:key,...extra};
}
function prefetchTimelineCue(line,key,extra={}){
  if(!line||!key)return Promise.resolve(null);
  return prefetchWorkoutCoach('timeline_cue',timelineExtra(line,key,extra));
}
function playTimelineCue(line,key,extra={}){
  if(!line||!key||!timelineMark(key))return Promise.resolve(false);
  return playPreparedWorkoutCoach('timeline_cue',timelineExtra(line,key,extra),line,'timeline-'+key);
}
function guidedAutoStartEnabled(phase){
  const settings=workoutCueSettings();
  return phase==='cooldown'?settings.autoStartCooldown:settings.autoStartWarmup;
}
function spokenTargetForSet(ex,set){
  const reps=Math.max(1,num(set?.reps)||recommendedRepTarget(ex));
  if(ex?.loadMode==='timed')return reps+' seconds';
  const repText=exerciseRepCountMode(ex)==='per-side'?reps+' reps each side':reps+' reps';
  const weight=Math.max(0,num(set?.weight));
  if(!weight)return ex?.loadMode==='bodyweight'?'bodyweight, '+repText:repText;
  return ex?.loadMode==='dumbbell-pair'?weight+' pounds each, '+repText:weight+' pounds, '+repText;
}
function strengthPreviewKey(w,next){
  return 'strength-preview-'+(w?.id||'')+'-'+(next?.ei??'')+'-'+(next?.si??'');
}
function strengthPreviewLine(w,next){
  const settings=workoutCueSettings();
  if(!w||!next||settings.nextSetPreview==='off')return '';
  const ex=w.exercises?.[next.ei],set=ex?.sets?.[next.si];
  if(!ex||!set)return '';
  const sameExercise=next.ei===w.currentExerciseIndex;
  const setNumber=(next.si||0)+1;
  const lastSet=setNumber>=ex.sets.length;
  let lead='';
  if(sameExercise)lead=lastSet?'Last set.':'Set '+setNumber+'.';
  else if(next.type==='block-round'||sameDynamicBlock(w.exercises?.[w.currentExerciseIndex],ex))lead='Back to '+ex.name+'.';
  else lead='Next up, '+ex.name+'.';
  if(settings.nextSetPreview==='exercise')return lead;
  let line=lead+' '+spokenTargetForSet(ex,set)+'.';
  if(settings.nextSetPreview==='full'&&!sameExercise){
    const equipment=equipmentRequirement(exerciseSource(ex));
    if(equipment&&equipment!=='No special equipment')line+=' Get '+equipment+' ready.';
  }
  if(settings.nextSetPreview==='full'&&sameExercise&&w.lastCompletedSet?.exerciseId===ex.id){
    const priorWeight=num(w.lastCompletedSet.weight),nextWeight=num(set.weight);
    const priorReps=num(w.lastCompletedSet.reps),nextReps=num(set.reps);
    if(priorWeight===nextWeight&&priorReps===nextReps)line+=' Same target.';
    else if(nextWeight&&priorWeight&&nextWeight!==priorWeight)line+=' Weight changes to '+nextWeight+' pounds.';
  }
  return line;
}
function exerciseInstructionLine(ex,setIndex=0){
  const settings=workoutCueSettings();
  if(!ex||settings.exerciseInstruction==='off'||settings.formCues==='off')return '';
  const guide=detailedExerciseGuidance(ex);
  if(settings.exerciseInstruction==='detailed'&&setIndex===0){
    return [guide.setup,guide.cue].map(value=>String(value||'').trim()).filter(Boolean).join(' ');
  }
  const pool=[guide.cue,...(guide.steps||[]),guide.mistake].map(value=>String(value||'').trim()).filter(Boolean);
  return pool.length?pool[Math.min(Math.max(0,setIndex),pool.length-1)]:'Keep the movement controlled.';
}
function formCueKey(w,ei,si){return 'form-cue-'+(w?.id||'')+'-'+ei+'-'+si;}
function prepareStrengthTimeline(w,next){
  if(!w||!next)return;
  const preview=strengthPreviewLine(w,next);
  if(preview)prefetchTimelineCue(preview,strengthPreviewKey(w,next),{preview:{type:'strength',ei:next.ei,si:next.si}});
  const ex=w.exercises?.[next.ei];
  const form=exerciseInstructionLine(ex,next.si);
  if(form)prefetchTimelineCue(form,formCueKey(w,next.ei,next.si),{preview:{type:'form',ei:next.ei,si:next.si}});
}
function playExerciseInstruction(w,ei,si){
  const ex=w?.exercises?.[ei];
  const line=exerciseInstructionLine(ex,si);
  if(!line)return Promise.resolve(false);
  return playTimelineCue(line,formCueKey(w,ei,si),{preview:{type:'form',ei,si}});
}
function guidedPreviewKey(w,phase,index){
  return 'guided-preview-'+(w?.id||'')+'-'+phase+'-'+index;
}
function guidedUpcomingPreview(w,snap){
  if(!w||!snap||snap.mode==='switch'||snap.mode==='ready')return null;
  const items=timedStageItems(w),nextIndex=snap.index+1;
  if(nextIndex<items.length){
    const next=items[nextIndex];
    const target=next?.mode==='reps'||next?.reps
      ?String(next.reps||8)+' reps'+(next.side?' each side':'')
      :String(next?.seconds||30)+' seconds';
    return {key:guidedPreviewKey(w,w.phase,nextIndex),line:'Next up, '+(next?.name||'the next movement')+'. '+target+'.',next,nextIndex};
  }
  if(w.phase==='warmup'&&workoutCueSettings().nextSetPreview!=='off'){
    const ex=w.exercises?.[0],set=ex?.sets?.[0];
    if(ex&&set)return {key:strengthPreviewKey(w,{ei:0,si:0,type:'exercise'}),line:'Warm-up is almost done. First up is '+ex.name+'. '+spokenTargetForSet(ex,set)+'.',next:null,nextIndex:-1};
  }
  return null;
}
function prefetchGuidedLookahead(w){
  if(!w||!['warmup','cooldown'].includes(w.phase))return;
  const snap=timedStageSnapshot(w);
  const preview=guidedUpcomingPreview(w,snap);
  if(preview)prefetchTimelineCue(preview.line,preview.key,{preview:{type:w.phase,index:preview.nextIndex}});

  if(w.phase==='warmup'&&preview?.nextIndex===-1){
    const firstStrength=w.exercises?.[0];
    const form=exerciseInstructionLine(firstStrength,0);
    if(form)prefetchTimelineCue(form,formCueKey(w,0,0),{preview:{type:'form',ei:0,si:0}});
  }

  if(preview?.next&&preview.nextIndex+1<timedStageItems(w).length){
    const laterIndex=preview.nextIndex+1;
    const later=timedStageItems(w)[laterIndex];
    const target=later?.mode==='reps'||later?.reps
      ?String(later.reps||8)+' reps'+(later.side?' each side':'')
      :String(later?.seconds||30)+' seconds';
    const line='Next up, '+(later?.name||'the next movement')+'. '+target+'.';
    prefetchTimelineCue(line,guidedPreviewKey(w,w.phase,laterIndex),{preview:{type:w.phase,index:laterIndex}});
  }
}
function sessionCoachExtra(w){
  return {exerciseCount:w?.exercises?.length||0,warmupCount:w?.warmup?.length||0,warmupMinutes:runnerPhaseMinutes(w?.warmup||[])};
}
function sessionCoachLine(w){
  const name=displayName()==='there'?'':displayName();
  return w?.warmup?.length
    ?'Alright'+(name?' '+name:'')+'. Warm-up first, then '+(w.exercises?.length||0)+' strength exercises.'
    :'Alright'+(name?' '+name:'')+'. '+(w?.routineName||'Your workout')+'. Let’s get started.';
}
function prefetchWorkoutOpeningCoach(w){
  if(!w)return;
  prefetchWorkoutCoach('session_started',sessionCoachExtra(w));
  const first=w.warmup?.[0];
  if(first)prefetchGuidedStageCoach('warmup_started',w,first,0,'warmup');
}
function prefetchCoachTimeline(){
  const w=store.activeWorkout;
  if(!w||currentTab!=='workout')return;
  if(w.phase==='intro'){prefetchWorkoutOpeningCoach(w);return;}
  if(['warmup','cooldown'].includes(w.phase)){prefetchGuidedLookahead(w);return;}
  if(w.phase==='rest'&&w.pendingPosition)prepareStrengthTimeline(w,w.pendingPosition);
}
function coachStageExtra(w,item,index,phase=w?.phase||'warmup'){
  const total=phase==='cooldown'?(w?.cooldown?.length||0):(w?.warmup?.length||0);
  const target=item
    ? (item.mode==='reps'||item.reps
        ? String(item.reps||8)+' reps'+(item.side?' per side':'')
        : String(item.seconds||30)+' seconds')
    : '';
  return {
    stage:{
      phase,
      name:item?.name||'',
      target,
      description:item?.description||'',
      cue:item?.cue||'',
      index:Number(index||0)+1,
      total
    }
  };
}
function prefetchGuidedStageCoach(event,w,item,index,phase){
  return prefetchWorkoutCoach(event,coachStageExtra(w,item,index,phase));
}
function playPreparedWorkoutCoach(event,extra={},fallbackLine='',token=''){
  const settings=workoutCueSettings();
  if(!settings.voice)return Promise.resolve(false);
  if(!settings.aiCoach){
    if(fallbackLine)speakWorkoutCue(fallbackLine,'classic-'+token);
    return Promise.resolve(true);
  }
  if(!coachEventAllowed(event,settings.coachFrequency))return Promise.resolve(false);
  const key=coachPrefetchKey(event,extra,settings);
  const play=(data)=>{
    if(!data?.audioBase64)return false;
    cueRuntime.coachPrefetchCache.delete(key);
    rememberCoachCue(data.line||fallbackLine,data);
    return window.GoWorkoutCoach?.playClip?.(data.audioBase64,data.mimeType||'audio/wav')||false;
  };
  const ready=cueRuntime.coachPrefetchCache.get(key);
  if(ready)return Promise.resolve(play(ready));
  const pending=cueRuntime.coachPrefetchPending.get(key);
  if(pending)return Promise.resolve(pending).then(play);
  return prefetchWorkoutCoach(event,extra).then(play);
}
function prefetchExerciseCoach(ex,index){
  if(!ex)return Promise.resolve(null);
  return prefetchWorkoutCoach('exercise_started',coachExerciseExtra(ex,index));
}
function primeCoachCuePack(){
  const settings=workoutCueSettings();
  if(!settings.voice||!settings.aiCoach||store.account?.status!=='connected')return Promise.resolve(null);
  const key=coachCuePackCacheKey(settings);
  if(cueRuntime.coachCuePack&&cueRuntime.coachCuePackKey===key)return Promise.resolve(cueRuntime.coachCuePack);
  if(cueRuntime.coachCuePackPromise&&cueRuntime.coachCuePackKey===key)return cueRuntime.coachCuePackPromise;
  cueRuntime.coachCuePackKey=key;
  cueRuntime.coachCuePackPromise=invokeWorkoutCoach({
    event:'cue_pack',
    context:{name:displayName()},
    ...coachPayloadSettings(settings)
  }).then(data=>{
    if(cueRuntime.coachCuePackKey!==key)return null;
    cueRuntime.coachCuePack=data?.cues||null;
    return cueRuntime.coachCuePack;
  }).catch(error=>{
    console.warn('Coach cue pack failed',error);
    return null;
  }).finally(()=>{
    if(cueRuntime.coachCuePackKey===key)cueRuntime.coachCuePackPromise=null;
  });
  return cueRuntime.coachCuePackPromise;
}
function coachFunctionalCueKey(voice){
  const value=String(voice||'').trim().toLowerCase();
  if(value==='3'||value==='three')return 'three';
  if(value==='2'||value==='two')return 'two';
  if(value==='1'||value==='one')return 'one';
  if(value==='go'||value==='left side. go.')return value.startsWith('left')?'left_go':'go';
  if(value==='switch sides')return 'switch';
  if(value==='done'||value==='set complete'||value==='right side complete')return 'done';
  if(value==='next')return 'next';
  if(value==='resume')return 'resume';
  if(value==='workout paused')return 'paused';
  if(value==='timer reset')return 'reset';
  return '';
}
function playCoachFunctionalCue(voice){
  const settings=workoutCueSettings();
  if(!settings.voice||!settings.aiCoach)return Promise.resolve(false);
  const key=coachFunctionalCueKey(voice);
  if(!key)return Promise.resolve(false);
  if(['three','two','one','go','left_go'].includes(key)){
    if(settings.countdownMode==='off')return Promise.resolve(true);
    if(settings.countdownMode==='beep'&&['three','two','one'].includes(key))return Promise.resolve(true);
  }
  const pack=cueRuntime.coachCuePack;
  const clip=pack?.[key];
  if(!clip?.audioBase64){
    primeCoachCuePack();
    return Promise.resolve(false);
  }
  return window.GoWorkoutCoach?.playClip?.(clip.audioBase64,clip.mimeType||'audio/mpeg')||Promise.resolve(false);
}
function toggleCueSetting(key){
  if(!['sound','voice','aiCoach','haptics','flash'].includes(key))return;
  store.cueSettings={...workoutCueSettings(),[key]:!workoutCueSettings()[key]};
  saveStore();
  if((key==='sound'||key==='voice'||key==='aiCoach')&&store.cueSettings[key]){
    unlockWorkoutCues();
    primeCoachCuePack();
  }
  if((key==='voice'&&!store.cueSettings.voice)||(key==='aiCoach'&&!store.cueSettings.aiCoach)){
    if('speechSynthesis' in window){try{window.speechSynthesis.cancel?.();}catch{}}
    window.GoWorkoutCoach?.stop?.();
  }
  render();
}
function updateCoachPreference(key,value){
  const settings=workoutCueSettings();
  if(!COACH_SETTING_VALUES[key]?.includes(value))return;
  const audioIdentity=['coachStyle','coachVibe','talkSpeed'].includes(key);
  store.cueSettings={...settings,[key]:value,coachPreset:'custom'};
  if(audioIdentity)clearCoachCuePack();
  saveStore();
  if(audioIdentity)primeCoachCuePack();
  render();
}
function cycleCoachSetting(key,values=COACH_SETTING_VALUES[key]||[]){
  const settings=workoutCueSettings();
  const current=String(settings[key]||'');
  const index=Math.max(0,values.indexOf(current));
  updateCoachPreference(key,values[(index+1)%values.length]);
}
function toggleCoachBooleanPreference(key){
  if(!['autoStartWarmup','autoStartCooldown','autoStartTimedExercise'].includes(key))return;
  const settings=workoutCueSettings();
  store.cueSettings={...settings,[key]:!settings[key],coachPreset:'custom'};
  saveStore();
  render();
}
function toggleAdaptiveCoach(){
  const settings=workoutCueSettings();
  store.cueSettings={...settings,adaptiveCoach:!settings.adaptiveCoach,coachPreset:'custom'};
  saveStore();
  render();
}
function applyCoachPreset(id){
  const preset=COACH_PRESETS[id];
  if(!preset)return;
  const settings=workoutCueSettings();
  const beforeKey=coachCuePackCacheKey(settings);
  store.cueSettings={...settings,...preset,coachPreset:id};
  const after=workoutCueSettings();
  if(beforeKey!==coachCuePackCacheKey(after))clearCoachCuePack();
  saveStore();
  primeCoachCuePack();
  render();
}
function renderCueControls(){
  const settings=workoutCueSettings();
  const voiceLabel=settings.voice?(settings.aiCoach?coachVoiceLabel(settings.coachVoice):'Device voice'):'Voice off';
  const style=COACH_SETTING_LABELS.coachStyle[settings.coachStyle]||'Balanced';
  const vibe=COACH_SETTING_LABELS.coachVibe[settings.coachVibe]||'Warm & Familiar';
  return '<button type="button" class="workout-cue-compact" data-action="open-cue-settings"><span>◉</span><div><strong>AI Coach & cues</strong><small>'+esc(voiceLabel+' · '+style+' · '+vibe)+'</small></div><em>›</em></button>';
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

const EXERCISE_GUIDANCE_OVERRIDES = {
  'one-arm-row':{
    setup:'Support one hand and knee on a bench or stable surface. Keep your back flat and let the working arm hang below the shoulder.',
    steps:['Brace your torso before pulling.','Drive the working elbow toward your hip.','Pause briefly near the top, then lower the dumbbell under control.'],
    cue:'Keep your chest facing the floor and pull the elbow toward your hip.',
    mistake:'Do not twist your torso upward to move the weight.'
  },
  'db-rdl':{
    setup:'Stand tall with a dumbbell in each hand, feet stable, and knees softly bent.',
    steps:['Brace and push your hips backward.','Keep the dumbbells close to your legs as you lower.','Stop when the hamstrings are loaded, then drive the hips forward to stand.'],
    cue:'Send the hips back. Keep the weights close.',
    mistake:'Do not chase depth by rounding your lower back.'
  },
  'reverse-lunge':{
    setup:'Stand tall with enough space behind you. Keep your front foot planted.',
    steps:['Step one leg back and lower under control.','Keep most of your balance over the front leg.','Push through the front foot to return to standing.'],
    cue:'Stay tall and control the back step.',
    mistake:'Avoid letting the front knee collapse inward.'
  },
  'push-up':{
    setup:'Place your hands slightly wider than shoulder width and create a straight line from head to heels.',
    steps:['Brace your trunk before lowering.','Lower your chest under control while the elbows track naturally.','Press the floor away and return to a strong plank.'],
    cue:'Move your chest and hips together.',
    mistake:'Avoid letting the hips sag or the shoulders shrug toward the ears.'
  },
  'lat-pulldown':{
    setup:'Secure your thighs under the pad, take a comfortable grip, and keep your chest tall.',
    steps:['Begin with the arms long overhead.','Drive your elbows down toward your ribs.','Return the bar slowly until the arms are long again.'],
    cue:'Pull with your elbows, not your hands.',
    mistake:'Avoid swinging backward to create momentum.'
  },
  'leg-curl':{
    setup:'Align your knee with the machine pivot and place the pad comfortably above the heel.',
    steps:['Brace against the pad or bench.','Curl the lower leg through a controlled range.','Lower the resistance slowly without letting the stack drop.'],
    cue:'Squeeze the hamstrings and control the return.',
    mistake:'Avoid lifting the hips or throwing the weight.'
  }
};
function detailedExerciseGuidance(ex){
  const base=exerciseGuidance(ex);
  return {...base,...(EXERCISE_GUIDANCE_OVERRIDES[ex?.id]||{})};
}
function renderExerciseGuidanceCard(ex,{compact=false,label='FORM'}={}){
  const guide=detailedExerciseGuidance(ex);
  const steps=(guide.steps||[]).slice(0,compact?3:4);
  return '<section class="runner-form-guide '+(compact?'compact':'')+'">'+
    '<div class="runner-form-guide-head"><span>'+esc(label)+'</span><strong>'+esc(guide.cue||'Stay controlled.')+'</strong></div>'+
    '<div class="runner-form-setup"><small>SETUP</small><p>'+esc(guide.setup||exerciseDescription(ex))+'</p></div>'+
    '<ol>'+steps.map(step=>'<li>'+esc(step)+'</li>').join('')+'</ol>'+
    '<div class="runner-form-tip"><small>FORM TIP</small><p>'+esc(guide.mistake||'Use a controlled range and avoid momentum.')+'</p></div>'+
  '</section>';
}
function nextUnresolvedExerciseAfter(w,index){
  if(!w)return null;
  for(let i=index+1;i<(w.exercises||[]).length;i++){
    if(!exerciseCountsAsResolved(w.exercises[i]))return {index:i,exercise:w.exercises[i]};
  }
  return null;
}
function renderCountdownExercisePreview(pos){
  const next=nextUnresolvedExerciseAfter(pos.workout,pos.ei);
  if(!next)return '';
  return '<div class="runner-countdown-next"><span>COMING NEXT</span><strong>'+esc(next.exercise.name)+'</strong><small>'+esc(currentPrescriptionLabel(next.exercise))+'</small></div>';
}
function preWorkoutMotivation(w){
  const readiness=w?.readiness||{};
  if(num(readiness.energy)&&num(readiness.energy)<=2)return {title:'Meet today where it is.',copy:'Keep the reps clean and finish the work you can control. The session is already adjusted around today’s readiness.'};
  if(w?.trainingContext?.adapted||w?.trainingContext?.temporary)return {title:'Make this setup work for you.',copy:'The movements changed. The goal did not. Stay controlled and let today’s equipment do its job.'};
  if((store.history||[]).length===0)return {title:'Set the baseline.',copy:'Clean reps first. Today gives GoWorkout the starting point it needs to make the next session smarter.'};
  return {title:'Own the next set.',copy:'Start with the target, keep the form clean, and adjust only when your actual reps say you should.'};
}
function workoutMotivationSummary(item){
  const completed=(item?.exercises||[]).filter(ex=>exerciseCountsAsResolved(ex)).length;
  const total=(item?.exercises||[]).length;
  const records=workoutRecordClassification(item||{});
  if(item?.completionStatus==='partial')return {title:'The work you did still counts.',copy:completed+' of '+total+' exercises were resolved. Your completed sets stay in history and the next plan can build from them.'};
  if(records.prs?.length)return {title:'Progress showed up today.',copy:records.prs.length+' personal record'+(records.prs.length===1?'':'s')+' moved forward. The next targets will use what you logged here.'};
  if(completed===total&&total)return {title:'Full session logged.',copy:'You completed the planned exercise list. The next workout now has a cleaner picture of your working loads and feedback.'};
  return {title:'Session saved.',copy:'Your actual sets, feedback, substitutions, and timing are now part of the next recommendation.'};
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
function normalizedExerciseName(value){
  return String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}
function exerciseHistoryIdentity(exerciseOrId){
  const source=typeof exerciseOrId==='string'
    ?(catalog.find(item=>item.id===exerciseOrId)||{id:exerciseOrId,name:''})
    :(exerciseSource(exerciseOrId)||exerciseOrId||{});
  const ids=new Set([source.id,source.historyKey,...(source.historyAliases||[])].filter(Boolean));
  const names=new Set([source.name,...(source.historyNames||[])].map(normalizedExerciseName).filter(Boolean));
  return {source,ids,names};
}
function exerciseMatchesHistory(item,identity){
  if(!item||!identity)return false;
  if(identity.ids.has(item.id)||identity.ids.has(item.historyKey))return true;
  return identity.names.has(normalizedExerciseName(item.name));
}
function exerciseLaterality(ex){
  const source=exerciseSource(ex)||ex||{};
  if(source.laterality)return source.laterality;
  if(source.movement==='single-leg')return 'unilateral';
  if(/one-arm|single-arm|single-leg/i.test(source.name||''))return 'unilateral';
  if(/alternating/i.test(source.name||''))return 'alternating';
  return 'bilateral';
}
function exerciseRepCountMode(ex){
  const source=exerciseSource(ex)||ex||{};
  return source.repCountMode||(exerciseLaterality(source)==='bilateral'?'total':'per-side');
}
function exerciseRepDisplay(ex,value,{unit=true}={}){
  const amount=String(value??'');
  if(ex?.loadMode==='timed')return amount+(unit?' sec':'');
  if(exerciseRepCountMode(ex)==='per-side')return amount+(unit?' / side':'');
  return amount+(unit?' reps':'');
}
function exerciseWeightDisplay(ex,value){
  const weight=num(value);
  if(!weight)return '';
  return String(weight)+' lb'+(ex?.loadMode==='dumbbell-pair'?' each':'');
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
      const sameVariant=Boolean(source.variantGroup&&candidate.variantGroup&&source.variantGroup===candidate.variantGroup);
      const sameEquipmentClass=Boolean(source.equipmentClass&&candidate.equipmentClass&&source.equipmentClass===candidate.equipmentClass);
      const overlap=muscleOverlap(source,candidate);
      const available=swapCandidateAvailable(candidate,setup);
      const difficultyGap=Math.abs(exerciseDifficultyRank(source.difficulty)-exerciseDifficultyRank(candidate.difficulty));
      const setupGap=Math.abs((candidate.setup||25)-(source.setup||25));
      const duplicatePenalty=(activeIds.has(candidate.id)||planIds.has(candidate.id))?6:0;
      const score=(sameVariant?38:0)+(sameMovement?60:0)+(overlap*12)+(available?24:0)+(sameEquipmentClass?6:0)+(candidate.style===source.style?4:0)-difficultyGap*5-Math.min(8,setupGap/10)-duplicatePenalty;
      const tier=sameVariant?'Closest equipment variant':sameMovement&&overlap?'Same movement + muscles':sameMovement?'Same movement':'Similar training purpose';
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
    laterality:candidate.laterality||'',repCountMode:candidate.repCountMode||'',variantGroup:candidate.variantGroup||'',equipmentClass:candidate.equipmentClass||'',
    sets:template.sets,reps:reps,startReps:recommendedRepCount(reps),rest:Math.max(30,Math.min(60,template.rest||settings.rest)),
    blockId:template.blockId||'',blockType:template.blockType||'',blockOrder:template.blockOrder??null,transitionRest:template.transitionRest||0,blockRest:template.blockRest||0,
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
    laterality:candidate.laterality||'',repCountMode:candidate.repCountMode||'',variantGroup:candidate.variantGroup||'',equipmentClass:candidate.equipmentClass||'',
    reps:settings.reps,rest,blockId:template.blockId||'',blockType:template.blockType||'',blockOrder:template.blockOrder??null,transitionRest:template.transitionRest||0,blockRest:template.blockRest||0,setup:template.setup||candidate.setup||25,increment:candidate.increment||5,
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
  const between=ex.blockId?(ex.transitionRest||15):(ex.rest||45);
  return (ex.setup||25)+(ex.sets||2)*setSeconds+Math.max(0,(ex.sets||2)-1)*between+35;
}
function assignDynamicWorkoutBlocks(day,profile=store.profile||{}){
  if(!day?.exercises?.length)return day;
  if(day.exercises.some(ex=>ex.blockId))return day;
  for(const ex of day.exercises){
    delete ex.blockId;delete ex.blockType;delete ex.blockOrder;delete ex.transitionRest;delete ex.blockRest;
  }
  const exactIds=['push-up','sit-up','pull-up'];
  const exact=exactIds.map(id=>day.exercises.findIndex(ex=>ex.id===id));
  let indexes=[];
  const exactMatch=exact.every(index=>index>=0);
  if(exactMatch)indexes=exact;
  else{
    const accessory=new Set(['core','biceps','triceps','shoulder-accessory','calves','horizontal-push','horizontal-pull','vertical-pull']);
    const candidates=day.exercises.map((ex,index)=>({ex,index}))
      .filter(({ex})=>accessory.has(ex.movement)&&(num(ex.setup)||25)<=35)
      .map(item=>item.index);
    const wanted=['general','fat-loss'].includes(profile.goal)?3:2;
    if(candidates.length>=wanted)indexes=candidates.slice(-wanted);
  }
  if(indexes.length<2)return day;
  const ordered=exactMatch?[...new Set(indexes)]:[...new Set(indexes)].sort((a,b)=>a-b);
  const blockType=ordered.length>=3?'tri-set':'superset';
  const blockId=(day.id||'session')+'-'+blockType+'-1';
  const roundRest=blockType==='tri-set'?75:60;
  ordered.forEach((index,order)=>{
    const ex=day.exercises[index];
    ex.blockId=blockId;
    ex.blockType=blockType;
    ex.blockOrder=order;
    ex.transitionRest=15;
    ex.blockRest=roundRest;
  });
  day.blocks=[{id:blockId,type:blockType,exerciseIds:ordered.map(index=>day.exercises[index].id),transitionRest:15,roundRest}];
  return day;
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
  if(item?.mediaStatus==='none')return '';
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
    :'<img src="'+esc(src)+'" loading="'+(runnerEager?'eager':'lazy')+'" decoding="async" alt="'+esc(ex.name)+' exercise demonstration">';
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
  const calibrated=store.calibration[ex.id];
  const calibratedWeight=num(calibrated?.weight);
  const start=calibratedWeight?((ex.loadMode==='dumbbell-pair'?calibratedWeight+' lb each':calibratedWeight+' lb')+' · calibrated'):ex.startLabel;
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
    const previousSession=exerciseSessionHistory(ex,1)[0];
    const previousSet=previousSession?.sets?.[setIndex]||previousSession?.sets?.[previousSession.sets.length-1]||null;
    const learned=adaptivePrescription(ex);
    if(previousSet||learned){
      if(!['bodyweight','timed','band'].includes(ex.loadMode)){
        set.weight=String((learned&&Number.isFinite(Number(learned.weight))?learned.weight:previousSet?.weight)||recommendedWeightTarget(ex)||'');
      }
      set.reps=String(learned?.reps||previousSet?.reps||recommendedRepTarget(ex));
      set.targetSource=learned?'learned':'history';
    }else{
      if(!['bodyweight','timed','band'].includes(ex.loadMode))set.weight=String(recommendedWeightTarget(ex)||'');
      set.reps=String(ex.loadMode==='timed'?(num(set.reps)||num(ex.suggestedReps)||recommendedRepTarget(ex)):recommendedRepTarget(ex));
      set.targetSource='recommended-max';
    }
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
  return suggestedLabel(ex)+' × '+exerciseRepDisplay(ex,ex.suggestedReps||recommendedRepCount(ex.reps));
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
function recentExerciseFeedbacks(ex,limit=3){
  const identity=exerciseHistoryIdentity(ex);
  return [...(store.history||[])]
    .sort((a,b)=>Date.parse(b.completedAt||0)-Date.parse(a.completedAt||0))
    .map(workout=>(workout.exercises||[]).find(candidate=>exerciseMatchesHistory(candidate,identity)))
    .filter(candidate=>candidate?.feedback)
    .slice(0,limit)
    .map(candidate=>candidate.feedback);
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
  const recentFeedback=recentExerciseFeedbacks(ex,3);
  const matchingRecent=recentFeedback.filter(value=>value===feedback).length;
  const feedbackStreak=1+matchingRecent;
  const repeatedHard=['hard','too-hard'].includes(feedback)&&recentFeedback.some(value=>['hard','too-hard'].includes(value));
  const repeatedEasy=feedback==='too-easy'&&recentFeedback.includes('too-easy');
  const repeatedForm=feedback==='form-off'&&recentFeedback.includes('form-off');
  const hardStreak=feedback==='hard'?Math.max(num(previous.hardStreak)+1,feedbackStreak):0;

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
    else if(feedback==='hard'&&repeatedHard&&stats.missedLow>=1){nextWeight=Math.max(minLoad,roundTo(Math.max(minLoad,baseWeight-increment),increment));nextReps=String(stats.low||num(nextReps)||1);reason='This has been hard across repeated sessions and reps are slipping below target, so the next session backs off one increment.';}
    else if(feedback==='form-off'){reason=repeatedForm?'Form concerns have repeated across sessions, so load stays fixed until the movement is cleaner.':'Keeping the same load while you clean up technique before progressing.';}
    else if(feedback==='hard'){reason=repeatedHard?'This has felt hard more than once. Keep the load steady unless reps fall below range, then GoWorkout will back it off.':'Hard but completed is not a failure. Keep the same load and try to make the reps cleaner next time.';}
    else{reason=stats.allAtLeastLow?'You completed the target range. Keep this load until every set reaches the top of the range.':'Keep the same load and build the reps into the target range.';}
  }

  if(stats.repDrop>=3&&nextRest>num(ex.rest||45))reason+=' Rest moves to '+String(nextRest)+'s because reps dropped across sets.';
  if(repeatedEasy)reason+=' This is a repeated easy-session signal, so progression is supported by more than one workout.';
  if(feedback==='too-hard'&&repeatedHard)reason+=' Similar hard feedback appeared recently, so the reduction is reinforced by session history.';
  return {
    exerciseId:ex.id,name:ex.name,feedback:feedback,weight:nextWeight,reps:nextReps,rest:nextRest,
    label:progressionLabel(ex,nextWeight,nextReps,labelOverride),reason:reason,hardStreak:hardStreak,
    feedbackStreak,feedbackPattern:repeatedEasy?'repeated-easy':repeatedHard?'repeated-hard':repeatedForm?'repeated-form':'',
    updatedAt:new Date().toISOString(),session:{reps:stats.reps,weights:stats.weights}
  };
}

function timedStageEstimateSeconds(item){
  if(!item)return 0;
  const transition=8;
  const sides=item.side?2:1;
  const switchSeconds=item.side?timedStageSwitchSeconds(item):0;
  if(item.mode==='reps'||item.reps){
    const reps=Math.max(1,Number(item.reps)||8);
    return Math.max(25,reps*sides*3)+switchSeconds+transition;
  }
  return Math.max(1,Number(item.seconds)||30)*sides+switchSeconds+transition;
}

function normalizeTimedStage(items,targetSeconds,minSeconds,maxSeconds){
  if(!items.length)return items;
  const target=Math.max(minSeconds,Math.min(maxSeconds,targetSeconds));
  const units=items.reduce((sum,item)=>sum+(item.side?2:1),0);
  const each=Math.max(15,Math.round(target/Math.max(1,units)/5)*5);
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
    mediaStatus:'none'
  }];
  if(lower){
    items.push(
      {name:'Ankle rocks',mode:'reps',reps:8,side:'each side',description:'Drive the knee forward over the toes while the heel stays down.',cue:'Keep the heel planted and move through a comfortable range.',why:'Prepares the ankles for squats, lunges, and leg work.',mediaStatus:'none'},
      {name:'Bodyweight squat',mode:'reps',reps:8,description:'Sit between the hips and stand tall without load.',cue:'Keep your knees tracking over your toes.',why:'Warms the squat pattern before loaded lower-body work.',mediaId:'Bodyweight_Squat'}
    );
    if([...moves].some(m=>['hinge','hamstring-accessory'].includes(m))){
      items.push({name:'Hip hinge reach',mode:'reps',reps:8,description:'Reach the hips back with soft knees, then return tall.',cue:'Keep your spine long and feel the hamstrings load lightly.',why:'Primes the hinge pattern without external load.'});
    }
    items.push(
      {name:'Reverse lunge reach',mode:'reps',reps:5,side:'each side',description:'Step back into a controlled reverse lunge with an easy reach.',cue:'Stay tall and use a comfortable range.',why:'Adds single-leg motion and opens the hips.',mediaStatus:'none'},
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
    side:'each side',
    sideSwitchSeconds:7,
    description:'Stand tall and gently bend one knee to stretch the front of the thigh without pulling aggressively.',
    cue:'Keep knees close and posture tall.',
    why:'Gives the quads a gentle post-workout stretch.',
    mediaId:'Standing_Elevated_Quad_Stretch'
  });
  if(muscles.has('Hamstrings')) items.push({
    name:'Hamstring stretch',
    seconds:30,
    side:'each side',
    sideSwitchSeconds:7,
    description:'Hinge forward gently with a long spine until you feel a mild stretch through the back of the thigh.',
    cue:'Hinge gently until you feel light tension.',
    why:'Helps the hamstrings relax after hinges and leg work.',
    mediaId:'Hamstring_Stretch'
  });
  if(muscles.has('Glutes')) items.push({
    name:'Glute stretch',
    seconds:30,
    side:'each side',
    sideSwitchSeconds:7,
    description:'Settle into a comfortable hip position that creates a gentle stretch through the glutes without forcing the joint.',
    cue:'Stay relaxed and avoid forcing the hip.',
    why:'Releases the glutes after squats, hinges, and lunges.',
    mediaId:'IT_Band_and_Glute_Stretch'
  });
  if(muscles.has('Calves')) items.push({
    name:'Calf stretch',
    seconds:30,
    side:'each side',
    sideSwitchSeconds:6,
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
      laterality:e.laterality||'',repCountMode:e.repCountMode||'',variantGroup:e.variantGroup||'',equipmentClass:e.equipmentClass||'',
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
function ensureTrainProgramEngineCurrent(){
  const current=currentEngineProgram();
  if(!programEngine||!store.profile||store.activeWorkout)return current;
  if(current?.engineVersion==='1.6.0'&&current?.program?.programModel==='anchor_rotation')return current;
  const upgraded=buildEngineProgram(store.profile);
  if(!upgraded)return current;
  upgraded.migratedFrom=current?.engineVersion||'legacy';
  upgraded.migratedAt=new Date().toISOString();
  ensureTrainingProgram().engine=upgraded;
  saveStore();
  return upgraded;
}
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
const ENGINE_EXERCISE_TO_CATALOG={db_bench:'db-bench',pushup:'push-up',machine_press:'chest-press-machine',db_shoulder_press:'db-shoulder-press',cable_row:'cable-row',db_row:'one-arm-row',lat_pulldown:'lat-pulldown',goblet_squat:'goblet-squat',leg_press:'leg-press',db_rdl:'db-rdl',reverse_lunge:'reverse-lunge',leg_curl:'leg-curl',lateral_raise:'lateral-raise',band_lateral_raise:'band-lateral-raise',db_curl:'biceps-curl',cable_curl:'cable-curl',triceps_pressdown:'triceps-pushdown',db_triceps_extension:'db-triceps-extension',calf_raise:'calf-raise',calf_extension_machine:'calf-extension-machine',single_leg_calf_raise:'single-leg-db-calf-raise',dead_bug:'dead-bug',sit_up:'sit-up',cable_crunch:'cable-crunch',incline_pushup:'push-up',inverted_row:'prone-w-raise',band_pulldown:'band-pulldown',split_squat:'split-squat',glute_bridge:'glute-bridge',pallof_press:'dead-bug',suitcase_carry:'plank'};
function engineSessionForDate(date,index){const context=programContext(date),week=engineWeekForContext(context);return week?.sessions?.[index%Math.max(1,week.sessions.length)]||null;}
function engineCatalogExercise(engineExercise){if(!engineExercise)return null;const mapped=ENGINE_EXERCISE_TO_CATALOG[engineExercise.id];return catalog.find(item=>item.id===mapped)||catalog.find(item=>item.name.toLowerCase()===String(engineExercise.name||'').toLowerCase())||null;}
const ENGINE_STRETCH_MEDIA={doorway_chest:'Chest_And_Front_Of_Shoulder_Stretch',thread_needle:'Thread_the_Needle',kneeling_lat:'Overhead_Lat',cross_body_shoulder:'Cross_Body_Shoulder_Stretch',triceps_overhead:'Triceps_Stretch',child_lat:'Childs_Pose',hip_flexor:'Kneeling_Hip_Flexor',adductor_rockback:'Adductor',hamstring_fold:'Hamstring_Stretch',figure_four:'IT_Band_and_Glute_Stretch',calf_wall:'Standing_Gastrocnemius_Calf_Stretch','90_90':'90_90_Hamstring'};
function engineStretchToLegacy(stretch){return (stretch?.activities||[]).map(item=>({name:item.name,seconds:Number(item.seconds)||30,description:'Hold a comfortable stretch and breathe steadily.',cue:item.perSide?'Complete both sides evenly.':'Stay relaxed and avoid forcing the range.',why:'Program Engine selected this for the muscles and movement patterns trained today.',mediaId:ENGINE_STRETCH_MEDIA[item.id]||''}));}
function engineSubstitutionCatalogIds(ex){return (ex?.engineSubstitutions||[]).map(item=>ENGINE_EXERCISE_TO_CATALOG[item.id]).filter(Boolean);}
function engineSessionToLegacyDay(session,fallbackDay,index=0,blockNumber=programContext().blockNumber){
  if(!session)return clone(fallbackDay);
  const exercises=(session.strength||[]).filter(item=>item.exercise).map(item=>{const source=engineCatalogExercise(item.exercise);if(!source)return null;const pr=item.prescription||{},repRange=Array.isArray(pr.reps)?pr.reps.join('–'):(pr.reps||'8–12'),estimated=estimateStartingLoad(source,store.profile||{});return {...source,sets:Math.max(1,num(pr.sets)||3),reps:repRange,startReps:Array.isArray(pr.reps)?pr.reps[0]:recommendedRepCount(repRange),rest:Math.max(30,Math.min(120,num(pr.restSeconds)||60)),startWeight:estimated.weight,startLabel:estimated.label,startSource:estimated.source||'Program Engine',calibrationRequired:estimated.calibrate,engineExerciseId:item.exercise.id,engineReason:clone(item.reason||[]),engineSubstitutions:clone(item.substitutions||[]),engineIntensityTarget:pr.intensityTarget||'',engineProgramRole:item.programRole||'',engineChangedFrom:clone(item.changedFromWeek1||null)};}).filter(Boolean);
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
    days:blueprints.map((b,i)=>assignDynamicWorkoutBlocks(buildDay(b,profile,i),profile))
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
  saveStore();currentTab='workout';prefetchWorkoutOpeningCoach(store.activeWorkout);render();
  if(sharedDraft?.backendId)activateSharedWorkout(sharedDraft).catch(error=>console.warn('Shared workout activation failed',error));
}

function createWorkout(day,meta={}){
  day=assignDynamicWorkoutBlocks(clone(day),store.profile||{});
  const now=new Date().toISOString();
  const workout={
    schemaVersion:ACTIVE_WORKOUT_SCHEMA,
    id:uid('workout'),planId:store.plan.id,planDayId:day.id,routineName:day.name,focus:day.focus,
    scheduledDate:meta.scheduledDate||dateKey(),actualStartDate:dateKey(),
    readiness:meta.readiness||null,trainingContext:meta.trainingContext||day.trainingContext||null,programContext:meta.programContext||programContext(),adaptationNotes:meta.adaptationNotes||day.adaptationNotes||[],
    preparedAt:now,startedAt:now,trainingStartedAt:null,currentExerciseIndex:0,currentSetIndex:0,furthestExerciseIndex:0,
    isPaused:false,pausedAt:null,totalPausedMs:0,pauseLog:[],
    phase:'intro',timedPhaseStartedAt:null,timedPhaseSkippedSeconds:0,timedStageIndex:0,timedStageReps:0,timedStageSide:'',
    warmup:plannedWarmup(day),cooldown:plannedCooldown(day),
    engineBacked:Boolean(day.engineBacked),engineSessionId:day.engineSessionId||null,engineWeek:day.engineWeek||null,engineBlockNumber:day.engineBlockNumber||null,engineMinimumViable:clone(day.engineMinimumViable||[]),engineStretch:clone(day.engineStretch||null),
    exerciseStartedAt:null,exerciseDurations:{},phaseTimestamps:{},restLog:[],
    restEndsAt:null,restDuration:0,restPausedRemaining:null,restToken:null,pendingPosition:null,
    sideSwitchStartedAt:null,sideSwitchEndsAt:null,sideSwitchDuration:0,sideSwitchPausedRemaining:null,
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
  registerWorkoutLearningPredictions(workout);
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
function blockExerciseIndexes(w,blockId){
  if(!blockId)return [];
  return (w?.exercises||[]).map((ex,index)=>({ex,index}))
    .filter(item=>item.ex.blockId===blockId)
    .sort((a,b)=>(num(a.ex.blockOrder)-num(b.ex.blockOrder))||(a.index-b.index))
    .map(item=>item.index);
}
function sameDynamicBlock(a,b){
  return Boolean(a?.blockId&&b?.blockId&&a.blockId===b.blockId);
}
function nextDynamicBlockPosition(w,ei,si){
  const ex=w?.exercises?.[ei];
  if(!ex?.blockId)return null;
  const peers=blockExerciseIndexes(w,ex.blockId);
  const peerPosition=peers.indexOf(ei);
  if(peerPosition<0)return null;
  for(let p=peerPosition+1;p<peers.length;p++){
    const index=peers[p],set=w.exercises[index]?.sets?.[si];
    if(set&&!setIsResolved(set))return {ei:index,si,type:'block-transition',blockId:ex.blockId};
  }
  const maxSets=Math.max(...peers.map(index=>w.exercises[index]?.sets?.length||0),0);
  for(let round=si+1;round<maxSets;round++){
    for(const index of peers){
      const set=w.exercises[index]?.sets?.[round];
      if(set&&!setIsResolved(set))return {ei:index,si:round,type:'block-round',blockId:ex.blockId};
    }
  }
  const lastPeer=Math.max(...peers);
  for(let index=lastPeer+1;index<w.exercises.length;index++){
    if(!exerciseCountsAsResolved(w.exercises[index]))return {ei:index,si:firstIncompleteSetIndex(w.exercises[index]),type:'exercise'};
  }
  for(let index=0;index<w.exercises.length;index++){
    if(peers.includes(index))continue;
    if(!exerciseCountsAsResolved(w.exercises[index]))return {ei:index,si:firstIncompleteSetIndex(w.exercises[index]),type:'exercise'};
  }
  return null;
}
function nextPosition(w,ei,si){
  const ex=w.exercises[ei];
  if(ex?.blockId)return nextDynamicBlockPosition(w,ei,si);
  for(let setIndex=si+1;setIndex<(ex.sets||[]).length;setIndex++)if(!setIsResolved(ex.sets[setIndex]))return {ei,si:setIndex,type:'set'};
  for(let index=ei+1;index<w.exercises.length;index++){
    if(!exerciseCountsAsResolved(w.exercises[index]))return {ei:index,si:firstIncompleteSetIndex(w.exercises[index]),type:'exercise'};
  }
  return null;
}
function blockRestSeconds(w,fromEi,next){
  const from=w?.exercises?.[fromEi],to=next?w.exercises?.[next.ei]:null;
  if(!sameDynamicBlock(from,to))return null;
  const peers=blockExerciseIndexes(w,from.blockId);
  const first=peers[0];
  const startsNewRound=next.type==='block-round'||next.ei===first&&next.si>num(w.currentSetIndex);
  return startsNewRound?Math.max(30,num(from.blockRest)||75):Math.max(5,num(from.transitionRest)||15);
}
function dynamicBlockPositionLabel(w,ex){
  if(!ex?.blockId)return '';
  const peers=blockExerciseIndexes(w,ex.blockId);
  const index=peers.indexOf(w.exercises.indexOf(ex));
  const type=ex.blockType==='tri-set'?'TRI-SET':ex.blockType==='superset'?'SUPERSET':'CIRCUIT';
  return type+(index>=0?' · '+(index+1)+' OF '+peers.length:'');
}
function workoutNowMs(w,nowMs=Date.now()){
  const paused=Date.parse(w?.pausedAt||'');
  return w?.isPaused&&Number.isFinite(paused)?paused:nowMs;
}
function workoutElapsedSeconds(w){
  const startValue=w?.trainingStartedAt||(!w?.preparedAt?w?.startedAt:'');
  const started=Date.parse(startValue||'');
  if(!Number.isFinite(started))return 0;
  const activeMs=Math.max(0,workoutNowMs(w)-started-Math.max(0,num(w?.totalPausedMs)));
  return Math.floor(activeMs/1000);
}
function wallClockElapsedSeconds(w,endAt=null){
  const started=Date.parse(w?.trainingStartedAt||w?.startedAt||'');
  const ended=Date.parse(endAt||'');
  const end=Number.isFinite(ended)?ended:Date.now();
  return Number.isFinite(started)?Math.max(0,Math.floor((end-started)/1000)):0;
}
function markPhaseStart(w,key,at=new Date().toISOString()){
  if(!w)return;
  w.phaseTimestamps=w.phaseTimestamps||{};
  w.phaseTimestamps[key]=w.phaseTimestamps[key]||{};
  if(!w.phaseTimestamps[key].startedAt)w.phaseTimestamps[key].startedAt=at;
}
function markPhaseEnd(w,key,at=new Date().toISOString()){
  if(!w)return;
  w.phaseTimestamps=w.phaseTimestamps||{};
  w.phaseTimestamps[key]=w.phaseTimestamps[key]||{};
  w.phaseTimestamps[key].endedAt=at;
}
function markExerciseStart(w,index,at=new Date().toISOString()){
  const ex=w?.exercises?.[index];if(!ex)return;
  if(!ex.startedAt)ex.startedAt=at;
}
function markExerciseEnd(w,index,at=new Date().toISOString()){
  const ex=w?.exercises?.[index];if(!ex)return;
  ex.endedAt=at;
}
function exerciseNeedsSideSwitch(ex){
  return exerciseLaterality(ex)==='unilateral'&&exerciseRepCountMode(ex)==='per-side';
}
function exerciseSideSwitchSeconds(ex){
  if(!exerciseNeedsSideSwitch(ex))return 0;
  return ['single-leg','squat','hinge','calves'].includes(ex?.movement)?8:5;
}
function activeExerciseSide(set){
  return set?.activeSide==='left'?'left':'right';
}
function exerciseElapsedSeconds(w){
  if(!w?.exerciseStartedAt)return 0;
  return Math.max(0,Math.floor((workoutNowMs(w)-new Date(w.exerciseStartedAt).getTime())/1000));
}
function timedStageItems(w){
  if(!w) return [];
  return w.phase==='warmup'?(w.warmup||[]):w.phase==='cooldown'?(w.cooldown||[]):[];
}
function timedStageSideLabel(w,item){
  if(!item?.side)return '';
  return w?.timedStageSide==='left'?'LEFT SIDE':'RIGHT SIDE';
}
function timedStageSwitchSeconds(item){
  return Math.max(3,Math.min(12,num(item?.sideSwitchSeconds)||5));
}
function timedStageSnapshot(w,nowMs=Date.now()){
  if(!w||!['warmup','cooldown'].includes(w.phase)) return null;
  const items=timedStageItems(w);
  if(!items.length) return {complete:true,index:0,remaining:0,remainingExact:0,total:0};
  const index=Math.max(0,Math.min(Number(w.timedStageIndex)||0,items.length-1));
  const item=items[index];
  nowMs=workoutNowMs(w,nowMs);
  if(w.timedStageAwaitingStart)return {complete:false,itemComplete:false,index,mode:'ready',side:timedStageSideLabel(w,item),remaining:0,remainingExact:0,total:Number(item?.seconds)||0};
  const switchEnd=Date.parse(w.timedStageSwitchEndsAt||'');
  if(item?.side&&Number.isFinite(switchEnd)){
    const total=timedStageSwitchSeconds(item);
    const remainingExact=Math.max(0,(switchEnd-nowMs)/1000);
    return {complete:false,itemComplete:false,index,mode:'switch',side:'switch',nextSide:'left',remaining:Math.max(0,Math.ceil(remainingExact)),remainingExact,total};
  }
  if(w.reviewPausedTimedStage&&w.reviewPausedTimedStage.phase===w.phase){
    const paused=w.reviewPausedTimedStage;
    if(paused.mode==='reps'){
      return {complete:false,itemComplete:false,index,mode:'reps',side:paused.side||timedStageSideLabel(w,item),completedReps:Number(paused.completedReps)||0,totalReps:Number(item.reps)||8,total:0,remaining:0,remainingExact:0};
    }
    return {complete:false,itemComplete:false,index,mode:'time',side:paused.side||timedStageSideLabel(w,item),remaining:Math.max(0,Math.ceil(Number(paused.remainingExact)||0)),remainingExact:Math.max(0,Number(paused.remainingExact)||0),total:Number(paused.total)||Number(item.seconds)||30};
  }
  if(item.mode==='reps'||item.reps){
    const completedReps=Math.max(0,Number(w.timedStageReps)||0);
    const totalReps=Math.max(1,Number(item.reps)||8);
    return {complete:false,itemComplete:completedReps>=totalReps,index,mode:'reps',side:timedStageSideLabel(w,item),completedReps,totalReps,total:0,remaining:0,remainingExact:0};
  }
  const startMs=Date.parse(w.timedPhaseStartedAt||'');
  if(!Number.isFinite(startMs)) return null;
  const total=Math.max(1,Number(item.seconds)||30);
  const elapsed=Math.max(0,(nowMs-startMs)/1000);
  const remainingExact=Math.max(0,total-elapsed);
  return {complete:false,itemComplete:remainingExact<=0,index,mode:'time',side:timedStageSideLabel(w,item),remaining:Math.max(0,Math.ceil(remainingExact)),remainingExact,total};
}
function stageRemaining(w){ return timedStageSnapshot(w)?.remaining||0; }
function beginTimedStageSideSwitch(w){
  if(!w||!['warmup','cooldown'].includes(w.phase))return;
  const item=timedStageItems(w)[w.timedStageIndex||0];
  if(!item?.side||w.timedStageSide==='left'){advanceTimedStage();return;}
  const now=new Date().toISOString(),seconds=timedStageSwitchSeconds(item);
  item.rightEndedAt=now;
  w.timedStageSwitchStartedAt=now;
  w.timedStageSwitchEndsAt=new Date(Date.now()+seconds*1000).toISOString();
  w.timedStageReps=0;
  fireWorkoutSignal('transition','side-switch-'+w.id+'-'+w.phase+'-'+w.timedStageIndex,{voice:'Switch sides',label:'SWITCH'});
  saveStore();render();
}
function finishTimedStageSideSwitch(){
  const w=store.activeWorkout;if(!w||!['warmup','cooldown'].includes(w.phase)||!w.timedStageSwitchEndsAt)return;
  const now=new Date().toISOString();
  w.timedStageSide='left';
  const item=timedStageItems(w)[w.timedStageIndex||0];
  w.timedStageReps=(item?.mode==='reps'||item?.reps)?Math.max(1,num(item.reps)||8):0;
  if(item)item.leftStartedAt=now;
  w.timedPhaseStartedAt=now;
  delete w.timedStageSwitchStartedAt;delete w.timedStageSwitchEndsAt;
  fireWorkoutSignal('go','side-go-'+w.id+'-'+w.phase+'-'+w.timedStageIndex,{voice:'Left side. Go.',label:'GO'});
  saveStore();render();
}
function skipTimedStage(){
  const w=store.activeWorkout;if(!w||!['warmup','cooldown'].includes(w.phase))return;
  cancelCoachTimeline();
  unlockWorkoutCues();
  const item=timedStageItems(w)[w.timedStageIndex||0];
  if(item)item.skippedAt=new Date().toISOString();
  delete w.timedStageSwitchStartedAt;delete w.timedStageSwitchEndsAt;
  advanceTimedStage();
}

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
  cancelCoachTimeline();
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
    workoutMapOpen=false;
    saveStore();render();
    return;
  }
  workoutMapOpen=false;
  if(announce){
    beginPreSetPosition(index,w.currentSetIndex,true,5);
    return;
  }
  w.phase='pre-set';
  w.preSetCoachPending=false;
  w.preSetFinishing=false;
  w.preSetStartedAt=new Date().toISOString();
  w.preSetSetupSeconds=5;
  w.preSetCountdownSeconds=3;
  w.preSetIsNewExercise=true;
  w.exerciseStartedAt=null;
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
  const now=new Date().toISOString();
  ex.manualComplete=true;ex.manualCompletedAt=now;ex.endedAt=now;ex.skipped=false;ex.skipReason='';
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
  ex.skipped=true;ex.skipReason=reason;ex.manualComplete=false;ex.manualCompletedAt=null;ex.endedAt=new Date().toISOString();
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

function beginPreSetPosition(ei,si,isNewExercise=true,setupSeconds=null){
  const w=store.activeWorkout;if(!w)return;
  const previousIndex=w.currentExerciseIndex||0;
  if(isNewExercise&&w.exerciseStartedAt&&previousIndex!==ei)recordExerciseDuration(w,previousIndex);
  w.currentExerciseIndex=ei;
  w.furthestExerciseIndex=Math.max(num(w.furthestExerciseIndex),ei);
  w.currentSetIndex=si;
  prepareSetTarget(w.exercises[ei],w.exercises[ei]?.sets?.[si],si);
  const settings=workoutCueSettings();
  const exercise=w.exercises[ei];
  const manualStart=exercise?.loadMode!=='timed'||!settings.autoStartTimedExercise;
  const previewKey=strengthPreviewKey(w,{ei,si,type:isNewExercise?'exercise':'set'});
  const previewAlreadySpoken=timelineWasPlayed(previewKey);
  const formLine=exerciseInstructionLine(exercise,si);
  const needsIntro=Boolean(isNewExercise&&!previewAlreadySpoken);
  const gateForCoach=Boolean(settings.voice&&settings.aiCoach&&(needsIntro||formLine));
  w.phase='pre-set';
  w.preSetCoachPending=gateForCoach;
  w.preSetManualStart=manualStart;
  w.preSetStartedAt=(gateForCoach||manualStart)?null:new Date().toISOString();
  w.preSetSetupSeconds=(gateForCoach||manualStart)?0:(setupSeconds===null?(isNewExercise?5:0):Math.max(0,num(setupSeconds)));
  w.preSetCountdownSeconds=3;
  w.preSetIsNewExercise=Boolean(isNewExercise);
  w.preSetFinishing=false;
  w.restEndsAt=null;w.restDuration=0;w.restPausedRemaining=null;w.pendingPosition=null;
  primeCoachCuePack();
  if(isNewExercise)w.exerciseStartedAt=null;
  w.lastProgressionResult=null;
  saveStore();render();
  const workoutId=w.id;
  let sequence=Promise.resolve();
  if(needsIntro)sequence=sequence.then(()=>announceExercise(exercise,ei===0?'First exercise':'Next exercise'));
  if(formLine)sequence=sequence.then(()=>playExerciseInstruction(w,ei,si));
  if(gateForCoach){
    Promise.race([
      sequence.then(()=> 'complete'),
      new Promise(resolve=>setTimeout(()=>resolve('timeout'),12000))
    ]).then(status=>{
      const active=store.activeWorkout;
      if(!active||active.id!==workoutId||active.phase!=='pre-set'||active.currentExerciseIndex!==ei||active.currentSetIndex!==si||!active.preSetCoachPending)return;
      if(status==='timeout')window.GoWorkoutCoach?.cancel?.();
      active.preSetCoachPending=false;
      active.preSetStartedAt=active.preSetManualStart?null:new Date().toISOString();
      active.preSetSetupSeconds=0;
      saveStore();render();
    });
  }
}
function preSetSnapshot(w,nowMs=Date.now()){
  if(!w||w.phase!=='pre-set')return null;
  if(w.preSetCoachPending)return {complete:false,mode:'coach',remaining:3,total:3};
  if(w.preSetManualStart)return {complete:false,mode:'ready',remaining:0,total:0};
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
function waitForCoachBeat(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function runSetStartCountdown(w,pos){
  const settings=workoutCueSettings();
  const steps=[['3','warning'],['2','warning'],['1','warning']];
  for(const [voice,type] of steps){
    const started=Date.now();
    await fireWorkoutSignal(type,'manual-preset-'+w.id+'-'+pos.ei+'-'+pos.si+'-'+voice,{voice,label:voice});
    const elapsed=Date.now()-started;
    if(elapsed<650)await waitForCoachBeat(650-elapsed);
  }
  return fireWorkoutSignal('go','go-'+w.id+'-'+pos.ei+'-'+pos.si,{voice:'Go',label:'GO'});
}
function finishPreSet(forceCountdown=false){
  const w=store.activeWorkout;if(!w||w.phase!=='pre-set'||w.preSetFinishing)return;
  const pos=getActivePosition();if(!pos)return;
  if(w.preSetCoachPending){
    w.preSetCoachPending=false;
    window.GoWorkoutCoach?.stop?.();
  }
  prepareSetTarget(pos.exercise,pos.set,pos.si);
  w.preSetFinishing=true;
  saveStore();render();

  const beginWork=()=>{
    const active=store.activeWorkout;
    if(!active||active.id!==w.id||active.phase!=='pre-set'||active.currentExerciseIndex!==pos.ei||active.currentSetIndex!==pos.si)return;
    const current=getActivePosition();if(!current)return;
    const now=new Date().toISOString();
    if(!active.exerciseStartedAt)active.exerciseStartedAt=now;
    markExerciseStart(active,current.ei,now);
    current.set.plannedWeight=String(current.set.weight??'');
    current.set.plannedReps=String(current.set.reps??'');
    current.set.startedAt=now;
    if(exerciseNeedsSideSwitch(current.exercise)){
      current.set.activeSide=current.set.activeSide==='left'?'left':'right';
      current.set.sideStartedAt=now;
      current.set.sides=current.set.sides||{};
    }
    delete active.preSetStartedAt;delete active.preSetSetupSeconds;delete active.preSetCountdownSeconds;delete active.preSetIsNewExercise;delete active.preSetCoachPending;delete active.preSetManualStart;delete active.preSetFinishing;
    if(current.exercise.loadMode==='timed'){
      const seconds=Math.max(1,num(current.set.reps)||num(current.exercise.suggestedReps)||recommendedRepCount(current.exercise.reps)||30);
      current.set.reps=String(seconds);
      active.phase='timed-set';
      active.timedSetStartedAt=now;
      active.timedSetDuration=seconds;
      active.timedSetEndsAt=new Date(Date.now()+seconds*1000).toISOString();
      delete active.setStartedAt;
    }else{
      active.phase='work';
      active.setStartedAt=now;
    }
    saveStore();render();
  };

  const fullCountdown=Boolean(forceCountdown||w.preSetManualStart);
  const startPromise=fullCountdown
    ? runSetStartCountdown(w,pos)
    : fireWorkoutSignal('go','go-'+w.id+'-'+pos.ei+'-'+pos.si,{voice:'Go',label:'GO'});
  Promise.resolve(startPromise).finally(beginWork);
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
  const endedAt=new Date().toISOString();
  pos.set.completed=true;pos.set.completedAt=endedAt;pos.set.endedAt=endedAt;
  pos.set.durationSeconds=num(pos.set.reps);
  if((pos.exercise.sets||[]).every(set=>setIsResolved(set)))markExerciseEnd(w,pos.ei,endedAt);
  w.lastCompletedSet={exerciseId:pos.exercise.id,exerciseName:pos.exercise.name,weight:String(pos.set.weight||''),reps:String(pos.set.reps||''),durationSeconds:pos.set.durationSeconds,plannedWeight:String(pos.set.plannedWeight||''),plannedReps:String(pos.set.plannedReps||duration)};
  const insight=setPerformanceInsight(pos.exercise,pos.set,pos.si);
  pos.set.performanceInsight=insight;
  w.lastSetInsight=insight;
  delete w.timedSetStartedAt;delete w.timedSetDuration;delete w.timedSetEndsAt;
  fireWorkoutSignal('complete','complete-'+w.id+'-'+pos.ei+'-'+pos.si,{voice:'Done',label:'DONE'});
  const next=nextPosition(w,pos.ei,pos.si);
  if(next&&sameDynamicBlock(pos.exercise,w.exercises[next.ei])){
    beginRest(next,blockRestSeconds(w,pos.ei,next)||15);return;
  }
  if(!next||next.ei!==pos.ei){startExerciseFeedback(next);return;}
  beginRest(next,pos.exercise.rest||45);
}

function startCooldown(){
  const w=store.activeWorkout;if(!w)return;
  recordExerciseDuration(w,w.currentExerciseIndex);
  const now=new Date().toISOString();
  markExerciseEnd(w,w.currentExerciseIndex,now);
  markPhaseEnd(w,'strength',now);
  markPhaseStart(w,'cooldown',now);
  w.phase='cooldown';
  w.exerciseStartedAt=null;
  w.timedStageIndex=0;
  const firstCooldown=w.cooldown?.[0];
  w.timedStageReps=(firstCooldown?.mode==='reps'||firstCooldown?.reps)?Math.max(1,num(firstCooldown.reps)||8):0;
  w.timedStageSide=firstCooldown?.side?'right':'';
  w.timedPhaseSkippedSeconds=0;
  delete w.reviewPausedTimedStage;
  if(!w.cooldown?.length){markPhaseEnd(w,'cooldown',now);openWorkoutReview();return;}
  const extra=coachStageExtra(w,firstCooldown,0,'cooldown');
  const intro=playPreparedWorkoutCoach(
    'cooldown_started',
    extra,
    'Strength work is done. Let’s cool down with '+(firstCooldown?.name||'the first stretch')+'.',
    'coach-cooldown-start-'+w.id
  );
  const nextCooldown=w.cooldown?.[1];
  if(nextCooldown)prefetchGuidedStageCoach('stretch_started',w,nextCooldown,1,'cooldown');
  beginGuidedStageAfterInstruction(w,'cooldown',0,intro);
}
function completeTimedStagePhase(w){
  if(w.phase==='warmup'){
    const now=new Date().toISOString();
    const current=timedStageItems(w)[w.timedStageIndex||0];
    if(current)current.endedAt=now;
    w.timedPhaseStartedAt=null;
    w.timedPhaseSkippedSeconds=0;
    completeWarmup();
    return;
  }
  const now=new Date().toISOString();
  const current=timedStageItems(w)[w.timedStageIndex||0];
  if(current)current.endedAt=now;
  w.timedPhaseStartedAt=null;
  w.timedStageAwaitingStart=false;
  w.timedStageStarting=false;
  w.timedPhaseSkippedSeconds=0;
  w.timedStageSide='';
  markPhaseEnd(w,'cooldown',now);
  fireWorkoutSignal('complete','cooldown-complete-'+w.id,{voice:'',label:'DONE'});
  emitWorkoutCoach('cooldown_completed',{},'Cooldown complete. Review your workout before saving.','coach-cooldown-complete-'+w.id);
  openWorkoutReview();
}
function reconcileTimedStage(){
  const w=store.activeWorkout;
  if(!w||!['warmup','cooldown'].includes(w.phase))return false;
  const snap=timedStageSnapshot(w);
  if(!snap)return false;
  if(snap.mode==='switch'&&snap.remaining<=0){finishTimedStageSideSwitch();return true;}
  if((snap.mode==='time'||snap.mode==='reps')&&snap.itemComplete){
    const item=timedStageItems(w)[snap.index];
    if(item?.side&&w.timedStageSide!=='left'){beginTimedStageSideSwitch(w);return true;}
    advanceTimedStage();return true;
  }
  return false;
}

function advanceTimedStage(){
  const w=store.activeWorkout;if(!w||!['warmup','cooldown'].includes(w.phase))return;
  const items=timedStageItems(w);
  if(!items.length){completeTimedStagePhase(w);return;}
  const index=Math.max(0,Math.min(Number(w.timedStageIndex)||0,items.length-1));
  const now=new Date().toISOString();
  if(items[index])items[index].endedAt=now;
  delete w.timedStageSwitchStartedAt;delete w.timedStageSwitchEndsAt;
  if(index>=items.length-1){completeTimedStagePhase(w);return;}

  w.timedStageIndex=index+1;
  const next=items[w.timedStageIndex];
  w.timedStageReps=(next?.mode==='reps'||next?.reps)?Math.max(1,num(next.reps)||8):0;
  w.timedStageSide=next?.side?'right':'';
  delete w.reviewPausedTimedStage;

  const previewKey=guidedPreviewKey(w,w.phase,w.timedStageIndex);
  if(!timelineWasPlayed(previewKey)){
    const extra=coachStageExtra(w,next,w.timedStageIndex,w.phase);
    const target=extra.stage?.target||'';
    playPreparedWorkoutCoach(
      'stretch_started',
      extra,
      (next?.name||'Next movement')+'. '+target+'.',
      'coach-stage-'+w.id+'-'+w.phase+'-'+w.timedStageIndex
    );
  }
  prefetchGuidedLookahead(w);

  const auto=guidedAutoStartEnabled(w.phase);
  w.timedStageAwaitingStart=true;
  w.timedStageStarting=auto;
  w.timedPhaseStartedAt=null;
  fireWorkoutSignal('transition','stage-'+w.id+'-'+w.phase+'-'+w.timedStageIndex,{voice:'',label:'NEXT'});
  saveStore();render();

  if(!auto)return;

  const workoutId=w.id,phase=w.phase,nextIndex=w.timedStageIndex;
  fireWorkoutSignal('go','guided-transition-go-'+workoutId+'-'+phase+'-'+nextIndex,{voice:'Go',label:'GO'}).finally(()=>{
    const active=store.activeWorkout;
    if(!active||active.id!==workoutId||active.phase!==phase||active.timedStageIndex!==nextIndex)return;
    active.timedStageAwaitingStart=false;
    active.timedStageStarting=false;
    active.timedPhaseStartedAt=new Date().toISOString();
    const activeItem=timedStageItems(active)[nextIndex];
    if(activeItem&&!activeItem.startedAt)activeItem.startedAt=active.timedPhaseStartedAt;
    prefetchGuidedLookahead(active);
    saveStore();render();
  });
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
  const safeRest=Math.max(5,Math.min(180,seconds||45));
  const now=new Date().toISOString();
  w.phase='rest';w.restDuration=safeRest;w.restEndsAt=new Date(Date.now()+safeRest*1000).toISOString();
  w.restPausedRemaining=null;w.restToken=newTimerToken('rest',w);w.pendingPosition=next;
  w.restLog=Array.isArray(w.restLog)?w.restLog:[];
  w.restLog.push({token:w.restToken,startedAt:now,endedAt:null,plannedSeconds:safeRest,fromExerciseId:w.exercises?.[w.currentExerciseIndex]?.id||'',toExerciseId:w.exercises?.[next.ei]?.id||'',skipped:false});
  if(next.ei!==w.currentExerciseIndex)prefetchExerciseCoach(w.exercises?.[next.ei],next.ei);
  prepareStrengthTimeline(w,next);
  saveStore();render();
}
function closeRestLog(w,token,{skipped=false}={}){
  const entry=[...(w?.restLog||[])].reverse().find(item=>item.token===token&&!item.endedAt);
  if(!entry)return;
  entry.endedAt=new Date().toISOString();
  entry.actualSeconds=Math.max(0,Math.round((Date.parse(entry.endedAt)-Date.parse(entry.startedAt))/1000));
  entry.skipped=Boolean(skipped);
}

function startExerciseFeedback(next){
  const w=store.activeWorkout;
  if(!w)return;
  markExerciseEnd(w,w.currentExerciseIndex);
  w.phase='feedback';
  w.pendingPosition=next;
  saveStore();
  render();
}
function sideSwitchRemaining(w){
  if(!w||w.phase!=='side-switch')return 0;
  if(Number.isFinite(w.sideSwitchPausedRemaining))return Math.max(0,Math.ceil(w.sideSwitchPausedRemaining));
  const end=Date.parse(w.sideSwitchEndsAt||'');
  if(!Number.isFinite(end))return 0;
  return Math.max(0,Math.ceil((end-workoutNowMs(w))/1000));
}
function beginExerciseSideSwitch(pos){
  const w=pos?.workout,set=pos?.set,ex=pos?.exercise;
  if(!w||!set||!ex)return;
  const seconds=exerciseSideSwitchSeconds(ex)||5;
  const now=new Date().toISOString();
  set.activeSide='switch';
  set.sideSwitchStartedAt=now;
  w.phase='side-switch';
  w.sideSwitchStartedAt=now;
  w.sideSwitchDuration=seconds;
  w.sideSwitchEndsAt=new Date(Date.now()+seconds*1000).toISOString();
  w.sideSwitchPausedRemaining=null;
  fireWorkoutSignal('transition','exercise-side-switch-'+w.id+'-'+pos.ei+'-'+pos.si,{voice:'Switch sides',label:'SWITCH'});
  saveStore();render();
}
function finishExerciseSideSwitch(){
  const pos=getActivePosition();if(!pos||pos.workout.phase!=='side-switch')return;
  const now=new Date().toISOString();
  pos.set.activeSide='left';
  pos.set.sideStartedAt=now;
  pos.set.sideSwitchEndedAt=now;
  pos.workout.phase='work';
  pos.workout.setStartedAt=now;
  delete pos.workout.sideSwitchStartedAt;delete pos.workout.sideSwitchEndsAt;delete pos.workout.sideSwitchDuration;delete pos.workout.sideSwitchPausedRemaining;
  fireWorkoutSignal('go','exercise-left-side-'+pos.workout.id+'-'+pos.ei+'-'+pos.si,{voice:'Left side. Go.',label:'GO'});
  saveStore();render();
}
function skipExerciseSideSwitch(){
  const w=store.activeWorkout;if(!w||w.phase!=='side-switch')return;
  finishExerciseSideSwitch();
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
  emitWorkoutCoach('exercise_feedback',{
    feedback,
    progression:result,
    exercise:{
      name:pos.exercise.name,
      setNumber:pos.exercise.sets?.length||0,
      totalSets:pos.exercise.sets?.length||0,
      weight:String(pos.workout.lastCompletedSet?.weight||''),
      reps:String(pos.workout.lastCompletedSet?.reps||''),
      target:currentPrescriptionLabel(pos.exercise),
      loadMode:pos.exercise.loadMode||''
    },
    completedSets:(pos.exercise.sets||[]).filter(set=>set.completed).length,
    performanceInsight:typeof pos.workout.lastSetInsight==='string'?pos.workout.lastSetInsight:''
  },feedbackCoachFallback(feedback,result),'feedback-'+pos.workout.id+'-'+pos.exercise.id+'-'+Date.now());
  beginRest(next,pos.exercise.rest||45);
}

function completeCurrentSet(){
  const pos=getActivePosition(); if(!pos||pos.workout.phase!=='work')return;
  if(pos.set.completed){toast('That set is already logged.');return;}
  const weight=String(pos.set.weight??document.querySelector('#set-weight')?.value??'').trim().replace(/[^0-9.]/g,'');
  const reps=String(pos.set.reps??document.querySelector('#set-reps')?.value??'').trim().replace(/[^0-9.]/g,'');
  if(num(reps)<=0){toast(pos.exercise.loadMode==='timed'?'Enter the seconds completed.':'Enter the reps completed.');return;}
  const unilateral=exerciseNeedsSideSwitch(pos.exercise);
  const side=unilateral?activeExerciseSide(pos.set):'both';
  const actionKey=workoutActionKey(pos.workout,'complete-set-'+side,pos.ei,pos.si);
  if(!claimWorkoutAction(pos.workout,actionKey)){toast('That side is already logged.');return;}
  const endedAt=new Date().toISOString();
  pos.set.plannedWeight=String(pos.set.plannedWeight??weight);
  pos.set.plannedReps=String(pos.set.plannedReps??reps);
  pos.set.weight=weight;pos.set.reps=reps;
  if(unilateral){
    pos.set.sides=pos.set.sides||{};
    pos.set.sides[side]={
      weight,reps,
      startedAt:pos.set.sideStartedAt||pos.set.startedAt||endedAt,
      endedAt,
      durationSeconds:Math.max(1,setElapsedSeconds(pos.workout))
    };
    delete pos.workout.setStartedAt;
    if(side==='right'){
      fireWorkoutSignal('complete','complete-side-'+pos.workout.id+'-'+pos.ei+'-'+pos.si+'-right',{voice:'Right side complete',label:'DONE'});
      beginExerciseSideSwitch(pos);
      return;
    }
    const right=pos.set.sides.right||{};
    pos.set.reps=String(Math.min(num(right.reps)||num(reps),num(reps)));
    pos.set.weight=weight||String(right.weight||'');
    pos.set.durationSeconds=Math.max(1,num(right.durationSeconds)+num(pos.set.sides.left.durationSeconds));
    pos.set.activeSide='done';
  }else{
    pos.set.durationSeconds=Math.max(1,setElapsedSeconds(pos.workout));
    delete pos.workout.setStartedAt;
  }
  pos.set.completed=true;pos.set.completedAt=endedAt;pos.set.endedAt=endedAt;
  if((pos.exercise.sets||[]).every(set=>setIsResolved(set)))markExerciseEnd(pos.workout,pos.ei,endedAt);
  const insight=setPerformanceInsight(pos.exercise,pos.set,pos.si);
  pos.set.performanceInsight=insight;
  pos.workout.lastSetInsight=insight;
  pos.workout.lastCompletedSet={exerciseId:pos.exercise.id,exerciseName:pos.exercise.name,weight:pos.set.weight,reps:pos.set.reps,durationSeconds:pos.set.durationSeconds,plannedWeight:pos.set.plannedWeight,plannedReps:pos.set.plannedReps};
  fireWorkoutSignal('complete','complete-'+pos.workout.id+'-'+pos.ei+'-'+pos.si,{voice:'Set complete',label:'DONE'});
  const next=nextPosition(pos.workout,pos.ei,pos.si);
  if(next && next.ei===pos.ei){
    const nextSet=pos.exercise.sets[next.si];
    nextSet.weight=weight;
    nextSet.reps=reps;
    nextSet.targetPrepared=true;
    nextSet.targetSource='previous-set';
  }
  if(pos.si===0 && !pos.exercise.blockId && pos.exercise.calibrationRequired && !['bodyweight','timed','band','assisted'].includes(pos.exercise.loadMode)){
    pos.workout.phase='calibrate';pos.workout.pendingPosition=next;saveStore();render();return;
  }
  if(next&&sameDynamicBlock(pos.exercise,pos.workout.exercises[next.ei])){
    beginRest(next,blockRestSeconds(pos.workout,pos.ei,next)||15);return;
  }
  if(!next||next.ei!==pos.ei){startExerciseFeedback(next);return;}
  beginRest(next,pos.exercise.rest||45);
}

function skipCurrentSet(reason='Skipped by user'){
 const pos=getActivePosition();if(!pos||pos.workout.phase!=='work')return;
 const key=workoutActionKey(pos.workout,'skip-set',pos.ei,pos.si);if(!claimWorkoutAction(pos.workout,key))return;
 pos.set.skipped=true;pos.set.skipReason=reason;pos.set.completed=false;pos.set.completedAt=null;pos.set.endedAt=new Date().toISOString();
 delete pos.workout.setStartedAt;
 const next=nextPosition(pos.workout,pos.ei,pos.si);
 if(next&&sameDynamicBlock(pos.exercise,pos.workout.exercises[next.ei])){
   beginRest(next,blockRestSeconds(pos.workout,pos.ei,next)||15);return;
 }
 if(!next||next.ei!==pos.ei){startExerciseFeedback(next);return;}
 beginRest(next,Math.min(30,pos.exercise.rest||30));
}
function skipRest(){
 const w=store.activeWorkout;if(!w||w.phase!=='rest')return;
 cancelCoachTimeline();
 const token=w.restToken;closeRestLog(w,token,{skipped:true});w.restEndsAt=new Date().toISOString();w.restPausedRemaining=null;saveStore();advanceAfterRest(token);
}
function calibrationRecommendation(ex,rir){
  const first=ex?.sets?.[0]||{};
  const actualWeight=num(first.weight)||num(ex?.suggestedWeight);
  const actualReps=Math.max(1,num(first.reps)||num(ex?.suggestedReps)||recommendedRepTarget(ex));
  const increment=Math.max(1,num(ex?.increment)||5);
  const weighted=!['bodyweight','timed','band'].includes(ex?.loadMode);
  const multiplier=rir==='5+'?1.12:rir==='3-4'?1.06:rir==='2'?1:rir==='1'?.95:.90;
  let weight=weighted?roundTo(actualWeight*multiplier,increment):actualWeight;
  let reps=actualReps;
  let reason='Keep the current target.';
  if(rir==='5+'){
    if(weight<=actualWeight){weight=actualWeight;reps=actualReps+2;reason='The load increment is too large for a safe automatic jump, so reps increase first.';}
    else reason='Plenty of clean reps remained, so the next set can use more load.';
  }else if(rir==='3-4'){
    if(weight<=actualWeight){weight=actualWeight;reps=actualReps+1;reason='A small rep increase is more appropriate than forcing a full weight jump.';}
    else reason='You had several clean reps available, so the next set can progress slightly.';
  }else if(rir==='2'){
    weight=actualWeight;reps=actualReps;reason='Two clean reps left is on target, so the working prescription stays here.';
  }else if(rir==='1'){
    if(weight>=actualWeight){weight=actualWeight;reps=Math.max(1,actualReps-1);reason='The set was close to the limit, so the next target eases slightly.';}
    else reason='The set was very hard, so the next load comes down slightly.';
  }else{
    if(weight>=actualWeight){weight=actualWeight;reps=Math.max(1,actualReps-2);reason='The set reached max effort, so reps come down before another hard attempt.';}
    else reason='Max effort is a signal to reduce the next load.';
  }
  return {weight,reps,rir,reason,label:progressionLabel(ex,weight,reps)};
}
function applyCalibration(rir){
  const pos=getActivePosition(); if(!pos||pos.workout.phase!=='calibrate')return;
  const recommendation=calibrationRecommendation(pos.exercise,rir);
  store.calibration[pos.exercise.id]={weight:recommendation.weight,reps:recommendation.reps,updatedAt:new Date().toISOString(),rir,reason:recommendation.reason};
  pos.exercise.suggestedWeight=recommendation.weight;
  pos.exercise.suggestedReps=String(recommendation.reps);
  pos.exercise.calibrationRequired=false;
  pos.exercise.calibrationResult=recommendation;
  const next=pos.workout.pendingPosition;
  if(next && next.ei===pos.ei){
    const nextSet=pos.exercise.sets[next.si];
    nextSet.weight=['bodyweight','timed','band'].includes(pos.exercise.loadMode)?'':String(recommendation.weight||'');
    nextSet.reps=String(recommendation.reps);
    nextSet.targetPrepared=true;
    nextSet.targetSource='calibration';
  }
  saveStore();
  toast('Next target: '+recommendation.label);
  if(!next||next.ei!==pos.ei){startExerciseFeedback(next);return;}
  beginRest(next,pos.exercise.rest||45);
}

function advanceAfterRest(expectedToken=null){
  const w=store.activeWorkout;if(!w||w.phase!=='rest')return;
  if(expectedToken&&w.restToken!==expectedToken)return;
  closeRestLog(w,w.restToken,{skipped:false});
  const next=w.pendingPosition;if(!next){startCooldown();return;}
  const isNewExercise=next.ei!==w.currentExerciseIndex;
  const nextEx=w.exercises?.[next.ei];
  if(nextEx?.loadMode!=='timed'||!workoutCueSettings().autoStartTimedExercise){
    playTimelineCue('Rest is up. Start when you’re ready.','rest-ready-'+w.id+'-'+next.ei+'-'+next.si,{preview:{type:'rest-complete',ei:next.ei,si:next.si}});
  }
  if(isNewExercise){
    const current=w.exercises[w.currentExerciseIndex],upcoming=w.exercises[next.ei];
    if(sameDynamicBlock(current,upcoming)){
      w.restEndsAt=null;w.restPausedRemaining=null;w.restDuration=0;
      beginPreSetPosition(next.ei,next.si,true,0);
      return;
    }
    w.restEndsAt=null;w.restPausedRemaining=null;w.restDuration=0;
    beginPreSetPosition(next.ei,next.si,true,5);
    return;
  }
  beginPreSetPosition(next.ei,next.si,false);
}
function adjustRest(delta){
  const w=store.activeWorkout;if(!w||w.phase!=='rest')return;
  const current=restRemaining(w);
  const nextRemaining=Math.max(5,Math.min(180,current+delta));
  if(Number.isFinite(w.restPausedRemaining)) w.restPausedRemaining=nextRemaining;
  else w.restEndsAt=new Date(Date.now()+nextRemaining*1000).toISOString();
  w.restDuration=Math.max(5,Math.min(180,Math.max(w.restDuration||5,nextRemaining)));
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
    cancelCoachTimeline();
    const now=new Date().toISOString();
    w.isPaused=true;
    w.pausedAt=now;
    w.pauseLog=Array.isArray(w.pauseLog)?w.pauseLog:[];
    w.pauseLog.push({startedAt:now,endedAt:null,durationSeconds:0});
    if('speechSynthesis' in window){try{window.speechSynthesis.cancel?.();}catch{}}
    saveStore();
    fireWorkoutSignal('transition','workout-paused-'+w.id+'-'+Date.now(),{voice:'Workout paused',label:'PAUSED'});
    render();
    return;
  }
  const pausedMs=Date.parse(w.pausedAt||'');
  const nowMs=Date.now();
  const delta=Math.max(0,nowMs-(Number.isFinite(pausedMs)?pausedMs:nowMs));
  w.totalPausedMs=Math.max(0,num(w.totalPausedMs))+delta;
  const pause=[...(w.pauseLog||[])].reverse().find(item=>!item.endedAt);
  if(pause){pause.endedAt=new Date(nowMs).toISOString();pause.durationSeconds=Math.max(0,Math.round(delta/1000));}
  ['exerciseStartedAt','setStartedAt','timedPhaseStartedAt','preSetStartedAt','timedSetStartedAt','timedSetEndsAt','restEndsAt','timedStageSwitchEndsAt','sideSwitchEndsAt'].forEach(key=>shiftWorkoutTimestamp(w,key,delta));
  w.isPaused=false;
  w.pausedAt=null;
  saveStore();
  fireWorkoutSignal('transition','workout-resumed-'+w.id+'-'+Date.now(),{voice:'',label:'RESUME'});
  playTimelineCue(resumeCoachLine(w),'resume-'+w.id+'-'+Date.now(),{preview:{type:'resume',phase:w.phase}});
  render();
}

function resumeCoachLine(w){
  if(!w)return 'We’re back.';
  if(w.phase==='rest')return 'We’re back. '+restRemaining(w)+' seconds left in your rest.';
  if(w.phase==='timed-set'){
    const snap=timedSetSnapshot(w);
    return snap?'We’re back. '+snap.remaining+' seconds left.':'We’re back.';
  }
  if(['warmup','cooldown'].includes(w.phase)){
    const snap=timedStageSnapshot(w),item=timedStageItems(w)[w.timedStageIndex||0];
    if(snap?.mode==='time')return 'We’re back. '+snap.remaining+' seconds left in '+(item?.name||'this movement')+'.';
    return 'We’re back. Continue '+(item?.name||'this movement')+'.';
  }
  if(w.phase==='pre-set'&&w.preSetManualStart)return 'We’re back. Start when you’re ready.';
  return 'We’re back.';
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
  }else if(w.phase==='side-switch'){
    const duration=Math.max(1,num(w.sideSwitchDuration)||exerciseSideSwitchSeconds(getActivePosition()?.exercise)||5);
    w.sideSwitchStartedAt=now.toISOString();
    w.sideSwitchEndsAt=new Date(now.getTime()+duration*1000).toISOString();
    w.sideSwitchPausedRemaining=null;
  }else if(w.phase==='pre-set'){
    w.preSetStartedAt=now.toISOString();
  }else if(w.phase==='work'){
    w.setStartedAt=now.toISOString();
  }else if(w.phase==='warmup'||w.phase==='cooldown'){
    const snap=timedStageSnapshot(w);if(!snap)return;
    if(snap.mode==='ready'){
      w.timedStageAwaitingStart=true;
      w.timedStageStarting=false;
      w.timedPhaseStartedAt=null;
    }else if(snap.mode==='switch'){
      const seconds=timedStageSwitchSeconds(timedStageItems(w)[w.timedStageIndex||0]);
      w.timedStageSwitchStartedAt=now.toISOString();
      w.timedStageSwitchEndsAt=new Date(now.getTime()+seconds*1000).toISOString();
    }else if(snap.mode==='reps'){
      w.timedStageReps=Math.max(1,num(timedStageItems(w)[w.timedStageIndex||0]?.reps)||snap.totalReps||8);
    }else{
      w.timedPhaseStartedAt=now.toISOString();
    }
  }else return;
  saveStore();
  fireWorkoutSignal('transition','timer-reset-'+w.id+'-'+w.phase+'-'+Date.now(),{voice:'Timer reset',label:'RESET'});
  render();
}

function previousBest(exerciseId,exclude=null){
  let best=null;
  const identity=exerciseHistoryIdentity(exerciseId);
  for(const w of store.history){
    if(w.id===exclude)continue;
    const ex=(w.exercises||[]).find(e=>exerciseMatchesHistory(e,identity));if(!ex)continue;
    for(const s of ex.sets){if(!s.completed)continue;const c={weight:num(s.weight),reps:num(s.reps)};
      if(!best||c.weight>best.weight||(c.weight===best.weight&&c.reps>best.reps))best=c;
    }
  }
  return best;
}
function bestLabel(exerciseId){
  const b=previousBest(exerciseId);if(!b)return 'No previous sets';
  const ex=catalog.find(e=>e.id===exerciseId);
  if(ex?.loadMode==='timed')return String(b.reps)+' sec';
  if(!b.weight)return exerciseRepDisplay(ex,b.reps);
  return exerciseWeightDisplay(ex,b.weight)+' × '+exerciseRepDisplay(ex,b.reps);
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
      w.timedStageSide=w.reviewPausedTimedStage.side==='LEFT SIDE'?'left':w.timedStageSide;
      w.timedPhaseStartedAt=new Date(now).toISOString();
    }else if(w.reviewPausedTimedStage.mode==='switch'){
      const remaining=Math.max(0,Number(w.reviewPausedTimedStage.remainingExact)||0);
      w.timedStageSwitchEndsAt=new Date(now+remaining*1000).toISOString();
    }else{
      const total=Number(items[index]?.seconds)||Number(w.reviewPausedTimedStage.total)||30;
      const remaining=Math.max(0,Number(w.reviewPausedTimedStage.remainingExact)||0);
      w.timedStageSide=w.reviewPausedTimedStage.side==='LEFT SIDE'?'left':w.timedStageSide;
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
  if(phase==='side-switch'&&Number.isFinite(w.sideSwitchPausedRemaining)){
    const remaining=Math.max(0,Number(w.sideSwitchPausedRemaining));
    w.sideSwitchEndsAt=new Date(now+remaining*1000).toISOString();
    delete w.sideSwitchPausedRemaining;
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
  const wallClockSeconds=wallClockElapsedSeconds(w,completedAt);
  const activeDurationSeconds=workoutElapsedSeconds(w);
  const currentPauseMs=w.isPaused?Math.max(0,Date.parse(completedAt)-Date.parse(w.pausedAt||completedAt)):0;
  const totalPausedMs=Math.max(0,num(w.totalPausedMs))+currentPauseMs;
  const openPause=[...(w.pauseLog||[])].reverse().find(item=>!item.endedAt);
  if(openPause){openPause.endedAt=completedAt;openPause.durationSeconds=Math.max(0,Math.round((Date.parse(completedAt)-Date.parse(openPause.startedAt))/1000));}
  const entry={...w,phase:'complete',completionStatus:status,completedAt,endedAt:completedAt,actualCompletedDate:dateKey(),durationMinutes:Math.max(1,Math.round(activeDurationSeconds/60)),activeDurationSeconds,elapsedMinutes:Math.max(1,Math.round(wallClockSeconds/60)),wallClockSeconds,totalPausedMs,completedSets:count,resolvedExercises:workoutResolvedCount(w),totalVolume:volume(w.exercises),newPRs:[],baselines:[]};
  for(const ex of entry.exercises){
    let session=null;
    for(const set of ex.sets||[]){if(!set.completed)continue;const c={weight:num(set.weight),reps:num(set.reps)};
      if(!session||c.weight>session.weight||(c.weight===session.weight&&c.reps>session.reps))session=c;
    }
    const before=old.get(ex.id);
    if(session&&!before)entry.baselines.push({exerciseId:ex.id,name:ex.name,...session});
    else if(session&&(session.weight>before.weight||(session.weight===before.weight&&session.reps>before.reps)))entry.newPRs.push({exerciseId:ex.id,name:ex.name,...session});
  }
  emitWorkoutCoach('workout_completed',{
    durationMinutes:entry.durationMinutes,
    completedSets:entry.completedSets,
    exerciseCount:entry.resolvedExercises,
    newPRs:entry.newPRs
  },'That’s it'+(displayName()==='there'?'':' '+displayName())+'. Workout complete.','workout-complete-'+entry.id);
  entry.learnerLearning=ingestLearnerWorkout(entry);
  if(entry.engineBacked){ingestEngineWorkout(entry);maybeCreateNextEngineBlock(entry);}
  ['pendingPosition','restEndsAt','restPausedRemaining','restToken','lastProgressionResult','preSetStartedAt','preSetSetupSeconds','preSetCountdownSeconds','preSetIsNewExercise','preSetCoachPending','preSetManualStart','preSetFinishing','pausedAt','isPaused','timedSetStartedAt','timedSetDuration','timedSetEndsAt','timedSetPausedRemaining','timedStageSwitchStartedAt','timedStageSwitchEndsAt','sideSwitchStartedAt','sideSwitchEndsAt','sideSwitchDuration','sideSwitchPausedRemaining','returnPhase'].forEach(key=>delete entry[key]);
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
  const index=store.history.findIndex(item=>item.id===id);
  const workout=store.history[index];if(!workout)return;
  if(!confirm('Remove '+workout.routineName+' from history? Weekly status, PR context, and adaptive recommendations will recalculate from the remaining workouts.'))return;
  historyLastRemoved={workout:clone(workout),index,lastSummaryId:store.lastSummaryId};
  store.history.splice(index,1);
  if(store.lastSummaryId===id)store.lastSummaryId=null;
  rebuildDerivedTrainingState();saveStore();historyMenuId=null;render();toast('Workout removed. You can undo it from History.');
}
function undoHistoryRemove(){
  if(!historyLastRemoved?.workout)return;
  const index=Math.max(0,Math.min(num(historyLastRemoved.index),store.history.length));
  store.history.splice(index,0,clone(historyLastRemoved.workout));
  store.lastSummaryId=historyLastRemoved.lastSummaryId||store.lastSummaryId;
  historyLastRemoved=null;
  rebuildDerivedTrainingState();saveStore();render();toast('Workout restored.');
}
function saveHistoryNote(id){
  const item=store.history.find(entry=>entry.id===id);if(!item)return;
  const input=document.querySelector('#history-workout-note');
  item.note=String(input?.value||'').trim();
  item.noteUpdatedAt=new Date().toISOString();
  saveStore();render();toast('Workout note saved.');
}
function saveHistoryExerciseNote(id,index){
  const item=store.history.find(entry=>entry.id===id),ex=item?.exercises?.[index];if(!item||!ex)return;
  const input=document.querySelector('[data-history-exercise-note="'+index+'"]');
  ex.note=String(input?.value||'').trim();
  ex.noteUpdatedAt=new Date().toISOString();
  saveStore();render();toast('Exercise note saved.');
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
  const tabs=[['week','Schedule'],['program','Program'],['exercises','Library']];
  return '<div class="train-tabs train-tabs-v2" role="tablist" aria-label="Train sections">'+tabs.map(([id,label])=>
    '<button type="button" role="tab" aria-selected="'+(trainView===id?'true':'false')+'" class="train-tab '+(trainView===id?'active':'')+'" data-action="set-train-view" data-train-view="'+id+'">'+label+'</button>'
  ).join('')+'</div>';
}
function trainPhaseMeta(week){
  return ({
    1:{label:'ESTABLISH',copy:'Set your baseline and learn the working targets.'},
    2:{label:'BUILD',copy:'Repeat anchors and progress where your results support it.'},
    3:{label:'PUSH',copy:'Highest working demand of the block, with measured progression.'},
    4:{label:'CONSOLIDATE',copy:'Reduce fatigue while keeping the movements that measure progress.'}
  })[week]||{label:'BUILD',copy:'Keep progressing through the block.'};
}
function trainExerciseNames(day,limit=3){
  const names=(day?.exercises||[]).map(ex=>ex.name).filter(Boolean);
  return {shown:names.slice(0,limit),remaining:Math.max(0,names.length-limit)};
}
function trainExercisePreviewMarkup(day,limit=3){
  const names=trainExerciseNames(day,limit);
  if(!names.shown.length)return '';
  return '<div class="train-exercise-preview">'+names.shown.map(name=>'<span>'+esc(name)+'</span>').join('')+
    (names.remaining?'<span class="more">+'+names.remaining+' more</span>':'')+'</div>';
}
function trainDayMedia(day){
  for(const ex of day?.exercises||[]){
    const spec=exerciseMediaSpec(ex);
    if(['reference','missing'].includes(spec.status))continue;
    const src=exerciseMediaFrameUrl(ex,0);
    if(src)return src;
  }
  return '';
}
function trainCompletedSessionMarkup(entry){
  const h=entry.history;
  if(!h)return '';
  const timing=historyTimingInfo(h);
  const result=historyPerformanceHighlight(h);
  return '<div class="train-completed-result"><span>'+(timing.activeMinutes!==null?timing.activeMinutes+' min':'Completed')+'</span><strong>'+esc(result)+'</strong></div>';
}
function trainSessionCard(entry,{primary=false}={}){
  const planned=entry.adaptedDay||entry.day;
  const day=entry.status==='complete'&&entry.history
    ?{...planned,name:entry.history.routineName||planned?.name,exercises:entry.history.exercises?.length?entry.history.exercises:planned?.exercises}
    :planned;
  const status=entry.status||'upcoming';
  const statusLabel=status==='complete'?'COMPLETED':status==='today'?'TODAY':status==='missed'?'AVAILABLE':status==='partial'?'PARTIAL':status==='skipped'?'SKIPPED':'UPCOMING';
  if(primary){
    const media=trainDayMedia(day);
    return '<article class="train-next-session-card status-'+status+(media?' has-media':'')+'">'+
      (media?'<img class="train-next-session-media" src="'+esc(media)+'" alt="" loading="lazy" decoding="async">':'')+
      '<div class="train-next-session-shade"></div>'+
      '<div class="train-next-session-copy"><span>'+statusLabel+'</span><h3>'+esc(day?.name||'Training')+'</h3><p>'+esc(day?.focus||'Training')+'</p>'+
        '<small>'+esc(entry.date.toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'}))+' · '+(day?.exercises?.length||0)+' exercises · ~'+(day?.estimatedMinutes||store.profile?.minutes||45)+' min</small>'+
        trainExercisePreviewMarkup(day,3)+
      '</div>'+
      '<div class="train-next-session-action">'+(!store.activeWorkout?'<button class="button primary-action" data-action="preview-train-day" data-day-id="'+esc(entry.day.id)+'" data-scheduled-date="'+esc(entry.dateKey)+'">PREVIEW WORKOUT</button>':'')+'</div>'+
    '</article>';
  }
  return '<article class="train-session-row status-'+status+'">'+
    '<div class="train-session-node">'+(status==='complete'?'✓':entry.date.getDate())+'</div>'+
    '<div class="train-session-copy"><span>'+statusLabel+' · '+esc(entry.date.toLocaleDateString(undefined,{weekday:'short'}))+'</span><strong>'+esc(day?.name||'Training')+'</strong>'+
      (status==='complete'?trainCompletedSessionMarkup(entry):'<small>'+esc(day?.focus||'Training')+' · '+(day?.exercises?.length||0)+' exercises · ~'+(day?.estimatedMinutes||store.profile?.minutes||45)+' min</small>'+trainExercisePreviewMarkup(day,2))+
    '</div>'+
    (status!=='complete'&&!store.activeWorkout?'<button class="text-button" data-action="preview-train-day" data-day-id="'+esc(entry.day.id)+'" data-scheduled-date="'+esc(entry.dateKey)+'">PREVIEW</button>':'')+
  '</article>';
}
function renderTrainBlockTimeline(context){
  const labels=['Establish','Build','Push','Consolidate'];
  return '<section class="train-block-timeline train-block-timeline-v2"><div class="train-block-head"><div><p class="eyebrow">BLOCK '+context.blockNumber+'</p><h3>'+esc(blockPhaseLabel(context.blockWeek))+'</h3></div><span>Week '+context.blockWeek+' of 4</span></div>'+
    '<div class="train-block-track">'+labels.map((label,index)=>{
      const week=index+1,state=week<context.blockWeek?'done':week===context.blockWeek?'current':'future';
      return '<div class="train-block-step '+state+'"><i></i><strong>'+label+'</strong><span>W'+week+'</span></div>';
    }).join('')+'</div></section>';
}
function renderTrainCurrentWeek(){
  const schedule=currentWeekSchedule();
  const completed=schedule.filter(entry=>entry.status==='complete').length;
  const context=programContext(),phase=trainPhaseMeta(context.blockWeek);
  const start=startOfWeek(new Date()),end=addDays(start,6);
  const primary=schedule.find(entry=>['today','missed','upcoming','partial'].includes(entry.status))||null;
  return '<div class="train-current-stack">'+
    renderTrainBlockTimeline(context)+
    '<section class="train-current-week train-current-week-v2">'+
      '<div class="train-week-title"><div><p class="eyebrow">THIS WEEK · '+esc(phase.label)+'</p><h3>'+esc(start.toLocaleDateString(undefined,{month:'short',day:'numeric'}))+' – '+esc(end.toLocaleDateString(undefined,{month:'short',day:'numeric'}))+'</h3><small>'+esc(phase.copy)+'</small></div><span>'+completed+'/'+schedule.length+' complete</span></div>'+
      (primary?trainSessionCard(primary,{primary:true}):'')+
      '<div class="train-session-list">'+schedule.filter(entry=>entry!==primary).map(entry=>trainSessionCard(entry)).join('')+'</div>'+
    '</section>'+
  '</div>';
}
function trainPlannedContext(offset){
  const current=programContext();
  const weekNumber=current.weekNumber+offset;
  return {weekNumber,blockNumber:Math.floor((weekNumber-1)/4)+1,blockWeek:((weekNumber-1)%4)+1};
}
function trainEngineWeekForOffset(offset){
  const target=trainPlannedContext(offset);
  const engine=engineVersionForBlock(target.blockNumber)||currentEngineProgram();
  return {target,engine,week:engine?.program?.weeks?.[target.blockWeek-1]||null};
}
function trainWeekChangeSummary(week){
  if(week?.changeSummary)return week.changeSummary;
  const baseline=currentEngineProgram()?.program?.weeks?.[0];
  const currentSessions=week?.sessions||[];
  let retained=0,rotated=0,progressed=0,total=0;
  currentSessions.forEach((session,si)=>{
    (session.strength||[]).filter(x=>x.exercise).forEach((item,ei)=>{
      const base=baseline?.sessions?.[si]?.strength?.filter(x=>x.exercise)?.[ei];
      total++;
      if(base?.exercise?.id===item.exercise?.id)retained++;
      else if(base?.exercise&&item.exercise)rotated++;
      if((num(item.prescription?.sets)||0)>(num(base?.prescription?.sets)||0))progressed++;
    });
  });
  return {retained,rotated,progressed,total};
}
function trainFutureWeekData(offset){
  const weekStart=addDays(startOfWeek(new Date()),offset*7);
  const preview=trainEngineWeekForOffset(offset);
  const preferred=preferredWorkoutDays();
  const entries=preferred.map((dayId,index)=>{
    const scheduledDate=addDays(weekStart,dayOffsetFromMonday(dayId));
    const fallbackDay=store.plan.days[index%store.plan.days.length];
    const session=preview.week?.sessions?.[index]||null;
    const day=session?engineSessionToLegacyDay(session,fallbackDay,index,preview.target.blockNumber):clone(fallbackDay);
    return {dayId,date:scheduledDate,dateKey:dateKey(scheduledDate),day,index,adaptedDay:day,status:'planned',engineBacked:Boolean(session)};
  });
  return {offset,weekStart,weekEnd:addDays(weekStart,6),entries,...preview,summary:trainWeekChangeSummary(preview.week)};
}
function renderTrainFutureWeek(offset){
  const data=trainFutureWeekData(offset),expanded=trainExpandedWeek===offset;
  const phase=trainPhaseMeta(data.target.blockWeek);
  const totalMinutes=data.entries.reduce((sum,entry)=>sum+(entry.adaptedDay?.estimatedMinutes||store.profile?.minutes||45),0);
  const s=data.summary||{};
  const changes=[
    s.rotated? s.rotated+' rotation'+(s.rotated===1?'':'s'):'',
    s.progressed? s.progressed+' progression'+(s.progressed===1?'':'s'):'',
    s.retained? s.retained+' retained':''
  ].filter(Boolean).join(' · ');
  return '<section class="train-future-week train-future-week-v2 phase-'+data.target.blockWeek+' '+(expanded?'expanded':'')+'">'+
    '<button class="train-future-toggle" type="button" data-action="toggle-train-week" data-week-offset="'+offset+'" aria-expanded="'+(expanded?'true':'false')+'">'+
      '<div><span>WEEK '+data.target.blockWeek+' · '+esc(phase.label)+' <b>PLANNED</b></span><strong>'+esc(data.weekStart.toLocaleDateString(undefined,{month:'short',day:'numeric'}))+' – '+esc(data.weekEnd.toLocaleDateString(undefined,{month:'short',day:'numeric'}))+'</strong><small>'+esc(phase.copy)+'</small><em>'+esc(changes||data.entries.length+' sessions · ~'+totalMinutes+' min')+'</em></div><i>'+(expanded?'−':'+')+'</i>'+
    '</button>'+
    (expanded?'<div class="train-future-list">'+data.entries.map(entry=>{
      const day=entry.adaptedDay||entry.day;
      return '<article class="train-future-row train-future-row-v2"><span>'+esc(entry.date.toLocaleDateString(undefined,{weekday:'short'}))+' '+entry.date.getDate()+'</span><div><strong>'+esc(day?.name||'Training')+'</strong><small>'+esc(day?.focus||'Training')+' · '+(day?.exercises?.length||0)+' exercises · ~'+(day?.estimatedMinutes||store.profile?.minutes||45)+' min</small>'+trainExercisePreviewMarkup(day,3)+'</div></article>';
    }).join('')+'<p class="train-provisional-note">Planned now. Completed workouts, readiness, equipment changes, and substitutions can refine future targets without rewriting completed weeks.</p></div>':'')+
  '</section>';
}
function renderTrainWeekView(){
  return '<div class="train-view train-week-view train-week-view-v2">'+
    renderTrainCurrentWeek()+
    '<section class="train-future-section"><div class="train-future-head"><p class="eyebrow">COMING UP</p><h3>How this block changes.</h3><p>Anchor lifts stay measurable. Rotation slots add variety when a compatible alternative exists.</p></div>'+
      '<div class="train-future-stack">'+[1,2,3].map(renderTrainFutureWeek).join('')+'</div>'+
    '</section>'+
  '</div>';
}
function trainProgramBlockStats(){
  const engine=currentEngineProgram(),weeks=engine?.program?.weeks||[];
  const baseline=weeks[0];
  const anchorIds=new Set(),rotationIds=new Set();
  for(const session of baseline?.sessions||[])for(const item of session.strength||[]){
    if(!item.exercise)continue;
    (item.programRole==='rotation'?rotationIds:anchorIds).add(item.exercise.id);
  }
  const rotations=weeks.slice(1).reduce((sum,w)=>sum+(w.changeSummary?.rotated||0),0);
  return {anchors:anchorIds.size,rotationSlots:rotationIds.size,rotations,sessions:weeks.reduce((sum,w)=>sum+(w.sessions?.length||0),0)};
}
function renderTrainProgramView(){
  const context=programContext(),plan=store.plan,stats=trainProgramBlockStats();
  return '<div class="train-view train-program-view train-program-view-v2">'+
    renderTrainBlockTimeline(context)+
    '<section class="train-program-story"><div><p class="eyebrow">HOW YOUR BLOCK WORKS</p><h3>Keep what measures progress. Rotate what does not need to stay fixed.</h3><p>Primary movements act as anchors through the block. Lower-priority slots can rotate when the engine has a compatible option. Future weeks stay provisional until your completed training gives them evidence.</p></div>'+
      '<div class="train-program-stats"><span><strong>'+stats.anchors+'</strong><small>anchor movements</small></span><span><strong>'+stats.rotations+'</strong><small>planned rotations</small></span><span><strong>'+stats.sessions+'</strong><small>block sessions</small></span></div>'+
    '</section>'+
    renderEngineProgramSummary()+
    renderProgramEvolution()+
    '<section class="clean-section train-rotation-section train-rotation-section-v2"><div class="clean-section-head"><div><p class="eyebrow">CURRENT ROTATION</p><h3>'+plan.days.length+' workout types</h3></div><button class="text-button" data-action="edit-profile">EDIT PLAN</button></div>'+
      '<div class="train-rotation-list">'+plan.days.map((day,index)=>{
        const preview=trainFutureWeekData(0).entries[index]?.adaptedDay||day;
        return '<article class="train-rotation-row"><span>'+String(index+1).padStart(2,'0')+'</span><div><strong>'+esc(day.name)+'</strong><small>'+esc(day.focus)+' · '+day.exercises.length+' exercises</small>'+trainExercisePreviewMarkup(preview,3)+'</div></article>';
      }).join('')+'</div>'+
    '</section>'+
  '</div>';
}
function renderTrainExercisesView(){
  const q=catalogQuery.trim().toLowerCase();
  const items=catalog.filter(e=>!q||[e.name,e.movement,...e.muscles,e.style,e.difficulty,...(e.equipment||[])].join(' ').toLowerCase().includes(q));
  return '<div class="train-view train-exercises-view">'+
    '<section class="train-library-head"><div><p class="eyebrow">LIBRARY</p><h3>'+catalog.length+' movements</h3><p>Search by movement, muscle, or equipment. Tap an exercise for form cues and details.</p></div></section>'+
    '<div class="catalog-search train-catalog-search"><input id="catalog-search" type="search" placeholder="Search chest, squat, dumbbell..." value="'+esc(catalogQuery)+'"><span>'+items.length+' shown</span></div>'+
    '<div class="catalog-grid train-catalog-grid">'+items.map(e=>'<article class="catalog-card visual-catalog-card">'+exerciseImageButton(e,'catalog-exercise-media')+'<div class="catalog-card-copy"><div class="catalog-top"><span>'+esc(movements[e.movement]||e.movement)+'</span><span>'+esc(e.difficulty)+'</span></div><h3>'+esc(e.name)+'</h3><p>'+e.muscles.map(esc).join(' · ')+'</p><div class="catalog-tags"><span>'+esc(e.style)+'</span><span>'+esc(e.equipment.join(' / '))+'</span></div><button class="text-button catalog-details" type="button" data-exercise-detail="'+esc(e.id)+'">View form & cues</button></div></article>').join('')+'</div>'+
  '</div>';
}
function openTrainPreview(dayId,scheduledDate=''){
  if(store.activeWorkout){currentTab='workout';render();return;}
  const entry=scheduledEntryFor(dayId,scheduledDate);
  if(!entry)return;
  trainPreviewContext={dayId,scheduledDate:scheduledDate||entry.dateKey,entry};
  render();
}
function closeTrainPreview(){trainPreviewContext=null;render();}
function renderTrainPreviewModal(){
  if(!trainPreviewContext)return '';
  const entry=trainPreviewContext.entry;
  const day=entry.adaptedDay||entry.day;
  return '<div class="exercise-modal-backdrop train-preview-backdrop" data-action="close-train-preview">'+
    '<section class="exercise-modal train-preview-modal" role="dialog" aria-modal="true" aria-label="Workout preview" data-train-preview-panel>'+
      '<button class="modal-close" type="button" data-action="close-train-preview" aria-label="Close workout preview">×</button>'+
      '<div class="train-preview-head"><p class="eyebrow">'+esc(entry.date.toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'}))+'</p><h2>'+esc(day?.name||'Training')+'</h2><p>'+esc(day?.focus||'Training')+' · ~'+(day?.estimatedMinutes||store.profile?.minutes||45)+' min</p></div>'+
      '<div class="train-preview-exercises">'+(day?.exercises||[]).map((ex,index)=>'<div class="train-preview-exercise"><span>'+String(index+1).padStart(2,'0')+'</span><div><strong>'+esc(ex.name)+'</strong><small>'+esc(homeExerciseMeta(ex))+'</small></div>'+(ex.engineProgramRole?'<em class="'+esc(ex.engineProgramRole)+'">'+esc(ex.engineProgramRole.toUpperCase())+'</em>':'')+'</div>').join('')+'</div>'+
      '<div class="train-preview-actions"><button class="button primary-action" data-action="prepare-previewed-workout">SET UP THIS SESSION</button><small>Equipment and readiness choices stay session-specific.</small></div>'+
    '</section></div>';
}
function renderTrain(){
  const p=store.profile,plan=store.plan;if(!p||!plan)return renderProfileEditor();
  ensureTrainProgramEngineCurrent();
  return '<div class="clean-page train-reframed train-reframed-v2">'+
    '<div class="clean-page-head train-page-head"><div><p class="eyebrow">TRAIN</p><h2>Your program, in motion.</h2><p>See what is next, what changed, and why each week is different.</p></div></div>'+
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
  const label=(key)=>COACH_SETTING_LABELS[key]?.[settings[key]]||String(settings[key]||'');
  const presetCards=Object.entries(COACH_PRESETS).map(([id,preset])=>
    '<button type="button" class="coach-preset-card '+(settings.coachPreset===id?'selected':'')+'" data-action="apply-coach-preset" data-coach-preset="'+esc(id)+'"><strong>'+esc(preset.label)+'</strong><span>'+esc(
      id==='guide'?'Balanced guidance with concise cues':
      id==='hype'?'More energy and motivation':
      id==='coach'?'Technical form and performance coaching':
      id==='quiet'?'Functional cues with minimal commentary':
      'Calmer pacing for recovery-focused sessions'
    )+'</span><em>'+(settings.coachPreset===id?'ACTIVE':'USE')+'</em></button>'
  ).join('');
  const voiceCards=COACH_VOICES.map(voice=>{
    const selected=settings.coachVoice===voice.id;
    return '<div class="coach-voice-card '+(selected?'selected':'')+'">'+
      '<button type="button" class="coach-voice-select" data-action="select-coach-voice" data-coach-voice="'+esc(voice.id)+'" aria-pressed="'+(selected?'true':'false')+'">'+
        '<span><strong>'+esc(voice.label)+'</strong><small>'+(voice.recommended?'Recommended for best quality':'Built-in AI voice')+'</small></span>'+
        '<em>'+(selected?'SELECTED':'CHOOSE')+'</em>'+
      '</button>'+
      '<button type="button" class="coach-voice-preview" data-action="preview-coach-voice" data-coach-voice="'+esc(voice.id)+'" aria-label="Preview '+esc(voice.label)+' voice">▶ PREVIEW</button>'+
    '</div>';
  }).join('');
  const behaviorRows=[
    ['cycle-coach-style','Coach style','Personality and wording',label('coachStyle')],
    ['cycle-coach-vibe','Voice vibe','Cadence, rhythm, and conversational feel',label('coachVibe')],
    ['cycle-coach-frequency','Coach frequency','Optional coaching frequency',label('coachFrequency')],
    ['cycle-coach-detail','Coach detail','How much the coach says when speaking',label('coachDetail')],
    ['cycle-talk-speed','Talk speed','Voice delivery speed',label('talkSpeed')],
    ['cycle-name-usage','Use my name','How often the coach says your name',label('nameUsage')],
    ['cycle-form-cues','Form coaching','Exercise technique reminders',label('formCues')],
    ['cycle-performance-feedback','Performance feedback','How much workout data the coach references',label('performanceFeedback')],
    ['cycle-motivation','Motivation','Amount of encouragement',label('motivation')],
    ['cycle-countdown-mode','Countdown','Functional countdown behavior',label('countdownMode')],
    ['cycle-warmup-guidance','Warm-up guidance','How much stretch instruction you hear',label('warmupGuidance')],
    ['cycle-cooldown-guidance','Cooldown guidance','How much recovery instruction you hear',label('cooldownGuidance')],
    ['cycle-next-set-preview','Next set preview','What the coach says before the next set or exercise',label('nextSetPreview')],
    ['cycle-exercise-instruction','Exercise instruction','Form detail after the exercise opens',label('exerciseInstruction')]
  ].map(([action,title,copy,value])=>'<button data-action="'+action+'" class="settings-toggle"><div><strong>'+title+'</strong><span>'+copy+'</span></div><em>'+esc(value)+'</em></button>').join('');
  return '<div class="exercise-modal-backdrop sheet-backdrop" data-action="close-cue-settings"><section class="bottom-sheet coach-settings-sheet" data-cue-settings-panel><div class="sheet-handle"></div><div class="sheet-head"><div><p class="eyebrow">WORKOUT SETTINGS</p><h2>Voice coach & cues</h2><p>Functional cues stay available even when optional coaching is minimal.</p></div><button class="modal-close" data-action="close-cue-settings">×</button></div>'+
    '<div class="coach-settings-section"><div class="coach-settings-section-head"><strong>COACH PRESET</strong><span>'+(settings.coachPreset==='custom'?'Custom setup':esc(COACH_PRESETS[settings.coachPreset]?.label||'Custom'))+'</span></div><div class="coach-preset-grid">'+presetCards+'</div></div>'+
    '<div class="settings-toggle-list">'+
      '<button data-action="toggle-voice" class="settings-toggle"><div><strong>Voice cues</strong><span>Spoken workout guidance</span></div><em>'+(settings.voice?'ON':'OFF')+'</em></button>'+
      '<button data-action="toggle-ai-coach" class="settings-toggle"><div><strong>AI Coach</strong><span>Natural, context-aware workout dialogue</span></div><em>'+(settings.aiCoach?'ON':'OFF')+'</em></button>'+
      behaviorRows+
      '<button data-action="toggle-adaptive-coach" class="settings-toggle"><div><strong>Adaptive coach</strong><span>Adjust delivery to readiness and workout phase</span></div><em>'+(settings.adaptiveCoach?'ON':'OFF')+'</em></button>'+
      '<button data-action="toggle-auto-start-warmup" class="settings-toggle"><div><strong>Auto-start warm-up</strong><span>Coach countdown starts the next warm-up movement</span></div><em>'+(settings.autoStartWarmup?'ON':'OFF')+'</em></button>'+
      '<button data-action="toggle-auto-start-cooldown" class="settings-toggle"><div><strong>Auto-start cooldown</strong><span>Coach countdown starts the next cooldown movement</span></div><em>'+(settings.autoStartCooldown?'ON':'OFF')+'</em></button>'+
      '<button data-action="toggle-auto-start-timed" class="settings-toggle"><div><strong>Auto-start timed exercises</strong><span>Timed strength exercises may start automatically</span></div><em>'+(settings.autoStartTimedExercise?'ON':'OFF')+'</em></button>'+
    '</div>'+
    '<div class="coach-voice-section"><div class="coach-voice-heading"><div><strong>AI voice</strong><span>Preview uses your selected style, voice vibe, detail, speed, and countdown behavior.</span></div><em>'+esc(coachVoiceLabel(settings.coachVoice))+'</em></div>'+
      '<div class="coach-voice-grid">'+voiceCards+'</div>'+
    '</div>'+
    '<div class="settings-toggle-list">'+
      [['sound','Sound','Timer and completion tones'],['haptics','Haptics','Supported-device vibration cues'],['flash','Flash','Visual workout cue flash']].map(([key,title,copy])=>'<button data-action="toggle-'+key+'" class="settings-toggle"><div><strong>'+title+'</strong><span>'+copy+'</span></div><em>'+(settings[key]?'ON':'OFF')+'</em></button>').join('')+
    '</div><div class="session-setup-warning"><strong>SELECTED COACH VOICE</strong><span>3, 2, 1, Go and core workout cues are prefetched in '+esc(coachVoiceLabel(settings.coachVoice))+'. Coach frequency only changes optional commentary.</span></div><button class="button secondary" data-action="test-cues">TEST THIS COACH SETUP</button></section></div>';
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
function latestCompletedWorkout(){
  return [...(store.history||[])].filter(item=>item?.completedAt).sort((a,b)=>Date.parse(b.completedAt)-Date.parse(a.completedAt))[0]||null;
}
function daysSince(iso,date=new Date()){
  const value=Date.parse(iso||'');if(!Number.isFinite(value))return null;
  const today=new Date(date);today.setHours(0,0,0,0);
  const then=new Date(value);then.setHours(0,0,0,0);
  return Math.max(0,Math.floor((today-then)/86400000));
}
function homeActivePhaseLabel(phase){
  return ({
    intro:'Ready',
    'warmup-routine':'Warm-up',
    warmup:'Warm-up',
    'warmup-complete':'Warm-up complete',
    'pre-set':'Set prep',
    work:'Working set',
    'timed-set':'Timed set',
    'side-switch':'Switching sides',
    rest:'Rest',
    calibrate:'Calibration',
    feedback:'Exercise feedback',
    'exercise-transition':'Exercise transition',
    'exercise-review':'Exercise review',
    cooldown:'Cooldown',
    review:'Final review'
  })[phase]||'Session active';
}
function homeTitleCase(value){
  return String(value||'').replace(/_/g,' ').replace(/\b\w/g,char=>char.toUpperCase());
}
function homeExerciseFocus(exercises){
  const counts={};
  for(const ex of exercises||[]){
    const source=catalog.find(item=>item.id===ex.id)||ex;
    for(const muscle of source.muscles||[])counts[muscle]=(counts[muscle]||0)+1;
  }
  return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([name])=>homeTitleCase(name)).join(' · ');
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
    const focus=w.focus||homeExerciseFocus(w.exercises)||'Your planned training session';
    const elapsed=workoutElapsedSeconds(w);
    return {
      state:'active',
      context,
      schedule,
      eyebrow:'SESSION ACTIVE',
      title:w.routineName||'Current workout',
      copy:focus,
      meta:(elapsed?formatClock(elapsed)+' elapsed · ':'')+homeActivePhaseLabel(w.phase),
      primaryLabel:'RESUME WORKOUT',
      primaryAction:'resume',
      entry:null,
      last
    };
  }
  if(completedToday){
    const history=completedToday.history||last;
    const completedMs=Date.parse(history?.completedAt||'');
    const fresh=Number.isFinite(completedMs)&&Date.now()-completedMs>=0&&Date.now()-completedMs<=90*60*1000;
    const timing=historyTimingInfo(history);
    const outcome=history?historyPerformanceHighlight(history):'Your work is saved';
    return {
      state:fresh?'completed-fresh':'completed',
      context,
      schedule,
      eyebrow:fresh?'WORKOUT COMPLETE':'DONE FOR TODAY',
      title:history?.routineName||completedToday.day?.name||'Workout complete',
      copy:outcome,
      meta:[
        timing.activeMinutes!==null?timing.activeMinutes+' active min':'',
        history?.completedSets?history.completedSets+' sets':'',
        history?.newPRs?.length?history.newPRs.length+' improvement'+(history.newPRs.length===1?'':'s'):''
      ].filter(Boolean).join(' · ')||'Your work is saved',
      primaryLabel:fresh?'SEE RESULTS':'VIEW WORKOUT',
      primaryAction:'history',
      entry:completedToday,
      history,
      last
    };
  }
  if(awayDays!==null&&awayDays>=7){
    const entry=today||missed||upcoming||null;
    const day=entry?.adaptedDay||entry?.day;
    return {
      state:'returning',
      context,
      schedule,
      eyebrow:'WELCOME BACK',
      title:day?.name||'Your program is ready',
      copy:day?.focus||('It’s been '+awayDays+' days since your last workout.'),
      meta:day?'~'+(day.estimatedMinutes||store.profile?.minutes||45)+' min · '+day.exercises.length+' exercises':'Pick up from your current program',
      primaryLabel:entry&&(entry.status==='missed'||entry.status==='today')?(entry.status==='missed'?'START COMEBACK WORKOUT':'START WORKOUT'):'VIEW NEXT WORKOUT',
      primaryAction:entry&&(entry.status==='missed'||entry.status==='today')?'start':'train',
      entry,
      last
    };
  }
  if(missed){
    const day=missed.adaptedDay||missed.day;
    return {
      state:'missed',
      context,
      schedule,
      eyebrow:'STILL AVAILABLE',
      title:day?.name||'Missed workout',
      copy:day?.focus||'This session can move with you.',
      meta:'~'+(day?.estimatedMinutes||store.profile?.minutes||45)+' min · '+(day?.exercises?.length||0)+' exercises',
      primaryLabel:'DO IT TODAY',
      primaryAction:'start',
      entry:missed,
      last
    };
  }
  if(today){
    const day=today.adaptedDay||today.day;
    const previous=(store.history||[]).find(item=>item.routineName===day?.name);
    return {
      state:'today',
      context,
      schedule,
      eyebrow:'TODAY',
      title:day?.name||'Today’s workout',
      copy:day?.focus||'Your planned training session',
      meta:'~'+(day?.estimatedMinutes||store.profile?.minutes||45)+' min · '+(day?.exercises?.length||0)+' exercises'+(previous?' · last done '+(daysSince(previous.completedAt,date)||0)+' days ago':''),
      primaryLabel:'START WORKOUT',
      primaryAction:'start',
      entry:today,
      last
    };
  }
  if(upcoming){
    const day=upcoming.adaptedDay||upcoming.day;
    const when=upcoming.date.toLocaleDateString(undefined,{weekday:'long'});
    return {
      state:'rest',
      context,
      schedule,
      eyebrow:'RECOVERY DAY',
      title:'No workout scheduled today',
      copy:'Recover today. Your next session is '+day?.name+' on '+when+'.',
      meta:'Next training day · '+when,
      primaryLabel:'VIEW NEXT WORKOUT',
      primaryAction:'train',
      entry:upcoming,
      last
    };
  }
  return {
    state:'week-complete',
    context,
    schedule,
    eyebrow:'WEEK COMPLETE',
    title:'Your planned sessions are done',
    copy:'Your next training week will build from what you completed.',
    meta:'Block '+context.blockNumber+' · Week '+context.blockWeek,
    primaryLabel:'VIEW PROGRESS',
    primaryAction:'progress',
    entry:null,
    last
  };
}
function renderHomePrimaryAction(x){
  const quiet=['rest','completed','week-complete'].includes(x.state);
  const buttonClass='button '+(quiet?'secondary ':'primary-action ')+'home-state-cta'+(quiet?' quiet':'');
  if(x.primaryAction==='start'&&x.entry)return '<button class="'+buttonClass+'" data-start="'+esc(x.entry.day.id)+'" data-scheduled-date="'+esc(x.entry.dateKey)+'">'+esc(x.primaryLabel)+'</button>';
  return '<button class="'+buttonClass+'" data-action="'+esc(x.primaryAction)+'">'+esc(x.primaryLabel)+'</button>';
}
function homeFirstName(){
  const value=String(displayName()==='there'?'':displayName()).trim();
  return value?value.split(/\s+/)[0]:'';
}
function homeDateLabel(date=new Date()){
  return date.toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'}).toUpperCase();
}
function homeWorkoutCode(name){
  const clean=String(name||'').trim();
  if(!clean)return '';
  const known={'Upper A':'UA','Upper B':'UB','Lower A':'LA','Lower B':'LB','Full Body A':'FA','Full Body B':'FB','Full Body C':'FC'};
  if(known[clean])return known[clean];
  return clean.split(/\s+/).slice(0,2).map(part=>part[0]||'').join('').toUpperCase();
}
function homeWorkoutExercise(x){
  if(store.activeWorkout?.exercises?.length){
    const w=store.activeWorkout;
    const from=Math.max(-1,(Number.isInteger(w.currentExerciseIndex)?w.currentExerciseIndex:0)-1);
    const index=nextUnresolvedExerciseIndex(w,from);
    return w.exercises[index>=0?index:0]||null;
  }
  const day=x?.entry?.adaptedDay||x?.entry?.day;
  const planned=day?.exercises?.[0]||null;
  if(!planned)return null;
  const catalogItem=catalog.find(item=>item.id===planned.id);
  return catalogItem?{...catalogItem,...planned}:planned;
}
function homeExerciseMeta(ex){
  if(!ex)return '';
  const catalogItem=catalog.find(item=>item.id===ex.id)||ex;
  const sets=Array.isArray(ex.sets)?ex.sets.length:num(ex.sets);
  const muscles=(catalogItem.muscles||[]).slice(0,2).map(homeTitleCase);
  return [sets?sets+' set'+(sets===1?'':'s'):'',...muscles].filter(Boolean).join(' · ');
}
function homeWeekStats(schedule){
  const completedEntries=schedule.filter(entry=>entry.status==='complete');
  const timings=completedEntries.map(entry=>historyTimingInfo(entry.history)).filter(item=>item.activeMinutes!==null);
  return {
    completed:completedEntries.length,
    planned:schedule.length,
    minutes:timings.reduce((sum,item)=>sum+item.activeMinutes,0),
    minutesKnown:timings.length>0,
    remaining:Math.max(0,schedule.length-completedEntries.length)
  };
}
function homeWeekMuscleSnapshot(){
  const counts={};
  for(const workout of weeklyHistory()){
    if(workout.manualWorkoutCompletion||workout.completionStatus==='partial')continue;
    for(const exercise of workout.exercises||[]){
      if(exercise.skipped)continue;
      const source=catalog.find(item=>item.id===exercise.id)||exercise;
      for(const muscle of source.muscles||[])counts[muscle]=(counts[muscle]||0)+1;
    }
  }
  const max=Math.max(1,...Object.values(counts));
  const levelFor=(keys)=>{
    const value=keys.reduce((sum,key)=>sum+(counts[key]||0),0);
    if(!value)return 0;
    const ratio=value/max;
    return ratio>=1.5?4:ratio>=1?3:ratio>=.5?2:1;
  };
  return {
    counts,
    top:Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([key,value])=>({key,label:homeTitleCase(key),value})),
    front:{
      chest:levelFor(['chest']),
      shoulders:levelFor(['anterior_delts','lateral_delts']),
      biceps:levelFor(['biceps']),
      core:levelFor(['core','hip_flexors']),
      quads:levelFor(['quads','adductors'])
    },
    back:{
      back:levelFor(['lats','upper_back','rear_delts']),
      triceps:levelFor(['triceps']),
      glutes:levelFor(['glutes']),
      hamstrings:levelFor(['hamstrings']),
      calves:levelFor(['calves'])
    }
  };
}
function homeNextScheduledEntry(schedule,date=new Date()){
  const today=dateKey(date);
  const current=(schedule||[]).filter(entry=>entry.dateKey>today&&entry.status==='upcoming').sort((a,b)=>a.date-b.date)[0];
  if(current)return current;
  const future=currentWeekSchedule(addDays(startOfWeek(date),7));
  return future.find(entry=>entry.status==='upcoming'||entry.status==='today')||future[0]||null;
}
function renderHomeProgramJourney(context){
  const phases=[
    ['ESTABLISH','Set your working baseline'],
    ['BUILD','Add repeatable work'],
    ['PUSH','Raise working intensity'],
    ['CONSOLIDATE','Lock in the block']
  ];
  return '<div class="home-program-journey" aria-label="Block '+context.blockNumber+' progress">'+
    phases.map(([phase,meaning],index)=>{
      const week=index+1;
      const state=week<context.blockWeek?'done':week===context.blockWeek?'current':'future';
      return '<button type="button" class="home-program-step '+state+'" data-action="train-program" aria-label="'+esc(phase)+', week '+week+'. '+esc(meaning)+'"><i></i><span>'+phase+'</span><small>W'+week+'</small></button>';
    }).join('')+
  '</div>';
}
function renderHomeCompletionVisual(history){
  const timing=historyTimingInfo(history);
  const prs=history?.newPRs?.length||0;
  return '<div class="home-complete-visual"><div class="home-complete-check">✓</div><span>SESSION SAVED</span><div class="home-complete-stats">'+
    '<div><strong>'+(timing.activeMinutes!==null?timing.activeMinutes:'—')+'</strong><small>active min</small></div>'+
    '<div><strong>'+num(history?.completedSets)+'</strong><small>sets</small></div>'+
    '<div><strong>'+formatVolume(history?.totalVolume||0)+'</strong><small>volume</small></div>'+
    (prs?'<div><strong>'+prs+'</strong><small>improvement'+(prs===1?'':'s')+'</small></div>':'')+
  '</div></div>';
}
function homeEntryFirstExercise(entry){
  const day=entry?.adaptedDay||entry?.day;
  const planned=day?.exercises?.[0];
  if(!planned)return null;
  const source=catalog.find(item=>item.id===planned.id);
  return source?{...source,...planned}:planned;
}
function homeHistoryFirstExercise(history){
  const planned=history?.exercises?.[0];
  if(!planned)return null;
  const source=catalog.find(item=>item.id===planned.id);
  return source?{...source,...planned}:planned;
}
function homeHeroExercise(x){
  if(x.state==='active')return homeWorkoutExercise(x);
  if(x.history)return homeHistoryFirstExercise(x.history);
  if(x.entry)return homeEntryFirstExercise(x.entry);
  const next=homeNextScheduledEntry(x.schedule);
  return homeEntryFirstExercise(next);
}
function homeHeroMediaSource(x){
  const candidates=[];
  const first=homeHeroExercise(x);
  if(first)candidates.push(first);
  const entry=x.entry||homeNextScheduledEntry(x.schedule);
  const day=entry?.adaptedDay||entry?.day;
  for(const planned of day?.exercises||[]){
    if(first?.id===planned.id)continue;
    const source=catalog.find(item=>item.id===planned.id);
    candidates.push(source?{...source,...planned}:planned);
  }
  if(x.history){
    for(const planned of x.history.exercises||[]){
      if(first?.id===planned.id)continue;
      const source=catalog.find(item=>item.id===planned.id);
      candidates.push(source?{...source,...planned}:planned);
    }
  }
  for(const ex of candidates){
    const spec=exerciseMediaSpec(ex);
    if(['reference','missing'].includes(spec.status))continue;
    const src=exerciseMediaFrameUrl(ex,0);
    if(src)return {src,exercise:ex};
  }
  return {src:'',exercise:first||null};
}
function renderHomeHeroBackdrop(x){
  const media=homeHeroMediaSource(x);
  const stateClass=['rest','completed','week-complete'].includes(x.state)?'quiet':'training';
  return '<div class="home-hero-backdrop-v4 '+stateClass+'">'+
    (media.src?'<img src="'+esc(media.src)+'" alt="" loading="eager" decoding="async">':'<div class="home-hero-backdrop-fallback"></div>')+
    '<div class="home-hero-shade-v4"></div>'+
  '</div>';
}
function renderHomeHeroAccessory(x){
  if(x.state==='completed-fresh'&&x.history){
    const timing=historyTimingInfo(x.history);
    const prs=x.history?.newPRs?.length||0;
    return '<div class="home-hero-result-v4"><span>SESSION SAVED</span><strong>'+esc(x.history.routineName||x.title)+'</strong><small>'+
      [timing.activeMinutes!==null?timing.activeMinutes+' active min':'',x.history?.completedSets?x.history.completedSets+' sets':'',prs?prs+' improvement'+(prs===1?'':'s'):''].filter(Boolean).join(' · ')+
    '</small></div>';
  }
  if(['rest','completed','week-complete'].includes(x.state)){
    const entry=x.state==='rest'?(x.entry||homeNextScheduledEntry(x.schedule)):homeNextScheduledEntry(x.schedule);
    const day=entry?.adaptedDay||entry?.day;
    if(!entry||!day)return '';
    return '<div class="home-hero-next-v4 quiet"><span>NEXT TRAINING</span><strong>'+esc(day.name||'Workout')+'</strong><small>'+esc(entry.date.toLocaleDateString(undefined,{weekday:'long'}))+' · ~'+esc(day.estimatedMinutes||store.profile?.minutes||45)+' min</small></div>';
  }
  const ex=homeWorkoutExercise(x);
  const progress=x.state==='active'&&store.activeWorkout
    ?{done:workoutResolvedCount(store.activeWorkout),total:store.activeWorkout.exercises?.length||0}
    :{done:0,total:(x.entry?.adaptedDay||x.entry?.day)?.exercises?.length||0};
  const pct=progress.total?Math.round((progress.done/progress.total)*100):0;
  return (progress.total?'<div class="home-session-ring home-session-ring-v4" style="--home-progress:'+pct+'"><div><strong>'+progress.done+'/'+progress.total+'</strong><span>complete</span></div></div>':'')+
    (ex?'<button class="home-hero-next-v4" type="button" data-exercise-detail="'+esc(ex.id)+'"><span>'+(x.state==='active'?'UP NEXT':'STARTS WITH')+'</span><strong>'+esc(ex.name)+'</strong><small>'+esc(homeExerciseMeta(ex))+'</small></button>':'');
}
function renderHomeWeekPulse(schedule){
  const context=programContext();
  const todayKey=dateKey();
  return '<div class="home-training-path-v4" aria-label="This week training path">'+TRAINING_DAYS.map(dayDef=>{
    const entry=schedule.find(item=>item.dayId===dayDef.id);
    const date=addDays(context.weekStart,dayOffsetFromMonday(dayDef.id));
    const status=entry?.status||'rest';
    const isToday=dateKey(date)===todayKey;
    const day=entry?.adaptedDay||entry?.day;
    const workoutName=day?.name||((isToday&&status==='rest')?'Recovery':'');
    const marker=status==='complete'?'✓':status==='partial'?'½':status==='missed'?'!':status==='today'?'•':status==='upcoming'?'○':'';
    return '<div class="home-path-day status-'+status+(isToday?' is-today':'')+'">'+
      '<span class="home-path-weekday">'+esc(dayDef.label)+'</span>'+
      '<i class="home-path-node">'+marker+'</i>'+
      '<strong>'+esc(workoutName)+'</strong>'+
      '<small>'+date.getDate()+'</small>'+
    '</div>';
  }).join('')+'</div>';
}
function bodyHeatClass(level){
  return level?' heat-'+Math.max(1,Math.min(4,level)):'';
}
function renderHomeBodySnapshot(){
  const snapshot=homeWeekMuscleSnapshot();
  if(!snapshot.top.length)return '';
  const top=snapshot.top.map(item=>'<span><strong>'+esc(item.label)+'</strong><small>'+item.value+' touch'+(item.value===1?'':'es')+'</small></span>').join('');
  return '<section class="home-body-card home-training-load home-training-load-v4">'+
    '<div class="home-body-head"><div><p class="eyebrow">TRAINING LOAD · THIS WEEK</p><h3>Where your work landed.</h3></div><button class="text-button" data-action="progress">VIEW PROGRESS</button></div>'+
    '<div class="home-body-layout"><div class="home-body-pair" aria-label="Muscle groups trained this week">'+
      '<div class="home-body-figure"><span>FRONT</span><svg viewBox="0 0 120 210" aria-hidden="true">'+
        '<circle class="body-base" cx="60" cy="24" r="16"/><path class="body-base" d="M42 48Q60 39 78 48L84 105 74 132 70 194H52L48 132 36 105Z"/><path class="body-base" d="M42 55 18 111M78 55l24 56"/><path class="body-base" d="M49 131 35 200M71 131l14 69"/>'+
        '<ellipse class="body-zone chest'+bodyHeatClass(snapshot.front.chest)+'" cx="60" cy="66" rx="20" ry="12"/>'+
        '<ellipse class="body-zone shoulders'+bodyHeatClass(snapshot.front.shoulders)+'" cx="60" cy="55" rx="28" ry="9"/>'+
        '<ellipse class="body-zone biceps'+bodyHeatClass(snapshot.front.biceps)+'" cx="34" cy="88" rx="7" ry="21"/><ellipse class="body-zone biceps'+bodyHeatClass(snapshot.front.biceps)+'" cx="86" cy="88" rx="7" ry="21"/>'+
        '<ellipse class="body-zone core'+bodyHeatClass(snapshot.front.core)+'" cx="60" cy="103" rx="15" ry="23"/>'+
        '<ellipse class="body-zone quads'+bodyHeatClass(snapshot.front.quads)+'" cx="50" cy="153" rx="11" ry="31"/><ellipse class="body-zone quads'+bodyHeatClass(snapshot.front.quads)+'" cx="70" cy="153" rx="11" ry="31"/>'+
      '</svg></div>'+
      '<div class="home-body-figure"><span>BACK</span><svg viewBox="0 0 120 210" aria-hidden="true">'+
        '<circle class="body-base" cx="60" cy="24" r="16"/><path class="body-base" d="M42 48Q60 39 78 48L84 105 74 132 70 194H52L48 132 36 105Z"/><path class="body-base" d="M42 55 18 111M78 55l24 56"/><path class="body-base" d="M49 131 35 200M71 131l14 69"/>'+
        '<ellipse class="body-zone back'+bodyHeatClass(snapshot.back.back)+'" cx="60" cy="76" rx="23" ry="28"/>'+
        '<ellipse class="body-zone triceps'+bodyHeatClass(snapshot.back.triceps)+'" cx="34" cy="88" rx="7" ry="21"/><ellipse class="body-zone triceps'+bodyHeatClass(snapshot.back.triceps)+'" cx="86" cy="88" rx="7" ry="21"/>'+
        '<ellipse class="body-zone glutes'+bodyHeatClass(snapshot.back.glutes)+'" cx="60" cy="126" rx="18" ry="14"/>'+
        '<ellipse class="body-zone hamstrings'+bodyHeatClass(snapshot.back.hamstrings)+'" cx="50" cy="157" rx="10" ry="29"/><ellipse class="body-zone hamstrings'+bodyHeatClass(snapshot.back.hamstrings)+'" cx="70" cy="157" rx="10" ry="29"/>'+
        '<ellipse class="body-zone calves'+bodyHeatClass(snapshot.back.calves)+'" cx="47" cy="191" rx="7" ry="16"/><ellipse class="body-zone calves'+bodyHeatClass(snapshot.back.calves)+'" cx="73" cy="191" rx="7" ry="16"/>'+
      '</svg></div>'+
    '</div><div class="home-body-copy"><p>This reflects muscles recorded in completed workouts. It is training load, not a body-change measurement.</p><div class="home-muscle-chips">'+top+'</div></div></div>'+
  '</section>';
}
function renderHomeLastWorkout(last){
  if(!last)return '';
  const timing=historyTimingInfo(last);
  const highlight=historyPerformanceHighlight(last);
  return '<button class="home-continuity-card home-last-card" data-action="history">'+
    '<div class="home-last-icon"><span>✓</span></div>'+
    '<div class="home-last-main"><span>LAST WORKOUT</span><strong>'+esc(last.routineName||'Workout')+'</strong><small>'+esc(formatDate(last.completedAt))+(timing.activeMinutes!==null?' · '+timing.activeMinutes+' active min':'')+'</small><em>'+esc(highlight)+'</em></div>'+
    '<div class="home-last-stats"><span><strong>'+num(last.completedSets)+'</strong><small>sets</small></span><span><strong>'+esc(formatVolume(last.totalVolume||0))+'</strong><small>volume</small></span><b>VIEW →</b></div>'+
  '</button>';
}
function renderHomeNextSession(schedule,state){
  if(state==='rest')return '';
  const entry=homeNextScheduledEntry(schedule);
  const day=entry?.adaptedDay||entry?.day;
  if(!entry||!day)return '';
  return '<button class="home-next-session" data-action="train"><div><span>WHAT’S NEXT</span><strong>'+esc(day.name||'Workout')+'</strong><small>'+esc(entry.date.toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'}))+' · '+esc(day.focus||'Training')+'</small></div><em>'+homeWorkoutCode(day.name)+' →</em></button>';
}
function renderHome(){
  const p=store.profile,plan=store.plan;if(!p||!plan)return renderProfileEditor();
  const x=getHomeExperience(),schedule=x.schedule,context=x.context;
  const stats=homeWeekStats(schedule);
  const shared=sharedTrainingState();
  const name=homeFirstName();
  const greeting=name?'Hey, '+esc(name)+'.':'Your training.';
  const activeMeta=x.state==='active'
    ?'<b id="home-elapsed-clock">'+esc(formatClock(workoutElapsedSeconds(store.activeWorkout)))+'</b> elapsed · '+esc(homeActivePhaseLabel(store.activeWorkout?.phase))
    :esc(x.meta);
  return '<div class="clean-page home-clean home-contextual home-contextual-v3 home-contextual-v4">'+
    '<section class="home-intro-v2 home-intro-v4"><div class="home-intro-copy"><p class="eyebrow">'+esc(homeDateLabel())+'</p><h2>'+greeting+'</h2></div><div class="home-phase-chip"><span>'+esc(blockPhaseLabel(context.blockWeek))+'</span><small>BLOCK '+context.blockNumber+' · WEEK '+context.blockWeek+' OF 4</small></div></section>'+
    renderHomeProgramJourney(context)+
    '<section class="home-state-hero home-state-hero-v4 state-'+esc(x.state)+'">'+
      renderHomeHeroBackdrop(x)+
      '<div class="home-hero-content-v4">'+
        '<div class="home-state-copy home-state-copy-v4"><span>'+esc(x.eyebrow)+(x.state==='active'?'<i class="home-live-dot"></i>':'')+'</span><h1>'+esc(x.title)+'</h1><p>'+esc(x.copy)+'</p><small>'+activeMeta+'</small></div>'+
        renderHomeHeroAccessory(x)+
      '</div>'+
      '<div class="home-hero-actions home-hero-actions-v4">'+renderHomePrimaryAction(x)+
        (x.entry&&['today','missed','returning'].includes(x.state)&&normalSessionSetupKey()!=='bodyweight'?'<button class="home-train-anywhere" data-action="train-anywhere-home" data-day-id="'+esc(x.entry.day.id)+'" data-scheduled-date="'+esc(x.entry.dateKey)+'">CAN’T MAKE THE GYM? <strong>TRAIN ANYWHERE</strong></button>':'')+
      '</div>'+
      (x.state==='active'?'<div class="home-state-secondary home-state-secondary-v4"><button class="text-button" data-action="discard-recovered">DISCARD</button><button class="text-button" data-action="discard-and-new">START NEW</button></div>':'')+
    '</section>'+
    '<section class="clean-section home-week-section home-week-section-v3 home-week-section-v4"><div class="clean-section-head home-week-head"><div><p class="eyebrow">THIS WEEK</p><h3>'+stats.completed+' of '+stats.planned+' workouts complete</h3></div><button class="text-button" data-action="train">SEE WEEK</button></div>'+
      '<div class="home-week-metrics"><div><strong>'+stats.completed+'/'+stats.planned+'</strong><span>WORKOUTS</span></div><div><strong>'+(stats.minutesKnown?stats.minutes:'—')+' <small>MIN</small></strong><span>TRAINED</span></div><div><strong>'+stats.remaining+'</strong><span>LEFT</span></div></div>'+
      renderHomeWeekPulse(schedule)+
      '<div class="home-week-progress" aria-label="'+stats.completed+' of '+stats.planned+' workouts complete"><span style="width:'+Math.round((stats.completed/Math.max(1,stats.planned))*100)+'%"></span></div>'+
    '</section>'+
    renderHomeBodySnapshot()+
    renderHomeNextSession(schedule,x.state)+
    (x.last&&x.state!=='completed-fresh'?renderHomeLastWorkout(x.last):'')+
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
  const motivation=preWorkoutMotivation(w);
  return '<div class="runner-overview">'+
    '<div class="runner-overview-title"><h2>'+esc(w.routineName)+'</h2><p>'+esc(w.readiness?.timeAvailable||store.profile?.minutes||45)+' minutes · '+esc(setup)+'</p></div>'+
    '<section class="runner-motivation-card pre"><span>TODAY’S FOCUS</span><strong>'+esc(motivation.title)+'</strong><p>'+esc(motivation.copy)+'</p></section>'+
    '<div class="runner-phase-list">'+
      (warmCount?'<button class="runner-phase-row active" data-action="begin-session"><span class="runner-phase-icon">●</span><div><strong>Warm-up <b class="runner-recommended-chip">RECOMMENDED</b></strong><small>'+warmCount+' movements · '+runnerPhaseMinutes(w.warmup)+' minutes</small></div><em>›</em></button>':'')+
      '<div class="runner-phase-row"><span class="runner-phase-icon">▰</span><div><strong>Strength</strong><small>'+w.exercises.length+' exercises · ~'+strengthMinutes+' minutes</small></div></div>'+
      (coolCount?'<div class="runner-phase-row"><span class="runner-phase-icon">✦</span><div><strong>Cooldown</strong><small>'+coolCount+' movements · '+runnerPhaseMinutes(w.cooldown)+' minutes</small></div></div>':'')+
    '</div>'+
    (w.trainingContext?.changes?.length?'<div class="runner-overview-note"><span>TODAY’S ADAPTATION</span><strong>'+w.trainingContext.changes.length+' movement'+(w.trainingContext.changes.length===1?'':'s')+' adjusted for '+esc(sessionSetupLabel(w.trainingContext))+'</strong></div>':'')+
    '<div class="runner-session-start-actions"><button class="button primary-action runner-gold-action" data-action="begin-session">'+(warmCount?'START WARM-UP':'START WORKOUT')+'</button>'+
      (warmCount?'<button class="text-button runner-skip-warmup" data-action="skip-warmup" data-skip-source="intro">SKIP WARM-UP</button>':'')+
    '</div>'+
    '<button class="text-button runner-map-link" data-action="open-workout-map">VIEW WORKOUT MAP</button>'+
  '</div>';
}

function beginWorkoutSession(skipWarmup=false){
  const w=store.activeWorkout;if(!w||w.phase!=='intro')return;
  const now=new Date().toISOString();
  w.startedAt=now;
  w.trainingStartedAt=now;
  w.actualStartDate=dateKey();
  w.totalPausedMs=0;
  w.pauseLog=[];
  unlockWorkoutCues();
  primeCoachCuePack();

  const hasWarmup=Boolean(w.warmup?.length);
  const willWarmup=hasWarmup&&!skipWarmup;
  if(skipWarmup&&hasWarmup){
    cancelCoachTimeline();
    w.warmupSkipped=true;
    w.warmupSkippedAt=now;
    w.warmupSkipSource='intro';
    w.warmupPartiallyCompleted=false;
    for(const item of w.warmup||[])if(!item.endedAt)item.skippedAt=now;
  }

  if(willWarmup){
    w.phase='warmup-routine';
    w.timedStageIndex=0;
    w.timedStageReps=0;
    w.timedStageSide='';
    w.timedPhaseStartedAt=null;
    const firstWarmup=w.warmup?.[0];
    if(firstWarmup)prefetchGuidedStageCoach('warmup_started',w,firstWarmup,0,'warmup');
  }

  const sessionToken='session-intro-'+w.id;
  fireWorkoutSignal('go',sessionToken,{voice:'',label:'READY'});

  if(willWarmup){
    playPreparedWorkoutCoach(
      'session_started',
      sessionCoachExtra(w),
      sessionCoachLine(w),
      'coach-'+sessionToken
    );
    saveStore();render();
    return;
  }

  if(skipWarmup&&hasWarmup){
    const first=w.exercises?.[0];
    const name=displayName()==='there'?'':displayName();
    const previewEnabled=workoutCueSettings().nextSetPreview!=='off';
    const line='Alright'+(name?' '+name:'')+'. Warm-up skipped.'+(first&&previewEnabled?' First up is '+first.name+'.':'');
    const key=first&&previewEnabled?strengthPreviewKey(w,{ei:0,si:0,type:'exercise'}):'session-skip-warmup-'+w.id;
    playTimelineCue(line,key,{preview:{type:'session',warmupSkipped:true}});
    if(first){
      const form=exerciseInstructionLine(first,0);
      if(form)prefetchTimelineCue(form,formCueKey(w,0,0),{preview:{type:'form',ei:0,si:0}});
    }
  }else{
    playPreparedWorkoutCoach(
      'session_started',
      {exerciseCount:w.exercises.length,warmupCount:0,warmupMinutes:0},
      sessionCoachLine({...w,warmup:[]}),
      'coach-'+sessionToken
    );
  }

  markPhaseStart(w,'strength',now);
  beginPreSetPosition(0,0,true);
  if(skipWarmup&&hasWarmup)toast('Warm-up skipped for this session.');
}

function cancelWarmupCoachPlayback(){
  if('speechSynthesis' in window){try{window.speechSynthesis.cancel?.();}catch{}}
  cancelCoachTimeline();
}
function skipWorkoutWarmup(source='intro'){
  const w=store.activeWorkout;if(!w)return;
  if(w.phase==='intro'){beginWorkoutSession(true);return;}
  if(!['warmup-routine','warmup'].includes(w.phase))return;
  const now=new Date().toISOString();
  const wasActive=w.phase==='warmup';
  w.warmupSkipped=true;
  w.warmupSkippedAt=now;
  w.warmupSkipSource=source||((wasActive)?'active':'routine');
  w.warmupPartiallyCompleted=Boolean(wasActive);
  const startIndex=wasActive?Math.max(0,Number(w.timedStageIndex)||0):0;
  for(let index=startIndex;index<(w.warmup?.length||0);index++){
    const item=w.warmup[index];
    if(!item)continue;
    if(index===startIndex&&wasActive&&!item.endedAt)item.endedAt=now;
    item.skippedAt=now;
  }
  if(wasActive)markPhaseEnd(w,'warmup',now);
  w.timedPhaseStartedAt=null;
  w.timedStageAwaitingStart=false;
  w.timedStageStarting=false;
  w.timedPhaseSkippedSeconds=0;
  w.timedStageReps=0;
  w.timedStageSide='';
  delete w.timedStageSwitchStartedAt;
  delete w.timedStageSwitchEndsAt;
  delete w.reviewPausedTimedStage;
  cancelWarmupCoachPlayback();
  fireWorkoutSignal('transition','warmup-skip-'+w.id,{voice:'',label:'SKIPPED'});
  markPhaseStart(w,'strength',now);
  beginPreSetPosition(0,0,true);
  toast(wasActive?'Remaining warm-up skipped.':'Warm-up skipped for this session.');
}
function startWarmupRoutine(){
  const w=store.activeWorkout;if(!w||w.phase!=='warmup-routine')return;
  unlockWorkoutCues();
  primeCoachCuePack();
  const now=new Date().toISOString();
  const first=w.warmup?.[0];
  w.phase='warmup';
  w.timedStageIndex=0;
  w.timedStageReps=(first?.mode==='reps'||first?.reps)?Math.max(1,num(first.reps)||8):0;
  w.warmupStartedAt=now;
  w.warmupCompletedAt=null;
  w.timedPhaseSkippedSeconds=0;
  w.timedStageSide=first?.side?'right':'';
  markPhaseStart(w,'warmup',now);
  fireWorkoutSignal('go','warmup-start-'+w.id,{voice:'',label:'READY'});
  const extra={
    ...coachStageExtra(w,first,0,'warmup'),
    warmupCount:w.warmup?.length||0,
    warmupMinutes:runnerPhaseMinutes(w.warmup||[])
  };
  const target=extra.stage?.target||'';
  const intro=playPreparedWorkoutCoach(
    'warmup_started',
    extra,
    'Warm-up first. '+(first?.name?first.name+'. '+target+'.':''),
    'coach-warmup-start-'+w.id
  );
  const next=w.warmup?.[1];
  if(next)prefetchGuidedStageCoach('stretch_started',w,next,1,'warmup');
  beginGuidedStageAfterInstruction(w,'warmup',0,intro);
}
async function startGuidedStageNow(){
  const w=store.activeWorkout;
  if(!w||!['warmup','cooldown'].includes(w.phase)||!w.timedStageAwaitingStart||w.timedStageStarting)return;
  unlockWorkoutCues();
  const workoutId=w.id,phase=w.phase,index=w.timedStageIndex||0;
  w.timedStageStarting=true;
  saveStore();render();

  const settings=workoutCueSettings();
  if(settings.countdownMode!=='off'){
    for(const n of ['3','2','1']){
      const started=Date.now();
      await fireWorkoutSignal('warning','guided-start-'+workoutId+'-'+phase+'-'+index+'-'+n,{voice:n,label:n});
      const elapsed=Date.now()-started;
      if(elapsed<650)await waitForCoachBeat(650-elapsed);
    }
    await fireWorkoutSignal('go','guided-start-'+workoutId+'-'+phase+'-'+index+'-go',{voice:'Go',label:'GO'});
  }

  const active=store.activeWorkout;
  if(!active||active.id!==workoutId||active.phase!==phase||active.timedStageIndex!==index)return;
  active.timedStageAwaitingStart=false;
  active.timedStageStarting=false;
  active.timedPhaseStartedAt=new Date().toISOString();
  const item=timedStageItems(active)[index];
  if(item&&!item.startedAt)item.startedAt=active.timedPhaseStartedAt;
  prefetchGuidedLookahead(active);
  saveStore();render();
}
function beginGuidedStageAfterInstruction(w,phase,index,instructionPromise){
  const workoutId=w.id;
  w.timedStageAwaitingStart=true;
  w.timedStageStarting=false;
  w.timedPhaseStartedAt=null;
  saveStore();render();

  Promise.resolve(instructionPromise).finally(()=>{
    const active=store.activeWorkout;
    if(!active||active.id!==workoutId||active.phase!==phase||active.timedStageIndex!==index)return;
    if(guidedAutoStartEnabled(phase))startGuidedStageNow();
  });
}
function completeWarmup(){
  const w=store.activeWorkout;if(!w)return;
  const now=new Date().toISOString();
  w.phase='warmup-complete';w.warmupCompletedAt=now;w.timedPhaseStartedAt=null;w.timedStageAwaitingStart=false;w.timedStageStarting=false;w.timedStageReps=0;w.timedStageSide='';
  markPhaseEnd(w,'warmup',now);
  fireWorkoutSignal('complete','warmup-complete-'+w.id,{voice:'',label:'READY'});
  const next=w.exercises?.[0];
  const previewEnabled=workoutCueSettings().nextSetPreview!=='off';
  if(next&&previewEnabled){
    const previewKey=strengthPreviewKey(w,{ei:0,si:0,type:'exercise'});
    if(timelineWasPlayed(previewKey)){
      playTimelineCue('Warm-up done. Start when you’re ready.','warmup-done-'+w.id,{preview:{type:'warmup-complete'}});
    }else{
      const set=next.sets?.[0]||{};
      playTimelineCue('Warm-up complete. First up is '+next.name+'. '+spokenTargetForSet(next,set)+'.',previewKey,{preview:{type:'strength',ei:0,si:0}});
    }
    const form=exerciseInstructionLine(next,0);
    if(form)prefetchTimelineCue(form,formCueKey(w,0,0),{preview:{type:'form',ei:0,si:0}});
  }else{
    playTimelineCue('Warm-up done. Start when you’re ready.','warmup-done-'+w.id,{preview:{type:'warmup-complete'}});
  }
  saveStore();render();
}
function startStrengthWork(){
  const w=store.activeWorkout;if(!w||w.phase!=='warmup-complete')return;
  markPhaseStart(w,'strength');
  beginPreSetPosition(0,0,true);
}
function addWarmupRep(){
  const w=store.activeWorkout;if(!w||!['warmup','cooldown'].includes(w.phase))return;
  const snap=timedStageSnapshot(w);if(!snap||snap.mode!=='reps')return;
  w.timedStageReps=Math.max(1,(Number(w.timedStageReps)||snap.totalReps)+1);
  saveStore();render();
}
function removeWarmupRep(){
  const w=store.activeWorkout;if(!w||!['warmup','cooldown'].includes(w.phase))return;
  const snap=timedStageSnapshot(w);if(!snap||snap.mode!=='reps')return;
  w.timedStageReps=Math.max(1,(Number(w.timedStageReps)||snap.totalReps)-1);
  saveStore();render();
}
function completeRepStage(){
  const w=store.activeWorkout;if(!w||!['warmup','cooldown'].includes(w.phase))return;
  unlockWorkoutCues();
  const snap=timedStageSnapshot(w);if(!snap||snap.mode!=='reps')return;
  const item=timedStageItems(w)[snap.index];
  item.actualReps=item.actualReps||{};
  const side=item?.side?(w.timedStageSide||'right'):'both';
  item.actualReps[side]=Math.max(1,num(w.timedStageReps)||snap.totalReps);
  fireWorkoutSignal('complete','guided-reps-'+w.id+'-'+w.phase+'-'+snap.index+'-'+side,{voice:'Done',label:'DONE'});
  if(item?.side&&w.timedStageSide!=='left'){beginTimedStageSideSwitch(w);return;}
  advanceTimedStage();
}
function runnerPhaseMinutes(items=[]){
  return Math.max(1,Math.round(items.reduce((sum,item)=>sum+timedStageEstimateSeconds(item),0)/60));
}
function renderWarmupRoutine(w){
  return '<div class="runner-warmup-routine">'+
    '<div class="runner-routine-head"><h2>'+esc(w.routineName)+' Warm-up</h2><p>'+runnerPhaseMinutes(w.warmup)+' minutes · '+w.warmup.length+' movements</p><small>Get your body ready for today’s workout with dynamic movement and mobility.</small></div>'+
    '<div class="runner-routine-list">'+w.warmup.map((item,index)=>{
      const image=timedStageImageUrl(item,0);
      const target=item.mode==='reps'||item.reps?(item.reps+' reps'+(item.side?' '+item.side:'')):(formatClock(item.seconds||30)+(item.side?' each side':''));
      return '<div class="runner-routine-row"><div class="runner-routine-thumb">'+(image?'<img src="'+esc(image)+'" alt="">':'<span>'+String(index+1).padStart(2,'0')+'</span>')+'</div><div><strong>'+esc(item.name)+'</strong><small>'+esc(target)+'</small></div><em>≡</em></div>';
    }).join('')+'</div>'+
    '<div class="runner-warmup-actions"><button class="button primary-action runner-gold-action" data-action="start-warmup">START WARM-UP</button><button class="text-button runner-skip-warmup" data-action="skip-warmup" data-skip-source="routine">SKIP WARM-UP</button></div>'+
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
  const activeStrength=['pre-set','work','timed-set','side-switch','rest','calibrate','feedback','exercise-transition','exercise-review'].includes(w.phase);
  const warmSnap=w.phase==='warmup'?timedStageSnapshot(w):null;
  const headerTitle=w.phase==='warmup'?'Warm-up':w.phase==='cooldown'?'Cooldown':w.routineName;
  const headerProgress=w.phase==='warmup'&&warmSnap?(warmSnap.index+1)+' of '+(w.warmup?.length||0):activeStrength?(pos.ei+1)+' of '+w.exercises.length:'';
  const warmElapsed=w.phase==='warmup'?('<span>Warm-up <b id="warmup-elapsed-clock">'+formatClock(warmupElapsedSeconds(w))+'</b></span>'):'';
  const exerciseElapsed=activeStrength?('<span>Exercise <b id="exercise-clock">'+formatClock(exerciseElapsedSeconds(w))+'</b></span>'):'';
  return '<div class="guided-shell cleaned-workout runner-v2 phase-'+esc(w.phase)+'"><div id="workout-cue-flash" class="workout-cue-flash" aria-hidden="true"></div>'+
    '<header class="runner-v2-header"><button class="workout-back" data-action="home" aria-label="Leave workout and resume later">‹</button><div><strong>'+esc(headerTitle)+'</strong>'+(headerProgress?'<span>'+esc(headerProgress)+'</span>':'')+'<small class="runner-header-timers"><span>Workout <b id="elapsed-clock">'+formatClock(workoutElapsedSeconds(w))+'</b></span>'+exerciseElapsed+warmElapsed+'</small></div><button class="circle-action" data-action="open-workout-map" aria-label="Workout map">•••</button></header>'+
    (w.phase==='warmup'?'<div class="runner-top-progress"><span style="width:'+(((warmSnap?.index||0)+1)/Math.max(1,w.warmup.length)*100)+'%"></span></div>':activeStrength?'<div class="runner-top-progress"><span style="width:'+((pos.ei+1)/Math.max(1,w.exercises.length)*100)+'%"></span></div>':'')+
    '<div class="runner-cue-access">'+renderCueControls()+'</div>'+
    '<div id="coach-live-line" class="coach-live-line" '+(cueRuntime.lastCoachLine?'':'hidden')+'><span>COACH</span><p id="coach-live-text">'+esc(cueRuntime.lastCoachLine||'')+'</p><button type="button" data-action="replay-coach" aria-label="Replay coach cue">↻</button></div>'+
    (w.isPaused?'<div class="workout-pause-banner"><strong>WORKOUT PAUSED</strong><span>Timers are frozen.</span></div>':'')+
    '<section class="exercise-stage runner-v2-stage">'+(w.phase==='intro'?renderWorkoutIntro(w):w.phase==='warmup-routine'?renderWarmupRoutine(w):w.phase==='warmup-complete'?renderWarmupComplete(w):w.phase==='review'?renderWorkoutReview(w):w.phase==='exercise-transition'?renderExerciseTransition(w):w.phase==='exercise-review'?renderExerciseReview(pos):w.phase==='warmup'||w.phase==='cooldown'?renderTimedStage(w):w.phase==='pre-set'?renderPreSet(pos):w.phase==='timed-set'?renderTimedWorkSet(pos):w.phase==='side-switch'?renderSideSwitch(pos):w.phase==='rest'?renderRest(pos):w.phase==='calibrate'?renderCalibration(pos):w.phase==='feedback'?renderExerciseFeedback(pos):renderWorkSet(pos))+'</section>'+
    (!guided&&w.phase!=='cooldown'&&w.phase!=='review'?'<div class="runner-v2-quiet"><button class="text-button" data-action="open-workout-map">WORKOUT MAP</button><button class="text-button muted" data-action="home">LEAVE & RESUME</button></div>':'')+'</div>';
}

function renderPreSet(pos){
  const ex=pos.exercise,set=prepareSetTarget(ex,pos.set,pos.si),previous=previousSetForPosition(ex,pos.si);
  const previousLabel=previous.set?setPerformanceLabel(ex,previous.set):'No previous set';
  const preSet=preSetSnapshot(pos.workout)||{mode:'countdown',remaining:3};
  const blockLabel=dynamicBlockPositionLabel(pos.workout,ex);
  const bounds=repBounds(ex.reps);
  const noWeight=['bodyweight','timed','band'].includes(ex.loadMode);
  const repLabel=ex.loadMode==='timed'?'sec':(exerciseRepCountMode(ex)==='per-side'?'reps / side':'reps');
  const targetReps=recommendedRepTarget(ex);
  const recommendedReps=bounds.low&&bounds.high&&bounds.low!==bounds.high
    ?(targetReps>bounds.high?(exerciseRepDisplay(ex,targetReps)+' · base '+bounds.low+'–'+bounds.high):(bounds.low+'–'+bounds.high+(exerciseRepCountMode(ex)==='per-side'?' / side':' reps')))
    :exerciseRepDisplay(ex,targetReps);
  const recommendedWeight=noWeight?(ex.loadMode==='bodyweight'?'Bodyweight':ex.loadMode==='band'?'Band resistance':'Timed'):exerciseWeightDisplay(ex,recommendedWeightTarget(ex));
  const workingWeight=noWeight?'':exerciseWeightDisplay(ex,setTargetValue(ex,set,'weight'));
  const workingTarget=(workingWeight?workingWeight+' × ':'')+exerciseRepDisplay(ex,setTargetValue(ex,set,'reps'));
  const sourceLabel=set.targetSource==='previous-set'?'Carried from your last set':set.targetSource==='learned'?'Learned target from your last session':set.targetSource==='history'?'Loaded from your last completed session':'Plan starting point';
  const timedExercise=ex.loadMode==='timed';
  const autoTimed=timedExercise&&workoutCueSettings().autoStartTimedExercise;
  const startControl=autoTimed
    ? '<div class="runner-auto-start" role="status"><span id="preset-phase-label">'+(preSet.mode==='coach'?'COACHING':preSet.mode==='setup'?'GET READY':'AUTO START')+'</span><strong id="preset-countdown">'+(preSet.mode==='coach'?'…':preSet.remaining)+'</strong><small>'+(preSet.mode==='coach'?'Countdown starts after the coach finishes the exercise intro.':'Timed exercise starts automatically when the countdown reaches zero.')+'</small></div>'+renderCountdownExercisePreview(pos)+'<button class="button secondary runner-start-now" type="button" data-action="start-set-now">START COUNTDOWN NOW</button>'
    : '<div class="runner-manual-start-note" role="status"><span>'+(preSet.mode==='coach'?'COACHING':'WHEN YOU’RE READY')+'</span><strong>'+(preSet.mode==='coach'?'Listen for the exercise setup.':'You control when this set starts.')+'</strong><small>The coach countdown begins after you tap Start Set.</small></div><button class="button primary-action runner-gold-action runner-start-now" type="button" data-action="start-set-now" '+(preSet.mode==='coach'?'disabled':'')+'>'+(preSet.mode==='coach'?'COACHING…':(timedExercise?'START TIMED SET':'START SET'))+'</button>';
  return '<div class="runner-set-ready">'+
    '<div class="runner-set-ready-head"><div><h2>'+esc(ex.name)+'</h2><p>Set '+(pos.si+1)+' of '+ex.sets.length+(blockLabel?' · '+esc(blockLabel):'')+(exerciseRepCountMode(ex)==='per-side'?' · EACH SIDE':'')+'</p></div><button class="more-action" data-action="open-exercise-actions" data-exercise-index="'+pos.ei+'">•••</button></div>'+
    '<div class="runner-set-ready-media '+(exerciseMediaSpec(ex).status==='direct'?'':'compact-fallback')+'">'+exerciseImageButton(ex,'pre-set-exercise-media')+'</div>'+
    '<div class="runner-recommended-line"><span>TODAY’S WORKING TARGET</span><strong>'+esc(workingTarget)+'</strong><small>'+esc(sourceLabel)+' · Plan baseline: '+esc(recommendedWeight)+' · '+esc(recommendedReps)+' · Previous: '+esc(previousLabel)+'</small></div>'+
    renderExerciseGuidanceCard(ex,{compact:true,label:'HOW TO'})+
    '<div class="runner-target-steppers '+(noWeight?'single':'')+'">'+
      (!noWeight?'<div class="runner-target-stepper"><span>WEIGHT'+(ex.loadMode==='dumbbell-pair'?' · EACH':'')+'</span><div><button data-action="adjust-set-target" data-target-type="weight" data-target-delta="-1" aria-label="Decrease weight">−</button><strong>'+esc(exerciseWeightDisplay(ex,setTargetValue(ex,set,'weight')))+'</strong><button data-action="adjust-set-target" data-target-type="weight" data-target-delta="1" aria-label="Increase weight">+</button></div></div>':'')+
      '<div class="runner-target-stepper"><span>'+(ex.loadMode==='timed'?'TIME':exerciseRepCountMode(ex)==='per-side'?'REPS · EACH SIDE':'REPS')+'</span><div><button data-action="adjust-set-target" data-target-type="reps" data-target-delta="-1" aria-label="Decrease '+repLabel+'">−</button><strong>'+esc(exerciseRepDisplay(ex,setTargetValue(ex,set,'reps')))+'</strong><button data-action="adjust-set-target" data-target-type="reps" data-target-delta="1" aria-label="Increase '+repLabel+'">+</button></div></div>'+
    '</div>'+
    startControl+
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
    renderExerciseGuidanceCard(pos.exercise,{compact:true,label:'FORM WHILE YOU WORK'})+
    '<button class="button secondary" data-action="end-timed-set">END SET EARLY</button>'+
    '<div class="preset-tertiary"><button class="text-button" data-exercise-detail="'+esc(pos.exercise.id)+'">Form</button><button class="text-button" data-action="open-exercise-actions" data-exercise-index="'+pos.ei+'">Options</button><button class="text-button muted" data-action="reset-timer">Reset</button></div>'+
  '</div>';
}
function renderTimedStage(w){
  const items=timedStageItems(w),snap=timedStageSnapshot(w)||{index:0,remaining:0,total:30,mode:'time'};
  const index=Math.max(0,Math.min(snap.index||0,Math.max(0,items.length-1))),item=items[index]||items[0],next=index+1<items.length?items[index+1]:null;
  const image=timedStageImageUrl(item,0);
  const pct=snap.mode==='reps'
    ?Math.max(0,Math.min(100,(snap.completedReps/Math.max(1,snap.totalReps))*100))
    :snap.mode==='switch'
      ?Math.max(0,Math.min(100,(snap.remaining/Math.max(1,snap.total))*100))
      :Math.max(0,Math.min(100,((snap.total-snap.remaining)/Math.max(1,snap.total))*100));

  if(snap.mode==='ready'){
    return '<div class="timed-stage runner-guided-stage runner-guided-ready" data-stage-index="'+index+'" data-stage-mode="ready">'+
      '<div class="runner-stage-media">'+(image?'<img src="'+esc(image)+'" loading="eager" decoding="async" alt="'+esc(item?.name||'Movement')+' demonstration">':'<div class="runner-stage-placeholder"><span>'+String(index+1).padStart(2,'0')+'</span></div>')+'</div>'+
      '<div class="runner-stage-copy">'+(snap.side?'<span class="runner-stage-side">'+esc(snap.side)+'</span>':'')+'<h2>'+esc(item?.name||'Get ready')+'</h2><p>'+esc(item?.description||item?.cue||'Move through a comfortable range.')+'</p></div>'+
      '<div class="runner-guided-ready-card"><span>'+(w.timedStageStarting?'STARTING':'WHEN YOU’RE READY')+'</span><strong>'+(w.timedStageStarting?'Coach countdown is running.':'Start this movement when you are set.')+'</strong><small>'+(guidedAutoStartEnabled(w.phase)?'This normally starts after the coach cue.':'Auto-start is off in your coach settings.')+'</small></div>'+
      '<button class="button primary-action runner-gold-action" data-action="start-guided-stage" '+(w.timedStageStarting?'disabled':'')+'>'+(w.timedStageStarting?'STARTING…':'START MOVEMENT')+'</button>'+
      (w.phase==='warmup'?'<button class="text-button runner-skip-warmup runner-skip-remaining" data-action="skip-warmup" data-skip-source="active">SKIP REMAINING WARM-UP</button>':'')+
    '</div>';
  }

  if(snap.mode==='switch'){
    return '<div class="timed-stage runner-guided-stage runner-side-switch-stage" data-stage-index="'+index+'" data-stage-mode="switch">'+
      '<div class="runner-stage-copy"><p class="eyebrow">SWITCH SIDES</p><h2>Move to your left side</h2><p>'+esc(item?.name||'Movement')+'</p></div>'+
      '<div class="runner-stage-time" id="stage-clock">'+formatClock(snap.remaining)+'</div>'+
      '<div class="runner-stage-progress"><span id="stage-progress-fill" style="width:'+pct+'%"></span></div>'+
      '<div class="runner-timer-controls three"><button data-action="reset-timer">RESET</button><button data-action="toggle-workout-pause">'+(w.isPaused?'RESUME':'PAUSE')+'</button><button data-action="skip-side-stage-switch">SKIP</button></div>'+
      '<small class="runner-switch-note">Reposition safely. The left side starts automatically at zero.</small>'+
    '</div>';
  }

  const sideLabel=snap.side?'<span class="runner-stage-side">'+esc(snap.side)+'</span>':'';
  return '<div class="timed-stage runner-guided-stage" data-stage-index="'+index+'" data-stage-mode="'+esc(snap.mode)+'">'+
    '<div class="runner-stage-media">'+(image?'<img src="'+esc(image)+'" loading="eager" decoding="async" alt="'+esc(item?.name||'Movement')+' demonstration">':'<div class="runner-stage-placeholder"><span>'+String(index+1).padStart(2,'0')+'</span></div>')+'</div>'+
    '<div class="runner-stage-copy">'+sideLabel+'<h2>'+esc(item?.name||'Get ready')+'</h2><p>'+esc(item?.description||item?.cue||'Move through a comfortable range.')+'</p>'+(item?.cue?'<small class="runner-stage-form-tip"><b>FORM TIP</b> '+esc(item.cue)+'</small>':'')+'</div>'+
    (snap.mode==='reps'?'<div class="runner-rep-selected"><span>ACTUAL REPS</span><div class="runner-rep-stepper"><button data-action="warmup-rep-minus" '+(snap.completedReps<=1?'disabled':'')+' aria-label="Decrease reps">−</button><div><strong>'+snap.completedReps+'</strong><span>of '+snap.totalReps+' target'+(item?.side?' · this side':'')+'</span></div><button data-action="warmup-rep" aria-label="Increase reps">+</button></div><button class="button primary-action runner-gold-action" data-action="complete-stage-reps">COMPLETE MOVEMENT</button></div>':'<div class="runner-stage-time" id="stage-clock">'+formatClock(snap.remaining)+'</div>')+
    (snap.mode==='reps'?'<small class="runner-rep-instruction">Adjust the number only if you completed more or fewer reps, then tap Complete Movement.</small>':'<div class="runner-stage-progress"><span id="stage-progress-fill" style="width:'+pct+'%"></span></div>')+
    '<div class="runner-timer-controls three"><button data-action="reset-timer">RESET</button><button data-action="toggle-workout-pause">'+(w.isPaused?'RESUME':'PAUSE')+'</button><button data-action="skip-stage">SKIP</button></div>'+
    (w.phase==='warmup'?'<button class="text-button runner-skip-warmup runner-skip-remaining" data-action="skip-warmup" data-skip-source="active">SKIP REMAINING WARM-UP</button>':'')+
    (next?'<div class="runner-up-next"><span>Up next</span><div class="runner-routine-thumb">'+(timedStageImageUrl(next,0)?'<img src="'+esc(timedStageImageUrl(next,0))+'" alt="">':'<b>'+String(index+2).padStart(2,'0')+'</b>')+'</div><div><strong>'+esc(next.name)+'</strong><small>'+(next.mode==='reps'||next.reps?esc(next.reps+' reps'+(next.side?' · each side':'')):formatClock(next.seconds||30))+'</small></div></div>':'')+
  '</div>';
}

function exerciseSessionHistory(exerciseRef,limit=4){
  const rows=[];
  const identity=exerciseHistoryIdentity(exerciseRef);
  for(const workout of store.history){
    const ex=(workout.exercises||[]).find(item=>exerciseMatchesHistory(item,identity));
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
      sets:sets.map(set=>({weight:num(set.weight),reps:num(set.reps),durationSeconds:num(set.durationSeconds),plannedWeight:num(set.plannedWeight),plannedReps:num(set.plannedReps),startedAt:set.startedAt||'',endedAt:set.endedAt||set.completedAt||'',sides:clone(set.sides||null)})),
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
  const reps=exerciseRepDisplay(ex,set.reps);
  if(!set.weight)return reps;
  return exerciseWeightDisplay(ex,set.weight)+' × '+reps;
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
  const repLabel=ex.loadMode==='timed'?'sec':(exerciseRepCountMode(ex)==='per-side'?'reps / side':'reps');
  const side=exerciseNeedsSideSwitch(ex)?activeExerciseSide(set):'';
  const sideLabel=side?side.toUpperCase()+' SIDE':'';
  const plannedWeight=set.plannedWeight??set.weight??'';
  const plannedReps=set.plannedReps??set.reps??'';
  const displayLoad=noWeight?(ex.loadMode==='band'?'Band resistance':'Bodyweight'):(String(setTargetValue(ex,set,'weight'))+' lb');
  return '<div class="runner-work-clean">'+
    '<div class="runner-work-clean-head"><button class="text-button" data-exercise-detail="'+esc(ex.id)+'">FORM</button><div><strong>'+esc(ex.name)+'</strong><span>Set '+(pos.si+1)+' of '+ex.sets.length+(sideLabel?' · '+esc(sideLabel):'')+'</span></div><button class="more-action" data-action="open-exercise-actions" data-exercise-index="'+pos.ei+'">•••</button></div>'+
    '<div class="runner-active-media '+(exerciseMediaSpec(ex).status==='direct'?'':'compact-fallback')+'">'+exerciseImageButton(ex,'active-exercise-media')+'</div>'+
    renderExerciseGuidanceCard(ex,{compact:true,label:'FORM WHILE YOU WORK'})+

    '<div class="runner-live-plan"><span>PLANNED</span><strong>'+(noWeight?'':esc(plannedWeight||0)+' lb × ')+esc(plannedReps)+' '+repLabel+'</strong></div>'+
    '<div class="runner-load-focus"><strong>'+esc(displayLoad)+'</strong><span>'+esc(exerciseGuidance(ex).cue||'Keep the movement controlled.')+'</span></div>'+
    '<div class="runner-target-steppers '+(noWeight?'single':'')+' compact">'+
      (!noWeight?'<div class="runner-target-stepper"><span>ACTUAL WEIGHT'+(ex.loadMode==='dumbbell-pair'?' · EACH':'')+'</span><div><button data-action="adjust-set-target" data-target-type="weight" data-target-delta="-1">−</button><strong>'+esc(exerciseWeightDisplay(ex,setTargetValue(ex,set,'weight')))+'</strong><button data-action="adjust-set-target" data-target-type="weight" data-target-delta="1">+</button></div></div>':'')+
      '<div class="runner-target-stepper"><span>ACTUAL '+(ex.loadMode==='timed'?'TIME':exerciseRepCountMode(ex)==='per-side'?'REPS · EACH SIDE':'REPS')+'</span><div><button data-action="adjust-set-target" data-target-type="reps" data-target-delta="-1">−</button><strong>'+esc(exerciseRepDisplay(ex,setTargetValue(ex,set,'reps')))+'</strong><button data-action="adjust-set-target" data-target-type="reps" data-target-delta="1">+</button></div></div>'+
    '</div>'+
    '<input id="set-weight" type="hidden" value="'+esc(set.weight??'')+'"><input id="set-reps" type="hidden" value="'+esc(set.reps??'')+'">'+
    '<section class="runner-live-log"><button class="button primary-action runner-gold-action" data-action="complete-set">'+(sideLabel?'COMPLETE '+esc(sideLabel):'COMPLETE SET')+'</button><button class="text-button" data-action="skip-current-set">SKIP SET</button></section>'+
  '</div>';
}
function renderSideSwitch(pos){
  const remaining=sideSwitchRemaining(pos.workout);
  const duration=Math.max(1,num(pos.workout.sideSwitchDuration)||exerciseSideSwitchSeconds(pos.exercise)||5);
  const pct=Math.max(0,Math.min(100,(remaining/duration)*100));
  return '<div class="runner-side-switch">'+
    '<p class="eyebrow">SET '+(pos.si+1)+' · SWITCH SIDES</p>'+
    '<h2>Switch to your left side</h2>'+
    '<p>'+esc(pos.exercise.name)+' · '+exerciseRepDisplay(pos.exercise,pos.set.reps)+'</p>'+
    '<div class="timer-wrap runner-rest-ring" id="timer-ring" style="--timer-progress:'+pct+'%"><div><div class="timer-value" id="side-switch-clock">'+formatClock(remaining)+'</div><div class="timer-sub">SWITCH</div></div></div>'+
    '<div class="runner-timer-controls three"><button data-action="reset-timer">RESET</button><button data-action="toggle-workout-pause">'+(pos.workout.isPaused?'RESUME':'PAUSE')+'</button><button data-action="skip-side-switch">SKIP</button></div>'+
    '<small>Use this time to reposition your grip, stance, bench, or weight safely.</small>'+
  '</div>';
}

function renderCalibration(pos){
  const first=pos.exercise.sets[0];
  const options=[
    ['5+','Very easy'],['3-4','Easy'],['2','Right on target'],['1','Very hard'],['0','Max effort']
  ];
  return '<div class="calibration-stage"><p class="eyebrow">QUICK CALIBRATION</p><h3>How much did you have left?</h3><p>You completed '+esc(first.reps)+' reps at '+(first.weight?esc(first.weight)+' lb':'your chosen resistance')+'. Pick the closest answer. GoWorkout will show and apply the next target immediately.</p>'+
    '<div class="rir-grid">'+options.map(([value,label])=>{const rec=calibrationRecommendation(pos.exercise,value);return '<button data-rir="'+value+'"><strong>'+esc(value==='3-4'?'3–4':value)+'</strong><span>'+esc(label)+'</span><small>Next: '+esc(rec.label)+'</small></button>';}).join('')+'</div>'+
    '<small class="calibration-note">This calibration establishes a working target. Later sessions rely on your completed sets and exercise feedback instead of asking every time.</small></div>';
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
  const sameBlockNext=Boolean(nextEx&&sameDynamicBlock(pos.exercise,nextEx));
  const blockRound=Boolean(sameBlockNext&&next?.type==='block-round');
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
  return '<div class="runner-rest-clean"><div class="runner-rest-check">✓</div><h2>'+(sameBlockNext?(blockRound?'Round complete.':'Quick transition.'):'Great set.')+'</h2><p>'+esc(completed)+'</p>'+
    (sameBlockNext?'<div class="runner-block-rest-label"><span>'+esc(dynamicBlockPositionLabel(pos.workout,pos.exercise))+'</span><strong>'+(blockRound?'FULL REST':'QUICK REST')+'</strong></div>':'')+
    (changed?'<div class="runner-rest-plan"><span>PLANNED</span><strong>'+esc(planned)+'</strong></div>':'')+
    '<div class="timer-wrap runner-rest-ring" id="timer-ring" style="--timer-progress:'+restProgress(pos.workout)+'%"><div><div class="timer-value" id="rest-clock">'+formatClock(remaining)+'</div><div class="timer-sub">'+(paused?'PAUSED':'REST')+'</div></div></div>'+
    '<div class="runner-rest-next">'+(nextEx?exerciseImageButton(nextEx,'rest-next-exercise-media'):'')+'<div><span>Up next</span><strong>'+esc(nextName)+'</strong><small>'+(nextSet?'Set '+nextSet+' of '+(nextEx?.sets?.length||pos.exercise.sets.length)+' · ':'')+esc(nextEx?currentPrescriptionLabel(nextEx):next?currentPrescriptionLabel(pos.exercise):'Guided cooldown')+'</small></div></div>'+
    '<div class="runner-rest-actions-clean four"><button data-action="reset-timer">RESET</button><button data-action="pause-rest">'+(paused?'RESUME':'PAUSE')+'</button><button data-action="skip-rest">SKIP</button><button data-action="add-rest" '+(remaining>=180?'disabled':'')+'>+15 SEC</button></div></div>';
}

function historyTimingInfo(item){
  if(!item)return {manual:false,legacy:true,valid:false,activeMinutes:null,elapsedMinutes:null,sessionRange:'',label:'Timing unavailable'};
  if(item.manualWorkoutCompletion)return {manual:true,legacy:false,valid:false,activeMinutes:null,elapsedMinutes:null,sessionRange:'',label:'No exercise timing recorded'};
  const startValue=item.trainingStartedAt||(!item.preparedAt?item.startedAt:'');
  const endValue=item.endedAt||item.completedAt||'';
  const start=Date.parse(startValue||''),end=Date.parse(endValue||'');
  const wallSeconds=Number.isFinite(start)&&Number.isFinite(end)&&end>=start?Math.round((end-start)/1000):0;
  const newTiming=Boolean(item.trainingStartedAt||item.activeDurationSeconds||item.wallClockSeconds);
  let activeSeconds=num(item.activeDurationSeconds);
  if(!activeSeconds&&num(item.durationMinutes)>0&&num(item.durationMinutes)<=300)activeSeconds=num(item.durationMinutes)*60;
  let elapsedSeconds=num(item.wallClockSeconds);
  if(!elapsedSeconds&&wallSeconds>0)elapsedSeconds=wallSeconds;
  const suspicious=wallSeconds>8*3600||activeSeconds>5*3600||elapsedSeconds>8*3600;
  const validRange=wallSeconds>0&&!suspicious;
  const activeMinutes=activeSeconds>0&&!suspicious?Math.max(1,Math.round(activeSeconds/60)):null;
  const elapsedMinutes=elapsedSeconds>0&&!suspicious?Math.max(1,Math.round(elapsedSeconds/60)):activeMinutes;
  return {
    manual:false,
    legacy:!newTiming,
    valid:Boolean(validRange||activeMinutes),
    suspicious,
    activeMinutes,
    elapsedMinutes,
    sessionRange:validRange?formatTimeRange(startValue,endValue):'',
    label:suspicious?'Legacy timing · duration unavailable':(!newTiming?'Legacy timing':'Complete timing')
  };
}
function historyActualDate(item){
  return item?.actualCompletedDate||item?.actualStartDate||(item?.completedAt?dateKey(new Date(item.completedAt)):'');
}
function historyStatusBadges(item){
  const timing=historyTimingInfo(item),badges=[];
  if(item?.manualWorkoutCompletion)badges.push('MANUAL');
  else if(item?.completionStatus==='partial')badges.push('PARTIAL');
  else badges.push('COMPLETED');
  const records=workoutRecordClassification(item||{});
  if(records.prs?.length)badges.push(records.prs.length+' PR'+(records.prs.length===1?'':'s'));
  if(item?.trainingContext?.temporary||item?.trainingContext?.adapted)badges.push('ADAPTED');
  if(item?.sharedSession)badges.push('PARTNER');
  if(timing.legacy)badges.push('LEGACY');
  return badges;
}
function historyTags(item){
  const tags=[];
  if(item?.trainingContext)tags.push(sessionSetupLabel(item.trainingContext));
  else if(item?.manualWorkoutCompletion)tags.push('Manual');
  if(item?.sharedSession?.partnerName)tags.push('With '+item.sharedSession.partnerName);
  if(item?.readiness?.energy&&num(item.readiness.energy)<=2)tags.push('Low energy');
  if(item?.completionStatus==='partial')tags.push('Partial');
  if((item?.exercises||[]).some(ex=>ex.swappedFrom))tags.push('Substitutions');
  const timing=historyTimingInfo(item);
  if(timing.activeMinutes!==null&&timing.activeMinutes<=30)tags.push('Short session');
  return [...new Set(tags.filter(Boolean))];
}
function historyPerformanceHighlight(item){
  if(item?.manualWorkoutCompletion)return 'No exercise data recorded.';
  const records=workoutRecordClassification(item||{});
  if(records.prs?.length){
    const first=records.prs[0];
    return records.prs.length===1?(first.name+' improved'):records.prs.length+' personal records improved';
  }
  const swaps=(item?.exercises||[]).filter(ex=>ex.swappedFrom).length;
  if(swaps)return swaps+' exercise substitution'+(swaps===1?'':'s')+' recorded';
  const skipped=(item?.exercises||[]).filter(ex=>ex.skipped).length;
  if(skipped)return skipped+' exercise'+(skipped===1?'':'s')+' skipped with context saved';
  const tooEasy=(item?.exercises||[]).filter(ex=>ex.feedback==='too-easy').length;
  if(tooEasy)return tooEasy+' movement'+(tooEasy===1?'':'s')+' ready for progression review';
  const completed=(item?.exercises||[]).filter(ex=>exerciseCountsAsResolved(ex)).length;
  const total=(item?.exercises||[]).length;
  return total&&completed===total?'Full workout completed':'Training data saved';
}
function previousComparableWorkout(item){
  const currentTime=Date.parse(item?.completedAt||'');
  return (store.history||[])
    .filter(candidate=>candidate.id!==item?.id&&candidate.routineName===item?.routineName&&Date.parse(candidate.completedAt||'')<currentTime&&!candidate.manualWorkoutCompletion)
    .sort((a,b)=>Date.parse(b.completedAt)-Date.parse(a.completedAt))[0]||null;
}
function signedMetric(value,suffix=''){
  const n=Math.round(value*10)/10;
  return (n>0?'+':'')+n+suffix;
}
function historyComparison(item){
  const previous=previousComparableWorkout(item);
  if(!previous)return null;
  const currentTiming=historyTimingInfo(item),previousTiming=historyTimingInfo(previous);
  return {
    previous,
    sets:num(item.completedSets)-num(previous.completedSets),
    volume:num(item.totalVolume)-num(previous.totalVolume),
    minutes:currentTiming.activeMinutes!==null&&previousTiming.activeMinutes!==null?currentTiming.activeMinutes-previousTiming.activeMinutes:null
  };
}
function exerciseBestBeforeHistory(ex,item){
  const identity=exerciseHistoryIdentity(ex);
  const cutoff=Date.parse(item?.completedAt||'');
  let best=null,when='';
  for(const workout of store.history||[]){
    if(workout.id===item?.id||Date.parse(workout.completedAt||'')>=cutoff)continue;
    const prior=(workout.exercises||[]).find(candidate=>exerciseMatchesHistory(candidate,identity));
    if(!prior)continue;
    for(const set of prior.sets||[]){
      if(!set.completed)continue;
      const current={weight:num(set.weight),reps:num(set.reps)};
      if(!best||current.weight>best.weight||(current.weight===best.weight&&current.reps>best.reps)){best=current;when=workout.completedAt;}
    }
  }
  return best?{...best,when}:null;
}
function exerciseFeedbackPattern(ex,item){
  const identity=exerciseHistoryIdentity(ex);
  const cutoff=Date.parse(item?.completedAt||'');
  const values=[];
  for(const workout of store.history||[]){
    if(workout.id===item?.id||Date.parse(workout.completedAt||'')>=cutoff)continue;
    const prior=(workout.exercises||[]).find(candidate=>exerciseMatchesHistory(candidate,identity));
    if(prior?.feedback)values.push(prior.feedback);
    if(values.length>=3)break;
  }
  if(!ex?.feedback)return null;
  const same=values.filter(value=>value===ex.feedback).length;
  if(same<1)return null;
  const total=same+1;
  if(ex.feedback==='too-hard'||ex.feedback==='hard')return {tone:'caution',text:feedbackLabel(ex.feedback)+' in '+total+' recent sessions. GoWorkout should avoid progressing this movement automatically.'};
  if(ex.feedback==='too-easy')return {tone:'progress',text:'Too easy in '+total+' recent sessions. This is a stronger progression signal than a single easy day.'};
  if(ex.feedback==='form-off')return {tone:'caution',text:'Form concerns repeated across '+total+' recent sessions. Hold progression until the movement feels cleaner.'};
  return null;
}
function historyRestAnalysis(item){
  const rows=(item?.restLog||[]).filter(rest=>rest.endedAt||Number.isFinite(rest.actualSeconds));
  if(!rows.length)return null;
  const actual=rows.reduce((sum,row)=>sum+Math.max(0,num(row.actualSeconds)),0)/rows.length;
  const planned=rows.reduce((sum,row)=>sum+Math.max(0,num(row.plannedSeconds)),0)/rows.length;
  const skipped=rows.filter(row=>row.skipped).length;
  return {count:rows.length,actual:Math.round(actual),planned:Math.round(planned),skipped};
}
function historyMonthKey(item){
  const d=new Date(item?.completedAt||item?.actualCompletedDate||Date.now());
  return Number.isFinite(d.getTime())?[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0')].join('-'):'unknown';
}
function historyMonthLabel(key){
  if(key==='unknown')return 'Unknown date';
  const [year,month]=key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric'}).format(new Date(year,month-1,1));
}
function filteredHistoryItems(){
  const context=programContext();
  let items=[...(store.history||[])];
  if(historyFilter==='block')items=items.filter(item=>item.programContext?.blockNumber===context.blockNumber);
  if(['7','30','90'].includes(historyFilter)){
    const rangeStart=new Date();rangeStart.setDate(rangeStart.getDate()-Number(historyFilter));
    items=items.filter(item=>new Date(item.completedAt)>=rangeStart);
  }
  if(historyStatusFilter==='prs')items=items.filter(item=>workoutRecordClassification(item).prs?.length);
  if(historyStatusFilter==='partial')items=items.filter(item=>item.completionStatus==='partial');
  if(historyStatusFilter==='manual')items=items.filter(item=>item.manualWorkoutCompletion);
  if(historyStatusFilter==='adapted')items=items.filter(item=>item.trainingContext?.temporary||item.trainingContext?.adapted);
  if(historyStatusFilter==='shared')items=items.filter(item=>item.sharedSession);
  if(historyRoutineFilter!=='all')items=items.filter(item=>item.routineName===historyRoutineFilter);
  if(historyMuscleFilter!=='all')items=items.filter(item=>(item.exercises||[]).some(ex=>(ex.muscles||[]).includes(historyMuscleFilter)));
  if(historySetupFilter!=='all')items=items.filter(item=>{
    const key=item.trainingContext?.key||'standard';
    return key===historySetupFilter;
  });
  const q=historySearch.trim().toLowerCase();
  if(q)items=items.filter(item=>[
    item.routineName,item.note,...historyTags(item),
    ...(item.exercises||[]).flatMap(ex=>[ex.name,ex.note,ex.swapReason,ex.swappedFrom?.name])
  ].filter(Boolean).join(' ').toLowerCase().includes(q));
  return items.sort((a,b)=>Date.parse(b.completedAt||0)-Date.parse(a.completedAt||0));
}
function renderHistoryCard(item){
  const timing=historyTimingInfo(item),badges=historyStatusBadges(item),tags=historyTags(item);
  const scheduled=item.scheduledDate||'',actual=historyActualDate(item);
  const dateCopy=item.manualWorkoutCompletion&&scheduled?'Marked complete for '+formatDate(scheduled):scheduled&&scheduled!==actual?formatDate(scheduled)+' · trained '+formatDate(actual):formatDate(item.completedAt);
  const duration=timing.manual?'No exercise data':timing.activeMinutes!==null?(timing.activeMinutes+' active min'):'Duration unavailable';
  const range=timing.sessionRange?' · '+timing.sessionRange:'';
  return '<article class="history-card history-journal-card">'+
    '<button class="history-main" data-action="history-details" data-history-id="'+esc(item.id)+'">'+
      '<div class="history-card-top"><div><h3>'+esc(item.routineName)+'</h3><div class="history-badge-row">'+badges.map(badge=>'<span>'+esc(badge)+'</span>').join('')+'</div></div><em>›</em></div>'+
      '<p>'+esc(dateCopy)+range+'</p>'+
      '<div class="history-card-stats"><strong>'+esc(duration)+'</strong>'+(item.manualWorkoutCompletion?'':'<span>'+num(item.completedSets)+' sets</span><span>'+formatVolume(item.totalVolume||0)+'</span>')+'</div>'+
      '<small class="history-highlight">'+esc(historyPerformanceHighlight(item))+'</small>'+
      (tags.length?'<div class="history-tag-row">'+tags.map(tag=>'<span>'+esc(tag)+'</span>').join('')+'</div>':'')+
    '</button>'+
    '<button class="history-more compact" data-action="open-history-menu" data-history-id="'+esc(item.id)+'" aria-label="Workout options">•••</button>'+
  '</article>';
}
function renderHistoryMonthGroup(key,items){
  const totalSets=items.reduce((sum,item)=>sum+num(item.completedSets),0);
  const totalVolume=items.reduce((sum,item)=>sum+num(item.totalVolume),0);
  return '<section class="history-month-group"><div class="history-month-head"><div><span>'+esc(historyMonthLabel(key))+'</span><strong>'+items.length+' workout'+(items.length===1?'':'s')+'</strong></div><small>'+totalSets+' sets · '+formatVolume(totalVolume)+'</small></div>'+
    '<div class="history-list clean-history-list">'+items.map(renderHistoryCard).join('')+'</div></section>';
}
function renderHistoryCalendar(items){
  const base=new Date();base.setDate(1);base.setMonth(base.getMonth()+historyCalendarOffset);base.setHours(0,0,0,0);
  const year=base.getFullYear(),month=base.getMonth();
  const firstDay=new Date(year,month,1),lastDay=new Date(year,month+1,0);
  const mondayOffset=(firstDay.getDay()+6)%7;
  const byDate=new Map();
  for(const item of items){
    const key=historyActualDate(item);
    if(!byDate.has(key))byDate.set(key,[]);
    byDate.get(key).push(item);
  }
  const cells=[];
  for(let i=0;i<mondayOffset;i++)cells.push('<div class="history-calendar-day empty"></div>');
  for(let day=1;day<=lastDay.getDate();day++){
    const key=dateKey(new Date(year,month,day)),matches=byDate.get(key)||[];
    cells.push('<button class="history-calendar-day '+(matches.length?'has-workout':'')+'" '+(matches.length?'data-action="history-details" data-history-id="'+esc(matches[0].id)+'"':'disabled')+'><span>'+day+'</span>'+(matches.length?'<strong>'+esc(matches[0].routineName)+'</strong><small>'+matches.length+' session'+(matches.length===1?'':'s')+'</small>':'')+'</button>');
  }
  return '<section class="history-calendar"><div class="history-calendar-head"><button data-action="history-calendar-prev">‹</button><h3>'+esc(new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric'}).format(base))+'</h3><button data-action="history-calendar-next">›</button></div>'+
    '<div class="history-calendar-weekdays">'+['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day=>'<span>'+day+'</span>').join('')+'</div>'+
    '<div class="history-calendar-grid">'+cells.join('')+'</div></section>';
}
function renderHistory(){
  const items=filteredHistoryItems();
  const groups=new Map();
  for(const item of items){const key=historyMonthKey(item);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item);}
  const filters=[['all','All'],['block','This Block'],['7','7 Days'],['30','30 Days'],['90','90 Days']];
  const statusFilters=[['all','Any status'],['prs','PRs'],['partial','Partial'],['manual','Manual'],['adapted','Adapted'],['shared','Partner']];
  const routines=[...new Set((store.history||[]).map(item=>item.routineName).filter(Boolean))].sort();
  const muscles=[...new Set((store.history||[]).flatMap(item=>(item.exercises||[]).flatMap(ex=>ex.muscles||[])).filter(Boolean))].sort();
  const setups=[...new Set((store.history||[]).map(item=>item.trainingContext?.key||'standard'))].sort();
  return '<div class="clean-page history-journal-page"><div class="clean-page-head"><div><p class="eyebrow">HISTORY</p><h2>Your training journal.</h2><p>See what you did, what changed, and what GoWorkout will carry into the next session.</p></div><button class="text-button" data-action="progress">PROGRESS</button></div>'+
    (historyLastRemoved?'<button class="history-undo-banner" data-action="undo-history-remove"><strong>Workout removed</strong><span>UNDO</span></button>':'')+
    '<div class="history-toolbar"><label class="history-search"><span>SEARCH</span><input id="history-search" type="search" value="'+esc(historySearch)+'" placeholder="Workout, exercise, note, partner..."></label><div class="history-view-toggle"><button class="'+(historyView==='list'?'active':'')+'" data-action="set-history-view" data-history-view="list">LIST</button><button class="'+(historyView==='calendar'?'active':'')+'" data-action="set-history-view" data-history-view="calendar">CALENDAR</button></div></div>'+
    '<div class="history-filter-row">'+filters.map(([value,label])=>'<button class="'+(historyFilter===value?'active':'')+'" data-action="set-history-filter" data-history-filter="'+value+'">'+label+'</button>').join('')+'</div>'+
    '<div class="history-filter-row secondary">'+statusFilters.map(([value,label])=>'<button class="'+(historyStatusFilter===value?'active':'')+'" data-action="set-history-status" data-history-status="'+value+'">'+label+'</button>').join('')+'</div>'+
    '<div class="history-select-filters"><label><span>WORKOUT</span><select id="history-routine-filter"><option value="all">All workouts</option>'+routines.map(value=>'<option value="'+esc(value)+'" '+(historyRoutineFilter===value?'selected':'')+'>'+esc(value)+'</option>').join('')+'</select></label><label><span>MUSCLE</span><select id="history-muscle-filter"><option value="all">All muscle groups</option>'+muscles.map(value=>'<option value="'+esc(value)+'" '+(historyMuscleFilter===value?'selected':'')+'>'+esc(value)+'</option>').join('')+'</select></label><label><span>SETUP</span><select id="history-setup-filter"><option value="all">All setups</option>'+setups.map(value=>'<option value="'+esc(value)+'" '+(historySetupFilter===value?'selected':'')+'>'+esc(value==='standard'?'Standard':(SESSION_SETUP_PRESETS[value]?.label||value))+'</option>').join('')+'</select></label></div>'+
    (historyView==='calendar'?renderHistoryCalendar(items):([...groups.entries()].map(([key,rows])=>renderHistoryMonthGroup(key,rows)).join('')||renderEmpty('No workouts here','Try another filter or complete a workout.')))+
  '</div>';
}

function renderHistoryGuidedPhase(label,items=[]){
  if(!items.length)return '';
  const rows=items.map(item=>{
    const status=item.skippedAt?'Skipped':item.endedAt?'Completed':'Recorded';
    const target=item.mode==='reps'||item.reps?(item.reps+' reps'+(item.side?' each side':'')):(formatClock(item.seconds||30)+(item.side?' each side':''));
    return '<div class="history-phase-movement"><div><strong>'+esc(item.name)+'</strong><span>'+esc(status)+' · '+esc(target)+'</span></div><small>'+esc(formatTimeRange(item.startedAt,item.endedAt))+'</small></div>';
  }).join('');
  return '<details class="history-guided-phase"><summary><strong>'+esc(label)+'</strong><span>'+items.length+' movements</span></summary><div>'+rows+'</div></details>';
}
function renderHistoryTimeline(item){
  const events=[],phases=item.phaseTimestamps||{};
  for(const [label,key] of [['Warm-up','warmup'],['Strength','strength'],['Cooldown','cooldown']]){
    const phase=phases[key];if(phase?.startedAt||phase?.endedAt)events.push({label,start:phase.startedAt,end:phase.endedAt,type:'phase'});
  }
  for(const ex of item.exercises||[]){
    if(ex.startedAt||ex.endedAt)events.push({label:ex.name,start:ex.startedAt,end:ex.endedAt,type:'exercise'});
  }
  for(const restEntry of item.restLog||[]){
    if(restEntry.startedAt||restEntry.endedAt)events.push({label:restEntry.skipped?'Rest skipped early':'Rest',start:restEntry.startedAt,end:restEntry.endedAt,type:'rest'});
  }
  for(const pause of item.pauseLog||[]){
    if(pause.startedAt||pause.endedAt)events.push({label:'Workout paused',start:pause.startedAt,end:pause.endedAt,type:'pause'});
  }
  events.sort((a,b)=>Date.parse(a.start||0)-Date.parse(b.start||0));
  const rest=historyRestAnalysis(item);
  return '<section class="history-timeline-section"><div class="history-section-head"><span>SESSION TIMELINE</span><strong>How the workout moved</strong></div>'+
    '<div class="history-timeline">'+events.map(event=>'<div class="history-timeline-event '+event.type+'"><i></i><div><strong>'+esc(event.label)+'</strong><small>'+esc(formatTimeRange(event.start,event.end)||formatTimeStamp(event.start))+'</small></div></div>').join('')+'</div>'+
    (rest?'<div class="history-rest-analysis"><span>REST ANALYSIS</span><strong>Average '+rest.actual+' sec</strong><small>Planned '+rest.planned+' sec · '+rest.count+' rests'+(rest.skipped?' · '+rest.skipped+' skipped early':'')+'</small></div>':'')+
  '</section>';
}
function renderHistoryComparison(item){
  const comparison=historyComparison(item);if(!comparison)return '';
  const previous=comparison.previous;
  return '<section class="history-comparison-card"><div class="history-section-head"><span>COMPARE TO PREVIOUS</span><strong>'+esc(formatDate(previous.completedAt))+'</strong></div>'+
    '<div class="history-comparison-grid"><div><span>SETS</span><strong>'+esc(signedMetric(comparison.sets))+'</strong></div><div><span>VOLUME</span><strong>'+esc(signedMetric(Math.round(comparison.volume),' lb'))+'</strong></div><div><span>ACTIVE TIME</span><strong>'+(comparison.minutes===null?'N/A':esc(signedMetric(comparison.minutes,' min')))+'</strong></div></div>'+
  '</section>';
}
function renderHistoryExerciseCard(item,ex,index){
  const completed=(ex.sets||[]).filter(set=>set.completed);
  const best=completed.reduce((current,set)=>!current||num(set.weight)>num(current.weight)||(num(set.weight)===num(current.weight)&&num(set.reps)>num(current.reps))?set:current,null);
  const previous=exerciseBestBeforeHistory(ex,item);
  const next=ex.nextRecommendation||store.progression?.[ex.id]||null;
  const substitution=ex.swappedFrom?'<div class="history-context-line"><span>SUBSTITUTION</span><strong>'+esc(ex.swappedFrom.name)+' → '+esc(ex.name)+'</strong><small>'+esc(swapReasonLabel(ex.swapReason))+'</small></div>':'';
  const skipped=ex.skipped?'<div class="history-context-line warning"><span>SKIPPED</span><strong>'+esc(ex.skipReason||'Skipped during workout')+'</strong></div>':'';
  const sets=(ex.sets||[]).map((set,setIndex)=>{
    if(set.skipped)return '<div class="history-set-row skipped"><span>S'+(setIndex+1)+'</span><strong>Skipped</strong><small>'+esc(set.skipReason||'')+'</small></div>';
    if(!set.completed)return '<div class="history-set-row incomplete"><span>S'+(setIndex+1)+'</span><strong>Not completed</strong></div>';
    const planned=((set.plannedWeight?exerciseWeightDisplay(ex,set.plannedWeight)+' × ':'')+exerciseRepDisplay(ex,set.plannedReps||set.reps));
    const performed=setPerformanceLabel(ex,set);
    const changed=planned!==performed;
    const sides=set.sides?Object.entries(set.sides).map(([side,data])=>'<div class="history-side-row"><b>'+esc(side.toUpperCase())+'</b><span>'+esc((data.weight?exerciseWeightDisplay(ex,data.weight)+' × ':'')+exerciseRepDisplay(ex,data.reps))+'</span><small>'+esc(formatTimeRange(data.startedAt,data.endedAt))+'</small></div>').join(''):'';
    return '<div class="history-set-row"><span>S'+(setIndex+1)+'</span><div><strong>'+esc(performed)+'</strong><small>'+esc(formatTimeRange(set.startedAt,set.endedAt||set.completedAt)||formatTimeStamp(set.completedAt))+'</small>'+(changed?'<em>Planned '+esc(planned)+'</em>':'')+sides+'</div></div>';
  }).join('');
  const compare=best&&previous?'<div class="history-context-line"><span>VS PREVIOUS BEST</span><strong>'+esc(setPerformanceLabel(ex,best))+' now · '+esc(setPerformanceLabel(ex,previous))+' before</strong><small>'+esc(formatDate(previous.when))+'</small></div>':'';
  const feedbackPattern=exerciseFeedbackPattern(ex,item);
  const feedback=ex.feedback?'<div class="history-context-line feedback"><span>YOUR FEEDBACK</span><strong>'+esc(feedbackLabel(ex.feedback))+'</strong>'+(next?'<small>Next: '+esc(next.label||progressionLabel(ex,next.weight,next.reps))+(next.reason?' · '+esc(next.reason):'')+'</small>':'')+(feedbackPattern?'<small class="history-feedback-pattern">'+esc(feedbackPattern.text)+'</small>':'')+'</div>':'';
  const range=formatTimeRange(ex.startedAt,ex.endedAt);
  return '<details class="history-exercise-card">'+
    '<summary><div><strong>'+esc(ex.name)+'</strong><span>'+completed.length+'/'+(ex.sets?.length||0)+' sets'+(ex.feedback?' · '+esc(feedbackLabel(ex.feedback)):'')+'</span><small>'+esc(range)+(best?' · Best '+esc(setPerformanceLabel(ex,best)):'')+'</small></div><em>+</em></summary>'+
    '<div class="history-exercise-body">'+substitution+skipped+compare+feedback+
      '<div class="history-set-list">'+sets+'</div>'+
      '<div class="history-exercise-actions"><button class="text-button" data-action="progress-exercise" data-progress-exercise="'+esc(ex.id)+'">VIEW EXERCISE HISTORY</button></div>'+
      '<label class="history-note-field"><span>EXERCISE NOTE</span><textarea data-history-exercise-note="'+index+'" placeholder="Machine, form, setup, how it felt...">'+esc(ex.note||'')+'</textarea></label>'+
      '<button class="button secondary compact-button" data-action="save-history-exercise-note" data-history-id="'+esc(item.id)+'" data-exercise-index="'+index+'">SAVE NOTE</button>'+
    '</div>'+
  '</details>';
}
function renderHistoryMenuSheet(){
  const item=store.history.find(entry=>entry.id===historyMenuId);if(!item)return '';
  const timing=historyTimingInfo(item),motivation=workoutMotivationSummary(item),records=workoutRecordClassification(item);
  const sessionDate=item.manualWorkoutCompletion&&item.scheduledDate?formatDate(item.scheduledDate):formatDate(item.completedAt);
  const stats=item.manualWorkoutCompletion
    ?'<div class="history-detail-summary manual"><div><span>STATUS</span><strong>Manual completion</strong></div><div><span>EXERCISE DATA</span><strong>Not recorded</strong></div></div>'
    :'<div class="history-detail-summary"><div><span>ACTIVE</span><strong>'+(timing.activeMinutes===null?'N/A':timing.activeMinutes+' min')+'</strong></div><div><span>CLOCK</span><strong>'+(timing.elapsedMinutes===null?'N/A':timing.elapsedMinutes+' min')+'</strong></div><div><span>SETS</span><strong>'+num(item.completedSets)+'</strong></div><div><span>VOLUME</span><strong>'+formatVolume(item.totalVolume||0)+'</strong></div></div>';
  const prs=(records.prs||[]).map(pr=>{
    const before=exerciseBestBeforeHistory({id:pr.exerciseId,name:pr.name},item);
    return '<div class="history-improvement-row"><div><strong>'+esc(pr.name)+'</strong><span>'+esc(pr.weight?pr.weight+' lb × '+pr.reps:pr.reps+' reps')+'</span></div><small>'+(before?'Previous '+esc(before.weight?before.weight+' lb × '+before.reps:before.reps+' reps')+' · '+esc(formatDate(before.when)):'First recorded best')+'</small></div>';
  }).join('');
  const tags=historyTags(item);
  const exercises=(item.exercises||[]).map((ex,index)=>renderHistoryExerciseCard(item,ex,index)).join('');
  return '<div class="history-detail-overlay" data-history-menu-panel>'+
    '<header class="history-detail-header"><button class="history-detail-back" data-action="close-history-menu">‹</button><div><span>WORKOUT DETAILS</span><strong>'+esc(item.routineName)+'</strong></div><details class="history-detail-options"><summary>•••</summary><button class="danger-text" data-action="remove-history" data-history-id="'+esc(item.id)+'">Remove from history</button></details></header>'+
    '<main class="history-detail-page">'+
      '<section class="history-detail-hero"><p>'+esc(sessionDate)+(timing.sessionRange?' · '+esc(timing.sessionRange):'')+'</p><div class="history-badge-row">'+historyStatusBadges(item).map(b=>'<span>'+esc(b)+'</span>').join('')+'</div><small>'+esc(timing.label)+'</small></section>'+
      '<section class="runner-motivation-card post"><span>SESSION READOUT</span><strong>'+esc(motivation.title)+'</strong><p>'+esc(motivation.copy)+'</p></section>'+
      stats+
      (tags.length?'<div class="history-tag-row detail">'+tags.map(tag=>'<span>'+esc(tag)+'</span>').join('')+'</div>':'')+
      (prs?'<section class="history-improvements"><div class="history-section-head"><span>IMPROVEMENTS</span><strong>'+records.prs.length+' personal record'+(records.prs.length===1?'':'s')+'</strong></div>'+prs+'</section>':'')+
      renderHistoryComparison(item)+
      (!item.manualWorkoutCompletion?renderHistoryTimeline(item):'')+
      renderHistoryGuidedPhase('Warm-up',item.warmup||[])+
      '<section class="history-exercise-section"><div class="history-section-head"><span>EXERCISE LOG</span><strong>'+((item.exercises||[]).length)+' movements</strong></div>'+exercises+'</section>'+
      renderHistoryGuidedPhase('Cooldown',item.cooldown||[])+
      ((item.trainingContext?.temporary||item.trainingContext?.adapted)?'<section class="history-training-context">'+renderTrainingContextSummary(item.trainingContext,false)+'</section>':'')+
      (item.sharedSession?'<section class="history-context-line"><span>PARTNER WORKOUT</span><strong>With '+esc(item.sharedSession.partnerName||'Partner')+'</strong></section>':'')+
      '<section class="history-notes-section"><div class="history-section-head"><span>WORKOUT NOTE</span><strong>Searchable later</strong></div><textarea id="history-workout-note" placeholder="What should you remember about this session?">'+esc(item.note||'')+'</textarea><button class="button secondary compact-button" data-action="save-history-note" data-history-id="'+esc(item.id)+'">SAVE NOTE</button></section>'+
    '</main>'+
  '</div>';
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
function renderExerciseLearningDetail(exerciseId){
  const model=trainingLearnerModel(exerciseId);
  if(!model)return '';
  const confidence=model.confidence||{level:'low',score:0,evidence:''};
  const hit=model.metrics?.targetHitRate;
  const next=learnerNextTarget(exerciseId);
  return '<section class="exercise-learning-panel confidence-'+esc(confidence.level||'low')+'">'+
    '<div class="exercise-learning-head"><div><span>LEARNING PROFILE</span><strong>'+esc(learnerConfidenceLabel(model))+' CONFIDENCE</strong></div><em>'+Math.round(num(confidence.score))+'%</em></div>'+
    '<div class="exercise-learning-grid">'+
      '<div><span>EXPOSURES</span><strong>'+num(model.exposures)+'</strong><small>completed sessions</small></div>'+
      '<div><span>TARGET HIT RATE</span><strong>'+(hit===null||hit===undefined?'LEARNING':Math.round(hit*100)+'%')+'</strong><small>'+(model.predictionCount?model.predictionCount+' predictions checked':'future sessions will test predictions')+'</small></div>'+
      '<div><span>AVG REP DROP</span><strong>'+Math.round(num(model.metrics?.averageRepDrop)*10)/10+'</strong><small>first set to final set</small></div>'+
      '<div><span>NEXT TARGET</span><strong>'+esc(next||'Gathering evidence')+'</strong><small>'+esc(store.progression?.[exerciseId]?.reason||confidence.evidence||'More sessions improve confidence')+'</small></div>'+
    '</div>'+
  '</section>';
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
    renderExerciseLearningDetail(summary.exerciseId)+
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
function renderAdaptiveLearningOverview(){
  const overview=trainingLearnerOverview();
  if(!overview.modeledExercises)return '';
  const hit=overview.predictionHitRate===null?'LEARNING':Math.round(overview.predictionHitRate*100)+'%';
  const strongest=Object.values(ensureTrainingLearner()?.models||{}).sort((a,b)=>(b.confidence?.score||0)-(a.confidence?.score||0))[0]||null;
  return '<section class="adaptive-learning-overview">'+
    '<div class="adaptive-learning-copy"><p class="eyebrow">ADAPTIVE LEARNING · V'+esc(overview.version)+'</p><h3>GoWorkout is building your training model.</h3><p>'+overview.modeledExercises+' movement'+(overview.modeledExercises===1?'':'s')+' modeled from '+overview.events+' completed exercise exposures. Predictions are stored before a workout and checked against what you actually complete.</p></div>'+
    '<div class="adaptive-learning-stats">'+
      '<div><span>MODELED</span><strong>'+overview.modeledExercises+'</strong><small>movements</small></div>'+
      '<div><span>PREDICTIONS</span><strong>'+overview.predictionsEvaluated+'</strong><small>evaluated</small></div>'+
      '<div><span>TARGET HIT</span><strong>'+hit+'</strong><small>prediction accuracy signal</small></div>'+
      '<div><span>BEST CONFIDENCE</span><strong>'+esc(strongest?learnerConfidenceLabel(strongest):'LOW')+'</strong><small>'+esc(strongest?.exerciseName||'More evidence needed')+'</small></div>'+
    '</div>'+
  '</section>';
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
    renderAdaptiveLearningOverview()+
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
  const motivation=workoutMotivationSummary(x);
  return '<div class="summary-hero clean-summary"><div class="summary-check">'+(partial?'◐':'✓')+'</div><p class="eyebrow">'+(partial?'PARTIAL WORKOUT SAVED':'WORKOUT COMPLETE')+'</p><h2>'+esc(x.routineName)+'</h2>'+
    '<section class="runner-motivation-card post"><span>SESSION COMPLETE</span><strong>'+esc(motivation.title)+'</strong><p>'+esc(motivation.copy)+'</p></section>'+
    '<div class="summary-grid"><div class="summary-card"><strong>'+x.durationMinutes+'</strong><span>Minutes</span></div><div class="summary-card"><strong>'+x.completedSets+'</strong><span>Sets</span></div><div class="summary-card"><strong>'+formatVolume(x.totalVolume||0)+'</strong><span>Volume</span></div></div>'+
    (records.baselines.length?'<section class="clean-panel summary-prs baseline-summary"><p class="eyebrow">BASELINES ESTABLISHED</p><div class="pr-list">'+records.baselines.map(pr=>'<div class="pr-row"><span>'+esc(pr.name)+'</span><strong>'+(pr.weight?pr.weight+' lb × '+pr.reps:pr.reps+' reps')+'</strong></div>').join('')+'</div></section>':'')+
    (records.prs.length?'<section class="clean-panel summary-prs"><p class="eyebrow">NEW PERSONAL RECORDS</p><div class="pr-list">'+records.prs.map(pr=>'<div class="pr-row"><span>'+esc(pr.name)+'</span><strong>'+(pr.weight?pr.weight+' lb × '+pr.reps:pr.reps+' reps')+'</strong></div>').join('')+'</div></section>':'')+
    (x.learnerLearning?'<section class="clean-panel workout-learning-card learner-session-card"><p class="eyebrow">ADAPTIVE LEARNER</p><h3>'+x.learnerLearning.exercisesObserved+' movement'+(x.learnerLearning.exercisesObserved===1?'':'s')+' added to your model</h3><p>'+(x.learnerLearning.predictionsEvaluated?x.learnerLearning.predictionHits+' of '+x.learnerLearning.predictionsEvaluated+' pre-workout predictions matched the completed target.':'This workout established evidence. Future appearances of these movements will create prediction checks.')+'</p>'+(x.learnerLearning.strongestExercise?'<small>Strongest current evidence: '+esc(x.learnerLearning.strongestExercise.name)+' · '+esc(String(x.learnerLearning.strongestExercise.confidence?.level||'low').toUpperCase())+' confidence</small>':'')+'</section>':'')+
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
  if(store.account?.status!=='connected'){app.innerHTML=renderAccountEntry();document.body.classList.remove('modal-open','workout-mode','home-mode','train-mode','progress-mode');return;}
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
  if(trainPreviewContext) app.insertAdjacentHTML('beforeend',renderTrainPreviewModal());
  if(workoutMapOpen) app.insertAdjacentHTML('beforeend',renderWorkoutMap());
  if(setEditContext) app.insertAdjacentHTML('beforeend',renderSetEditor());
  if(cueSettingsOpen) app.insertAdjacentHTML('beforeend',renderCueSettingsSheet());
  if(exerciseActionsIndex!==null) app.insertAdjacentHTML('beforeend',renderExerciseActionsSheet());
  if(sessionSetupOpen) app.insertAdjacentHTML('beforeend',renderSessionSetupSheet());
  if(historyMenuId) app.insertAdjacentHTML('beforeend',renderHistoryMenuSheet());
  if(accountSheetOpen) app.insertAdjacentHTML('beforeend',renderAccountSheet());
  if(avatarPickerOpen) app.insertAdjacentHTML('beforeend',renderAvatarPickerSheet());
  document.body.classList.toggle('modal-open',Boolean(exerciseDetailId||swapContext||readinessContext||trainPreviewContext||workoutMapOpen||setEditContext||cueSettingsOpen||exerciseActionsIndex!==null||sessionSetupOpen||historyMenuId||accountSheetOpen||avatarPickerOpen));
  document.body.classList.toggle('workout-mode',currentTab==='workout'&&Boolean(store.activeWorkout));
  document.body.classList.toggle('home-mode',currentTab==='home');
  document.body.classList.toggle('train-mode',currentTab==='train');
  document.body.classList.toggle('progress-mode',currentTab==='progress');
  syncNav();syncLiveBadge();syncShellIdentity();persistUiState();
  prefetchUpcomingWorkoutMedia();
  prefetchCoachTimeline();
}

function updateTimers(){
  const w=store.activeWorkout;
  if(!w)return;
  const nowMs=Date.now();

  const elapsed=document.querySelector('#elapsed-clock');
  const exerciseClock=document.querySelector('#exercise-clock');
  if(elapsed)elapsed.textContent=formatClock(workoutElapsedSeconds(w));
  const homeElapsed=document.querySelector('#home-elapsed-clock');
  if(homeElapsed)homeElapsed.textContent=formatClock(workoutElapsedSeconds(w));
  const warmupElapsed=document.querySelector('#warmup-elapsed-clock');
  if(warmupElapsed&&w.phase==='warmup')warmupElapsed.textContent=formatClock(warmupElapsedSeconds(w));
  if(exerciseClock&&['work','rest','calibrate','feedback','pre-set','timed-set'].includes(w.phase))exerciseClock.textContent=formatClock(exerciseElapsedSeconds(w));
  if(w.isPaused)return;

  if(['warmup','cooldown'].includes(w.phase)){
    const snap=timedStageSnapshot(w);
    if(!snap)return;
    if(snap.mode==='ready')return;
    if(snap.mode==='reps')return;
    if(snap.mode==='switch'&&snap.remaining<=0){finishTimedStageSideSwitch();return;}
    if(snap.itemComplete){reconcileTimedStage();return;}
    const preview=guidedUpcomingPreview(w,snap);
    if(preview&&snap.remaining>3&&!timelineWasPlayed(preview.key)){
      const lead=coachSpeechLeadSeconds(preview.line);
      if(snap.remaining<=lead)playTimelineCue(preview.line,preview.key,{preview:{type:w.phase,index:preview.nextIndex}});
    }
    if(snap.remaining>0&&snap.remaining<=3)fireWorkoutSignal('warning','stage-warning-'+w.id+'-'+w.phase+'-'+snap.index+'-'+snap.mode+'-'+snap.remaining,{voice:String(snap.remaining),label:String(snap.remaining)});
    const stageClock=document.querySelector('#stage-clock');
    const fill=document.querySelector('#stage-progress-fill');
    if(stageClock)stageClock.textContent=formatClock(snap.remaining);
    if(fill)fill.style.width=`${Math.max(0,Math.min(100,((snap.total-snap.remaining)/Math.max(1,snap.total))*100))}%`;
    return;
  }

  if(w.phase==='pre-set'){
    const snap=preSetSnapshot(w);
    if(!snap)return;
    const countdown=document.querySelector('#preset-countdown');
    const label=document.querySelector('#preset-phase-label');
    if(snap.mode==='coach'){
      if(countdown)countdown.textContent='…';
      if(label)label.textContent='COACHING';
      return;
    }
    if(snap.mode==='ready')return;
    if(w.preSetFinishing)return;
    if(snap.complete){finishPreSet();return;}
    if(snap.mode==='countdown'&&snap.remaining>0&&snap.remaining<=3){
      fireWorkoutSignal('warning','preset-warning-'+w.id+'-'+w.currentExerciseIndex+'-'+w.currentSetIndex+'-'+snap.remaining,{voice:String(snap.remaining),label:String(snap.remaining)});
    }
    if(countdown)countdown.textContent=String(snap.remaining);
    if(label)label.textContent=snap.mode==='setup'?'GET READY':'AUTO START';
    return;
  }

  if(w.phase==='work'){
    const setClock=document.querySelector('#set-clock');
    if(setClock)setClock.textContent=formatClock(setElapsedSeconds(w));
    return;
  }

  if(w.phase==='side-switch'){
    const remaining=sideSwitchRemaining(w);
    const clock=document.querySelector('#side-switch-clock');
    const ring=document.querySelector('#timer-ring');
    if(clock)clock.textContent=formatClock(remaining);
    if(ring)ring.style.setProperty('--timer-progress',`${Math.max(0,Math.min(100,(remaining/Math.max(1,num(w.sideSwitchDuration)||5))*100))}%`);
    if(remaining>0&&remaining<=3)fireWorkoutSignal('warning','exercise-side-warning-'+w.id+'-'+w.currentExerciseIndex+'-'+w.currentSetIndex+'-'+remaining,{voice:String(remaining),label:String(remaining)});
    if(remaining<=0)finishExerciseSideSwitch();
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
  const next=w.pendingPosition;
  if(next){
    const line=strengthPreviewLine(w,next),key=strengthPreviewKey(w,next);
    if(line&&remaining>3&&!timelineWasPlayed(key)){
      const lead=Math.max(8,coachSpeechLeadSeconds(line)+2);
      if(remaining<=lead)playTimelineCue(line,key,{preview:{type:'strength',ei:next.ei,si:next.si}});
    }
  }
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
  if(historyClose){historyMenuId=null;render();return;}
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
  const allowedWhilePaused=['toggle-workout-pause','home','go-home','finish','discard','toggle-sound','toggle-voice','toggle-ai-coach','apply-coach-preset','cycle-coach-style','cycle-coach-vibe','cycle-coach-frequency','cycle-coach-detail','cycle-talk-speed','cycle-name-usage','cycle-form-cues','cycle-performance-feedback','cycle-motivation','cycle-countdown-mode','cycle-warmup-guidance','cycle-cooldown-guidance','cycle-next-set-preview','cycle-exercise-instruction','toggle-adaptive-coach','toggle-auto-start-warmup','toggle-auto-start-cooldown','toggle-auto-start-timed','replay-coach','select-coach-voice','preview-coach-voice','toggle-flash','toggle-haptics','test-cues','open-workout-map','close-workout-map','set-workout-map-view','edit-set','close-set-editor','open-cue-settings','close-cue-settings','open-exercise-actions','close-exercise-actions','open-session-setup','close-session-setup','apply-session-setup'];
  if(store.activeWorkout?.isPaused&&!allowedWhilePaused.includes(a)){
    toast('Resume the workout before changing the active set or timer.');
    return;
  }
  if(a==='go-home'||a==='home'){
    if('speechSynthesis' in window){try{window.speechSynthesis.cancel?.();}catch{}}
    cancelCoachTimeline(true);
    setTab('home');
  }
  else if(a==='preview-train-day')openTrainPreview(node.dataset.dayId,node.dataset.scheduledDate||'');
  else if(a==='close-train-preview'){
    const inside=event.target.closest('[data-train-preview-panel]');
    const explicit=event.target.closest('.modal-close');
    if(!inside||explicit)closeTrainPreview();
  }
  else if(a==='prepare-previewed-workout'){
    const preview=trainPreviewContext;
    if(preview){trainPreviewContext=null;openReadiness(preview.dayId,preview.scheduledDate||'');}
  }
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
    historyMenuId=null;
    persistUiState();setTab('progress');
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
  else if(a==='set-history-status'){historyStatusFilter=node.dataset.historyStatus||'all';render();}
  else if(a==='set-history-view'){historyView=node.dataset.historyView==='calendar'?'calendar':'list';render();}
  else if(a==='history-calendar-prev'){historyCalendarOffset-=1;render();}
  else if(a==='history-calendar-next'){historyCalendarOffset+=1;render();}
  else if(a==='undo-history-remove')undoHistoryRemove();
  else if(a==='save-history-note')saveHistoryNote(node.dataset.historyId);
  else if(a==='save-history-exercise-note')saveHistoryExerciseNote(node.dataset.historyId,Number(node.dataset.exerciseIndex));
  else if(a==='resume'){unlockWorkoutCues();setTab('workout');}
  else if(a==='edit-profile')editProfile();
  else if(a==='build-plan')saveProfileFromForm(document.querySelector('#profile-form'));
  else if(a==='skip-scheduled')skipScheduledSession(node.dataset.scheduledDate);
  else if(a==='undo-skip-scheduled')undoSkipScheduledSession(node.dataset.scheduledDate);
  else if(a==='mark-scheduled-complete')markScheduledWorkoutComplete(node.dataset.dayId,node.dataset.scheduledDate);
  else if(a==='remove-history'){historyMenuId=null;removeHistoryWorkout(node.dataset.historyId);}
  else if(a==='begin-workout')startPreparedWorkout();
  else if(a==='begin-session')beginWorkoutSession();
  else if(a==='skip-warmup')skipWorkoutWarmup(node.dataset.skipSource||'intro');
  else if(a==='start-warmup')startWarmupRoutine();
  else if(a==='start-strength')startStrengthWork();
  else if(a==='warmup-rep')addWarmupRep();
  else if(a==='warmup-rep-minus')removeWarmupRep();
  else if(a==='complete-stage-reps')completeRepStage();
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
  else if(a==='start-set-now')finishPreSet(true);
  else if(a==='start-guided-stage')startGuidedStageNow();
  else if(a==='end-timed-set')completeTimedSet(true);
  else if(a==='toggle-sound')toggleCueSetting('sound');
  else if(a==='toggle-voice')toggleCueSetting('voice');
  else if(a==='toggle-ai-coach')toggleCueSetting('aiCoach');
  else if(a==='apply-coach-preset')applyCoachPreset(String(node.dataset.coachPreset||''));
  else if(a==='cycle-coach-style')cycleCoachSetting('coachStyle');
  else if(a==='cycle-coach-vibe')cycleCoachSetting('coachVibe');
  else if(a==='cycle-coach-frequency')cycleCoachSetting('coachFrequency');
  else if(a==='cycle-coach-detail')cycleCoachSetting('coachDetail');
  else if(a==='cycle-talk-speed')cycleCoachSetting('talkSpeed');
  else if(a==='cycle-name-usage')cycleCoachSetting('nameUsage');
  else if(a==='cycle-form-cues')cycleCoachSetting('formCues');
  else if(a==='cycle-performance-feedback')cycleCoachSetting('performanceFeedback');
  else if(a==='cycle-motivation')cycleCoachSetting('motivation');
  else if(a==='cycle-countdown-mode')cycleCoachSetting('countdownMode');
  else if(a==='cycle-warmup-guidance')cycleCoachSetting('warmupGuidance');
  else if(a==='cycle-cooldown-guidance')cycleCoachSetting('cooldownGuidance');
  else if(a==='cycle-next-set-preview')cycleCoachSetting('nextSetPreview');
  else if(a==='cycle-exercise-instruction')cycleCoachSetting('exerciseInstruction');
  else if(a==='toggle-adaptive-coach')toggleAdaptiveCoach();
  else if(a==='toggle-auto-start-warmup')toggleCoachBooleanPreference('autoStartWarmup');
  else if(a==='toggle-auto-start-cooldown')toggleCoachBooleanPreference('autoStartCooldown');
  else if(a==='toggle-auto-start-timed')toggleCoachBooleanPreference('autoStartTimedExercise');
  else if(a==='replay-coach')replayLastCoachCue();
  else if(a==='select-coach-voice')selectCoachVoice(String(node.dataset.coachVoice||''));
  else if(a==='preview-coach-voice')previewCoachVoice(String(node.dataset.coachVoice||''));
  else if(a==='toggle-flash')toggleCueSetting('flash');
  else if(a==='toggle-haptics')toggleCueSetting('haptics');
  else if(a==='test-cues'){
    unlockWorkoutCues();
    primeCoachCuePack();
    const token='cue-test-'+Date.now();
    fireWorkoutSignal('go',token,{voice:'',label:'READY'});
    const name=displayName()==='there'?'':displayName();
    emitWorkoutCoach('test',{},'Alright'+(name?' '+name:'')+'. Your coach setup is ready. Three, two, one, go.','coach-'+token);
  }
  else if(a==='add-rest')adjustRest(15);
  else if(a==='pause-rest')toggleRestPause();
  else if(a==='skip-rest')skipRest();
  else if(a==='reset-timer')resetActiveTimer();
  else if(a==='skip-stage')skipTimedStage();
  else if(a==='skip-side-stage-switch')finishTimedStageSideSwitch();
  else if(a==='skip-side-switch')skipExerciseSideSwitch();
  else if(a==='finish')finishWorkout(false);
  else if(a==='discard')discardWorkout();
}
document.addEventListener('click',handleClick);
document.addEventListener('load',event=>{
  const img=event.target?.closest?.('img');
  if(!img)return;
  const shell=img.closest('.runner-set-ready-media,.runner-transition-media,.runner-first-strength,.runner-rest-next .exercise-media,.runner-stage-media');
  if(shell)shell.classList.add('media-loaded');
},true);
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
document.addEventListener('input',event=>{
  if(event.target.id==='catalog-search'){
    catalogQuery=event.target.value;const caret=event.target.selectionStart;render();const input=document.querySelector('#catalog-search');if(input){input.focus();input.setSelectionRange(caret,caret);}
    return;
  }
  if(event.target.id==='history-search'){
    historySearch=event.target.value;const caret=event.target.selectionStart;render();const input=document.querySelector('#history-search');if(input){input.focus();input.setSelectionRange(caret,caret);}
  }
});
document.addEventListener('change',event=>{
  if(event.target.id==='training-days-count'){
    const desired=num(event.target.value)||4;
    const defaults=defaultWorkoutDays(desired);
    document.querySelectorAll('input[name="workoutDays"]').forEach(input=>{input.checked=defaults.includes(input.value);});
    const note=document.querySelector('.schedule-day-head small');
    if(note)note.textContent='Select exactly '+desired+' days. Default days were updated for this schedule.';
  }else if(event.target.id==='history-routine-filter'){
    historyRoutineFilter=event.target.value||'all';render();
  }else if(event.target.id==='history-muscle-filter'){
    historyMuscleFilter=event.target.value||'all';render();
  }else if(event.target.id==='history-setup-filter'){
    historySetupFilter=event.target.value||'all';render();
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
