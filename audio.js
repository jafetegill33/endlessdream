export function createAudioSystem() {
  let ctx = null;
  let started = false;

  let master, lowRumble, lowGain, rumblePanner;
  let hissNoise, hissFilter, hissGain, hissPanner;

  function initAudio() {
    if (started) return;

    ctx = new (window.AudioContext || window.webkitAudioContext)();

    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);

    // LOW RUMBLE
    lowRumble = ctx.createOscillator();
    lowRumble.type = 'sine';
    lowRumble.frequency.value = 38;

    lowGain = ctx.createGain();
    lowGain.gain.value = 0.0;

    rumblePanner = ctx.createPanner();
    rumblePanner.panningModel = 'HRTF';
    rumblePanner.distanceModel = 'inverse';

    lowRumble.connect(lowGain);
    lowGain.connect(rumblePanner);
    rumblePanner.connect(master);
    lowRumble.start();

    // HISS
    hissNoise = createNoise(ctx);

    hissFilter = ctx.createBiquadFilter();
    hissFilter.type = 'bandpass';
    hissFilter.frequency.value = 900;
    hissFilter.Q.value = 0.8;

    hissGain = ctx.createGain();
    hissGain.gain.value = 0.0;

    hissPanner = ctx.createPanner();
    hissPanner.panningModel = 'HRTF';
    hissPanner.distanceModel = 'inverse';

    hissNoise.connect(hissFilter);
    hissFilter.connect(hissGain);
    hissGain.connect(hissPanner);
    hissPanner.connect(master);

    // Proper listener positioning (modern API)
    ctx.listener.positionX.setValueAtTime(0, ctx.currentTime);
    ctx.listener.positionY.setValueAtTime(0, ctx.currentTime);
    ctx.listener.positionZ.setValueAtTime(0, ctx.currentTime);

    ctx.listener.forwardX.setValueAtTime(0, ctx.currentTime);
    ctx.listener.forwardY.setValueAtTime(0, ctx.currentTime);
    ctx.listener.forwardZ.setValueAtTime(-1, ctx.currentTime);
    ctx.listener.upX.setValueAtTime(0, ctx.currentTime);
    ctx.listener.upY.setValueAtTime(1, ctx.currentTime);
    ctx.listener.upZ.setValueAtTime(0, ctx.currentTime);

    if (ctx.state === 'suspended') ctx.resume();
    started = true;
  }

  window.addEventListener('pointerdown', initAudio, { once: true });
  window.addEventListener('keydown', initAudio, { once: true });

  function update(threat = 0, focus = 1) {
    if (!started || !ctx) return;

    threat = Math.max(0, Math.min(1, threat));
    focus = Math.max(0, Math.min(1, focus));

    const t = ctx.currentTime;

    lowGain.gain.linearRampToValueAtTime(
      0.15 + threat * 0.5 + (1 - focus) * 0.25,
      t + 0.15
    );

    hissGain.gain.linearRampToValueAtTime(
      0.02 + threat * 0.3,
      t + 0.1
    );

    lowRumble.frequency.linearRampToValueAtTime(
      36 + threat * 12 + (1 - focus) * 6,
      t + 0.2
    );

    // Modern spatial positioning
    const angle = performance.now() * 0.0003 * (0.5 + threat);

    const x = Math.cos(angle) * 4;
    const z = Math.sin(angle) * 4;
    const y = (1 - focus) * 1.5;

    rumblePanner.positionX.setValueAtTime(x, t);
    rumblePanner.positionY.setValueAtTime(y, t);
    rumblePanner.positionZ.setValueAtTime(z, t);

    hissPanner.positionX.setValueAtTime(-x, t);
    hissPanner.positionY.setValueAtTime(y * 0.6, t);
    hissPanner.positionZ.setValueAtTime(-z, t);
  }

  return { update };
}

function createNoise(ctx) {
  const bufferSize = 2 * ctx.sampleRate;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 5;
  }

  const node = ctx.createBufferSource();
  node.buffer = buffer;
  node.loop = true;
  node.start();

  return node;
}
