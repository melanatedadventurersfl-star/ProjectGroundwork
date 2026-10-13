const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname,'connections.js'),'utf8');

function boot(goals) {
  const published=[];
  let existing=[];
  const api={
    from(table){
      assert.equal(table,'workout_goal_shares');
      return {
        select(){return {eq:async()=>({data:existing.map(goal_id=>({goal_id})),error:null})};},
        upsert(rows){published.push(...rows);existing=rows.map(row=>row.goal_id);return Promise.resolve({error:null});},
        delete(){return {eq(){return {eq:async()=>({error:null})};}};}
      };
    }
  };
  const bridge = {
    client:()=>api,
    userId:()=> '7fd52cc4-3be6-4878-a301-ceb33ce83962',
    goals:()=>goals,
    toast:()=>{},
    render:()=>{},
    save:()=>{},
    displayName:()=> 'Tester'
  };
  const ctx={
    window:{GoWorkoutConnectionsBridge:bridge,GoWorkoutGoalLab:{assessmentBest:g=>g.best??g.baseline,meetsTarget:g=>(g.best??g.baseline)>=g.target}},
    document:{addEventListener(){}},
    console,Date,Number,String,Boolean,Set,JSON,Math,Promise,
    queueMicrotask:()=>{},setTimeout:()=>0,clearTimeout:()=>{}
  };
  vm.runInNewContext(source,ctx);
  return {api:ctx.window.GoWorkoutConnections,published};
}

test('goals stay private without explicit opt in',async()=>{
  const b=boot([{id:'g1',name:'Strength',target:60,baseline:12,status:'active'}]);
  await b.api.publishGoalShares(true);
  assert.equal(b.published.length,0);
});
test('name-only sharing publishes no measurements or status',async()=>{
  const b=boot([{id:'g1',name:'Strength',target:60,baseline:12,best:30,shareLevel:'goal_only'}]);
  await b.api.publishGoalShares(true);
  assert.equal(b.published.length,1);
  const g=b.published[0];
  assert.equal(g.goal_name,'Strength');
  for(const field of ['progress_status','progress_percent','measured_value','target_value','unit'])assert.equal(g[field],null);
});
test('status-only sharing never publishes numeric measurements',async()=>{
  const b=boot([{id:'g1',name:'Strength',target:60,baseline:12,best:30,status:'active',shareLevel:'status',assessments:[{source:'discovery'}]}]);
  await b.api.publishGoalShares(true);
  const g=b.published[0];
  assert.equal(g.progress_status,'Awaiting reassessment');
  for(const field of ['progress_percent','measured_value','target_value','unit'])assert.equal(g[field],null);
});
test('details sharing includes assessed value, target and percent',async()=>{
  const b=boot([{id:'g1',name:'Strength',target:60,baseline:12,best:30,status:'active',unit:'reps',shareLevel:'details'}]);
  await b.api.publishGoalShares(true);
  const g=b.published[0];
  assert.equal(g.progress_percent,50);
  assert.equal(g.measured_value,30);
  assert.equal(g.target_value,60);
  assert.equal(g.unit,'reps');
});
