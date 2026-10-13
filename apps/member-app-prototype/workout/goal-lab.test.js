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


// Distance and time share one assessment, including results copied from a machine.
const rowState={};
const rowClick=(name,dataset={})=>goals.action(rowState,name,{dataset});
rowClick('new',{mode:'target'});rowClick('template',{kind:'row'});rowClick('choose-next');
assert.match(goals.render(rowState),/Meters \(m\)/);
goals.field(rowState,'targetTimeText','9:00');
assert.equal(rowClick('target-next').changed,true);
assert.equal(rowState.goalLab.draft.targetTimeSeconds,540);
goals.field(rowState,'result',2000);
goals.field(rowState,'elapsedText','9:00');
goals.field(rowState,'measurementSource','machine');
assert.equal(rowState.goalLab.draft.startedAt,null,'Machine timing does not require starting the app timer');
assert.equal(rowClick('assessment-done').changed,true);
rowClick('feedback-next');rowClick('save-goal');
const rowing=rowState.goalLab.goals[0];
assert.equal(rowing.kind,'row');
assert.equal(rowing.assessments[0].elapsedSeconds,540);
assert.equal(rowing.assessments[0].measurementSource,'machine');
assert.equal(rowing.targetTimeSeconds,540);
assert.equal(goals.meetsTarget(rowing),true);
assert.match(goals.render(rowState),/2:15 \/ 500 m/);
assert.equal(JSON.parse(JSON.stringify(rowState)).goalLab.goals[0].assessments[0].elapsedSeconds,540);
rowClick('edit',{goalId:rowing.id});
goals.field(rowState,'unit','kilometers');
assert.equal(rowState.goalLab.draft.tested,true,'Changing distance display units should not demand a retest');
rowClick('target-next');rowClick('save-goal');
assert.equal(rowing.unit,'kilometers');
assert.equal(rowing.target,2);
assert.equal(rowing.baseline,2);
assert.equal(rowing.assessments.length,1,'Unit conversion is not a second workout');
assert.equal(rowing.assessments[0].unit,'meters','Historical source units remain accurate');
assert.equal(goals.meetsTarget(rowing),true);
rowClick('edit',{goalId:rowing.id});
goals.field(rowState,'targetTimeText','8:59');
rowClick('target-next');rowClick('save-goal');
assert.equal(goals.meetsTarget(rowing),false,'Both distance and time are required to meet a timed goal');
assert.equal(rowing.achievedAt,null);

const manual={};
const manualClick=(name,dataset={})=>goals.action(manual,name,{dataset});
manualClick('new',{mode:'target'});manualClick('template',{kind:'pushup'});manualClick('choose-next');manualClick('target-next');
goals.field(manual,'result',12);
goals.field(manual,'elapsedText','0:45');
assert.equal(manualClick('assessment-done').changed,true);
manualClick('feedback-next');manualClick('save-goal');
assert.equal(manual.goalLab.goals[0].baseline,12,'Typed reps work without counter buttons');
assert.equal(manual.goalLab.goals[0].assessments[0].elapsedSeconds,45);

const distanceTimer={};
const distanceClick=(name,dataset={})=>goals.action(distanceTimer,name,{dataset});
distanceClick('new',{mode:'target'});distanceClick('template',{kind:'cycle'});distanceClick('choose-next');distanceClick('target-next');
goals.field(distanceTimer,'result',12.5);
distanceClick('timer-start');
assert.equal(goals.pauseTimer(distanceTimer),true);
assert.equal(distanceTimer.goalLab.draft.result,12.5,'Pausing stopwatch must not erase a distance measurement');
assert.ok(goals.render(distanceTimer).includes('Elapsed time'));
assert.equal(goals.parseDuration('9:75'),null);
assert.equal(goals.parseDuration('1:09:00'),4140);
for(const kind of ['run','cycle','walk','row','swim','hike']){
  assert.ok(goals.template(kind).id===kind,kind+' should be a selectable activity goal');
}

const holdManual={};
const holdClick=(name,dataset={})=>goals.action(holdManual,name,{dataset});
holdClick('new',{mode:'target'});holdClick('template',{kind:'plank'});holdClick('choose-next');holdClick('target-next');
goals.field(holdManual,'timedResultText','1:15');
assert.equal(holdManual.goalLab.draft.startedAt,null);
assert.equal(holdClick('assessment-done').changed,true);
assert.equal(holdManual.goalLab.draft.result,75,'Manual m:ss hold time is normalized to seconds');
holdClick('feedback-next');holdClick('save-goal');
assert.equal(holdManual.goalLab.goals[0].baseline,75);

console.log('Goal Lab: all discovery, progress, variant, safety and persistence checks passed.');
