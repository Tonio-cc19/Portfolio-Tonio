// Intro 3D : Miami de nuit, voiture de sport en temps réel (three.js)
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

const host = document.getElementById('intro');
if (host){ try { start(); } catch (e) { host.classList.add('nofx'); } }

/* ---------- sons de l'intro : moteur, route, vent, nitro (synthèse Web Audio, aucun fichier) ---------- */
function makeAudio(onState){
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  let ctx = null, on = true, started = false, N = null, cruiseT = null, boosting = false;
  on = false; // le son est coupé à l'arrivée : c'est le visiteur qui choisit de l'activer
  const LEVEL = 0.4, MUSIC = 0.55;
  let music = null, musicG = null;
  const noise = (sec, kind) => { const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); let l = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++){ const w = Math.random() * 2 - 1;
      if (kind === 'brown'){ l = (l + 0.02 * w) / 1.02; d[i] = l * 3.5; }
      else if (kind === 'pink'){ b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
      else d[i] = w; }
    return b; };
  const loop = (buf, rate = 1) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate; s.start(); return s; };
  const filt = (type, f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  const gain = v => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const chain = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };
  function build(){
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor(); Object.assign(comp, {}); comp.threshold.value = -22; comp.knee.value = 14; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.25;
    const master = gain(0); chain(master, comp, ctx.destination);
    // moteur : V8 au ralenti de croisière, harmoniques désaccordées, saturation douce, filtre passe-bas
    const pre = gain(0.45), sh = ctx.createWaveShaper(), cur = new Float32Array(1024); for (let i = 0; i < 1024; i++){ const x = i / 511.5 - 1; cur[i] = Math.tanh(1.3 * x); } sh.curve = cur; sh.oversample = '2x';
    const lp = filt('lowpass', 360, 0.6), lp2 = filt('lowpass', 1400, 0.5), eng = gain(0.13), am = gain(1);
    chain(pre, sh, lp, lp2, am, eng, master);
    const osc = [[0.5, 'sine', 0.7], [1, 'triangle', 0.35], [1.004, 'sawtooth', 0.08], [0.25, 'sine', 0.35], [1.5, 'sine', 0.06]].map(([r, type, g]) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = 180 * r; const gg = gain(g); o.connect(gg); gg.connect(pre); o.start(); return { o, r }; });
    // grondement irrégulier de l'échappement (modulation lente par du bruit)
    const rum = loop(noise(2, 'brown'), 0.7), rumG = gain(0.09); rum.connect(rumG); rumG.connect(am.gain);
    // pneus sur l'asphalte : bruit rose filtré, plus un roulement grave
    const road = gain(0.0), rd = loop(noise(3, 'pink')); chain(rd, filt('lowpass', 330, 0.5), filt('highpass', 70), road, master);
    const rumble = gain(0.0), rb = loop(noise(3, 'brown'), 1.3); chain(rb, filt('bandpass', 110, 0.9), rumble, master);
    // vent
    const wind = gain(0.0), wd = loop(noise(3, 'white')); const wbp = filt('bandpass', 600, 0.5); chain(wd, wbp, filt('lowpass', 1500), wind, master);
    N = { master, osc, lp, eng, road, rumble, wind, wbp, noiseW: noise(1.5, 'white') };
    try { music = new Audio('audio/intro-musique.mp3'); music.preload = 'auto'; music.loop = true; music.crossOrigin = 'anonymous';
      musicG = gain(0); ctx.createMediaElementSource(music).connect(musicG); musicG.connect(ctx.destination); } catch (e) { music = null; }
  }
  const now = () => ctx.currentTime;
  const setRpm = (rpm, t, mode = 'lin') => { const f = rpm / 15; N.osc.forEach(({ o, r }) => { const p = o.frequency; if (mode === 'set') p.setValueAtTime(f * r, t); else if (mode === 'exp') p.exponentialRampToValueAtTime(f * r, t); else p.linearRampToValueAtTime(f * r, t); }); };
  function cruise(){
    const t = now();
    N.road.gain.setTargetAtTime(0.11, t, 0.8); N.rumble.gain.setTargetAtTime(0.07, t, 0.8); N.wind.gain.setTargetAtTime(0.02, t, 1);
    setRpm(2100, t, 'set');
    clearInterval(cruiseT); cruiseT = setInterval(() => { if (!ctx || boosting) return; const tt = now(), r = 2050 + Math.random() * 160; N.osc.forEach(({ o, r: k }) => o.frequency.setTargetAtTime(r / 15 * k, tt, 0.35)); }, 700);
  }
  const fadeTo = (v, tc = 0.5) => N && N.master.gain.setTargetAtTime(v, now(), tc);
  function start(){
    if (!on) return;
    if (!ctx){ try { build(); } catch (e) { return; } }
    if (ctx.state === 'suspended') ctx.resume();
    if (!started){ started = true; cruise(); fadeTo(LEVEL, 0.6); if (music){ music.currentTime = 0; music.play().catch(() => {}); musicG.gain.setTargetAtTime(MUSIC, now(), 0.4); } }
    onState && onState(on, started);
  }
  // un bruit bref (pétarade, déclic) à l'instant t
  const burst = (t, dur, type, f, g, q = 0.8) => { const s = ctx.createBufferSource(); s.buffer = N.noiseW; const e = gain(0); chain(s, filt(type, f, q), e, N.master);
    e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(g, t + 0.004); e.gain.exponentialRampToValueAtTime(0.0005, t + dur); s.start(t, Math.random()); s.stop(t + dur + 0.05); };
  const thump = (t, f, g, dur) => { const o = ctx.createOscillator(), e = gain(0); o.frequency.setValueAtTime(f * 1.8, t); o.frequency.exponentialRampToValueAtTime(f, t + dur * 0.6); chain(o, e, N.master);
    e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(g, t + 0.006); e.gain.exponentialRampToValueAtTime(0.0005, t + dur); o.start(t); o.stop(t + dur + 0.05); };
  function nitro(){
    start(); if (!ctx || !on) return;
    boosting = true; clearInterval(cruiseT);
    const t = now() + 0.02;
    // 1. nitro façon jeu vidéo : un « fwoooosh » d'air comprimé (souffle filtré qui monte puis redescend), sans sifflement agressif
    { const s = ctx.createBufferSource(); s.buffer = N.noiseW; s.loop = true; const lp = filt('lowpass', 300, 3.5), hp = filt('highpass', 120), e = gain(0); chain(s, hp, lp, e, N.master);
      lp.frequency.setValueAtTime(300, t); lp.frequency.exponentialRampToValueAtTime(2200, t + 0.45); lp.frequency.exponentialRampToValueAtTime(900, t + 1.4); lp.frequency.exponentialRampToValueAtTime(400, t + 2.2);
      e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(0.2, t + 0.12); e.gain.linearRampToValueAtTime(0.16, t + 0.7); e.gain.exponentialRampToValueAtTime(0.0005, t + 2.2); s.start(t); s.stop(t + 2.3); }
    { const s = ctx.createBufferSource(); s.buffer = N.noiseW; const bp = filt('bandpass', 2600, 1.2), e = gain(0); chain(s, bp, e, N.master); // petit « pshh » de déclenchement
      e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(0.06, t + 0.01); e.gain.exponentialRampToValueAtTime(0.0005, t + 0.25); s.start(t); s.stop(t + 0.3); }
    // 2. moteur : montée de régime ronde et grave, un passage de rapport, puis la voiture s'éloigne
    thump(t, 42, 0.3, 0.4);
    setRpm(2100, t, 'set'); setRpm(5200, t + 0.85, 'exp'); setRpm(3900, t + 0.95, 'lin'); setRpm(5600, t + 1.8, 'exp');
    N.lp.frequency.cancelScheduledValues(t); N.lp.frequency.setValueAtTime(360, t); N.lp.frequency.exponentialRampToValueAtTime(900, t + 0.8); N.lp.frequency.linearRampToValueAtTime(600, t + 0.95); N.lp.frequency.exponentialRampToValueAtTime(1000, t + 1.4); N.lp.frequency.exponentialRampToValueAtTime(450, t + 2.2);
    N.eng.gain.cancelScheduledValues(t); N.eng.gain.setValueAtTime(0.13, t); N.eng.gain.linearRampToValueAtTime(0.22, t + 0.6); N.eng.gain.linearRampToValueAtTime(0.16, t + 0.95); N.eng.gain.linearRampToValueAtTime(0.21, t + 1.25); N.eng.gain.linearRampToValueAtTime(0.08, t + 2.2);
    // 3. deux pétarades étouffées au passage de rapport
    [0.9, 0.98].forEach(d => { const tt = t + d + Math.random() * 0.02; burst(tt, 0.08, 'lowpass', 420, 0.12, 0.5); thump(tt, 55, 0.1, 0.1); });
    // 4. vent et roulement qui montent avec la vitesse
    N.wind.gain.setTargetAtTime(0.12, t + 0.2, 0.6); N.wbp.frequency.setTargetAtTime(1000, t + 0.2, 0.6); N.road.gain.setTargetAtTime(0.16, t + 0.1, 0.5); N.rumble.gain.setTargetAtTime(0.1, t, 0.5);
  }
  function stop(){ clearInterval(cruiseT); if (!ctx) return; fadeTo(0, 0.25); if (musicG) musicG.gain.setTargetAtTime(0, now(), 0.35); const c = ctx, m = music; setTimeout(() => { try { m && m.pause(); c.close(); } catch (e) {} }, 1800); }
  function toggle(){
    if (!started || !ctx){ on = true; start(); onState && onState(on, started); return; }
    on = !on;
    if (on && ctx.state === 'suspended') ctx.resume();
    fadeTo(on ? LEVEL : 0, 0.15);
    if (music){ if (on){ music.play().catch(() => {}); musicG.gain.setTargetAtTime(MUSIC, now(), 0.3); } else { musicG.gain.setTargetAtTime(0, now(), 0.12); setTimeout(() => { if (!on) music.pause(); }, 500); } }
    onState && onState(on, started);
  }
  return { start, nitro, stop, toggle, get on(){ return on; } };
}

