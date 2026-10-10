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
assert.equal(state.goalLab.goals[0].best,16,'largest completed continuous set counts, not the sum');
assert.equal(state.goalLab.goals[0].assessments.length,4);
assert.equal(goals.afterWorkout(state,{id:'session-2',exercises:[{id:'push-up',sets:[{reps:10,completed:true}]}]}),false);
const generated=goals.buildGoalDay(state,{length:0,find(){return null}},{equipment:'bodyweight',minutes:30});
assert.equal(generated,null,'unavailable catalog movements should not produce a workout');
assert.match(goals.render(state),/PERSONAL BEST/);

const cloned=JSON.parse(JSON.stringify(state));
assert.equal(cloned.goalLab.goals[0].best,16,'all user progress should be JSON-serializable');

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

console.log('Goal Lab: all discovery, progress, variant, safety and persistence checks passed.');
