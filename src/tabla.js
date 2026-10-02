/* keerat.fyi — playable 3D tabla
   Drag to turn. Tap a drum head to play. Lighting follows the page sky. */
import {
  Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, Vector2, Vector3, Color,
  LatheGeometry, CylinderGeometry, TorusGeometry, TubeGeometry, CatmullRomCurve3,
  MeshStandardMaterial, HemisphereLight, DirectionalLight, PointLight, Raycaster,
  CanvasTexture, RepeatWrapping, SRGBColorSpace, PMREMGenerator, ACESFilmicToneMapping,
  CircleGeometry, MeshBasicMaterial, AdditiveBlending, MathUtils,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const lerp = MathUtils.lerp;

function woodTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#6a3520'; g.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 140; i++) {
    const x = Math.random() * 256, w = 0.5 + Math.random() * 2.5;
    g.strokeStyle = `rgba(${30 + Math.random() * 40},${12 + Math.random() * 14},6,${0.15 + Math.random() * 0.3})`;
    g.lineWidth = w; g.beginPath(); g.moveTo(x, 0);
    for (let y = 0; y <= 512; y += 32) g.lineTo(x + Math.sin(y / 60 + i) * 4, y);
    g.stroke();
  }
  const t = new CanvasTexture(c); t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(3, 1);
  t.colorSpace = SRGBColorSpace; return t;
}

function skinTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 20, 128, 128, 128);
  grd.addColorStop(0, '#efe3c8'); grd.addColorStop(1, '#d9c39b');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2500; i++) {
    g.fillStyle = `rgba(120,90,50,${Math.random() * 0.06})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5);
  }
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}

/* A drum: lathe body + head + syahi + rim + straps */
function buildDrum({ profile, straps, strapColor, bodyMat, syahiR, syahiOffset, withGatte }) {
  const drum = new Group();
  const pts = profile.map(([r, y]) => new Vector2(r, y));
  const body = new Mesh(new LatheGeometry(pts, 72), bodyMat);
  drum.add(body);

  const [topR, topY] = profile[profile.length - 1];
  const skinMat = new MeshStandardMaterial({ map: skinTexture(), roughness: 0.85 });
  const head = new Mesh(new CylinderGeometry(topR, topR, 0.012, 72), skinMat);
  head.position.y = topY + 0.004; drum.add(head);

  const syahi = new Mesh(new CylinderGeometry(syahiR, syahiR * 1.02, 0.008, 64),
    new MeshStandardMaterial({ color: 0x141214, roughness: 0.45, metalness: 0.05 }));
  syahi.position.set(0, topY + 0.012, syahiOffset); drum.add(syahi);

  const leather = new MeshStandardMaterial({ color: strapColor, roughness: 0.7 });
  const gajra = new Mesh(new TorusGeometry(topR + 0.004, 0.026, 12, 72), leather);
  gajra.rotation.x = Math.PI / 2; gajra.position.y = topY; drum.add(gajra);
  const base = new Mesh(new TorusGeometry(profile[1][0] + 0.01, 0.022, 10, 60), leather);
  base.rotation.x = Math.PI / 2; base.position.y = 0.03; drum.add(base);

  // straps follow the body surface
  const radiusAt = (y) => {
    for (let i = 1; i < profile.length; i++) {
      const [r1, y1] = profile[i - 1], [r2, y2] = profile[i];
      if (y >= y1 && y <= y2) return lerp(r1, r2, (y - y1) / (y2 - y1 || 1));
    }
    return topR;
  };
  for (let i = 0; i < straps; i++) {
    const a = (i / straps) * Math.PI * 2;
    const p = [];
    for (let s = 0; s <= 10; s++) {
      const y = lerp(0.04, topY - 0.01, s / 10);
      const r = radiusAt(y) + 0.012;
      p.push(new Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
    }
    drum.add(new Mesh(new TubeGeometry(new CatmullRomCurve3(p), 24, 0.0075, 5), leather));
    if (withGatte && i % 2 === 0) {
      const y = 0.3, r = radiusAt(y) + 0.02, a2 = a + Math.PI / straps;
      const g = new Mesh(new CylinderGeometry(0.024, 0.028, 0.12, 14), bodyMat);
      g.position.set(Math.cos(a2) * r, y, Math.sin(a2) * r);
      g.rotation.z = Math.cos(a2) * -0.03; g.rotation.x = Math.sin(a2) * 0.03;
      drum.add(g);
    }
  }

  // glow ring shown on hit
  const glow = new Mesh(new CircleGeometry(topR * 1.25, 64),
    new MeshBasicMaterial({ color: 0xffc98a, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = topY + 0.02; drum.add(glow);

  drum.userData = { head, syahi, glow, topR, topY, syahiOffset, syahiR };
  return drum;
}

function cushion(color, r) {
  const m = new Mesh(new TorusGeometry(r, 0.085, 18, 48),
    new MeshStandardMaterial({ color, roughness: 0.95 }));
  m.rotation.x = Math.PI / 2; m.position.y = -0.02; m.scale.z = 0.8;
  return m;
}

export function mountTabla(container, { onBol, reducedMotion } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'tabla-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  container.appendChild(canvas);

  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new Scene();
  const pm = new PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;

  const camera = new PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 2.25, 3.1); camera.lookAt(0, 0.45, 0);

  const hemi = new HemisphereLight(0xffd9b0, 0x1a1636, 0.9);
  const sun = new DirectionalLight(0xffb27a, 2.4); sun.position.set(-2.5, 3, 2);
  const rim = new PointLight(0x9fb4ff, 6, 8); rim.position.set(2, 1.6, -2);
  scene.add(hemi, sun, rim);

  const woodMat = new MeshStandardMaterial({ map: woodTexture(), roughness: 0.5, metalness: 0.05 });
  const brassMat = new MeshStandardMaterial({ color: 0xb8743f, roughness: 0.3, metalness: 0.9 });

  const dayan = buildDrum({
    profile: [[0, 0], [0.34, 0], [0.39, 0.05], [0.42, 0.25], [0.42, 0.47], [0.4, 0.66], [0.36, 0.86], [0.335, 0.96], [0.325, 1.0]],
    straps: 16, strapColor: 0x3a2214, bodyMat: woodMat, syahiR: 0.13, syahiOffset: 0, withGatte: true,
  });
  const bayan = buildDrum({
    profile: [[0, 0], [0.22, 0], [0.38, 0.07], [0.51, 0.22], [0.56, 0.4], [0.54, 0.56], [0.49, 0.67], [0.465, 0.72]],
    straps: 12, strapColor: 0x2c1a12, bodyMat: brassMat, syahiR: 0.16, syahiOffset: 0.12, withGatte: false,
  });
  dayan.position.set(0.56, 0.02, 0.05); dayan.rotation.set(-0.12, 0, -0.06);
  bayan.position.set(-0.6, 0.02, 0);
  const cushD = cushion(0x2b2a5a, 0.34); cushD.position.set(0.56, -0.04, 0.05);
  const cushB = cushion(0x5a2236, 0.44); cushB.position.set(-0.6, -0.04, 0);

  const rig = new Group(); rig.add(dayan, bayan, cushD, cushB);
  rig.rotation.x = 0.08;
  scene.add(rig);

  /* ---------- sizing ---------- */
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const a = w / h, dist = a >= 1.2 ? 3.6 : 3.6 * Math.pow(1.2 / a, 0.95); // fit the pair on narrow screens
    camera.position.z = dist; camera.position.y = dist * 0.7;
    camera.lookAt(0, 0.4, 0);
    camera.updateProjectionMatrix();
    needs = true;
  }
  new ResizeObserver(resize).observe(container);

  /* ---------- sky sync ---------- */
  const warm = new Color(0xffb27a), moon = new Color(0xa9bcff);
  const hemiWarm = new Color(0xffd9b0), hemiNight = new Color(0x6f7bb8);
  function setSky(t) {
    sun.color.copy(warm).lerp(moon, t);
    sun.intensity = lerp(2.6, 1.3, t);
    hemi.color.copy(hemiWarm).lerp(hemiNight, t);
    hemi.intensity = lerp(0.95, 0.55, t);
    rim.intensity = lerp(4, 9, t);
    sun.position.set(lerp(-2.5, 1.8, t), lerp(2.2, 3.4, t), 2);
    needs = true;
  }

  /* ---------- interaction ---------- */
  let rotY = -0.25, rotX = 0.08, velY = 0, dragging = false, moved = 0;
  let lastX = 0, lastY = 0, startX = 0, startY = 0, idle = 0;
  const ray = new Raycaster(), ndc = new Vector2();
  const targets = [dayan.userData.head, dayan.userData.syahi, bayan.userData.head, bayan.userData.syahi];
  const hits = []; // active hit animations

  function bolFor(drum, worldPoint) {
    const local = drum.worldToLocal(worldPoint.clone());
    const { topR, syahiOffset, syahiR } = drum.userData;
    const fromSyahi = Math.hypot(local.x, local.z - syahiOffset);
    const fromCenter = Math.hypot(local.x, local.z);
    if (drum === dayan) {
      if (fromSyahi < syahiR) return 'Tun';
      if (fromCenter > topR * 0.78) return 'Na';
      return 'Tin';
    }
    return fromSyahi < syahiR ? 'Ke' : 'Ge';
  }

  function hitDrum(drum) { hits.push({ drum, t: 0 }); needs = true; }

  function tap(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(targets, false)[0];
    if (!hit) return false;
    const drum = hit.object.parent;
    const bol = bolFor(drum, hit.point);
    hitDrum(drum);
    window.ksAudio && window.ksAudio.play(bol);
    onBol && onBol(bol, drum === dayan ? 'dayan' : 'bayan', clientX, clientY);
    return true;
  }

  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; moved = 0; lastX = startX = e.clientX; lastY = startY = e.clientY; velY = 0;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) {
      // hover cursor
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      canvas.style.cursor = ray.intersectObjects(targets, false).length ? 'pointer' : 'grab';
      return;
    }
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    moved += Math.abs(dx) + Math.abs(dy);
    rotY += dx * 0.008; velY = dx * 0.008;
    if (e.pointerType === 'mouse') rotX = MathUtils.clamp(rotX + dy * 0.004, -0.15, 0.6);
    lastX = e.clientX; lastY = e.clientY; idle = 0; needs = true;
    canvas.style.cursor = 'grabbing';
  });
  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    if (moved < 8) tap(e.clientX, e.clientY);
    canvas.style.cursor = 'grab';
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', () => { dragging = false; });

  /* ---------- render loop (only while visible) ---------- */
  let visible = false, needs = true, raf = 0, last = performance.now();
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    let animating = false;
    if (!dragging) {
      if (Math.abs(velY) > 0.0004 && !reducedMotion) { rotY += velY; velY *= 0.93; animating = true; }
      idle += dt;
      if (!reducedMotion && idle > 2.5) { rotY += dt * 0.12; animating = true; }
    }
    rig.rotation.y = rotY; rig.rotation.x = rotX;
    for (let i = hits.length - 1; i >= 0; i--) {
      const h = hits[i]; h.t += dt;
      const k = Math.max(0, 1 - h.t / 0.6);
      const { head, syahi, glow } = h.drum.userData;
      const dip = Math.sin(Math.min(1, h.t / 0.12) * Math.PI) * k * 0.012;
      head.position.y = h.drum.userData.topY + 0.004 - dip;
      syahi.position.y = h.drum.userData.topY + 0.012 - dip;
      glow.material.opacity = k * 0.55;
      if (k <= 0) hits.splice(i, 1); else animating = true;
    }
    renderer.render(scene, camera);
    needs = false;
    if (visible && (animating || dragging || needs)) raf = requestAnimationFrame(frame);
  }
  function kick() { if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  const origNeeds = () => kick();
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) { idle = 3; kick(); } }, { threshold: 0.05 })
    .observe(container);
  canvas.addEventListener('pointerdown', origNeeds);
  canvas.addEventListener('pointermove', origNeeds);

  resize();
  return {
    setSky(t) { setSky(t); kick(); },
    strike(bol) {
      const drumOf = { Na: dayan, Tin: dayan, Tun: dayan, Ge: bayan, Ke: bayan };
      const parts = { Dha: ['Na', 'Ge'], Dhin: ['Tin', 'Ge'], Ta: ['Na'] }[bol] || [bol];
      new Set(parts.map((p) => drumOf[p])).forEach((d) => d && hitDrum(d));
      onBol && onBol(bol, null);
      kick();
    },
    play(bol) { window.ksAudio && window.ksAudio.play(bol); this.strike(bol); },
  };
}
