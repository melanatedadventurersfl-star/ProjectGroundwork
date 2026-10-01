(function(){
  // Dev-only until approved base artwork replaces the placeholder silhouette.
  const FEATURE_FLAG=false;
  function assetFor(view='front',variant='male'){
    const config=window.GoWorkoutAnatomyCanvas;
    return config?.assets?.[variant]?.[view]||'';
  }
  function renderBase({view='front',variant='male',className=''}={}){
    const src=assetFor(view,variant);
    if(!src)return '';
    const label=(view==='back'?'Back':'Front')+' '+variant+' anatomy base silhouette';
    return '<img class="anatomy-base-image-v2 '+className+'" src="'+src+'" alt="'+label+'" loading="eager" decoding="async">';
  }
  window.GoWorkoutAnatomyBase={
    enabled:FEATURE_FLAG,
    renderBase,
    assetFor,
    canvas:()=>window.GoWorkoutAnatomyCanvas||null,
    variants:['male']
  };
})();