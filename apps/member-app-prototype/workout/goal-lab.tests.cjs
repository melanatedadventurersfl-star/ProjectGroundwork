const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, 'goal-lab.js'), 'utf8');
const context = {window: {}, document: {querySelector: () => null}, confirm: () => true};
vm.runInNewContext(source, context, {filename: 'goal-lab.js'});
const G = context.window.GoWorkoutGoalLab;
assert.ok(G);
const click = (training, name, dataset = {}) => G.action(training, name, {dataset});
const catalogs = [
  {id:'push-up',name:'Push-Up',movement:'horizontal-push',muscles:['Chest'],equipment:['bodyweight'],loadMode:'bodyweight'},
  {id:'plank',name:'Plank',movement:'core',muscles:['Core'],equipment:['bodyweight'],loadMode:'timed'},
  {id:'bodyweight-squat',name:'Bodyweight Squat',movement:'squat',muscles:['Quads'],equipment:['bodyweight'],loadMode:'bodyweight'},
  {id:'dead-bug',name:'Dead Bug',movement:'core',muscles:['Core'],equipment:['bodyweight'],loadMode:'bodyweight'},
  {id:'glute-bridge',name:'Glute Bridge',movement:'hinge',muscles:['Glutes'],equipment:['bodyweight'],loadMode:'bodyweight'}
];
function makeGoal(training,kind,reps,target){
  click(training,'new',{mode:'target'});
  click(training,'template',{kind});
  click(training,'choose-next');
  if(target)G.field(training,'target',String(target));
  click(training,'target-next');
  if(kind==='plank')G.field(training,'result',String(reps));
  else for(let i=0;i<reps;i++)click(training,'count-up');
  click(training,'assessment-done');
  click(training,'effort',{effort:'challenging'});
  click(training,'feedback-next');
  click(training,'save-goal');
  return training.goalLab.goals.at(-1);
}

const userA={},userB={};
const push=makeGoal(userA,'pushup',8,60);
assert.equal(push.baseline,8);
assert.equal(push.best,8);
assert.equal(push.target,60);
assert.equal(push.assessments.length,1);

click(userA,'edit',{goalId:push.id});
G.field(userA,'target','65');
click(userA,'target-next');
click(userA,'save-goal');
assert.equal(push.target,65);
assert.equal(push.assessments.length,1,'Editing the target must not fake another assessment');

click(userA,'retest',{goalId:push.id});
for(let i=0;i<12;i++)click(userA,'count-up');
click(userA,'assessment-done');
click(userA,'feedback-next');
click(userA,'save-goal');
assert.equal(push.best,12);
assert.equal(push.baseline,8);
assert.equal(push.assessments.length,2);

const plank=makeGoal(userA,'plank',24,60);
assert.equal(plank.best,24);
const plan=G.buildGoalDay(userA,catalogs,{equipment:'bodyweight',minutes:30});
assert.ok(plan.goalFocused);
assert.ok(plan.exercises.some(x=>x.id==='push-up'));
assert.ok(plan.exercises.some(x=>x.id==='plank'&&x.loadMode==='timed'));
assert.equal(userA.goalLab.goals.length,2);

const second=makeGoal(userB,'pushup',5,20);
assert.equal(second.best,5);
assert.equal(userB.goalLab.goals.length,1,'Goal states must stay within their own user training program');

const entry={id:'session-1',completedAt:new Date().toISOString(),exercises:[
  {id:'push-up',sets:[{completed:true,reps:16},{completed:true,reps:10},{completed:false,reps:60}]}
]};
assert.equal(G.afterWorkout(userA,entry),true);
assert.equal(push.best,16,'Workout totals and incomplete sets must not count as a single-set record');
assert.equal(G.afterWorkout(userB,{id:'other',exercises:[]}),false);
assert.equal(second.best,5);

click(userA,'retest',{goalId:plank.id});
click(userA,'effort',{effort:'pain'});
click(userA,'assessment-done');
click(userA,'feedback-next');
click(userA,'save-goal');
assert.equal(plank.painFlag,true);
assert.ok(!G.buildGoalDay(userA,catalogs,{equipment:'bodyweight',minutes:30}).exercises.some(x=>x.id==='plank'),
  'Pain feedback should exclude the affected goal from generated workouts');

