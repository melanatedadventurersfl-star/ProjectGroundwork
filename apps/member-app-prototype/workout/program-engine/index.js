(function(root){
'use strict';

const TAXONOMY={
  movements:['horizontal_push','vertical_push','horizontal_pull','vertical_pull','squat','hinge','lunge','knee_extension','knee_flexion','hip_extension','calf','elbow_flexion','elbow_extension','shoulder_abduction','anti_extension','anti_rotation','rotation','carry'],
  muscles:['chest','lats','upper_back','anterior_delts','lateral_delts','rear_delts','biceps','triceps','quads','hamstrings','glutes','calves','core','hip_flexors','adductors'],
  activityTypes:['strength','warmup','mobility','stretch','conditioning','recovery','rest'],
  stretchTypes:['dynamic','active','static','mobility','breath_assisted']
};

const EXERCISES=[
{id:'db_bench',name:'Dumbbell Bench Press',pattern:'horizontal_push',primary:['chest'],secondary:['triceps','anterior_delts'],equipment:['dumbbell','bench'],difficulty:1,goals:['hypertrophy','strength'],progression:'double_progression',group:'horizontal_press'},
{id:'pushup',name:'Push-Up',pattern:'horizontal_push',primary:['chest'],secondary:['triceps','anterior_delts'],equipment:['bodyweight'],difficulty:1,goals:['hypertrophy','general_fitness'],progression:'rep_leverage',group:'horizontal_press'},
{id:'machine_press',name:'Machine Chest Press',pattern:'horizontal_push',primary:['chest'],secondary:['triceps','anterior_delts'],equipment:['machine'],difficulty:1,goals:['hypertrophy'],progression:'double_progression',group:'horizontal_press'},
{id:'db_shoulder_press',name:'Dumbbell Shoulder Press',pattern:'vertical_push',primary:['anterior_delts'],secondary:['triceps'],equipment:['dumbbell'],difficulty:1,goals:['hypertrophy','strength'],progression:'double_progression',group:'vertical_press'},
{id:'cable_row',name:'Seated Cable Row',pattern:'horizontal_pull',primary:['upper_back'],secondary:['lats','biceps'],equipment:['cable'],difficulty:1,goals:['hypertrophy','strength'],progression:'double_progression',group:'horizontal_pull'},
{id:'db_row',name:'One-Arm Dumbbell Row',pattern:'horizontal_pull',primary:['upper_back'],secondary:['lats','biceps'],equipment:['dumbbell'],difficulty:1,goals:['hypertrophy','strength'],progression:'double_progression',group:'horizontal_pull'},
{id:'lat_pulldown',name:'Lat Pulldown',pattern:'vertical_pull',primary:['lats'],secondary:['biceps','upper_back'],equipment:['cable'],difficulty:1,goals:['hypertrophy','strength'],progression:'double_progression',group:'vertical_pull'},
{id:'goblet_squat',name:'Goblet Squat',pattern:'squat',primary:['quads'],secondary:['glutes','core'],equipment:['dumbbell'],difficulty:1,goals:['hypertrophy','general_fitness'],progression:'double_progression',group:'squat'},
{id:'leg_press',name:'Leg Press',pattern:'squat',primary:['quads'],secondary:['glutes'],equipment:['machine'],difficulty:1,goals:['hypertrophy','strength'],progression:'double_progression',group:'squat'},
{id:'db_rdl',name:'Dumbbell Romanian Deadlift',pattern:'hinge',primary:['hamstrings'],secondary:['glutes'],equipment:['dumbbell'],difficulty:1,goals:['hypertrophy','strength'],progression:'double_progression',group:'hinge'},
{id:'reverse_lunge',name:'Reverse Lunge',pattern:'lunge',primary:['quads','glutes'],secondary:['hamstrings'],equipment:['bodyweight'],optionalEquipment:['dumbbell'],difficulty:1,goals:['hypertrophy','general_fitness'],progression:'rep_load',group:'lunge'},
{id:'leg_curl',name:'Leg Curl',pattern:'knee_flexion',primary:['hamstrings'],secondary:[],equipment:['machine'],difficulty:1,goals:['hypertrophy'],progression:'double_progression',group:'knee_flexion'},
{id:'lateral_raise',name:'Dumbbell Lateral Raise',pattern:'shoulder_abduction',primary:['lateral_delts'],secondary:[],equipment:['dumbbell'],difficulty:1,goals:['hypertrophy'],progression:'double_progression',group:'shoulder_isolation'},
{id:'db_curl',name:'Dumbbell Curl',pattern:'elbow_flexion',primary:['biceps'],secondary:[],equipment:['dumbbell'],difficulty:1,goals:['hypertrophy'],progression:'double_progression',group:'biceps'},
{id:'triceps_pressdown',name:'Triceps Pressdown',pattern:'elbow_extension',primary:['triceps'],secondary:[],equipment:['cable'],difficulty:1,goals:['hypertrophy'],progression:'double_progression',group:'triceps'},
{id:'calf_raise',name:'Standing Calf Raise',pattern:'calf',primary:['calves'],secondary:[],equipment:['bodyweight'],optionalEquipment:['dumbbell'],difficulty:1,goals:['hypertrophy','general_fitness'],progression:'rep_load',group:'calf'},
{id:'dead_bug',name:'Dead Bug',pattern:'anti_extension',primary:['core'],secondary:[],equipment:['bodyweight'],difficulty:1,goals:['general_fitness','hypertrophy'],progression:'rep_control',group:'core'},
{id:'incline_pushup',name:'Incline Push-Up',pattern:'horizontal_push',primary:['chest'],secondary:['triceps','anterior_delts'],equipment:['bodyweight'],difficulty:1,goals:['hypertrophy','general_fitness'],progression:'rep_leverage',group:'horizontal_press'},
{id:'inverted_row',name:'Inverted Row',pattern:'horizontal_pull',primary:['upper_back'],secondary:['lats','biceps'],equipment:['bodyweight'],difficulty:2,goals:['hypertrophy','general_fitness'],progression:'rep_leverage',group:'horizontal_pull'},
{id:'band_pulldown',name:'Resistance Band Lat Pulldown',pattern:'vertical_pull',primary:['lats'],secondary:['biceps'],equipment:['band'],difficulty:1,goals:['hypertrophy','general_fitness'],progression:'rep_resistance',group:'vertical_pull'},
{id:'split_squat',name:'Split Squat',pattern:'lunge',primary:['quads','glutes'],secondary:['hamstrings'],equipment:['bodyweight'],optionalEquipment:['dumbbell'],difficulty:1,goals:['hypertrophy','general_fitness'],progression:'rep_load',group:'lunge'},
{id:'glute_bridge',name:'Glute Bridge',pattern:'hip_extension',primary:['glutes'],secondary:['hamstrings'],equipment:['bodyweight'],difficulty:1,goals:['hypertrophy','general_fitness'],progression:'rep_load',group:'hip_extension'},
{id:'pallof_press',name:'Pallof Press',pattern:'anti_rotation',primary:['core'],secondary:[],equipment:['cable'],difficulty:1,goals:['strength','general_fitness'],progression:'rep_load',group:'core'},
{id:'suitcase_carry',name:'Suitcase Carry',pattern:'carry',primary:['core'],secondary:['upper_back'],equipment:['dumbbell'],difficulty:1,goals:['strength','general_fitness'],progression:'distance_load',group:'carry'}
];

const STRETCHES=[
{id:'cat_cow',name:'Cat-Cow Flow',regions:['spine','upper_back'],muscles:['core'],type:'dynamic',position:'quadruped',equipment:['bodyweight'],side:'both',minSeconds:40},
{id:'thread_needle',name:'Thread the Needle',regions:['upper_back','shoulders'],muscles:['upper_back','rear_delts'],type:'mobility',position:'quadruped',equipment:['bodyweight'],side:'per_side',minSeconds:30},
{id:'doorway_chest',name:'Doorway Chest Stretch',regions:['chest','shoulders'],muscles:['chest','anterior_delts'],type:'static',position:'standing',equipment:['wall'],side:'per_side',minSeconds:30},
{id:'kneeling_lat',name:'Bench Kneeling Lat Stretch',regions:['back','shoulders'],muscles:['lats'],type:'static',position:'kneeling',equipment:['bench'],side:'both',minSeconds:40},
{id:'cross_body_shoulder',name:'Cross-Body Shoulder Stretch',regions:['shoulders'],muscles:['rear_delts'],type:'static',position:'standing',equipment:['bodyweight'],side:'per_side',minSeconds:30},
{id:'triceps_overhead',name:'Overhead Triceps Stretch',regions:['arms','shoulders'],muscles:['triceps'],type:'static',position:'standing',equipment:['bodyweight'],side:'per_side',minSeconds:30},
{id:'90_90',name:'90/90 Hip Switch',regions:['hips'],muscles:['glutes','adductors'],type:'dynamic',position:'seated',equipment:['bodyweight'],side:'both',minSeconds:45},
{id:'hip_flexor',name:'Half-Kneeling Hip Flexor Stretch',regions:['hips'],muscles:['hip_flexors'],type:'static',position:'half_kneeling',equipment:['bodyweight'],side:'per_side',minSeconds:35},
{id:'adductor_rockback',name:'Adductor Rockback',regions:['hips','groin'],muscles:['adductors'],type:'mobility',position:'quadruped',equipment:['bodyweight'],side:'per_side',minSeconds:35},
{id:'hamstring_fold',name:'Single-Leg Hamstring Fold',regions:['legs'],muscles:['hamstrings'],type:'static',position:'seated',equipment:['bodyweight'],side:'per_side',minSeconds:35},
{id:'figure_four',name:'Supine Figure-Four Stretch',regions:['hips'],muscles:['glutes'],type:'static',position:'supine',equipment:['bodyweight'],side:'per_side',minSeconds:35},
{id:'quad_couch',name:'Supported Quad and Hip Flexor Stretch',regions:['legs','hips'],muscles:['quads','hip_flexors'],type:'static',position:'half_kneeling',equipment:['bench'],side:'per_side',minSeconds:30},
{id:'calf_wall',name:'Wall Calf Stretch',regions:['legs','ankles'],muscles:['calves'],type:'static',position:'standing',equipment:['wall'],side:'per_side',minSeconds:30},
{id:'child_lat',name:"Child's Pose with Side Reach",regions:['back','shoulders'],muscles:['lats','upper_back'],type:'breath_assisted',position:'kneeling',equipment:['bodyweight'],side:'per_side',minSeconds:35}
];

const MOBILITY=[
{id:'ankle_rocks',name:'Knee-to-Wall Ankle Rocks',regions:['ankles'],type:'mobility',seconds:45},
{id:'world_greatest',name:"World's Greatest Stretch Flow",regions:['hips','thoracic_spine'],type:'mobility',seconds:60},
{id:'thoracic_rotation',name:'Quadruped Thoracic Rotation',regions:['upper_back'],type:'mobility',seconds:60},
{id:'hip_cars',name:'Supported Hip CARs',regions:['hips'],type:'mobility',seconds:60},
{id:'shoulder_cars',name:'Shoulder CARs',regions:['shoulders'],type:'mobility',seconds:60},
{id:'deep_squat_pry',name:'Supported Deep Squat Pry',regions:['hips','ankles'],type:'mobility',seconds:60}
];

const CONDITIONING=[
{id:'brisk_walk',name:'Brisk Walk',equipment:['bodyweight'],mode:'steady',impact:'low'},
{id:'incline_walk',name:'Incline Treadmill Walk',equipment:['treadmill'],mode:'steady',impact:'low'},
{id:'bike_intervals',name:'Bike Intervals',equipment:['bike'],mode:'interval',impact:'low'},
{id:'row_intervals',name:'Row Erg Intervals',equipment:['rower'],mode:'interval',impact:'moderate'}
];

const WEEK_MODELS={
 hypertrophy:[
  {week:1,label:'Base',setMultiplier:1,intensity:'2-3 reps in reserve'},
  {week:2,label:'Build',setMultiplier:1,intensity:'2 reps in reserve'},
  {week:3,label:'Overload',setMultiplier:1.34,intensity:'1-2 reps in reserve'},
  {week:4,label:'Consolidate',setMultiplier:.75,intensity:'3-4 reps in reserve'}
 ],
 strength:[
  {week:1,label:'Base',setMultiplier:1,intensity:'3 reps in reserve'},
  {week:2,label:'Build',setMultiplier:1,intensity:'2 reps in reserve'},
  {week:3,label:'Overload',setMultiplier:1.34,intensity:'1-2 reps in reserve'},
  {week:4,label:'Consolidate',setMultiplier:.75,intensity:'3-4 reps in reserve'}
 ],
 general_fitness:[
  {week:1,label:'Base',setMultiplier:1,intensity:'comfortable'},
  {week:2,label:'Build',setMultiplier:1,intensity:'moderate'},
  {week:3,label:'Practice+',setMultiplier:1.1,intensity:'moderate'},
  {week:4,label:'Consolidate',setMultiplier:.8,intensity:'easy-moderate'}
 ]
};

const SPLITS={
  2:['full_a','full_b'],
  3:['full_a','full_b','full_c'],
  4:['upper_a','lower_a','upper_b','lower_b'],
  5:['upper_a','lower_a','upper_b','lower_b','full_c']
};
const SLOT_TEMPLATES={
 upper_a:['horizontal_push','horizontal_pull','vertical_pull','shoulder_abduction','elbow_flexion','elbow_extension'],
 upper_b:['vertical_push','horizontal_pull','horizontal_push','vertical_pull','shoulder_abduction','elbow_extension','elbow_flexion'],
 lower_a:['squat','hinge','lunge','knee_flexion','calf','anti_extension'],
 lower_b:['hinge','squat','lunge','knee_flexion','calf','anti_extension'],
 full_a:['squat','horizontal_push','horizontal_pull','hinge','shoulder_abduction','anti_extension'],
 full_b:['hinge','vertical_push','vertical_pull','lunge','elbow_flexion','calf'],
 full_c:['squat','horizontal_push','vertical_pull','hinge','elbow_extension','anti_extension']
};

function normalizeProfile(input){
 const p=Object.assign({goal:'hypertrophy',experience:'beginner',sessionsPerWeek:4,sessionMinutes:45,equipment:['bodyweight','dumbbell','bench'],priorities:[],preferences:[],exclusions:[],stretchMinutes:10,mobilitySessionsPerWeek:1},input||{});
 p.sessionsPerWeek=Math.max(2,Math.min(5,Number(p.sessionsPerWeek)||4));
 p.sessionMinutes=Math.max(20,Math.min(120,Number(p.sessionMinutes)||45));
 p.stretchMinutes=[5,10,15].includes(Number(p.stretchMinutes))?Number(p.stretchMinutes):10;
 p.equipment=Array.from(new Set(['bodyweight'].concat(p.equipment||[])));
 return p;
}
function equipmentFits(item,p){
 return (item.equipment||[]).every(eq=>eq==='bodyweight'||p.equipment.includes(eq)||eq==='wall');
}
function chooseExercise(pattern,p,used){
 const candidates=EXERCISES.filter(e=>e.pattern===pattern&&!p.exclusions.includes(e.id)&&equipmentFits(e,p));
 if(!candidates.length)return null;
 const scored=candidates.map(e=>{
   let score=100;
   if(e.goals.includes(p.goal))score+=20;
   if((p.preferences||[]).includes(e.id))score+=15;
   if(used.has(e.id))score-=25;
   if((p.priorities||[]).some(m=>e.primary.includes(m)))score+=10;
   return {e,score};
 }).sort((a,b)=>b.score-a.score||a.e.id.localeCompare(b.e.id));
 return scored[0].e;
}
function prescriptionFor(exercise,p,week){
 const accessory=['shoulder_abduction','elbow_flexion','elbow_extension','calf','anti_extension','anti_rotation'].includes(exercise.pattern);
 const model=(WEEK_MODELS[p.goal]||WEEK_MODELS.general_fitness)[week-1];
 const baseSets=accessory?3:3;
 const sets=Math.max(2,Math.round(baseSets*model.setMultiplier));
 const reps=p.goal==='strength'&&!accessory?[5,8]:(accessory?[10,15]:[8,12]);
 return {sets,reps,restSeconds:accessory?60:(p.goal==='strength'?120:90),intensityTarget:model.intensity,progression:exercise.progression,week,weekLabel:model.label,setMultiplier:model.setMultiplier};
}
function warmupFor(label){
 const lower=label.startsWith('lower');
 return lower?
 [{name:'Easy movement',seconds:60},{name:'Ankle rocks',seconds:45},{name:'90/90 Hip Switch',seconds:60},{name:'Glute bridge',seconds:45},{name:'Bodyweight squat rehearsal',seconds:90}]:
 [{name:'Easy movement',seconds:60},{name:'Cat-Cow Flow',seconds:45},{name:'Thread the Needle',seconds:60},{name:'Scapular wall slide',seconds:45},{name:'Movement rehearsal',seconds:90}];
}
function stretchTargets(label){
 if(label.startsWith('lower'))return ['hip_flexor','adductor_rockback','hamstring_fold','figure_four','calf_wall','90_90','quad_couch'];
 if(label.startsWith('upper'))return ['doorway_chest','thread_needle','kneeling_lat','cross_body_shoulder','triceps_overhead','child_lat'];
 return ['90_90','hip_flexor','hamstring_fold','doorway_chest','thread_needle','child_lat','calf_wall','figure_four'];
}
function buildStretchSession(minutes,label,p){
 const target=Math.max(300,Math.min(900,minutes*60));
 let pool=stretchTargets(label).map(id=>STRETCHES.find(s=>s.id===id)).filter(Boolean).filter(s=>equipmentFits(s,p));
 if(!pool.length)pool=STRETCHES.filter(s=>equipmentFits(s,p));
 const activities=[]; let total=0, i=0;
 while(total<target && i<30){
   const s=pool[i%pool.length];
   const perSide=s.side==='per_side';
   const remaining=target-total;
   let seconds=Math.min(Math.max(s.minSeconds, perSide?60:45),remaining);
   if(perSide && seconds>=40)seconds=Math.floor(seconds/2)*2;
   activities.push({id:s.id,name:s.name,type:s.type,seconds,perSide,secondsPerSide:perSide?seconds/2:null,regions:s.regions});
   total+=seconds;i++;
 }
 if(total<target)activities.push({id:'breathing_reset',name:'Breathing Reset',type:'breath_assisted',seconds:target-total,perSide:false,secondsPerSide:null,regions:['full_body']});
 return {type:'stretch',targetMinutes:minutes,totalSeconds:target,activities};
}
function estimateStrengthMinutes(strength){
 return strength.reduce((sum,x)=>{
  if(!x.exercise)return sum;
  const pr=x.prescription;
  return sum + pr.sets*((pr.restSeconds+45)/60);
 },0);
}
function timeBudgetSession(session,p){
 const warmupSeconds=session.warmup.reduce((n,x)=>n+x.seconds,0);
 const stretchSeconds=session.stretch.totalSeconds;
 const availableStrength=Math.max(8,p.sessionMinutes-(warmupSeconds+stretchSeconds)/60);
 let running=0;
 session.strength.forEach((x,i)=>{
  if(!x.exercise){x.inMinimumViable=false;return}
  const cost=x.prescription.sets*((x.prescription.restSeconds+45)/60);
  running+=cost;
  x.estimatedMinutes=Math.round(cost*10)/10;
  x.inMinimumViable=i<3;
  x.timeFit=running<=availableStrength;
 });
 session.minimumViableWorkout=session.strength.filter(x=>x.exercise&&x.inMinimumViable).map(x=>x.exercise.id);
 session.timeBudget={targetMinutes:p.sessionMinutes,warmupMinutes:Math.round(warmupSeconds/6)/10,stretchMinutes:stretchSeconds/60,strengthBudgetMinutes:Math.round(availableStrength*10)/10,estimatedStrengthMinutes:Math.round(estimateStrengthMinutes(session.strength)*10)/10};
 return session;
}
function applySupersets(session){
 const eligible=session.strength.filter(x=>x.exercise&&['shoulder_abduction','elbow_flexion','elbow_extension','calf','anti_extension'].includes(x.slot));
 session.supersets=[];
 for(let i=0;i+1<eligible.length;i+=2){
  const id='SS'+(session.supersets.length+1);
  eligible[i].superset=id;eligible[i+1].superset=id;
  session.supersets.push({id,exerciseIds:[eligible[i].exercise.id,eligible[i+1].exercise.id],reason:'Pairs lower-conflict accessory work to improve session efficiency'});
 }
 return session;
}
function substitutionsFor(exercise,p){
 if(!exercise)return[];
 return EXERCISES.filter(e=>e.id!==exercise.id&&e.pattern===exercise.pattern&&!p.exclusions.includes(e.id)&&equipmentFits(e,p))
  .map(e=>({id:e.id,name:e.name,reasons:['same movement objective','available equipment',e.group===exercise.group?'same substitution group':'compatible pattern']})).slice(0,3);
}
function buildMobilitySession(minutes,p,focus){
 const target=Math.max(300,Math.min(900,(Number(minutes)||10)*60));
 const wanted=focus==='upper'?['upper_back','shoulders']:focus==='lower'?['hips','ankles']:null;
 let pool=MOBILITY.filter(m=>!wanted||m.regions.some(r=>wanted.includes(r)));
 if(!pool.length)pool=MOBILITY;
 const activities=[];let total=0,i=0;
 while(total<target){const m=pool[i%pool.length],seconds=Math.min(m.seconds,target-total);activities.push({...m,seconds});total+=seconds;i++}
 return {type:'mobility',focus:focus||'full_body',targetMinutes:target/60,totalSeconds:target,activities};
}
function buildConditioningSession(minutes,p,mode){
 const target=Math.max(5,Math.min(45,Number(minutes)||15));
 const candidates=CONDITIONING.filter(x=>equipmentFits(x,p)&&(mode?x.mode===mode:true));
 const activity=candidates[0]||CONDITIONING[0];
 return {type:'conditioning',activity,minutes:target,prescription:activity.mode==='interval'?{workSeconds:30,recoverySeconds:60,rounds:Math.max(4,Math.floor(target*60/90))}:{intensity:'conversational to moderate',minutes:target}};
}
function buildStrategy(p){
 const split=p.sessionsPerWeek===4?'upper_lower':p.sessionsPerWeek===3?'full_body_3':p.sessionsPerWeek===2?'full_body_2':'hybrid_5';
 return {goal:p.goal,frequency:p.sessionsPerWeek,split,blockWeeks:4,progression:'weekly_block_plus_exercise_specific',stretchMinutes:p.stretchMinutes,mobilitySessionsPerWeek:p.mobilitySessionsPerWeek,weekModel:WEEK_MODELS[p.goal]||WEEK_MODELS.general_fitness};
}
function buildProgram(input){
 const p=normalizeProfile(input), strategy=buildStrategy(p), labels=SPLITS[p.sessionsPerWeek], used=new Set(), weeks=[];
 for(let week=1;week<=4;week++){
   const sessions=labels.map((label,index)=>{
     const slots=SLOT_TEMPLATES[label];
     const strength=slots.map((pattern,slotIndex)=>{
       const exercise=chooseExercise(pattern,p,used);
       if(!exercise)return {slot:pattern,unfilled:true,reason:'No compatible exercise for available equipment/exclusions'};
       used.add(exercise.id);
       return {slot:pattern,exercise:Object.assign({},exercise),prescription:prescriptionFor(exercise,p,week),substitutions:substitutionsFor(exercise,p),reason:['matches '+pattern,'equipment available',exercise.goals.includes(p.goal)?'supports '+p.goal:'compatible training option']};
     });
     let session={id:'w'+week+'s'+(index+1),week,index:index+1,label,type:'strength',estimatedMinutes:p.sessionMinutes,warmup:warmupFor(label),strength,stretch:buildStretchSession(p.stretchMinutes,label,p),status:'scheduled'}; session=applySupersets(session); return timeBudgetSession(session,p);
   });
   const model=(WEEK_MODELS[p.goal]||WEEK_MODELS.general_fitness)[week-1]; const recoveryActivities=[]; for(let m=0;m<p.mobilitySessionsPerWeek;m++)recoveryActivities.push(buildMobilitySession(p.stretchMinutes,p,'full')); weeks.push({week,label:model.label,sessions,recoveryActivities});
 }
 return {version:'1.1.0',profile:p,strategy,weeks,createdBy:'GoWorkout Program Engine v1.1'};
}
function validateProgram(program){
 const errors=[];
 if(!program||program.weeks?.length!==4)errors.push('Program must contain four weeks');
 const sessions=(program.weeks||[]).flatMap(w=>w.sessions||[]);
 if(sessions.length!==program.profile.sessionsPerWeek*4)errors.push('Session count does not match frequency');
 sessions.forEach(s=>{
   if(!s.warmup?.length)errors.push(s.id+': missing warmup');
   if(!s.stretch||![300,600,900].includes(s.stretch.totalSeconds))errors.push(s.id+': stretch duration invalid');
   s.strength.forEach(x=>{
     if(x.exercise&&!equipmentFits(x.exercise,program.profile))errors.push(s.id+': incompatible equipment '+x.exercise.id);
     if(x.exercise&&program.profile.exclusions.includes(x.exercise.id))errors.push(s.id+': excluded exercise selected '+x.exercise.id);
   });
 });
 return {valid:errors.length===0,errors};
}
function progressionDecision(history,target){
 if(!Array.isArray(history)||history.length<2)return {action:'repeat',reason:'Need at least two comparable performances'};
 const recent=history.slice(-2);
 const top=target?.reps?.[1]||10;
 const allTop=recent.every(session=>session.reps?.length&&session.reps.every(r=>r>=top));
 if(allTop)return {action:'progress',reason:'Top of rep range achieved across two sessions'};
 const below=recent.every(session=>session.reps?.length&&session.reps.some(r=>r<(target?.reps?.[0]||8)));
 if(below)return {action:'review',reason:'Below target range across two sessions'};
 return {action:'maintain',reason:'Performance remains within progression range'};
}

const API={TAXONOMY,EXERCISES,STRETCHES,MOBILITY,CONDITIONING,WEEK_MODELS,normalizeProfile,buildStrategy,buildStretchSession,buildMobilitySession,buildConditioningSession,substitutionsFor,buildProgram,validateProgram,progressionDecision};
if(typeof module!=='undefined'&&module.exports)module.exports=API;
root.GoWorkoutProgramEngine=API;
})(typeof globalThis!=='undefined'?globalThis:this);
