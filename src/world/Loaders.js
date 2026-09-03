import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

// Asset loading with normalisation and graceful fallback.
//
// Everything in OBJECTS/ comes from a different pipeline, so nothing shares a
// scale or an up-axis. Rather than hand-tune each import, load it, measure it,
// and fit it to a target height. Quaternius FBX in particular tends to arrive
// at 100x.

const fbx = new FBXLoader();
const obj = new OBJLoader();
const cache = new Map();

// Fit by the LARGEST dimension instead of height. Essential for anything wide
// and flat — fitting a sunny-side-up egg by height alone scales it to 47m wide.
export function fitToMax(object3d, targetMax, { center = true } = {}) {
  const box = new THREE.Box3().setFromObject(object3d);
  const size = new THREE.Vector3();
  box.getSize(size);
  const largest = Math.max(size.x, size.y, size.z);
  if (!isFinite(largest) || largest <= 0) return object3d;

  object3d.scale.multiplyScalar(targetMax / largest);

  const box2 = new THREE.Box3().setFromObject(object3d);
  const c = new THREE.Vector3();
  box2.getCenter(c);
  if (center) { object3d.position.x -= c.x; object3d.position.z -= c.z; }
  object3d.position.y -= box2.min.y;
  return object3d;
}

export function fitToHeight(object3d, targetHeight, { center = true } = {}) {
  const box = new THREE.Box3().setFromObject(object3d);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (!isFinite(size.y) || size.y <= 0) return object3d;

  const s = targetHeight / size.y;
  object3d.scale.multiplyScalar(s);

  // re-measure and sit it on the origin
  const box2 = new THREE.Box3().setFromObject(object3d);
  const c = new THREE.Vector3();
  box2.getCenter(c);
  if (center) {
    object3d.position.x -= c.x;
    object3d.position.z -= c.z;
  }
  object3d.position.y -= box2.min.y;
  return object3d;
}

function prepare(root, { color, roughness = 0.85, flat = true }) {
  root.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    if (color !== undefined) {
      o.material = new THREE.MeshStandardMaterial({
        color, roughness, metalness: 0, flatShading: flat,
      });
    } else if (o.material) {
      // keep the source material but make it behave in our lighting
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        m.side = THREE.FrontSide;
        if (m.shininess !== undefined) m.shininess = 8;
      }
    }
  });
  return root;
}

// Returns a Promise<Group>. On failure it resolves to null so the caller can
// drop in a procedural stand-in rather than the level failing to build.
export async function loadModel(url, opts = {}) {
  if (cache.has(url)) return cache.get(url).clone(true);

  const isFbx = /\.fbx$/i.test(url);
  const loader = isFbx ? fbx : obj;

  try {
    const root = await loader.loadAsync(encodeURI(url));
    prepare(root, opts);
    if (opts.maxSize) fitToMax(root, opts.maxSize, opts);
    else if (opts.height) fitToHeight(root, opts.height, opts);

    // wrap so callers can position freely without disturbing the fit
    const wrap = new THREE.Group();
    wrap.add(root);
    cache.set(url, wrap);
    return wrap.clone(true);
  } catch (err) {
    console.warn(`[assets] could not load ${url} —`, err.message ?? err);
    return null;
  }
}