click(userA,'toggle-pause',{goalId:push.id});
assert.equal(push.status,'paused');
assert.equal(G.buildGoalDay(userA,catalogs,{equipment:'bodyweight',minutes:30}),null,
  'Paused and painful goals should not generate training');
click(userA,'toggle-pause',{goalId:push.id});
assert.equal(push.status,'active');

assert.match(G.render(userA),/YOUR GOAL/);

// Regression: a wall push-up baseline must never produce a standard push-up prescription.
const wallUser={};
click(wallUser,'new',{mode:'target'});
click(wallUser,'template',{kind:'pushup'});
click(wallUser,'choose-next');
click(wallUser,'target-next');
G.field(wallUser,'variant','Wall push-up');
for(let i=0;i<15;i++)click(wallUser,'count-up');
click(wallUser,'assessment-done');
click(wallUser,'feedback-next');
click(wallUser,'save-goal');
const wall=wallUser.goalLab.goals[0];
assert.equal(wall.baseline,15);
assert.equal(G.isRunnableGoal(wall),false);
assert.equal(G.buildGoalDay(wallUser,catalogs,{equipment:'bodyweight',minutes:30}),null);
click(wallUser,'all-goals');
assert.ok(!G.render(wallUser).includes('START GOAL WORKOUT'),'Unsupported variation must not advertise a runnable goal session');
assert.match(G.recommendations(wall).summary,/not in the automated workout catalog/);
assert.equal(G.afterWorkout(wallUser,entry),false);
assert.equal(wall.best,15,'Standard push-up workout sets must not count toward wall push-ups');

// A compatible goal can still train alongside an unsupported goal without replacing it.
const compatible=makeGoal(wallUser,'plank',20,60);
assert.equal(G.isRunnableGoal(compatible),true);
const mixedPlan=G.buildGoalDay(wallUser,catalogs,{equipment:'bodyweight',minutes:30});
assert.ok(mixedPlan.exercises.some(ex=>ex.id==='plank'));
assert.ok(!mixedPlan.exercises.some(ex=>ex.id==='push-up'),'Mixed goal sessions cannot silently change variations');

// Regression: editing a custom goal measurement requires a new test in the new unit.
const customUser={};
const custom=makeGoal(customUser,'custom',6,20);
assert.equal(custom.unit,'reps');
click(customUser,'edit',{goalId:custom.id});
assert.equal(G.field(customUser,'unit','seconds'),true);
assert.equal(customUser.goalLab.draft.tested,false,'Old rep baseline cannot become seconds');
assert.equal(customUser.goalLab.draft.result,0);
assert.equal(customUser.goalLab.draft.metric,'single hold');
assert.equal(customUser.goalLab.draft.stage,'target');
click(customUser,'target-next');
assert.equal(customUser.goalLab.draft.stage,'assessment');
assert.equal(customUser.goalLab.draft.unit,'seconds');
G.field(customUser,'result',32);
click(customUser,'assessment-done');
click(customUser,'feedback-next');
click(customUser,'save-goal');
assert.equal(custom.unit,'seconds');
assert.equal(custom.baseline,32);
assert.equal(custom.best,32);
assert.equal(custom.assessments.length,2);
assert.equal(custom.assessments[0].unit,'reps','Previous test unit preserved');
assert.equal(custom.assessments[0].value,6);
assert.equal(custom.assessments[1].unit,'seconds','New baseline uses new unit');
assert.match(G.render(customUser),/6 reps/);
assert.match(G.render(customUser),/32 seconds/);

// Changing back to the existing unit should not create a duplicate assessment.
click(customUser,'edit',{goalId:custom.id});
G.field(customUser,'unit','miles');
assert.equal(customUser.goalLab.draft.tested,false);
G.field(customUser,'unit','seconds');
assert.equal(customUser.goalLab.draft.tested,true);
click(customUser,'target-next');
click(customUser,'save-goal');
assert.equal(custom.assessments.length,2);
assert.equal(custom.unit,'seconds');

console.log('GO Workout Goal Lab: all regression checks passed.');
