/* Win98-era liquid effects on a low-res pixel buffer:
   Hugo Elias ripple, Anfy-style lake reflection, palette cycling, metaballs, Bayer dithering, pixel bubbles. */
(function () {
  const BT = window.BT || (window.BT = {});

  const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16 - 0.5);
  const BAYER8 = (() => {
    const m = [], b4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const q = b4[(y % 4) * 4 + (x % 4)] * 4 + [0, 2, 3, 1][((y >> 2) << 1) | (x >> 2)];
      m.push((q + 0.5) / 64 - 0.5);
    }
    return m;
  })();
  BT.BAYER4 = BAYER4; BT.BAYER8 = BAYER8;

  const hex = BT.hexRgb;
  const P = s => s.split(' ').map(hex);
  BT.DITHER_PALETTES = {
    win16: P('#000000 #800000 #008000 #808000 #000080 #800080 #008080 #c0c0c0 #808080 #ff0000 #00ff00 #ffff00 #0000ff #ff00ff #00ffff #ffffff'),
    water: P('#000020 #000060 #0000a0 #0040c0 #0080ff #00c0ff #80e0ff #ffffff'),
    orange: P('#200800 #602000 #a04000 #e06000 #ff8c00 #ffb000 #ffd84a #fff4c0'),
    cga: P('#000000 #55ffff #ff55ff #ffffff'),
    gray4: P('#000000 #555555 #aaaaaa #ffffff'),
    web: (() => { const a = []; for (let r = 0; r < 6; r++) for (let g = 0; g < 6; g++) for (let b = 0; b < 6; b++) a.push([r * 51, g * 51, b * 51]); return a; })(),
  };
  const lutCache = {};
  function lutFor(name, pal) {
    if (lutCache[name]) return lutCache[name];
    const lut = new Uint8Array(32768);
    for (let i = 0; i < 32768; i++) {
      const r = ((i >> 10) & 31) * 8.226, g = ((i >> 5) & 31) * 8.226, b = (i & 31) * 8.226;
      let best = 0, bd = 1e9;
      for (let k = 0; k < pal.length; k++) {
        const dr = r - pal[k][0], dg = g - pal[k][1], db = b - pal[k][2];
        const dd = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
        if (dd < bd) { bd = dd; best = k; }
      }
      lut[i] = best;
    }
    return (lutCache[name] = lut);
  }

  function gradientLut(stops, size) {
    const out = [];
    for (let i = 0; i < size; i++) {
      const t = (i / size) * stops.length;
      const a = stops[Math.floor(t) % stops.length], b = stops[(Math.floor(t) + 1) % stops.length], f = t - Math.floor(t);
      out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f].map(Math.round));
    }
    return out;
  }
  BT.CYCLE_PALETTES = {
    water: gradientLut(P('#000040 #0030a0 #0080e0 #60d0ff #ffffff #60d0ff #0080e0 #0030a0'), 32),
    beer: gradientLut(P('#401000 #a03c00 #ff8c00 #ffc830 #fff6c8 #ffc830 #ff8c00 #a03c00'), 32),
    lava: gradientLut(P('#100000 #600000 #d02000 #ff8000 #ffff40 #ff8000 #d02000 #600000'), 32),
    acid: gradientLut(P('#000000 #00ff00 #ffff00 #ff00ff #00ffff #0000ff'), 32),
    vapor: gradientLut(P('#008080 #00c0c0 #ff80ff #ffffff #ff80ff #00c0c0'), 32),
  };

  function circleSprite(r) {
    const ring = [], inner = [], hi = [];
    const R = r + 0.5;
    for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++) {
      const dd = Math.sqrt(x * x + y * y);
      if (dd <= R && dd > R - 1.15) ring.push(x, y);
      else if (dd <= R - 1.15) inner.push(x, y);
    }
    const hr = Math.max(1, Math.round(r * 0.45));
    const hx = -Math.round(r * 0.4), hy = -Math.round(r * 0.4);
    if (r <= 2) hi.push(hx, hy);
    else for (let y = -hr; y <= hr; y++) for (let x = -hr; x <= hr; x++) {
      if (x * x + y * y <= hr * hr * 0.6 && x + y < 0) hi.push(hx + x, hy + y);
    }
    return { ring, inner, hi };
  }
  const SPRITES = [];
  for (let r = 0; r <= 24; r++) SPRITES.push(circleSprite(r));

  function hash(n) { n = Math.sin(n * 127.1) * 43758.5453; return n - Math.floor(n); }
  BT.hash = hash;

  BT.FX = class {
    constructor() {
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
      this.w = this.h = 0;
      this.bubbles = []; this.pops = [];
      this.spawnAcc = 0; this.rainAcc = 0; this.pulseAcc = 0;
      this.region = null;
      this.det = null; this.scaleX = 1; this.scaleY = 1;
    }
    resize(w, h) {
      if (w === this.w && h === this.h) return;
      this.w = w; this.h = h;
      this.canvas.width = w; this.canvas.height = h;
      this.rA = new Float32Array(w * h); this.rB = new Float32Array(w * h);
      this.out = this.ctx.createImageData(w, h);
      this.tmp = new Uint8ClampedArray(w * h * 4);
      this.bubbles = []; this.pops = [];
      this.region = null;
    }
    setBase(data) { this.base = data; }
    setDetection(det) {
      this.det = det;
      const w = this.w, h = this.h;
      if (!det || !w) { this.region = null; return; }
      const reg = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) {
        const ay = Math.min(det.h - 1, (y * det.h / h) | 0);
        for (let x = 0; x < w; x++) {
          const ax = Math.min(det.w - 1, (x * det.w / w) | 0);
          reg[y * w + x] = det.keep[det.labels[ay * det.w + ax]] ? 1 : 0;
        }
      }
      this.region = reg;
      this.sx = w / det.w; this.sy = h / det.h;
    }
    blobsFx() {
      const det = this.det; if (!det) return [];
      return det.blobs.map(b => ({
        id: b.id, cx: b.cx * this.sx, cy: b.cy * this.sy,
        r: Math.sqrt(b.area * this.sx * this.sy / Math.PI),
        minx: b.minx * this.sx, miny: b.miny * this.sy, maxx: (b.maxx + 1) * this.sx, maxy: (b.maxy + 1) * this.sy, label: b.label,
      }));
    }
    inRegion(mode, i) {
      if (mode === 'all' || !this.region) return true;
      return mode === 'blobs' ? this.region[i] === 1 : this.region[i] === 0;
    }
    drop(x, y, radius, amp) {
      const w = this.w, h = this.h, a = this.rA;
      x |= 0; y |= 0;
      for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 1 || ny < 1 || nx >= w - 1 || ny >= h - 1) continue;
        const dd = dx * dx + dy * dy;
        if (dd <= radius * radius) a[ny * w + nx] += amp * (1 - Math.sqrt(dd) / (radius + 1));
      }
    }

    step(dt, t, S) {
      const w = this.w, h = this.h;
      if (!w || !this.base) return;
      const out = this.out.data, src = this.base;
      out.set(src);
      const blobs = this.blobsFx();

      if (S.ripOn) this.ripple(dt, S, blobs, src, out);
      if (S.lakeOn) this.lake(t, S, out);
      if (S.palOn) this.palette(t, S, blobs, out);
      if (S.mbOn) this.metaballs(t, S, blobs, out);
      if (S.dithOn) this.dither(S, out);
      if (S.bubOn) this.bubblesStep(dt, S, blobs, out);
      else { this.bubbles.length = 0; this.pops.length = 0; }
      this.ctx.putImageData(this.out, 0, 0);
    }

    ripple(dt, S, blobs, src, out) {
      const w = this.w, h = this.h;
      const rad = Math.max(1, S.ripSize | 0);
      this.rainAcc += dt * S.ripRain;
      while (this.rainAcc >= 1) { this.rainAcc--; this.drop(Math.random() * w, Math.random() * h, rad, S.ripAmp); }
      if (S.ripPulse > 0 && blobs.length) {
        this.pulseAcc += dt;
        const period = 1 / S.ripPulse;
        while (this.pulseAcc >= period) {
          this.pulseAcc -= period;
          for (const b of blobs) this.drop(b.cx, b.cy, Math.max(rad, Math.min(10, b.r * 0.25 | 0)), S.ripAmp);
        }
      }
      const steps = Math.min(3, Math.max(1, Math.round(dt * 60)));
      const damp = S.ripDamp;
      for (let s = 0; s < steps; s++) {
        const a = this.rA, b = this.rB;
        for (let y = 1; y < h - 1; y++) {
          let i = y * w + 1;
          for (let x = 1; x < w - 1; x++, i++) {
            b[i] = ((a[i - 1] + a[i + 1] + a[i - w] + a[i + w]) * 0.5 - b[i]) * damp;
          }
        }
        this.rA = b; this.rB = a;
      }
      const hm = this.rA, refr = S.ripRefr * 0.04, light = S.ripLight * 0.6;
      for (let y = 1; y < h - 1; y++) {
        let i = y * w + 1;
        for (let x = 1; x < w - 1; x++, i++) {
          const dx = hm[i - 1] - hm[i + 1], dy = hm[i - w] - hm[i + w];
          if (dx === 0 && dy === 0) continue;
          let sx = (x + dx * refr) | 0, sy = (y + dy * refr) | 0;
          if (sx < 0) sx = 0; else if (sx >= w) sx = w - 1;
          if (sy < 0) sy = 0; else if (sy >= h) sy = h - 1;
          const p = i * 4, q = (sy * w + sx) * 4, sh = (dx + dy) * light;
          out[p] = src[q] + sh; out[p + 1] = src[q + 1] + sh; out[p + 2] = src[q + 2] + sh;
        }
      }
    }

    lake(t, S, out) {
      const w = this.w, h = this.h, tmp = this.tmp;
      tmp.set(out);
      const h0 = Math.round(h * S.lakeY);
      const tint = hex(S.lakeTint), tk = S.lakeTintAmt;
      const span = Math.max(1, h - h0);
      for (let y = h0; y < h; y++) {
        const depth = y - h0, f = depth / span;
        const wave = Math.sin(depth * S.lakeFreq * 0.2 - t * S.lakeSpeed * 4);
        const sy0 = Math.round(h0 - 1 - depth * S.lakeScale + wave * S.lakeAmp * (0.3 + f) * 0.6);
        const sy = Math.max(0, Math.min(h - 1, sy0));
        const xo = Math.round(Math.sin(depth * 0.35 + t * S.lakeSpeed * 3) * S.lakeAmp * f * 0.5);
        for (let x = 0; x < w; x++) {
          const sx = Math.max(0, Math.min(w - 1, x + xo));
          const p = (y * w + x) * 4, q = (sy * w + sx) * 4;
          const k = tk * (0.5 + f * 0.5);
          out[p] = tmp[q] * (1 - k) + tint[0] * k;
          out[p + 1] = tmp[q + 1] * (1 - k) + tint[1] * k;
          out[p + 2] = tmp[q + 2] * (1 - k) + tint[2] * k;
        }
      }
      if (S.lakeLine) {
        const p0 = h0 * w * 4;
        for (let x = 0; x < w; x++) { const p = p0 + x * 4; out[p] = out[p + 1] = out[p + 2] = (x >> 1) % 2 ? 255 : out[p]; }
      }
    }

    palette(t, S, blobs, out) {
      const w = this.w, h = this.h, pal = BT.CYCLE_PALETTES[S.palName] || BT.CYCLE_PALETTES.water;
      const n = pal.length, shift = t * S.palSpeed * n * 0.25, bands = S.palBands, mix = S.palMix;
      const mode = S.palRegion, flow = S.palFlow;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!this.inRegion(mode, i)) continue;
        const p = i * 4;
        const l = (out[p] * 0.299 + out[p + 1] * 0.587 + out[p + 2] * 0.114) / 255;
        let v;
        if (flow === 'y') v = y / h * bands + l * 2;
        else if (flow === 'radial') {
          let md = 1e9;
          for (const b of blobs) { const dx = x - b.cx, dy = y - b.cy, dd = dx * dx + dy * dy; if (dd < md) md = dd; }
          v = (blobs.length ? Math.sqrt(md) / Math.max(w, h) * bands * 4 : l * bands);
        } else v = l * bands;
        const c = pal[(((Math.floor(v * n - shift)) % n) + n) % n];
        out[p] += (c[0] - out[p]) * mix; out[p + 1] += (c[1] - out[p + 1]) * mix; out[p + 2] += (c[2] - out[p + 2]) * mix;
      }
    }

    metaballs(t, S, blobs, out) {
      const w = this.w, h = this.h, cell = Math.max(1, S.mbCell | 0);
      const gw = Math.ceil(w / cell), gh = Math.ceil(h / cell);
      const balls = [];
      for (const b of blobs) {
        const R = Math.max(2, b.r * S.mbSize);
        balls.push([b.cx, b.cy, R]);
        for (let k = 0; k < S.mbSat; k++) {
          const hsh = hash(b.id * 13 + k);
          const ang = t * S.mbSpeed * (0.4 + hsh) * (k % 2 ? -1 : 1) + k * 6.283 / Math.max(1, S.mbSat);
          const dist = R * (1.1 + 0.6 * Math.sin(t * S.mbSpeed * 0.7 + hsh * 9));
          balls.push([b.cx + Math.cos(ang) * dist, b.cy + Math.sin(ang) * dist, R * (0.35 + hsh * 0.25)]);
        }
      }
      for (let k = 0; k < S.mbFree; k++) {
        const a = hash(k + 0.3), b2 = hash(k + 7.1), c = hash(k + 3.7);
        balls.push([
          w * (0.5 + 0.42 * Math.sin(t * S.mbSpeed * (0.2 + a * 0.3) + k)),
          h * (0.5 + 0.42 * Math.cos(t * S.mbSpeed * (0.25 + b2 * 0.3) + k * 2)),
          Math.min(w, h) * (0.04 + c * 0.06) * S.mbSize * 1.6,
        ]);
      }
      if (!balls.length) return;
      const field = new Float32Array(gw * gh);
      for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
        const x = gx * cell + cell / 2, y = gy * cell + cell / 2;
        let f = 0;
        for (let k = 0; k < balls.length; k++) {
          const bl = balls[k], dx = x - bl[0], dy = y - bl[1];
          f += (bl[2] * bl[2]) / (dx * dx + dy * dy + 1);
        }
        field[gy * gw + gx] = f;
      }
      const base = hex(S.mbColor);
      const dark = base.map(v => v * 0.45), mid = base, light = base.map(v => v + (255 - v) * 0.55);
      const cyc = BT.CYCLE_PALETTES[S.palName] || BT.CYCLE_PALETTES.water;
      const thr = S.mbThr, mix = S.mbMix, style = S.mbStyle, B = BAYER4;
      for (let y = 0; y < h; y++) {
        const gy = Math.min(gh - 1, (y / cell) | 0);
        for (let x = 0; x < w; x++) {
          const gx = Math.min(gw - 1, (x / cell) | 0), gi = gy * gw + gx;
          const f = field[gi];
          if (f < thr) continue;
          const edge = (gx > 0 && field[gi - 1] < thr) || (gx < gw - 1 && field[gi + 1] < thr) ||
            (gy > 0 && field[gi - gw] < thr) || (gy < gh - 1 && field[gi + gw] < thr);
          const p = (y * w + x) * 4;
          let c;
          if (edge) c = [0, 0, 0];
          else if (style === 'outline') continue;
          else if (style === 'cycle') c = cyc[((Math.floor(f * 6 - t * S.palSpeed * 8) % cyc.length) + cyc.length) % cyc.length];
          else if (style === 'dither') {
            const k = Math.min(1, (f - thr) / (thr * 1.5)) + B[(y & 3) * 4 + (x & 3)];
            c = k < 0.33 ? dark : k < 0.7 ? mid : light;
            if (f > thr * 3.2) c = [255, 255, 255];
          } else {
            c = f < thr * 1.25 ? dark : f < thr * 2.2 ? mid : f < thr * 3.4 ? light : [255, 255, 255];
          }
          out[p] += (c[0] - out[p]) * mix; out[p + 1] += (c[1] - out[p + 1]) * mix; out[p + 2] += (c[2] - out[p + 2]) * mix;
        }
      }
    }

    dither(S, out) {
      const w = this.w, h = this.h, mode = S.dithRegion;
      const M = S.dithMatrix === 8 || S.dithMatrix === '8' ? BAYER8 : BAYER4, ms = M === BAYER8 ? 8 : 4;
      const spread = S.dithSpread;
      if (S.dithPal === 'duo') {
        const A = hex(S.dithA), Bc = hex(S.dithB);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const i = y * w + x; if (!this.inRegion(mode, i)) continue;
          const p = i * 4, l = (out[p] * 0.299 + out[p + 1] * 0.587 + out[p + 2] * 0.114) / 255;
          const c = l + M[(y % ms) * ms + (x % ms)] * spread / 64 > 0.5 ? Bc : A;
          out[p] = c[0]; out[p + 1] = c[1]; out[p + 2] = c[2];
        }
        return;
      }
      const pal = BT.DITHER_PALETTES[S.dithPal] || BT.DITHER_PALETTES.win16;
      const lut = lutFor(S.dithPal, pal);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x; if (!this.inRegion(mode, i)) continue;
        const p = i * 4, o = M[(y % ms) * ms + (x % ms)] * spread;
        const r = Math.max(0, Math.min(255, out[p] + o)) >> 3, g = Math.max(0, Math.min(255, out[p + 1] + o)) >> 3, b = Math.max(0, Math.min(255, out[p + 2] + o)) >> 3;
        const c = pal[lut[(r << 10) | (g << 5) | b]];
        out[p] = c[0]; out[p + 1] = c[1]; out[p + 2] = c[2];
      }
    }

    spawnBubble(S, blobs) {
      const w = this.w, h = this.h;
      let x, y;
      if (S.bubSource === 'blobs' && blobs.length && this.region) {
        let tot = 0; for (const b of blobs) tot += b.r * b.r;
        let pick = Math.random() * tot, bb = blobs[0];
        for (const b of blobs) { pick -= b.r * b.r; if (pick <= 0) { bb = b; break; } }
        x = bb.cx; y = bb.cy;
        for (let k = 0; k < 8; k++) {
          const tx = bb.minx + Math.random() * (bb.maxx - bb.minx), ty = bb.miny + Math.random() * (bb.maxy - bb.miny);
          const i = (ty | 0) * w + (tx | 0);
          if (this.region[i]) { x = tx; y = ty; break; }
        }
      } else if (S.bubSource === 'bottom') { x = Math.random() * w; y = h + 4; }
      else { x = Math.random() * w; y = Math.random() * h; }
      const r = Math.round(S.bubMin + Math.random() * Math.max(0, S.bubMax - S.bubMin));
      this.bubbles.push({ x, y, x0: x, r, rf: r, ph: Math.random() * 6.28, sp: 0.6 + Math.random() * 0.8, life: 0 });
    }

    bubblesStep(dt, S, blobs, out) {
      const w = this.w, h = this.h;
      this.spawnAcc += dt * S.bubRate;
      while (this.spawnAcc >= 1 && this.bubbles.length < 600) { this.spawnAcc--; this.spawnBubble(S, blobs); }
      const keep = [];
      for (const b of this.bubbles) {
        b.life += dt;
        b.y -= S.bubSpeed * b.sp * dt * 30 * (0.6 + b.r * 0.08);
        b.x = b.x0 + Math.sin(b.life * 3 * b.sp + b.ph) * S.bubWobble * (1 + b.r * 0.15);
        b.rf = Math.min(24, b.rf + dt * S.bubGrow);
        b.r = Math.round(b.rf);
        const dead = b.y < -b.r - 2 || (S.bubPop > 0 && Math.random() < S.bubPop * dt * 0.2);
        if (dead) { if (b.y > 0) this.pops.push({ x: b.x, y: b.y, r: b.r + 1, f: 0 }); }
        else keep.push(b);
      }
      this.bubbles = keep;
      if (S.bubStyle === 'ascii') return;
      const oc = hex(S.bubColor), hi = [255, 255, 255], style = S.bubStyle;
      const put = (x, y, c, a) => {
        if (x < 0 || y < 0 || x >= w || y >= h) return;
        const p = (y * w + x) * 4;
        out[p] += (c[0] - out[p]) * a; out[p + 1] += (c[1] - out[p + 1]) * a; out[p + 2] += (c[2] - out[p + 2]) * a;
      };
      for (const b of this.bubbles) {
        const sp = SPRITES[Math.max(0, Math.min(24, b.r))], bx = b.x | 0, by = b.y | 0;
        if (style === 'filled') for (let k = 0; k < sp.inner.length; k += 2) put(bx + sp.inner[k], by + sp.inner[k + 1], oc, 0.55);
        else if (style === 'classic') for (let k = 0; k < sp.inner.length; k += 2) put(bx + sp.inner[k], by + sp.inner[k + 1], hi, 0.12);
        for (let k = 0; k < sp.ring.length; k += 2) put(bx + sp.ring[k], by + sp.ring[k + 1], oc, 1);
        if (style !== 'ring') for (let k = 0; k < sp.hi.length; k += 2) put(bx + sp.hi[k], by + sp.hi[k + 1], hi, 1);
      }
      const pk = [];
      for (const p of this.pops) {
        p.f += dt * 30;
        if (p.f > 6) continue;
        pk.push(p);
        const rr = p.r + p.f * 0.8;
        for (let a = 0; a < 8; a++) {
          const ang = a * Math.PI / 4;
          put(Math.round(p.x + Math.cos(ang) * rr), Math.round(p.y + Math.sin(ang) * rr), oc, 1);
        }
      }
      this.pops = pk;
    }
  };
})();
