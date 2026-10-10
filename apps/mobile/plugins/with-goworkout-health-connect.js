const fs=require('fs');
const path=require('path');
const {
  withAndroidManifest,
  withAppBuildGradle,
  withMainApplication,
  withDangerousMod
}=require('@expo/config-plugins');

function healthPackage(config){
  return (config.android?.package || 'com.melanatedadventurers.app')+'.health';
}

function appScheme(config){
  const scheme=config.scheme;
  return Array.isArray(scheme)?scheme[0]:(scheme||'melanatedadventurers');
}
const HEALTH_PERMISSIONS=[
  'android.permission.health.READ_EXERCISE',
  'android.permission.health.READ_HEART_RATE',
  'android.permission.health.READ_TOTAL_CALORIES_BURNED',
  'android.permission.health.READ_DISTANCE',
  'android.permission.health.READ_STEPS'
];

function addManifestPermission(manifest,name){
  manifest['uses-permission']=manifest['uses-permission']||[];
  if(!manifest['uses-permission'].some(item=>item?.$?.['android:name']===name)){
    manifest['uses-permission'].push({$:{'android:name':name}});
  }
}

function withHealthManifest(config){
  const targetHealthPackage=healthPackage(config);
  return withAndroidManifest(config,cfg=>{
    const manifest=cfg.modResults.manifest;
    HEALTH_PERMISSIONS.forEach(name=>addManifestPermission(manifest,name));

    manifest.queries=manifest.queries||[{}];
    const queries=manifest.queries[0];
    queries.package=queries.package||[];
    for(const name of ['com.google.android.apps.healthdata','com.sec.android.app.shealth']){
      if(!queries.package.some(item=>item?.$?.['android:name']===name)){
        queries.package.push({$:{'android:name':name}});
      }
    }

    const application=manifest.application?.[0];
    if(application){
      const rationaleActivity=targetHealthPackage+'.PermissionsRationaleActivity';
      application.activity=application.activity||[];
      if(!application.activity.some(activity=>activity?.$?.['android:name']===rationaleActivity)){
        application.activity.push({
          $:{'android:name':rationaleActivity,'android:exported':'true'},
          'intent-filter':[{
            action:[{$:{'android:name':'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE'}}]
          }]
        });
      }
      application['activity-alias']=application['activity-alias']||[];
      const aliasName='.ViewPermissionUsageActivity';
      if(!application['activity-alias'].some(alias=>alias?.$?.['android:name']===aliasName)){
        application['activity-alias'].push({
          $:{
            'android:name':aliasName,
            'android:exported':'true',
            'android:targetActivity':rationaleActivity,
            'android:permission':'android.permission.START_VIEW_PERMISSION_USAGE'
          },
          'intent-filter':[{
            action:[{$:{'android:name':'android.intent.action.VIEW_PERMISSION_USAGE'}}],
            category:[{$:{'android:name':'android.intent.category.HEALTH_PERMISSIONS'}}]
          }]
        });
      }
    }
    return cfg;
  });
}

