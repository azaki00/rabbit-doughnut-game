import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

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

function prepare(root, { color, roughness = 0.85, flat = true, recolor, brighten }) {
  root.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    if (color !== undefined) {
      o.material = new THREE.MeshStandardMaterial({
        color, roughness, metalness: 0, flatShading: flat,
      });
    } else if (o.material) {
      // Keep the source material (and its texture maps) but make it behave in
      // our lighting: MTL phong with Kd 0,0,0 renders black, so when a map is
      // present the diffuse colour has to be lifted to white.
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        // Some source assets are authored almost black (the tree pack ships
        // #3f250e bark and #182e03 leaves), which under ACES tone mapping reads
        // as a flat silhouette. `recolor` remaps by material name; `brighten`
        // scales whatever is there.
        if (recolor && m.name && recolor[m.name] !== undefined && m.color) {
          m.color.setHex(recolor[m.name]);
        } else if (brighten && m.color) {
          m.color.multiplyScalar(brighten);
          m.color.r = Math.min(1, m.color.r);
          m.color.g = Math.min(1, m.color.g);
          m.color.b = Math.min(1, m.color.b);
        }
        // Luminance floor. Several of these packs are authored for a renderer
        // with much stronger ambient than ours — House_1 ships #271106 walls and
        // #090909 windows, which come out as a black cutout here. Lift anything
        // untextured that is too dark, preserving its hue.
        if (!m.map && m.color) {
          const lum = 0.299 * m.color.r + 0.587 * m.color.g + 0.114 * m.color.b;
          const FLOOR = 0.20;
          if (lum > 0.0001 && lum < FLOOR) {
            m.color.multiplyScalar(FLOOR / lum);
            m.color.r = Math.min(1, m.color.r);
            m.color.g = Math.min(1, m.color.g);
            m.color.b = Math.min(1, m.color.b);
          } else if (lum <= 0.0001) {
            m.color.setScalar(FLOOR);          // pure black gets a flat grey
          }
        }

        m.side = THREE.DoubleSide;
        if (m.map) {
          m.map.colorSpace = THREE.SRGBColorSpace;
          m.color?.setScalar(1);
        }
        if (m.shininess !== undefined) m.shininess = 6;
        if (m.specular?.setScalar) m.specular.setScalar(0.04);
      }
    }
  });
  return root;
}

// Collapse a model made of many small meshes into ONE geometry, baking each
// mesh's material colour into vertex colours. The grass model is ~100 separate
// meshes per patch; cloning it a hundred times would be thousands of draw calls.
// Merged like this it can be drawn as a single InstancedMesh.
export function flattenToGeometry(root) {
  const geos = [];
  root.updateMatrixWorld(true);

  root.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);

    // strip anything that isn't shared by every mesh, or the merge fails
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    }
    if (!g.attributes.normal) g.computeVertexNormals();

    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    const col = mat?.color ?? new THREE.Color(0xffffff);
    const n = g.attributes.position.count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      colors[i * 3]     = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geos.push(g);
  });

  if (!geos.length) return null;
  const merged = BufferGeometryUtils.mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  return merged;
}

// Returns a Promise<Group>. On failure it resolves to null so the caller can
// drop in a procedural stand-in rather than the level failing to build.
export async function loadModel(url, opts = {}) {
  if (cache.has(url)) return cache.get(url).clone(true);

  const isFbx = /\.fbx$/i.test(url);

  try {
    let root;
    if (isFbx) {
      root = await fbx.loadAsync(encodeURI(url));
    } else {
      // OBJ: load the sibling .mtl first when asked, so textured models
      // (the Cottage) arrive with their maps instead of flat white.
      const dir = url.slice(0, url.lastIndexOf('/') + 1);
      let materials = null;
      if (opts.mtl) {
        const mtlUrl = typeof opts.mtl === 'string' ? opts.mtl : url.replace(/\.obj$/i, '.mtl');
        try {
          // A FRESH MTLLoader per call. setPath/setResourcePath mutate the
          // instance, so a shared one lets concurrent loads clobber each other's
          // resource paths — which silently resolved the Cottage's texture
          // against OBJECTS/grass/ and left it black.
          const ml = new MTLLoader();
          ml.setPath(encodeURI(dir)).setResourcePath(encodeURI(dir));
          materials = await ml.loadAsync(encodeURI(mtlUrl.slice(dir.length)));
          materials.preload();
        } catch (e) {
          console.warn(`[assets] no materials for ${url} —`, e.message ?? e);
        }
      }
      const l = new OBJLoader();
      if (materials) l.setMaterials(materials);
      root = await l.loadAsync(encodeURI(url));
    }
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
