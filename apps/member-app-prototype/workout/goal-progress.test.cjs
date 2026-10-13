const test=require('node:test');
const assert=require('node:assert/strict');
global.window={GoWorkoutGoalLab:{}};
const {summarize}=require('./goal-progress.js');
const now=Date.parse('2026-10-13T12:00:00Z');
const day=86400000;
const start=now-14*day;
const engine={assessmentBest:g=>g.best,meetsTarget:g=>g.completed||false};
function goal(opts={}){
  const first={source:'discovery',unit:'reps',variant:'Standard push-up',value:10,at:new Date(start).toISOString()};
  const second={source:'discovery',unit:'reps',variant:'Standard push-up',value:24,at:new Date(now-day).toISOString()};
  return {name:'Push-ups',kind:'pushup',unit:'reps',variant:'Standard push-up',baseline:10,target:50,best:24,status:'active',deadline:'8',createdAt:new Date(start).toISOString(),assessments:[first,second],...opts};
}
test('eight week goal uses real relative deadline and recorded assessments',()=>{
 assert.equal(summarize(goal(),now,engine).label,'Ahead of schedule');
});
test('missing reassessment never claims on track',()=>{
 assert.equal(summarize(goal({assessments:goal().assessments.slice(0,1)}),now,engine).label,'Awaiting reassessment');
});
test('four week goal behind its target pace',()=>{
 assert.equal(summarize(goal({deadline:'4',best:13}),now,engine).label,'Needs attention');
});
test('expired goal returns review rather than behind',()=>{
 assert.equal(summarize(goal({deadline:'4',createdAt:new Date(now-35*day).toISOString()}),now,engine).label,'Review target date');
});
test('paused goal never broadcasts falling behind',()=>{
 assert.equal(summarize(goal({status:'paused'}),now,engine).label,'Paused');
});
test('old assessment cannot be on track',()=>{
 const old=[goal().assessments[0],{...goal().assessments[1],at:new Date(now-30*day).toISOString()}];
 assert.equal(summarize(goal({assessments:old}),now,engine).label,'Needs reassessment');
});
test('goals without deadline never claim on track',()=>{
 assert.equal(summarize(goal({deadline:'none'}),now,engine).label,'Progress recorded');
});
test('reached goals show 100 only when verified',()=>{
 assert.equal(summarize(goal({best:50,completed:false}),now,engine).percent,99);
 assert.equal(summarize(goal({best:50,completed:true}),now,engine).percent,100);
});