function withHealthGradle(config){
  return withAppBuildGradle(config,cfg=>{
    let source=cfg.modResults.contents;
    if(!source.includes('androidx.health.connect:connect-client:1.1.0')){
      source=source.replace(/dependencies\s*\{/,'dependencies {\n    implementation "androidx.health.connect:connect-client:1.1.0"\n    implementation "org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1"');
    }
    source=source.replace('minSdkVersion rootProject.ext.minSdkVersion','minSdkVersion 26');
    cfg.modResults.contents=source;
    return cfg;
  });
}

function withHealthPackage(config){
  const targetHealthPackage=healthPackage(config);
  return withMainApplication(config,cfg=>{
    let source=cfg.modResults.contents;
    const importLine='import '+targetHealthPackage+'.GoWorkoutHealthConnectPackage';
    if(!source.includes(importLine)){
      source=source.replace(/^(package\\s+[^\\n]+)/m,'$1\\n\\n'+importLine);
    }
    if(!source.includes('add(GoWorkoutHealthConnectPackage())')){
      const marker='PackageList(this).packages.apply {';
      if(!source.includes(marker)){
        throw new Error('Go Workout Health Connect could not find the React package list in MainApplication.kt');
      }
      source=source.replace(marker,marker+'\n              add(GoWorkoutHealthConnectPackage())');
    }
    cfg.modResults.contents=source;
    return cfg;
  });
}

const moduleSource=String.raw`package com.melanatedadventurers.app.health

import android.app.Activity
import android.content.Intent
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.metadata.DataOrigin
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.time.Instant

class GoWorkoutHealthConnectModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  companion object {
    private const val PROVIDER_PACKAGE = "com.google.android.apps.healthdata"
    private const val SAMSUNG_HEALTH_PACKAGE = "com.sec.android.app.shealth"
    private const val PERMISSION_REQUEST_CODE = 9472
  }

  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  private val permissionContract = PermissionController.createRequestPermissionResultContract()
  private var permissionPromise: Promise? = null

  private val permissionListener: ActivityEventListener = object : BaseActivityEventListener() {
    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
      if (requestCode != PERMISSION_REQUEST_CODE) return
      val promise = permissionPromise ?: return
      permissionPromise = null
      try {
        val granted = permissionContract.parseResult(resultCode, data)
        promise.resolve(statusMap(granted))
      } catch (error: Throwable) {
        promise.reject("health_permission_result_failed", error.message, error)
      }
    }
  }

  init {
    reactContext.addActivityEventListener(permissionListener)
  }

  override fun getName() = "GoWorkoutHealthConnect"

  private fun sdkAvailable(): Boolean {
    return HealthConnectClient.getSdkStatus(reactContext) == HealthConnectClient.SDK_AVAILABLE
  }

  private fun client(): HealthConnectClient {
    return HealthConnectClient.getOrCreate(reactContext)
  }

  private fun requestedPermissions(toggles: ReadableMap?): Set<String> {
    val permissions = mutableSetOf(
      HealthPermission.getReadPermission(ExerciseSessionRecord::class)
    )
    fun enabled(key: String): Boolean {
      return toggles == null || !toggles.hasKey(key) || toggles.getBoolean(key)
    }
    if (enabled("heartRate")) permissions.add(HealthPermission.getReadPermission(HeartRateRecord::class))
    if (enabled("calories")) permissions.add(HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class))
    if (enabled("distance")) permissions.add(HealthPermission.getReadPermission(DistanceRecord::class))
    if (enabled("steps")) permissions.add(HealthPermission.getReadPermission(StepsRecord::class))
    return permissions
  }

  private fun statusMap(granted: Set<String>) = Arguments.createMap().apply {
    putBoolean("available", sdkAvailable())
    putBoolean("connected", granted.contains(HealthPermission.getReadPermission(ExerciseSessionRecord::class)))
    putArray("permissions", Arguments.fromList(granted.toList()))
  }

  @ReactMethod
  fun getStatus(promise: Promise) {
    if (!sdkAvailable()) {
      promise.resolve(Arguments.createMap().apply {
        putBoolean("available", false)
        putBoolean("connected", false)
        putArray("permissions", Arguments.createArray())
      })
      return
    }
    scope.launch {
      try {
        val granted = client().permissionController.getGrantedPermissions()
        promise.resolve(statusMap(granted))
      } catch (error: Throwable) {
        promise.reject("health_status_failed", error.message, error)
      }
    }
  }

  @ReactMethod
  fun requestPermissions(toggles: ReadableMap?, promise: Promise) {
    if (!sdkAvailable()) {
      promise.reject("health_unavailable", "Health Connect is not available on this Android device.")
      return
    }
    if (permissionPromise != null) {
      promise.reject("health_permission_busy", "A Health Connect permission request is already open.")
      return
    }
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("health_no_activity", "Go Workout must be open to request Health Connect permissions.")
      return
    }
    try {
      permissionPromise = promise
      val intent = permissionContract.createIntent(reactContext, requestedPermissions(toggles))
      activity.startActivityForResult(intent, PERMISSION_REQUEST_CODE)
    } catch (error: Throwable) {
      permissionPromise = null
      promise.reject("health_permission_failed", error.message, error)
    }
  }

  @ReactMethod
  fun revokePermissions(promise: Promise) {
    if (!sdkAvailable()) {
      promise.resolve(null)
      return
    }
    scope.launch {
      try {
        client().permissionController.revokeAllPermissions()
        promise.resolve(null)
      } catch (error: Throwable) {
        promise.reject("health_revoke_failed", error.message, error)
      }
    }
  }

  @ReactMethod
  fun readSamsungWorkouts(days: Int, toggles: ReadableMap?, promise: Promise) {
    if (!sdkAvailable()) {
      promise.reject("health_unavailable", "Health Connect is not available on this Android device.")
      return
    }
    scope.launch {
      try {
        val health = client()
        val granted = health.permissionController.getGrantedPermissions()
        val exercisePermission = HealthPermission.getReadPermission(ExerciseSessionRecord::class)
        if (!granted.contains(exercisePermission)) {
          promise.reject("health_permission_missing", "Exercise permission is required before syncing Samsung Health.")
          return@launch
        }

        val end = Instant.now()
        val start = end.minusSeconds((days.coerceIn(1, 30) * 86400).toLong())
        val response = health.readRecords(
          ReadRecordsRequest(
            recordType = ExerciseSessionRecord::class,
            timeRangeFilter = TimeRangeFilter.between(start, end),
            dataOriginFilter = setOf(DataOrigin(SAMSUNG_HEALTH_PACKAGE))
          )
        )
        val records = Arguments.createArray()

        for (session in response.records) {
          if (session.metadata.dataOrigin.packageName != SAMSUNG_HEALTH_PACKAGE) continue
          val origin = setOf(session.metadata.dataOrigin)
          val filter = TimeRangeFilter.between(session.startTime, session.endTime)
          val row = Arguments.createMap()
          row.putString("recordId", session.metadata.id)
          row.putString("sourcePackage", session.metadata.dataOrigin.packageName)
          row.putString("title", session.title)
          row.putInt("exerciseType", session.exerciseType)
          row.putString("startTime", session.startTime.toString())
          row.putString("endTime", session.endTime.toString())
          session.metadata.device?.let { device ->
            row.putString("sourceDevice", listOfNotNull(device.manufacturer, device.model).joinToString(" ").trim())
          }

          val heartPermission = HealthPermission.getReadPermission(HeartRateRecord::class)
          if (granted.contains(heartPermission) && (toggles == null || !toggles.hasKey("heartRate") || toggles.getBoolean("heartRate"))) {
            val heart = health.aggregate(
              AggregateRequest(
                metrics = setOf(HeartRateRecord.BPM_AVG, HeartRateRecord.BPM_MAX, HeartRateRecord.BPM_MIN),
                timeRangeFilter = filter,
                dataOriginFilter = origin
              )
            )
            heart[HeartRateRecord.BPM_AVG]?.let { row.putDouble("avgHeartRate", it.toDouble()) }
            heart[HeartRateRecord.BPM_MAX]?.let { row.putDouble("maxHeartRate", it.toDouble()) }
            heart[HeartRateRecord.BPM_MIN]?.let { row.putDouble("minHeartRate", it.toDouble()) }
          }

          val caloriePermission = HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class)
          if (granted.contains(caloriePermission) && (toggles == null || !toggles.hasKey("calories") || toggles.getBoolean("calories"))) {
            val calories = health.aggregate(
              AggregateRequest(
                metrics = setOf(TotalCaloriesBurnedRecord.ENERGY_TOTAL),
                timeRangeFilter = filter,
                dataOriginFilter = origin
              )
            )
            calories[TotalCaloriesBurnedRecord.ENERGY_TOTAL]?.let { row.putDouble("caloriesKcal", it.inKilocalories) }
          }

          val distancePermission = HealthPermission.getReadPermission(DistanceRecord::class)
          if (granted.contains(distancePermission) && (toggles == null || !toggles.hasKey("distance") || toggles.getBoolean("distance"))) {
            val distance = health.aggregate(
              AggregateRequest(
                metrics = setOf(DistanceRecord.DISTANCE_TOTAL),
                timeRangeFilter = filter,
                dataOriginFilter = origin
              )
            )
            distance[DistanceRecord.DISTANCE_TOTAL]?.let { row.putDouble("distanceMeters", it.inMeters) }
          }

          val stepsPermission = HealthPermission.getReadPermission(StepsRecord::class)
          if (granted.contains(stepsPermission) && (toggles == null || !toggles.hasKey("steps") || toggles.getBoolean("steps"))) {
            val steps = health.aggregate(
              AggregateRequest(
                metrics = setOf(StepsRecord.COUNT_TOTAL),
                timeRangeFilter = filter,
                dataOriginFilter = origin
              )
            )
            steps[StepsRecord.COUNT_TOTAL]?.let { row.putDouble("steps", it.toDouble()) }
          }

          records.pushMap(row)
        }

        promise.resolve(Arguments.createMap().apply { putArray("records", records) })
      } catch (error: Throwable) {
        promise.reject("health_read_failed", error.message, error)
      }
    }
  }
}
`;

const rationaleSource=String.raw`package com.melanatedadventurers.app.health

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle

class PermissionsRationaleActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val privacyIntent = Intent(Intent.ACTION_VIEW, Uri.parse("melanatedadventurers://privacy-policy")).apply {
      setPackage(packageName)
    }
    startActivity(privacyIntent)
    finish()
  }
}
`;
const packageSource=String.raw`package com.melanatedadventurers.app.health

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class GoWorkoutHealthConnectPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    return listOf(GoWorkoutHealthConnectModule(reactContext))
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return emptyList()
  }
}
`;

function withHealthSources(config){
  const targetHealthPackage=healthPackage(config);
  const targetScheme=appScheme(config);
  return withDangerousMod(config,['android',async cfg=>{
    const root=cfg.modRequest.platformProjectRoot;
    const sourceDir=path.join(root,'app','src','main','java',...targetHealthPackage.split('.'));
    fs.mkdirSync(sourceDir,{recursive:true});
    const rewrite=(source)=>source
      .replaceAll('com.melanatedadventurers.app.health',targetHealthPackage)
      .replaceAll('melanatedadventurers://privacy-policy',targetScheme+'://privacy-policy');
    fs.writeFileSync(path.join(sourceDir,'GoWorkoutHealthConnectModule.kt'),rewrite(moduleSource));
    fs.writeFileSync(path.join(sourceDir,'GoWorkoutHealthConnectPackage.kt'),rewrite(packageSource));
    fs.writeFileSync(path.join(sourceDir,'PermissionsRationaleActivity.kt'),rewrite(rationaleSource));
    return cfg;
  }]);
}

module.exports=function withGoWorkoutHealthConnect(config){
  config=withHealthManifest(config);
  config=withHealthGradle(config);
  config=withHealthPackage(config);
  config=withHealthSources(config);
  return config;
};
