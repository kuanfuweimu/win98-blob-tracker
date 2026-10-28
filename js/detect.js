/* Blob detection: threshold field -> mask -> morphology -> connected components. */
(function () {
  const BT = window.BT || (window.BT = {});

  function hsv(r, g, b) {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d) {
      if (mx === r) h = ((g - b) / d) % 6;
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    return [h, mx ? d / mx : 0, mx / 255];
  }
  BT.hsv = hsv;

  function hexRgb(hex) {
    const n = parseInt(String(hex).replace('#', ''), 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  BT.hexRgb = hexRgb;

  function boxBlur(src, w, h, r) {
    if (r <= 0) return src;
    const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      let acc = 0; const row = y * w;
      for (let x = -r; x <= r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        tmp[row + x] = acc / (2 * r + 1);
        acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        out[y * w + x] = acc / (2 * r + 1);
        acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
      }
    }
    return out;
  }

  function morph(mask, w, h, dilate) {
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let v = mask[i];
      if (dilate ? !v : v) {
        for (let k = 0; k < 4; k++) {
          const nx = x + (k === 0 ? -1 : k === 1 ? 1 : 0), ny = y + (k === 2 ? -1 : k === 3 ? 1 : 0);
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const nv = mask[ny * w + nx];
          if (dilate && nv) { v = 1; break; }
          if (!dilate && !nv) { v = 0; break; }
        }
      }
      out[i] = v;
    }
    return out;
  }

  BT.detect = function (img, prev, o) {
    const w = img.width, h = img.height, d = img.data, n = w * h;
    let val = new Float32Array(n);
    const tgt = hexRgb(o.color);
    const tgtH = hsv(tgt[0], tgt[1], tgt[2])[0];
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      const r = d[p], g = d[p + 1], b = d[p + 2];
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      switch (o.mode) {
        case 'dark': val[i] = 255 - l; break;
        case 'sat': val[i] = hsv(r, g, b)[1] * 255; break;
        case 'hue': {
          const c = hsv(r, g, b);
          let dh = Math.abs(c[0] - tgtH); if (dh > 180) dh = 360 - dh;
          val[i] = c[1] < 0.15 || c[2] < 0.12 ? 0 : 255 * Math.max(0, 1 - dh / 90);
          break;
        }
        case 'color': {
          const dr = r - tgt[0], dg = g - tgt[1], db = b - tgt[2];
          val[i] = 255 * Math.max(0, 1 - Math.sqrt(dr * dr + dg * dg + db * db) / 255);
          break;
        }
        case 'motion': {
          if (!prev) { val[i] = 0; break; }
          const q = prev.data;
          val[i] = Math.min(255, (Math.abs(r - q[p]) + Math.abs(g - q[p + 1]) + Math.abs(b - q[p + 2])) * 1.2);
          break;
        }
        default: val[i] = l;
      }
    }
    if (o.mode === 'edge') {
      const lum = new Float32Array(n);
      for (let i = 0, p = 0; i < n; i++, p += 4) lum[i] = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
      const src = boxBlur(lum, w, h, 1);
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const gx = src[i - w + 1] + 2 * src[i + 1] + src[i + w + 1] - src[i - w - 1] - 2 * src[i - 1] - src[i + w - 1];
        const gy = src[i + w - 1] + 2 * src[i + w] + src[i + w + 1] - src[i - w - 1] - 2 * src[i - w] - src[i - w + 1];
        val[i] = Math.min(255, Math.sqrt(gx * gx + gy * gy));
      }
    }
    val = boxBlur(val, w, h, o.blur | 0);

    let mask = new Uint8Array(n);
    for (let i = 0; i < n; i++) mask[i] = (val[i] >= o.threshold) !== !!o.invert ? 1 : 0;
    const m = o.morph | 0;
    for (let k = 0; k < Math.abs(m); k++) mask = morph(mask, w, h, m > 0);
    for (let k = 0; k < Math.abs(m); k++) mask = morph(mask, w, h, m < 0);

    const labels = new Int32Array(n);
    const comps = [];
    const stack = new Int32Array(n);
    const conn8 = o.conn8 !== false;
    let next = 0;
    for (let s = 0; s < n; s++) {
      if (!mask[s] || labels[s]) continue;
      next++;
      const c = { label: next, minx: w, miny: h, maxx: 0, maxy: 0, area: 0, sx: 0, sy: 0, r: 0, g: 0, b: 0, border: false };
      let sp = 0; stack[sp++] = s; labels[s] = next;
      while (sp) {
        const i = stack[--sp], x = i % w, y = (i / w) | 0;
        c.area++; c.sx += x; c.sy += y;
        c.r += d[i * 4]; c.g += d[i * 4 + 1]; c.b += d[i * 4 + 2];
        if (x < c.minx) c.minx = x; if (x > c.maxx) c.maxx = x;
        if (y < c.miny) c.miny = y; if (y > c.maxy) c.maxy = y;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) c.border = true;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          if (!conn8 && dx && dy) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          if (mask[j] && !labels[j]) { labels[j] = next; stack[sp++] = j; }
        }
      }
      comps.push(c);
    }

    const minA = (o.minArea / 100) * n, maxA = (o.maxArea / 100) * n;
    let blobs = comps.filter(c => c.area >= minA && c.area <= maxA && !(o.noBorder && c.border));
    blobs.forEach(c => {
      c.cx = c.sx / c.area; c.cy = c.sy / c.area;
      c.r = Math.round(c.r / c.area); c.g = Math.round(c.g / c.area); c.b = Math.round(c.b / c.area);
      c.luma = Math.round(0.299 * c.r + 0.587 * c.g + 0.114 * c.b);
    });
    const sorters = {
      area: (a, b) => b.area - a.area,
      x: (a, b) => a.cx - b.cx,
      y: (a, b) => a.cy - b.cy,
      luma: (a, b) => b.luma - a.luma,
    };
    blobs.sort(sorters.area);
    blobs = blobs.slice(0, o.maxBlobs | 0);
    blobs.sort(sorters[o.sort] || sorters.area);
    const keep = new Int32Array(next + 1);
    blobs.forEach((b, i) => { keep[b.label] = i + 1; b.id = i + 1; });
    return { w, h, labels, keep, mask, val, blobs, total: comps.length };
  };

  /* Nearest-centroid tracker for video: keeps ids stable and smooths boxes. */
  BT.Tracker = class {
    constructor() { this.tracks = []; this.nextId = 1; }
    reset() { this.tracks = []; this.nextId = 1; }
    update(blobs, maxDist, smooth) {
      const used = new Set(), out = [];
      const old = this.tracks;
      for (const b of blobs) {
        let best = null, bd = maxDist * maxDist;
        for (const t of old) {
          if (used.has(t)) continue;
          const dx = t.cx - b.cx, dy = t.cy - b.cy, dd = dx * dx + dy * dy;
          if (dd < bd) { bd = dd; best = t; }
        }
        const k = best ? smooth : 0;
        const nb = Object.assign({}, b);
        if (best) {
          used.add(best);
          for (const key of ['cx', 'cy', 'minx', 'miny', 'maxx', 'maxy']) nb[key] = best[key] * k + b[key] * (1 - k);
          nb.id = best.id; nb.age = best.age + 1;
        } else { nb.id = this.nextId++; nb.age = 0; }
        out.push(nb);
      }
      this.tracks = out;
      return out;
    }
  };
})();
