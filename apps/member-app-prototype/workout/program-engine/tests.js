const E=require('./index.js');
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log('PASS',name)}catch(e){failed++;console.error('FAIL',name,'-',e.message)}}
function assert(v,m){if(!v)throw new Error(m)}
const full={goal:'hypertrophy',experience:'intermediate',sessionsPerWeek:4,sessionMinutes:45,equipment:['dumbbell','bench','cable','machine'],stretchMinutes:10,priorities:['chest','lateral_delts']};
test('builds four-week program',()=>{const p=E.buildProgram(full);assert(p.weeks.length===4,'not four weeks');assert(p.weeks.every(w=>w.sessions.length===4),'not four sessions/week')});
test('program validates',()=>{const r=E.validateProgram(E.buildProgram(full));assert(r.valid,r.errors.join('; '))});
test('stretch durations are exact',()=>{[5,10,15].forEach(m=>{const s=E.buildStretchSession(m,'lower_a',E.normalizeProfile(full));assert(s.totalSeconds===m*60,m+' minute stretch mismatch');assert(s.activities.length>=3,'stretch too shallow')})});
test('mobility durations are exact',()=>{[5,10,15].forEach(m=>assert(E.buildMobilitySession(m,E.normalizeProfile(full),'lower').totalSeconds===m*60,'mobility '+m))});
test('dumbbell-only profile avoids cable/machine requirements',()=>{const p=E.buildProgram({...full,equipment:['dumbbell','bench'],sessionsPerWeek:3});const chosen=p.weeks.flatMap(w=>w.sessions).flatMap(s=>s.strength).filter(x=>x.exercise).map(x=>x.exercise);assert(chosen.every(x=>x.equipment.every(q=>['bodyweight','dumbbell','bench'].includes(q))), 'incompatible equipment selected')});
test('exclusions persist',()=>{const p=E.buildProgram({...full,exclusions:['db_bench']});const ids=p.weeks.flatMap(w=>w.sessions).flatMap(s=>s.strength).map(x=>x.exercise?.id);assert(!ids.includes('db_bench'),'excluded exercise selected')});
test('substitutions preserve movement and constraints',()=>{const p=E.normalizeProfile(full),e=E.EXERCISES.find(x=>x.id==='db_bench'),subs=E.substitutionsFor(e,p);assert(subs.length>0,'no substitutions');subs.forEach(s=>assert(E.EXERCISES.find(x=>x.id===s.id).pattern===e.pattern,'wrong movement'))});
test('week three overloads and week four consolidates',()=>{const p=E.buildProgram(full),s=w=>p.weeks[w-1].sessions[0].strength.find(x=>x.exercise);assert(s(3).prescription.sets>=s(1).prescription.sets,'week 3 did not build');assert(s(4).prescription.sets<s(3).prescription.sets,'week 4 did not consolidate')});
test('session exposes time budget and minimum viable workout',()=>{const s=E.buildProgram(full).weeks[0].sessions[0];assert(s.timeBudget.targetMinutes===45,'bad target');assert(s.minimumViableWorkout.length===3,'bad minimum viable workout')});
test('accessory supersets are generated',()=>{const p=E.buildProgram(full);assert(p.weeks.some(w=>w.sessions.some(s=>s.supersets.length>0)),'no supersets')});
test('recovery mobility sessions follow profile frequency',()=>{const p=E.buildProgram({...full,mobilitySessionsPerWeek:2});assert(p.weeks.every(w=>w.recoveryActivities.length===2),'recovery count')});
test('conditioning respects available equipment',()=>{const p=E.normalizeProfile({...full,equipment:['dumbbell','bench']});const c=E.buildConditioningSession(15,p);assert(c.activity.id==='brisk_walk','unexpected equipment')});
test('progression requires repeated evidence',()=>{let d=E.progressionDecision([{reps:[10,10,10]}],{reps:[8,10]});assert(d.action==='repeat','progressed too soon');d=E.progressionDecision([{reps:[10,10,10]},{reps:[10,10,10]}],{reps:[8,10]});assert(d.action==='progress','did not progress')});
test('same profile is deterministic',()=>{const a=JSON.stringify(E.buildProgram(full).weeks),b=JSON.stringify(E.buildProgram(full).weeks);assert(a===b,'same input changed output')});
console.log('\nRESULT',passed+' passed, '+failed+' failed');
if(failed)process.exitCode=1;
