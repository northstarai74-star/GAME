export function createAudio() {
  let ctx = null;
  let master, engineGain, engineFilter, oscA, oscB, rumbleGain, rumbleFilter;
  let muted = false;
  const VOLUME = 0.5;

  function init() {
    if (ctx) {
      ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : VOLUME;
    master.connect(ctx.destination);

    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 250;
    engineFilter.Q.value = 4;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineFilter.connect(engineGain).connect(master);

    oscA = ctx.createOscillator();
    oscA.type = 'sawtooth';
    oscA.frequency.value = 48;
    oscB = ctx.createOscillator();
    oscB.type = 'sawtooth';
    oscB.frequency.value = 48.6;
    oscA.connect(engineFilter);
    oscB.connect(engineFilter);
    oscA.start();
    oscB.start();

    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = 'bandpass';
    rumbleFilter.frequency.value = 300;
    rumbleFilter.Q.value = 0.8;
    rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0;
    noise.connect(rumbleFilter).connect(rumbleGain).connect(master);
    noise.start();
  }

  function tone(freq, start, dur, type = 'sine', vol = 0.25, endFreq) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(master);
    o.start(start);
    o.stop(start + dur + 0.05);
  }

  return {
    init,
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (ctx) master.gain.setTargetAtTime(muted ? 0 : VOLUME, ctx.currentTime, 0.05);
      return muted;
    },
    suspend() {
      if (ctx) ctx.suspend();
    },
    update(throttle, boost, speed, active) {
      if (!ctx) return;
      const t = ctx.currentTime;
      const on = active ? 1 : 0.35;
      engineGain.gain.setTargetAtTime((0.05 + throttle * 0.1 + boost * 0.08) * on, t, 0.12);
      engineFilter.frequency.setTargetAtTime(180 + throttle * 420 + boost * 1100, t, 0.12);
      oscA.frequency.setTargetAtTime(42 + speed * 0.12, t, 0.2);
      oscB.frequency.setTargetAtTime(42.7 + speed * 0.12 + boost * 6, t, 0.2);
      rumbleGain.gain.setTargetAtTime((0.02 + throttle * 0.05 + boost * 0.12) * on, t, 0.15);
      rumbleFilter.frequency.setTargetAtTime(250 + boost * 900, t, 0.2);
    },
    collect(combo = 0) {
      if (!ctx) return;
      const t = ctx.currentTime;
      const base = 660 * Math.pow(2, Math.min(combo, 6) / 12);
      [1, 1.25, 1.5, 2].forEach((m, i) => tone(base * m, t + i * 0.06, 0.4, 'sine', 0.18));
      tone(base * 4, t + 0.24, 0.6, 'triangle', 0.06);
    },
    impact(strength) {
      if (!ctx) return;
      const t = ctx.currentTime;
      tone(120, t, 0.35, 'sine', Math.min(0.5, 0.15 + strength * 0.004), 40);
      tone(60, t, 0.5, 'square', 0.05, 30);
    },
    launch() {
      if (!ctx) return;
      const t = ctx.currentTime;
      tone(90, t, 1.2, 'sawtooth', 0.08, 380);
      tone(180, t + 0.1, 1.0, 'sine', 0.1, 720);
    },
    win() {
      if (!ctx) return;
      const t = ctx.currentTime;
      [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, t + i * 0.12, 0.9, 'sine', 0.16));
    },
  };
}
