// Synthesized sound effects via WebAudio, so the game ships with no audio files.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let noiseBuffer = null;
  let muted = false;

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);

    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    // Continuous engine hum
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 48;
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 200;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter).connect(engineGain).connect(master);
    engineOsc.start();
  }

  function env(gainNode, t, attack, peak, decay) {
    gainNode.gain.setValueAtTime(0.0001, t);
    gainNode.gain.exponentialRampToValueAtTime(peak, t + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  function laser() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(1400 + Math.random() * 200, t);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.12);
    env(g, t, 0.005, 0.12, 0.13);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 3000;
    o.connect(f).connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.2);
  }

  function enemyLaser() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(520, t);
    o.frequency.exponentialRampToValueAtTime(90, t + 0.2);
    env(g, t, 0.005, 0.05, 0.2);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.25);
  }

  function noiseBurst(duration, freq, peak, q = 0.7) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(60, t + duration);
    const g = ctx.createGain();
    env(g, t, 0.01, peak, duration);
    src.connect(f).connect(g).connect(master);
    src.start(t);
    src.stop(t + duration + 0.05);
  }

  function explosion(size = 1) {
    noiseBurst(0.6 + size * 0.5, 900 + size * 400, Math.min(0.9, 0.35 + size * 0.2));
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.6);
    env(g, t, 0.01, 0.5, 0.6);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.7);
  }

  function hit() {
    noiseBurst(0.18, 2400, 0.25, 4);
  }

  function damage() {
    noiseBurst(0.35, 500, 0.6, 1);
  }

  function pickup() {
    if (!ctx) return;
    const t = ctx.currentTime;
    [660, 880, 1320].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      env(g, t + i * 0.06, 0.005, 0.18, 0.18);
      o.connect(g).connect(master);
      o.start(t + i * 0.06);
      o.stop(t + i * 0.06 + 0.25);
    });
  }

  function alert() {
    if (!ctx) return;
    const t = ctx.currentTime;
    [0, 0.22].forEach((d) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = 740;
      env(g, t + d, 0.01, 0.15, 0.16);
      o.connect(g).connect(master);
      o.start(t + d);
      o.stop(t + d + 0.2);
    });
  }

  function setEngine(throttle, boosting) {
    if (!ctx) return;
    const t = ctx.currentTime;
    engineOsc.frequency.setTargetAtTime(44 + throttle * 40 + (boosting ? 30 : 0), t, 0.1);
    engineFilter.frequency.setTargetAtTime(160 + throttle * 700 + (boosting ? 900 : 0), t, 0.1);
    engineGain.gain.setTargetAtTime(0.05 + throttle * 0.1, t, 0.1);
  }

  function silenceEngine() {
    if (!ctx) return;
    engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
  }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.02);
    return muted;
  }

  return { init, laser, enemyLaser, explosion, hit, damage, pickup, alert, setEngine, silenceEngine, toggleMute };
}
