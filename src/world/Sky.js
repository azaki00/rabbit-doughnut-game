import * as THREE from 'three';
import { loadModel, flattenToGeometry } from './Loaders.js';

// SKY, CLOUDS AND WEATHER.
//
// Two jobs, in one file because they are the same job: everything above the
// treeline, and the storm that arrives with the Sovereign.
//
// ── the storm ──
// The whole thing is driven by one number, `storm`, easing 0 → 1 when the boss
// is summoned and back down when it dies. Every visual hangs off it:
//
//   sky dome    pale blue      → bruised red at the horizon, near-black above
//   fog         distant, soft  → close and choking
//   clouds      white, high    → dark, low, fast, and there are more of them
//   sun         warm and bright→ dim, cold and blue-shifted
//   ambient     bright         → dark, with the ground light going red
//   rain        nothing        → 1800 streaks falling around you
//   lightning   nothing        → strikes, on a timer that tightens with rage
//
// Nothing about it is a post-process. It is all real scene state, which means
// the rabbits, the meat on the ground and your own hands all sit in it.

const CLOUD_URL = 'OBJECTS/clouds/cloud.obj';

export const SKY = {
  // ── clouds ──
  cloudCount: 46,
  cloudSpanXZ: 460,      // the layer is much wider than the map, so it has edges you never reach
  cloudYClear: 78,
  cloudYStorm: 46,       // the ceiling comes down on you
  cloudWidth: 34,        // metres across for a scale-1 cloud
  driftClear: 0.55,      // m/s
  driftStorm: 4.2,

  // ── rain ──
  drops: 1800,
  rainBox: 46,           // the volume that follows the camera
  rainTop: 26,
  fallSpeed: 34,
  slant: 5.5,            // horizontal drift, so it is not a vertical curtain

  // ── timing ──
  onset: 5.0,            // seconds for the storm to fully arrive
  clearing: 9.0,         // and rather longer for it to leave

  // ── lightning ──
  strikeMin: 3.5,
  strikeMax: 11.0,
};

// clear → storm, for everything that is just a colour
const PALETTE = {
  skyTop:    [0xbfe0f0, 0x14101c],
  skyMid:    [0xd8ecf6, 0x3a1622],
  skyLow:    [0xe8f4fa, 0x8a2a24],   // the red sits at the horizon, not overhead
  fog:       [0xc8e4f2, 0x30161c],
  cloud:     [0xfdfbf6, 0x241d2a],
  sunColor:  [0xfff0d0, 0x8fa0c8],
  hemiSky:   [0xdff0ff, 0x2a2038],
  hemiGround:[0x6f7a4a, 0x50281f],
};

// The evening. A SECOND axis, independent of the storm: the storm is the
// Sovereign's weather and can happen at any hour, so the two are applied in
// series rather than blended into one palette. Storm first (it decides the
// mood), then dusk on top (it decides the hour).
const DUSK = {
  skyTop:  0x0d1424,
  skyMid:  0x243a52,
  skyLow:  0xd98a4e,   // the last of the sun sits on the horizon
  fog:     0x1e2836,
  cloud:   0x53566a,
  sun:     0xffb46a,
  hemiSky: 0x1a2436,
  hemiGround: 0x2a2a24,
};
const _d = new THREE.Color();

const _c1 = new THREE.Color();
const _c2 = new THREE.Color();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

function mix(pair, t, out) {
  _c1.setHex(pair[0]);
  _c2.setHex(pair[1]);
  return out.copy(_c1).lerp(_c2, t);
}

export class Sky {
  constructor(engine, sfx) {
    this.engine = engine;
    this.scene = engine.scene;
    this.sfx = sfx;

    this.storm = 0;        // 0..1, what everything reads
    this.target = 0;
    this.t = 0;
    this.strikeIn = 6;
    this.flash = 0;
    this.rage = 0;         // boss rage, tightens the lightning

    // remember the clear-weather lighting so we can lerp away from it and back
    this.sun = engine.sun;
    this.hemi = this.scene.children.find(o => o.isHemisphereLight);
    this.dusk = 0;
    this.sunBase = this.sun?.intensity ?? 1.9;
    this.hemiBase = this.hemi?.intensity ?? 1.05;
    this.fogNear = this.scene.fog.near;
    this.fogFar = this.scene.fog.far;

    this._buildDome();
    this._buildRain();
    this.clouds = null;
    this._loadClouds();
  }

