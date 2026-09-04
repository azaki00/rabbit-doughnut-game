import * as THREE from 'three';
import { textureFor, } from './SkinTextures.js';
import { skinById } from './Skins.js';

// Painting a skin onto a weapon.
//
// One function for all three, because the rules are identical and the bug you
// get from three copies is that two of them drift. §17.5: this is COSMETIC. It
// touches material properties and nothing else — never a number the game reads.
//
// Float shows up as real wear: the paint desaturates, darkens and roughens as
// it approaches Battle-Scarred, so a beaten Factory-New and a beaten
// Battle-Scarred of the same skin are visibly different objects.

const _c = new THREE.Color();
const _size = new THREE.Vector3();

// BOX-PROJECTED UVs.
//
// The glove's own UVs pack every face into one corner of the atlas, because it
// was authored for a flat colour. Sampling a pattern through them gives you a
// single texel stretched over the whole hand — which looks exactly like the
// flat recolour this whole system exists to avoid, and reports no error.
//
// So we project our own: each triangle takes the two axes it faces least, which
// is the standard box unwrap.
//
// The projection happens in the ROOT's space, not each mesh's own space. Raw
// OBJ coordinates are whatever the exporter felt like — the toothbrush's span
// 8 units and are scaled down by a parent — so projecting from local positions
// gave UVs running from -75 to 7 and a pattern tiled thirty times across a
// 19cm brush. Transforming into one shared space first makes the texel density
// identical on every part, whatever the asset pipeline did to it.

const _m = new THREE.Matrix4();
const _nm = new THREE.Matrix3();
const _p = new THREE.Vector3();
const _n = new THREE.Vector3();

function gather(root) {
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const box = new THREE.Box3();
  const parts = [];

  root.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    _m.multiplyMatrices(toRoot, o.matrixWorld);
    _nm.getNormalMatrix(_m);

    const pos = o.geometry.attributes.position;
    const nor = o.geometry.attributes.normal;
    const P = new Float32Array(pos.count * 3);
    const N = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      _p.fromBufferAttribute(pos, i).applyMatrix4(_m);
      P[i * 3] = _p.x; P[i * 3 + 1] = _p.y; P[i * 3 + 2] = _p.z;
      box.expandByPoint(_p);
      if (nor) {
        _n.fromBufferAttribute(nor, i).applyMatrix3(_nm).normalize();
        N[i * 3] = _n.x; N[i * 3 + 1] = _n.y; N[i * 3 + 2] = _n.z;
      } else {
        N[i * 3 + 1] = 1;
      }
    }
    parts.push({ mesh: o, P, N, count: pos.count });
  });

  return { parts, box };
}

function projectPart(part, density, origin) {
  const { mesh, P, N, count } = part;
  const uv = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = P[i * 3] - origin.x, y = P[i * 3 + 1] - origin.y, z = P[i * 3 + 2] - origin.z;
    const nx = Math.abs(N[i * 3]), ny = Math.abs(N[i * 3 + 1]), nz = Math.abs(N[i * 3 + 2]);
    let u, v;
    if (nx >= ny && nx >= nz) { u = z; v = y; }        // facing ±X
    else if (ny >= nx && ny >= nz) { u = x; v = z; }   // facing ±Y
    else { u = x; v = y; }                             // facing ±Z
    uv[i * 2] = u * density;
    uv[i * 2 + 1] = v * density;
  }
  // Clone before writing: loadModel caches and Object3D.clone shares geometry,
  // so touching the original would repaint every other copy of the model.
  if (!mesh.geometry.userData.skinUV) mesh.geometry = mesh.geometry.clone();
  mesh.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  mesh.geometry.userData.skinUV = density;
}

export function applySkinTo(root, inst, { keepParts = [] } = {}) {
  if (!root || !inst) return;
  const def = skinById(inst.skinId);
  if (!def) return;

  const { map, roughnessMap } = textureFor(def);
  const wear = inst.float ?? 0;

  // Aim for roughly three tiles across the object's longest axis, whatever
  // size it happens to be, so a glove and a shotgun read at the same scale.
  const { parts, box } = gather(root);
  box.getSize(_size);
  const longest = Math.max(_size.x, _size.y, _size.z) || 1;
  const density = 3 / longest;
  const origin = box.min;

  for (const part of parts) {
    const o = part.mesh;
    // some parts stay themselves — the toothbrush's bristles, say
    if (keepParts.includes(o.name)) continue;

    projectPart(part, density, origin);

    const list = Array.isArray(o.material) ? o.material : [o.material];
    const built = list.map((src) => {
      const m = new THREE.MeshStandardMaterial({
        name: src?.name ?? '',
        map,
        roughnessMap,
        metalness: inst.metal ?? 0.05,
        // roughnessMap multiplies this, so keep the scalar at 1 and let the
        // map carry the variation
        roughness: 1,
        flatShading: src?.flatShading ?? false,
        side: src?.side ?? THREE.FrontSide,
      });

      // Wear: paint fades toward grey and darkens, and gets rougher.
      if (wear > 0.01) {
        _c.setScalar(1 - wear * 0.28);
        m.color.copy(_c);
        m.metalness *= 1 - wear * 0.5;
      }

      // The rare ones glow slightly, which is most of why they feel rare.
      if (inst.iridescent) {
        m.emissive = new THREE.Color(inst.color).multiplyScalar(0.16);
        m.emissiveMap = map;
        m.emissiveIntensity = 0.9;
      }
      return m;
    });

    o.material = Array.isArray(o.material) ? built : built[0];
  }
}
