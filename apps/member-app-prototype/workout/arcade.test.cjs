/* GO Workout Arcade V1 regression checks.
 * Run: node apps/member-app-prototype/workout/arcade.test.cjs
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
global.window={};
const A=require('./arcade.js');
const training={goalLab:{goals:[{id:'g1',status:'active',baseline:8,target:20}]}};
const initial=A.ensure(training);
assert.equal(initial.mode,'companion');
assert.equal(initial.outfit,'explorer');
assert.equal(A.stats([]).xp,0);
assert.equal(A.stats([]).level,1);
const workout=(id,sets=3,status='complete')=>({
  id,completedSets:sets,completionStatus:status,
  exercises:[{id:'squat',sets:Array.from({length:sets},()=>({completed:true}))}]
});
const one=workout('first');
const two=workout('second',4);
const three=workout('third',5);
assert.equal(A.stats([one]).xp,125,'Full session plus first-mission bonus');
assert.equal(A.stats([one,one]).xp,125,'History merge duplicates cannot farm XP');
assert.equal(A.stats([two,one]).xp,225,'Second valid session adds its own reward');
assert.equal(A.stats([three,two,one]).xp,375,'Third workout earns its quest once');
assert.equal(A.stats([three,two,one]).workoutCount,3);
assert.equal(A.stats([workout('light',1)]).xp,A.stats([workout('heavy',10)]).xp,'Full adaptive plans earn the same XP regardless of planned set count');
assert.equal(A.stats([three,two,one]).completedSets,12);
assert.equal(A.stats([...Array.from({length:5},(_,i)=>workout('extra-'+i,2)),three,two,one]).earnedQuests.includes('sets'),true);
assert.equal(A.stats([workout('partial',2,'partial')]).xp,30,'Partial session earns progress but does not count as full workout');
assert.equal(A.stats([workout('zero',0)]).xp,0,'Skipping all planned work gives no arcade XP');
const recovery={id:'recovery-1',completionStatus:'complete',completedSets:0,durationMinutes:12,exercises:[],warmup:[{completedAt:'2026-10-12T20:30:00Z'}]};
assert.equal(A.stats([recovery]).xp,125,'Completed guided recovery work earns full XP and the first-mission bonus');
assert.equal(A.stats([{...recovery,warmup:[{skippedAt:'2026-10-12T20:30:00Z'}]}]).xp,0,'Skipped guided work never earns XP');
assert.equal(A.stats([{...one,externalWorkout:true}]).xp,0,'External imports are not silently game-qualified');
assert.equal(A.rewardFor([one],'first').xp,125);
assert.equal(A.rewardFor([one],'missing'),null);
const edited=A.action(training,'outfit','spark');
assert.equal(edited.changed,true);
assert.equal(A.ensure(training).outfit,'spark');
assert.equal(A.action(training,'outfit','spark').changed,false);
assert.equal(A.action(training,'mode','invalid').changed,false);
assert.equal(A.action(training,'mode','focus').changed,true);
assert.equal(A.livePanel(training,{exercises:[]},'<span>avatar</span>'),'','Focus has no game widget in training');
assert.equal(A.ensure(training).mode,'focus');
assert.equal(training.goalLab.goals[0].baseline,8,'Arcade does not alter goals or training targets');
assert.match(A.dashboard(training,[one],'<span>avatar</span>'),/Character Locker/);
assert.match(A.dashboard(training,[one],'<span>avatar</span>'),/SEE TRAINING JOURNEY/);
A.action(training,'mode','arcade');
assert.match(A.livePanel(training,{phase:'rest',exercises:[{sets:[{completed:true},{completed:false}]}]},'<span>avatar</span>'),/1 \/ 2 prescribed sets logged/);
assert.match(A.homePanel(training,[],'<span>avatar</span>'),/CHARACTER LOCKER/);
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
assert.match(html,/arcade\.js\?v=/);
assert.match(html,/arcade\.css\?v=/);
assert.ok(html.indexOf('arcade.js')<html.indexOf('app.js'),'Arcade script loads before app');
assert.match(app,/GoWorkoutArcade\.homePanel/);
assert.match(app,/GoWorkoutArcade\.livePanel/);
assert.match(app,/GoWorkoutArcade\.summaryPanel/);
assert.match(app,/GoWorkoutArcade\.dashboard/);
console.log('GO Workout Arcade V1 regression checks passed.');
