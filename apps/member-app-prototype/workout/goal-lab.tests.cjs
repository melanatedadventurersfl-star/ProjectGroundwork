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
console.log('GO Workout Goal Lab: all regression checks passed.');
