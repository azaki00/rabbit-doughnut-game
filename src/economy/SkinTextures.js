import * as THREE from 'three';

// SKIN PATTERNS.
//
// The point of this file: a skin is a PATTERN, not a colour. Fifteen recolours
// of the same glove is the most boring possible version of this feature — you
// cannot tell two of them apart at arm's length and there is no reason to want
// one over another.
//
// So every skin names one of the generators below and gets a real painted
// surface: fades, camo, hydro-dip marbling, crackle, circuitry, scales, star
// fields. Each is drawn once onto a 256px canvas and cached, and several also
// emit a matching ROUGHNESS map, so the pattern changes how the light sits on
// the material and not only its colour. That is what stops it looking like a
// tint slider.
//
// Everything is seeded off the skin id, so a given skin looks the same in the
// case, in your hand, and in everyone else's game.

const SIZE = 256;

// ── a tiny deterministic RNG, so patterns are stable per skin ──
function rng(seed) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return () => {
    h ^= h << 13; h >>>= 0;
    h ^= h >> 17;
    h ^= h << 5;  h >>>= 0;
    return h / 4294967296;
  };
}

const hex = (n) => '#' + n.toString(16).padStart(6, '0');

function canvas() {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  return c;
}

// Fine grain over everything. Even a "plain" skin should not be a flat fill —
// a dead-flat albedo is what makes low-poly work look like untextured greybox.
function grain(g, amount = 0.05, rnd = Math.random) {
  const img = g.getImageData(0, 0, SIZE, SIZE);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * 255 * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

// ── the generators ──────────────────────────────────────────────────────────
// Each fills a 256² canvas from a palette of 2-4 colours.

const PATTERNS = {
  // flat, with a wash of soft blotching so it still reads as a material
  plain(g, pal, rnd) {
    g.fillStyle = hex(pal[0]);
    g.fillRect(0, 0, SIZE, SIZE);
    g.globalAlpha = 0.14;
    g.fillStyle = hex(pal[1] ?? pal[0]);
    for (let i = 0; i < 26; i++) {
      g.beginPath();
      g.arc(rnd() * SIZE, rnd() * SIZE, 18 + rnd() * 46, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    grain(g, 0.06, rnd);
  },

  // the classic: a smooth multi-stop sweep across the diagonal
  fade(g, pal, rnd) {
    const grad = g.createLinearGradient(0, SIZE, SIZE, 0);
    const stops = pal.length;
    pal.forEach((c, i) => grad.addColorStop(i / (stops - 1), hex(c)));
    g.fillStyle = grad;
    g.fillRect(0, 0, SIZE, SIZE);
    grain(g, 0.04, rnd);
  },

  // blobby four-tone camouflage
  camo(g, pal, rnd) {
    g.fillStyle = hex(pal[0]);
    g.fillRect(0, 0, SIZE, SIZE);
    for (let layer = 1; layer < pal.length; layer++) {
      g.fillStyle = hex(pal[layer]);
      for (let i = 0; i < 16; i++) {
        const cx = rnd() * SIZE, cy = rnd() * SIZE;
        const r = 16 + rnd() * 34;
        g.beginPath();
        // a wobbly closed blob, not a circle
        for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 7) {
          const rr = r * (0.62 + rnd() * 0.72);
          const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
          a === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
        }
        g.closePath();
        g.fill();
      }
    }
    grain(g, 0.05, rnd);
  },

  // hydro-dip: long swirling ribbons of colour dragged through water
  hydro(g, pal, rnd) {
    g.fillStyle = hex(pal[0]);
    g.fillRect(0, 0, SIZE, SIZE);
    g.lineCap = 'round';
    for (let i = 0; i < 60; i++) {
      g.strokeStyle = hex(pal[1 + Math.floor(rnd() * (pal.length - 1))]);
      g.lineWidth = 2 + rnd() * 13;
      g.globalAlpha = 0.35 + rnd() * 0.5;
      g.beginPath();
      let x = rnd() * SIZE, y = rnd() * SIZE;
      g.moveTo(x, y);
      let a = rnd() * Math.PI * 2;
      for (let s = 0; s < 16; s++) {
        a += (rnd() - 0.5) * 1.15;
        x += Math.cos(a) * 20;
        y += Math.sin(a) * 20;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    g.globalAlpha = 1;
    grain(g, 0.05, rnd);
  },

  // diagonal racing stripes with thin pinstripes between
  stripes(g, pal, rnd) {
    g.fillStyle = hex(pal[0]);
    g.fillRect(0, 0, SIZE, SIZE);
    g.save();
    g.translate(SIZE / 2, SIZE / 2);
    g.rotate(-0.6);
    g.translate(-SIZE, -SIZE);
    let x = 0;
    while (x < SIZE * 2) {
      const w = 8 + rnd() * 34;
      g.fillStyle = hex(pal[1 + Math.floor(rnd() * (pal.length - 1))]);
      g.fillRect(x, 0, w, SIZE * 2);
      x += w;
      // pinstripe
      g.fillStyle = hex(pal[pal.length - 1]);
      g.fillRect(x, 0, 2 + rnd() * 2, SIZE * 2);
      x += 6 + rnd() * 22;
    }
    g.restore();
    grain(g, 0.045, rnd);
  },

  // checkerboard with the squares knocked about a bit
  checker(g, pal, rnd) {
    const n = 8, s = SIZE / n;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        g.fillStyle = hex((x + y) % 2 ? pal[1] : pal[0]);
        const j = 2;
        g.fillRect(
          x * s + (rnd() - 0.5) * j, y * s + (rnd() - 0.5) * j,
          s + (rnd() - 0.5) * j, s + (rnd() - 0.5) * j,
        );
      }
    }
    grain(g, 0.07, rnd);
  },

  // thrown paint
  splatter(g, pal, rnd) {
    g.fillStyle = hex(pal[0]);
    g.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 34; i++) {
      g.fillStyle = hex(pal[1 + Math.floor(rnd() * (pal.length - 1))]);
      const cx = rnd() * SIZE, cy = rnd() * SIZE, r = 4 + rnd() * 22;
      g.beginPath();
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 9) {
        const rr = r * (0.45 + rnd() * 1.1);
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        a === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.closePath(); g.fill();
      // satellite droplets
      for (let d = 0; d < 5; d++) {
        g.beginPath();
        g.arc(cx + (rnd() - 0.5) * r * 5, cy + (rnd() - 0.5) * r * 5, rnd() * 3.2, 0, Math.PI * 2);
        g.fill();
      }
    }
    grain(g, 0.05, rnd);
  },

  // case-hardened: cell walls with mottled interiors
  crackle(g, pal, rnd) {
    g.fillStyle = hex(pal[0]);
    g.fillRect(0, 0, SIZE, SIZE);

    const pts = [];
    for (let i = 0; i < 26; i++) pts.push([rnd() * SIZE, rnd() * SIZE, pal[1 + Math.floor(rnd() * (pal.length - 1))]]);

    // cheap Voronoi: for every pixel block, fill with the nearest seed's colour
    const B = 2;   // 4 left visible stair-stepping on small props
    for (let y = 0; y < SIZE; y += B) {
      for (let x = 0; x < SIZE; x += B) {
        let best = 0, bestD = Infinity, second = Infinity;
        for (let i = 0; i < pts.length; i++) {
          const dx = x - pts[i][0], dy = y - pts[i][1];
          const d = dx * dx + dy * dy;
          if (d < bestD) { second = bestD; bestD = d; best = i; }
          else if (d < second) second = d;
        }
        // darken toward the cell boundary, which is where the walls appear
        const edge = Math.sqrt(second) - Math.sqrt(bestD);
        g.fillStyle = pts[best][2] !== undefined ? hex(pts[best][2]) : hex(pal[1]);
        g.globalAlpha = edge < 5 ? 0.25 : 1;
        g.fillRect(x, y, B, B);
      }
    }
    g.globalAlpha = 1;
    grain(g, 0.09, rnd);
  },

  // PCB traces and solder pads
  circuit(g, pal, rnd) {
    g.fillStyle = hex(pal[0]);
    g.fillRect(0, 0, SIZE, SIZE);
    g.strokeStyle = hex(pal[1]);
    g.lineWidth = 2;
    g.lineCap = 'square';
    for (let i = 0; i < 26; i++) {
      let x = Math.floor(rnd() * 16) * 16, y = Math.floor(rnd() * 16) * 16;
      g.beginPath();
      g.moveTo(x, y);
      for (let s = 0; s < 5; s++) {
        if (rnd() < 0.5) x += (rnd() < 0.5 ? -1 : 1) * 16 * (1 + Math.floor(rnd() * 3));
        else y += (rnd() < 0.5 ? -1 : 1) * 16 * (1 + Math.floor(rnd() * 3));
        g.lineTo(x, y);
      }
      g.stroke();
      g.fillStyle = hex(pal[2] ?? pal[1]);
      g.beginPath(); g.arc(x, y, 3.5, 0, Math.PI * 2); g.fill();
    }
    grain(g, 0.05, rnd);
  },

  // a night sky
  stars(g, pal, rnd) {
    const grad = g.createRadialGradient(SIZE * 0.35, SIZE * 0.3, 10, SIZE * 0.5, SIZE * 0.5, SIZE * 0.8);
    grad.addColorStop(0, hex(pal[1] ?? pal[0]));
    grad.addColorStop(1, hex(pal[0]));
    g.fillStyle = grad;
    g.fillRect(0, 0, SIZE, SIZE);
    g.fillStyle = hex(pal[pal.length - 1]);
    for (let i = 0; i < 260; i++) {
      const r = rnd() * rnd() * 2.2;
      g.globalAlpha = 0.35 + rnd() * 0.65;
      g.beginPath(); g.arc(rnd() * SIZE, rnd() * SIZE, r, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
  },

  // overlapping scale rows
  scales(g, pal, rnd) {
    g.fillStyle = hex(pal[0]);
    g.fillRect(0, 0, SIZE, SIZE);
    const r = 17;
    for (let row = 0; row * r * 0.72 < SIZE + r; row++) {
      for (let col = -1; col * r * 1.5 < SIZE + r; col++) {
        const x = col * r * 1.5 + (row % 2 ? r * 0.75 : 0);
        const y = row * r * 0.72;
        g.fillStyle = hex(pal[1 + Math.floor(rnd() * (pal.length - 1))]);
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI);
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,.22)';
        g.lineWidth = 1.4;
        g.stroke();
      }
    }
    grain(g, 0.04, rnd);
  },

  // hand-drawn nonsense: rings, dots and squiggles
  doodle(g, pal, rnd) {
    g.fillStyle = hex(pal[0]);
    g.fillRect(0, 0, SIZE, SIZE);
    g.lineCap = 'round';
    for (let i = 0; i < 30; i++) {
      g.strokeStyle = hex(pal[1 + Math.floor(rnd() * (pal.length - 1))]);
      g.lineWidth = 2 + rnd() * 3;
      const cx = rnd() * SIZE, cy = rnd() * SIZE;
      const pick = rnd();
      g.beginPath();
      if (pick < 0.4) {
        // a doughnut
        g.arc(cx, cy, 7 + rnd() * 16, 0, Math.PI * 2);
      } else if (pick < 0.7) {
        // a squiggle
        g.moveTo(cx, cy);
        for (let s = 0; s < 6; s++) g.lineTo(cx + (rnd() - 0.5) * 60, cy + (rnd() - 0.5) * 60);
      } else {
        // a cross
        const r = 6 + rnd() * 10;
        g.moveTo(cx - r, cy - r); g.lineTo(cx + r, cy + r);
        g.moveTo(cx + r, cy - r); g.lineTo(cx - r, cy + r);
      }
      g.stroke();
    }
    grain(g, 0.05, rnd);
  },

  // corroded metal: blotches and pitting
  rust(g, pal, rnd) {
    g.fillStyle = hex(pal[0]);
    g.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 90; i++) {
      g.globalAlpha = 0.10 + rnd() * 0.45;
      g.fillStyle = hex(pal[1 + Math.floor(rnd() * (pal.length - 1))]);
      const cx = rnd() * SIZE, cy = rnd() * SIZE, r = 3 + rnd() * 30;
      g.beginPath();
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 6) {
        const rr = r * (0.5 + rnd() * 1.0);
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        a === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.closePath(); g.fill();
    }
    g.globalAlpha = 1;
    grain(g, 0.13, rnd);
  },

  // banded metal, as if reflecting a horizon
  chrome(g, pal, rnd) {
    for (let y = 0; y < SIZE; y++) {
      const t = y / SIZE;
      const band = 0.5 + 0.5 * Math.sin(t * Math.PI * 6 + Math.sin(t * 11) * 1.6);
      const i = Math.min(pal.length - 1, Math.floor(band * pal.length));
      g.fillStyle = hex(pal[i]);
      g.globalAlpha = 0.55 + band * 0.45;
      g.fillRect(0, y, SIZE, 1);
    }
    g.globalAlpha = 1;
    grain(g, 0.03, rnd);
  },

  // nebula clouds, for the things that should stop you in your tracks
  galaxy(g, pal, rnd) {
    g.fillStyle = hex(pal[0]);
    g.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 40; i++) {
      const cx = rnd() * SIZE, cy = rnd() * SIZE, r = 20 + rnd() * 80;
      const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      const c = pal[1 + Math.floor(rnd() * (pal.length - 1))];
      grad.addColorStop(0, hex(c));
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = 0.32;
      g.fillStyle = grad;
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 200; i++) {
      g.globalAlpha = rnd();
      g.beginPath(); g.arc(rnd() * SIZE, rnd() * SIZE, rnd() * 1.6, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
  },
};

export const PATTERN_NAMES = Object.keys(PATTERNS);

// ── build + cache ───────────────────────────────────────────────────────────

const cache = new Map();

function draw(skin) {
  const c = canvas();
  const g = c.getContext('2d');
  const gen = PATTERNS[skin.pattern] ?? PATTERNS.plain;
  gen(g, skin.palette, rng(skin.id));
  return c;
}

// A roughness map derived from the albedo: darker paint reads as glossier.
// This is the cheap trick that makes a pattern feel PHYSICAL rather than
// printed — the pattern shows up in the highlight as well as in the colour.
function roughnessFrom(albedoCanvas, base, contrast) {
  const c = canvas();
  const g = c.getContext('2d');
  g.drawImage(albedoCanvas, 0, 0);
  const img = g.getImageData(0, 0, SIZE, SIZE);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
    const r = Math.max(0, Math.min(1, base + (lum - 0.5) * contrast));
    const v = r * 255;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  g.putImageData(img, 0, 0);
  return c;
}

// Returns { map, roughnessMap, dataUrl } for a skin definition. Cached by id.
export function textureFor(skin) {
  if (cache.has(skin.id)) return cache.get(skin.id);

  const albedo = draw(skin);

  const map = new THREE.CanvasTexture(albedo);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(skin.repeat ?? 1, skin.repeat ?? 1);
  map.anisotropy = 4;

  const roughCanvas = roughnessFrom(albedo, skin.rough ?? 0.65, skin.roughContrast ?? 0.5);
  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.copy(map.repeat);

  // a small preview for the case reel tickets
  const preview = document.createElement('canvas');
  preview.width = preview.height = 96;
  preview.getContext('2d').drawImage(albedo, 0, 0, 96, 96);

  const out = { map, roughnessMap, dataUrl: preview.toDataURL('image/png') };
  cache.set(skin.id, out);
  return out;
}
