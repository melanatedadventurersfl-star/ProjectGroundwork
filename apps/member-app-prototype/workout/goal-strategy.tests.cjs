/* Goal-to-Training V2 regression tests. Run with node goal-strategy.tests.cjs. */
'use strict';
const assert=require('node:assert/strict');
global.window={setInterval(){}};
global.document={querySelector(){return null;}};
global.confirm=()=>true;
const G=require('./goal-lab.js');
require('./goal-strategy.js');
const S=window.GoWorkoutGoalStrategy;
const catalog=[
 {id:'push-up',name:'Push-Up',movement:'horizontal-push',muscles:['Chest'],equipment:['bodyweight'],loadMode:'bodyweight'},
 {id:'plank',name:'Plank',movement:'core',muscles:['Core'],equipment:['bodyweight'],loadMode:'timed'},
 {id:'bodyweight-squat',name:'Squat',movement:'squat',muscles:['Quads'],equipment:['bodyweight'],loadMode:'bodyweight'},
 {id:'dead-bug',name:'Dead Bug',movement:'core',muscles:['Core'],equipment:['bodyweight'],loadMode:'bodyweight'}
];
const profile={days:3,minutes:30,equipment:'bodyweight',avoid:[]};
const plan={id:'four-week-plan-01',days:[]};
const training={},originalDay={id:'day-1',name:'Strength',focus:'Full body',estimatedMinutes:30,exercises:[
 {id:'dead-bug',name:'Dead Bug',sets:2,reps:'8',loadMode:'bodyweight'}
]};
const goal=(kind,value,target,variation)=>{
 const run=(action,data={})=>G.action(training,action,{dataset:data});
 run('new',{mode:'target'});run('template',{kind});run('choose-next');
 if(target)G.field(training,'target',String(target));
 run('target-next');
 if(variation)G.field(training,'variant',variation);
 if(kind==='plank')G.field(training,'result',value);
 else for(let i=0;i<value;i++)run('count-up');
 run('assessment-done');run('feedback-next');run('save-goal');
 return training.goalLab.goals.at(-1);
};
const push=goal('pushup',8,60),plank=goal('plank',22,60);
assert.equal(S.ensure(training).status,'inactive');
assert.equal(S.applyDay(training,originalDay,catalog,profile,{plan}),originalDay,'Do not modify workouts before approval');
const doIt=(name,data={})=>S.action(training,name,{dataset:data},{profile,plan,catalog,history:[]});
doIt('strategy-open');
assert.equal(S.ensure(training).draft.mode,'integrate');
assert.equal(doIt('strategy-preview').changed,true);
const proposal=S.preview(training,profile,plan,catalog);
assert.equal(proposal.additions.length,2);
assert.match(S.panel(training,profile,plan,catalog,[]),/APPROVE STRATEGY/);
doIt('strategy-approve');
assert.equal(S.current(training,profile,plan),true);
assert.equal(training.goalLab.strategy.revisions.length,1);
const originalSnapshot=JSON.stringify(originalDay),approved=S.applyDay(training,originalDay,catalog,profile,{plan,minutes:30,energy:4,sleep:4,soreness:2});
assert.equal(JSON.stringify(originalDay),originalSnapshot,'Saved plan day may never mutate');
assert.deepEqual(approved.exercises.map(ex=>ex.id),['dead-bug','push-up','plank']);
assert.equal(approved.exercises[1].sets,2);
assert.equal(approved.exercises[2].loadMode,'timed');
assert.equal(S.applyDay(training,approved,catalog,profile,{plan}).exercises.length,3,'Avoid double adding goal work');
assert.equal(S.applyDay(training,originalDay,catalog,profile,{plan,minutes:15}),originalDay);
assert.equal(S.applyDay(training,originalDay,catalog,profile,{plan,soreness:4}),originalDay);
assert.equal(S.applyDay(training,originalDay,catalog,profile,{plan,shared:true}),originalDay);
assert.equal(S.applyDay(training,originalDay,catalog,profile,{plan,minutes:30,allowExercise:()=>false}),originalDay,
 'Do not add goal exercises the current training equipment cannot support');
const withSameExercise={...originalDay,exercises:[...originalDay.exercises,{...catalog[0],sets:3}]};
assert.equal(S.applyDay(training,withSameExercise,catalog,profile,{plan}).exercises.filter(ex=>ex.id==='push-up').length,1,
 'Never duplicate an exercise already in a planned session');

