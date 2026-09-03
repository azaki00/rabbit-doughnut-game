import * as THREE from 'three';

// Renderer, scene, the two-camera rig, and lighting.
//
// The glove viewmodel renders on its own camera with a tiny near-plane so it can
// never clip into world geometry, no matter how close the player stands to a wall.

export const LAYER_WORLD = 0;
export const LAYER_VIEWMODEL = 1;

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.autoClear = false;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xbfe0f0);
    this.scene.fog = new THREE.Fog(0xc8e4f2, 40, 190);

    // ── world camera ──
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.08, 600);
    this.camera.layers.enable(LAYER_WORLD);

    // ── viewmodel camera ── shares FOV, renders only layer 1, clears depth first
    this.vmCamera = new THREE.PerspectiveCamera(60, 1, 0.005, 6);
    this.vmCamera.layers.set(LAYER_VIEWMODEL);
    this.vmScene = new THREE.Scene();

    this._buildLights();
    this._onResize();
    addEventListener('resize', () => this._onResize());
  }

  _buildLights() {
    const hemi = new THREE.HemisphereLight(0xdff0ff, 0x6f7a4a, 1.05);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff0d0, 1.9);
    sun.position.set(38, 56, 22);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = 55;
    sun.shadow.camera.left = -s; sun.shadow.camera.right = s;
    sun.shadow.camera.top  =  s; sun.shadow.camera.bottom = -s;
    sun.shadow.camera.near = 1;  sun.shadow.camera.far = 160;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);
    this.sun = sun;

    // Viewmodel gets its own light so the glove reads the same in any shadow.
    // Lights are layer-filtered exactly like meshes: a light on layer 0 is never
    // even collected for a camera rendering layer 1, and the glove comes out
    // pure black. They have to be moved onto the viewmodel layer too.
    const vmAmb = new THREE.HemisphereLight(0xffffff, 0x666677, 1.6);
    const vmKey = new THREE.DirectionalLight(0xffffff, 1.5);
    vmKey.position.set(-0.8, 1.2, 1.6);
    const vmFill = new THREE.DirectionalLight(0xffe8d8, 0.5);
    vmFill.position.set(1.2, -0.4, 0.8);
    for (const l of [vmAmb, vmKey, vmFill]) {
      l.layers.set(LAYER_VIEWMODEL);
      this.vmScene.add(l);
    }
  }

  _onResize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.vmCamera.aspect = w / h;
    this.vmCamera.updateProjectionMatrix();
  }

  setFov(deg) {
    if (Math.abs(this.camera.fov - deg) < 0.01) return;
    this.camera.fov = deg;
    this.camera.updateProjectionMatrix();
  }

  render() {
    const r = this.renderer;
    r.clear();
    r.render(this.scene, this.camera);
    r.clearDepth();                       // viewmodel always on top
    r.render(this.vmScene, this.vmCamera);
  }
}
