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
console.log('GO Workout Goal-to-Training V2: approval, integration, protection, progress and review checks passed.');