// Actual training sets are evidence of training, never of completing a maximum-reps goal.
const entry={id:'session-1',completedAt:new Date().toISOString(),completionStatus:'complete',exercises:[
 {id:'push-up',sets:[{completed:true,reps:12},{completed:true,reps:10},{completed:false,reps:60}]},
 {id:'plank',sets:[{completed:true,reps:16}]}
]};
assert.equal(G.afterWorkout(training,entry),true);
assert.equal(push.trainingBest,12);
assert.equal(push.best,8,'Training reps must not be treated as continuous test proof');
assert.equal(G.assessmentBest(push),8);
assert.equal(S.onWorkout(training,entry),true);
assert.equal(S.onWorkout(training,entry),false,'Do not duplicate workout logs');
assert.equal(training.goalLab.strategy.trainingLog[0].results.length,2);
assert.equal(training.goalLab.strategy.trainingLog[0].results[0].totalTrainingVolume,22);
assert.equal(S.weekly(training,[entry],profile,plan).sessions,1);
assert.equal(S.weekly(training,[entry],profile,plan).goalSets,3);
assert.equal(S.applyDay(training,originalDay,catalog,profile,{plan,minutes:30}),originalDay,
 'Do not repeat recent goal work within 40 hours');
const context={profile,plan,catalog,history:[entry]};
const choice=(field,value)=>S.action(training,'strategy-checkin-choice',{dataset:{workoutId:entry.id,field,value}},context);
choice('effort','hard');choice('limitation','fatigue');
const saved=S.action(training,'strategy-checkin-save',{dataset:{workoutId:entry.id}},context);
assert.equal(saved.changed,true);
assert.equal(training.goalLab.strategy.checkIns.length,1);
assert.match(S.panel(training,profile,plan,catalog,[entry]),/Latest workout check-in/);
assert.equal(S.action(training,'strategy-checkin-save',{dataset:{workoutId:'not-a-real-workout'}},context).changed,false);

// New goals or profile changes must require another explicit approval.
const squat=goal('squat',10,25);
assert.equal(S.current(training,profile,plan),false);
assert.equal(S.applyDay(training,originalDay,catalog,profile,{plan}),originalDay);
doIt('strategy-open');doIt('strategy-preview');doIt('strategy-approve');
assert.equal(S.current(training,profile,plan),true);
const changedProfile={...profile,minutes:45};
assert.equal(S.current(training,changedProfile,plan),false);
assert.equal(S.applyDay(training,originalDay,catalog,changedProfile,{plan}),originalDay);

// Assisted variations cannot receive standard exercises even if prioritized.
const nonstandard={};
const a=(name,data={})=>G.action(nonstandard,name,{dataset:data});
a('new',{mode:'target'});a('template',{kind:'pushup'});a('choose-next');a('target-next');
G.field(nonstandard,'variant','Wall push-up');
for(let i=0;i<10;i++)a('count-up');
a('assessment-done');a('feedback-next');a('save-goal');
const wall=nonstandard.goalLab.goals[0];
const opts={profile,plan,catalog,history:[]};
S.action(nonstandard,'strategy-open',{dataset:{}},opts);
S.action(nonstandard,'strategy-preview',{dataset:{}},opts);
assert.equal(S.preview(nonstandard,profile,plan,catalog).additions.length,0);
assert.equal(S.action(nonstandard,'strategy-approve',{dataset:{}},opts).changed,false);
S.action(nonstandard,'strategy-mode',{dataset:{mode:'track'}},opts);
S.action(nonstandard,'strategy-preview',{dataset:{}},opts);
assert.equal(S.action(nonstandard,'strategy-approve',{dataset:{}},opts).changed,true);
assert.equal(S.applyDay(nonstandard,originalDay,catalog,profile,{plan}),originalDay);
assert.equal(wall.best,10);

// Maintenance is earned by comparable discovery assessments, not by training sets.
assert.equal(S.action(training,'strategy-maintain',{dataset:{goalId:push.id}},context).changed,false);
G.action(training,'retest',{dataset:{goalId:push.id}});
for(let i=0;i<60;i++)G.action(training,'count-up',{dataset:{}});
G.action(training,'assessment-done',{dataset:{}});
G.action(training,'feedback-next',{dataset:{}});
G.action(training,'save-goal',{dataset:{}});
assert.equal(G.assessmentBest(push),60);
assert.equal(S.current(training,profile,plan),false,'A new confirmed baseline requires strategy approval before changes');
assert.equal(S.action(training,'strategy-maintain',{dataset:{goalId:push.id}},context).changed,true);
assert.equal(push.status,'maintenance');
assert.equal(S.current(training,profile,plan),false);
assert.equal(S.action(training,'strategy-reactivate',{dataset:{goalId:push.id}},context).changed,true);
assert.equal(push.status,'active');
assert.ok(squat);

