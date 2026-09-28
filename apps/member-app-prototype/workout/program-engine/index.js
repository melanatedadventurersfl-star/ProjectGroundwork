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
 p.equipment=Array.from(new Set(['bodyweight'].concat(p.equipment||[]))); p.temporaryExclusions=p.temporaryExclusions||[]; p.exerciseHistory=p.exerciseHistory||{}; p.discomfortPatterns=p.discomfortPatterns||[];
 return p;
}
function equipmentFits(item,p){
 return (item.equipment||[]).every(eq=>eq==='bodyweight'||p.equipment.includes(eq)||eq==='wall');
}
function chooseExercise(pattern,p,used){
 const candidates=EXERCISES.filter(e=>e.pattern===pattern&&!p.exclusions.includes(e.id)&&!p.temporaryExclusions.includes(e.id)&&!(p.discomfortPatterns||[]).includes(e.pattern)&&equipmentFits(e,p));
 if(!candidates.length)return null;
 const scored=candidates.map(e=>{
   let score=100;
   if(e.goals.includes(p.goal))score+=20;
   if((p.preferences||[]).includes(e.id))score+=15;
   if(used.has(e.id))score-=25;
   if((p.priorities||[]).some(m=>e.primary.includes(m)))score+=10; const h=p.exerciseHistory?.[e.id]; if(h){score+=Math.min(12,(h.completedSessions||0)*2); if(h.lastFeedback==='discomfort')score-=50; if(h.lastFeedback==='liked')score+=8;}
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
 return {version:'1.4.0',profile:p,strategy,weeks,createdBy:'GoWorkout Program Engine v1.4'};
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
function weeklyMuscleTargets(profile){
 const p=normalizeProfile(profile), base=p.goal==='hypertrophy'?10:p.goal==='strength'?8:6;
 const targets={};
 TAXONOMY.muscles.forEach(m=>targets[m]=base);
 ['hip_flexors','adductors'].forEach(m=>targets[m]=Math.max(4,base-4));
 (p.priorities||[]).forEach(m=>{if(targets[m]!=null)targets[m]+=4});
 return targets;
}
function weeklyMuscleVolume(program,weekNumber){
 const totals={};
 const week=(program.weeks||[]).find(w=>w.week===weekNumber);
 (week?.sessions||[]).forEach(s=>(s.strength||[]).forEach(x=>{if(!x.exercise)return;const sets=x.prescription?.sets||0;(x.exercise.primary||[]).forEach(m=>totals[m]=(totals[m]||0)+sets);(x.exercise.secondary||[]).forEach(m=>totals[m]=(totals[m]||0)+sets*.5)}));
 return Object.fromEntries(Object.entries(totals).map(([k,v])=>[k,Math.round(v*10)/10]));
}
function rebalancePriorityVolume(program){
 const clone=JSON.parse(JSON.stringify(program)),targets=weeklyMuscleTargets(clone.profile);
 (clone.weeks||[]).forEach(w=>{
  const actual=weeklyMuscleVolume({weeks:[w]},w.week);
  (clone.profile.priorities||[]).forEach(m=>{
   let deficit=Math.max(0,(targets[m]||0)-(actual[m]||0));
   if(deficit<=0)return;
   const candidates=w.sessions.flatMap(s=>s.strength.map(x=>({s,x}))).filter(o=>o.x.exercise?.primary?.includes(m));
   let i=0;
   while(deficit>0&&candidates.length&&i<20){
    const o=candidates[i%candidates.length];
    if(o.x.prescription.sets<7){o.x.prescription.sets+=1;o.x.priorityVolumeAdded=(o.x.priorityVolumeAdded||0)+1;deficit-=1}
    i++;
    if(candidates.every(z=>z.x.prescription.sets>=7))break;
   }
  });
 });
 clone.volumeAudit=volumeAudit(clone);
 return clone;
}
function volumeAudit(program){
 const targets=weeklyMuscleTargets(program.profile),weeks=(program.weeks||[]).map(w=>{
  const actual=weeklyMuscleVolume(program,w.week),muscles={};
  Object.keys(targets).forEach(m=>{const a=actual[m]||0,t=targets[m];muscles[m]={target:t,actual:a,status:a<t*.7?'low':a>t*1.5?'high':'in_range'}});
  return {week:w.week,muscles};
 });
 return {targets,weeks};
}
function interpretPostWorkoutFeedback(feedback){
 const f=Object.assign({difficulty:3,energyAfter:3,pain:false,enjoyment:3},feedback||{});
 let action='none',reason='Feedback is compatible with the current prescription';
 if(f.pain){action='route_discomfort';reason='Pain/discomfort feedback should route the movement for review rather than automatic progression'}
 else if(Number(f.difficulty)>=5&&Number(f.energyAfter)<=2){action='reduce_next';reason='Very high difficulty with low post-session energy suggests reducing the next exposure'}
 else if(Number(f.difficulty)<=2&&Number(f.enjoyment)>=3){action='consider_progression';reason='Low difficulty with acceptable enjoyment supports reviewing progression'}
 return {action,reason,feedback:f};
}
function substitutionOptions(exercise,p,context){
 const profile=normalizeProfile(p),ctx=context||{};
 return EXERCISES.filter(e=>e.id!==exercise.id&&e.pattern===exercise.pattern&&!profile.exclusions.includes(e.id)&&!profile.temporaryExclusions.includes(e.id)&&equipmentFits(e,profile))
 .map(e=>{let score=100,reasons=['preserves '+exercise.pattern+' objective','works with available equipment'];if(e.group===exercise.group){score+=10;reasons.push('same substitution family')}if(ctx.reason==='discomfort'){score+=(e.difficulty<=exercise.difficulty?8:0);reasons.push('selected conservatively after discomfort report')}if(profile.preferences.includes(e.id)){score+=10;reasons.push('user preference')}return {id:e.id,name:e.name,score,reasons}})
 .sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).slice(0,4);
}
function createSchedule(program,startDate,trainingDays){
 const start=new Date((startDate||new Date().toISOString().slice(0,10))+'T12:00:00');
 const days=(trainingDays&&trainingDays.length?trainingDays:[1,3,5,6]).map(Number);
 const entries=[];let cursor=new Date(start),wi=0,si=0;
 while(wi<program.weeks.length){
  if(days.includes(cursor.getDay())){
   const session=program.weeks[wi].sessions[si];
   if(session){entries.push({id:'schedule_'+session.id,sessionId:session.id,week:wi+1,date:cursor.toISOString().slice(0,10),status:'scheduled',history:[]});si++}
   if(si>=program.weeks[wi].sessions.length){wi++;si=0}
  }
  cursor.setDate(cursor.getDate()+1);
 }
 return entries;
}
function transitionScheduleEntry(entry,status,date){
 const allowed={scheduled:['started','skipped','rescheduled'],started:['in_progress','completed'],in_progress:['paused','completed'],paused:['in_progress','completed'],skipped:['rescheduled'],rescheduled:['started','skipped','rescheduled'],completed:[]};
 if(!(allowed[entry.status]||[]).includes(status))return {ok:false,error:'Invalid schedule transition '+entry.status+' -> '+status,entry};
 const next=JSON.parse(JSON.stringify(entry));next.history.push({from:entry.status,to:status,date:date||null});next.status=status;if(status==='rescheduled'&&date)next.date=date;return {ok:true,entry:next};
}
function readinessDecision(input){
 const r=Object.assign({energy:3,sleep:3,soreness:2,stress:2},input||{});
 const clamp=n=>Math.max(1,Math.min(5,Number(n)||3));
 const energy=clamp(r.energy),sleep=clamp(r.sleep),soreness=clamp(r.soreness),stress=clamp(r.stress);
 const score=Math.round(((energy+sleep+(6-soreness)+(6-stress))/20)*100);
 let mode='normal',volumeMultiplier=1,intensityAdjustment='none';
 if(score<45){mode='recovery';volumeMultiplier=.55;intensityAdjustment='reduce load and keep 4+ reps in reserve'}
 else if(score<70){mode='reduced';volumeMultiplier=.75;intensityAdjustment='keep 3+ reps in reserve'}
 return {score,mode,volumeMultiplier,intensityAdjustment,inputs:{energy,sleep,soreness,stress},reason:mode==='normal'?'Readiness supports planned training':mode==='reduced'?'Readiness is below baseline; reduce workload':'Readiness is low; prioritize recovery-quality work'};
}
function applyReadiness(session,readiness){
 const decision=readinessDecision(readiness);
 const clone=JSON.parse(JSON.stringify(session));
 clone.readiness=decision;
 if(decision.mode!=='normal'){
  clone.strength.forEach(x=>{if(x.exercise){x.prescription.sets=Math.max(1,Math.round(x.prescription.sets*decision.volumeMultiplier));x.prescription.intensityTarget=decision.intensityAdjustment}});
 }
 return clone;
}
function muscleVolume(program){
 const totals={};
 (program.weeks||[]).forEach(w=>(w.sessions||[]).forEach(s=>(s.strength||[]).forEach(x=>{
  if(!x.exercise)return;
  const sets=x.prescription?.sets||0;
  (x.exercise.primary||[]).forEach(m=>totals[m]=(totals[m]||0)+sets);
  (x.exercise.secondary||[]).forEach(m=>totals[m]=(totals[m]||0)+sets*.5);
 })));
 return Object.fromEntries(Object.entries(totals).map(([k,v])=>[k,Math.round(v*10)/10]));
}
function ingestPerformance(session,performed){
 const entries=(performed?.exercises||[]).map(e=>{
  const planned=(session.strength||[]).find(x=>x.exercise?.id===e.exerciseId);
  if(!planned)return {exerciseId:e.exerciseId,status:'unplanned',sets:e.sets||[]};
  const completed=(e.sets||[]).filter(s=>s.completed!==false);
  const targetSets=planned.prescription.sets;
  const avgReps=completed.length?completed.reduce((n,s)=>n+(Number(s.reps)||0),0)/completed.length:0;
  return {exerciseId:e.exerciseId,status:'planned',targetSets,completedSets:completed.length,completionRate:targetSets?Math.round(completed.length/targetSets*100):0,averageReps:Math.round(avgReps*10)/10,sets:completed};
 });
 const plannedIds=(session.strength||[]).filter(x=>x.exercise).map(x=>x.exercise.id);
 const completedIds=new Set(entries.filter(x=>x.status==='planned'&&x.completedSets>0).map(x=>x.exerciseId));
 const adherence=plannedIds.length?Math.round(completedIds.size/plannedIds.length*100):100;
 return {sessionId:session.id,completedAt:performed?.completedAt||null,entries,adherence,feedback:performed?.feedback||{},source:'performance_ingestion_v1'};
}
function compressSession(session,availableMinutes){
 const clone=JSON.parse(JSON.stringify(session));
 const minutes=Math.max(10,Number(availableMinutes)||clone.estimatedMinutes||30);
 const warm=clone.timeBudget?.warmupMinutes||5,stretch=Math.min(clone.timeBudget?.stretchMinutes||5,minutes<=25?5:clone.timeBudget?.stretchMinutes||5);
 let budget=Math.max(5,minutes-warm-stretch),used=0;
 clone.strength.forEach((x,i)=>{
  if(!x.exercise){x.compressionStatus='unfilled';return}
  const setCost=(x.prescription.restSeconds+45)/60;
  const fullCost=x.prescription.sets*setCost;
  if(used+fullCost<=budget){x.compressionStatus='full';used+=fullCost;return}
  if(i<3){const remaining=Math.max(0,budget-used);const fit=Math.floor(remaining/setCost);if(fit>0){x.prescription.sets=Math.min(x.prescription.sets,fit);x.compressionStatus='reduced';used+=x.prescription.sets*setCost;return} if(i===2&&used>0){const donor=clone.strength.slice(0,2).reverse().find(y=>y.exercise&&y.prescription.sets>1);if(donor){donor.prescription.sets-=1;used-=((donor.prescription.restSeconds+45)/60);if(used+setCost<=budget){x.prescription.sets=1;x.compressionStatus='minimum_priority';used+=setCost;return}}}}
  x.prescription.sets=0;x.compressionStatus='removed_for_time';
 });
 clone.stretch=buildStretchSession(stretch<=5?5:stretch,clone.label,{equipment:['bodyweight','wall','bench']});
 clone.compressedFromMinutes=session.estimatedMinutes;
 clone.estimatedMinutes=minutes;
 clone.compression={availableMinutes:minutes,strengthBudgetMinutes:Math.round(budget*10)/10,estimatedUsedMinutes:Math.round(used*10)/10,principle:'preserve highest-priority movements before accessory work'};
 return clone;
}
function adaptationDecision(program,performanceRecords,readinessRecords){
 const records=performanceRecords||[], readiness=readinessRecords||[];
 const avgAdherence=records.length?records.reduce((n,r)=>n+(r.adherence||0),0)/records.length:100;
 const lowReadiness=readiness.filter(r=>readinessDecision(r).mode!=='normal').length;
 const ratio=readiness.length?lowReadiness/readiness.length:0;
 let action='continue',reason='Adherence and readiness support the current strategy',volumeMultiplier=1;
 if(avgAdherence<60){action='simplify';volumeMultiplier=.8;reason='Low adherence suggests the current program demand is too high'}
 else if(ratio>=.5){action='reduce';volumeMultiplier=.85;reason='Repeated reduced readiness suggests accumulated recovery demand'}
 else if(avgAdherence>=90&&records.length>=4){action='progress';volumeMultiplier=1.05;reason='High adherence supports a modest next-block progression'}
 return {action,reason,volumeMultiplier,averageAdherence:Math.round(avgAdherence),lowReadinessRate:Math.round(ratio*100)};
}
function createProgramVersion(program,adaptation){
 const next=JSON.parse(JSON.stringify(program));
 const current=String(program.version||'1.0.0').split('.').map(Number);
 current[1]=(current[1]||0)+1;current[2]=0;
 next.version=current.join('.');
 next.parentVersion=program.version;
 next.versionReason=adaptation?.reason||'Program revision';
 next.previousProgramSnapshot={version:program.version,createdBy:program.createdBy};
 next.createdBy='GoWorkout Program Engine '+next.version;
 const multiplier=adaptation?.volumeMultiplier||1;
 next.weeks.forEach(w=>w.sessions.forEach(s=>s.strength.forEach(x=>{if(x.exercise)x.prescription.sets=Math.max(1,Math.round(x.prescription.sets*multiplier))})));
 return next;
}
const EXECUTION_STATES=['scheduled','preparing','warmup','active','resting','paused','stretching','completed','exited_resumable'];
function createWorkoutExecution(session){
 const strength=(session.strength||[]).filter(x=>x.exercise).map((x,index)=>({
  index,exerciseId:x.exercise.id,name:x.exercise.name,prescription:JSON.parse(JSON.stringify(x.prescription)),
  originalExerciseId:x.exercise.id,sets:Array.from({length:x.prescription.sets},(_,i)=>({index:i+1,reps:null,weight:null,completed:false,completedAt:null})),
  substitutions:x.substitutions||[],status:'pending'
 }));
 return {schemaVersion:1,sessionId:session.id,state:'scheduled',phase:'scheduled',warmupIndex:0,exerciseIndex:0,stretchIndex:0,strength,startedAt:null,completedAt:null,pausedAt:null,rest:null,eventLog:[],revision:0};
}
function executionTransition(execution,next,meta){
 const allowed={scheduled:['preparing'],preparing:['warmup','active','exited_resumable'],warmup:['warmup','active','paused','exited_resumable'],active:['active','resting','stretching','paused','exited_resumable'],resting:['active','paused','exited_resumable'],paused:['warmup','active','resting','stretching','exited_resumable'],stretching:['stretching','completed','paused','exited_resumable'],exited_resumable:['preparing'],completed:[]};
 if(!(allowed[execution.state]||[]).includes(next))return {ok:false,error:'Invalid execution transition '+execution.state+' -> '+next,execution};
 const e=JSON.parse(JSON.stringify(execution)),now=meta?.at||null;
 e.eventLog.push({type:'state',from:e.state,to:next,at:now});e.state=next;e.revision++;
 if(next==='preparing'&&!e.startedAt)e.startedAt=now;
 if(next==='paused')e.pausedAt=now;
 if(next==='warmup')e.phase='warmup';
 if(next==='active')e.phase='strength';
 if(next==='stretching')e.phase='stretch';
 if(next==='completed'){e.phase='completed';e.completedAt=now;e.rest=null}
 return {ok:true,execution:e};
}
function recordSet(execution,exerciseIndex,setIndex,data){
 const e=JSON.parse(JSON.stringify(execution)),ex=e.strength[exerciseIndex],set=ex?.sets?.[setIndex];
 if(!set)return {ok:false,error:'Set not found',execution};
 if(!['active','resting'].includes(e.state))return {ok:false,error:'Sets can only be recorded during active strength work',execution};
 set.reps=data?.reps==null?set.reps:Number(data.reps);set.weight=data?.weight==null?set.weight:Number(data.weight);set.completed=data?.completed!==false;set.completedAt=data?.at||null;
 ex.status=ex.sets.every(s=>s.completed)?'completed':'in_progress';e.exerciseIndex=exerciseIndex;e.revision++;e.eventLog.push({type:'set_recorded',exerciseId:ex.exerciseId,set:setIndex+1,at:data?.at||null});
 return {ok:true,execution:e};
}
function startRest(execution,seconds,atMs){
 if(execution.state!=='active')return {ok:false,error:'Rest can only start from active state',execution};
 const e=JSON.parse(JSON.stringify(execution)),duration=Math.max(0,Number(seconds)||0),start=Number(atMs)||0;
 e.state='resting';e.rest={durationSeconds:duration,startedAtMs:start,endsAtMs:start+duration*1000};e.revision++;e.eventLog.push({type:'rest_started',seconds:duration,atMs:start});
 return {ok:true,execution:e};
}
function restRemaining(execution,nowMs){
 if(!execution.rest)return 0;
 return Math.max(0,Math.ceil((execution.rest.endsAtMs-Number(nowMs))/1000));
}
function finishRest(execution,nowMs){
 if(execution.state!=='resting')return {ok:false,error:'Not resting',execution};
 if(restRemaining(execution,nowMs)>0)return {ok:false,error:'Rest timer has not finished',execution};
 const e=JSON.parse(JSON.stringify(execution));e.state='active';e.rest=null;e.revision++;e.eventLog.push({type:'rest_finished',atMs:Number(nowMs)});return {ok:true,execution:e};
}
function previewNextExercise(execution){
 const current=execution.exerciseIndex,next=execution.strength[current+1];
 return next?{exerciseId:next.exerciseId,name:next.name,prescription:JSON.parse(JSON.stringify(next.prescription)),previewOnly:true}:null;
}
function navigateExercise(execution,index){
 const i=Number(index);
 if(i<0||i>=execution.strength.length)return {ok:false,error:'Exercise index out of range',execution};
 const e=JSON.parse(JSON.stringify(execution));e.exerciseIndex=i;e.revision++;e.eventLog.push({type:'navigate',exerciseIndex:i});return {ok:true,execution:e};
}
function canAdvanceExercise(execution){
 const ex=execution.strength[execution.exerciseIndex];
 return !!ex&&ex.sets.length>0&&ex.sets.every(s=>s.completed);
}
function advanceExercise(execution){
 if(!canAdvanceExercise(execution))return {ok:false,error:'Current exercise still has incomplete sets',execution};
 const e=JSON.parse(JSON.stringify(execution));
 if(e.exerciseIndex<e.strength.length-1){e.exerciseIndex++;e.state='active';e.rest=null;e.revision++;e.eventLog.push({type:'exercise_advanced',exerciseIndex:e.exerciseIndex});return {ok:true,execution:e,finishedStrength:false}}
 e.state='stretching';e.phase='stretch';e.rest=null;e.revision++;e.eventLog.push({type:'strength_completed'});return {ok:true,execution:e,finishedStrength:true};
}
function substituteDuringWorkout(execution,replacement,reason){
 if(!['active','resting'].includes(execution.state))return {ok:false,error:'Substitution unavailable outside active strength work',execution};
 const e=JSON.parse(JSON.stringify(execution)),ex=e.strength[e.exerciseIndex];
 if(!ex)return {ok:false,error:'Current exercise not found',execution};
 const completed=ex.sets.filter(s=>s.completed).length;
 ex.substitutionHistory=ex.substitutionHistory||[];ex.substitutionHistory.push({from:ex.exerciseId,to:replacement.id,reason:reason||'user_choice',afterCompletedSets:completed});
 ex.exerciseId=replacement.id;ex.name=replacement.name;ex.status=completed?'in_progress':'pending';e.state='active';e.rest=null;e.revision++;e.eventLog.push({type:'substitution',to:replacement.id,reason:reason||'user_choice'});
 return {ok:true,execution:e};
}
function executionSnapshot(execution){
 return JSON.parse(JSON.stringify(execution));
}
function resumeExecution(snapshot){
 const e=executionSnapshot(snapshot);
 if(e.state!=='exited_resumable'&&e.state!=='paused')return {ok:false,error:'Execution is not resumable',execution:e};
 e.state=e.phase==='warmup'?'warmup':e.phase==='stretch'?'stretching':'active';e.revision++;e.eventLog.push({type:'resumed'});return {ok:true,execution:e};
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

const API={TAXONOMY,EXERCISES,STRETCHES,MOBILITY,CONDITIONING,WEEK_MODELS,EXECUTION_STATES,normalizeProfile,buildStrategy,buildStretchSession,buildMobilitySession,buildConditioningSession,substitutionsFor,substitutionOptions,weeklyMuscleTargets,weeklyMuscleVolume,volumeAudit,rebalancePriorityVolume,interpretPostWorkoutFeedback,createSchedule,transitionScheduleEntry,buildProgram,validateProgram,readinessDecision,applyReadiness,muscleVolume,ingestPerformance,compressSession,adaptationDecision,createProgramVersion,createWorkoutExecution,executionTransition,recordSet,startRest,restRemaining,finishRest,previewNextExercise,navigateExercise,canAdvanceExercise,advanceExercise,substituteDuringWorkout,executionSnapshot,resumeExecution,progressionDecision};
if(typeof module!=='undefined'&&module.exports)module.exports=API;
root.GoWorkoutProgramEngine=API;
})(typeof globalThis!=='undefined'?globalThis:this);
