const E=require('./index.js');
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log('PASS',name)}catch(e){failed++;console.error('FAIL',name,'-',e.message)}}
function assert(v,m){if(!v)throw new Error(m)}
const full={goal:'hypertrophy',experience:'intermediate',sessionsPerWeek:4,sessionMinutes:45,equipment:['dumbbell','bench','cable','machine'],stretchMinutes:10,priorities:['chest','lateral_delts']};
test('builds four-week program',()=>{const p=E.buildProgram(full);assert(p.weeks.length===4,'not four weeks');assert(p.weeks.every(w=>w.sessions.length===4),'not four sessions/week')});
test('program validates',()=>{const r=E.validateProgram(E.buildProgram(full));assert(r.valid,r.errors.join('; '))});
test('stretch durations are exact',()=>{[5,10,15].forEach(m=>{const s=E.buildStretchSession(m,'lower_a',E.normalizeProfile(full));assert(s.totalSeconds===m*60,m+' minute stretch mismatch');assert(s.activities.length>=3,'stretch too shallow')})});
test('dumbbell-only profile avoids cable/machine requirements',()=>{const p=E.buildProgram({...full,equipment:['dumbbell','bench'],sessionsPerWeek:3});const chosen=p.weeks.flatMap(w=>w.sessions).flatMap(s=>s.strength).filter(x=>x.exercise).map(x=>x.exercise);assert(chosen.every(x=>x.equipment.every(q=>['bodyweight','dumbbell','bench'].includes(q))), 'incompatible equipment selected')});
test('exclusions persist',()=>{const p=E.buildProgram({...full,exclusions:['db_bench']});const ids=p.weeks.flatMap(w=>w.sessions).flatMap(s=>s.strength).map(x=>x.exercise?.id);assert(!ids.includes('db_bench'),'excluded exercise selected')});
test('progression requires repeated evidence',()=>{let d=E.progressionDecision([{reps:[10,10,10]}],{reps:[8,10]});assert(d.action==='repeat','progressed too soon');d=E.progressionDecision([{reps:[10,10,10]},{reps:[10,10,10]}],{reps:[8,10]});assert(d.action==='progress','did not progress')});
test('same profile is deterministic',()=>{const a=JSON.stringify(E.buildProgram(full).weeks),b=JSON.stringify(E.buildProgram(full).weeks);assert(a===b,'same input changed output')});
console.log('\nRESULT',passed+' passed, '+failed+' failed');
if(failed)process.exitCode=1;
