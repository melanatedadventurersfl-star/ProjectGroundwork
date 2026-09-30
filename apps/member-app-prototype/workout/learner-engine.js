(function(global){
'use strict';
const VERSION='0.1.0',SCHEMA_VERSION=1;
const n=value=>{const v=Number.parseFloat(value);return Number.isFinite(v)?v:0;};
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const round=(value,digits=2)=>{const scale=Math.pow(10,digits);return Math.round((n(value)+Number.EPSILON)*scale)/scale;};
const mean=values=>{const clean=(values||[]).map(n);return clean.length?clean.reduce((sum,value)=>sum+value,0)/clean.length:0;};
function confidence(exposures,setCompletionRate=0,predictionCount=0){
  const score=Math.round(clamp(exposures/8,0,1)*60+clamp(setCompletionRate,0,1)*20+clamp(predictionCount/6,0,1)*20);
  return {level:score>=75?'high':score>=45?'medium':'low',score,evidence:exposures+' session'+(exposures===1?'':'s')+(predictionCount?' · '+predictionCount+' prediction'+(predictionCount===1?'':'s')+' checked':'')};
}
function recommendationGate(model){
  const exposures=n(model?.exposures),predictions=n(model?.predictionCount),metrics=model?.metrics||{};
  const completion=n(metrics.setCompletionRate),hit=metrics.targetHitRate,repError=metrics.averageRepsPredictionError,weightError=metrics.averageWeightPredictionError;
  const weighted=!['bodyweight','timed','band'].includes(model?.loadMode||'');
  const influenceReady=exposures>=6&&predictions>=4&&completion>=.8&&(hit===null||hit===undefined||n(hit)>=.65)&&(repError===null||repError===undefined||n(repError)<=1.5)&&(!weighted||weightError===null||weightError===undefined||n(weightError)<=5);
  if(influenceReady)return {level:'influence',label:'READY TO INFLUENCE',reason:'6+ exposures, 4+ checked predictions, stable completion, and acceptable prediction error'};
  if(exposures>=3&&predictions>=2&&completion>=.7)return {level:'suggest',label:'SUGGEST ONLY',reason:'Enough evidence to surface suggestions, but not enough to steer training'};
  return {level:'observe',label:'OBSERVE ONLY',reason:'Collecting evidence before this learner can affect a workout'};
}
function emptyLearner(){return {schemaVersion:SCHEMA_VERSION,version:VERSION,createdAt:new Date().toISOString(),updatedAt:null,models:{},events:[],predictions:[],evaluations:[],processedWorkoutIds:[]};}
function normalizeLearner(value){
  const learner=value&&typeof value==='object'?value:emptyLearner();
  learner.schemaVersion=SCHEMA_VERSION;learner.version=VERSION;
  learner.models=learner.models&&typeof learner.models==='object'?learner.models:{};
  learner.events=Array.isArray(learner.events)?learner.events:[];
  learner.predictions=Array.isArray(learner.predictions)?learner.predictions:[];
  learner.evaluations=Array.isArray(learner.evaluations)?learner.evaluations:[];
  learner.processedWorkoutIds=Array.isArray(learner.processedWorkoutIds)?learner.processedWorkoutIds:[];
  learner.createdAt=learner.createdAt||new Date().toISOString();
  return learner;
}
function predictionForExercise(exercise,model,context={}){
  const conf=model?.confidence||confidence(0,0,0);
  return {
    id:'prediction-'+String(context.workoutId||'workout')+'-'+String(exercise.id||'exercise'),
    workoutId:context.workoutId||'',exerciseId:exercise.id||'',exerciseName:exercise.name||'Exercise',loadMode:exercise.loadMode||'',
    createdAt:context.createdAt||new Date().toISOString(),scheduledDate:context.scheduledDate||'',routineName:context.routineName||'',
    target:{weight:n(exercise.suggestedWeight),reps:n(exercise.suggestedReps),restSeconds:n(exercise.rest),sets:Array.isArray(exercise.sets)?exercise.sets.length:n(exercise.sets)},
    source:exercise.adaptiveLabel?'learned':exercise.engineExerciseId?'program-engine':'plan',
    reason:exercise.adaptiveReason||exercise.engineReason?.[0]||'Current planned target',confidence:conf
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
  model.exerciseName=event.exerciseName||model.exerciseName;model.exposures+=1;model.plannedSets+=n(event.planned?.sets);model.completedSets+=n(event.actual?.completedSets);model.repDropTotal+=n(event.actual?.repDrop);model.targetAdjustedSets+=n(event.actual?.targetAdjustedSets);
  if(n(event.actual?.averageSetDurationSeconds)>0){model.setDurationTotal+=n(event.actual.averageSetDurationSeconds);model.setDurationCount+=1;}
  if(n(event.actual?.averageRestSeconds)>0){model.restTotal+=n(event.actual.averageRestSeconds);model.restCount+=1;}
  if(event.feedback){model.feedbackCounts[event.feedback]=(model.feedbackCounts[event.feedback]||0)+1;model.lastFeedback=event.feedback;}
  const best=event.actual?.best||{weight:0,reps:0};
  if(n(best.weight)>n(model.currentBest?.weight)||(n(best.weight)===n(model.currentBest?.weight)&&n(best.reps)>n(model.currentBest?.reps)))model.currentBest={weight:n(best.weight),reps:n(best.reps)};
  if(evaluation){model.predictionCount+=1;if(evaluation.targetHit)model.targetHits+=1;model.weightAbsoluteErrorTotal+=n(evaluation.weightError);model.repsAbsoluteErrorTotal+=n(evaluation.repsError);}
  const observation={workoutId:event.workoutId,completedAt:event.completedAt,weight:n(best.weight),reps:n(best.reps),averageWeight:n(event.actual?.averageWeight),averageReps:n(event.actual?.averageReps),completionRate:n(event.actual?.completionRate),repDrop:n(event.actual?.repDrop),feedback:event.feedback||'',predictionHit:evaluation?Boolean(evaluation.targetHit):null};
  model.observations=[...(model.observations||[]),observation].slice(-20);model.lastObservedAt=event.completedAt;
  const completionRate=model.plannedSets?model.completedSets/model.plannedSets:0,first=model.observations[0]||observation,latest=model.observations[model.observations.length-1]||observation,gap=Math.max(1,model.exposures-1);
  model.metrics={setCompletionRate:round(completionRate,3),targetHitRate:model.predictionCount?round(model.targetHits/model.predictionCount,3):null,averageRepDrop:round(model.repDropTotal/model.exposures,2),averageSetDurationSeconds:model.setDurationCount?round(model.setDurationTotal/model.setDurationCount,1):null,averageRestSeconds:model.restCount?round(model.restTotal/model.restCount,1):null,targetAdjustmentRate:model.completedSets?round(model.targetAdjustedSets/model.completedSets,3):0,averageWeightPredictionError:model.predictionCount?round(model.weightAbsoluteErrorTotal/model.predictionCount,2):null,averageRepsPredictionError:model.predictionCount?round(model.repsAbsoluteErrorTotal/model.predictionCount,2):null,weightProgressionPerExposure:round((n(latest.weight)-n(first.weight))/gap,2),repsProgressionPerExposure:round((n(latest.reps)-n(first.reps))/gap,2)};
  model.confidence=confidence(model.exposures,completionRate,model.predictionCount);
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
    learner.models[event.exerciseId]=updateModel(learner.models[event.exerciseId],event,evaluation);learner.events.push(event);if(evaluation)learner.evaluations.push(evaluation);
    results.push({event,evaluation,model:learner.models[event.exerciseId]});
  });
  learner.events=learner.events.slice(-600);learner.evaluations=learner.evaluations.slice(-300);learner.processedWorkoutIds.push(workout.id);learner.processedWorkoutIds=learner.processedWorkoutIds.slice(-200);learner.updatedAt=workout.completedAt||new Date().toISOString();
  const evaluated=results.filter(item=>item.evaluation),hits=evaluated.filter(item=>item.evaluation.targetHit).length,strongest=results.slice().sort((a,b)=>(b.model?.confidence?.score||0)-(a.model?.confidence?.score||0))[0]||null;
  return {learner,summary:{exercisesObserved:results.length,predictionsEvaluated:evaluated.length,predictionHits:hits,predictionHitRate:evaluated.length?round(hits/evaluated.length,3):null,strongestExercise:strongest?{exerciseId:strongest.event.exerciseId,name:strongest.event.exerciseName,confidence:strongest.model.confidence}:null}};
}
function overview(value){
  const learner=normalizeLearner(value),models=Object.values(learner.models||{}),evaluated=learner.evaluations.length,hits=learner.evaluations.filter(item=>item.targetHit).length;
  const recent=learner.evaluations.slice(-20),recentHits=recent.filter(item=>item.targetHit).length;
  const weighted=learner.evaluations.filter(item=>n(item.planned?.weight)>0);
  const gates=models.reduce((acc,model)=>{const gate=model.gate||recommendationGate(model);acc[gate.level]=(acc[gate.level]||0)+1;return acc;},{observe:0,suggest:0,influence:0});
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
    events:learner.events.length,
    version:learner.version
  };
}
global.GoWorkoutLearner={VERSION,SCHEMA_VERSION,emptyLearner,normalizeLearner,confidence,recommendationGate,predictionForExercise,eventFromExercise,evaluatePrediction,updateModel,addPredictions,recordWorkout,overview};
})(typeof window!=='undefined'?window:globalThis);