// Home hierarchy regression: daily workout stays above the single Goals panel.
// A compact, scrollable multi-goal card replaces both old competing banners.
const fs=require('node:fs');
const path=require('node:path');
const appSource=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
const homeStart=appSource.indexOf('function renderHome(){');
const homeEnd=appSource.indexOf('\nfunction ',homeStart+1);
const homeBody=appSource.slice(homeStart,homeEnd);
const journey=homeBody.indexOf('renderHomeProgramJourney(context)');
const daily=homeBody.indexOf("'<section class=\"home-state-hero");
const unifiedGoals=homeBody.indexOf('GoWorkoutGoalStrategy.homePanel(');
const weekly=homeBody.indexOf("'<section class=\"clean-section home-week-section");
assert.ok(journey>=0&&journey<daily&&daily<unifiedGoals&&unifiedGoals<weekly,
  'Weekly phase, daily workout, unified goals, then weekly stats must display in that order');
assert.ok(!homeBody.includes("GoWorkoutGoalLab.shortcuts("),'No duplicate standalone Goals card above the daily workout');
assert.ok(!homeBody.includes("GoWorkoutGoalStrategy.teaser("),'No duplicate light strategy banner');
assert.match(appSource,/goalButton\.dataset\.goalAction==='strategy-open'&&currentTab!=='goals'/,
  'Home strategy CTA must open the actual Goals strategy editor');
const goalsHome=S.homePanel(training,profile,plan);
assert.match(goalsHome,/home-goals-panel/);
assert.match(goalsHome,/PERSONAL GOALS/);
assert.match(goalsHome,/BUILD MY TRAINING STRATEGY|ADJUST TRAINING STRATEGY|REVIEW MY STRATEGY/);
assert.match(goalsHome,/VIEW ALL GOALS/);
assert.equal((goalsHome.match(/class="home-goal-item"/g)||[]).length,training.goalLab.goals.length,
  'All saved goals remain accessible in horizontal scroll');