  // ── the sky dome ──
  // An inverted sphere with a three-stop vertical gradient. A flat
  // scene.background cannot put red at the horizon and black overhead at the
  // same time, and that split is the whole look of the storm.
  _buildDome() {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: new THREE.Color(PALETTE.skyTop[0]) },
        uMid: { value: new THREE.Color(PALETTE.skyMid[0]) },
        uLow: { value: new THREE.Color(PALETTE.skyLow[0]) },
        uFlash: { value: 0 },
      },
      vertexShader: `
        varying float vH;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vH = normalize(wp.xyz - cameraPosition).y;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `
        uniform vec3 uTop, uMid, uLow;
        uniform float uFlash;
        varying float vH;
        void main() {
          float h = clamp(vH, -1.0, 1.0);
          // low band hugs the horizon; mid fills the middle; top is overhead
          vec3 c = mix(uLow, uMid, smoothstep(-0.02, 0.22, h));
          c = mix(c, uTop, smoothstep(0.18, 0.72, h));
          // lightning washes the whole dome, brightest low down
          c += uFlash * (0.55 + 0.45 * (1.0 - clamp(h, 0.0, 1.0)));
          gl_FragColor = vec4(c, 1.0);
        }`,
    });

    this.dome = new THREE.Mesh(new THREE.SphereGeometry(500, 24, 16), mat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -1000;
    this.scene.add(this.dome);
    this.domeMat = mat;

    // the dome IS the background now
    this.scene.background = null;
  }

  // ── clouds ──
  async _loadClouds() {
    const model = await loadModel(CLOUD_URL, { mtl: true, color: 0xffffff, roughness: 0.95 });
    let geo = model ? flattenToGeometry(model) : null;
    if (!geo) {
      console.warn('[sky] cloud model unavailable, using blobs');
      geo = new THREE.IcosahedronGeometry(1, 1);
    }
    geo.computeBoundingBox();
    const size = new THREE.Vector3();
    geo.boundingBox.getSize(size);
    const norm = SKY.cloudWidth / Math.max(0.001, size.x);

    const mat = new THREE.MeshStandardMaterial({
      color: PALETTE.cloud[0],
      roughness: 1,
      metalness: 0,
      flatShading: true,
      // Clouds must not take the scene fog, or the far ones dissolve into the
      // horizon colour and the layer stops reading as a ceiling.
      fog: false,
      vertexColors: !!model,
    });

    const mesh = new THREE.InstancedMesh(geo, mat, SKY.cloudCount);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    this.scene.add(mesh);

    mesh.userData.noChatBlock = true;   // clouds are not obstructions
    this.clouds = mesh;
    this.cloudMat = mat;
    this.cloudData = [];
    for (let i = 0; i < SKY.cloudCount; i++) {
      this.cloudData.push({
        x: (Math.random() - 0.5) * SKY.cloudSpanXZ,
        z: (Math.random() - 0.5) * SKY.cloudSpanXZ,
        yOff: (Math.random() - 0.5) * 26,
        scale: norm * (0.6 + Math.random() * 1.5),
        yaw: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 0.8,
        squash: 0.55 + Math.random() * 0.5,
      });
    }
    this._writeClouds();
  }

  _writeClouds() {
    if (!this.clouds) return;
    const y = THREE.MathUtils.lerp(SKY.cloudYClear, SKY.cloudYStorm, this.storm);
    for (let i = 0; i < this.cloudData.length; i++) {
      const c = this.cloudData[i];
      _p.set(c.x, y + c.yOff, c.z);
      _q.setFromAxisAngle(_up, c.yaw);
      // they flatten and spread as the storm builds
      _s.set(
        c.scale * (1 + this.storm * 0.5),
        c.scale * c.squash * (1 - this.storm * 0.25),
        c.scale * (1 + this.storm * 0.5),
      );
      this.clouds.setMatrixAt(i, _m.compose(_p, _q, _s));
    }
    this.clouds.instanceMatrix.needsUpdate = true;
  }

  // ── rain ──
  // Instanced streaks in a box that follows the camera. Nothing is simulated:
  // each drop falls, and wraps to the top of the box when it leaves the bottom,
  // which is indistinguishable from rain and costs one matrix write per drop.
  _buildRain() {
    const geo = new THREE.BoxGeometry(0.022, 0.62, 0.022);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xcfd8e8,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    });

    const mesh = new THREE.InstancedMesh(geo, mat, SKY.drops);
    mesh.frustumCulled = false;
    mesh.visible = false;
    mesh.renderOrder = 5;
    this.scene.add(mesh);

    this.rain = mesh;
    this.rainMat = mat;
    this.drops = [];
    for (let i = 0; i < SKY.drops; i++) {
      this.drops.push({
        x: (Math.random() - 0.5) * SKY.rainBox,
        y: Math.random() * SKY.rainTop,
        z: (Math.random() - 0.5) * SKY.rainBox,
        len: 0.7 + Math.random() * 1.5,
        speed: 0.85 + Math.random() * 0.4,
      });
    }
  }

  // ── control ──
  // `on` is simply whether the Sovereign is out. Everything else is easing.
  // 0 = noon, 1 = full dark. Set once a frame from the DayCycle.
  setDusk(v) { this.dusk = THREE.MathUtils.clamp(v, 0, 1); }

  setStorm(on, rage = 0) {
    this.target = on ? 1 : 0;
    this.rage = rage;
  }

  strike() {
    this.flash = 1;
    this.sfx?.thunder?.(this.storm);
  }

  update(dt, camera) {
    // ── ease toward the target ──
    const rate = 1 / (this.target > this.storm ? SKY.onset : SKY.clearing);
    this.storm += Math.sign(this.target - this.storm) * rate * dt;
    this.storm = THREE.MathUtils.clamp(this.storm, 0, 1);
    this.t += dt;

    const s = this.storm;
    const eased = s * s * (3 - 2 * s);      // smoothstep, so the arrival lands

    // ── sky ──
    mix(PALETTE.skyTop, eased, this.domeMat.uniforms.uTop.value);
    mix(PALETTE.skyMid, eased, this.domeMat.uniforms.uMid.value);
    mix(PALETTE.skyLow, eased, this.domeMat.uniforms.uLow.value);

    // ── lightning ──
    this.flash = Math.max(0, this.flash - dt * 3.4);
    if (s > 0.35) {
      this.strikeIn -= dt;
      if (this.strikeIn <= 0) {
        // the angrier it is, the more often the sky goes off
        const lo = SKY.strikeMin * (1 - this.rage * 0.55);
        const hi = SKY.strikeMax * (1 - this.rage * 0.55);
        this.strikeIn = lo + Math.random() * (hi - lo);
        this.strike();
      }
    } else {
      this.strikeIn = SKY.strikeMin;
    }
    // two-stage flicker, so a strike reads as a strike and not as a fade
    const flick = this.flash > 0.72 ? 1 : this.flash > 0.55 ? 0.35 : this.flash;
    this.domeMat.uniforms.uFlash.value = flick * 0.85 * s;

    // ── fog ──
    mix(PALETTE.fog, eased, this.scene.fog.color);
    this.baseFog = this.scene.fog.color.clone();   // updateBlackRabbit lerps from this
    this.scene.fog.near = THREE.MathUtils.lerp(this.fogNear, 8, eased);
    this.scene.fog.far = THREE.MathUtils.lerp(this.fogFar, 78, eased);

    // ── lighting ──
    if (this.sun) {
      mix(PALETTE.sunColor, eased, this.sun.color);
      // Dark, but not unplayable — there is a boss and a flock of chickens to
      // see in this. The mood comes from the colour, not from the exposure.
      this.sun.intensity = this.sunBase * (1 - eased * 0.6) + flick * 2.6 * s;
    }
    if (this.hemi) {
      mix(PALETTE.hemiSky, eased, this.hemi.color);
      mix(PALETTE.hemiGround, eased, this.hemi.groundColor);
      this.hemi.intensity = this.hemiBase * (1 - eased * 0.42) + flick * 1.2 * s;
    }

    // ── dusk, applied on top of everything the storm just decided ──
    //
    // Deliberately AFTER the storm rather than mixed into its palette. A storm
    // at 4pm and a storm at dusk are different skies, and blending one axis
    // into the other would make the boss fight look like nightfall.
    //
    // Lit surfaces go last so `sunBase`/`hemiBase` are still the storm's
    // numbers when they are scaled.
    const dk = this.dusk;
    if (dk > 0.001) {
      const u = this.domeMat.uniforms;
      u.uTop.value.lerp(_d.setHex(DUSK.skyTop), dk);
      u.uMid.value.lerp(_d.setHex(DUSK.skyMid), dk);
      // The horizon warms before it darkens, so the low band peaks halfway
      // through the evening rather than tracking straight to black.
      u.uLow.value.lerp(_d.setHex(DUSK.skyLow), dk * (1 - dk) * 2.4 + dk * 0.35);
      this.scene.fog.color.lerp(_d.setHex(DUSK.fog), dk);
      this.baseFog = this.scene.fog.color.clone();
      // You can see less at night, but never so little that the walk back to
      // the table becomes a maze.
      this.scene.fog.far *= 1 - dk * 0.42;
      if (this.sun) {
        this.sun.color.lerp(_d.setHex(DUSK.sun), dk);
        this.sun.intensity *= 1 - dk * 0.82;
      }
      if (this.hemi) {
        this.hemi.color.lerp(_d.setHex(DUSK.hemiSky), dk);
        this.hemi.groundColor.lerp(_d.setHex(DUSK.hemiGround), dk);
        // Floors at 18%: moonlight, not a black screen.
        this.hemi.intensity *= 1 - dk * 0.82;
      }
    }

    // ── clouds ──
    if (this.clouds) {
      mix(PALETTE.cloud, eased, this.cloudMat.color);
      if (dk > 0.001) this.cloudMat.color.lerp(_d.setHex(DUSK.cloud), dk);
      const drift = THREE.MathUtils.lerp(SKY.driftClear, SKY.driftStorm, eased);
      const span = SKY.cloudSpanXZ;
      for (const c of this.cloudData) {
        c.x += drift * c.speed * dt;
        if (c.x > span / 2) c.x -= span;
        c.yaw += dt * 0.02 * c.speed;
      }
      this._writeClouds();
    }

    // ── rain ──
    const wet = Math.max(0, (s - 0.12) / 0.88);
    this.rain.visible = wet > 0.01;
    if (this.rain.visible && camera) {
      this.rainMat.opacity = 0.34 * wet;
      const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
      const fall = SKY.fallSpeed * (0.5 + wet * 0.5);
      const slant = SKY.slant * wet;
      const half = SKY.rainBox / 2;

      for (let i = 0; i < this.drops.length; i++) {
        const d = this.drops[i];
        d.y -= fall * d.speed * dt;
        d.x += slant * dt;
        if (d.y < -2) { d.y += SKY.rainTop + 2; d.x = (Math.random() - 0.5) * SKY.rainBox; }
        if (d.x > half) d.x -= SKY.rainBox;

        _p.set(cx + d.x, cy + d.y - SKY.rainTop * 0.35, cz + d.z);
        // lean the streak into its own travel direction
        _q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -slant / fall);
        _s.set(1, d.len * (0.6 + wet * 0.9), 1);
        this.rain.setMatrixAt(i, _m.compose(_p, _q, _s));
      }
      this.rain.instanceMatrix.needsUpdate = true;
    }
  }
}
