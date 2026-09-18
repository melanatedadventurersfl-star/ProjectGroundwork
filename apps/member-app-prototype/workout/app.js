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
function saveStore(){ localStorage.setItem(STORAGE_KEY,JSON.stringify(store)); syncLiveBadge(); }
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

function exerciseImageUrl(ex,index=0,useFallback=false){
  if(!ex)return '';
  const sourceId=useFallback?exerciseMediaFallbacks[ex.movement]:(exerciseMedia[ex.id]?.sourceId||exerciseMediaFallbacks[ex.movement]);
  return sourceId?EXERCISE_IMAGE_BASE+encodeURIComponent(sourceId)+'/'+index+'.jpg':'';
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

function buildWarmup(exercises){
  const moves=new Set(exercises.map(e=>e.movement));
  const items=[{name:'Easy march + arm swing',seconds:30,cue:'Raise your temperature and breathe easily.'}];
  if([...moves].some(m=>['squat','single-leg','quad-accessory'].includes(m))) items.push({name:'Bodyweight squat stretch',seconds:30,cue:'Controlled depth, knees tracking comfortably.'});
  if([...moves].some(m=>['hinge','hamstring-accessory'].includes(m))) items.push({name:'Dynamic hip hinge reach',seconds:30,cue:'Soft knees, reach hips back, stand tall.'});
  if([...moves].some(m=>['horizontal-push','horizontal-pull','vertical-push','vertical-pull','shoulder-accessory'].includes(m))) items.push({name:'Arm circles + shoulder sweep',seconds:30,cue:'Small circles into larger comfortable circles.'});
  if(items.length<4) items.push({name:'Alternating reverse lunge reach',seconds:30,cue:'Move slowly through a comfortable range.'});
  return items.slice(0,4);
}

function buildCooldown(exercises){
  const muscles=new Set(exercises.flatMap(e=>e.muscles||[]));
  const items=[];
  if(muscles.has('Chest')||muscles.has('Shoulders')) items.push({name:'Chest + shoulder stretch',seconds:30,cue:'Gentle stretch only, no forcing the range.'});
  if(muscles.has('Back')||muscles.has('Lats')) items.push({name:'Lat + upper-back stretch',seconds:30,cue:'Breathe slowly and let the shoulders relax.'});
  if(muscles.has('Quads')) items.push({name:'Standing quad stretch',seconds:30,cue:'Keep knees close and posture tall.'});
  if(muscles.has('Hamstrings')) items.push({name:'Hamstring stretch',seconds:30,cue:'Hinge gently until you feel light tension.'});
  if(muscles.has('Glutes')) items.push({name:'Glute stretch',seconds:30,cue:'Stay relaxed and avoid forcing the hip.'});
  if(muscles.has('Calves')) items.push({name:'Calf stretch',seconds:30,cue:'Keep the heel down and breathe steadily.'});
  if(items.length<3) items.push({name:'Full-body reach + breathing',seconds:30,cue:'Slow inhale, longer exhale, relax the shoulders.'});
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

function saveProfileFromForm(form){
  const data=new FormData(form);
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
  if (profile.weight<=0) { toast('Enter your current body weight.'); return; }
  store.profile=profile;
  store.plan=generatePlan(profile);
  saveStore();
  currentTab='home';
  render();
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
    warmup:day.warmup||[],cooldown:day.cooldown||[],
    exerciseStartedAt:null,exerciseDurations:{},
    restEndsAt:null,restDuration:0,restPausedRemaining:null,pendingPosition:null,
    exercises:day.exercises.map(ex=>{
      const calibrated=store.calibration[ex.id];
      const suggestedWeight=calibrated?.weight ?? ex.startWeight ?? 0;
      const suggestedReps=ex.startReps||recommendedRepCount(ex.reps);
      const weightValue=['bodyweight','timed','band','assisted'].includes(ex.loadMode)?'':String(suggestedWeight||'');
      return {
        ...ex,suggestedWeight,suggestedReps,
        calibrationRequired:ex.calibrationRequired && !calibrated,
        sets:Array.from({length:ex.sets},()=>({id:uid('set'),weight:weightValue,reps:String(suggestedReps||''),completed:false,completedAt:null}))
      };
    })
  };
  if(!workout.warmup.length){
    workout.phase='work';
    workout.timedPhaseStartedAt=null;
    workout.exerciseStartedAt=now;
  }
  return workout;
}

function startWorkout(dayId){
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
    w.phase='work';
    w.timedPhaseStartedAt=null;
    w.timedPhaseSkippedSeconds=0;
    w.exerciseStartedAt=new Date().toISOString();
    saveStore();render();return;
  }
  w.timedPhaseStartedAt=null;
  w.timedPhaseSkippedSeconds=0;
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

function completeCurrentSet(){
  const pos=getActivePosition(); if(!pos||pos.workout.phase!=='work')return;
  const weight=(document.querySelector('#set-weight')?.value||'').trim().replace(/[^0-9.]/g,'');
  const reps=(document.querySelector('#set-reps')?.value||'').trim().replace(/[^0-9.]/g,'');
  if(num(reps)<=0){toast(pos.exercise.loadMode==='timed'?'Enter the seconds completed.':'Enter the reps completed.');return;}
  pos.set.weight=weight;pos.set.reps=reps;pos.set.completed=true;pos.set.completedAt=new Date().toISOString();
  const next=nextPosition(pos.workout,pos.ei,pos.si);

  if(next && next.ei===pos.ei){
    const nextSet=pos.exercise.sets[next.si];
    nextSet.weight=weight;
    nextSet.reps=reps;
  }

  if(pos.si===0 && pos.exercise.calibrationRequired && !['bodyweight','timed','band','assisted'].includes(pos.exercise.loadMode)){
    pos.workout.phase='calibrate';pos.workout.pendingPosition=next;saveStore();render();return;
  }
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
  beginRest(next,pos.exercise.rest||45);
}

function advanceAfterRest(){
  const w=store.activeWorkout;if(!w||w.phase!=='rest')return;
  const next=w.pendingPosition;if(!next){startCooldown();return;}
  if(next.ei!==w.currentExerciseIndex){
    recordExerciseDuration(w,w.currentExerciseIndex);
    w.exerciseStartedAt=new Date().toISOString();
  }
  w.currentExerciseIndex=next.ei;w.currentSetIndex=next.si;w.phase='work';w.restEndsAt=null;w.restDuration=0;w.restPausedRemaining=null;w.pendingPosition=null;
  saveStore();render();
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
  delete entry.pendingPosition;delete entry.restEndsAt;delete entry.restPausedRemaining;
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
    <form id="profile-form" class="intake-form">
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
      <div class="form-actions"><button type="submit" class="button large">${store.profile?'REBUILD MY PLAN':'BUILD MY PLAN'}</button>${store.profile?'<button type="button" class="button secondary large" data-action="home">CANCEL</button>':''}</div>
    </form>
  </div>`;
}

function renderHome(){
  const p=store.profile,plan=store.plan;
  if(!p||!plan)return renderProfile();
  const week=weeklyHistory();const weeklyVolume=week.reduce((s,x)=>s+(x.totalVolume||0),0);const next=nextPlanDay();
  return `
    <div class="page-head"><div><p class="eyebrow">YOUR PERSONAL PLAN</p><h2 class="page-title">${esc(planGoalLabel(p.goal))}.</h2><p class="page-copy">${p.days} days/week · ${p.minutes}-minute sessions · ${esc(experienceLabel(p.experience))} · ${esc(equipmentLabel(p.equipment))}. Each workout is calculated from the actual sets, rest and setup time.</p></div><button class="button secondary" data-action="edit-profile">EDIT PROFILE</button></div>
    ${store.activeWorkout?`<button class="resume-card" data-action="resume"><div class="resume-dot"></div><div><span>WORKOUT IN PROGRESS</span><strong>${esc(store.activeWorkout.routineName)} · ${store.activeWorkout.phase==='rest'?'Resting':store.activeWorkout.phase==='calibrate'?'Calibrating':'Set in progress'}</strong></div><div class="resume-arrow">→</div></button>`:''}
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
          <div class="routine-plan">${day.exercises.map(ex=>`<div class="plan-row detailed visual-plan-row">${exerciseImageButton(ex,'plan-exercise-media')}<div class="plan-row-copy"><strong>${esc(ex.name)}</strong><small>Start: ${esc(store.calibration[ex.id]?.weight ? ((ex.loadMode==='dumbbell-pair'?store.calibration[ex.id].weight+' lb each':store.calibration[ex.id].weight+' lb')+' · calibrated') : ex.startLabel)} × ${esc(ex.startReps||recommendedRepCount(ex.reps))}</small></div><span>${ex.sets} × ${esc(ex.reps)}<small>${ex.rest}s rest</small></span></div>`).join('')}</div>
          <div class="routine-footer"><span class="routine-meta">${day.exercises.length} exercises · ${day.warmupMinutes} min stretch · ${day.cooldownMinutes} min cooldown</span><button class="button" data-start="${day.id}" ${store.activeWorkout?'disabled':''}>START</button></div>
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
  const inExercise=['work','rest','calibrate'].includes(w.phase);
  const stageLabel=w.phase==='warmup'?'DYNAMIC STRETCH':w.phase==='cooldown'?'COOLDOWN':'CURRENT EXERCISE';
  return `<div class="guided-shell">
    <div class="session-status workout-status">
      <div class="session-title"><p class="eyebrow">ACTIVE WORKOUT</p><h2>${esc(w.routineName)}</h2><div class="session-meta"><span>${done}/${total} sets</span><span>${pct}%</span><span>${esc(stageLabel)}</span></div></div>
      <div class="clock-pair">
        <div class="clock-card"><span>TOTAL</span><strong id="elapsed-clock">${formatClock(workoutElapsedSeconds(w))}</strong></div>
        <div class="clock-card"><span>EXERCISE</span><strong id="exercise-clock">${inExercise?formatClock(exerciseElapsedSeconds(w)):'--:--'}</strong></div>
      </div>
    </div>
    <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
    <div class="step-strip">${w.exercises.map((_,i)=>`<span class="step-pip ${i<pos.ei?'done':i===pos.ei&&inExercise?'current':''}"></span>`).join('')}</div>
    <section class="exercise-stage">${w.phase==='warmup'||w.phase==='cooldown'?renderTimedStage(w):w.phase==='rest'?renderRest(pos):w.phase==='calibrate'?renderCalibration(pos):renderWorkSet(pos)}</section>
    <div class="session-controls"><button class="button ghost" data-action="home">LEAVE & RESUME LATER</button><button class="button danger" data-action="finish">FINISH EARLY</button><button class="button danger" data-action="discard">DISCARD</button></div>
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
  return `<div class="timed-stage" data-stage-index="${index}">
    <p class="eyebrow">${isWarmup?'DYNAMIC STRETCH':'COOLDOWN'}</p>
    <div class="stage-count">STEP ${index+1} OF ${items.length} · TIMER V3</div>
    <h3>${esc(item?.name||'Get ready')}</h3>
    <p>${esc(item?.cue||'Move through a comfortable range and breathe steadily.')}</p>
    <div class="stage-timer" id="stage-clock">${formatClock(remaining)}</div>
    <div class="stage-progress"><span id="stage-progress-fill" style="width:${Math.max(0,Math.min(100,(remaining/Math.max(1,item?.seconds||30))*100))}%"></span></div>
    <div class="next-preview"><div><span>UP NEXT</span><strong>${esc(nextLabel||'Begin workout')}</strong></div><div class="next-arrow">→</div></div>
    <button class="button secondary stage-skip" data-action="skip-stage">SKIP STEP</button>
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
    <div class="exercise-hero visual-exercise-hero"><div class="exercise-hero-layout">${exerciseImageButton(pos.exercise,'active-exercise-media')}<div class="exercise-hero-copy"><div class="exercise-kicker"><span class="current-label">CURRENT EXERCISE</span><span>EXERCISE ${pos.ei+1}/${pos.workout.exercises.length}</span></div><h3>${esc(pos.exercise.name)}</h3><p class="exercise-muscles">${(pos.exercise.muscles||[]).map(esc).join(' · ')}</p><p class="exercise-target">${pos.exercise.sets.length} sets · target ${esc(pos.exercise.reps)} · ${pos.exercise.rest}s rest</p><div class="workout-cue"><span>FORM CUE</span><strong>${esc(exerciseGuidance(pos.exercise).cue)}</strong></div><button class="text-button exercise-details-link" type="button" data-exercise-detail="${esc(pos.exercise.id)}">View exercise details</button><div class="initial-prescription"><span>STARTING PRESCRIPTION</span><strong>${esc(suggestedLabel(pos.exercise))} × ${esc(pos.exercise.suggestedReps||recommendedRepCount(pos.exercise.reps))} reps</strong></div><div class="recommend-row"><div class="exercise-best"><span>Suggested start</span><strong>${esc(suggestedLabel(pos.exercise))}</strong></div><div class="exercise-best"><span>Previous best</span><strong>${esc(bestLabel(pos.exercise.id))}</strong></div></div></div></div></div>
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

function renderRest(pos){
  const remaining=restRemaining(pos.workout),next=pos.workout.pendingPosition,nextEx=next?pos.workout.exercises[next.ei]:null,paused=Number.isFinite(pos.workout.restPausedRemaining);
  return `<div class="rest-stage"><div class="rest-label">${next&&next.ei!==pos.ei?'EXERCISE COMPLETE · TRANSITION':'REST TIMER'}</div><div class="timer-wrap" id="timer-ring" style="--timer-progress:${restProgress(pos.workout)}%"><div><div class="timer-value" id="rest-clock">${formatClock(remaining)}</div><div class="timer-sub">${paused?'PAUSED':'UNTIL NEXT SET'}</div></div></div><h3>${next&&next.ei!==pos.ei?'Reset for the next movement':'Recover, then go again'}</h3><p>The next set opens automatically when the timer reaches zero.</p><div class="timer-actions"><button class="button secondary" data-action="add-rest" ${remaining>=60?'disabled':''}>${remaining>=60?'60 SEC MAX':'+15 SEC'}</button><button class="button secondary" data-action="pause-rest">${paused?'RESUME':'PAUSE'}</button><button class="button" data-action="skip-rest">SKIP REST</button></div>${nextEx?`<div class="up-next-card"><div class="up-next-number">${String(next.ei+1).padStart(2,'0')}</div><div><span>UP NEXT</span><strong>${esc(nextEx.name)}</strong></div><em>Set ${next.si+1}/${nextEx.sets.length}</em></div>`:''}</div>`;
}

function renderHistory(){
  return `<div class="page-head"><div><p class="eyebrow">TRAINING LOG</p><h2 class="page-title">History</h2><p class="page-copy">Completed workouts, duration, volume and PRs.</p></div></div><div class="history-list">${store.history.length?store.history.map(x=>`<article class="history-card"><div class="history-top"><div><h3>${esc(x.routineName)}</h3><div class="history-date">${formatDate(x.completedAt)}</div></div><div class="history-volume">${formatVolume(x.totalVolume||0)}</div></div><div class="history-stats"><span>${x.completedSets} sets</span><span>•</span><span>${x.durationMinutes} min</span>${x.newPRs?.length?`<span>•</span><span>${x.newPRs.length} PR${x.newPRs.length===1?'':'s'}</span>`:''}</div></article>`).join(''):renderEmpty('No workout history','Complete your first generated workout and it will appear here.')}</div>`;
}
function personalRecords(){
  const map=new Map();
  for(const w of store.history)for(const ex of w.exercises)for(const s of ex.sets){if(!s.completed)continue;const c={id:ex.id,name:ex.name,weight:num(s.weight),reps:num(s.reps)};const old=map.get(ex.id);if(!old||c.weight>old.weight||(c.weight===old.weight&&c.reps>old.reps))map.set(ex.id,c);}
  return [...map.values()].sort((a,b)=>b.weight-a.weight);
}
function renderProgress(){
  const week=weeklyHistory(),allVolume=store.history.reduce((s,x)=>s+(x.totalVolume||0),0),prs=personalRecords().slice(0,12),calibrated=Object.keys(store.calibration).length;
  return `<div class="page-head"><div><p class="eyebrow">PROGRESS</p><h2 class="page-title">Your numbers</h2><p class="page-copy">The app learns from completed workouts and calibration sets.</p></div></div><div class="progress-grid"><section class="panel"><h3>This week</h3><div class="big-stat">${week.length}/${store.profile?.days||0}</div><div class="stat-label">workouts completed</div></section><section class="panel"><h3>All-time volume</h3><div class="big-stat">${formatVolume(allVolume)}</div><div class="stat-label">logged volume</div></section><section class="panel"><h3>Calibrated movements</h3><div class="big-stat">${calibrated}</div><div class="stat-label">starting loads learned</div></section><section class="panel"><h3>Personal records</h3>${prs.length?`<div class="pr-list">${prs.map(pr=>`<div class="pr-row"><span>${esc(pr.name)}</span><strong>${pr.weight?`${pr.weight} lb × ${pr.reps}`:`${pr.reps} reps`}</strong></div>`).join('')}</div>`:'<div class="stat-label">Complete workouts to establish PRs.</div>'}</section></div>`;
}
function renderSummary(){
  const x=store.history.find(h=>h.id===store.lastSummaryId)||store.history[0];if(!x)return renderHistory();
  return `<div class="summary-hero"><div class="summary-check">✓</div><p class="eyebrow">WORKOUT COMPLETE</p><h2>${esc(x.routineName)} done.</h2><p>Your history, calibration data and progress are updated.</p><div class="summary-grid"><div class="summary-card"><strong>${x.durationMinutes}</strong><span>Minutes</span></div><div class="summary-card"><strong>${x.completedSets}</strong><span>Sets</span></div><div class="summary-card"><strong>${formatVolume(x.totalVolume||0)}</strong><span>Volume</span></div></div>${x.newPRs?.length?`<section class="panel summary-prs"><p class="eyebrow">NEW PERSONAL RECORDS</p><div class="pr-list">${x.newPRs.map(pr=>`<div class="pr-row"><span>${esc(pr.name)}</span><strong>${pr.weight?`${pr.weight} lb × ${pr.reps}`:`${pr.reps} reps`}</strong></div>`).join('')}</div></section>`:''}<div class="summary-actions"><button class="button" data-action="home">BACK TO PLAN</button><button class="button secondary" data-action="history">VIEW HISTORY</button></div></div>`;
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

  if(['warmup','cooldown'].includes(w.phase)){
    const snap=timedStageSnapshot(w);
    if(!snap)return;
    if(snap.complete){ reconcileTimedStage();return; }

    const stage=document.querySelector('.timed-stage');
    const renderedIndex=Number(stage?.dataset.stageIndex);
    if(Number.isFinite(renderedIndex)&&renderedIndex!==snap.index){
      render();return;
    }

    const elapsed=document.querySelector('#elapsed-clock');
    const stageClock=document.querySelector('#stage-clock');
    const fill=document.querySelector('#stage-progress-fill');
    if(elapsed) elapsed.textContent=formatClock(workoutElapsedSeconds(w));
    if(stageClock) stageClock.textContent=formatClock(snap.remaining);
    if(fill) fill.style.width=`${Math.max(0,Math.min(100,(snap.remaining/Math.max(1,snap.total))*100))}%`;
    return;
  }

  const elapsed=document.querySelector('#elapsed-clock');
  const exerciseClock=document.querySelector('#exercise-clock');
  if(elapsed) elapsed.textContent=formatClock(workoutElapsedSeconds(w));
  if(exerciseClock&&['work','rest','calibrate'].includes(w.phase)) exerciseClock.textContent=formatClock(exerciseElapsedSeconds(w));

  if(w.phase!=='rest')return;
  const remaining=restRemaining(w),clock=document.querySelector('#rest-clock'),ring=document.querySelector('#timer-ring');
  if(clock)clock.textContent=formatClock(remaining);
  if(ring)ring.style.setProperty('--timer-progress',`${restProgress(w)}%`);
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
  const node=event.target.closest('[data-action]');if(!node)return;
  const a=node.dataset.action;
  if(a==='go-home'||a==='home')setTab('home');
  else if(a==='history')setTab('history');
  else if(a==='resume')setTab('workout');
  else if(a==='edit-profile')editProfile();
  else if(a==='regenerate')regeneratePlan();
  else if(a==='complete-set')completeCurrentSet();
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
document.addEventListener('submit',event=>{if(event.target.id==='profile-form'){event.preventDefault();saveProfileFromForm(event.target);}});
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
