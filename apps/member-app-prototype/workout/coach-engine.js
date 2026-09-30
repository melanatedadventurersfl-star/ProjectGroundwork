(function () {
  'use strict';

  const playedTokens = new Set();
  let queue = Promise.resolve();
  let audioContext = null;
  let activeSource = null;
  let activeAudio = null;
  let stopGeneration = 0;

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
      if (!audioContext) audioContext = new AudioCtor();
      if (audioContext.state === 'suspended') audioContext.resume?.();
      return audioContext;
    } catch {
      return null;
    }
  }

  function unlock() {
    ensureAudioContext();
  }

  function decodeBase64(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  async function playBase64Audio(base64, mimeType) {
    if (!base64) return false;
    const ctx = ensureAudioContext();
    if (ctx) {
      const buffer = await ctx.decodeAudioData(decodeBase64(base64));
      return await new Promise((resolve, reject) => {
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
        } catch (error) {
          if (activeSource) activeSource = null;
          reject(error);
        }
      });
    }

    return await new Promise((resolve, reject) => {
      try {
        const audio = new Audio('data:' + (mimeType || 'audio/mpeg') + ';base64,' + base64);
        activeAudio = audio;
        audio.preload = 'auto';
        audio.onended = () => {
          if (activeAudio === audio) activeAudio = null;
          resolve(true);
        };
        audio.onerror = () => {
          if (activeAudio === audio) activeAudio = null;
          reject(new Error('AI coach audio could not play'));
        };
        const result = audio.play();
        if (result && typeof result.catch === 'function') {
          result.catch(error => {
            if (activeAudio === audio) activeAudio = null;
            reject(error);
          });
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  async function run(options, generation) {
    const settings = options.settings || {};
    if (settings.voice === false) return;

    let response = null;
    if (settings.aiCoach !== false && typeof options.invoke === 'function') {
      try {
        response = await timeout(options.invoke({
          event: options.event,
          context: options.context || {},
          style: settings.coachStyle || 'balanced',
          frequency: settings.coachFrequency || 'normal',
          voice: settings.coachVoice || 'cedar'
        }), 7000);
      } catch (error) {
        console.warn('AI coach request failed, using local voice fallback', error);
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
        console.warn('AI coach audio playback failed, using local voice fallback', error);
      }
    }

    if (typeof options.fallbackSpeak === 'function') {
      options.fallbackSpeak(line, options.token ? 'coach-fallback-' + options.token : '');
    }
  }

  function emit(options) {
    if (!options || !rememberToken(options.token || '')) return Promise.resolve();
    const generation = stopGeneration;
    queue = queue.catch(() => {}).then(() => generation === stopGeneration ? run(options, generation) : undefined);
    return queue;
  }

  function stop() {
    stopGeneration += 1;
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
  }

  window.GoWorkoutCoach = { emit, stop, unlock };
})();
