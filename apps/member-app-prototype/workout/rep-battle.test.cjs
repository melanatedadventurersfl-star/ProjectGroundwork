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
assert.match(battle.dockPanel(account,mini),/rep-battle-dock/,'A full set-based workout has a compact battle dock');
assert.match(battle.dockPanel(account,mini),/Guardian 0 HP/,'Dock reflects saved set completion');
assert.equal(battle.dockPanel({arcade:{mode:'companion'}},mini),'','Non-Arcade modes do not show a battle dock');
assert.equal(battle.dockPanel(account,empty),'','Guided recovery has no battle dock');
const mockDock={hidden:true};
let arenaBottom=190;
global.document={
  getElementById:id=>id==='rep-battle-dock'?mockDock:null,
  querySelector:selector=>selector==='.rep-battle'?{getBoundingClientRect:()=>({bottom:arenaBottom})}:null
};
battle.syncDock();
assert.equal(mockDock.hidden,true,'Dock stays hidden while the full arena is visible');
arenaBottom=70;
battle.syncDock();
assert.equal(mockDock.hidden,false,'Dock appears after the battle scrolls out of view');
arenaBottom=350;
battle.syncDock();
assert.equal(mockDock.hidden,true,'Dock hides when full battle returns to the viewport');
delete global.document;
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
assert.match(app,/GoWorkoutRepBattle\.dockPanel/,'Workout renders the battle HUD');
assert.match(app,/GoWorkoutRepBattle\?\.syncDock/,'HUD visibility is recalculated on render');
assert.match(arcadeJs,/GoWorkoutRepBattle\.livePanel/);
assert.match(arcadeJs,/GoWorkoutRepBattle\.summaryPanel/);
assert.match(arcadeJs,/GoWorkoutRepBattle\.dashboardCard/);
console.log('GO Workout Rep Battle V1.1 tests passed.');
