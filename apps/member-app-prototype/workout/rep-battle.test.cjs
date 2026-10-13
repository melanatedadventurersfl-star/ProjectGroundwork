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
const empty=create('recovery',0);
assert.equal(battle.progress(empty).victory,false,'Guided-only workout has no artificial fight');
const account={arcade:{mode:'companion',outfit:'explorer'}};
assert.equal(battle.noteCompletedSet(account,mini,mini.exercises[0],mini.exercises[0].sets[2]),false,'No damage animations unless Arcade mode');
assert.equal(mini.arcadeBattlePlayed,undefined,'Companion does not mark game participation');
arcade.action(account,'mode','arcade');
const prescription=JSON.stringify(mini.exercises);
assert.equal(battle.noteCompletedSet(account,mini,mini.exercises[0],mini.exercises[0].sets[2]),true);
assert.equal(mini.arcadeBattlePlayed,true,'Only played battle sessions are flagged');
assert.equal(JSON.stringify(mini.exercises),prescription,'Battle never changes prescribed sets');
const html=battle.livePanel(account,mini,'<span>avatar</span>');
assert.match(html,/REP BATTLE/);
assert.match(html,/is-hit/,'First render reacts to just-completed set');
assert.match(html,/Guardian defeated/);
assert.doesNotMatch(battle.livePanel(account,mini,'<span>avatar</span>'),/is-hit/,'Rerender does not replay stale hit');
mini.phase='rest';
assert.match(battle.livePanel(account,mini,'<span>avatar</span>'),/is-rest/,'Rest produces a shield, does not shorten rest');
mini.isPaused=true;
assert.match(battle.livePanel(account,mini,'<span>avatar</span>'),/Workout paused/);
assert.equal(battle.livePanel(account,empty,'<span>avatar</span>'),null,'Guided-only sessions defer to base companion');
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
assert.match(app,/data-arcade-action===\'battle-jump\'/,'VIEW returns to full arena');
console.log('GO Workout Rep Battle V1.1 tests passed.');
