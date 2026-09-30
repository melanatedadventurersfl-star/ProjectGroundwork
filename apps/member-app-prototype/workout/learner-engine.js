(function(global){
'use strict';
const VERSION='0.6.0',SCHEMA_VERSION=1;
const n=value=>{const v=Number.parseFloat(value);return Number.isFinite(v)?v:0;};
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const round=(value,digits=2)=>{const scale=Math.pow(10,digits);return Math.round((n(value)+Number.EPSILON)*scale)/scale;};
const mean=values=>{const clean=(values||[]).map(n);return clean.length?clean.reduce((sum,value)=>sum+value,0)/clean.length:0;};
function confidence(exposures,setCompletionRate=0,predictionCount=0){
  const score=Math.round(clamp(exposures/8,0,1)*60+clamp(setCompletionRate,0,1)*20+clamp(predictionCount/6,0,1)*20);
  return {level:score>=75?'high':score>=45?'medium':'low',score,evidence:exposures+' session'+(exposures===1?'':'s')+(predictionCount?' · '+predictionCount+' prediction'+(predictionCount===1?'':'s')+' checked':'')};
}
function recommendationGate(model){
  const mode=String(model?.loadMode||'');
  const primary=['bodyweight','timed','band','assisted'].includes(mode)?'reps':'weight';
  const target=variableGate(model,primary),rest=variableGate(model,'rest');
  if(target.rollback||rest.rollback)return {level:'suggest',label:'PARTIAL ROLLBACK',reason:'At least one learner variable was returned to suggestion mode after weak intervention outcomes'};
  if(target.level==='influence'||rest.level==='influence')return {level:'influence',label:'READY TO INFLUENCE',reason:'At least one variable-specific gate has enough evidence for narrow automatic influence'};
  if(target.level==='suggest'||rest.level==='suggest')return {level:'suggest',label:'SUGGEST ONLY',reason:'Evidence supports suggestions but no variable is cleared for automatic influence'};
  return {level:'observe',label:'OBSERVE ONLY',reason:'Variable-specific evidence is still being collected'};
}
function variableConfidence(model,variable){
  const metrics=model?.metrics||{},exposures=n(model?.exposures),predictions=n(model?.predictionCount),completion=n(metrics.setCompletionRate);
  const observations=model?.observations||[];
  let evidence=exposures,checks=predictions,supported=true;
  if(variable==='weight')supported=!['bodyweight','timed','band','assisted'].includes(model?.loadMode||'');
  if(variable==='rest'){evidence=observations.filter(item=>n(item.averageRestSeconds)>0).length;checks=evidence;}
  if(variable==='readiness'){evidence=observations.filter(item=>n(item.readinessScore)>0).length;checks=evidence;}
  if(variable==='volume'){evidence=exposures;checks=Math.min(exposures,6);}
  if(!supported)return {level:'unavailable',score:0,evidence:0,checks:0,supported:false};
  const score=Math.round(clamp(evidence/8,0,1)*60+clamp(completion,0,1)*20+clamp(checks/6,0,1)*20);
  return {level:score>=75?'high':score>=45?'medium':'low',score,evidence,checks,supported:true};
}
function interventionStats(model,variable){
  const item=model?.interventions?.[variable]||{};
  const applied=n(item.applied),successes=n(item.successes),failures=n(item.failures);
  return {applied,successes,failures,successRate:applied?successes/applied:null};
}
function delayedInterventionStats(model,variable){
  const item=model?.delayedInterventions?.[variable]||{};
  const evaluated=n(item.evaluated),successes=n(item.successes),failures=n(item.failures);
  return {evaluated,successes,failures,successRate:evaluated?successes/evaluated:null};
}
function variableGate(model,variable){
  const conf=variableConfidence(model,variable),metrics=model?.metrics||{},stats=interventionStats(model,variable),delayed=delayedInterventionStats(model,variable);
  if(!conf.supported)return {level:'unavailable',label:'NOT USED',reason:'This variable is not controlled for this movement type',confidence:conf};
  if(stats.applied>=3&&stats.successRate!==null&&stats.successRate<.5){
    return {level:'suggest',label:'ROLLED BACK',reason:'Applied learner changes underperformed in recent outcome checks, so automatic influence is paused',confidence:conf,rollback:true};
  }
  if(variable==='volume'&&delayed.evaluated>=2&&delayed.successRate!==null&&delayed.successRate<.5){
    return {level:'suggest',label:'DELAYED HOLD',reason:'Follow-up performance after volume experiments has been weak, so new controlled volume tests are paused.',confidence:conf,rollback:true};
  }
  const completion=n(metrics.setCompletionRate),hit=metrics.targetHitRate;
  if(variable==='weight'){
    const ready=n(model?.exposures)>=6&&n(model?.predictionCount)>=4&&completion>=.8&&(hit===null||hit===undefined||n(hit)>=.65)&&(metrics.averageWeightPredictionError===null||metrics.averageWeightPredictionError===undefined||n(metrics.averageWeightPredictionError)<=5);
    if(ready)return {level:'influence',label:'READY TO INFLUENCE',reason:'Load evidence is stable enough for conservative guardrails',confidence:conf};
    if(n(model?.exposures)>=3&&n(model?.predictionCount)>=2&&completion>=.7)return {level:'suggest',label:'SUGGEST ONLY',reason:'Load evidence can support suggestions but not automatic changes',confidence:conf};
  }else if(variable==='reps'){
    const ready=n(model?.exposures)>=6&&n(model?.predictionCount)>=4&&completion>=.8&&(hit===null||hit===undefined||n(hit)>=.65)&&(metrics.averageRepsPredictionError===null||metrics.averageRepsPredictionError===undefined||n(metrics.averageRepsPredictionError)<=1.5);
    if(ready)return {level:'influence',label:'READY TO INFLUENCE',reason:'Rep evidence is stable enough for conservative guardrails',confidence:conf};
    if(n(model?.exposures)>=3&&n(model?.predictionCount)>=2&&completion>=.7)return {level:'suggest',label:'SUGGEST ONLY',reason:'Rep evidence can support suggestions but not automatic changes',confidence:conf};
  }else if(variable==='rest'){
    if(conf.evidence>=6&&completion>=.8)return {level:'influence',label:'READY TO INFLUENCE',reason:'Rest timing has enough repeated observations to test personalized recovery',confidence:conf};
    if(conf.evidence>=4&&completion>=.7)return {level:'suggest',label:'SUGGEST ONLY',reason:'Rest timing has enough observations for a visible suggestion',confidence:conf};
  }else if(variable==='volume'){
    if(n(model?.exposures)>=8&&completion>=.8)return {level:'suggest',label:'CONTROLLED TESTS',reason:'Volume has enough evidence for occasional one-set controlled experiments. Experiments are isolated, readiness-gated, and followed by a later performance check.',confidence:conf};
    if(n(model?.exposures)>=6&&completion>=.75)return {level:'suggest',label:'SHADOW TESTS',reason:'Volume has enough evidence to test 2, 3, or 4 working-set candidates in shadow mode. Set count stays unchanged.',confidence:conf};
  }else if(variable==='readiness'){
    if(conf.evidence>=6)return {level:'suggest',label:'SUGGEST ONLY',reason:'Readiness-performance patterns are visible but do not control workouts yet',confidence:conf};
  }
  return {level:'observe',label:'OBSERVE ONLY',reason:'More variable-specific evidence is required',confidence:conf};
}
function variableGates(model){
  return {
    weight:variableGate(model,'weight'),
    reps:variableGate(model,'reps'),
    rest:variableGate(model,'rest'),
    volume:variableGate(model,'volume'),
    readiness:variableGate(model,'readiness')
  };
}
function restProposal(model,target={}){
  const gate=variableGate(model,'rest'),base=Math.max(30,n(target.restSeconds)||45);
  const observations=(model?.observations||[]).filter(item=>n(item.averageRestSeconds)>0&&item.completionRate!==undefined).slice(-10);
  const proposed={restSeconds:base};
  if(observations.length<4)return {action:'observe',applied:false,changed:false,variable:'rest',gate,base:{restSeconds:base},proposed,reason:'More completed rest observations are needed before personalizing the timer.',evidence:{observations:observations.length}};
  const sorted=[...observations].sort((a,b)=>n(a.averageRestSeconds)-n(b.averageRestSeconds));
  const cut=Math.floor(sorted.length/2),short=sorted.slice(0,cut),long=sorted.slice(cut);
  const shortRest=mean(short.map(item=>item.averageRestSeconds)),longRest=mean(long.map(item=>item.averageRestSeconds));
  const shortDrop=mean(short.map(item=>item.repDrop)),longDrop=mean(long.map(item=>item.repDrop));
  const shortCompletion=mean(short.map(item=>item.completionRate)),longCompletion=mean(long.map(item=>item.completionRate));
  const longerLooksBetter=longRest-shortRest>=10&&longDrop<=shortDrop-.75&&longCompletion>=shortCompletion-.05;
  if(!longerLooksBetter)return {action:'validate',applied:false,changed:false,variable:'rest',gate,base:{restSeconds:base},proposed,reason:'Longer rest has not shown a consistent enough performance advantage yet.',evidence:{observations:observations.length,shortRest:round(shortRest,1),longRest:round(longRest,1),shortRepDrop:round(shortDrop,2),longRepDrop:round(longDrop,2)}};
  const candidate=clamp(Math.round(longRest/15)*15,base+15,120);
  if(candidate<=base)return {action:'validate',applied:false,changed:false,variable:'rest',gate,base:{restSeconds:base},proposed,reason:'Your current timer already matches the stronger rest range.',evidence:{observations:observations.length}};
  proposed.restSeconds=candidate;
  const action=gate.level==='influence'?'apply':gate.level==='suggest'?'suggest':'observe';
  return {
    action,applied:action==='apply',changed:true,variable:'rest',gate,base:{restSeconds:base},proposed,
    reason:'Longer observed rests were associated with lower rep drop-off without reducing set completion. The timer moves toward that stronger range.',
    evidence:{observations:observations.length,shortRest:round(shortRest,1),longRest:round(longRest,1),shortRepDrop:round(shortDrop,2),longRepDrop:round(longDrop,2),shortCompletion:round(shortCompletion,3),longCompletion:round(longCompletion,3)}
  };
}
function volumeProfile(model){
  const observations=(model?.observations||[]).filter(item=>n(item.plannedSets)>0);
  const buckets={2:[],3:[],4:[]};
  for(const item of observations){
    const sets=Math.round(n(item.plannedSets));
    if(buckets[sets])buckets[sets].push(item);
  }
  const summarize=items=>{
    if(!items.length)return {sessions:0,completion:null,repDrop:null,targetHitRate:null,hardRate:null,quality:null};
    const completion=mean(items.map(item=>n(item.completionRate)));
    const repDrop=mean(items.map(item=>n(item.repDrop)));
    const hard=items.filter(item=>['hard','too-hard','form-off'].includes(item.feedback)).length/items.length;
    const checked=items.filter(item=>item.predictionHit!==null&&item.predictionHit!==undefined);
    const hit=checked.length?checked.filter(item=>item.predictionHit).length/checked.length:null;
    const quality=completion-clamp(repDrop/10,0,.3)-hard*.15+(hit===null?0:hit*.05);
    return {sessions:items.length,completion:round(completion,3),repDrop:round(repDrop,2),targetHitRate:hit===null?null:round(hit,3),hardRate:round(hard,3),quality:round(quality,3)};
  };
  const bySetCount={2:summarize(buckets[2]),3:summarize(buckets[3]),4:summarize(buckets[4])};
  const testedSetCounts=[2,3,4].filter(sets=>bySetCount[sets].sessions>0);
  const comparable=testedSetCounts.filter(sets=>bySetCount[sets].sessions>=2);
  const bestSetCount=comparable.length>=2?comparable.slice().sort((a,b)=>n(bySetCount[b].quality)-n(bySetCount[a].quality))[0]:null;
  return {observations:observations.length,testedSetCounts,comparableSetCounts:comparable,bestSetCount,bySetCount};
}
function volumeShadowProposal(model,target={},exercise={}){
  const gate=variableGate(model,'volume');
  const profile=volumeProfile(model);
  const baseSets=clamp(Math.round(n(target.sets)||n(model?.observations?.[model.observations.length-1]?.plannedSets)||3),2,4);
  const base={sets:baseSets,weight:n(target.weight),reps:n(target.reps),restSeconds:n(target.restSeconds)};
  const proposed={...base};
  if(exercise?.blockId){
    return {action:'observe',applied:false,changed:false,variable:'volume',gate,base,proposed,profile,direction:'hold',reason:'Circuit and superset volume stays under the block plan while movement-level volume learning is in shadow mode.'};
  }
  if(!['suggest','influence'].includes(gate.level)){
    return {action:'observe',applied:false,changed:false,variable:'volume',gate,base,proposed,profile,direction:'hold',reason:'More completed exposures are needed before testing a different working-set count.'};
  }
  const recent=(model?.observations||[]).filter(item=>n(item.plannedSets)>0).slice(-3);
  const stable=recent.length>=3&&recent.every(item=>n(item.completionRate)>=.9&&n(item.repDrop)<=1.5&&!['hard','too-hard','form-off'].includes(item.feedback));
  const fatigueSignals=recent.filter(item=>n(item.completionRate)<.85||n(item.repDrop)>=2.5||['hard','too-hard','form-off'].includes(item.feedback)).length;
  let candidate=baseSets,direction='hold',reason='Current set count remains the strongest shadow baseline.';
  const best=profile.bestSetCount;
  const bestStats=best?profile.bySetCount[best]:null;
  const baseStats=profile.bySetCount[baseSets];
  const comparativeAdvantage=best&&best!==baseSets&&bestStats?.sessions>=2&&baseStats?.sessions>=2&&n(bestStats.quality)>=n(baseStats.quality)+.05;
  if(comparativeAdvantage){
    candidate=best;
    direction=candidate>baseSets?'test-more':'test-less';
    reason=candidate+' working sets have produced the stronger combination of completion, rep stability, and feedback in repeated observations. GoWorkout will shadow-test that set count without changing this workout.';
  }else if(fatigueSignals>=2&&baseSets>2){
    candidate=baseSets-1;
    direction='test-less';
    reason='Recent sessions show repeated fatigue signals. GoWorkout will shadow-test whether one fewer working set would preserve performance without changing this workout.';
  }else if(stable&&baseSets<4){
    candidate=baseSets+1;
    direction='test-more';
    reason='Recent sessions are stable enough to test whether one additional working set may be tolerated. The extra set stays hypothetical until more evidence is collected.';
  }else if(stable&&baseSets===4&&profile.bySetCount[3].sessions<2){
    candidate=3;
    direction='test-less';
    reason='Four sets are stable, but the learner lacks a comparable three-set sample. It will shadow-test three sets to improve the 2 vs 3 vs 4 comparison.';
  }
  proposed.sets=candidate;
  if(candidate===baseSets){
    return {action:'validate',applied:false,changed:false,variable:'volume',gate,base,proposed,profile,direction,reason,evidence:{recent:recent.length,fatigueSignals,stable,testedSetCounts:profile.testedSetCounts}};
  }
  return {
    action:'shadow',applied:false,changed:true,variable:'volume',gate,base,proposed,profile,direction,reason,
    evidence:{recent:recent.length,fatigueSignals,stable,testedSetCounts:profile.testedSetCounts,baseStats,bestSetCount:best,bestStats}
  };
}
function volumeExperimentProposal(model,target={},exercise={},context={}){
  const gate=variableGate(model,'volume');
  const shadow=volumeShadowProposal(model,target,exercise);
  const base={...shadow.base},proposed={...shadow.proposed};
  const readiness=n(context.readinessScore);
  const observations=(model?.observations||[]).filter(item=>n(item.plannedSets)>0);
  const lastExperimentIndex=observations.map(item=>Boolean(item.volumeExperiment?.applied)).lastIndexOf(true);
  const exposuresSinceExperiment=lastExperimentIndex<0?observations.length:Math.max(0,observations.length-1-lastExperimentIndex);
  const immediate=interventionStats(model,'volume'),delayed=delayedInterventionStats(model,'volume');
  const difference=Math.round(n(proposed.sets)-n(base.sets));
  const evidenceReady=gate.label==='CONTROLLED TESTS'&&!gate.rollback;
  const readinessReady=readiness>=3;
  const cooldownReady=lastExperimentIndex<0||exposuresSinceExperiment>=2;
  const outcomeReady=!(immediate.applied>=3&&immediate.successRate!==null&&immediate.successRate<.5)&&!(delayed.evaluated>=2&&delayed.successRate!==null&&delayed.successRate<.5);
  if(exercise?.blockId){
    return {...shadow,action:'shadow',applied:false,experiment:false,reason:'Circuit and superset volume stays under the block plan. Controlled volume experiments only run on standalone movements.'};
  }
  if(context.alreadyApplied){
    return {...shadow,action:'shadow',applied:false,experiment:false,reason:'Only one controlled volume experiment runs in a workout so its result is easier to interpret.'};
  }
  if(!evidenceReady||shadow.action!=='shadow'||Math.abs(difference)!==1){
    return {...shadow,action:shadow.action==='shadow'?'shadow':'observe',applied:false,experiment:false,reason:shadow.action==='shadow'?'The set-count idea stays in shadow mode until the movement reaches the controlled-test evidence gate.':shadow.reason};
  }
  if(!readinessReady){
    return {...shadow,action:'shadow',applied:false,experiment:false,reason:'The volume candidate stays in shadow mode because today’s readiness is below the controlled-test threshold.'};
  }
  if(!cooldownReady){
    return {...shadow,action:'shadow',applied:false,experiment:false,reason:'The volume candidate stays in shadow mode until at least two normal exposures separate controlled tests.'};
  }
  if(!outcomeReady){
    return {...shadow,action:'shadow',applied:false,experiment:false,reason:'New volume experiments are paused because recent immediate or delayed experiment outcomes have been weak.'};
  }
  const from=Math.round(n(base.sets)),to=clamp(from+difference,2,4);
  proposed.sets=to;
  return {
    ...shadow,
    action:'experiment',applied:true,experiment:true,changed:true,variable:'volume',base,proposed,
    direction:to>from?'test-more':'test-less',
    reason:(to>from
      ?'A controlled test will add one working set for this movement today.'
      :'A controlled test will remove one working set for this movement today.')+
      ' GoWorkout will check the immediate result and the next exposure before treating the change as useful.',
    evidence:{...(shadow.evidence||{}),readinessScore:readiness,exposuresSinceExperiment,immediateSuccessRate:immediate.successRate,delayedSuccessRate:delayed.successRate}
  };
}
function upwardShadowProposal(model,target={},exercise={}){
  const mode=String(exercise.loadMode||model?.loadMode||''),variable=['bodyweight','timed'].includes(mode)?'reps':'weight';
  const gate=variableGate(model,variable),base={weight:n(target.weight),reps:n(target.reps),restSeconds:n(target.restSeconds),sets:n(target.sets)};
  const recent=(model?.observations||[]).slice(-3),metrics=model?.metrics||{};
  const stable=recent.length>=3&&recent.every(item=>n(item.completionRate)>=.9&&item.predictionHit!==false&&!['hard','too-hard','form-off'].includes(item.feedback));
  const supported=!['band','assisted'].includes(mode);
  const accurate=(metrics.targetHitRate===null||metrics.targetHitRate===undefined||n(metrics.targetHitRate)>=.75)&&n(metrics.averageRepDrop)<=1.25&&n(metrics.targetAdjustmentRate)<=.15;
  const proposed={...base};
  if(!supported||!stable||!accurate||!['suggest','influence'].includes(gate.level)){
    return {action:'observe',applied:false,changed:false,variable,gate,base,proposed,reason:'Upward shadow testing waits for stable completion, low rep drop-off, low manual adjustment, and accurate recent predictions.'};
  }
  if(variable==='weight'){
    const increment=Math.max(1,n(exercise.increment)||5);
    proposed.weight=base.weight+increment;
    proposed.reps=Math.max(1,base.reps);
  }else{
    proposed.reps=base.reps+(mode==='timed'?5:2);
  }
  return {
    action:'shadow',applied:false,changed:true,variable,gate,base,proposed,
    reason:'Stable recent performance supports testing a higher target in shadow mode. GoWorkout records this candidate but does not change the workout.',
    evidence:{exposures:n(model?.exposures),predictions:n(model?.predictionCount),targetHitRate:metrics.targetHitRate??null,averageRepDrop:metrics.averageRepDrop??null,targetAdjustmentRate:metrics.targetAdjustmentRate??null}
  };
}
function readinessRelationship(model){
  const observations=(model?.observations||[]).filter(item=>n(item.readinessScore)>0);
  const low=observations.filter(item=>n(item.readinessScore)<=2.5);
  const ready=observations.filter(item=>n(item.readinessScore)>=3.5);
  if(low.length<2||ready.length<2){
    return {available:false,lowCount:low.length,readyCount:ready.length,label:'COLLECTING',detail:'Need at least 2 low-readiness and 2 normal-readiness exposures before comparing performance.'};
  }
  const summarize=items=>({
    completion:mean(items.map(item=>n(item.completionRate))),
    repDrop:mean(items.map(item=>n(item.repDrop))),
    reps:mean(items.map(item=>n(item.averageReps)))
  });
  const lowStats=summarize(low),readyStats=summarize(ready);
  const completionDelta=lowStats.completion-readyStats.completion;
  const repDropDelta=lowStats.repDrop-readyStats.repDrop;
  let label='NO CLEAR EFFECT',detail='Readiness has not produced a consistent performance difference yet.';
  if(completionDelta<=-.08||repDropDelta>=.75){
    label='LOW READINESS COST';
    detail='Lower-readiness sessions show lower completion or more rep drop-off than normal-readiness sessions.';
  }else if(completionDelta>=.05&&repDropDelta<=-.5){
    label='LOW READINESS STABLE';
    detail='Performance has stayed stable even on lower-readiness sessions so far.';
  }
  return {
    available:true,label,detail,
    lowCount:low.length,readyCount:ready.length,
    low:{completion:round(lowStats.completion,3),repDrop:round(lowStats.repDrop,2),averageReps:round(lowStats.reps,2)},
    ready:{completion:round(readyStats.completion,3),repDrop:round(readyStats.repDrop,2),averageReps:round(readyStats.reps,2)},
    delta:{completion:round(completionDelta,3),repDrop:round(repDropDelta,2)}
  };
}
function targetProposal(model,target={},exercise={}){
  const mode=String(exercise.loadMode||model?.loadMode||''),variable=['bodyweight','timed'].includes(mode)?'reps':'weight',gate=variableGate(model,variable),base={weight:n(target.weight),reps:n(target.reps),restSeconds:n(target.restSeconds),sets:n(target.sets)};
  const recent=(model?.observations||[]).slice(-3),latest=recent[recent.length-1]||null;
  const hardCount=recent.filter(item=>['hard','too-hard','form-off'].includes(item.feedback)).length;
  const misses=recent.filter(item=>item.predictionHit===false).length;
  const metrics=model?.metrics||{};
  const conservative=hardCount>=2||misses>=2||n(metrics.averageRepDrop)>=2.5||n(metrics.targetAdjustmentRate)>=.35;
  const stable=recent.length>=2&&recent.every(item=>n(item.completionRate)>=.9&&item.predictionHit!==false&&!['too-hard','form-off'].includes(item.feedback))&&n(metrics.averageRepDrop)<=1.5;
  const supported=!['band','assisted'].includes(mode);
  const proposed={...base};
  let changed=false,direction='validate',reason='Learner evidence supports the existing rule-based target.';
  if(!supported){
    reason='This movement type stays under the rule-based progression system in the first influence rollout.';
  }else if(conservative){
    if(!['bodyweight','timed'].includes(mode)){
      const bestWeight=n(model?.currentBest?.weight);
      const bestReps=n(model?.currentBest?.reps);
      if(bestWeight>0&&base.weight>bestWeight){
        proposed.weight=bestWeight;
        if(bestReps>0&&base.reps>bestReps)proposed.reps=bestReps;
        changed=true;direction='hold';
        reason='Recent misses, rep drop-off, or manual target changes make the planned load look aggressive. Hold at the demonstrated best instead of advancing.';
      }
    }else{
      const demonstrated=Math.max(1,Math.round(n(latest?.averageReps)||n(model?.currentBest?.reps)||base.reps));
      if(base.reps>demonstrated){
        proposed.reps=demonstrated;changed=true;direction='hold';
        reason='Recent performance does not support the higher rep or time target yet. Hold at the demonstrated level.';
      }
    }
  }else if(stable){
    reason='Recent completion and prediction accuracy support the existing progression target. No extra increase is added.';
  }else{
    reason='Evidence is mixed, so the learner leaves the existing progression target unchanged.';
  }
  const eligible=gate.level==='influence'&&supported;
  const action=changed?(eligible?'apply':gate.level==='suggest'?'suggest':'observe'):'validate';
  return {
    action,applied:action==='apply',changed,direction,variable,gate,
    base,proposed,
    reason,
    evidence:{exposures:n(model?.exposures),predictions:n(model?.predictionCount),targetHitRate:metrics.targetHitRate??null,averageRepDrop:metrics.averageRepDrop??null,targetAdjustmentRate:metrics.targetAdjustmentRate??null,recentMisses:misses,recentHardSignals:hardCount}
  };
}
function addDecision(value,decision){
  const learner=normalizeLearner(value);
  learner.decisions=Array.isArray(learner.decisions)?learner.decisions:[];
  learner.decisions.push(decision);
  learner.decisions=learner.decisions.slice(-300);
  learner.updatedAt=new Date().toISOString();
  return learner;
}
function emptyLearner(){return {schemaVersion:SCHEMA_VERSION,version:VERSION,createdAt:new Date().toISOString(),updatedAt:null,models:{},events:[],predictions:[],evaluations:[],decisions:[],outcomes:[],delayedOutcomes:[],processedWorkoutIds:[]};}
function normalizeLearner(value){
  const learner=value&&typeof value==='object'?value:emptyLearner();
  learner.schemaVersion=SCHEMA_VERSION;learner.version=VERSION;
  learner.models=learner.models&&typeof learner.models==='object'?learner.models:{};
  learner.events=Array.isArray(learner.events)?learner.events:[];
  learner.predictions=Array.isArray(learner.predictions)?learner.predictions:[];
  learner.evaluations=Array.isArray(learner.evaluations)?learner.evaluations:[];
  learner.decisions=Array.isArray(learner.decisions)?learner.decisions:[];
  learner.outcomes=Array.isArray(learner.outcomes)?learner.outcomes:[];
  learner.delayedOutcomes=Array.isArray(learner.delayedOutcomes)?learner.delayedOutcomes:[];
  learner.processedWorkoutIds=Array.isArray(learner.processedWorkoutIds)?learner.processedWorkoutIds:[];
  learner.createdAt=learner.createdAt||new Date().toISOString();
  const eventMap=new Map(learner.events.map(event=>[event.workoutId+'::'+event.exerciseId,event]));
  Object.values(learner.models||{}).forEach(model=>{
    model.observations=(model.observations||[]).map(observation=>{
      const event=eventMap.get(observation.workoutId+'::'+model.exerciseId);
      if(!event)return observation;
      return {
        ...observation,
        averageRestSeconds:observation.averageRestSeconds??event.actual?.averageRestSeconds??null,
        plannedSets:observation.plannedSets??event.planned?.sets??0,
        completedSets:observation.completedSets??event.actual?.completedSets??0,
        volumeExperiment:observation.volumeExperiment??event.volumeExperiment??null,
        readinessScore:observation.readinessScore??event.readiness?.score??0,
        energy:observation.energy??event.readiness?.energy??0,
        sleep:observation.sleep??event.readiness?.sleep??0,
        soreness:observation.soreness??event.readiness?.soreness??0
      };
    });
    model.variableGates=variableGates(model);
    model.readinessRelationship=readinessRelationship(model);
    model.volumeProfile=volumeProfile(model);
  });
  return learner;
}
function predictionForExercise(exercise,model,context={}){
  const conf=model?.confidence||confidence(0,0,0);
  return {
    id:'prediction-'+String(context.workoutId||'workout')+'-'+String(exercise.id||'exercise'),
    workoutId:context.workoutId||'',exerciseId:exercise.id||'',exerciseName:exercise.name||'Exercise',loadMode:exercise.loadMode||'',
    createdAt:context.createdAt||new Date().toISOString(),scheduledDate:context.scheduledDate||'',routineName:context.routineName||'',
    target:{weight:n(exercise.suggestedWeight),reps:n(exercise.suggestedReps),restSeconds:n(exercise.rest),sets:Array.isArray(exercise.sets)?exercise.sets.length:n(exercise.sets)},
    source:exercise.learnerTarget?.applied?'adaptive-learner':exercise.adaptiveLabel?'learned':exercise.engineExerciseId?'program-engine':'plan',
    reason:exercise.learnerTarget?.applied?(exercise.learnerTarget.reason||'Adaptive learner guardrail applied'):exercise.adaptiveReason||exercise.engineReason?.[0]||'Current planned target',confidence:conf
  };
}
function eventFromExercise(workout,exercise,index=0){
  const sets=Array.isArray(exercise.sets)?exercise.sets:[],completed=sets.filter(set=>set?.completed);
  if(!completed.length)return null;
  const weights=completed.map(set=>n(set.weight)),reps=completed.map(set=>n(set.reps)),durations=completed.map(set=>n(set.durationSeconds)).filter(Boolean);
  const plannedWeights=completed.filter(set=>set.plannedWeight!==undefined&&set.plannedWeight!==null&&set.plannedWeight!=='').map(set=>n(set.plannedWeight));
  const plannedReps=completed.filter(set=>set.plannedReps!==undefined&&set.plannedReps!==null&&set.plannedReps!=='').map(set=>n(set.plannedReps));
  const rests=(workout.restLog||[]).filter(item=>item?.fromExerciseId===exercise.id&&item.endedAt);
  const actualRests=rests.map(item=>n(item.actualSeconds)).filter(Boolean);
  const best=completed.reduce((winner,set)=>{const candidate={weight:n(set.weight),reps:n(set.reps)};return !winner||candidate.weight>winner.weight||(candidate.weight===winner.weight&&candidate.reps>winner.reps)?candidate:winner;},null);
  return {
    id:'event-'+String(workout.id||'workout')+'-'+String(exercise.id||index),workoutId:workout.id||'',exerciseId:exercise.id||'',exerciseName:exercise.name||'Exercise',
    routineName:workout.routineName||'',completedAt:workout.completedAt||new Date().toISOString(),scheduledDate:workout.scheduledDate||'',exerciseIndex:index,loadMode:exercise.loadMode||'',feedback:exercise.feedback||'',
    readiness:{score:n(workout.readiness?.score),energy:n(workout.readiness?.energy),sleep:n(workout.readiness?.sleep),soreness:n(workout.readiness?.soreness)},
    context:{exerciseOrder:index+1,warmupSkipped:Boolean(workout.warmupSkipped),setupKey:workout.trainingContext?.key||'',sessionDurationMinutes:n(workout.durationMinutes),activeDurationSeconds:n(workout.activeDurationSeconds)},
    volumeExperiment:exercise.learnerVolumeExperiment?.applied?{applied:true,decisionId:exercise.learnerVolumeExperiment.decisionId||'',baseSets:n(exercise.learnerVolumeExperiment.base?.sets),proposedSets:n(exercise.learnerVolumeExperiment.proposed?.sets),direction:exercise.learnerVolumeExperiment.direction||''}:null,
    planned:{sets:sets.length,weight:plannedWeights.length?mean(plannedWeights):n(exercise.suggestedWeight),reps:plannedReps.length?mean(plannedReps):n(exercise.suggestedReps),restSeconds:n(exercise.rest)},
    actual:{completedSets:completed.length,completionRate:sets.length?completed.length/sets.length:0,averageWeight:round(mean(weights),2),averageReps:round(mean(reps),2),minReps:reps.length?Math.min(...reps):0,maxReps:reps.length?Math.max(...reps):0,repDrop:Math.max(0,(reps[0]||0)-(reps[reps.length-1]||0)),averageSetDurationSeconds:round(mean(durations),1),averageRestSeconds:actualRests.length?round(mean(actualRests),1):null,skippedRests:rests.filter(item=>item.skipped).length,targetAdjustedSets:completed.filter(set=>set.targetAdjusted).length,best:best||{weight:0,reps:0}}
  };
}
function evaluatePrediction(prediction,event){
  if(!prediction||!event)return null;
  const target=prediction.target||{},actual=event.actual||{},weighted=n(target.weight)>0;
  return {
    id:'evaluation-'+prediction.id,predictionId:prediction.id,workoutId:event.workoutId,exerciseId:event.exerciseId,exerciseName:event.exerciseName,evaluatedAt:event.completedAt,
    targetHit:Boolean(actual.completedSets>=Math.max(1,n(target.sets))&&(!weighted||n(actual.averageWeight)>=n(target.weight))&&n(actual.minReps)>=Math.max(1,n(target.reps))),
    weightError:weighted?round(Math.abs(n(actual.averageWeight)-n(target.weight)),2):0,repsError:round(Math.abs(n(actual.averageReps)-n(target.reps)),2),planned:target,
    actual:{averageWeight:n(actual.averageWeight),averageReps:n(actual.averageReps),minReps:n(actual.minReps),completedSets:n(actual.completedSets)}
  };
}
function updateModel(existing,event,evaluation=null){
  const model=existing?JSON.parse(JSON.stringify(existing)):{exerciseId:event.exerciseId,exerciseName:event.exerciseName,loadMode:event.loadMode||'',exposures:0,plannedSets:0,completedSets:0,targetHits:0,predictionCount:0,weightAbsoluteErrorTotal:0,repsAbsoluteErrorTotal:0,repDropTotal:0,setDurationTotal:0,setDurationCount:0,restTotal:0,restCount:0,targetAdjustedSets:0,feedbackCounts:{},observations:[],firstObservedAt:event.completedAt,currentBest:{weight:0,reps:0}};
  for(const key of ['exposures','plannedSets','completedSets','targetHits','predictionCount','weightAbsoluteErrorTotal','repsAbsoluteErrorTotal','repDropTotal','setDurationTotal','setDurationCount','restTotal','restCount','targetAdjustedSets'])model[key]=n(model[key]);
  model.feedbackCounts=model.feedbackCounts&&typeof model.feedbackCounts==='object'?model.feedbackCounts:{};
  model.observations=Array.isArray(model.observations)?model.observations:[];
  model.currentBest=model.currentBest&&typeof model.currentBest==='object'?model.currentBest:{weight:0,reps:0};
  model.interventions=model.interventions&&typeof model.interventions==='object'?model.interventions:{};
  model.delayedInterventions=model.delayedInterventions&&typeof model.delayedInterventions==='object'?model.delayedInterventions:{};
  model.exerciseName=event.exerciseName||model.exerciseName;model.exposures+=1;model.plannedSets+=n(event.planned?.sets);model.completedSets+=n(event.actual?.completedSets);model.repDropTotal+=n(event.actual?.repDrop);model.targetAdjustedSets+=n(event.actual?.targetAdjustedSets);
  if(n(event.actual?.averageSetDurationSeconds)>0){model.setDurationTotal+=n(event.actual.averageSetDurationSeconds);model.setDurationCount+=1;}
  if(n(event.actual?.averageRestSeconds)>0){model.restTotal+=n(event.actual.averageRestSeconds);model.restCount+=1;}
  if(event.feedback){model.feedbackCounts[event.feedback]=(model.feedbackCounts[event.feedback]||0)+1;model.lastFeedback=event.feedback;}
  const best=event.actual?.best||{weight:0,reps:0};
  if(n(best.weight)>n(model.currentBest?.weight)||(n(best.weight)===n(model.currentBest?.weight)&&n(best.reps)>n(model.currentBest?.reps)))model.currentBest={weight:n(best.weight),reps:n(best.reps)};
  if(evaluation){model.predictionCount+=1;if(evaluation.targetHit)model.targetHits+=1;model.weightAbsoluteErrorTotal+=n(evaluation.weightError);model.repsAbsoluteErrorTotal+=n(evaluation.repsError);}
  const observation={workoutId:event.workoutId,completedAt:event.completedAt,weight:n(best.weight),reps:n(best.reps),averageWeight:n(event.actual?.averageWeight),averageReps:n(event.actual?.averageReps),completionRate:n(event.actual?.completionRate),repDrop:n(event.actual?.repDrop),averageRestSeconds:event.actual?.averageRestSeconds??null,plannedSets:n(event.planned?.sets),completedSets:n(event.actual?.completedSets),volumeExperiment:event.volumeExperiment||null,readinessScore:n(event.readiness?.score),energy:n(event.readiness?.energy),sleep:n(event.readiness?.sleep),soreness:n(event.readiness?.soreness),feedback:event.feedback||'',predictionHit:evaluation?Boolean(evaluation.targetHit):null};
  model.observations=[...(model.observations||[]),observation].slice(-20);model.lastObservedAt=event.completedAt;
  const completionRate=model.plannedSets?model.completedSets/model.plannedSets:0,first=model.observations[0]||observation,latest=model.observations[model.observations.length-1]||observation,gap=Math.max(1,model.exposures-1);
  model.metrics={setCompletionRate:round(completionRate,3),targetHitRate:model.predictionCount?round(model.targetHits/model.predictionCount,3):null,averageRepDrop:round(model.repDropTotal/model.exposures,2),averageSetDurationSeconds:model.setDurationCount?round(model.setDurationTotal/model.setDurationCount,1):null,averageRestSeconds:model.restCount?round(model.restTotal/model.restCount,1):null,targetAdjustmentRate:model.completedSets?round(model.targetAdjustedSets/model.completedSets,3):0,averageWeightPredictionError:model.predictionCount?round(model.weightAbsoluteErrorTotal/model.predictionCount,2):null,averageRepsPredictionError:model.predictionCount?round(model.repsAbsoluteErrorTotal/model.predictionCount,2):null,weightProgressionPerExposure:round((n(latest.weight)-n(first.weight))/gap,2),repsProgressionPerExposure:round((n(latest.reps)-n(first.reps))/gap,2)};
  model.confidence=confidence(model.exposures,completionRate,model.predictionCount);
  model.variableGates=variableGates(model);
  model.readinessRelationship=readinessRelationship(model);
  model.volumeProfile=volumeProfile(model);
  model.gate=recommendationGate(model);
  return model;
}
function recentPerformanceBaseline(model){
  const observations=(model?.observations||[]).slice(-3);
  if(!observations.length)return {completion:1,repDrop:0,averageWeight:0,averageReps:0};
  return {
    completion:round(mean(observations.map(item=>n(item.completionRate))),3),
    repDrop:round(mean(observations.map(item=>n(item.repDrop))),2),
    averageWeight:round(mean(observations.map(item=>n(item.averageWeight))),2),
    averageReps:round(mean(observations.map(item=>n(item.averageReps))),2)
  };
}
function decisionOutcome(decision,event,modelBefore={}){
  if(!decision?.applied)return null;
  const variable=decision.variable||'weight',actual=event.actual||{},proposed=decision.proposed||{},plannedSets=Math.max(1,n(event.planned?.sets)||n(proposed.sets)||1);
  const weighted=n(proposed.weight)>0,targetCompleted=actual.completedSets>=plannedSets&&(!weighted||n(actual.averageWeight)>=n(proposed.weight))&&n(actual.minReps)>=Math.max(1,n(proposed.reps)||1);
  const priorDrop=modelBefore?.metrics?.averageRepDrop;
  let baseline={repDrop:priorDrop??null},success=targetCompleted,reason=targetCompleted?'The applied target was completed.':'The applied target was not fully completed.';
  if(variable==='rest'){
    const dropStable=priorDrop===null||priorDrop===undefined||n(actual.repDrop)<=n(priorDrop)+.25;
    success=targetCompleted&&dropStable;
    reason=success?'The longer rest preserved target completion without worsening rep drop-off.':'The rest intervention did not preserve both target completion and rep-drop behavior.';
  }else if(variable==='volume'&&decision.action==='experiment'){
    baseline=recentPerformanceBaseline(modelBefore);
    const completionStable=n(actual.completionRate)>=Math.max(.8,n(baseline.completion)-.05);
    const repDropStable=n(actual.repDrop)<=n(baseline.repDrop)+.75;
    const repsStable=n(baseline.averageReps)<=0||n(actual.averageReps)>=n(baseline.averageReps)-1;
    const loadStable=n(baseline.averageWeight)<=0||n(actual.averageWeight)>=n(baseline.averageWeight)*.95;
    const feedbackStable=!['hard','too-hard','form-off'].includes(event.feedback||'');
    success=targetCompleted&&completionStable&&repDropStable&&repsStable&&loadStable&&feedbackStable;
    reason=success
      ?'The controlled volume test was completed without a meaningful immediate drop in completion, reps, load, or rep stability.'
      :'The controlled volume test produced an immediate performance or feedback cost, so it will not be treated as a successful dose yet.';
  }
  return {
    id:'outcome-'+decision.id,decisionId:decision.id,workoutId:event.workoutId,exerciseId:event.exerciseId,exerciseName:event.exerciseName,variable,phase:'immediate',
    evaluatedAt:event.completedAt,success,reason,baseline,
    actual:{completedSets:n(actual.completedSets),completionRate:n(actual.completionRate),minReps:n(actual.minReps),averageWeight:n(actual.averageWeight),averageReps:n(actual.averageReps),repDrop:n(actual.repDrop),averageRestSeconds:actual.averageRestSeconds??null}
  };
}
function delayedVolumeOutcome(decision,event){
  if(!decision||decision.variable!=='volume'||decision.action!=='experiment'||!decision.outcome||decision.delayedOutcome||decision.workoutId===event.workoutId)return null;
  const baseline=decision.outcome.baseline||{},actual=event.actual||{};
  const completionStable=n(actual.completionRate)>=Math.max(.8,n(baseline.completion)-.05);
  const repDropStable=n(actual.repDrop)<=n(baseline.repDrop)+.75;
  const repsStable=n(baseline.averageReps)<=0||n(actual.averageReps)>=n(baseline.averageReps)-1;
  const loadStable=n(baseline.averageWeight)<=0||n(actual.averageWeight)>=n(baseline.averageWeight)*.95;
  const feedbackStable=!['hard','too-hard','form-off'].includes(event.feedback||'');
  const success=completionStable&&repDropStable&&repsStable&&loadStable&&feedbackStable;
  return {
    id:'delayed-'+decision.id+'-'+event.workoutId,decisionId:decision.id,experimentWorkoutId:decision.workoutId,followupWorkoutId:event.workoutId,
    exerciseId:event.exerciseId,exerciseName:event.exerciseName,variable:'volume',phase:'delayed',evaluatedAt:event.completedAt,success,
    direction:decision.direction||'',baseSets:n(decision.base?.sets),testedSets:n(decision.proposed?.sets),
    reason:success
      ?'The next exposure stayed within the pre-test performance range, so the volume experiment has both an immediate and delayed positive signal.'
      :'The next exposure fell outside the pre-test performance range, so the volume experiment gets a delayed caution signal.',
    baseline:{completion:n(baseline.completion),repDrop:n(baseline.repDrop),averageWeight:n(baseline.averageWeight),averageReps:n(baseline.averageReps)},
    actual:{completionRate:n(actual.completionRate),averageWeight:n(actual.averageWeight),averageReps:n(actual.averageReps),repDrop:n(actual.repDrop)}
  };
}
function applyDelayedInterventionOutcome(model,outcome){
  if(!model||!outcome)return model;
  model.delayedInterventions=model.delayedInterventions&&typeof model.delayedInterventions==='object'?model.delayedInterventions:{};
  const item=model.delayedInterventions[outcome.variable]||{evaluated:0,successes:0,failures:0,lastOutcomes:[]};
  item.evaluated+=1;
  if(outcome.success)item.successes+=1;else item.failures+=1;
  item.lastOutcomes=[...(item.lastOutcomes||[]),{evaluatedAt:outcome.evaluatedAt,success:outcome.success,decisionId:outcome.decisionId,followupWorkoutId:outcome.followupWorkoutId}].slice(-6);
  item.successRate=item.evaluated?round(item.successes/item.evaluated,3):null;
  model.delayedInterventions[outcome.variable]=item;
  model.variableGates=variableGates(model);
  model.gate=recommendationGate(model);
  return model;
}
function applyInterventionOutcome(model,outcome){
  if(!model||!outcome)return model;
  model.interventions=model.interventions||{};
  const item=model.interventions[outcome.variable]||{applied:0,successes:0,failures:0,lastOutcomes:[]};
  item.applied+=1;
  if(outcome.success)item.successes+=1;else item.failures+=1;
  item.lastOutcomes=[...(item.lastOutcomes||[]),{evaluatedAt:outcome.evaluatedAt,success:outcome.success,decisionId:outcome.decisionId}].slice(-6);
  item.successRate=item.applied?round(item.successes/item.applied,3):null;
  model.interventions[outcome.variable]=item;
  model.variableGates=variableGates(model);
  model.gate=recommendationGate(model);
  return model;
}
function addPredictions(value,predictions){
  const learner=normalizeLearner(value),ids=new Set(learner.predictions.map(item=>item.id));
  for(const item of predictions||[])if(item?.id&&!ids.has(item.id)){learner.predictions.push(item);ids.add(item.id);}
  learner.predictions=learner.predictions.slice(-300);learner.updatedAt=new Date().toISOString();return learner;
}
function recordWorkout(value,workout){
  const learner=normalizeLearner(value);
  if(!workout?.id||learner.processedWorkoutIds.includes(workout.id))return {learner,summary:null};
  const results=[];
  (workout.exercises||[]).forEach((exercise,index)=>{
    const event=eventFromExercise(workout,exercise,index);if(!event)return;
    const prediction=learner.predictions.find(item=>item.workoutId===event.workoutId&&item.exerciseId===event.exerciseId)||null;
    const evaluation=evaluatePrediction(prediction,event);
    const before=learner.models[event.exerciseId]||null;
    let updated=updateModel(before,event,evaluation);
    const pendingDelayed=[...learner.decisions].reverse().find(item=>item.exerciseId===event.exerciseId&&item.variable==='volume'&&item.action==='experiment'&&item.applied&&item.outcome&&!item.delayedOutcome&&item.workoutId!==event.workoutId)||null;
    if(pendingDelayed){
      const delayed=delayedVolumeOutcome(pendingDelayed,event);
      if(delayed){
        pendingDelayed.delayedOutcome=delayed;
        learner.delayedOutcomes.push(delayed);
        updated=applyDelayedInterventionOutcome(updated,delayed);
      }
    }
    const decisions=learner.decisions.filter(item=>item.workoutId===event.workoutId&&item.exerciseId===event.exerciseId&&item.applied&&!item.outcome);
    for(const decision of decisions){
      const outcome=decisionOutcome(decision,event,before||{});
      if(!outcome)continue;
      decision.outcome=outcome;
      learner.outcomes.push(outcome);
      updated=applyInterventionOutcome(updated,outcome);
    }
    learner.models[event.exerciseId]=updated;learner.events.push(event);if(evaluation)learner.evaluations.push(evaluation);
    results.push({event,evaluation,model:updated});
  });
  learner.events=learner.events.slice(-600);learner.evaluations=learner.evaluations.slice(-300);learner.outcomes=learner.outcomes.slice(-300);learner.delayedOutcomes=learner.delayedOutcomes.slice(-300);learner.processedWorkoutIds.push(workout.id);learner.processedWorkoutIds=learner.processedWorkoutIds.slice(-200);learner.updatedAt=workout.completedAt||new Date().toISOString();
  const evaluated=results.filter(item=>item.evaluation),hits=evaluated.filter(item=>item.evaluation.targetHit).length,strongest=results.slice().sort((a,b)=>(b.model?.confidence?.score||0)-(a.model?.confidence?.score||0))[0]||null;
  return {learner,summary:{exercisesObserved:results.length,predictionsEvaluated:evaluated.length,predictionHits:hits,predictionHitRate:evaluated.length?round(hits/evaluated.length,3):null,interventionsEvaluated:learner.outcomes.filter(item=>item.workoutId===workout.id).length,interventionsSuccessful:learner.outcomes.filter(item=>item.workoutId===workout.id&&item.success).length,volumeExperiments:learner.decisions.filter(item=>item.workoutId===workout.id&&item.variable==='volume'&&item.action==='experiment').length,delayedOutcomesEvaluated:learner.delayedOutcomes.filter(item=>item.followupWorkoutId===workout.id).length,delayedOutcomesSuccessful:learner.delayedOutcomes.filter(item=>item.followupWorkoutId===workout.id&&item.success).length,strongestExercise:strongest?{exerciseId:strongest.event.exerciseId,name:strongest.event.exerciseName,confidence:strongest.model.confidence}:null}};
}
function overview(value){
  const learner=normalizeLearner(value),models=Object.values(learner.models||{}),evaluated=learner.evaluations.length,hits=learner.evaluations.filter(item=>item.targetHit).length;
  const recent=learner.evaluations.slice(-20),recentHits=recent.filter(item=>item.targetHit).length;
  const weighted=learner.evaluations.filter(item=>n(item.planned?.weight)>0);
  const gates=models.reduce((acc,model)=>{const gate=model.gate||recommendationGate(model);acc[gate.level]=(acc[gate.level]||0)+1;return acc;},{observe:0,suggest:0,influence:0});
  const variableGateCounts={weight:{observe:0,suggest:0,influence:0,unavailable:0},reps:{observe:0,suggest:0,influence:0,unavailable:0},rest:{observe:0,suggest:0,influence:0,unavailable:0},volume:{observe:0,suggest:0,influence:0,unavailable:0},readiness:{observe:0,suggest:0,influence:0,unavailable:0}};
  models.forEach(model=>{const vg=variableGates(model);Object.keys(variableGateCounts).forEach(key=>{const level=vg[key]?.level||'observe';variableGateCounts[key][level]=(variableGateCounts[key][level]||0)+1;});});
  const outcomes=learner.outcomes||[],successful=outcomes.filter(item=>item.success).length,delayedOutcomes=learner.delayedOutcomes||[],delayedSuccessful=delayedOutcomes.filter(item=>item.success).length,rollbacks=models.reduce((sum,model)=>sum+Object.values(variableGates(model)).filter(gate=>gate.rollback).length,0);
  return {
    modeledExercises:models.length,
    highConfidence:models.filter(x=>x.confidence?.level==='high').length,
    mediumConfidence:models.filter(x=>x.confidence?.level==='medium').length,
    lowConfidence:models.filter(x=>x.confidence?.level==='low').length,
    predictionsEvaluated:evaluated,
    predictionHitRate:evaluated?round(hits/evaluated,3):null,
    recentPredictionHitRate:recent.length?round(recentHits/recent.length,3):null,
    averageRepsPredictionError:evaluated?round(mean(learner.evaluations.map(item=>item.repsError)),2):null,
    averageWeightPredictionError:weighted.length?round(mean(weighted.map(item=>item.weightError)),2):null,
    gateCounts:gates,
    variableGateCounts,
    interventionOutcomes:outcomes.length,
    interventionSuccessRate:outcomes.length?round(successful/outcomes.length,3):null,
    rollbackCount:rollbacks,
    upwardShadowCandidates:learner.decisions.filter(item=>item.action==='shadow'&&item.variable!=='volume').length,
    volumeShadowCandidates:learner.decisions.filter(item=>item.action==='shadow'&&item.variable==='volume').length,
    shadowCandidates:learner.decisions.filter(item=>item.action==='shadow').length,
    volumeExperiments:learner.decisions.filter(item=>item.action==='experiment'&&item.variable==='volume').length,
    volumeExperimentsPending:learner.decisions.filter(item=>item.action==='experiment'&&item.variable==='volume'&&!item.delayedOutcome).length,
    delayedOutcomes:delayedOutcomes.length,
    delayedOutcomeSuccessRate:delayedOutcomes.length?round(delayedSuccessful/delayedOutcomes.length,3):null,
    readinessRelationships:models.filter(model=>model.readinessRelationship?.available).length,
    appliedInfluences:learner.decisions.filter(item=>item.applied).length,
    suggestions:learner.decisions.filter(item=>item.action==='suggest').length,
    decisions:learner.decisions.length,
    events:learner.events.length,
    version:learner.version
  };
}
global.GoWorkoutLearner={VERSION,SCHEMA_VERSION,emptyLearner,normalizeLearner,confidence,recommendationGate,variableConfidence,variableGate,variableGates,targetProposal,restProposal,volumeProfile,volumeShadowProposal,volumeExperimentProposal,upwardShadowProposal,readinessRelationship,recentPerformanceBaseline,decisionOutcome,delayedVolumeOutcome,applyInterventionOutcome,applyDelayedInterventionOutcome,addDecision,predictionForExercise,eventFromExercise,evaluatePrediction,updateModel,addPredictions,recordWorkout,overview};
})(typeof window!=='undefined'?window:globalThis);
