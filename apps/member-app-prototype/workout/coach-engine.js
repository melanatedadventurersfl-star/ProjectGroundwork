(function () {
  'use strict';

  const playedTokens = new Set();
  let queue = Promise.resolve();
  let audioContext = null;
  let activeSource = null;
  let activeAudio = null;
  let persistentAudio = null;
  let persistentAudioUrl = '';
  let audioHoldSource = null;
  let audioHoldGain = null;
  let stopGeneration = 0;
  let audioUnlocked = false;
  let recoveryBound = false;
  let audioSessionBound = false;

  function isAppleMobileWebKit() {
    try {
      const ua = navigator.userAgent || '';
      return /iPad|iPhone|iPod/.test(ua) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    } catch {
      return false;
    }
  }

  function configureAudioSession() {
    try {
      if (!('audioSession' in navigator) || !navigator.audioSession) return;
      navigator.audioSession.type = 'playback';
      if (!audioSessionBound && typeof navigator.audioSession.addEventListener === 'function') {
        audioSessionBound = true;
        navigator.audioSession.addEventListener('statechange', () => {
          if (navigator.audioSession.state === 'interrupted') audioUnlocked = false;
        });
      }
    } catch {}
  }

  function freshAudioContextForGesture() {
    const ctx = ensureAudioContext();
    if (!ctx || !isAppleMobileWebKit() || ctx.state !== 'interrupted') return ctx;
    try { ctx.close?.(); } catch {}
    audioContext = null;
    return ensureAudioContext();
  }

  function releaseAudioHoldAfterStart() {
    if (isAppleMobileWebKit()) {
      setTimeout(() => stopAudioHold(), 450);
      return;
    }
    stopAudioHold();
  }

  function bindMobileRecovery() {
    if (recoveryBound || !isAppleMobileWebKit()) return;
    recoveryBound = true;

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        audioUnlocked = false;
        stopAudioHold();
      } else {
        configureAudioSession();
      }
    });

    window.addEventListener('pagehide', () => {
      audioUnlocked = false;
      stopAudioHold();
    });

    document.addEventListener('pointerdown', () => {
      const ctx = audioContext;
      let interrupted = false;
      try {
        interrupted = navigator.audioSession?.state === 'interrupted';
      } catch {}
      if (!ctx && !persistentAudio) return;
      if (!audioUnlocked || ctx?.state !== 'running' || interrupted) unlock();
    }, { capture: true, passive: true });
  }

  function rememberToken(token) {
    if (!token) return true;
    if (playedTokens.has(token)) return false;
    playedTokens.add(token);
    if (playedTokens.size > 160) {
      const first = playedTokens.values().next().value;
      playedTokens.delete(first);
    }
    return true;
  }

  function timeout(promise, ms) {
    let handle;
    const timer = new Promise((_, reject) => {
      handle = setTimeout(() => reject(new Error('Coach request timed out')), ms);
    });
    return Promise.race([promise, timer]).finally(() => clearTimeout(handle));
  }

  function ensureAudioContext() {
    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return null;
      if (!audioContext || audioContext.state === 'closed') audioContext = new AudioCtor();
      return audioContext;
    } catch {
      return null;
    }
  }

  function ensurePersistentAudio() {
    if (persistentAudio) return persistentAudio;
    try {
      const audio = document.createElement('audio');
      audio.preload = 'auto';
      audio.setAttribute('playsinline', '');
      audio.style.display = 'none';
      document.body.appendChild(audio);
      persistentAudio = audio;
      return audio;
    } catch {
      return null;
    }
  }

  function primeAudioElement() {
    const audio = ensurePersistentAudio();
    if (!audio) return;
    try {
      // Tiny silent WAV. Starting it inside the user's tap gives Safari an
      // immediately authorized media action before the network request begins.
      const silentWav = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
      audio.src = silentWav;
      audio.muted = false;
      audio.volume = 1;
      const play = audio.play();
      if (play && typeof play.catch === 'function') play.catch(() => {});
    } catch {}
  }

  function primeAudioContext() {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    try {
      if (ctx.state === 'suspended') ctx.resume?.();
      const buffer = ctx.createBuffer(1, 1, Math.max(22050, ctx.sampleRate || 44100));
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch {}
  }

  function startAudioHold() {
    const ctx = ensureAudioContext();
    if (!ctx || audioHoldSource) return;
    try {
      if (ctx.state === 'suspended') ctx.resume?.();
      const source = ctx.createOscillator();
      const gain = ctx.createGain();
      source.frequency.value = 20;
      gain.gain.value = 0.00001;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(0);
      audioHoldSource = source;
      audioHoldGain = gain;
    } catch {}
  }

  function stopAudioHold() {
    if (audioHoldSource) {
      try { audioHoldSource.stop(0); } catch {}
      try { audioHoldSource.disconnect(); } catch {}
      audioHoldSource = null;
    }
    if (audioHoldGain) {
      try { audioHoldGain.disconnect(); } catch {}
      audioHoldGain = null;
    }
  }

  function unlock() {
    configureAudioSession();
    bindMobileRecovery();
    const ctx = freshAudioContextForGesture();
    primeAudioElement();
    if (!ctx) return Promise.resolve(false);

    let resume = Promise.resolve();
    try {
      if (ctx.state !== 'running' && typeof ctx.resume === 'function') resume = Promise.resolve(ctx.resume());
    } catch {
      resume = Promise.resolve();
    }

    return resume.then(() => {
      primeAudioContext();
      startAudioHold();
      audioUnlocked = ctx.state === 'running';
      return audioUnlocked;
    }).catch(() => {
      audioUnlocked = false;
      return false;
    });
  }

  async function runningAudioContext() {
    const ctx = ensureAudioContext();
    if (!ctx) return null;
    try {
      if (ctx.state === 'suspended') {
        await Promise.race([
          ctx.resume(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('AudioContext resume timed out')), 1200))
        ]);
      }
      return ctx.state === 'running' ? ctx : null;
    } catch {
      return null;
    }
  }

  function decodeBase64(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  function base64Blob(base64, mimeType) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mimeType || 'audio/mpeg' });
  }

  async function playWithPersistentAudio(base64, mimeType) {
    const audio = ensurePersistentAudio();
    if (!audio) throw new Error('HTML audio is unavailable');
    if (persistentAudioUrl) {
      try { URL.revokeObjectURL(persistentAudioUrl); } catch {}
      persistentAudioUrl = '';
    }
    const blob = base64Blob(base64, mimeType);
    persistentAudioUrl = URL.createObjectURL(blob);
    audio.pause();
    audio.currentTime = 0;
    audio.muted = false;
    audio.src = persistentAudioUrl;
    audio.load();
    activeAudio = audio;
    return await new Promise((resolve, reject) => {
      let settled = false;
      const clean = () => {
        audio.onended = null;
        audio.onerror = null;
      };
      audio.onended = () => {
        if (settled) return;
        settled = true;
        clean();
        if (activeAudio === audio) activeAudio = null;
        resolve(true);
      };
      audio.onerror = () => {
        if (settled) return;
        settled = true;
        clean();
        if (activeAudio === audio) activeAudio = null;
        reject(new Error('AI coach HTML audio could not play'));
      };
      try {
        const result = audio.play();
        if (result && typeof result.then === 'function') {
          result.then(() => releaseAudioHoldAfterStart()).catch(error => {
            if (settled) return;
            settled = true;
            clean();
            if (activeAudio === audio) activeAudio = null;
            reject(error);
          });
        } else {
          stopAudioHold();
        }
        if (result && typeof result.catch === 'function' && typeof result.then !== 'function') {
          result.catch(error => {
            if (settled) return;
            settled = true;
            clean();
            if (activeAudio === audio) activeAudio = null;
            reject(error);
          });
        }
      } catch (error) {
        settled = true;
        clean();
        if (activeAudio === audio) activeAudio = null;
        reject(error);
      }
    });
  }

  async function playBase64Audio(base64, mimeType) {
    if (!base64) return false;
    configureAudioSession();

    const ctx = await runningAudioContext();
    if (ctx) {
      try {
        const buffer = await ctx.decodeAudioData(decodeBase64(base64));
        const played = await new Promise((resolve, reject) => {
          try {
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);
            activeSource = source;
            source.onended = () => {
              if (activeSource === source) activeSource = null;
              resolve(true);
            };
            source.start(0);
            releaseAudioHoldAfterStart();
          } catch (error) {
            if (activeSource) activeSource = null;
            reject(error);
          }
        });
        if (played) return true;
      } catch (error) {
        console.warn('Web Audio playback failed, trying HTML audio', error);
      }
    }

    return await playWithPersistentAudio(base64, mimeType);
  }

  async function run(options, generation) {
    const settings = options.settings || {};
    if (settings.voice === false) return;

    let response = null;
    if (settings.aiCoach !== false && typeof options.invoke === 'function') {
      try {
        const requestTimeout = options.event === 'test' ? 20000 : 15000;
        response = await timeout(options.invoke({
          event: options.event,
          context: options.context || {},
          style: settings.coachStyle || 'balanced',
          vibe: settings.coachVibe || 'warm-familiar',
          frequency: settings.coachFrequency || 'normal',
          voice: settings.coachVoice || 'cedar',
          detail: settings.coachDetail || 'short',
          talkSpeed: settings.talkSpeed || 'normal',
          nameUsage: settings.nameUsage || 'occasional',
          formCues: settings.formCues || 'basic',
          performanceFeedback: settings.performanceFeedback || 'session',
          motivation: settings.motivation || 'moderate',
          countdownMode: settings.countdownMode || 'full',
          warmupGuidance: settings.warmupGuidance || 'guided',
          cooldownGuidance: settings.cooldownGuidance || 'guided',
          adaptiveCoach: settings.adaptiveCoach !== false
        }), requestTimeout);
      } catch (error) {
        stopAudioHold();
        if (typeof options.onError === 'function') options.onError(error);
        if (error?.code === 'ai_not_configured' || error?.code === 'ai_quota_exhausted') {
          console.warn('AI coach is unavailable', error);
          return;
        }
        console.warn('AI coach request failed', error);
        return;
      }
    }

    if (generation !== stopGeneration) return;
    const line = String(response?.line || options.fallbackLine || '').trim();
    if (!line) return;

    if (response?.audioBase64) {
      try {
        await playBase64Audio(response.audioBase64, response.mimeType || 'audio/mpeg');
        return;
      } catch (error) {
        console.warn('AI coach audio playback failed', error);
        if (typeof options.onPlaybackError === 'function') options.onPlaybackError(error);
        return;
      }
    }

    if (settings.aiCoach === false && typeof options.fallbackSpeak === 'function') {
      options.fallbackSpeak(line, options.token ? 'coach-fallback-' + options.token : '');
    }
  }

  function emit(options) {
    if (!options || !rememberToken(options.token || '')) return Promise.resolve();
    const generation = stopGeneration;
    queue = queue.catch(() => {}).then(() => generation === stopGeneration ? run(options, generation) : undefined);
    return queue;
  }

  function playClip(base64, mimeType) {
    if (!base64) return Promise.resolve(false);
    const generation = stopGeneration;
    queue = queue.catch(() => {}).then(async () => {
      if (generation !== stopGeneration) return false;
      startAudioHold();
      try {
        return await playBase64Audio(base64, mimeType || 'audio/mpeg');
      } catch (error) {
        console.warn('Coach cue playback failed', error);
        return false;
      }
    });
    return queue;
  }

  function stop() {
    stopGeneration += 1;
    queue = Promise.resolve();
    audioUnlocked = false;
    stopAudioHold();
    if (activeSource) {
      try { activeSource.stop(0); } catch {}
      activeSource = null;
    }
    if (activeAudio) {
      try {
        activeAudio.pause();
        activeAudio.currentTime = 0;
      } catch {}
      activeAudio = null;
    }
    if (persistentAudioUrl) {
      try { URL.revokeObjectURL(persistentAudioUrl); } catch {}
      persistentAudioUrl = '';
    }
  }

  window.GoWorkoutCoach = { emit, stop, unlock, playClip };
})();