const style=fs.readFileSync(path.join(__dirname,'goal-strategy.css'),'utf8');
assert.match(style,/\.home-goals-panel\{/);
assert.match(style,/\.home-goals-primary/);
assert.match(style,/\.home-goals-track\{[^}]*overflow-x:auto/);

// Visual regression: the dark shell text token must not bleed into light cards.
const goalLabStyle=fs.readFileSync(path.join(__dirname,'goal-lab.css'),'utf8');
const goalsHtml=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
assert.ok(goalLabStyle.includes('.goal-empty,.goal-how,.goal-wizard,.goal-detail{background:#f9fbf8;color:#17392b'),
  'Discovery and goal detail cards need explicit dark text on light surfaces');
assert.ok(style.includes('background:#f7faf6;color:#173629'),
  'Strategy and weekly review cards need explicit high-contrast foregrounds');
assert.ok(style.includes('.goal-strategy-panel .goal-strategy-modes button'),
  'Unselected strategy choices must remain readable');
assert.ok(style.includes('#app > .goal-strategy-review:last-child'),
  'The final goal-review panel must clear bottom navigation and safe areas');
assert.ok(goalsHtml.includes('goal-lab.css?v=20261010-contrast-fix'));
assert.match(goalsHtml,/goal-strategy\.css\?v=20261012-goal-engine-v3/);
assert.match(goalsHtml,/goal-strategy\.js\?v=20261012-goal-engine-v3/);
assert.match(style,/\.goal-impact-panel/);
assert.match(S.panel(training,profile,plan,catalog,[]),/See what your baseline changes/);
assert.match(S.panel(training,profile,plan,catalog,[]),/Did the workout change\?/);
const markedWorkout={id:'goal-added',completionStatus:'complete',exercises:[{id:'push-up',goalStrategyId:push.id,skipped:false}]};
assert.match(S.panel(training,profile,plan,catalog,[markedWorkout]),/Recorded goal additions in 1 workout/);


// Explainable adaptive training: baseline-only changes can refresh approved
// goal prescriptions in Smart mode, but not in Review mode.
const Adaptive=require('./training-intelligence.js');
const adaptiveTraining={};
const create=(name,data={})=>G.action(adaptiveTraining,name,{dataset:data});
create('new',{mode:'target'});create('template',{kind:'pushup'});create('choose-next');create('target-next');
for(let i=0;i<8;i++)create('count-up');
create('assessment-done');create('feedback-next');create('save-goal');
const adaptiveGoal=adaptiveTraining.goalLab.goals[0];
const review=(action,data={})=>S.action(adaptiveTraining,action,{dataset:data},{profile,plan,catalog,history:[]});
review('strategy-open');review('strategy-preview');review('strategy-approve');
assert.equal(S.current(adaptiveTraining,profile,plan),true);
assert.equal(Adaptive.mode(adaptiveTraining),'smart');
assert.equal(Adaptive.eligibleSlot(0,0,3),true);
assert.equal(Adaptive.eligibleSlot(0,1,3),false);
assert.equal(Adaptive.eligibleSlot(0,2,3),true);
assert.equal(Adaptive.eligibleSlot(1,1,3),true);
assert.equal(Adaptive.eligibleSlot(2,1,3),false);
const beforeBaseline=Adaptive.snapshot(adaptiveTraining,profile,plan);
create('retest',{goalId:adaptiveGoal.id});
for(let i=0;i<12;i++)create('count-up');
create('assessment-done');create('feedback-next');create('save-goal');
assert.equal(G.assessmentBest(adaptiveGoal),12);
assert.equal(S.current(adaptiveTraining,profile,plan),false);
assert.equal(Adaptive.afterGoalAction(beforeBaseline,adaptiveTraining,profile,plan,catalog),true);
assert.equal(S.current(adaptiveTraining,profile,plan),true,'Smart mode keeps approved strategy current for comparable assessments');
assert.equal(Adaptive.ensure(adaptiveTraining).notices[0].status,'auto');
assert.match(Adaptive.notices(adaptiveTraining),/Your workout evolved/);
assert.match(Adaptive.why(adaptiveTraining,profile,plan,catalog,
  {index:0,day:{name:'Upper',focus:'Strength',exercises:[]}}),/Verified 12 reps/);
assert.equal(Adaptive.setMode(adaptiveTraining,'review'),true);
const beforeReview=Adaptive.snapshot(adaptiveTraining,profile,plan);
create('retest',{goalId:adaptiveGoal.id});
for(let i=0;i<15;i++)create('count-up');
create('assessment-done');create('feedback-next');create('save-goal');
assert.equal(Adaptive.afterGoalAction(beforeReview,adaptiveTraining,profile,plan,catalog),true);
assert.equal(S.current(adaptiveTraining,profile,plan),false,'Review mode requires approval');
assert.equal(Adaptive.ensure(adaptiveTraining).notices[0].status,'review');
assert.match(Adaptive.preferences(adaptiveTraining),/Review Changes/);
const approvedToday=S.applyDay(adaptiveTraining,originalDay,catalog,profile,{plan,minutes:30,dayIndex:0});
assert.equal(approvedToday,originalDay,'Pending approval cannot change workout');
const stableConstraints=Adaptive.snapshot(adaptiveTraining,profile,plan);
adaptiveGoal.target=35;
assert.equal(Adaptive.afterGoalAction(stableConstraints,adaptiveTraining,profile,plan,catalog),false,'Changing target is never silent baseline progression');
assert.equal(S.current(adaptiveTraining,profile,plan),false);
assert.match(Adaptive.goalsSummary(adaptiveTraining,profile,plan,catalog,[]),/multiple goals/i);
assert.match(goalsHtml,/training-intelligence.js\?v=20261012-intelligence-v1/);
assert.match(goalsHtml,/training-intelligence.css\?v=20261012-intelligence-v1/);
assert.match(appSource,/adaptive-preview-tab/);
assert.match(appSource,/GoWorkoutAdaptiveExperience.scheduleBadge/);
assert.match(appSource,/GoWorkoutAdaptiveExperience.afterGoalAction/);
assert.match(style,/\.goal-impact-panel/);
const adaptiveCss=fs.readFileSync(path.join(__dirname,'training-intelligence.css'),'utf8');
assert.match(adaptiveCss,/\.adaptive-preferences/);
assert.match(adaptiveCss,/\.adaptive-compare-day/);

console.log('GO Workout Goal-to-Training V2: approval, integration, protection, progress and review checks passed.');



// Goal Engine V3: distance measurements, custom-goal recovery, and consent.
const legacyTraining={};
const legacyRun=(name,dataset={})=>G.action(legacyTraining,name,{dataset});
legacyRun('new',{mode:'target'});
legacyRun('template',{kind:'custom'});legacyRun('choose-next');
G.field(legacyTraining,'label','Row machine 2k');legacyRun('target-next');
for(let i=0;i<6;i++)legacyRun('count-up');
legacyRun('assessment-done');legacyRun('feedback-next');legacyRun('save-goal');
const legacyGoal=legacyTraining.goalLab.goals[0];
assert.equal(legacyGoal.unit,'reps');
assert.match(G.render(legacyTraining),/SET UP MEASURED ROWING GOAL/);
legacyRun('setup-rowing');
assert.equal(legacyTraining.goalLab.draft.kind,'row');
assert.equal(legacyTraining.goalLab.draft.unit,'meters');
assert.equal(legacyGoal.baseline,6,'Old recorded reps must not become meters');
assert.equal(legacyTraining.goalLab.goals.length,1,'New setup does not erase older goal');

const rowTraining={};
const rowAction=(name,dataset={})=>G.action(rowTraining,name,{dataset});
rowAction('new',{mode:'target'});rowAction('template',{kind:'row'});
rowAction('choose-next');rowAction('target-next');
G.field(rowTraining,'result','750');rowAction('assessment-done');
rowAction('feedback-next');rowAction('save-goal');
const row=rowTraining.goalLab.goals[0];
assert.equal(row.kind,'row');
assert.equal(row.unit,'meters');
assert.equal(row.target,2000);
assert.equal(G.assessmentBest(row),750);
assert.equal(G.isRunnableGoal(row),false,'A meter-based goal is not a rep workout');
assert.match(G.recommendations(row).summary,/not substitutes/);
const rowCtx={profile,plan,catalog,history:[]};
const rowPlan=(name,dataset={})=>S.action(rowTraining,name,{dataset},rowCtx);
rowPlan('strategy-open');rowPlan('strategy-preview');
const rowPreview=S.preview(rowTraining,profile,plan,catalog);
assert.equal(rowPreview.additions.length,0,'Do not substitute cable or dumbbell rows');
assert.equal(rowPreview.guided.length,1,'Recognized rowing goal has measured guidance');
assert.equal(rowPlan('strategy-approve').changed,false,'No false automatic rowing support');
rowPlan('strategy-mode',{mode:'focused'});rowPlan('strategy-preview');
assert.equal(rowPlan('strategy-approve').changed,false,'Confirm machine access before enabling guided rowing');
rowPlan('strategy-rower-access',{value:'yes'});rowPlan('strategy-preview');
assert.match(S.panel(rowTraining,profile,plan,catalog,[]),/Measured rowing guidance/);
assert.match(S.panel(rowTraining,profile,plan,catalog,[]),/not appear as executable sets/);
assert.equal(rowPlan('strategy-approve').changed,true);
assert.equal(S.current(rowTraining,profile,plan),true);
assert.equal(S.applyDay(rowTraining,originalDay,catalog,profile,{plan}),originalDay,
  'Guided rowing is not falsely scheduled as a runner exercise');
assert.match(S.panel(rowTraining,profile,plan,catalog,[]),/Baseline recorded/);
assert.match(S.panel(rowTraining,profile,plan,catalog,[]),/750 m/);

// Reassessment evidence changes only after a new comparable test.
rowAction('retest',{goalId:row.id});
G.field(rowTraining,'result','900');
rowAction('assessment-done');rowAction('feedback-next');rowAction('save-goal');
assert.equal(row.baseline,750);
assert.equal(G.assessmentBest(row),900);
assert.match(S.panel(rowTraining,profile,plan,catalog,[]),/Improving/);
assert.equal(S.current(rowTraining,profile,plan),false,'New test awaits strategy refresh');

// New opt-out for workout extensions must prevent unrequested additions.
const timeTraining={};
const timeRun=(name,dataset={})=>G.action(timeTraining,name,{dataset});
timeRun('new',{mode:'target'});timeRun('template',{kind:'pushup'});timeRun('choose-next');timeRun('target-next');
for(let i=0;i<10;i++)timeRun('count-up');
timeRun('assessment-done');timeRun('feedback-next');timeRun('save-goal');
const timePlan=(name,dataset={})=>S.action(timeTraining,name,{dataset},{profile,plan,catalog,history:[]});
timePlan('strategy-open');timePlan('strategy-extension',{value:'no'});
timePlan('strategy-preview');timePlan('strategy-approve');
const fullDay={...originalDay,estimatedMinutes:30};
assert.equal(S.applyDay(timeTraining,fullDay,catalog,profile,{plan,minutes:30}),fullDay,
  'Hard time limit prevents goal work from silently extending a full workout');
assert.equal(S.ensure(timeTraining).allowExtension,false);
assert.match(S.panel(timeTraining,profile,plan,catalog,[]),/Baseline recorded/);
