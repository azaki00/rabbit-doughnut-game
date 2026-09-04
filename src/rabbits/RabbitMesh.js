import * as THREE from 'three';

// Procedural rabbit body — GAME_DESIGN.md §5.1 / ASSETS.md
//
// Built as a transform hierarchy rather than a skinned mesh: the gait needs
// direct, exact control over every joint, and a hand-built hierarchy is easier
// to reason about than skin weights we'd only be fighting.
//
//   root
//    └ carriage            ← ballistic Y from the gait, landing squash
//       ├ haunch           ← spine flexion pivot; the haunch LEADS
//       │   ├ hindLeg.L/R
//       │   └ tail
//       └ chest            ← follows the haunch with a delay
//           ├ foreLeg.L/R
//           └ neck → head
//                └ ear.L/R ← 3 bones each, damped-spring driven

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

export function buildRabbit(type) {
  const c = type.colors;
  const flat = true;

  const matMain  = new THREE.MeshStandardMaterial({ color: c.main,  flatShading: flat, roughness: type.matte ? 1.0 : .88, metalness: 0 });
  const matBelly = new THREE.MeshStandardMaterial({ color: c.belly, flatShading: flat, roughness: type.matte ? 1.0 : .9,  metalness: 0 });
  const matEar   = new THREE.MeshStandardMaterial({ color: c.ear,   flatShading: flat, roughness: .9, metalness: 0 });
  const matTail  = new THREE.MeshStandardMaterial({ color: c.tail,  flatShading: flat, roughness: 1, metalness: 0 });
  const matEye   = type.eyeGlow
    ? new THREE.MeshBasicMaterial({ color: c.eye })
    : new THREE.MeshStandardMaterial({ color: c.eye, roughness: .35, metalness: .1 });

  const B = type.body;          // body radius-ish
  const L = type.len;           // nose-to-tail length
  const legLen = type.legLen;

  const root = new THREE.Group();
  const carriage = new THREE.Group();
  root.add(carriage);

  // ── haunch (rear half) — the powerhouse, and the spine pivot ──
  const haunch = new THREE.Group();
  haunch.position.set(0, legLen + B * 0.5, -L * 0.16);
  carriage.add(haunch);

  const haunchMesh = new THREE.Mesh(box(B * 0.94, B * 0.95, L * 0.46), matMain);
  haunchMesh.position.z = -L * 0.10;
  haunchMesh.castShadow = true;
  haunch.add(haunchMesh);

  const rump = new THREE.Mesh(box(B * 0.80, B * 0.78, L * 0.16), matMain);
  rump.position.set(0, -B * 0.04, -L * 0.35);
  haunch.add(rump);

  // ── chest (front half) — hangs off the haunch through the spine ──
  const chest = new THREE.Group();
  chest.position.set(0, 0, L * 0.16);
  haunch.add(chest);

  const chestMesh = new THREE.Mesh(box(B * 0.80, B * 0.80, L * 0.36), matMain);
  chestMesh.position.z = L * 0.14;
  chestMesh.castShadow = true;
  chest.add(chestMesh);

  const belly = new THREE.Mesh(box(B * 0.62, B * 0.30, L * 0.52), matBelly);
  belly.position.set(0, -B * 0.36, L * 0.02);
  chest.add(belly);

  // ── neck + head ──
  const neck = new THREE.Group();
  neck.position.set(0, B * 0.20, L * 0.30);
  chest.add(neck);

  const head = new THREE.Group();
  head.position.set(0, B * 0.16, L * 0.10);
  neck.add(head);

  const skull = new THREE.Mesh(box(B * 0.58, B * 0.55, B * 0.66), matMain);
  skull.castShadow = true;
  head.add(skull);

  const snout = new THREE.Group();                 // pivots for the nose twitch
  snout.position.set(0, -B * 0.10, B * 0.31);
  head.add(snout);
  const snoutMesh = new THREE.Mesh(box(B * 0.30, B * 0.26, B * 0.24), matBelly);
  snoutMesh.position.z = B * 0.09;
  snout.add(snoutMesh);
  const nose = new THREE.Mesh(box(B * 0.09, B * 0.07, B * 0.05), matEar);
  nose.position.set(0, B * 0.02, B * 0.21);
  snout.add(nose);

  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(box(B * 0.07, B * 0.12, B * 0.10), matEye);
    eye.position.set(s * B * 0.28, B * 0.06, B * 0.16);
    head.add(eye);
  }

  // ── ears: 3 segments each, so they can whip and lag ──
  const ears = [];
  for (const s of [-1, 1]) {
    const segLen = type.earLen / 3;
    const base = new THREE.Group();
    base.position.set(s * B * 0.20, B * 0.26, -B * 0.02);
    base.rotation.z = s * 0.12;
    head.add(base);

    const segs = [];
    let parent = base;
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      g.position.y = i === 0 ? 0 : segLen;
      parent.add(g);
      const m = new THREE.Mesh(
        box(type.earWidth * (1 - i * 0.12), segLen, type.earWidth * 0.42),
        i === 2 ? matEar : matMain);
      m.position.y = segLen * 0.5;
      m.castShadow = true;
      g.add(m);
      // inner ear flash on the last segment
      if (i === 2) {
        const inner = new THREE.Mesh(box(type.earWidth * 0.5, segLen * 0.7, type.earWidth * 0.16), matEar);
        inner.position.set(0, segLen * 0.5, type.earWidth * 0.22);
        g.add(inner);
      }
      segs.push(g);
      parent = g;
    }
    ears.push({ side: s, base, segs, springAngle: 0, springVel: 0, lateral: 0, lateralVel: 0 });
  }

  // ── legs ──
  const mkLeg = (parent, x, y, z, len, thick, mat) => {
    const hip = new THREE.Group();
    hip.position.set(x, y, z);
    parent.add(hip);
    const upper = new THREE.Mesh(box(thick, len * 0.6, thick * 1.25), mat);
    upper.position.y = -len * 0.3;
    upper.castShadow = true;
    hip.add(upper);
    const knee = new THREE.Group();
    knee.position.y = -len * 0.6;
    hip.add(knee);
    const lower = new THREE.Mesh(box(thick * 0.82, len * 0.42, thick * 1.5), mat);
    lower.position.set(0, -len * 0.21, thick * 0.16);
    knee.add(lower);
    return { hip, knee };
  };

  const hindLegs = [], foreLegs = [];
  for (const s of [-1, 1]) {
    // hind hips sit WIDE — they must plant outside the front feet
    hindLegs.push(mkLeg(haunch, s * B * 0.46, -B * 0.30, -L * 0.06,
                        legLen * 1.5, B * 0.24, matMain));
    foreLegs.push(mkLeg(chest, s * B * 0.28, -B * 0.32, L * 0.22,
                        legLen * 1.1, B * 0.17, matMain));
  }

  // ── tail ──
  const tail = new THREE.Mesh(new THREE.SphereGeometry(type.tail, 6, 5), matTail);
  tail.position.set(0, B * 0.06, -L * 0.44);
  tail.castShadow = true;
  haunch.add(tail);

  // ── MUTATIONS ──
  // Only ever additive, and only on mutants. Every one of these hangs off an
  // existing joint, so the gait keeps working exactly as it does on a normal
  // rabbit — a mutant with four ears still bounds correctly, it just looks
  // like something that should not be bounding.
  if (type.mutant) {
    // extra ear pairs, sprouting out of the back rather than the head
    for (let e = 0; e < (type.extraEars ?? 0); e++) {
      for (const s of [-1, 1]) {
        const len = type.earLen * (0.5 + Math.random() * 0.9);
        const ear = new THREE.Mesh(box(type.earWidth * 0.8, len, type.earWidth * 0.4), matEar);
        ear.position.set(
          s * B * (0.25 + Math.random() * 0.3),
          B * 0.5 + len * 0.4,
          -L * (0.05 + e * 0.14),
        );
        ear.rotation.set((Math.random() - 0.5) * 0.9, 0, s * (0.3 + Math.random() * 0.6));
        ear.castShadow = true;
        haunch.add(ear);
      }
    }

    // too many eyes, scattered around the skull
    for (let i = 0; i < (type.extraEyes ?? 0); i++) {
      const eye = new THREE.Mesh(box(B * 0.08, B * 0.11, B * 0.09), matEye);
      const a = Math.random() * Math.PI * 2;
      eye.position.set(
        Math.cos(a) * B * 0.30,
        B * (0.02 + Math.random() * 0.3),
        Math.sin(a) * B * 0.22 + B * 0.08,
      );
      head.add(eye);
    }

    // lumps along the spine
    for (let i = 0; i < (type.lumps ?? 0); i++) {
      const r = B * (0.14 + Math.random() * 0.24);
      const lump = new THREE.Mesh(new THREE.SphereGeometry(r, 5, 4), matBelly);
      lump.position.set(
        (Math.random() - 0.5) * B * 0.6,
        B * (0.35 + Math.random() * 0.3),
        -L * 0.35 + Math.random() * L * 0.5,
      );
      lump.castShadow = true;
      haunch.add(lump);
    }

    // and, occasionally, a second head on a neck of its own
    if (type.twoHeads) {
      const h2 = new THREE.Group();
      h2.position.set(B * 0.42, B * 0.34, L * 0.22);
      h2.rotation.z = -0.35;
      chest.add(h2);
      const skull2 = new THREE.Mesh(box(B * 0.5, B * 0.48, B * 0.58), matMain);
      skull2.castShadow = true;
      h2.add(skull2);
      for (const s of [-1, 1]) {
        const eye = new THREE.Mesh(box(B * 0.07, B * 0.11, B * 0.09), matEye);
        eye.position.set(s * B * 0.24, B * 0.05, B * 0.14);
        h2.add(eye);
      }
      const e2Len = type.earLen * 0.7;
      for (const s of [-1, 1]) {
        const ear = new THREE.Mesh(box(type.earWidth * 0.85, e2Len, type.earWidth * 0.4), matEar);
        ear.position.set(s * B * 0.18, B * 0.24 + e2Len * 0.5, 0);
        ear.rotation.z = s * 0.2;
        h2.add(ear);
      }
      root.userData.secondHead = h2;
    }

    // one side sits lower than the other — it limps
    if (type.limpSide) {
      const leg = hindLegs[type.limpSide < 0 ? 0 : 1];
      leg.hip.scale.y = 0.62 + Math.random() * 0.25;
    }
  }

  if (type.scale) root.scale.setScalar(type.scale);

  return {
    root, carriage, haunch, chest, neck, head, snout, ears,
    hindLegs, foreLegs, tail,
    restY: legLen + B * 0.5,
    materials: { matMain, matBelly, matEar, matEye },
  };
}
