(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GoWorkoutHealthConnectCore=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  const SAMSUNG_HEALTH_PACKAGE='com.sec.android.app.shealth';
  const HEALTH_HISTORY_SCHEMA=1;

  function number(value){
    const parsed=Number(value);
    return Number.isFinite(parsed)?parsed:0;
  }

  function iso(value,fallback=''){
    const date=new Date(value||fallback);
    return Number.isFinite(date.getTime())?date.toISOString():'';
  }

  function safeId(value){
    return String(value||'')
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g,'-')
      .replace(/^-+|-+$/g,'')
      .slice(0,160);
  }

  function sourcePackage(record){
    return String(
      record?.sourcePackage||
      record?.dataOrigin||
      record?.metadata?.dataOrigin?.packageName||
      record?.metadata?.dataOrigin||
      ''
    );
  }

  function recordId(record){
    return String(record?.recordId||record?.id||record?.metadata?.id||'');
  }

  function isSamsungHealthRecord(record){
    return sourcePackage(record)===SAMSUNG_HEALTH_PACKAGE;
  }

  function exerciseLabel(record){
    const title=String(record?.title||record?.name||'').trim();
    if(title)return title;
    const type=String(record?.exerciseTypeLabel||record?.exerciseType||'').trim();
    if(!type)return 'Samsung Health workout';
    return /^\d+$/.test(type)?'Samsung Health workout':type
      .replace(/^EXERCISE_TYPE_/,'')
      .replace(/_/g,' ')
      .toLowerCase()
      .replace(/\b\w/g,char=>char.toUpperCase());
  }

  function normalizeWorkoutRecord(record,importedAt=new Date().toISOString()){
    const externalId=recordId(record);
    const startedAt=iso(record?.startTime||record?.startedAt);
    const completedAt=iso(record?.endTime||record?.completedAt);
    if(!externalId||!startedAt||!completedAt)return null;
    const startMs=Date.parse(startedAt);
    const endMs=Date.parse(completedAt);
    if(!Number.isFinite(startMs)||!Number.isFinite(endMs)||endMs<=startMs)return null;
    const durationSeconds=Math.max(1,Math.round((endMs-startMs)/1000));
    const packageName=sourcePackage(record);
    const provider=packageName===SAMSUNG_HEALTH_PACKAGE?'samsung_health':'health_connect';
    const metrics={
      averageHeartRateBpm:number(record?.averageHeartRateBpm??record?.avgHeartRate),
      maxHeartRateBpm:number(record?.maxHeartRateBpm??record?.maxHeartRate),
      minHeartRateBpm:number(record?.minHeartRateBpm??record?.minHeartRate),
      caloriesKcal:number(record?.caloriesKcal??record?.totalCaloriesKcal??record?.activeCaloriesKcal),
      distanceMeters:number(record?.distanceMeters),
      steps:Math.max(0,Math.round(number(record?.steps)))
    };
    return {
      schemaVersion:4,
      healthHistorySchema:HEALTH_HISTORY_SCHEMA,
      id:'health-'+provider+'-'+safeId(externalId),
      planId:'',
      planDayId:'',
      routineName:exerciseLabel(record),
      focus:'Imported activity',
      startedAt,
      completedAt,
      durationMinutes:Math.max(1,Math.round(durationSeconds/60)),
      activeDurationSeconds:durationSeconds,
      wallClockSeconds:durationSeconds,
      completedSets:0,
      totalVolume:0,
      completionStatus:'complete',
      manualWorkoutCompletion:true,
      externalWorkout:true,
      exercises:[],
      adaptationNotes:['Imported from Samsung Health through Android Health Connect. No strength-set performance was inferred.'],
      healthMetrics:metrics,
      externalSource:{
        provider,
        healthConnectRecordId:externalId,
        sourcePackage:packageName,
        sourceDevice:String(record?.sourceDevice||record?.deviceModel||''),
        importedAt:iso(importedAt,new Date().toISOString())
      }
    };
  }

  function externalKey(item){
    const source=item?.externalSource;
    if(source?.healthConnectRecordId)return String(source.provider||'health_connect')+':'+String(source.healthConnectRecordId);
    return String(item?.id||'');
  }

  function mergeImportedWorkouts(history,records,{samsungOnly=true}={}){
    const current=Array.isArray(history)?history:[];
    const existing=new Set(current.map(externalKey).filter(Boolean));
    const imported=[];
    const skipped=[];
    for(const raw of Array.isArray(records)?records:[]){
      if(samsungOnly&&!isSamsungHealthRecord(raw)){
        skipped.push({reason:'not_samsung_health',record:raw});
        continue;
      }
      const entry=normalizeWorkoutRecord(raw);
      if(!entry){
        skipped.push({reason:'invalid_record',record:raw});
        continue;
      }
      const key=externalKey(entry);
      if(existing.has(key)){
        skipped.push({reason:'duplicate',record:raw});
        continue;
      }
      existing.add(key);
      imported.push(entry);
    }
    return {
      history:[...imported,...current].sort((a,b)=>Date.parse(b.completedAt||0)-Date.parse(a.completedAt||0)),
      imported,
      skipped
    };
  }

  return {
    SAMSUNG_HEALTH_PACKAGE,
    HEALTH_HISTORY_SCHEMA,
    sourcePackage,
    recordId,
    isSamsungHealthRecord,
    normalizeWorkoutRecord,
    mergeImportedWorkouts
  };
});
