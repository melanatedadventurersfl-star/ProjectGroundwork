/* GO Workout Rep Battle V1.1 behavior and integration checks.
 * Run: node apps/member-app-prototype/workout/rep-battle.test.cjs
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
global.window={};
const battle=require('./rep-battle.js');
const arcade=require('./arcade.js');
const create=(id,total,completed=0,skipped=0)=>({
  id,phase:'work',completionStatus:'complete',completedSets:completed,
  exercises:[{id:'squat',name:'Squats',sets:Array.from({length:total},(_,i)=>({
    completed:i<completed,skipped:i>=completed && i<completed+skipped,
    reps:10,weight:25,completedAt:i<completed?'2026-10-12T19:00:00Z':null
  }))}]
});
const mini=create('a',3,0);
assert.deepEqual(battle.progress(mini),{total:3,completed:0,skipped:0,remaining:3,damageDealt:0,remainingHp:100,nextHit:33,victory:false,percentage:0});
mini.exercises[0].sets[0].completed=true;
assert.equal(battle.progress(mini).remainingHp,67);
assert.equal(battle.progress(mini).nextHit,34);
mini.exercises[0].sets[1].completed=true;
assert.equal(battle.progress(mini).remainingHp,33);
mini.exercises[0].sets[2].completed=true;
assert.equal(battle.progress(mini).remainingHp,0);
assert.equal(battle.progress(mini).victory,true);
const adapted=create('adapted',6,6);
assert.equal(battle.progress(adapted).remainingHp,0,'Longer plan has same achievable win condition');
assert.equal(battle.progress(create('easy',1,1)).remainingHp,0,'Single-set session also finishes guardian');
const skipped=create('skipped',4,3,1);
assert.equal(battle.progress(skipped).remainingHp,25,'Skipped work never deals damage');
assert.equal(battle.progress(skipped).victory,false,'Skipping cannot silently mark boss defeated');
const partial=create('partial',3,2);
assert.equal(battle.progress(partial).remainingHp,33,'Partial session keeps accurate saved progress');
// Timed sets that finish early earn fractional battle damage only.
const timed=create('timed-37',6,3);
timed.exercises[0].loadMode='timed';
timed.phase='rest';
timed.exercises[0].sets[3]={completed:true,reps:'4',durationSeconds:4,plannedReps:'37',
  repBattleTimedTargetSeconds:37,repBattleTimedActualSeconds:4};
assert.equal(battle.progress(timed).completed,4,'Early set remains saved as a completed set');
assert.equal(battle.progress(timed).damageDealt,52,'Four of 37 seconds adds only two damage to 50 HP');
assert.equal(battle.progress(timed).remainingHp,48,'Early ending cannot yield full 17 HP');
assert.equal(battle.progress(timed).nextHit,17,'Next full timed set can still do its usual damage');
const allTimed=create('all-timed',6,5);
allTimed.exercises[0].loadMode='timed';
allTimed.exercises[0].sets[5]={completed:true,reps:'4',durationSeconds:4,plannedReps:'37',
  repBattleTimedTargetSeconds:37,repBattleTimedActualSeconds:4};
assert.equal(battle.progress(allTimed).completed,6,'Workout completion count is unchanged');
assert.equal(battle.progress(allTimed).victory,false,'Partial timed effort never creates a false Guardian victory');
assert.equal(battle.progress(allTimed).nextHit,0,'No more attacks when prescribed sets are exhausted');
const fullTimed=create('full-timed',6,6);
fullTimed.exercises[0].loadMode='timed';
fullTimed.exercises[0].sets.forEach(set=>Object.assign(set,{reps:'37',durationSeconds:37,plannedReps:'37',
  repBattleTimedTargetSeconds:37,repBattleTimedActualSeconds:37}));
assert.equal(battle.progress(fullTimed).remainingHp,0,'Full timed sets still defeat the Guardian');
const extraTimed=create('extra-timed',1,1);
extraTimed.exercises[0].loadMode='timed';
Object.assign(extraTimed.exercises[0].sets[0],{reps:'45',durationSeconds:45,plannedReps:'37',
  repBattleTimedTargetSeconds:37,repBattleTimedActualSeconds:45});
assert.equal(battle.progress(extraTimed).damageDealt,100,'Extra effort does not grant overpowered attacks');
const historicalTimed=create('legacy-timed',6,3);
historicalTimed.exercises[0].loadMode='timed';
historicalTimed.exercises[0].sets[3]={completed:true,reps:'4',durationSeconds:4,plannedReps:'37'};
assert.equal(battle.progress(historicalTimed).remainingHp,48,'Saved legacy timed work is correctly restored');
const empty=create('recovery',0);
assert.equal(battle.progress(empty).victory,false,'Guided-only workout has no artificial fight');
const account={arcade:{mode:'companion',outfit:'explorer'}};
assert.equal(battle.noteCompletedSet(account,mini,mini.exercises[0],mini.exercises[0].sets[2]),false,'No damage animations unless Arcade mode');
assert.equal(mini.arcadeBattlePlayed,undefined,'Companion does not mark game participation');
arcade.action(account,'mode','arcade');
assert.equal(battle.noteCompletedSet(account,timed,timed.exercises[0],timed.exercises[0].sets[3]),true);
assert.match(battle.postSetMoment(account,timed,'<span>avatar</span>'),/Partial hit!/);
assert.match(battle.postSetMoment(account,timed,'<span>avatar</span>'),/−2 HP/);
assert.match(battle.postSetMoment(account,timed,'<span>avatar</span>'),/4\/37 sec/);

const prescription=JSON.stringify(mini.exercises);
assert.equal(battle.noteCompletedSet(account,mini,mini.exercises[0],mini.exercises[0].sets[2]),true);
assert.equal(mini.arcadeBattlePlayed,true,'Only played battle sessions are flagged');
assert.equal(JSON.stringify(mini.exercises),prescription,'Battle never changes prescribed sets');
assert.match(battle.livePanel({arcade:{mode:'arcade'}},create('default-preview',3),'<span>avatar</span>'),/is-collapsed/,'Compact battle is the default, keeping set controls visible');
assert.equal(battle.setCollapsed(account,false),true,'VIEW can expand a previously unset preference');
const html=battle.livePanel(account,mini,'<span>avatar</span>');
assert.match(html,/REP BATTLE/);
assert.match(html,/is-hit/,'First render reacts to just-completed set');
assert.match(html,/Guardian defeated/);
assert.doesNotMatch(battle.livePanel(account,mini,'<span>avatar</span>'),/is-hit/,'Rerender does not replay stale hit');
mini.phase='rest';
assert.match(battle.postSetMoment(account,mini,'<span>avatar</span>'),/rep-hit-moment/,'Completed set animates inside the rest card');
assert.match(battle.postSetMoment(account,mini,'<span>avatar</span>'),/Guardian 0 HP/,'Rest card gives visible health feedback');
assert.match(battle.livePanel(account,mini,'<span>avatar</span>'),/is-rest/,'Rest produces a shield, does not shorten rest');
mini.isPaused=true;
assert.match(battle.livePanel(account,mini,'<span>avatar</span>'),/Workout paused/);
assert.equal(battle.livePanel(account,empty,'<span>avatar</span>'),null,'Guided-only sessions defer to base companion');
assert.equal(battle.postSetMoment(account,{...mini,phase:'work'},'<span>avatar</span>'),'','Never cover active exercise controls with attack effects');
assert.equal(battle.postSetMoment({arcade:{mode:'companion'}},mini,'<span>avatar</span>'),'','Companion mode does not show game attacks');
assert.equal(battle.postSetMoment(account,empty,'<span>avatar</span>'),'','Recovery sessions have no artificial fight');
assert.equal(battle.postSetMoment(account,{...mini,id:'never-hit',phase:'rest'},'<span>avatar</span>'),'','Restored or skipped work cannot fake a new attack');
assert.match(battle.postSetMoment(account,{...mini,phase:'feedback'},'<span>avatar</span>'),/Hit landed|Guardian down/,'Final set attack also appears during exercise feedback');
assert.equal(battle.summaryPanel({ ...mini,completionStatus:'complete'}).includes('Guardian defeated'),true);
assert.doesNotMatch(battle.summaryPanel({...skipped,arcadeBattlePlayed:true,completionStatus:'complete'}),/Guardian defeated/);
assert.equal(battle.summaryPanel({...mini,arcadeBattlePlayed:false}), '','No fake victory for sessions never played in Arcade mode');
assert.equal(battle.setCollapsed(account,true),true);
assert.equal(battle.setCollapsed(account,true),false);
assert.match(battle.livePanel(account,mini,'<span>avatar</span>'),/is-collapsed/);
assert.match(battle.dashboardCard(account,mini,'<span>avatar</span>'),/RETURN TO BATTLE/);
assert.match(battle.dashboardCard(account,null,'<span>avatar</span>'),/PLAY IN YOUR NEXT WORKOUT/);
const bad=create('unsafe',1,1);
bad.exercises[0].name='<img src=x onerror=alert(1)>';
battle.noteCompletedSet(account,bad,bad.exercises[0],bad.exercises[0].sets[0]);
assert.doesNotMatch(battle.livePanel(account,bad,'<span>avatar</span>'),/<img src=x/,'Exercise label escaped');
assert.match(battle.livePanel(account,{...bad,phase:'work'},'<span>avatar</span>'),/REP BATTLE/);
assert.equal(arcade.stats([create('completed',6,6)]).xp,125,'Game has no additional XP path');
assert.equal(arcade.stats([create('completed',1,1)]).xp,125,'XP remains equal for full plans');
assert.match(battle.headerPanel(account,mini),/rep-header-status/,'Battle status belongs in workout header');
assert.match(battle.headerPanel(account,mini),/0 HP/,'Header reflects canonical completed-set data');
assert.match(battle.headerPanel(account,mini),/3\/3 SETS/,'Header reflects adjusted set counts');
assert.match(battle.headerPanel(account,mini),/GUARDIAN DOWN/,'Health reaches zero without prematurely saving the workout');
assert.equal(battle.headerPanel({arcade:{mode:'companion'}},mini),'','Companion mode has no Rep Battle header');
assert.equal(battle.headerPanel({arcade:{mode:'focus'}},mini),'','Focus mode has no Rep Battle header');
assert.equal(battle.headerPanel(account,empty),'','Zero-set recovery has no battle header');
assert.match(battle.headerPanel(account,create('skipped-again',3,2,1)),/33 HP/,'Skipped set does not harm Guardian');
const documentHtml=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
const arcadeJs=fs.readFileSync(path.join(__dirname,'arcade.js'),'utf8');
assert.match(documentHtml,/rep-battle\.js\?v=/);
assert.match(documentHtml,/rep-battle\.css\?v=/);
assert.ok(documentHtml.indexOf('arcade.js')<documentHtml.indexOf('rep-battle.js') &&
  documentHtml.indexOf('rep-battle.js')<documentHtml.indexOf('app.js'),
  'Game is loaded before workout app');
assert.match(app,/GoWorkoutRepBattle\?\.noteCompletedSet\(ensureTrainingProgram\(\),w,pos\.exercise,pos\.set\)/);
assert.match(app,/GoWorkoutRepBattle\?\.noteCompletedSet\(ensureTrainingProgram\(\),pos\.workout,pos\.exercise,pos\.set\)/);
assert.match(app,/data-arcade-action/);
assert.match(app,/GoWorkoutRepBattle\.headerPanel/,'Workout renders status in its sticky header');
assert.doesNotMatch(app,/GoWorkoutRepBattle\.dockPanel/,'Floating HUD no longer overlays exercises');
assert.doesNotMatch(app,/GoWorkoutRepBattle\?\.syncDock/,'Scroll observer no longer needed');
assert.match(arcadeJs,/GoWorkoutRepBattle\.livePanel/);
assert.match(arcadeJs,/GoWorkoutRepBattle\.summaryPanel/);
assert.match(arcadeJs,/GoWorkoutRepBattle\.dashboardCard/);
const battleCss=fs.readFileSync(path.join(__dirname,'rep-battle.css'),'utf8');
assert.match(battleCss,/\.runner-v2-header>\.rep-header-status/,'HUD occupies an inline header row');
assert.doesNotMatch(battleCss,/\.rep-battle-dock\s*\{/,'Fixed overlapping dock removed');
assert.match(app,/dataset\.arcadeAction==='battle-jump'/,'VIEW returns to full arena');
assert.match(app,/GoWorkoutRepBattle\.postSetMoment/,'Game attack visible inside rest and feedback');
assert.match(app,/repBattleTimedTargetSeconds=duration/,'Timed set preserves actual prescribed duration');
assert.match(app,/repBattleTimedActualSeconds=num\(pos\.set\.reps\)/,'Actual timed seconds are recorded before the game scores the set');
assert.match(app,/isTimed\?last\.reps\+' sec'/,'Rest report displays seconds instead of reps');
assert.match(app,/setCollapsed\(training,false\)/,'VIEW opens the full game instead of returning to a collapsed card');
assert.match(battleCss,/\.rep-hit-moment/,'Compact attack scene has in-context styling');
console.log('GO Workout Rep Battle V1.1 tests passed.');
