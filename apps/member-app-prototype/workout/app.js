const STORAGE_KEY = 'workout-web-store-v3';
const LEGACY_KEYS = ['workout-web-store-v2','workout-web-store-v1'];
const ACTIVE_WORKOUT_SCHEMA = 3;
const catalog = window.EXERCISE_CATALOG || [];
const movements = window.EXERCISE_MOVEMENTS || {};
const exerciseMedia = window.EXERCISE_MEDIA || {};
const exerciseMediaFallbacks = window.EXERCISE_MEDIA_FALLBACKS || {};
const EXERCISE_IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
let exerciseDetailId = null;

const defaultStore = {
  profile: null,
  plan: null,
  history: [],
  activeWorkout: null,
  calibration: {},
  progression: {},
  progressionLog: [],
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
function formatDate(iso){ return new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric'}).format(new Date(iso)); }
function formatVolume(v){ return v>=1000?`${(v/1000).toFixed(v>=10000?0:1)}k lb`:`${Math.round(v)} lb`; }
function startOfWeek(){ const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-d.getDay()); return d; }
function weeklyHistory(){ const start=startOfWeek(); return store.history.filter(x=>new Date(x.completedAt)>=start); }
function totalSets(exercises){ return exercises.reduce((n,e)=>n+e.sets.length,0); }
function completedSets(exercises){ return exercises.reduce((n,e)=>n+e.sets.filter(s=>s.completed).length,0); }
function volume(exercises){ return exercises.reduce((t,e)=>t+e.sets.reduce((s,x)=>s+(x.completed?num(x.weight)*num(x.reps):0),0),0); }
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
        '<div class="coach-cue"><span>COACHING CUE</span><strong>'+esc(guide.cue)+'</strong></div>'+
        '<div class="instruction-block"><h3>Set up</h3><p>'+esc(guide.setup)+'</p></div>'+
        '<div class="instruction-block"><h3>How to move</h3><ol>'+guide.steps.map(step=>'<li>'+esc(step)+'</li>').join('')+'</ol></div>'+
        '<div class="instruction-block caution"><h3>Watch for</h3><p>'+esc(guide.mistake)+'</p></div>'+
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
  let candidates=catalog.filter(e=>e.movement===pattern && equipmentAllows(e,profile.equipment) && !avoided(e,profile));
  if (!candidates.length && pattern === 'quad-accessory') candidates=catalog.filter(e=>e.movement==='squat' && equipmentAllows(e,profile.equipment) && !avoided(e,profile));
  if (!candidates.length && pattern === 'hamstring-accessory') candidates=catalog.filter(e=>e.movement==='hinge' && equipmentAllows(e,profile.equipment) && !avoided(e,profile));
  if (!candidates.length && pattern === 'shoulder-accessory') candidates=catalog.filter(e=>e.movement==='vertical-push' && equipmentAllows(e,profile.equipment) && !avoided(e,profile));
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
  const maxByTime=profile.minutes<=20?3:profile.minutes<=30?4:profile.minutes<=45?5:profile.minutes<=60?6:7;
  const selected=[];
  for (const pattern of blueprint.patterns) {
    if (selected.length>=maxByTime) break;
    const exercise=pickExercise(pattern,profile,used);
    if (!exercise) continue;
    used.add(exercise.id);
    const settings=goalSettings(profile.goal,exercise.movement,profile.experience);
    selected.push({...exercise,settings,start:estimateStartingLoad(exercise,profile)});
  }

  const prepForSelected=()=>{
    const warmup=buildWarmup(selected);
    const cooldown=buildCooldown(selected);
    return {warmup,cooldown,seconds:[...warmup,...cooldown].reduce((sum,item)=>sum+item.seconds,0)};
  };
  const budget=profile.minutes*60;
  const total=()=>prepForSelected().seconds+selected.reduce((sum,e)=>sum+estimateExerciseSeconds(e),0);

  for (let i=selected.length-1;i>=0 && total()>budget;i--) {
    if (selected[i].settings.sets>2) selected[i].settings.sets=2;
  }
  while (selected.length>2 && total()>budget) selected.pop();

  const prep=prepForSelected();
  return {
    id:`day-${index+1}`,
    name:blueprint.name,
    focus:blueprint.focus,
    warmup:prep.warmup,
    cooldown:prep.cooldown,
    warmupMinutes:Math.ceil(prep.warmup.reduce((sum,item)=>sum+item.seconds,0)/60),
    cooldownMinutes:Math.ceil(prep.cooldown.reduce((sum,item)=>sum+item.seconds,0)/60),
    estimatedMinutes:Math.max(10,Math.ceil((prep.seconds+selected.reduce((sum,e)=>sum+estimateExerciseSeconds(e),0))/60)),
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
  if (!store.plan?.days?.length) return null;
  const completed=store.history.filter(h=>h.planId===store.plan.id).length;
  return store.plan.days[completed % store.plan.days.length];
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
  saveStore();
  toast('Plan rebuilt from your profile.');
  render();
}

function createWorkout(day){
  const now=new Date().toISOString();
  const workout={
    schemaVersion:ACTIVE_WORKOUT_SCHEMA,
    id:uid('workout'),planId:store.plan.id,planDayId:day.id,routineName:day.name,focus:day.focus,
    startedAt:now,currentExerciseIndex:0,currentSetIndex:0,
    phase:'warmup',timedPhaseStartedAt:now,timedPhaseSkippedSeconds:0,
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
        sets:Array.from({length:ex.sets},()=>({id:uid('set'),weight:weightValue,reps:String(suggestedReps||''),completed:false,completedAt:null}))
      };
    })
  };
  if(!workout.warmup.length){
    workout.phase='pre-set';
    workout.timedPhaseStartedAt=null;
    workout.preSetStartedAt=now;
    workout.preSetSetupSeconds=5;
    workout.preSetCountdownSeconds=3;
    workout.preSetIsNewExercise=true;
    workout.exerciseStartedAt=null;
  }
  return workout;
}