function start(){
  const test = document.createElement('canvas');
  if (!(test.getContext('webgl2') || test.getContext('webgl'))){ host.classList.add('nofx'); return; }

  const mob = innerWidth < 700;
  const canvas = document.createElement('canvas');
  canvas.className = 'i-3d';
  host.prepend(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  let PR = Math.min(devicePixelRatio, 2); renderer.setPixelRatio(PR); const MAXA = renderer.capabilities.getMaxAnisotropy();
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x2b0d48, 0.0095);
  const camera = new THREE.PerspectiveCamera(mob ? 62 : 48, 1, 0.1, 1200);
  const camBase = new THREE.Vector3(0, 1.75, 7.2);
  camera.position.copy(camBase);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const grain = (g, w, h, a, b) => { const im = g.getImageData(0, 0, w, h), d = im.data; for (let i = 0; i < d.length; i += 4){ const r = Math.random(); if (r < a){ const v = (Math.random() - .5) * b; d[i] += v; d[i + 1] += v; d[i + 2] += v; } } g.putImageData(im, 0, 0); };
  const cvs = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const tex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = MAXA; return t; };
  const radial = (rgba) => { const [c, g] = cvs(128, 128); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, rgba); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); };

  // tout ce qui défile (palmiers, lampadaires, immeubles, terrains) : période commune
  const movers = [], span = 32, nP = mob ? 8 : 12, PER = span * nP;
  const mover = o => { scene.add(o); movers.push(o); return o; };
  /* ---------- ciel ---------- */
  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x07051a) }, mid: { value: new THREE.Color(0x3a1166) }, low: { value: new THREE.Color(0xd2407f) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `uniform vec3 top, mid, low; varying vec3 vP;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      void main(){ float y = vP.y;
        vec3 c = mix(low, mid, smoothstep(-0.02, 0.18, y)); c = mix(c, top, smoothstep(0.16, 0.6, y));
        vec2 g = floor(vec2(atan(vP.z, vP.x) * 1.2, y) * vec2(900., 900.)); float s = step(0.9975, h(g)) * smoothstep(0.1, 0.45, y);
        gl_FragColor = vec4(c + s * 0.7, 1.); }`
  }));
  scene.add(sky);

  /* ---------- soleil ---------- */
  const sun = new THREE.Mesh(new THREE.CircleGeometry(95, 96), new THREE.ShaderMaterial({
    transparent: true, fog: false, toneMapped: false, depthWrite: false,
    uniforms: { t: { value: 0 } },
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `uniform float t; varying vec2 vU;
      void main(){ float y = vU.y;
        vec3 c = mix(vec3(1.0,0.25,0.62), vec3(1.0,0.62,0.28), smoothstep(0.15, 0.6, y)); c = mix(c, vec3(1.0,0.93,0.5), smoothstep(0.6, 1.0, y));
        float band = 0.0; if (y < 0.5){ float k = (0.5 - y) * 2.0; float f = fract(y * 14.0 + t * 0.35); band = step(f, 0.18 + k * 0.55); }
        if (band > 0.5) discard;
        gl_FragColor = vec4(c * 0.92, 1.); }`
  }));
  sun.position.set(0, 38, -520);
  scene.add(sun);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(520, 300), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'varying vec2 vU; void main(){ float d = distance(vU, vec2(.5,.42)); gl_FragColor = vec4(vec3(1.,.35,.55) * pow(max(0., 1. - d * 1.7), 2.6) * .24, 1.); }'
  }));
  glow.position.set(0, 30, -530);
  scene.add(glow);

  /* ---------- étoiles ---------- */
  { const n = mob ? 500 : 1100, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++){ const th = Math.random() * Math.PI - Math.PI / 2 - Math.PI / 2, ph = 0.12 + Math.random() * 1.3; pos[i * 3] = Math.cos(th) * Math.cos(ph) * 600 * -1; pos[i * 3 + 1] = Math.sin(ph) * 600 * 0.6 + 40; pos[i * 3 + 2] = Math.sin(th) * Math.cos(ph) * 600; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffe6f6, size: 1.3, sizeAttenuation: false, transparent: true, opacity: 0.75, fog: false, depthWrite: false }))); }
  /* ---------- montagnes ---------- */
  const mtn = (z, h, col, seed, edge) => {
    const s = new THREE.Shape(); s.moveTo(-700, 0); let x = -700, r = seed;
    while (x < 700){ r = (r * 16807) % 2147483647; x += 30 + (r % 50); const y = (Math.abs(x) < 120 ? 0.25 : 1) * h * (0.35 + ((r >> 8) % 100) / 140); s.lineTo(x, y); }
    s.lineTo(700, 0); s.lineTo(-700, 0);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshBasicMaterial({ color: col, fog: false }));
    m.position.set(0, -0.2, z); scene.add(m);
    const pts = s.getPoints().filter(p => p.y > 0.01).map(p => new THREE.Vector3(p.x, p.y, 0));
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: edge, fog: false, toneMapped: false }));
    l.position.copy(m.position); l.position.z += 0.5; scene.add(l);
  };
  mtn(-470, 60, 0x1d0a3a, 7, new THREE.Color(1.6, 0.45, 1.4));
  mtn(-430, 38, 0x12072a, 99, new THREE.Color(0.9, 0.3, 1.2));

  /* ---------- sol au-delà des trottoirs : dalles sombres, grille néon discrète au loin ---------- */
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(1400, 900), new THREE.ShaderMaterial({
    fog: false, toneMapped: false,
    uniforms: { off: { value: 0 } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float off; varying vec3 vW;
      void main(){ vec2 g = vec2(vW.x, vW.z - off) / 6.0; vec2 a = abs(fract(g - .5) - .5) / fwidth(g); float l = 1. - min(min(a.x, a.y), 1.);
        float fade = exp(-abs(vW.z) * 0.0055); float side = smoothstep(13., 16., abs(vW.x));
        vec3 base = vec3(.035,.012,.07); vec3 col = base + vec3(.9,.25,.8) * l * .38 * fade * side;
        col += vec3(.55,.12,.4) * exp(-abs(vW.z + 460.) * .012) * .2;
        gl_FragColor = vec4(col, 1.); }`
  }));
  grid.rotation.x = -Math.PI / 2; grid.position.set(0, -0.02, -440); scene.add(grid);

  /* ---------- route : asphalte, marquages, flaques ---------- */
  // une tuile = 16 m × 30 m
  const [rc, x] = cvs(512, 1920), PXM = 32; // 32 px par mètre en largeur, 64 en longueur
  x.fillStyle = '#17161c'; x.fillRect(0, 0, 512, 1920);
  grain(x, 512, 1920, 0.35, 34);
  const X = m => 256 + m * PXM; // x en mètres → pixels
  // traces de pneus plus sombres et polies au centre des voies
  [-4, 0, 4].forEach(c => [-0.8, 0.8].forEach(o => { x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(X(c + o) - 12, 0, 24, 1920); }));
  // réparations et joints
  for (let k = 0; k < 6; k++){ x.fillStyle = 'rgba(8,8,12,.55)'; x.fillRect(rnd(40, 400), rnd(0, 1800), rnd(40, 120), rnd(40, 160)); }
  x.strokeStyle = 'rgba(5,5,8,.7)'; x.lineWidth = 2; for (let k = 0; k < 5; k++){ x.beginPath(); let px = rnd(30, 480), py = rnd(0, 1900); x.moveTo(px, py); for (let j = 0; j < 8; j++){ px += rnd(-14, 14); py += rnd(8, 26); x.lineTo(px, py); } x.stroke(); }
  // marquages : bords pleins, voies en pointillés (3 m tous les 10 m), un peu usés
  const mark = (px, py, w, h, a) => { x.fillStyle = `rgba(236,232,224,${a})`; x.fillRect(px, py, w, h); for (let i = 0; i < w * h / 30; i++){ x.fillStyle = 'rgba(23,22,28,.6)'; x.fillRect(px + Math.random() * w, py + Math.random() * h, 2, 2); } };
  [-6, 6].forEach(m => mark(X(m) - 3, 0, 6, 1920, 0.82));
  [-2, 2].forEach(m => { for (let y = 0; y < 1920; y += 640) mark(X(m) - 3, y + 100, 6, 192, 0.8); });
  const roadT = tex(rc);
  const [rr, xr] = cvs(256, 960); xr.fillStyle = '#9a9a9a'; xr.fillRect(0, 0, 256, 960);
  for (let k = 0; k < 22; k++){ const gx = rnd(10, 246), gy = rnd(0, 960), gw = rnd(20, 70), gh = rnd(40, 160); const gr = xr.createRadialGradient(gx, gy, 0, gx, gy, gw); gr.addColorStop(0, 'rgba(20,20,20,.95)'); gr.addColorStop(1, 'rgba(20,20,20,0)'); xr.fillStyle = gr; xr.save(); xr.translate(gx, gy); xr.scale(1, gh / gw); xr.translate(-gx, -gy); xr.beginPath(); xr.arc(gx, gy, gw, 0, 7); xr.fill(); xr.restore(); }
  const roughT = tex(rr, false);
  [roadT, roughT].forEach(t => t.repeat.set(1, 30));
  const road = new THREE.Mesh(new THREE.PlaneGeometry(16, 900), new THREE.MeshStandardMaterial({ map: roadT, roughnessMap: roughT, roughness: 1, metalness: 0.0, envMapIntensity: 0.55, color: 0xb0aab8 }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0.01, -440); road.receiveShadow = true; scene.add(road);
  {
    const rs = (mob ? 0.5 : 0.65) * Math.min(devicePixelRatio, 2); var refl = new Reflector(new THREE.PlaneGeometry(16, 900), { textureWidth: innerWidth * rs, textureHeight: innerHeight * rs, color: 0x27232e });
    refl.rotation.x = -Math.PI / 2; refl.position.set(0, -0.005, -440); scene.add(refl);
    road.material.transparent = true; road.material.opacity = 0.91;
  }

  /* ---------- trottoirs en béton + bordures ---------- */
  const [sc, xs] = cvs(256, 1024); xs.fillStyle = '#5b5662'; xs.fillRect(0, 0, 256, 1024);
  grain(xs, 256, 1024, 0.3, 22);
  xs.fillStyle = 'rgba(20,18,26,.75)'; for (let y = 0; y < 1024; y += 51.2) xs.fillRect(0, y, 256, 2); xs.fillRect(128, 0, 2, 1024);
  for (let k = 0; k < 10; k++){ xs.fillStyle = `rgba(0,0,0,${rnd(0.05, 0.18)})`; xs.fillRect(rnd(0, 200), rnd(0, 980), rnd(20, 60), rnd(20, 60)); }
  const sideT = tex(sc); sideT.repeat.set(1, 45);
  const sideM = new THREE.MeshStandardMaterial({ map: sideT, roughness: 0.82, color: 0xc8c0d0 });
  const curbM = new THREE.MeshStandardMaterial({ color: 0x8a8392, roughness: 0.7 });
  const curbLED = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.35, 1.2), toneMapped: false });
  [-1, 1].forEach(sd => {
    const sw = new THREE.Mesh(new THREE.PlaneGeometry(5, 900), sideM); sw.rotation.x = -Math.PI / 2; sw.position.set(sd * 10.5, 0.15, -440); sw.receiveShadow = true; scene.add(sw);
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 900), curbM); curb.position.set(sd * 8.1, 0.08, -440); scene.add(curb);
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.025, 900), curbLED); led.position.set(sd * 7.95, 0.11, -440); scene.add(led);
  });

  /* ---------- lampadaires (tête LED) + flaques de lumière au sol ---------- */
  const poleM = new THREE.MeshStandardMaterial({ color: 0x2a2a33, metalness: 0.8, roughness: 0.35 });
  const headM = new THREE.MeshStandardMaterial({ color: 0x1a1a22, metalness: 0.6, roughness: 0.4 });
  const lensM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.3, 1.9), toneMapped: false });
  const poolT = radial('rgba(255,214,170,.55)');
  const poolM = new THREE.MeshBasicMaterial({ map: poolT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, color: new THREE.Color(0.7, 0.62, 0.52) });
  const lamps = [];
  for (let i = 0; i < nP; i++) [-1, 1].forEach(sd => {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 8, 12), poleM); pole.position.y = 4; g.add(pole);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.5, 12), poleM); base.position.y = 0.4; g.add(base);
    const arm = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 7.8, 0), new THREE.Vector3(0, 8.5, 0), new THREE.Vector3(-sd * 2.4, 8.4, 0)), 12, 0.05, 6), poleM); g.add(arm);
    const head = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.14, 0.34, 2, 0.05), headM); head.position.set(-sd * 2.6, 8.34, 0); g.add(head);
    const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.22), lensM); lens.rotation.x = Math.PI / 2; lens.position.set(-sd * 2.6, 8.26, 0); g.add(lens);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), poolM); pool.rotation.x = -Math.PI / 2; pool.position.set(-sd * 3.2, -0.12, 0); g.add(pool);
    g.position.set(sd * 8.7, 0.15, -i * span - (sd > 0 ? 0 : span / 2)); g.userData.sd = sd; mover(g); lamps.push(g);
  });
  /* ---------- palmiers le long de la route ---------- */
  const leafC = document.createElement('canvas'); leafC.width = 128; leafC.height = 512; const lc = leafC.getContext('2d');
  lc.strokeStyle = '#fff'; lc.lineCap = 'round';
  lc.lineWidth = 4; lc.beginPath(); lc.moveTo(64, 0); lc.lineTo(64, 512); lc.stroke(); // rachis
  lc.fillStyle = '#fff';
  for (let y = 6; y < 500; y += 7){ const t = y / 512, w = 62 * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.95)) * (0.85 + Math.random() * 0.3), dy = 34 + t * 20;
    [-1, 1].forEach(sd => { if (Math.random() < 0.07) return; // quelques folioles manquantes, comme sur un vrai palmier
      lc.beginPath(); lc.moveTo(64, y - 1.5); lc.quadraticCurveTo(64 + sd * w * 0.45, y + dy * 0.2, 64 + sd * w, y + dy); lc.quadraticCurveTo(64 + sd * w * 0.45, y + dy * 0.2 + 3.5, 64, y + 3.5); lc.fill(); }); }
  const leafT = new THREE.CanvasTexture(leafC);
  const leafM = new THREE.MeshStandardMaterial({ color: 0x2f5a34, alphaMap: leafT, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.7, emissive: 0x1a0c22, emissiveIntensity: 0.6 });
  // tronc annelé
  const ringC = document.createElement('canvas'); ringC.width = 16; ringC.height = 64; const rg = ringC.getContext('2d');
  for (let y = 0; y < 64; y++){ const v = 40 + 34 * Math.pow(Math.abs(Math.sin(y / 64 * Math.PI * 4)), 5); rg.fillStyle = `rgb(${v + 12 | 0},${v * 0.85 | 0},${v * 0.7 | 0})`; rg.fillRect(0, y, 16, 1); }
  const ringT = new THREE.CanvasTexture(ringC); ringT.wrapS = ringT.wrapT = THREE.RepeatWrapping; ringT.repeat.set(1, 14); ringT.colorSpace = THREE.SRGBColorSpace;
  const trunkM = new THREE.MeshStandardMaterial({ map: ringT, bumpMap: ringT, bumpScale: 2, roughness: 0.85 });
  const nutM = new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.6 });
  // feuille de palme : part du sommet, monte légèrement puis retombe en arc
  const leafGeo = (len) => {
    const g = new THREE.PlaneGeometry(2.3, 1, 6, 16); const pa = g.attributes.position;
    for (let i = 0; i < pa.count; i++){
      const x = pa.getX(i), t = pa.getY(i) + 0.5; // 0 → 1 le long de la feuille
      const out = t * len, up = len * (0.42 * t - 0.95 * t * t); // arc qui retombe
      pa.setXYZ(i, x * (0.3 + 0.7 * Math.sin(Math.PI * Math.min(1, t * 1.1))), up - Math.abs(x) * 0.55, out * (1 - 0.08 * t)); // pliure en V
    }
    g.computeVertexNormals(); return g;
  };
  const makePalm = (h, lean) => {
    const g = new THREE.Group();
    const top = new THREE.Vector3(lean, h, lean * 0.2);
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(lean * 0.15, h * 0.4, 0), new THREE.Vector3(lean * 0.55, h * 0.78, lean * 0.1), top]);
    const tg = new THREE.TubeGeometry(curve, 24, 0.2, 10);
    const trunk = new THREE.Mesh(tg, trunkM); g.add(trunk);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.38, 0.8, 10), trunkM); base.position.y = 0.4; g.add(base);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), trunkM); crown.position.copy(top); g.add(crown);
    for (let k = 0; k < 3; k++){ const nut = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), nutM); const a = k / 3 * Math.PI * 2; nut.position.set(top.x + Math.cos(a) * 0.25, top.y - 0.25, top.z + Math.sin(a) * 0.25); g.add(nut); }
    const nl = 16;
    for (let k = 0; k < nl; k++){
      const old = k % 2 === 0, len = old ? 4.2 + Math.random() * 1.2 : 3 + Math.random() * 0.8;
      const leaf = new THREE.Mesh(leafGeo(len), leafM);
      leaf.position.copy(top);
      leaf.rotation.order = 'YXZ';
      leaf.rotation.y = k / nl * Math.PI * 2 + Math.random() * 0.3;
      leaf.rotation.x = old ? 0.25 + Math.random() * 0.2 : -0.25 - Math.random() * 0.2; // vieilles palmes plus basses
      leaf.rotation.z = (Math.random() - 0.5) * 0.5;
      g.add(leaf);
    }
    return g;
  };
  /* ---------- terrains de basket de plein air (façon Miami Beach) avec des joueurs ---------- */
  const courtTex = (() => {
    const W = 17, D = 16, S = 40; const [c, g] = cvs(W * S, D * S); // 1 m = 40 px ; ligne de fond en haut
    g.fillStyle = '#1d3f52'; g.fillRect(0, 0, W * S, D * S);
    g.fillStyle = '#1f6f86'; g.fillRect(1 * S, 1 * S, 15 * S, 14 * S);
    grain(g, W * S, D * S, 0.25, 14);
    const cx = 8.5 * S, by = 1 * S; // centre, ligne de fond
    g.fillStyle = '#d94a86'; g.fillRect(cx - 2.45 * S, by, 4.9 * S, 5.8 * S); // raquette
    g.strokeStyle = '#f4f1ea'; g.lineWidth = 0.06 * S;
    g.strokeRect(1 * S, 1 * S, 15 * S, 14 * S);
    g.strokeRect(cx - 2.45 * S, by, 4.9 * S, 5.8 * S);
    g.beginPath(); g.arc(cx, by + 5.8 * S, 1.8 * S, 0, Math.PI); g.stroke();
    g.setLineDash([0.3 * S, 0.25 * S]); g.beginPath(); g.arc(cx, by + 5.8 * S, 1.8 * S, Math.PI, Math.PI * 2); g.stroke(); g.setLineDash([]);
    g.beginPath(); g.arc(cx, by + 1.575 * S, 1.25 * S, 0, Math.PI); g.stroke();
    // ligne à 3 points : couloirs droits puis arc de 6,75 m
    const r3 = 6.75 * S, hx = 6.6 * S, ang = Math.asin(hx / r3), ly = by + 1.575 * S + Math.cos(ang) * r3;
    g.beginPath(); g.moveTo(cx - hx, by); g.lineTo(cx - hx, ly); g.arc(cx, by + 1.575 * S, r3, Math.PI / 2 + ang, Math.PI / 2 - ang, true); g.lineTo(cx + hx, by); g.stroke();
    g.beginPath(); g.arc(cx, 15 * S, 1.8 * S, Math.PI, Math.PI * 2); g.stroke(); // rond central (moitié)
    g.font = `bold ${1.1 * S}px Michroma, Arial`; g.textAlign = 'center'; g.fillStyle = 'rgba(244,241,234,.85)'; g.fillText('MIAMI', cx, 12.2 * S);
    // usure
    for (let k = 0; k < 40; k++){ g.fillStyle = `rgba(0,0,0,${rnd(0.03, 0.09)})`; g.beginPath(); g.arc(rnd(0, W * S), rnd(0, D * S), rnd(10, 60), 0, 7); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = MAXA; return t;
  })();
  const fenceT = (() => { const [c, g] = cvs(64, 64); g.strokeStyle = '#fff'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(0, 0); g.lineTo(64, 64); g.moveTo(64, 0); g.lineTo(0, 64); g.stroke(); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
  const netT = (() => { const [c, g] = cvs(64, 64); g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(64, 64); g.moveTo(64, 0); g.lineTo(0, 64); g.stroke(); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 2); return t; })();
  const ballT = (() => { const [c, g] = cvs(256, 128); g.fillStyle = '#d4622a'; g.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 4000; i++){ g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; g.fillRect(Math.random() * 256, Math.random() * 128, 1.5, 1.5); }
    g.strokeStyle = '#1b0f08'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 64); g.lineTo(256, 64); [64, 192].forEach(xx => { g.moveTo(xx, 0); g.lineTo(xx, 128); }); g.stroke();
    g.beginPath(); g.ellipse(128, 64, 40, 64, 0, 0, 7); g.stroke(); g.beginPath(); g.ellipse(0, 64, 40, 64, 0, 0, 7); g.ellipse(256, 64, 40, 64, 0, 0, 7); g.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const steelM = new THREE.MeshStandardMaterial({ color: 0x3a3d48, metalness: 0.8, roughness: 0.35 });
  const SKIN = [0x5a3a26, 0x8d5a3c, 0xc68a62, 0x3e2618, 0xe0b090, 0x6b4430];
  const TEAMS = [[0xf2f2f2, 0xf2f2f2], [0x151a2a, 0x151a2a], [0xff4f8b, 0x2a1a3a], [0x27c6d8, 0x101820]];
  const capsule = (r, l, m) => new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 4, 10), m);
  const mkPlayer = (team, skin) => {
    const jm = new THREE.MeshStandardMaterial({ color: team[0], roughness: 0.7 }), sm = new THREE.MeshStandardMaterial({ color: team[1], roughness: 0.75 });
    const km = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.55 }), shoe = new THREE.MeshStandardMaterial({ color: Math.random() < 0.5 ? 0xf5f5f5 : 0x111111, roughness: 0.5 });
    const hair = new THREE.MeshStandardMaterial({ color: 0x0d0a08, roughness: 0.9 });
    const P = new THREE.Group(), hips = new THREE.Group(); hips.position.y = 0.95; P.add(hips);
    const torso = new THREE.Group(); hips.add(torso);
    const chest = capsule(0.16, 0.36, jm); chest.scale.set(1.25, 1, 0.72); chest.position.y = 0.33; torso.add(chest);
    const neck = capsule(0.05, 0.06, km); neck.position.y = 0.66; torso.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), km); head.scale.set(0.92, 1.08, 1); head.position.y = 0.8; torso.add(head);
    const hr = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), hair); hr.position.y = 0.815; hr.rotation.x = -0.25; torso.add(hr);
    const limb = (parent, px, py, r1, l1, r2, l2, m1, m2, end) => {
      const top = new THREE.Group(); top.position.set(px, py, 0); parent.add(top);
      const a = capsule(r1, l1, m1); a.position.y = -l1 / 2 - r1 * 0.5; top.add(a);
      const mid = new THREE.Group(); mid.position.y = -l1 - r1; top.add(mid);
      const b = capsule(r2, l2, m2); b.position.y = -l2 / 2 - r2 * 0.5; mid.add(b);
      if (end) { end.position.y += -l2 - r2; mid.add(end); }
      return [top, mid];
    };
    const [armL, elbL] = limb(torso, -0.25, 0.56, 0.048, 0.22, 0.042, 0.22, km, km, new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), km));
    const [armR, elbR] = limb(torso, 0.25, 0.56, 0.048, 0.22, 0.042, 0.22, km, km, new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), km));
    [armL, armR].forEach(a => { const sl = capsule(0.07, 0.06, jm); sl.position.y = -0.04; a.add(sl); });
    const mkShoe = () => { const s = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.08, 0.27, 2, 0.03), shoe); s.position.set(0, -0.02, 0.05); return s; };
    const [legL, kneeL] = limb(hips, -0.1, 0, 0.075, 0.34, 0.058, 0.36, km, km, mkShoe());
    const [legR, kneeR] = limb(hips, 0.1, 0, 0.075, 0.34, 0.058, 0.36, km, km, mkShoe());
    [legL, legR].forEach(l => { const sh = capsule(0.095, 0.2, sm); sh.position.y = -0.14; l.add(sh); });
    P.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return { P, hips, torso, armL, armR, elbL, elbR, legL, legR, kneeL, kneeR, phase: Math.random() * 6, vx: 0, vz: 0, tx: 0, tz: 0, sp: rnd(2.2, 4.2), jump: 0 };
  };
  const pose = (p, run, t) => { // course : jambes et bras opposés, genoux et coudes fléchis
    const s = Math.sin(p.phase), c = Math.cos(p.phase);
    p.legL.rotation.x = -s * 0.75 * run; p.legR.rotation.x = s * 0.75 * run;
    p.kneeL.rotation.x = (0.15 + Math.max(0, -c) * 1.3) * run + 0.1; p.kneeR.rotation.x = (0.15 + Math.max(0, c) * 1.3) * run + 0.1;
    p.armL.rotation.set(s * 0.6 * run, 0, -0.12); p.armR.rotation.set(-s * 0.6 * run, 0, 0.12);
    p.elbL.rotation.x = -0.4 - 0.7 * run; p.elbR.rotation.x = -0.4 - 0.7 * run;
    p.hips.position.y = 0.93 + Math.abs(s) * 0.05 * run - 0.04 * run; p.torso.rotation.x = 0.18 * run + 0.05;
  };
  const courts = [];
  const mkCourt = (sd, cz) => {
    const G = new THREE.Group();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(17, 16), new THREE.MeshStandardMaterial({ map: courtTex, roughness: 0.62, emissive: 0xffffff, emissiveMap: courtTex, emissiveIntensity: 0.12 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0.17; floor.receiveShadow = true; G.add(floor);
    // éclairage du terrain : mâts et flaques de lumière
    const flood = new THREE.MeshBasicMaterial({ map: radial('rgba(255,240,220,.6)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, color: new THREE.Color(0.55, 0.52, 0.48) });
    [[-8, -7.5], [8, -7.5], [-8, 7.5], [8, 7.5]].forEach(([px, pz]) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 9, 10), steelM); m.position.set(px, 4.5, pz); G.add(m);
      const lamp = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.4, 0.2, 2, 0.04), headM); lamp.position.set(px * 0.95, 9, pz * 0.95); lamp.lookAt(0, 0, 0); G.add(lamp);
      const ln = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.3), lensM); ln.position.copy(lamp.position).multiplyScalar(0.985); ln.lookAt(0, 0, 0); G.add(ln);
    });
    { const sp = new THREE.SpotLight(0xfff0e0, mob ? 30 : 45, 26, 0.85, 0.6, 1.2); sp.position.set(0, 11, 2); const tg = new THREE.Object3D(); tg.position.set(0, 0, -1); G.add(tg); sp.target = tg; G.add(sp); }
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(24, 22), flood); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.19; G.add(pool);
    // grillage
    const fm = new THREE.MeshStandardMaterial({ color: 0x8a8f9a, metalness: 0.7, roughness: 0.4, alphaMap: fenceT, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide });
    const fence = (w, px, pz, ry) => { const f = new THREE.Mesh(new THREE.PlaneGeometry(w, 3.4), fm.clone()); f.material.alphaMap = fenceT.clone(); f.material.alphaMap.needsUpdate = true; f.material.alphaMap.repeat.set(w * 9, 3.4 * 9); f.position.set(px, 1.87, pz); f.rotation.y = ry; G.add(f);
      for (let k = 0; k <= Math.round(w / 3); k++){ const p = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 3.5, 6), steelM); p.position.set(px + (ry ? 0 : -w / 2 + k * w / Math.round(w / 3)), 1.9, pz + (ry ? -w / 2 + k * w / Math.round(w / 3) : 0)); G.add(p); }
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, w, 6), steelM); rail.rotation.z = ry ? 0 : Math.PI / 2; rail.rotation.x = ry ? Math.PI / 2 : 0; rail.position.set(px, 3.57, pz); G.add(rail); };
    fence(17, 0, -8, 0); fence(16, -8.5, 0, Math.PI / 2); fence(16, 8.5, 0, Math.PI / 2);
    // panier : poteau, bras, planche en plexi, cercle, filet
    const hoopZ = -5.8;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.6, 0.2), steelM); post.position.set(0, 1.97, -7.6); G.add(post);
    const armH = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 1.7), steelM); armH.position.set(0, 3.55, -6.75); G.add(armH);
    const [bc, bg] = cvs(256, 150); bg.clearRect(0, 0, 256, 150); bg.strokeStyle = '#fff'; bg.lineWidth = 10; bg.strokeRect(5, 5, 246, 140); bg.lineWidth = 6; bg.strokeRect(92, 70, 72, 60);
    const boardM = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0, map: new THREE.CanvasTexture(bc), side: THREE.DoubleSide, depthWrite: false });
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.05, 0.03), boardM); board.position.set(0, 3.45, hoopZ); G.add(board);
    const rimM = new THREE.MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.4, metalness: 0.5 });
    const rimPos = new THREE.Vector3(0, 3.05, hoopZ + 0.375);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.225, 0.012, 8, 32), rimM); rim.rotation.x = Math.PI / 2; rim.position.copy(rimPos); G.add(rim);
    const net = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.15, 0.42, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xffffff, alphaMap: netT, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.9 }));
    net.position.set(rimPos.x, rimPos.y - 0.22, rimPos.z); G.add(net);
    // banc
    const bench = new THREE.Mesh(new RoundedBoxGeometry(2.4, 0.08, 0.4, 2, 0.02), new THREE.MeshStandardMaterial({ color: 0x9c6b3c, roughness: 0.8 })); bench.position.set(-7.6, 0.62, 3); bench.rotation.y = Math.PI / 2; G.add(bench);
    // joueurs (2 équipes) et ballon
    const tA = TEAMS[Math.random() * 2 | 0], tB = TEAMS[2 + (Math.random() * 2 | 0)];
    const players = [];
    for (let i = 0; i < (mob ? 4 : 6); i++){ const p = mkPlayer(i % 2 ? tA : tB, SKIN[Math.random() * SKIN.length | 0]); p.P.scale.setScalar(rnd(0.95, 1.07)); p.P.position.set(rnd(-5, 5), 0.17, rnd(-5, 4)); p.tx = p.P.position.x; p.tz = p.P.position.z; G.add(p.P); players.push(p); }
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 14), new THREE.MeshStandardMaterial({ map: ballT, roughness: 0.65 })); ball.castShadow = true; G.add(ball);
    G.position.set(sd * 19.5, 0, cz); G.rotation.y = -sd * Math.PI / 2; mover(G);
    const C = { G, players, ball, rimPos, h: 0, state: 'drib', st: 0, next: rnd(3, 6), from: new THREE.Vector3(), sd, cz };
    courts.push(C); return C;
  };
  const tmpV = new THREE.Vector3();
  const updCourt = (C, dt, t) => {
    if (Math.abs(C.G.position.z) > 170) return; // hors champ : pas d'animation
    const H = C.players[C.h];
    C.st += dt;
    C.players.forEach((p, i) => {
      if (p === H && C.state === 'shoot') return;
      // l'attaquant drible vers le panier, les autres se replacent / défendent
      if (Math.hypot(p.tx - p.P.position.x, p.tz - p.P.position.z) < 0.4 || Math.random() < 0.004){
        if (p === H) { p.tx = rnd(-5, 5); p.tz = rnd(-4, 4); }
        else if (C.state === 'loose' && i === C.h) { p.tx = C.ball.position.x; p.tz = C.ball.position.z; }
        else { const def = i % 2 !== C.h % 2; p.tx = def ? H.P.position.x * 0.8 + rnd(-1, 1) : rnd(-6, 6); p.tz = def ? (H.P.position.z - 5.8) * 0.7 + 5.8 * 0.3 - 1.2 + rnd(-1, 1) : rnd(-5, 5); }
      }
      if (C.state === 'loose' && p === H) { p.tx = C.ball.position.x; p.tz = C.ball.position.z; }
      const dx = p.tx - p.P.position.x, dz = p.tz - p.P.position.z, d = Math.hypot(dx, dz);
      const v = d > 0.3 ? Math.min(p.sp, d * 2) : 0;
      p.vx += ((d ? dx / d : 0) * v - p.vx) * Math.min(1, dt * 4); p.vz += ((d ? dz / d : 0) * v - p.vz) * Math.min(1, dt * 4);
      p.P.position.x += p.vx * dt; p.P.position.z += p.vz * dt;
      const spd = Math.hypot(p.vx, p.vz);
      if (spd > 0.2) { const a = Math.atan2(p.vx, p.vz); let da = a - p.P.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da)); p.P.rotation.y += da * Math.min(1, dt * 8); }
      p.phase += dt * (3 + spd * 2.4);
      pose(p, Math.min(1, spd / 3.5), t);
      p.P.position.y = 0.17;
    });
    if (C.state === 'drib'){
      // dribble main droite
      H.armR.rotation.x = -0.35; H.elbR.rotation.x = -0.5 - Math.abs(Math.sin(t * 7.5)) * 0.4;
      tmpV.set(0.3, 0, 0.35).applyAxisAngle(THREE.Object3D.DEFAULT_UP, H.P.rotation.y);
      C.ball.position.set(H.P.position.x + tmpV.x, 0.17 + 0.12 + Math.abs(Math.sin(t * 7.5)) * 0.78, H.P.position.z + tmpV.z);
      C.ball.rotation.x += dt * 8;
      if (C.st > C.next){ C.state = 'shoot'; C.st = 0; H.tx = H.P.position.x; H.tz = H.P.position.z; }
    } else if (C.state === 'shoot'){
      // arrêt, face au panier, saut et tir en extension
      const a = Math.atan2(C.rimPos.x - H.P.position.x, C.rimPos.z - H.P.position.z); H.P.rotation.y += (a - H.P.rotation.y) * Math.min(1, dt * 10);
      const s = C.st, up = Math.min(1, s / 0.35);
      H.armL.rotation.set(-2.7 * up, 0, -0.1); H.armR.rotation.set(-2.9 * up, 0, 0.1); H.elbL.rotation.x = -1.2 * (1 - Math.max(0, s - 0.45) * 3); H.elbR.rotation.x = H.elbL.rotation.x;
      H.legL.rotation.x = H.legR.rotation.x = -0.15; H.kneeL.rotation.x = H.kneeR.rotation.x = s < 0.2 ? 0.9 : 0.2;
      const j = s > 0.2 && s < 0.75 ? Math.sin((s - 0.2) / 0.55 * Math.PI) * 0.55 : 0; H.P.position.y = 0.17 + j;
      tmpV.set(0, 2.25 + j + up * 0.25, 0.12).applyAxisAngle(THREE.Object3D.DEFAULT_UP, H.P.rotation.y);
      if (s < 0.55) C.ball.position.set(H.P.position.x + tmpV.x, 0.17 + tmpV.y, H.P.position.z + tmpV.z), C.from.copy(C.ball.position);
      else { const f = Math.min(1, (s - 0.55) / 1.05), hh = 1.6 + C.from.distanceTo(C.rimPos) * 0.12; C.ball.position.lerpVectors(C.from, C.rimPos, f); C.ball.position.y += Math.sin(f * Math.PI) * hh; C.ball.rotation.x -= dt * 10;
        if (f >= 1){ C.state = 'drop'; C.st = 0; H.P.position.y = 0.17; } }
    } else if (C.state === 'drop'){
      const s = C.st; C.ball.position.x = C.rimPos.x; C.ball.position.z = C.rimPos.z + s * 0.6;
      const y0 = C.rimPos.y - 0.1; C.ball.position.y = s < 0.6 ? y0 - 4.9 * s * s * 2 : 0.29 + Math.abs(Math.sin((s - 0.6) * 7)) * 0.7 * Math.exp(-(s - 0.6) * 3);
      C.ball.position.y = Math.max(0.29, C.ball.position.y);
      if (s > 0.9){ C.state = 'loose'; C.st = 0; C.h = Math.random() * C.players.length | 0; }
    } else if (C.state === 'loose'){
      if (Math.hypot(H.P.position.x - C.ball.position.x, H.P.position.z - C.ball.position.z) < 0.6 || C.st > 4){ C.state = 'drib'; C.st = 0; C.next = rnd(3, 6); H.tx = rnd(-5, 5); H.tz = rnd(-4, 4); }
    }
  };
  const courtZ = [[-1, -PER * 0.28], [1, -PER * 0.74]];
  const nearCourt = (sd, z, r) => courtZ.some(([s2, z2]) => s2 === sd && Math.abs(((z - z2) % PER + PER * 1.5) % PER - PER / 2) < r);
  courtZ.forEach(([sd, z]) => mkCourt(sd, z));
  for (let i = 0; i < nP; i++) [-1, 1].forEach(sd => {
    const z = -i * span - (sd > 0 ? span / 2 : 0) + rnd(-3, 3); if (nearCourt(sd, z, 10)) return;
    const p = makePalm(7 + Math.random() * 4, sd * (0.8 + Math.random())); p.position.set(sd * rnd(11, 13), 0.15, z); p.rotation.y = Math.random() * 6; mover(p);
  });

  /* ---------- enseignes : peu nombreuses, formats variés ---------- */
  const glowText = (g, txt, x, y, font, col, blur) => { g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = col; g.shadowBlur = blur; g.lineWidth = 6; g.strokeStyle = col; g.strokeText(txt, x, y); g.shadowBlur = blur * 0.5; g.fillStyle = '#fff6fb'; g.fillText(txt, x, y); g.shadowBlur = 0; };
  // 1. drapeau vertical (HOTEL / MIAMI) : caisson sombre, liseré néon, lettres en tube
  const bladeSign = (txt, col, h) => {
    const g = new THREE.Group(), [c, x] = cvs(160, 640);
    x.fillStyle = '#0d1020'; x.fillRect(0, 0, 160, 640); x.strokeStyle = col; x.lineWidth = 6; x.shadowColor = col; x.shadowBlur = 16; x.strokeRect(14, 14, 132, 612); x.shadowBlur = 0;
    [...txt].forEach((ch, i) => glowText(x, ch, 80, 80 + i * (480 / Math.max(1, txt.length - 1)), 'bold 92px Michroma, Arial', col, 22));
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 1.6, roughness: 0.5 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.35, h, 1.6), [headM, headM, headM, headM, headM, headM]); g.add(box);
    [-1, 1].forEach(s => { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.5, h - 0.1), face); p.position.x = s * 0.18; p.rotation.y = s * Math.PI / 2; g.add(p); });
    [h * 0.35, -h * 0.35].forEach(y => { const br = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.0), steelM); br.position.set(0, y, -1.2); g.add(br); });
    return g;
  };
  // 2. marquise CASINO : ampoules qui défilent
  const casinoFrames = [0, 1].map(f => { const [c, x] = cvs(512, 128);
    const gr = x.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#3a0610'); gr.addColorStop(1, '#14020a'); x.fillStyle = gr; x.fillRect(0, 0, 512, 128);
    for (let k = 0; k < 40; k++){ const on = (k + f) % 2 === 0, px = k < 20 ? 14 + k * 25.3 : 14 + (k - 20) * 25.3, py = k < 20 ? 10 : 118;
      x.fillStyle = on ? '#fff2c0' : '#5a3a20'; x.shadowColor = '#ffcf60'; x.shadowBlur = on ? 12 : 0; x.beginPath(); x.arc(px, py, 5, 0, 7); x.fill(); }
    x.shadowBlur = 0; glowText(x, 'CASINO', 256, 66, 'bold 74px Georgia, serif', '#ffb52e', 24);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; });
  const casinoMats = [];
  const casinoSign = w => { const m = new THREE.MeshStandardMaterial({ map: casinoFrames[0], emissive: 0xffffff, emissiveMap: casinoFrames[0], emissiveIntensity: 1.5, roughness: 0.5 }); casinoMats.push(m);
    const g = new THREE.Group(); const box = new THREE.Mesh(new RoundedBoxGeometry(w, w / 4, 0.5, 2, 0.06), new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.9, roughness: 0.3 })); g.add(box);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.96, w / 4 * 0.9), m); f.position.z = 0.26; g.add(f); return g; };
  // 3. lettres « Miami » sur le toit, montées sur une structure en acier
  const rooftopSign = (w) => { const g = new THREE.Group(), [c, x] = cvs(1024, 320); x.clearRect(0, 0, 1024, 320);
    glowText(x, 'Miami', 512, 170, 'italic bold 230px Georgia, serif', '#ff4fa8', 40);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.31), new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false, color: new THREE.Color(1.8, 1.6, 1.8), depthWrite: false, side: THREE.DoubleSide })); p.position.y = w * 0.17 + 0.6; g.add(p);
    for (let k = 0; k <= 6; k++){ const v = new THREE.Mesh(new THREE.BoxGeometry(0.08, w * 0.3 + 0.6, 0.08), steelM); v.position.set(-w / 2 + k * w / 6, (w * 0.3 + 0.6) / 2, -0.3); g.add(v); }
    [0.3, w * 0.3 + 0.5].forEach(y => { const hb = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, 0.07), steelM); hb.position.set(0, y, -0.3); g.add(hb); });
    return g; };
  // façades réalistes : mur-rideau (meneaux fins, nez de dalle) et bandes de bureaux allumés, sans damier coloré
  const mkWin = (cols, rows, lit, warm, mull, bg = '#000') => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 512; const g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, 256, 512);
    const cw = 256 / cols, rh = 512 / rows;
    for (let r = 0; r < rows; r++){
      // un étage : des plages continues éclairées (bureaux), le reste presque noir
      let k = 0; while (k < cols){ const run = 1 + (Math.random() * cols * 0.6 | 0), on = Math.random() < lit, v = on ? rnd(0.35, 0.6) : rnd(0.015, 0.04);
        g.fillStyle = on ? `rgba(${warm[0]},${warm[1]},${warm[2]},${v})` : `rgba(70,80,120,${v})`; g.fillRect(k * cw, r * rh + rh * 0.18, Math.min(run, cols - k) * cw, rh * 0.7); k += run; }
      g.fillStyle = 'rgba(0,0,0,.85)'; g.fillRect(0, r * rh, 256, rh * 0.16); // nez de dalle
    }
    g.fillStyle = 'rgba(0,0,0,.6)'; for (let k = 0; k <= cols; k++) g.fillRect(k * cw - mull / 2, 0, mull, 512); // meneaux
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = MAXA; return t;
  };
  const winGlass = [mkWin(6, 5, 0.22, [255, 222, 180], 3), mkWin(5, 5, 0.18, [235, 238, 255], 3), mkWin(6, 5, 0.3, [255, 210, 165], 4)];
  const winDeco = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
    g.fillStyle = '#3a3a3a'; g.fillRect(0, 0, 256, 256);
    for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++){ const on = Math.random() < 0.45, x = k * 64 + 14, y = r * 85 + 22;
      g.fillStyle = '#0a0a0a'; g.fillRect(x - 3, y - 3, 42, 50); // encadrement
      g.fillStyle = on ? `rgba(255,${200 + Math.random() * 30 | 0},150,${0.7 + Math.random() * 0.3})` : '#141820'; g.fillRect(x, y, 36, 44);
      g.fillStyle = '#0a0a0a'; g.fillRect(x + 17, y, 2, 44); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const neonOf = c => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
  const NEON = [new THREE.Color(3, 0.45, 1.7), new THREE.Color(0.4, 2.6, 3), new THREE.Color(2.4, 1, 3.2), new THREE.Color(3, 1.5, 0.5), new THREE.Color(0.6, 3, 1.6)];
  const PASTEL = [0xf2b8cf, 0xa8e6d6, 0xc9b6f2, 0xf6d6a8, 0xa6d8f2, 0xf5f0e6];
  const signTex = (txt, col) => { const c = document.createElement('canvas'); c.width = 128; c.height = 512; const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 128, 512); g.font = 'bold 72px Michroma, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = col; g.shadowBlur = 18; g.fillStyle = '#fff'; [...txt].forEach((ch, i) => g.fillText(ch, 64, 50 + i * (420 / Math.max(1, txt.length - 1))));
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const NAMES = ['HOTEL'];
  const roundRect = (w, d, r) => { const sh = new THREE.Shape(), x = -w / 2, y = -d / 2;
    sh.moveTo(x + r, y); sh.lineTo(x + w - r, y); sh.quadraticCurveTo(x + w, y, x + w, y + r); sh.lineTo(x + w, y + d - r); sh.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
    sh.lineTo(x + r, y + d); sh.quadraticCurveTo(x, y + d, x, y + d - r); sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y); return sh; };
  const extr = (sh, h) => { const g = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: 10 }); g.rotateX(-Math.PI / 2); return g; };
  const outline = (sh, y, m, sc = 1.0) => { const pts = sh.getPoints(40).map(p => new THREE.Vector3(p.x * sc, y, -p.y * sc)); const c = new THREE.CatmullRomCurve3(pts, true);
    return new THREE.Mesh(new THREE.TubeGeometry(c, 120, 0.06, 5, true), m); };

  // 1. tour de verre (Brickell) : façade courbe, lignes LED, couronne lumineuse
  const glassTower = () => {
    const g = new THREE.Group(), w = rnd(9, 14), d = rnd(8, 12), h = rnd(48, 85), r = rnd(1.5, Math.min(w, d) / 2.2);
    const sh = roundRect(w, d, r), tex = winGlass[Math.random() * 3 | 0].clone(); tex.needsUpdate = true; tex.repeat.set(1 / 8, 1 / 16); tex.offset.set(Math.random(), Math.random());
    const m = new THREE.MeshStandardMaterial({ color: 0x1b2340, metalness: 0.9, roughness: 0.18, envMapIntensity: 1.3, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.7 });
    g.add(new THREE.Mesh(extr(sh, h), m));
    const nc = NEON[Math.random() * 5 | 0], nm = neonOf(nc);
    g.add(outline(sh, h, nm)); // liseré lumineux discret au sommet
    if (Math.random() < 0.6){ const sh2 = roundRect(w * 0.7, d * 0.7, r * 0.7), h2 = rnd(6, 14); const top = new THREE.Mesh(extr(sh2, h2), m); top.position.y = h; g.add(top); g.add(outline(sh2, h + h2, nm)); }
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.15, 8, 6), new THREE.MeshStandardMaterial({ color: 0x222 })); ant.position.y = h + 4; g.add(ant);
    const blink = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), neonOf(new THREE.Color(4, 0.2, 0.2))); blink.position.y = h + 8; blink.userData.blink = 1; g.add(blink); blinkers.push(blink);
    return g;
  };
  // 2. résidence à balcons : dalles en porte-à-faux, garde-corps vitrés
  const balconyTower = () => {
    const g = new THREE.Group(), w = rnd(14, 20), d = rnd(8, 11), fl = 3.2, n = 8 + (Math.random() * 10 | 0), h = n * fl;
    const tex = winGlass[2].clone(); tex.needsUpdate = true; tex.repeat.set(w / 8, h / 16);
    const core = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: 0x232038, roughness: 0.35, metalness: 0.5, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.9 }));
    core.position.y = h / 2; g.add(core);
    const slabM = new THREE.MeshStandardMaterial({ color: 0xe8e2f0, roughness: 0.6 }), railM = new THREE.MeshStandardMaterial({ color: 0x8fb4d8, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.2 });
    const slabG = new RoundedBoxGeometry(w + 2.4, 0.22, d + 2.4, 2, 0.1), railG = new THREE.BoxGeometry(w + 2.3, 0.9, d + 2.3);
    for (let k = 1; k < n; k++){ const sl = new THREE.Mesh(slabG, slabM); sl.position.y = k * fl; g.add(sl); if (k % 2 === 0){ const rl = new THREE.Mesh(railG, railM); rl.position.y = k * fl + 0.55; g.add(rl); } }
    const nm = neonOf(NEON[Math.random() * 5 | 0]); const crown = new THREE.Mesh(new THREE.BoxGeometry(w + 2.5, 0.05, d + 2.5), nm); crown.position.y = h + 0.1; g.add(crown);
    if (Math.random() < 0.3){ const rs = rooftopSign(Math.min(w, 16)); rs.position.set(0, h + 0.2, d / 2 - 1); g.add(rs); }
    return g;
  };
  // 3. hôtel Art déco (Ocean Drive) : pastel, casquettes horizontales, tour-enseigne néon
  const decoHotel = () => {
    const g = new THREE.Group(), w = rnd(16, 24), d = rnd(9, 12), fl = 3.4, n = 3 + (Math.random() * 3 | 0), h = n * fl;
    const pastel = PASTEL[Math.random() * 6 | 0], nc = NEON[Math.random() * 5 | 0], nm = neonOf(nc);
    // façade : mur pastel éclairé en contre-plongée, fenêtres encadrées (certaines allumées)
    const cols = Math.max(4, Math.round(w / 3.2)), [fc, fx] = cvs(cols * 48, n * 64), pc = new THREE.Color(pastel);
    const wallCss = `rgb(${pc.r * 70 | 0},${pc.g * 70 | 0},${pc.b * 70 | 0})`;
    fx.fillStyle = wallCss; fx.fillRect(0, 0, cols * 48, n * 64);
    const gr = fx.createLinearGradient(0, n * 64, 0, 0); gr.addColorStop(0, 'rgba(255,220,240,.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); fx.fillStyle = gr; fx.fillRect(0, 0, cols * 48, n * 64);
    for (let r = 0; r < n; r++) for (let k = 0; k < cols; k++){ const on = Math.random() < 0.4, x0 = k * 48 + 12, y0 = r * 64 + 16;
      fx.fillStyle = '#060508'; fx.fillRect(x0 - 2, y0 - 2, 28, 38);
      fx.fillStyle = on ? `rgba(255,${190 + Math.random() * 40 | 0},140,${0.75 + Math.random() * 0.25})` : '#0c0e16'; fx.fillRect(x0, y0, 24, 34);
      if (on && Math.random() < 0.5){ fx.fillStyle = 'rgba(0,0,0,.4)'; fx.fillRect(x0, y0, 24 * rnd(0.2, 0.6), 34); } }
    const tex = new THREE.CanvasTexture(fc); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1 / w, 1 / (n * fl)); tex.offset.set(0.5, 0);
    const wallM = new THREE.MeshStandardMaterial({ color: pastel, roughness: 0.8, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1 });
    const sh = roundRect(w, d, 2.2); g.add(new THREE.Mesh(extr(sh, h), wallM));
    const trimM = new THREE.MeshStandardMaterial({ color: 0xfaf6f0, roughness: 0.6 });
    for (let k = 1; k <= n; k++){ const ey = new THREE.Mesh(extr(roundRect(w + 1, d + 1, 2.6), 0.18), trimM); ey.position.y = k * fl - 0.5; g.add(ey); if (k === n || k === 1) g.add(outline(roundRect(w + 1, d + 1, 2.6), k * fl - 0.42, nm)); }
    // parapet à gradins
    const par = new THREE.Mesh(new THREE.BoxGeometry(w * 0.4, 2.2, d * 0.6), wallM); par.position.y = h + 1.1; g.add(par);
    const par2 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.22, 1.4, d * 0.4), wallM); par2.position.y = h + 2.9; g.add(par2);
    // enseigne (pas sur tous les hôtels)
    const r = Math.random();
    if (r < 0.3){ const b = bladeSign(Math.random() < 0.6 ? 'HOTEL' : 'MIAMI', '#' + nc.clone().multiplyScalar(0.33).getHexString(), Math.min(h + 2, 13)); b.position.set(rnd(-w * 0.3, w * 0.3), Math.min(h + 2, 13) / 2 + 3.4, d / 2 + 1.25); g.add(b); }
    else if (r < 0.45){ const cs = casinoSign(Math.min(7, w * 0.4)); cs.position.set(0, 4.6, d / 2 + 0.6); g.add(cs); }
    // auvent et néon au rez-de-chaussée
    const awn = new THREE.Mesh(new RoundedBoxGeometry(w * 0.6, 0.18, 2.2, 2, 0.06), trimM); awn.position.set(0, 3, d / 2 + 1.1); g.add(awn);
    return g;
  };
  const blinkers = [];
  const nB = mob ? 7 : 12, bSpan = PER / nB;
  for (let i = 0; i < nB; i++) [-1, 1].forEach(sd => {
    const z0 = -i * bSpan - Math.random() * bSpan * 0.4;
    if (Math.random() < 0.75 && !nearCourt(sd, z0, 18)){ const h1 = decoHotel(); h1.position.set(sd * rnd(25, 29), 0, z0); h1.rotation.y = -sd * Math.PI / 2 + rnd(-0.06, 0.06); mover(h1); }
    const t = Math.random() < 0.55 ? glassTower() : balconyTower(); t.position.set(sd * rnd(46, 60), 0, z0 - bSpan * 0.5); t.rotation.y = -sd * Math.PI / 2 + rnd(-0.3, 0.3); mover(t);
  });
  // skyline lointaine à l'horizon
  const skyM = new THREE.MeshBasicMaterial({ color: 0x1a0b2e, fog: false });
  const skyNeon = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.7, 2), toneMapped: false, fog: false });
  for (let k = 0; k < (mob ? 18 : 30); k++){
    const sd = k % 2 ? 1 : -1, x = sd * (40 + Math.random() * 160), w = 6 + Math.random() * 10, h = 10 + Math.random() * 40;
    const b = new THREE.Mesh(new THREE.PlaneGeometry(w, h), skyM); b.position.set(x, h / 2 - 1, -395 - Math.random() * 25); scene.add(b);
    const l = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.5), skyNeon); l.position.set(x, h - 1, b.position.z + 0.1); scene.add(l);
  }

  /* ---------- environnement (reflets sur la carrosserie) ---------- */
  const envScene = new THREE.Scene();
  envScene.add(sky.clone());
  const strip = (w, h, col, p, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); m.position.copy(p); m.rotation.y = ry || 0; envScene.add(m); };
  strip(120, 50, new THREE.Color(0.5, 0.25, 0.22), new THREE.Vector3(0, 26, -200));
  strip(400, 5, new THREE.Color(0.9, 0.22, 0.75), new THREE.Vector3(0, 3, -150));
  strip(60, 200, new THREE.Color(0.18, 0.7, 0.9), new THREE.Vector3(-160, 40, 0), Math.PI / 2);
  strip(60, 200, new THREE.Color(0.9, 0.18, 0.65), new THREE.Vector3(160, 40, 0), -Math.PI / 2);
  for (let k = 0; k < 40; k++){ const sd = k % 2 ? 1 : -1; strip(rnd(2, 6), rnd(1, 3), new THREE.Color().setHSL(rnd(0.05, 0.12), 0.6, rnd(0.4, 0.8)).multiplyScalar(1.2), new THREE.Vector3(sd * 60, rnd(2, 40), rnd(-120, 120)), sd * Math.PI / 2); }
  strip(300, 300, new THREE.Color(0.12, 0.05, 0.28), new THREE.Vector3(0, 150, 0));
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;

  /* ---------- lumières ---------- */
  scene.add(new THREE.HemisphereLight(0x7a5cff, 0x140520, 0.55));
  const car = new THREE.Group(); scene.add(car);
  // soleil couchant bas, devant : ombre longue de la voiture vers la caméra
  const sunL = new THREE.DirectionalLight(0xffb08a, 0.7); sunL.position.set(-12, 7, -6); sunL.target = car; scene.add(sunL);
  sunL.castShadow = true; sunL.shadow.mapSize.set(mob ? 1024 : 2048, mob ? 1024 : 2048);
  Object.assign(sunL.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 40 }); sunL.shadow.bias = -0.0004; sunL.shadow.normalBias = 0.02; sunL.shadow.radius = 4;
  // lumière des lampadaires qui balaie la carrosserie au passage
  const sweep = [0, 1].map(() => { const l = new THREE.PointLight(0xffd8b0, 0, 16, 1.8); scene.add(l); return l; });
  const updSweep = () => { const near = lamps.filter(g => g.position.z > -26 && g.position.z < 10).sort((a, b) => Math.abs(a.position.z + 4) - Math.abs(b.position.z + 4));
    sweep.forEach((l, i) => { const g = near[i]; if (!g){ l.intensity = 0; return; } l.position.set(g.position.x - g.userData.sd * 2.6, 8.1, g.position.z); const d = g.position.z;
      l.intensity = 38 * sstep0(-26, -12, d) * (1 - sstep0(2, 10, d)); }); };
  const sstep0 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const pinkL = new THREE.PointLight(0xff3fbf, 3.5, 18, 1.6); pinkL.position.set(6, 2.5, 0.5); scene.add(pinkL);
  const cyanL = new THREE.PointLight(0x3ff2ff, 3.2, 18, 1.6); cyanL.position.set(-6, 2.3, 1); scene.add(cyanL);

  /* ---------- voiture de sport (coupé fastback) ---------- */
  const paint = new THREE.MeshPhysicalMaterial({ color: 0x5c1690, metalness: 0.6, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.22, envMapIntensity: 0.8 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x07060b, metalness: 0.3, roughness: 0.24, envMapIntensity: 0.6 });
  const black = new THREE.MeshStandardMaterial({ color: 0x08070b, roughness: 0.5, metalness: 0.3 });
  const satin = new THREE.MeshStandardMaterial({ color: 0x141318, roughness: 0.35, metalness: 0.6 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xe6e3ee, metalness: 1, roughness: 0.12, envMapIntensity: 1.4 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0e0e10, roughness: 0.88 });
  const tailM = new THREE.MeshStandardMaterial({ color: 0x2a0006, emissive: 0xff1030, emissiveIntensity: 1.9, roughness: 0.3 });
  const tailCore = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.3, 0.22, 0.36), toneMapped: false });
  const L = 4.5;
  const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const lerpK = (keys, u) => { for (let k = 1; k < keys.length; k++) if (u <= keys[k][0]){ const [u0, v0] = keys[k - 1], [u1, v1] = keys[k]; return v0 + (v1 - v0) * sstep(0, 1, (u - u0) / (u1 - u0)); } return keys[keys.length - 1][1]; };
  const zOf = u => -L / 2 + u * L;
  const fixN = g => { const n = g.attributes.normal; for (let i = 0; i < n.count; i++){ const a = n.getX(i), b = n.getY(i), c = n.getZ(i); if (!(a * a + b * b + c * c > 0.5)) n.setXYZ(i, 0, 1, 0); } n.needsUpdate = true; };
  const loft = (nS, nR, f) => { // sections en super-ellipse le long de z, extrémités fermées
    const pos = [], idx = [];
    for (let i = 0; i <= nS; i++){ const u = i / nS, st = f(u);
      for (let j = 0; j < nR; j++){ const th = j / nR * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th);
        let xx = Math.sign(c) * Math.pow(Math.abs(c), 2 / st.n); const yr = 0.5 + 0.5 * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / st.n);
        xx *= st.hw * (1 - st.tumble * sstep(st.tb || 0.6, 1, yr));
        pos.push(xx, st.yb + (st.yt - st.yb) * yr, st.z); } }
    for (let i = 0; i < nS; i++) for (let j = 0; j < nR; j++){ const a = i * nR + j, b = i * nR + (j + 1) % nR, c2 = a + nR, d = b + nR; idx.push(a, b, c2, b, d, c2); }
    [0, nS].forEach((i, e) => { const cI = pos.length / 3; let cx = 0, cy = 0, cz = 0; for (let j = 0; j < nR; j++){ cx += pos[(i * nR + j) * 3]; cy += pos[(i * nR + j) * 3 + 1]; cz += pos[(i * nR + j) * 3 + 2]; }
      pos.push(cx / nR, cy / nR, cz / nR + (e ? 0.015 : -0.03)); for (let j = 0; j < nR; j++){ const a = i * nR + j, b = i * nR + (j + 1) % nR; e ? idx.push(a, b, cI) : idx.push(b, a, cI); } });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); fixN(g); return g;
  };
  const zF = -1.38, zR = 1.32, uF = (zF + L / 2) / L, uR = (zR + L / 2) / L, WR = 0.34;
  const hwK = [[0, 0.66], [0.04, 0.84], [0.12, 0.92], [0.22, 0.93], [0.4, 0.9], [0.55, 0.9], [0.72, 0.95], [0.85, 0.96], [0.96, 0.93], [1, 0.9]];
  const ytK = [[0, 0.55], [0.05, 0.72], [0.15, 0.83], [0.22, 0.85], [0.3, 0.84], [0.38, 0.86], [0.6, 0.88], [0.75, 0.92], [0.86, 0.93], [0.95, 0.9], [1, 0.86]];
  const arch = u => { let y = 0.2; [uF, uR].forEach(w => { const dz = (u - w) * L, R = 0.43; if (Math.abs(dz) < R) y = Math.max(y, WR + Math.sqrt(R * R - dz * dz)); }); return y; };
  const bodyAt = u => ({ z: zOf(u), hw: lerpK(hwK, u), yt: lerpK(ytK, u), yb: Math.min(arch(u), lerpK(ytK, u) - 0.09), n: 3.6, tumble: 0.15 });
  const body = new THREE.Mesh(loft(mob ? 110 : 180, mob ? 40 : 60, bodyAt), paint); body.castShadow = true; car.add(body);
  // fond plat sous la caisse (masque l'intérieur des passages de roue)
  { const fl = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 3.6), black); fl.position.set(0, 0.22, 0); car.add(fl); }
  // habitacle : pare-brise, toit, lunette fastback (vitres sombres, toit et montants peints)
  const U0 = 0.35, U1 = 0.9, UofV = v => U0 + v * (U1 - U0);
  const cTop = [[0, 0.86], [0.04, 0.93], [0.3, 1.23], [0.42, 1.26], [0.55, 1.24], [0.75, 1.08], [1, 0.95]];
  const cabAt = v => { const U = UofV(v); return { z: zOf(U), hw: lerpK(hwK, U) * 0.86, yt: lerpK(cTop, v), yb: lerpK(ytK, U) - 0.07, n: 2.6, tumble: 0.42, tb: 0.25 }; };
  const cabG = loft(70, 48, cabAt);
  { const p = cabG.attributes.position, ix = cabG.index.array, gA = [], gB = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < ix.length; i += 3){ a.fromBufferAttribute(p, ix[i]); b.fromBufferAttribute(p, ix[i + 1]); c.fromBufferAttribute(p, ix[i + 2]);
      const n = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize(), v = ((a.z + b.z + c.z) / 3 + L / 2) / L, vv = (v - U0) / (U1 - U0);
      const roof = n.y > 0.86 && vv > 0.28 && vv < 0.62, cpil = vv > 0.6 && Math.abs(n.x) > 0.3, apil = vv < 0.32 && Math.abs(n.x) > 0.3 && Math.abs(n.x) < 0.75 && n.z < -0.2;
      ((roof || cpil || apil) ? gB : gA).push(ix[i], ix[i + 1], ix[i + 2]); }
    cabG.setIndex([...gA, ...gB]); cabG.clearGroups(); cabG.addGroup(0, gA.length, 0); cabG.addGroup(gA.length, gB.length, 1); }
  const cab = new THREE.Mesh(cabG, [glass, paint]); cab.castShadow = true; car.add(cab);
  const add = (g, m, px, py, pz) => { const o = new THREE.Mesh(g, m); o.position.set(px, py, pz); car.add(o); return o; };
  // arrière : bandeau de feux pleine largeur, troisième feu stop, becquet discret
  add(new RoundedBoxGeometry(1.84, 0.13, 0.03, 2, 0.012), satin, 0, 0.74, L / 2 + 0.006);
  add(new RoundedBoxGeometry(1.74, 0.05, 0.03, 2, 0.012), tailM, 0, 0.745, L / 2 + 0.02);
  add(new THREE.BoxGeometry(1.66, 0.01, 0.01), tailCore, 0, 0.748, L / 2 + 0.037);
  [-1, 1].forEach(sd => { add(new RoundedBoxGeometry(0.22, 0.09, 0.03, 2, 0.012), tailM, sd * 0.74, 0.735, L / 2 + 0.03);
    const wrap = add(new RoundedBoxGeometry(0.03, 0.06, 0.28, 2, 0.01), tailM, sd * 0.875, 0.74, L / 2 - 0.12); wrap.rotation.y = sd * 0.12;
    add(new RoundedBoxGeometry(0.12, 0.04, 0.02, 2, 0.01), new THREE.MeshStandardMaterial({ color: 0x777777, emissive: 0xffffff, emissiveIntensity: 0.25 }), sd * 0.62, 0.62, L / 2 + 0.01); });
  { const v = 0.93, z = zOf(UofV(v)); add(new RoundedBoxGeometry(0.42, 0.02, 0.04, 2, 0.008), tailM, 0, lerpK(cTop, v) + 0.012, z); }
  { const lip = add(new RoundedBoxGeometry(1.5, 0.03, 0.16, 2, 0.012), paint, 0, 0.885, L / 2 - 0.06); lip.rotation.x = 0.22; }
  // les feux arrière ne se reflètent pas sur la route (calque 1, invisible pour le miroir) : plus de barre rouge au sol
  car.children.forEach(o => { if (o.material === tailM || o.material === tailCore) o.layers.set(1); });
  camera.layers.enable(1);
  // plaque
  const [pc, pp] = cvs(256, 72); pp.fillStyle = '#f4f1f8'; pp.fillRect(0, 0, 256, 72); pp.fillStyle = '#1b2a8a'; pp.fillRect(0, 0, 22, 72);
  pp.fillStyle = '#16101f'; pp.font = 'bold 40px Arial'; pp.textAlign = 'center'; pp.textBaseline = 'middle'; pp.fillText('T.COCCO', 140, 38);
  const pT = new THREE.CanvasTexture(pc); pT.colorSpace = THREE.SRGBColorSpace;
  add(new RoundedBoxGeometry(0.58, 0.17, 0.02, 2, 0.01), black, 0, 0.5, L / 2 + 0.005);
  add(new THREE.PlaneGeometry(0.52, 0.13), new THREE.MeshStandardMaterial({ map: pT, roughness: 0.4 }), 0, 0.5, L / 2 + 0.018);
  // jupe arrière, diffuseur et double sortie d'échappement
  add(new RoundedBoxGeometry(1.7, 0.2, 0.14, 2, 0.04), satin, 0, 0.3, L / 2 - 0.04);
  for (let k = -2; k <= 2; k++) add(new THREE.BoxGeometry(0.015, 0.12, 0.34), black, k * 0.12, 0.22, L / 2 - 0.12);
  const exG = new THREE.CylinderGeometry(0.07, 0.07, 0.16, 28, 1, true); exG.rotateX(Math.PI / 2); exG.scale(1.4, 1, 1);
  const exL = add(exG, chrome, -0.48, 0.28, L / 2 + 0.03), exR = add(exG, chrome, 0.48, 0.28, L / 2 + 0.03);
  [exL, exR].forEach(ex => { const inner = add(new THREE.CircleGeometry(0.062, 24), new THREE.MeshBasicMaterial({ color: 0x040306 }), ex.position.x, ex.position.y, L / 2 + 0.05); inner.scale.x = 1.4; });
  // rétroviseurs, bas de caisse, ouïes d'aération, phares
  [-1, 1].forEach(sd => {
    const u = 0.38, x0 = lerpK(hwK, u) * 0.9;
    const m = add(new THREE.SphereGeometry(0.1, 24, 14), paint, sd * (x0 + 0.08), lerpK(ytK, u) + 0.12, zOf(u)); m.scale.set(1.05, 0.55, 1.5);
    add(new THREE.BoxGeometry(0.12, 0.025, 0.05), black, sd * (x0 + 0.01), lerpK(ytK, u) + 0.08, zOf(u) + 0.04);
    add(new RoundedBoxGeometry(0.06, 0.08, 2.0, 2, 0.02), satin, sd * 0.86, 0.24, zOf(0.49));
    const vent = add(new RoundedBoxGeometry(0.03, 0.12, 0.36, 2, 0.01), black, sd * (lerpK(hwK, 0.3) * 0.99), 0.62, zOf(0.3)); vent.rotation.y = sd * 0.05;
    add(new RoundedBoxGeometry(0.3, 0.05, 0.08, 2, 0.02), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.5, 2.8), toneMapped: false }), sd * 0.58, 0.66, zOf(0.025));
  });
  // roues : pneus taille basse, jantes multibranches, disques et étriers
  const wheels = [];
  const tireProfile = w => [[0.25, -w / 2], [0.3, -w / 2], [0.33, -w / 2 + 0.015], [0.34, -w / 2 + 0.05], [0.34, w / 2 - 0.05], [0.33, w / 2 - 0.015], [0.3, w / 2], [0.25, w / 2]].map(([r, y]) => new THREE.Vector2(r, y));
  const rimM = new THREE.MeshStandardMaterial({ color: 0x2c2c33, metalness: 0.9, roughness: 0.28, envMapIntensity: 1.2 });
  const discM = new THREE.MeshStandardMaterial({ color: 0x6a6870, metalness: 0.9, roughness: 0.4 });
  const caliM = new THREE.MeshStandardMaterial({ color: 0xd8203c, roughness: 0.35, metalness: 0.2 });
  const wellG = new THREE.CylinderGeometry(0.44, 0.44, 0.34, 28, 1, true, -Math.PI / 2, Math.PI); wellG.rotateZ(Math.PI / 2);
  [[zF, 0.24], [zR, 0.29]].forEach(([wz, tw]) => [-1, 1].forEach(sd => {
    const u = (wz + L / 2) / L, wx = sd * (lerpK(hwK, u) - 0.1 - tw / 2 + 0.06);
    const g = new THREE.Group(); g.position.set(wx, WR, wz); car.add(g);
    const spin = new THREE.Group(); g.add(spin);
    const tg = new THREE.LatheGeometry(tireProfile(tw), 48); tg.rotateZ(Math.PI / 2); const tire = new THREE.Mesh(tg, rubber); tire.castShadow = true; spin.add(tire);
    const barrel = new THREE.CylinderGeometry(0.25, 0.25, tw - 0.02, 40, 1, true); barrel.rotateZ(Math.PI / 2); spin.add(new THREE.Mesh(barrel, rimM));
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.248, 0.009, 6, 48), chrome); lip.rotation.y = Math.PI / 2; lip.position.x = sd * (tw / 2 - 0.01); spin.add(lip);
    for (let k = 0; k < 10; k++){ const a = k / 10 * Math.PI * 2 + (k % 2) * 0.12; const sp = new THREE.Mesh(new RoundedBoxGeometry(0.02, 0.19, 0.035, 1, 0.008), rimM);
      sp.position.set(sd * (tw / 2 - 0.035), Math.cos(a) * 0.145, Math.sin(a) * 0.145); sp.rotation.x = -a; sp.rotation.z = sd * 0.12; spin.add(sp); }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.05, 20).rotateZ(Math.PI / 2), chrome); hub.position.x = sd * (tw / 2 - 0.03); spin.add(hub);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.025, 36).rotateZ(Math.PI / 2), discM); disc.position.x = sd * 0.0; g.add(disc);
    const cal = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.15, 0.11, 2, 0.02), caliM); cal.position.set(sd * 0.04, 0.12, -0.1); g.add(cal);
    const well = new THREE.Mesh(wellG, black); well.position.set(wx * 0.96, WR, wz); car.add(well);
    wheels.push(spin);
  }));
  // ombre de contact douce
  const shadow = add(new THREE.PlaneGeometry(2.4, 5.2), new THREE.MeshBasicMaterial({ map: radial('rgba(0,0,0,.75)'), transparent: true, depthWrite: false }), 0, 0.02, 0);
  shadow.rotation.x = -Math.PI / 2;

  /* ---------- flammes d'échappement : particules (cœur bleu → jaune → orange → rouge) ---------- */
  const FN = mob ? 320 : 700, fPos = new Float32Array(FN * 3), fDat = new Float32Array(FN * 4), fVel = new Float32Array(FN * 3), fAge = new Float32Array(FN), fLife = new Float32Array(FN), fSz = new Float32Array(FN);
  const fGeo = new THREE.BufferGeometry(); fGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3)); fGeo.setAttribute('data', new THREE.BufferAttribute(fDat, 4));
  const fMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { px: { value: 400 } },
    vertexShader: `attribute vec4 data; uniform float px; varying vec4 vD;
      void main(){ vD = data; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = data.w > .01 ? data.y * px / -mv.z : 0.; }`,
    fragmentShader: `varying vec4 vD;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main(){ vec2 p = gl_PointCoord - .5; float r = vD.x, s = vD.z;
        float n = n2(p * 5. + s * 31. + r * 4.) * .6 + n2(p * 11. - s * 13. + r * 7.) * .4;
        float d = length(p * vec2(1., 1.15)) + (n - .5) * (.25 + r * .35);
        float a = smoothstep(.5, .08, d);
        vec3 c = mix(vec3(1.3, 1.7, 3.4), vec3(3.4, 2.7, 1.4), smoothstep(.0, .16, r));
        c = mix(c, vec3(3.2, 1.15, .25), smoothstep(.16, .42, r));
        c = mix(c, vec3(1.1, .16, .04), smoothstep(.42, .8, r));
        float al = a * pow(1. - r, 1.4) * (.75 + n * .5) * vD.w * .6;
        gl_FragColor = vec4(c * al, al); }` });
  const flamePts = new THREE.Points(fGeo, fMat); flamePts.frustumCulled = false; car.add(flamePts); flamePts.layers.set(1);
  let fHead = 0;
  const emit = (ex, power) => { const i = fHead; fHead = (fHead + 1) % FN;
    fPos[i * 3] = ex.position.x + rnd(-0.03, 0.03); fPos[i * 3 + 1] = ex.position.y + rnd(-0.02, 0.02); fPos[i * 3 + 2] = L / 2 + 0.1;
    const sp = power > 0.5 ? rnd(11, 17) : rnd(2.2, 4.5);
    fVel[i * 3] = rnd(-0.6, 0.6) * (0.4 + power); fVel[i * 3 + 1] = rnd(-0.2, 0.5); fVel[i * 3 + 2] = sp;
    fAge[i] = 0; fLife[i] = power > 0.5 ? rnd(0.06, 0.13) : rnd(0.05, 0.12); fSz[i] = power > 0.5 ? rnd(0.06, 0.12) : rnd(0.07, 0.13);
    fDat[i * 4 + 2] = Math.random(); fDat[i * 4 + 3] = power > 0.5 ? 1 : power > 0.1 ? 0.7 : 0.4; };
  const jetM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
    uniforms: { t: { value: 0 }, p: { value: 0 } },
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `uniform float t, p; varying vec2 vU;
      float h(vec2 q){ return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 q){ vec2 i = floor(q), f = fract(q); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 q){ float v = 0., a = .5; for (int i = 0; i < 4; i++){ v += a * n2(q); q = q * 2.03 + 1.7; a *= .5; } return v; }
      void main(){
        float s = vU.y, x = (vU.x - .5) * 2.;
        float turb = fbm(vec2(vU.x * 3., s * 5. - t * 14.)) , turb2 = fbm(vec2(vU.x * 7. + 3., s * 11. - t * 26.));
        float w = (.28 + .72 * smoothstep(0., .25, s)) * pow(1. - s, .7) * (.75 + turb * .5);
        float body = smoothstep(w, w * .2, abs(x + (turb2 - .5) * .35 * s));
        float core = smoothstep(.3 * (1. - s), 0., abs(x)) * smoothstep(.5, 0., s);
        float lick = smoothstep(.35, .75, turb2 + (1. - s) * .4);
        vec3 c = mix(vec3(.5, .9, 2.6), vec3(2.6, 1.9, .8), smoothstep(.04, .3, s));
        c = mix(c, vec3(2.4, .75, .18), smoothstep(.3, .7, s)); c = mix(c, vec3(.9, .12, .04), smoothstep(.7, 1., s));
        c += vec3(1.6, 1.8, 2.2) * core * p;
        float al = body * lick * smoothstep(0., .04, s) * (1. - smoothstep(.75, 1., s)) * (.35 + .65 * p);
        gl_FragColor = vec4(c * al, al); }` });
  const jets = [exL, exR].map(ex => { const g = new THREE.Group(); g.position.set(ex.position.x, ex.position.y, L / 2 + 0.06);
    for (let k = 0; k < 3; k++){ const pg2 = new THREE.PlaneGeometry(0.22, 1, 1, 1); pg2.translate(0, 0.5, 0); pg2.rotateX(Math.PI / 2); pg2.rotateZ(k * Math.PI / 3); g.add(new THREE.Mesh(pg2, jetM)); }
    g.traverse(o => o.layers.set(1)); car.add(g); return g; });
  const exhausts = [exL, exR], nitroLights = exhausts.map(ex => { const l = new THREE.PointLight(0xff8a3a, 0, 7, 2); l.position.set(ex.position.x, 0.35, L / 2 + 0.6); car.add(l); return l; });
  let emitAcc = 0, popT = 0;
  const updFlames = (dt, nitro) => {
    // émission : faible et irrégulière au ralenti (pétarades), jet continu en nitro
    let rate = 26; popT -= dt; if (!nitro && popT <= 0 && Math.random() < dt * 1.2){ popT = 0.12; } if (popT > 0) rate = 260;
    if (nitro) rate = 520 * nitro;
    emitAcc += rate * dt; while (emitAcc >= 1){ emitAcc -= 1; exhausts.forEach(ex => emit(ex, nitro ? 1 : popT > 0 ? 0.3 : 0)); }
    for (let i = 0; i < FN; i++){ if (fDat[i * 4 + 3] < 0.01) continue; fAge[i] += dt; const r = fAge[i] / fLife[i]; if (r >= 1){ fDat[i * 4 + 3] = 0; continue; }
      const k = Math.exp(-dt * 1.4); fVel[i * 3] *= k; fVel[i * 3 + 2] *= k; fVel[i * 3 + 1] += dt * 2.2;
      fPos[i * 3] += fVel[i * 3] * dt; fPos[i * 3 + 1] += fVel[i * 3 + 1] * dt; fPos[i * 3 + 2] += fVel[i * 3 + 2] * dt;
      fDat[i * 4] = r; fDat[i * 4 + 1] = fSz[i] * (1 + r * 1.8); }
    fGeo.attributes.position.needsUpdate = true; fGeo.attributes.data.needsUpdate = true;
    jetM.uniforms.t.value += dt; const pw = nitro ? 1 : popT > 0 ? 0.45 : 0.12;
    jetM.uniforms.p.value += (pw - jetM.uniforms.p.value) * Math.min(1, dt * 18);
    const jl = nitro ? 1.25 + Math.random() * 0.35 : popT > 0 ? 0.55 + Math.random() * 0.2 : 0.16 + Math.random() * 0.08;
    jets.forEach(j => { j.scale.z += (jl - j.scale.z) * Math.min(1, dt * 25); const wd = nitro ? 1.25 : 0.8; j.scale.x = j.scale.y = wd * (0.92 + Math.random() * 0.16); });
    const glow = nitro ? 3 + Math.random() * 2 : popT > 0 ? 1.1 : 0.1 + Math.random() * 0.08; nitroLights.forEach(l => l.intensity = glow);
  };

  // traînées de vitesse (lignes étirées selon la vitesse)
  const N = mob ? 160 : 320, pg = new THREE.BufferGeometry(), pos = new Float32Array(N * 6), seeds = new Float32Array(N * 3);
  for (let i = 0; i < N; i++){ let xx = (Math.random() - .5) * 40; if (Math.abs(xx) < 2.5) xx += Math.sign(xx || 1) * 2.5; seeds[i * 3] = xx; seeds[i * 3 + 1] = Math.random() * 9 + 0.15; seeds[i * 3 + 2] = -Math.random() * 220; }
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pM = new THREE.LineBasicMaterial({ color: new THREE.Color(1.5, 1.3, 1.9), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  scene.add(new THREE.LineSegments(pg, pM));

  /* ---------- post-traitement (anticrénelage MSAA, bloom, passe cinéma) ---------- */
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.45, 0.95);
  composer.addPass(bloom);
  const film = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, k: { value: 0 }, t: { value: 0 }, flash: { value: 0 }, ar: { value: 1 }, px: { value: new THREE.Vector2(1 / 1920, 1 / 1080) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float k, t, flash, ar; uniform vec2 px; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec2 c = vec2(.5, .56), d = vUv - c; float len = length(d * vec2(ar, 1.));
        float amt = k * .085 * smoothstep(.08, .65, len);
        vec3 col;
        if (k < .001){
          // image au repos : netteté renforcée (masque flou léger), sans aberration
          vec3 c0 = texture2D(tDiffuse, vUv).rgb;
          vec3 nb = texture2D(tDiffuse, vUv + vec2(px.x, 0.)).rgb + texture2D(tDiffuse, vUv - vec2(px.x, 0.)).rgb + texture2D(tDiffuse, vUv + vec2(0., px.y)).rgb + texture2D(tDiffuse, vUv - vec2(0., px.y)).rgb;
          col = max(c0 + (c0 - nb * .25) * .55, 0.);
        } else {
          col = vec3(0.);
          for (int i = 0; i < 12; i++){ float s = 1. - amt * float(i) / 11.; vec2 uv = c + d * s; float ca = k * .006 * len;
            col.r += texture2D(tDiffuse, uv + d * ca).r; col.g += texture2D(tDiffuse, uv).g; col.b += texture2D(tDiffuse, uv - d * ca).b; }
          col /= 12.;
        }
        float lum = dot(col, vec3(.2126, .7152, .0722)); col = mix(vec3(lum), col, 1.1);
        col *= mix(1., smoothstep(1.2, .3, len), .45 + k * .25);
        col += vec3(1., .75, .5) * flash;
        col += (h(vUv * 900. + t) - .5) * .01;
        gl_FragColor = vec4(col, 1.); }` });
  composer.addPass(film); composer.addPass(new OutputPass());

  const resize = () => { const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 64 : 48; camera.updateProjectionMatrix(); film.uniforms.ar.value = w / h; film.uniforms.px.value.set(1 / (w * PR), 1 / (h * PR)); bloom.resolution.set(w / (mob ? 3 : 2), h / (mob ? 3 : 2)); };
  resize(); addEventListener('resize', resize);

  /* ---------- qualité adaptative : si l'appareil peine, on allège le rendu ---------- */
  let fAcc = 0, fN = 0, tier = 0;
  const adapt = dt => { if (tier >= 2 || go || window.__i3dNoAdapt) return; fAcc += dt; fN++; if (fN < 45) return; const avg = fAcc / fN; fAcc = 0; fN = 0;
    if (avg > 1 / 30){ tier++; PR = Math.max(1, PR * 0.8); renderer.setPixelRatio(PR); composer.setPixelRatio(PR); resize();
      if (tier === 2){ sunL.castShadow = false; } } };

  /* ---------- animation ---------- */
  const BASE = 18;
  let speed = BASE, go = 0, t0 = 0, running = true, last = performance.now(), gridOff = 0, casF = 0, casT = 0;
  const clock = () => { const n = performance.now(); const d = Math.min(0.05, (n - last) / 1000); last = n; return d; };
  const sunOff = new THREE.Vector3(-12, 7, -6);
  const loop = () => {
    if (!running) return;
    const dt = clock(), t = performance.now() / 1000;
    let nitro = 0;
    if (go){ const e = t - t0, k = Math.min(1, e / 1.6);
      speed = BASE + 460 * k * k; nitro = Math.min(1, e * 6);
      car.rotation.x = -Math.min(0.04, e * 0.3) * Math.max(0, 1 - Math.max(0, e - 0.5) * 2);
      car.position.z = -e * 1.4 - Math.pow(Math.max(0, e - 0.75), 2.2) * 95;
      film.uniforms.flash.value = Math.max(0, 0.16 - e * 0.7);
      film.uniforms.k.value = Math.min(1, Math.max(0, e - 0.15) * 1.4);
      camera.fov += ((innerWidth / innerHeight < 0.8 ? 84 : 72) - camera.fov) * 0.07; camera.updateProjectionMatrix();
      const sh = 0.015 + 0.07 * k;
      camera.position.x = camBase.x + (Math.random() - .5) * sh; camera.position.y = camBase.y + (Math.random() - .5) * sh;
      camera.position.z = camBase.z + Math.min(0.6, e * 1.2);
      bloom.strength = 0.45 + k * 0.5; pM.opacity = Math.min(0.32, k * 1.2);
      renderer.toneMappingExposure = 0.85 + k * 0.12;
    } else { car.position.y = Math.sin(t * 9) * 0.006; }
    updFlames(dt, window.__i3dNitroTest || nitro);
    fMat.uniforms.px.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    sunL.position.copy(car.position).add(sunOff);
    film.uniforms.t.value = t % 100; sun.material.uniforms.t.value = t;
    blinkers.forEach((b, i) => b.visible = Math.sin(t * 3 + i) > 0.3);
    casT += dt; if (casT > 0.22){ casT = 0; casF ^= 1; casinoMats.forEach(m => { m.map = m.emissiveMap = casinoFrames[casF]; }); }
    const dz = window.__i3dFreeze ? 0 : speed * dt;
    roadT.offset.y = roughT.offset.y = ((roadT.offset.y - dz / 30) % 1 + 1) % 1;
    sideT.offset.y = ((sideT.offset.y - dz / 20) % 1 + 1) % 1;
    gridOff = (gridOff + dz) % 6; grid.material.uniforms.off.value = gridOff;
    wheels.forEach(w => w.rotation.x -= dz / WR);
    movers.forEach(o => { o.position.z += dz; if (o.position.z > 14) o.position.z -= PER; });
    courts.forEach(C => updCourt(C, dt, t)); updSweep();
    { const pa = pg.attributes.position.array, tl = Math.min(18, 0.4 + speed * 0.035);
      for (let i = 0; i < N; i++){ seeds[i * 3 + 2] += dz * 1.4; if (seeds[i * 3 + 2] > 8) seeds[i * 3 + 2] = -220;
        const o = i * 6; pa[o] = pa[o + 3] = seeds[i * 3]; pa[o + 1] = pa[o + 4] = seeds[i * 3 + 1]; pa[o + 2] = seeds[i * 3 + 2]; pa[o + 5] = seeds[i * 3 + 2] - tl; }
      pg.attributes.position.needsUpdate = true; }
    if (window.__i3dLook) camera.lookAt(window.__i3dLook.x, window.__i3dLook.y, window.__i3dLook.z); else camera.lookAt(0, 1.05, -40);
    adapt(dt);
    composer.render();
    if (!host.classList.contains('has3d')){ host.classList.add('has3d'); host.classList.remove('nofx'); }
    requestAnimationFrame(loop);
  };
  loop();

  window.__i3dDebug = { camera, bloom, car, camBase, film, courts, sunL, sweep, pinkL, cyanL };
  const sndBtn = document.getElementById('isnd');
  const sndLabel = on => { if (!sndBtn) return; sndBtn.classList.toggle('off', !on); sndBtn.querySelector('span').textContent = on ? 'Couper le son' : 'Activer le son'; sndBtn.title = on ? 'Couper le son' : 'Activer le son'; };
  const audio = makeAudio(on => sndLabel(on));
  if (sndBtn){ if (!audio) sndBtn.remove(); else { sndBtn.hidden = false; sndLabel(audio.on);
    sndBtn.addEventListener('click', e => { e.stopPropagation(); audio.toggle(); });
    // son coupé à l'arrivée : tout démarre (moteur, route, et plus tard la musique) au moment où l'on clique sur le bouton
  } }
  window.__intro3d = {
    nitro(){ if (go) return; go = 1; t0 = performance.now() / 1000; audio && audio.nitro(); },
    sound: audio,
    stop(){ running = false; audio && audio.stop(); setTimeout(() => { renderer.dispose(); pmrem.dispose(); canvas.remove(); }, 900); }
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden && running) { last = performance.now(); } });
}
