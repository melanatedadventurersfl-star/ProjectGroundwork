/* Run: node apps/member-app-prototype/workout/goal-lab.test.js */
'use strict';
const assert = require('node:assert/strict');
global.window = { setInterval() {} };
global.document = { querySelector() { return null; } };
global.confirm = () => true;
const goals = require('./goal-lab.js');
const state = {};
const click = (action, dataset={}) => goals.action(state, action, {dataset});

click('new',{mode:'target'});
click('template',{kind:'pushup'});
click('choose-next');
assert.equal(state.goalLab.draft.stage,'target');
goals.field(state,'target',60);
click('target-next');
for(let i=0;i<8;i++)click('count-up');
click('assessment-done');
assert.equal(state.goalLab.draft.stage,'feedback');
click('effort',{effort:'challenging'});
click('feedback-next');
click('save-goal');
assert.equal(state.goalLab.goals.length,1);
const id=state.goalLab.goals[0].id;
assert.equal(state.goalLab.goals[0].baseline,8);
assert.equal(state.goalLab.goals[0].best,8);
assert.equal(state.goalLab.goals[0].target,60);

click('retest',{goalId:id});
for(let i=0;i<12;i++)click('count-up');
click('assessment-done');
click('feedback-next');
click('save-goal');
assert.equal(state.goalLab.goals[0].best,12);
assert.equal(state.goalLab.goals[0].assessments.length,2);

click('edit',{goalId:id});
goals.field(state,'target',80);
click('target-next');
click('save-goal');
assert.equal(state.goalLab.goals[0].target,80);
assert.equal(state.goalLab.goals[0].assessments.length,2,'target edit must not invent an assessment');

click('retest',{goalId:id});
goals.field(state,'variant','Wall push-up');
for(let i=0;i<40;i++)click('count-up');
click('assessment-done');
click('feedback-next');
click('save-goal');
assert.equal(state.goalLab.goals[0].best,12,'incomparable variation must not become new best');
assert.equal(state.goalLab.goals[0].assessments.length,3);

const trained = goals.afterWorkout(state,{
  id:'session-1',completedAt:new Date().toISOString(),exercises:[
    {id:'push-up',sets:[{reps:16,completed:true},{reps:20,completed:false},{reps:14,completed:true}]}
  ]
});
assert.equal(trained,true);
assert.equal(state.goalLab.goals[0].best,12,'Completed training sets cannot verify a continuous goal maximum');
assert.equal(state.goalLab.goals[0].trainingBest,16,'Training record uses largest completed set');
assert.equal(state.goalLab.goals[0].assessments.length,3,'Workout sets are not mislabeled as assessments');
assert.equal(goals.afterWorkout(state,{id:'session-2',exercises:[{id:'push-up',sets:[{reps:10,completed:true}]}]}),false);
const generated=goals.buildGoalDay(state,{length:0,find(){return null}},{equipment:'bodyweight',minutes:30});
assert.equal(generated,null,'unavailable catalog movements should not produce a workout');
assert.match(goals.render(state),/PERSONAL BEST/);

const cloned=JSON.parse(JSON.stringify(state));
assert.equal(cloned.goalLab.goals[0].best,12,'verified goal results survive serialization');
assert.equal(cloned.goalLab.goals[0].trainingBest,16,'training-set records survive serialization');

click('new',{mode:'discover'});
click('template',{kind:'plank'});
click('choose-next');
assert.equal(state.goalLab.draft.stage,'assessment');
click('timer-start');
assert.equal(typeof state.goalLab.draft.startedAt,'string');
assert.equal(goals.pauseTimer(state),true);
assert.equal(state.goalLab.draft.startedAt,null);
click('assessment-done');
click('feedback-next');
assert.equal(state.goalLab.draft.stage,'target');
assert.ok(state.goalLab.draft.target>=20,'discover-first mode recommends a measurable goal');


const altered={};
const modified=(name,data={})=>goals.action(altered,name,{dataset:data});
modified('new',{mode:'target'});
modified('template',{kind:'pushup'});
modified('choose-next');
modified('target-next');
goals.field(altered,'variant','Incline push-up');
for(let i=0;i<10;i++)modified('count-up');
modified('assessment-done');modified('feedback-next');modified('save-goal');
assert.equal(goals.isRunnableGoal(altered.goalLab.goals[0]),false);
assert.equal(goals.buildGoalDay(altered,[{id:'push-up',name:'Push-Up',movement:'horizontal-push',muscles:['Chest'],loadMode:'bodyweight',equipment:['bodyweight']}],{equipment:'bodyweight'}),null);
assert.equal(goals.afterWorkout(altered,{id:'standard-session',exercises:[{id:'push-up',sets:[{completed:true,reps:30}]}]}),false);
assert.equal(altered.goalLab.goals[0].best,10);

const changed={};
const c=(name,dataset={})=>goals.action(changed,name,{dataset});
c('new',{mode:'target'});c('template',{kind:'custom'});c('choose-next');c('target-next');c('count-up');c('assessment-done');c('feedback-next');c('save-goal');
const custom=changed.goalLab.goals[0];c('edit',{goalId:custom.id});
goals.field(changed,'unit','seconds');
assert.equal(changed.goalLab.draft.tested,false);
c('target-next');assert.equal(changed.goalLab.draft.stage,'assessment');
goals.field(changed,'result',18);c('assessment-done');c('feedback-next');c('save-goal');
assert.equal(custom.unit,'seconds');
assert.equal(custom.baseline,18);
assert.equal(custom.assessments[0].unit,'reps');
assert.equal(custom.assessments[1].unit,'seconds');

console.log('Goal Lab: all discovery, progress, variant, safety and persistence checks passed.');
