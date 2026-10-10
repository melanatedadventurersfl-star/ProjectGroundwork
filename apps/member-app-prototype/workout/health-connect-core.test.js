const assert=require('node:assert/strict');
const core=require('./health-connect-core.js');

const samsung={
  recordId:'samsung-session-1',
  sourcePackage:'com.sec.android.app.shealth',
  title:'Strength training',
  startTime:'2026-10-06T22:00:00.000Z',
  endTime:'2026-10-06T22:45:00.000Z',
  avgHeartRate:128,
  maxHeartRate:161,
  caloriesKcal:386,
  distanceMeters:0,
  steps:412
};

const normalized=core.normalizeWorkoutRecord(samsung,'2026-10-06T23:00:00.000Z');
assert.equal(normalized.id,'health-samsung_health-samsung-session-1');
assert.equal(normalized.durationMinutes,45);
assert.equal(normalized.healthMetrics.averageHeartRateBpm,128);
assert.equal(normalized.healthMetrics.maxHeartRateBpm,161);
assert.equal(normalized.manualWorkoutCompletion,true);
assert.equal(normalized.externalWorkout,true);

const first=core.mergeImportedWorkouts([], [samsung]);
assert.equal(first.imported.length,1);
assert.equal(first.history.length,1);

const duplicate=core.mergeImportedWorkouts(first.history,[samsung]);
assert.equal(duplicate.imported.length,0);
assert.equal(duplicate.skipped[0].reason,'duplicate');

const other={...samsung,recordId:'other-1',sourcePackage:'com.example.fitness'};
const samsungOnly=core.mergeImportedWorkouts([], [other]);
assert.equal(samsungOnly.imported.length,0);
assert.equal(samsungOnly.skipped[0].reason,'not_samsung_health');

const invalid=core.mergeImportedWorkouts([], [{...samsung,recordId:'bad',endTime:samsung.startTime}]);
assert.equal(invalid.imported.length,0);
assert.equal(invalid.skipped[0].reason,'invalid_record');

console.log('Health Connect core tests passed');
