(function () {
  'use strict';

  const playedTokens = new Set();
  let queue = Promise.resolve();
  let activeAudio = null;

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

  function playBase64Audio(base64, mimeType) {
    return new Promise((resolve, reject) => {
      if (!base64) {
        resolve(false);
        return;
      }
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
        if (result && typeof result.catch === 'function') result.catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  async function run(options) {
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
    queue = queue.catch(() => {}).then(() => run(options));
    return queue;
  }

  function stop() {
    if (activeAudio) {
      try {
        activeAudio.pause();
        activeAudio.currentTime = 0;
      } catch {}
      activeAudio = null;
    }
  }

  window.GoWorkoutCoach = { emit, stop };
})();