function startWorkout(dayId){
  unlockWorkoutCues();
  if (store.activeWorkout) { currentTab='workout'; render(); toast('Resume or finish your current workout first.'); return; }
  const day=store.plan?.days?.find(d=>d.id===dayId);
  if(!day) return;
  store.activeWorkout=createWorkout(day);
  saveStore(); currentTab='workout'; render();
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
function workoutElapsedSeconds(w){ return Math.max(0,Math.floor((Date.now()-new Date(w.startedAt).getTime())/1000)); }
function exerciseElapsedSeconds(w){
  if(!w?.exerciseStartedAt) return 0;
  return Math.max(0,Math.floor((Date.now()-new Date(w.exerciseStartedAt).getTime())/1000));
}
function timedStageItems(w){
  if(!w) return [];
  return w.phase==='warmup'?(w.warmup||[]):w.phase==='cooldown'?(w.cooldown||[]):[];
}
function timedStageSnapshot(w,nowMs=Date.now()){
  if(!w||!['warmup','cooldown'].includes(w.phase)) return null;
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
  const elapsed=Math.max(0,Math.floor((Date.now()-new Date(w.exerciseStartedAt).getTime())/1000));
  w.exerciseDurations=w.exerciseDurations||{};
  w.exerciseDurations[w.exercises[index]?.id||String(index)]=elapsed;
}

function restRemaining(w){
  if(!w||w.phase!=='rest')return 0;
  if(Number.isFinite(w.restPausedRemaining))return Math.max(0,Math.ceil(w.restPausedRemaining));
  if(!w.restEndsAt)return 0;
  return Math.max(0,Math.ceil((new Date(w.restEndsAt).getTime()-Date.now())/1000));
}
function restProgress(w){ const d=Math.max(1,w.restDuration||1);return Math.max(0,Math.min(100,(restRemaining(w)/d)*100)); }

function beginPreSetPosition(ei,si,isNewExercise=true){
  const w=store.activeWorkout;if(!w)return;
  const previousIndex=w.currentExerciseIndex||0;
  if(isNewExercise&&w.exerciseStartedAt&&previousIndex!==ei)recordExerciseDuration(w,previousIndex);
  w.currentExerciseIndex=ei;
  w.currentSetIndex=si;
  w.phase='pre-set';
  w.preSetStartedAt=new Date().toISOString();
  w.preSetSetupSeconds=isNewExercise?5:0;
  w.preSetCountdownSeconds=3;
  w.preSetIsNewExercise=Boolean(isNewExercise);
  w.restEndsAt=null;w.restDuration=0;w.restPausedRemaining=null;w.pendingPosition=null;
  if(isNewExercise)w.exerciseStartedAt=null;
  w.lastProgressionResult=null;
  fireWorkoutSignal(isNewExercise?'transition':'tick','preset-start-'+w.id+'-'+ei+'-'+si,{
    voice:isNewExercise?'Next exercise':'',
    label:isNewExercise?'NEXT':''
  });
  saveStore();render();
}
function preSetSnapshot(w,nowMs=Date.now()){
  if(!w||w.phase!=='pre-set')return null;
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
  if(!w.cooldown?.length){ finishWorkout(true); return; }
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
  fireWorkoutSignal('complete','cooldown-complete-'+w.id,{voice:'Workout complete',label:'DONE'});
  finishWorkout(true);
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
  beginPreSetPosition(next.ei,next.si,isNewExercise);
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

function finishWorkout(auto=false){
  const w=store.activeWorkout;if(!w)return;
  const count=completedSets(w.exercises);
  if(!count){
    if(auto) return;
    if(!confirm('End this workout? No completed sets will be saved.'))return;
    store.activeWorkout=null;saveStore();currentTab='home';render();return;
  }
  if(!auto&&!confirm('Finish this workout now? Completed sets will be saved.'))return;
  const old=new Map(w.exercises.map(e=>[e.id,previousBest(e.id)]));
  const completedAt=new Date().toISOString();
  const entry={...w,phase:'complete',completedAt,durationMinutes:Math.max(1,Math.round((new Date(completedAt)-new Date(w.startedAt))/60000)),completedSets:count,totalVolume:volume(w.exercises),newPRs:[]};
  for(const ex of entry.exercises){
    let session=null;
    for(const set of ex.sets){if(!set.completed)continue;const c={weight:num(set.weight),reps:num(set.reps)};
      if(!session||c.weight>session.weight||(c.weight===session.weight&&c.reps>session.reps))session=c;
    }
    const before=old.get(ex.id);
    if(session&&(!before||session.weight>before.weight||(session.weight===before.weight&&session.reps>before.reps)))entry.newPRs.push({exerciseId:ex.id,name:ex.name,...session});
  }
  delete entry.pendingPosition;delete entry.restEndsAt;delete entry.restPausedRemaining;delete entry.lastProgressionResult;
  delete entry.preSetStartedAt;delete entry.preSetSetupSeconds;delete entry.preSetCountdownSeconds;delete entry.preSetIsNewExercise;
  delete entry.timedSetStartedAt;delete entry.timedSetDuration;delete entry.timedSetEndsAt;
  store.history.unshift(entry);store.history=store.history.slice(0,100);store.lastSummaryId=entry.id;store.activeWorkout=null;saveStore();currentTab='summary';render();
}
function discardWorkout(){if(!store.activeWorkout)return;if(!confirm('Discard this workout?'))return;store.activeWorkout=null;saveStore();currentTab='home';render();}

function renderProfile(){
  const p=store.profile||{};
  const lifts=p.lifts||{};
  const checked=(field,value)=>p[field]===value?'checked':'';
  const av=v=>(p.avoid||[]).includes(v)?'checked':'';
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

      <section class="form-section"><div class="form-section-head"><span>04</span><div><h3>Your real schedule</h3><p>The time you choose is treated as a planning limit.</p></div></div>
        <div class="form-grid two">
          <label class="field"><span>DAYS PER WEEK</span><select name="days">${[2,3,4,5].map(v=>`<option value="${v}" ${num(p.days||4)===v?'selected':''}>${v} days</option>`).join('')}</select></label>
          <label class="field"><span>MINUTES PER WORKOUT</span><select name="minutes">${[20,30,45,60,75].map(v=>`<option value="${v}" ${num(p.minutes||45)===v?'selected':''}>${v} minutes</option>`).join('')}</select></label>
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

function renderHome(){
  const p=store.profile,plan=store.plan;
  if(!p||!plan)return renderProfile();
  const week=weeklyHistory();const weeklyVolume=week.reduce((s,x)=>s+(x.totalVolume||0),0);const next=nextPlanDay();
  return `
    <div class="page-head"><div><p class="eyebrow">YOUR PERSONAL PLAN</p><h2 class="page-title">${esc(planGoalLabel(p.goal))}.</h2><p class="page-copy">${p.days} days/week · ${p.minutes}-minute sessions · ${esc(experienceLabel(p.experience))} · ${esc(equipmentLabel(p.equipment))}. Each workout is calculated from the actual sets, rest and setup time.</p></div><button class="button secondary" data-action="edit-profile">EDIT PROFILE</button></div>
    ${store.activeWorkout?`<button class="resume-card" data-action="resume"><div class="resume-dot"></div><div><span>WORKOUT IN PROGRESS</span><strong>${esc(store.activeWorkout.routineName)} · ${store.activeWorkout.phase==='rest'?'Resting':store.activeWorkout.phase==='calibrate'?'Calibrating':store.activeWorkout.phase==='feedback'?'Exercise feedback':store.activeWorkout.phase==='pre-set'?'Getting ready':store.activeWorkout.phase==='timed-set'?'Timed set':store.activeWorkout.phase==='warmup'?'Warm-up':store.activeWorkout.phase==='cooldown'?'Cooldown':'Set in progress'}</strong></div><div class="resume-arrow">→</div></button>`:''}
    <div class="hero">
      <section class="hero-primary"><p class="eyebrow">THIS WEEK</p><div class="hero-metrics"><div class="hero-metric"><span class="hero-number">${week.length}/${p.days}</span><span class="hero-label">workouts</span></div><div class="hero-divider"></div><div class="hero-metric"><span class="hero-number">${formatVolume(weeklyVolume)}</span><span class="hero-label">volume</span></div></div></section>
      <section class="hero-secondary"><div><p class="eyebrow">NEXT SESSION</p><h3>${esc(next?.name||'Plan ready')}</h3><p>${esc(next?.focus||'')} · estimated ${next?.estimatedMinutes||p.minutes} min</p></div><button class="button" data-start="${next?.id||''}" ${store.activeWorkout?'disabled':''}>START GUIDED WORKOUT</button></section>
    </div>
    <section class="profile-strip"><div><span>GOAL</span><strong>${esc(planGoalLabel(p.goal))}</strong></div><div><span>EXPERIENCE</span><strong>${esc(experienceLabel(p.experience))}</strong></div><div><span>SETUP</span><strong>${esc(equipmentLabel(p.equipment))}</strong></div><div><span>SESSION CAP</span><strong>${p.minutes} min</strong></div></section>
    <section class="section"><div class="section-head"><div><p class="eyebrow">GENERATED PROGRAM</p><h2>${plan.days.length}-day rotation</h2></div><button class="text-button" data-action="regenerate">Regenerate</button></div>
      <div class="routine-grid">${plan.days.map((day,i)=>`
        <article class="routine-card">
          <div class="routine-top"><span class="routine-number">0${i+1}</span><span class="routine-time">~${day.estimatedMinutes} MIN</span></div>
          <h3>${esc(day.name)}</h3><div class="routine-focus">${esc(day.focus)}</div>
          <div class="routine-sequence">
            <div class="routine-phase-head"><span>01</span><strong>WARM-UP</strong><em>${plannedWarmup(day).reduce((sum,item)=>sum+(Number(item.seconds)||0),0)} sec</em></div>
            <div class="plan-prep-list">${plannedWarmup(day).map((item,index)=>renderPlanTimedRow(item,'warmup',index)).join('')}</div>
            <div class="routine-phase-head work"><span>02</span><strong>WORKOUT</strong><em>${day.exercises.length} exercises</em></div>
            <div class="routine-plan">${day.exercises.map(ex=>`<div class="plan-row detailed visual-plan-row">${exerciseImageButton(ex,'plan-exercise-media')}<div class="plan-row-copy"><strong>${esc(ex.name)}</strong>${planPrescriptionHtml(ex)}</div><span>${ex.sets} × ${esc(ex.reps)}<small>${adaptivePrescription(ex)?.rest||ex.rest}s rest</small></span></div>`).join('')}</div>
            <div class="routine-phase-head cooldown"><span>03</span><strong>COOLDOWN</strong><em>${plannedCooldown(day).reduce((sum,item)=>sum+(Number(item.seconds)||0),0)} sec</em></div>
            <div class="plan-prep-list">${plannedCooldown(day).map((item,index)=>renderPlanTimedRow(item,'cooldown',index)).join('')}</div>
          </div>
          <div class="routine-footer"><span class="routine-meta">${plannedWarmup(day).length} warm-up movements · ${day.exercises.length} exercises · ${plannedCooldown(day).length} cooldown stretches</span><button class="button" data-start="${day.id}" ${store.activeWorkout?'disabled':''}>START</button></div>
        </article>`).join('')}</div>
    </section>`;
}

function renderCatalog(){
  const q=catalogQuery.trim().toLowerCase();
  const items=catalog.filter(e=>!q||[e.name,e.movement,...e.muscles,e.style,e.difficulty].join(' ').toLowerCase().includes(q));
  return `
    <div class="page-head"><div><p class="eyebrow">EXERCISE LIBRARY</p><h2 class="page-title">${catalog.length} movements.</h2><p class="page-copy">This catalog powers plan generation, equipment matching, starting-load estimates and progression.</p></div></div>
    <div class="catalog-search"><input id="catalog-search" type="search" placeholder="Search chest, squat, dumbbell..." value="${esc(catalogQuery)}"><span>${items.length} shown</span></div>
    <div class="catalog-grid">${items.map(e=>`<article class="catalog-card visual-catalog-card">${exerciseImageButton(e,'catalog-exercise-media')}<div class="catalog-card-copy"><div class="catalog-top"><span>${esc(movements[e.movement]||e.movement)}</span><span>${esc(e.difficulty)}</span></div><h3>${esc(e.name)}</h3><p>${e.muscles.map(esc).join(' · ')}</p><div class="catalog-tags"><span>${esc(e.style)}</span><span>${esc(e.equipment.join(' / '))}</span></div><button class="text-button catalog-details" type="button" data-exercise-detail="${esc(e.id)}">View form & cues</button></div></article>`).join('')}</div>`;
}

function renderWorkout(){
  const pos=getActivePosition();
  if(!pos)return `<div class="page-head"><div><p class="eyebrow">GUIDED WORKOUT</p><h2 class="page-title">No active session.</h2><p class="page-copy">Start the next workout from your generated plan.</p></div><button class="button" data-action="home">VIEW PLAN</button></div>`;
  const w=pos.workout;
  const done=completedSets(w.exercises),total=totalSets(w.exercises),pct=Math.round(done/Math.max(1,total)*100);
  const inExercise=['work','rest','calibrate','feedback','pre-set','timed-set'].includes(w.phase);
  const stageLabel=w.phase==='warmup'?'DYNAMIC STRETCH':w.phase==='cooldown'?'COOLDOWN':w.phase==='feedback'?'EXERCISE FEEDBACK':w.phase==='pre-set'?'GET READY':w.phase==='timed-set'?'TIMED SET':'CURRENT EXERCISE';
  return `<div class="guided-shell">
    <div id="workout-cue-flash" class="workout-cue-flash" aria-hidden="true"></div>
    <div class="session-status workout-status">
      <div class="session-title"><p class="eyebrow">ACTIVE WORKOUT</p><h2>${esc(w.routineName)}</h2><div class="session-meta"><span>${done}/${total} sets</span><span>${pct}%</span><span>${esc(stageLabel)}</span></div></div>
      <div class="clock-pair">
        <div class="clock-card"><span>TOTAL</span><strong id="elapsed-clock">${formatClock(workoutElapsedSeconds(w))}</strong></div>
        <div class="clock-card"><span>EXERCISE</span><strong id="exercise-clock">${inExercise?formatClock(exerciseElapsedSeconds(w)):'--:--'}</strong></div>
      </div>
    </div>
    ${renderCueControls()}
    <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
    <div class="step-strip">${w.exercises.map((_,i)=>`<span class="step-pip ${i<pos.ei?'done':i===pos.ei&&inExercise?'current':''}"></span>`).join('')}</div>
    <section class="exercise-stage">${w.phase==='warmup'||w.phase==='cooldown'?renderTimedStage(w):w.phase==='pre-set'?renderPreSet(pos):w.phase==='timed-set'?renderTimedWorkSet(pos):w.phase==='rest'?renderRest(pos):w.phase==='calibrate'?renderCalibration(pos):w.phase==='feedback'?renderExerciseFeedback(pos):renderWorkSet(pos)}</section>
    <div class="session-controls"><button class="button ghost" data-action="home">LEAVE & RESUME LATER</button><button class="button danger" data-action="finish">FINISH EARLY</button><button class="button danger" data-action="discard">DISCARD</button></div>
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
      <div class="pre-set-number" id="preset-count">${snap.remaining}</div>
      <h3 id="preset-label">${setup?'Set up your equipment':'Get ready'}</h3>
      <p>${setup?'You have a few seconds to get into position before the start countdown.':'The set begins automatically after 3 · 2 · 1.'}</p>
      <div class="pre-set-target"><span>TARGET</span><strong>${esc(target)}</strong></div>
      <button class="button secondary" type="button" data-action="start-set-now">START NOW</button>
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
      <p class="timed-work-cue">${esc(exerciseGuidance(pos.exercise).cue)}</p>
      <div class="timed-work-clock" id="timed-set-clock">${formatClock(snap.remaining)}</div>
      <div class="stage-progress"><span id="timed-set-progress" style="width:${pct}%"></span></div>
      <div class="timed-finish-note" id="timed-finish-note">${snap.remaining<=3&&snap.remaining>0?String(snap.remaining)+'…':'Stay controlled. You’ll get a finish cue at zero.'}</div>
      <button class="button secondary" type="button" data-action="end-timed-set">END SET EARLY</button>
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
      <p class="stage-cue">${esc(item?.cue||'Move through a comfortable range and breathe steadily.')}</p>
      <div class="stage-why"><span>WHY THIS STEP</span><strong>${esc(timedStageWhy(item))}</strong></div>
      <div class="stage-timer" id="stage-clock">${formatClock(remaining)}</div>
      <div class="stage-progress"><span id="stage-progress-fill" style="width:${Math.max(0,Math.min(100,(remaining/Math.max(1,item?.seconds||30))*100))}%"></span></div>
      <div class="next-preview"><div><span>UP NEXT</span><strong>${esc(nextLabel||'Begin workout')}</strong></div><div class="next-arrow">→</div></div>
      <button class="button secondary stage-skip" data-action="skip-stage">SKIP STEP</button>
    </div>
  </div>`;
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
    <div class="exercise-hero visual-exercise-hero"><div class="exercise-hero-layout">${exerciseImageButton(pos.exercise,'active-exercise-media')}<div class="exercise-hero-copy"><div class="exercise-kicker"><span class="current-label">CURRENT EXERCISE</span><span>EXERCISE ${pos.ei+1}/${pos.workout.exercises.length}</span></div><h3>${esc(pos.exercise.name)}</h3><p class="exercise-muscles">${(pos.exercise.muscles||[]).map(esc).join(' · ')}</p><p class="exercise-target">${pos.exercise.sets.length} sets · target ${esc(pos.exercise.reps)} · ${pos.exercise.rest}s rest</p><div class="workout-cue"><span>FORM CUE</span><strong>${esc(exerciseGuidance(pos.exercise).cue)}</strong></div><button class="text-button exercise-details-link" type="button" data-exercise-detail="${esc(pos.exercise.id)}">View exercise details</button><div class="initial-prescription"><span>${pos.exercise.adaptiveLabel?'LEARNED PRESCRIPTION':'STARTING PRESCRIPTION'}</span><strong>${esc(currentPrescriptionLabel(pos.exercise))}</strong>${pos.exercise.adaptiveReason?`<small>${esc(pos.exercise.adaptiveReason)}</small>`:''}</div><div class="recommend-row"><div class="exercise-best"><span>Suggested start</span><strong>${esc(suggestedLabel(pos.exercise))}</strong></div><div class="exercise-best"><span>Previous best</span><strong>${esc(bestLabel(pos.exercise.id))}</strong></div></div></div></div></div>
    <div class="set-panel"><div class="set-heading"><h4>Set ${pos.si+1} of ${pos.exercise.sets.length}</h4><span>${pos.si===0&&pos.exercise.calibrationRequired?'Calibration set':'Working set'}</span></div>
      <div class="input-grid">
        <div class="field"><label>WEIGHT (LB)${noLoad?' · OPTIONAL':''}</label><input id="set-weight" inputmode="decimal" value="${esc(defaultWeight)}" placeholder="${noLoad?'Bodyweight':'0'}"></div>
        <div class="field"><label>${isTimed?'SECONDS':'REPS'}</label><input id="set-reps" inputmode="numeric" value="${esc(defaultReps)}" placeholder="${isTimed?'45':'0'}"></div>
      </div>
      <button class="button primary-action" data-action="complete-set">COMPLETE SET ${pos.si+1}</button>
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

function renderRest(pos){
  const remaining=restRemaining(pos.workout),next=pos.workout.pendingPosition,nextEx=next?pos.workout.exercises[next.ei]:null,paused=Number.isFinite(pos.workout.restPausedRemaining);
  const result=pos.workout.lastProgressionResult;
  const progression=result?`<div class="next-time-card"><span>NEXT TIME</span><strong>${esc(result.label)}</strong><p>${esc(result.reason)}</p></div>`:'';
  return `<div class="rest-stage"><div class="rest-label">${next&&next.ei!==pos.ei?'EXERCISE COMPLETE · TRANSITION':'REST TIMER'}</div>${progression}<div class="timer-wrap" id="timer-ring" style="--timer-progress:${restProgress(pos.workout)}%"><div><div class="timer-value" id="rest-clock">${formatClock(remaining)}</div><div class="timer-sub">${paused?'PAUSED':'UNTIL NEXT SET'}</div></div></div><h3>${next&&next.ei!==pos.ei?'Reset for the next movement':'Recover, then go again'}</h3><p>When rest ends, the get-ready countdown starts automatically.</p><div class="timer-actions"><button class="button secondary" data-action="add-rest" ${remaining>=60?'disabled':''}>${remaining>=60?'60 SEC MAX':'+15 SEC'}</button><button class="button secondary" data-action="pause-rest">${paused?'RESUME':'PAUSE'}</button><button class="button" data-action="skip-rest">SKIP REST</button></div>${nextEx?`<div class="up-next-card"><div class="up-next-number">${String(next.ei+1).padStart(2,'0')}</div><div><span>UP NEXT</span><strong>${esc(nextEx.name)}</strong></div><em>Set ${next.si+1}/${nextEx.sets.length}</em></div>`:''}</div>`;
}

function renderHistory(){
  return `<div class="page-head"><div><p class="eyebrow">TRAINING LOG</p><h2 class="page-title">History</h2><p class="page-copy">Completed workouts, duration, volume, PRs, and adaptive decisions.</p></div></div><div class="history-list">${store.history.length?store.history.map(x=>{const learned=(x.exercises||[]).filter(ex=>ex.nextRecommendation).length;return `<article class="history-card"><div class="history-top"><div><h3>${esc(x.routineName)}</h3><div class="history-date">${formatDate(x.completedAt)}</div></div><div class="history-volume">${formatVolume(x.totalVolume||0)}</div></div><div class="history-stats"><span>${x.completedSets} sets</span><span>•</span><span>${x.durationMinutes} min</span>${learned?`<span>•</span><span>${learned} learned target${learned===1?'':'s'}</span>`:''}${x.newPRs?.length?`<span>•</span><span>${x.newPRs.length} PR${x.newPRs.length===1?'':'s'}</span>`:''}</div></article>`;}).join(''):renderEmpty('No workout history','Complete your first generated workout and it will appear here.')}</div>`;
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
  return `<div class="page-head"><div><p class="eyebrow">PROGRESS</p><h2 class="page-title">Your numbers</h2><p class="page-copy">The app learns from completed sets, exercise feedback, and calibration.</p></div></div>
    <div class="progress-grid">
      <section class="panel"><h3>This week</h3><div class="big-stat">${week.length}/${store.profile?.days||0}</div><div class="stat-label">workouts completed</div></section>
      <section class="panel"><h3>All-time volume</h3><div class="big-stat">${formatVolume(allVolume)}</div><div class="stat-label">logged volume</div></section>
      <section class="panel"><h3>Learned movements</h3><div class="big-stat">${learnedAll.length}</div><div class="stat-label">${calibrated} initially calibrated</div></section>
      <section class="panel"><h3>Personal records</h3>${prs.length?`<div class="pr-list">${prs.map(pr=>`<div class="pr-row"><span>${esc(pr.name)}</span><strong>${pr.weight?`${pr.weight} lb × ${pr.reps}`:`${pr.reps} reps`}</strong></div>`).join('')}</div>`:'<div class="stat-label">Complete workouts to establish PRs.</div>'}</section>
    </div>
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
  document.body.classList.toggle('modal-open',Boolean(exerciseDetailId));
  syncNav();syncLiveBadge();
}

function updateTimers(){
  const w=store.activeWorkout;
  if(!w)return;

  const elapsed=document.querySelector('#elapsed-clock');
  const exerciseClock=document.querySelector('#exercise-clock');
  if(elapsed)elapsed.textContent=formatClock(workoutElapsedSeconds(w));
  if(exerciseClock&&['work','rest','calibrate','feedback','pre-set','timed-set'].includes(w.phase))exerciseClock.textContent=formatClock(exerciseElapsedSeconds(w));

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
  const detail=event.target.closest('[data-exercise-detail]');
  if(detail){exerciseDetailId=detail.dataset.exerciseDetail;render();return;}
  const close=event.target.closest('[data-action="close-details"]');
  if(close){
    const insidePanel=event.target.closest('[data-modal-panel]');
    const explicitClose=event.target.closest('.modal-close');
    if(!insidePanel||explicitClose){exerciseDetailId=null;render();return;}
  }
  const tab=event.target.closest('[data-tab]');if(tab){setTab(tab.dataset.tab);return;}
  const start=event.target.closest('[data-start]');if(start){startWorkout(start.dataset.start);return;}
  const rir=event.target.closest('[data-rir]');if(rir){applyCalibration(rir.dataset.rir);return;}
  const feedback=event.target.closest('[data-feedback]');if(feedback){applyExerciseFeedback(feedback.dataset.feedback);return;}
  const node=event.target.closest('[data-action]');if(!node)return;
  const a=node.dataset.action;
  if(a==='go-home'||a==='home')setTab('home');
  else if(a==='history')setTab('history');
  else if(a==='resume'){unlockWorkoutCues();setTab('workout');}
  else if(a==='edit-profile')editProfile();
  else if(a==='build-plan')saveProfileFromForm(document.querySelector('#profile-form'));
  else if(a==='regenerate')regeneratePlan();
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
document.addEventListener('keydown',event=>{
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
