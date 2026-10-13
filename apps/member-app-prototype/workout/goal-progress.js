/* GO Workout goal status: assessment-based, not workout attendance. */
(() => {
  'use strict';
  const value=n=>Number.isFinite(Number(n))?Number(n):0;
  const days=24*60*60*1000;
  function summarize(goal,now=Date.now(),engine=window.GoWorkoutGoalLab){
    if(!goal)return {label:'Not enough data',percent:null,reason:'No goal'};
    if(goal.painFlag||['paused','inactive'].includes(goal.status))
      return {label:'Paused',percent:null,reason:'Training or goal is paused'};
    const best=value(engine?.assessmentBest?.(goal)??goal.baseline);
    const baseline=value(goal.baseline),target=value(goal.target);
    const reached=Boolean(engine?.meetsTarget?.(goal));
    const percent=target>0?Math.min(reached?100:99,Math.max(0,Math.round(best/target*100))):null;
    if(reached)return {label:'Goal reached',percent,reason:'Target verified in a comparable assessment'};
    if(!Number.isFinite(target)||target<=0)return {label:'Not enough data',percent:null,reason:'Target unavailable'};
    const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    const records=(goal.assessments||[]).filter(a=>a.source==='discovery'
      && (!a.unit||a.unit===goal.unit)
      && norm(a.variant)===norm(goal.variant))
      .filter(a=>Number.isFinite(Date.parse(a.at))&&Date.parse(a.at)<=now)
      .sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
    if(records.length<2)return {label:'Awaiting reassessment',percent,reason:'A second comparable baseline test is needed'};
    const latest=Date.parse(records[records.length-1].at);
    if(now-latest>21*days)return {label:'Needs reassessment',percent,reason:'Latest assessment is more than 21 days old'};
    const start=Date.parse(goal.createdAt);
    const weeks=Number(goal.deadline);
    if(!Number.isFinite(start)||!Number.isFinite(weeks)||weeks<=0||!['4','8','12'].includes(String(goal.deadline)))
      return {label:'Progress recorded',percent,reason:'No measurable deadline is set'};
    const due=start+weeks*7*days;
    if(now>due)return {label:'Review target date',percent,reason:'The original target window has ended'};
    if(target<=baseline)return {label:'Progress recorded',percent,reason:'Target is not above baseline'};
    const expected=Math.max(0,Math.min(1,(now-start)/(due-start)));
    const actual=Math.max(0,Math.min(1,(best-baseline)/(target-baseline)));
    if(actual>=expected+0.18)return {label:'Ahead of schedule',percent,reason:'Assessment progress exceeds the target pace'};
    if(actual>=expected-0.10)return {label:'On track',percent,reason:'Assessment progress aligns with the goal window'};
    return {label:'Needs attention',percent,reason:'Assessment progress is slower than the target pace'};
  }
  window.GoWorkoutGoalProgress={summarize};
  if(typeof module!=='undefined'&&module.exports)module.exports={summarize};
})();
