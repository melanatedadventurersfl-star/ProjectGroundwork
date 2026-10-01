(function(){
  const GENERATED_ROOT='./anatomy-v2/generated'
  const ENABLED=false

  function level(value){
    return Math.max(0,Math.min(4,Math.round(Number(value)||0)))
  }

  function basePath(variant,view){
    return './anatomy-v2/'+variant+'/'+view+'/'+variant+'-'+view+'-base.svg'
  }

  function overlayPath(variant,view,region,intensity){
    return GENERATED_ROOT+'/'+variant+'/'+view+'/'+variant+'-'+view+'-'+region+'-'+intensity+'.png'
  }

  function render({variant='male',view='front',loads={}}={}){
    const config=window.GoWorkoutAnatomyRegions
    if(!config)return ''
    const regions=config.regions?.[view]||[]
    const overlays=regions.map(item=>{
      const intensity=level(loads[item.id])
      if(!intensity)return ''
      return '<img class="anatomy-overlay-layer heat-'+intensity+'" src="'+overlayPath(variant,view,item.id,intensity)+'" alt="" aria-hidden="true">'
    }).join('')

    return '<div class="anatomy-image-stack" data-variant="'+variant+'" data-view="'+view+'">'+
      '<img class="anatomy-base-layer" src="'+basePath(variant,view)+'" alt="'+view+' '+variant+' anatomy">'+
      overlays+
    '</div>'
  }

  window.GoWorkoutAnatomyOverlay={
    enabled:ENABLED,
    render,
    basePath,
    overlayPath,
    generatedRoot:GENERATED_ROOT
  }
})()