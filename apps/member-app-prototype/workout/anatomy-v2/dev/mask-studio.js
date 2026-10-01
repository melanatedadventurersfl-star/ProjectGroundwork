(function(){
  const config=window.GoWorkoutAnatomyRegions
  if(!config)throw new Error('Anatomy region config missing')

  const W=config.canvas.width
  const H=config.canvas.height
  const els={
    display:document.getElementById('displayCanvas'),
    view:document.getElementById('viewSelect'),
    region:document.getElementById('regionSelect'),
    level:document.getElementById('levelSelect'),
    brush:document.getElementById('brushSize'),
    brushOut:document.getElementById('brushSizeOut'),
    feather:document.getElementById('feather'),
    featherOut:document.getElementById('featherOut'),
    paint:document.getElementById('paintBtn'),
    erase:document.getElementById('eraseBtn'),
    clear:document.getElementById('clearBtn'),
    baseUpload:document.getElementById('baseUpload'),
    litUpload:document.getElementById('litUpload'),
    diffThreshold:document.getElementById('diffThreshold'),
    diffThresholdOut:document.getElementById('diffThresholdOut'),
    extractMask:document.getElementById('extractMaskBtn'),
    maskUpload:document.getElementById('maskUpload'),
    saveMask:document.getElementById('saveMaskBtn'),
    exportMask:document.getElementById('exportMaskBtn'),
    exportLevels:document.getElementById('exportLevelsBtn'),
    exportAll:document.getElementById('exportAllBtn'),
    exportManifest:document.getElementById('exportManifestBtn'),
    title:document.getElementById('canvasTitle'),
    mode:document.getElementById('modeLabel'),
    status:document.getElementById('status'),
    saved:document.getElementById('savedRegions')
  }

  const displayCtx=els.display.getContext('2d')
  const mask=document.createElement('canvas')
  mask.width=W
  mask.height=H
  const maskCtx=mask.getContext('2d',{willReadFrequently:true})

  const tint=document.createElement('canvas')
  tint.width=W
  tint.height=H
  const tintCtx=tint.getContext('2d')

  const previewCanvases=[...document.querySelectorAll('[data-preview]')]
  const baseImages={front:null,back:null}
  const customBaseUrls={front:'',back:''}
  const litImages={front:null,back:null}
  const litUrls={front:'',back:''}

  const state={
    view:'front',
    region:'chest',
    level:3,
    mode:'paint',
    brush:72,
    feather:38,
    diffThreshold:32,
    drawing:false,
    last:null
  }

  const defaultBase={
    front:'../male/front/male-front-base.svg',
    back:'../male/back/male-back-base.svg'
  }

  function key(view=state.view,region=state.region){
    return 'male:'+view+':'+region
  }

  function setStatus(message){
    els.status.textContent=message
  }

  function hexToRgb(hex){
    const value=hex.replace('#','')
    const n=parseInt(value.length===3?value.split('').map(v=>v+v).join(''):value,16)
    return {r:(n>>16)&255,g:(n>>8)&255,b:n&255}
  }

  function rgba(hex,alpha){
    const c=hexToRgb(hex)
    return 'rgba('+c.r+','+c.g+','+c.b+','+alpha+')'
  }

  function loadImage(src){
    return new Promise((resolve,reject)=>{
      const img=new Image()
      img.onload=()=>resolve(img)
      img.onerror=reject
      img.src=src
    })
  }

  async function ensureBase(view=state.view){
    if(baseImages[view])return baseImages[view]
    const src=customBaseUrls[view]||defaultBase[view]
    baseImages[view]=await loadImage(src)
    return baseImages[view]
  }

  function setRegions(){
    const options=config.regions[state.view]
    els.region.innerHTML=options.map(item=>'<option value="'+item.id+'">'+item.label+'</option>').join('')
    if(options.some(item=>item.id===state.region)){
      els.region.value=state.region
    }else{
      state.region=options[0].id
      els.region.value=state.region
    }
  }

  function regionLabel(){
    return config.regions[state.view].find(item=>item.id===state.region)?.label||state.region
  }

  function updateLabels(){
    els.title.textContent='MALE · '+state.view.toUpperCase()+' · '+regionLabel().toUpperCase()
    els.mode.textContent=state.mode.toUpperCase()
    els.brushOut.textContent=state.brush
    els.featherOut.textContent=state.feather
    if(els.diffThresholdOut)els.diffThresholdOut.textContent=state.diffThreshold
  }

  function clearCanvas(ctx,canvas){
    ctx.clearRect(0,0,canvas.width,canvas.height)
  }

  async function extractDifferenceMask(){
    const base=await ensureBase()
    const lit=litImages[state.view]
    if(!lit){
      setStatus('Load a lit reference for the current '+state.view+' view first.')
      return
    }

    const baseCanvas=document.createElement('canvas')
    const litCanvas=document.createElement('canvas')
    baseCanvas.width=litCanvas.width=W
    baseCanvas.height=litCanvas.height=H

    const baseCtx=baseCanvas.getContext('2d',{willReadFrequently:true})
    const litCtx=litCanvas.getContext('2d',{willReadFrequently:true})
    baseCtx.drawImage(base,0,0,W,H)
    litCtx.drawImage(lit,0,0,W,H)

    const baseData=baseCtx.getImageData(0,0,W,H)
    const litData=litCtx.getImageData(0,0,W,H)
    const out=maskCtx.createImageData(W,H)
    const threshold=state.diffThreshold

    for(let i=0;i<out.data.length;i+=4){
      const dr=Math.abs(litData.data[i]-baseData.data[i])
      const dg=Math.abs(litData.data[i+1]-baseData.data[i+1])
      const db=Math.abs(litData.data[i+2]-baseData.data[i+2])
      const baseLum=(baseData.data[i]+baseData.data[i+1]+baseData.data[i+2])/3
      const litLum=(litData.data[i]+litData.data[i+1]+litData.data[i+2])/3
      const lift=Math.max(0,litLum-baseLum)
      const diff=Math.max(dr,dg,db,lift*1.25)

      if(diff>threshold){
        const alpha=Math.max(0,Math.min(255,Math.round((diff-threshold)*7.2)))
        out.data[i]=255
        out.data[i+1]=255
        out.data[i+2]=255
        out.data[i+3]=alpha
      }
    }

    maskCtx.clearRect(0,0,W,H)
    maskCtx.putImageData(out,0,0)
    await render()
    setStatus('Extracted a difference mask. Paint or erase to clean the edges before saving.')
  }

  function createTintLayer(level){
    clearCanvas(tintCtx,tint)
    const spec=config.intensities[level]
    if(!spec)return tint

    tintCtx.save()
    const gradient=tintCtx.createLinearGradient(0,0,W,H)
    gradient.addColorStop(0,rgba(spec.color,.96))
    gradient.addColorStop(.42,rgba(spec.color,.84))
    gradient.addColorStop(1,rgba(spec.color,.66))
    tintCtx.fillStyle=gradient
    tintCtx.fillRect(0,0,W,H)
    tintCtx.globalCompositeOperation='destination-in'
    tintCtx.drawImage(mask,0,0)
    tintCtx.restore()
    return tint
  }

  function drawGlow(ctx,level,scaleX=1,scaleY=1){
    const spec=config.intensities[level]
    if(!spec||!spec.glow)return

    const layer=createTintLayer(level)
    ctx.save()
    ctx.globalAlpha=Math.min(.28,spec.opacity*.34)
    ctx.filter='blur('+Math.max(1,Math.round(spec.glow*scaleX))+'px)'
    ctx.drawImage(layer,0,0,W*scaleX,H*scaleY)
    ctx.filter='none'
    ctx.restore()
  }

  async function renderTo(ctx,width,height,level,{showMask=false}={}){
    const base=await ensureBase()
    ctx.clearRect(0,0,width,height)
    ctx.drawImage(base,0,0,width,height)

    const sx=width/W
    const sy=height/H

    if(showMask){
      ctx.save()
      ctx.globalAlpha=.42
      ctx.drawImage(mask,0,0,width,height)
      ctx.restore()
      return
    }

    if(level>0){
      const spec=config.intensities[level]
      drawGlow(ctx,level,sx,sy)
      const layer=createTintLayer(level)
      ctx.save()
      ctx.globalAlpha=spec.opacity
      ctx.globalCompositeOperation='source-over'
      ctx.drawImage(layer,0,0,width,height)
      ctx.restore()
    }
  }

  async function render(){
    await renderTo(displayCtx,W,H,state.level,{showMask:state.level===0})
    for(const canvas of previewCanvases){
      const level=Number(canvas.dataset.preview)
      const ctx=canvas.getContext('2d')
      await renderTo(ctx,canvas.width,canvas.height,level)
    }
    updateLabels()
  }

  function positionForEvent(event){
    const rect=els.display.getBoundingClientRect()
    return {
      x:(event.clientX-rect.left)*(W/rect.width),
      y:(event.clientY-rect.top)*(H/rect.height)
    }
  }

  function stamp(point){
    const radius=state.brush
    maskCtx.save()
    maskCtx.globalCompositeOperation=state.mode==='erase'?'destination-out':'source-over'

    if(state.mode==='erase'){
      const alpha=Math.max(.12,1-state.feather/115)
      const g=maskCtx.createRadialGradient(point.x,point.y,0,point.x,point.y,radius)
      g.addColorStop(0,'rgba(0,0,0,1)')
      g.addColorStop(Math.max(.15,state.feather/100),'rgba(0,0,0,'+alpha+')')
      g.addColorStop(1,'rgba(0,0,0,0)')
      maskCtx.fillStyle=g
    }else{
      const edge=Math.max(.06,1-state.feather/100)
      const g=maskCtx.createRadialGradient(point.x,point.y,0,point.x,point.y,radius)
      g.addColorStop(0,'rgba(255,255,255,1)')
      g.addColorStop(Math.max(.15,edge*.72),'rgba(255,255,255,.96)')
      g.addColorStop(Math.min(.96,edge),'rgba(255,255,255,.62)')
      g.addColorStop(1,'rgba(255,255,255,0)')
      maskCtx.fillStyle=g
    }

    maskCtx.beginPath()
    maskCtx.arc(point.x,point.y,radius,0,Math.PI*2)
    maskCtx.fill()
    maskCtx.restore()
  }

  function stroke(from,to){
    const distance=Math.hypot(to.x-from.x,to.y-from.y)
    const step=Math.max(4,state.brush*.22)
    const count=Math.max(1,Math.ceil(distance/step))
    for(let i=0;i<=count;i++){
      const t=i/count
      stamp({
        x:from.x+(to.x-from.x)*t,
        y:from.y+(to.y-from.y)*t
      })
    }
  }

  function beginPaint(event){
    state.drawing=true
    state.last=positionForEvent(event)
    els.display.setPointerCapture?.(event.pointerId)
    stamp(state.last)
    render()
  }

  function movePaint(event){
    if(!state.drawing)return
    const next=positionForEvent(event)
    stroke(state.last,next)
    state.last=next
    render()
  }

  function endPaint(){
    state.drawing=false
    state.last=null
  }

  function canvasBlob(canvas,type='image/png',quality=.94){
    return new Promise(resolve=>canvas.toBlob(resolve,type,quality))
  }

  function downloadBlob(blob,name){
    const url=URL.createObjectURL(blob)
    const a=document.createElement('a')
    a.href=url
    a.download=name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(()=>URL.revokeObjectURL(url),1500)
  }

  async function overlayBlob(level){
    const out=document.createElement('canvas')
    out.width=W
    out.height=H
    const ctx=out.getContext('2d')
    const spec=config.intensities[level]
    const layer=createTintLayer(level)

    ctx.save()
    ctx.globalAlpha=Math.min(.24,spec.opacity*.30)
    ctx.filter='blur('+spec.glow+'px)'
    ctx.drawImage(layer,0,0)
    ctx.filter='none'
    ctx.restore()

    ctx.save()
    ctx.globalAlpha=spec.opacity
    ctx.drawImage(layer,0,0)
    ctx.restore()

    return canvasBlob(out)
  }

  function openDb(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open('goworkout-anatomy-mask-studio',1)
      req.onupgradeneeded=()=>{
        const db=req.result
        if(!db.objectStoreNames.contains('masks'))db.createObjectStore('masks')
      }
      req.onsuccess=()=>resolve(req.result)
      req.onerror=()=>reject(req.error)
    })
  }

  async function dbPut(id,blob){
    const db=await openDb()
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('masks','readwrite')
      tx.objectStore('masks').put(blob,id)
      tx.oncomplete=()=>resolve()
      tx.onerror=()=>reject(tx.error)
    })
  }

  async function dbGet(id){
    const db=await openDb()
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('masks','readonly')
      const req=tx.objectStore('masks').get(id)
      req.onsuccess=()=>resolve(req.result||null)
      req.onerror=()=>reject(req.error)
    })
  }

  async function dbKeys(){
    const db=await openDb()
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('masks','readonly')
      const req=tx.objectStore('masks').getAllKeys()
      req.onsuccess=()=>resolve(req.result||[])
      req.onerror=()=>reject(req.error)
    })
  }

  async function loadBlobIntoMask(blob){
    clearCanvas(maskCtx,mask)
    if(!blob){
      await render()
      return
    }
    const url=URL.createObjectURL(blob)
    try{
      const img=await loadImage(url)
      maskCtx.drawImage(img,0,0,W,H)
    }finally{
      URL.revokeObjectURL(url)
    }
    await render()
  }

  async function loadSavedMask(){
    const blob=await dbGet(key())
    await loadBlobIntoMask(blob)
    setStatus(blob?'Loaded saved '+state.view+' '+regionLabel()+' mask.':'No saved mask for '+state.view+' '+regionLabel()+'.')
  }

  async function refreshSavedRegions(){
    const keys=await dbKeys()
    els.saved.innerHTML=keys.length
      ?keys.sort().map(id=>{
        const parts=String(id).split(':')
        return '<button class="saved-region" type="button" data-mask-key="'+id+'"><b>'+parts[1]+'</b><span>'+parts[2]+'</span></button>'
      }).join('')
      :'<div class="saved-region"><span>No masks saved yet.</span></div>'
  }

  async function saveCurrentMask(){
    const blob=await canvasBlob(mask)
    await dbPut(key(),blob)
    await refreshSavedRegions()
    setStatus('Saved '+state.view+' '+regionLabel()+' master mask in this browser.')
  }

  async function exportMask(){
    const blob=await canvasBlob(mask)
    downloadBlob(blob,config.maskName({variant:'male',view:state.view,region:state.region}))
    setStatus('Exported master mask for '+state.view+' '+regionLabel()+'.')
  }

  async function exportLevelsFor(view,region,sourceBlob){
    const previous={view:state.view,region:state.region}
    state.view=view
    state.region=region
    baseImages[view]=baseImages[view]||await ensureBase(view)
    await loadBlobIntoMask(sourceBlob)

    for(let level=1;level<=4;level++){
      const blob=await overlayBlob(level)
      downloadBlob(blob,config.assetName({variant:'male',view,region,level}))
      await new Promise(resolve=>setTimeout(resolve,90))
    }

    state.view=previous.view
    state.region=previous.region
    await ensureBase(state.view)
    const restore=await dbGet(key())
    await loadBlobIntoMask(restore)
    setRegions()
    updateLabels()
  }

  async function exportSelectedLevels(){
    const source=await canvasBlob(mask)
    await exportLevelsFor(state.view,state.region,source)
    setStatus('Exported levels 1–4 for '+state.view+' '+regionLabel()+'.')
  }

  async function exportAllSaved(){
    const keys=await dbKeys()
    if(!keys.length){
      setStatus('No saved masks to export.')
      return
    }

    const original={view:state.view,region:state.region}
    let completed=0
    for(const id of keys){
      const [variant,view,region]=String(id).split(':')
      if(variant!=='male')continue
      const blob=await dbGet(id)
      if(!blob)continue
      setStatus('Exporting '+view+' '+region+'…')
      await exportLevelsFor(view,region,blob)
      completed++
    }

    state.view=original.view
    state.region=original.region
    setRegions()
    await loadSavedMask()
    setStatus('Exported '+completed+' saved regions at four intensity levels each.')
  }

  async function exportManifest(){
    const keys=await dbKeys()
    const manifest={
      variant:'male',
      canvas:config.canvas,
      generatedAt:new Date().toISOString(),
      regions:keys.map(id=>{
        const [variant,view,region]=String(id).split(':')
        return {
          variant,
          view,
          region,
          mask:config.maskName({variant,view,region}),
          levels:[1,2,3,4].map(level=>config.assetName({variant,view,region,level}))
        }
      })
    }
    const blob=new Blob([JSON.stringify(manifest,null,2)],{type:'application/json'})
    downloadBlob(blob,'male-anatomy-overlay-manifest.json')
    setStatus('Exported anatomy overlay manifest.')
  }

  async function switchView(){
    state.view=els.view.value
    state.region=config.regions[state.view][0].id
    setRegions()
    baseImages[state.view]=null
    await ensureBase()
    await loadSavedMask()
    await render()
  }

  async function switchRegion(){
    state.region=els.region.value
    await loadSavedMask()
    await render()
  }

  els.view.addEventListener('change',switchView)
  els.region.addEventListener('change',switchRegion)
  els.level.addEventListener('change',()=>{state.level=Number(els.level.value);render()})
  els.brush.addEventListener('input',()=>{state.brush=Number(els.brush.value);updateLabels()})
  els.feather.addEventListener('input',()=>{state.feather=Number(els.feather.value);updateLabels()})
  els.diffThreshold.addEventListener('input',()=>{state.diffThreshold=Number(els.diffThreshold.value);updateLabels()})

  els.paint.addEventListener('click',()=>{
    state.mode='paint'
    els.paint.classList.add('active')
    els.erase.classList.remove('active')
    updateLabels()
  })
  els.erase.addEventListener('click',()=>{
    state.mode='erase'
    els.erase.classList.add('active')
    els.paint.classList.remove('active')
    updateLabels()
  })

  els.clear.addEventListener('click',async()=>{
    clearCanvas(maskCtx,mask)
    await render()
    setStatus('Cleared current '+state.view+' '+regionLabel()+' mask.')
  })

  els.baseUpload.addEventListener('change',async event=>{
    const file=event.target.files?.[0]
    if(!file)return
    if(customBaseUrls[state.view])URL.revokeObjectURL(customBaseUrls[state.view])
    customBaseUrls[state.view]=URL.createObjectURL(file)
    baseImages[state.view]=null
    await ensureBase()
    await render()
    setStatus('Loaded custom '+state.view+' base image for this session.')
  })

  els.litUpload.addEventListener('change',async event=>{
    const file=event.target.files?.[0]
    if(!file)return
    if(litUrls[state.view])URL.revokeObjectURL(litUrls[state.view])
    litUrls[state.view]=URL.createObjectURL(file)
    litImages[state.view]=await loadImage(litUrls[state.view])
    setStatus('Loaded lit '+state.view+' reference. Adjust the threshold, then extract the mask.')
  })

  els.extractMask.addEventListener('click',extractDifferenceMask)

  els.maskUpload.addEventListener('change',async event=>{
    const file=event.target.files?.[0]
    if(!file)return
    await loadBlobIntoMask(file)
    setStatus('Imported master mask for '+state.view+' '+regionLabel()+'.')
  })

  els.saveMask.addEventListener('click',saveCurrentMask)
  els.exportMask.addEventListener('click',exportMask)
  els.exportLevels.addEventListener('click',exportSelectedLevels)
  els.exportAll.addEventListener('click',exportAllSaved)
  els.exportManifest.addEventListener('click',exportManifest)

  els.display.addEventListener('pointerdown',beginPaint)
  els.display.addEventListener('pointermove',movePaint)
  els.display.addEventListener('pointerup',endPaint)
  els.display.addEventListener('pointercancel',endPaint)
  els.display.addEventListener('pointerleave',event=>{
    if(event.buttons===0)endPaint()
  })

  els.saved.addEventListener('click',async event=>{
    const button=event.target.closest('[data-mask-key]')
    if(!button)return
    const [,view,region]=button.dataset.maskKey.split(':')
    state.view=view
    state.region=region
    els.view.value=view
    setRegions()
    els.region.value=region
    baseImages[view]=null
    await ensureBase()
    await loadSavedMask()
  })

  async function init(){
    setRegions()
    await ensureBase()
    await loadSavedMask()
    await refreshSavedRegions()
    await render()
    setStatus('Ready. Paint a master mask or load one from a file.')
  }

  init().catch(error=>{
    console.error(error)
    setStatus('Mask Studio error: '+error.message)
  })
})()