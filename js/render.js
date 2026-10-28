/* Overlay: tracking boxes, labels, connections. Everything is drawn on a virtual pixel grid
   (size u = overlay scale) with fillRect so edges stay hard like a Win98 screen. */
(function () {
  const BT = window.BT || (window.BT = {});
  const C = { face: '#c0c0c0', hl: '#ffffff', light: '#dfdfdf', shadow: '#808080', dark: '#0a0a0a', navy: '#000080', navy2: '#1084d0', tip: '#ffffe1' };
  BT.W98 = C;

  function R(ctx, x, y, w, h, c) { if (w <= 0 || h <= 0) return; ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }

  function bevel(ctx, x, y, w, h, u, raised) {
    const [o1, o2, i1, i2] = raised ? [C.hl, C.dark, C.light, C.shadow] : [C.shadow, C.hl, C.dark, C.light];
    R(ctx, x, y, w, u, o1); R(ctx, x, y, u, h, o1);
    R(ctx, x, y + h - u, w, u, o2); R(ctx, x + w - u, y, u, h, o2);
    R(ctx, x + u, y + u, w - 2 * u, u, i1); R(ctx, x + u, y + u, u, h - 2 * u, i1);
    R(ctx, x + u, y + h - 2 * u, w - 2 * u, u, i2); R(ctx, x + w - 2 * u, y + u, u, h - 2 * u, i2);
  }
  BT.bevel = bevel;

  function rectLine(ctx, x, y, w, h, t, c) { R(ctx, x, y, w, t, c); R(ctx, x, y + h - t, w, t, c); R(ctx, x, y, t, h, c); R(ctx, x + w - t, y, t, h, c); }

  function dottedRect(ctx, x, y, w, h, u, c, phase) {
    ctx.fillStyle = c;
    const cw = Math.max(1, Math.round(w / u)), ch = Math.max(1, Math.round(h / u));
    const per = 2 * (cw + ch);
    for (let k = 0; k < per; k++) {
      if ((k + phase) % 2) continue;
      let gx, gy;
      if (k < cw) { gx = k; gy = 0; }
      else if (k < cw + ch) { gx = cw - 1; gy = k - cw; }
      else if (k < 2 * cw + ch) { gx = cw - 1 - (k - cw - ch); gy = ch - 1; }
      else { gx = 0; gy = ch - 1 - (k - 2 * cw - ch); }
      ctx.fillRect(Math.round(x + gx * u), Math.round(y + gy * u), u, u);
    }
  }

  /* ---------- text templates ---------- */
  function pick(chars, seed) { if (!chars.length) return ''; return chars[Math.floor(BT.hash(seed) * chars.length) % chars.length]; }
  function pad(v, n) { const s = String(v); return n ? s.padStart(n, '0') : s; }
  BT.formatTemplate = function (tpl, b, env) {
    const chars = Array.from(env.charset || '');
    const tick = env.scramble ? Math.floor(env.t * env.scrambleSpeed) : 0;
    const words = (env.labels || '').split(',').map(s => s.trim()).filter(Boolean);
    return tpl.replace(/\\n/g, '\n').replace(/\{(\w+)(?::([^}]*))?\}/g, (m, k, arg) => {
      const n = parseInt(arg, 10) || 0;
      const hx = '#' + [b.r, b.g, b.b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
      switch (k) {
        case 'id': return pad(b.id, n);
        case 'n': return String(env.count);
        case 'x': return pad(Math.round(b.sx0), n);
        case 'y': return pad(Math.round(b.sy0), n);
        case 'w': return pad(Math.round(b.sw), n);
        case 'h': return pad(Math.round(b.sh), n);
        case 'cx': return pad(Math.round(b.scx), n);
        case 'cy': return pad(Math.round(b.scy), n);
        case 'area': return pad(Math.round(b.sarea), n);
        case 'pct': return (b.pct).toFixed(n || 1);
        case 'hex': return hx;
        case 'r': return String(b.r);
        case 'g': return String(b.g);
        case 'b': return String(b.b);
        case 'luma': return String(b.luma);
        case 'conf': return (0.62 + BT.hash(b.id * 3.1 + tick * 0.17) * 0.37).toFixed(n || 2);
        case 'label': return words.length ? words[(b.id - 1) % words.length] : 'BLOB';
        case 'char': return pick(chars, b.id * 7.7 + tick * 1.3);
        case 'chars': { let s = ''; for (let i = 0; i < (n || 6); i++) s += pick(chars, b.id * 31.3 + i * 5.1 + tick * 0.71); return s; }
        case 'bar': {
          const len = n || 8, f = Math.min(1, b.pct / 10 + 0.1);
          const on = Math.round(len * f);
          return '█'.repeat(on) + '░'.repeat(len - on);
        }
        case 't': {
          const s = env.t; const hh = Math.floor(s / 3600), mm = Math.floor(s / 60) % 60, ss = Math.floor(s) % 60, ff = Math.floor((s % 1) * 100);
          return [hh, mm, ss].map(v => String(v).padStart(2, '0')).join(':') + '.' + String(ff).padStart(2, '0');
        }
        case 'frame': return pad(env.frame, n);
        default: return m;
      }
    });
  };

  /* ---------- lines ---------- */
  function shapePoints(a, b, S, idx, u) {
    const pts = [];
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const sign = S.lnAlt && idx % 2 ? -1 : 1;
    const seg = Math.max(8, Math.ceil(len / (4 * u)));
    switch (S.lnShape) {
      case 'curve': {
        const bend = S.lnBend * len * sign;
        const cx = (a[0] + b[0]) / 2 + nx * bend, cy = (a[1] + b[1]) / 2 + ny * bend;
        for (let i = 0; i <= seg; i++) { const t = i / seg, m = 1 - t; pts.push([m * m * a[0] + 2 * m * t * cx + t * t * b[0], m * m * a[1] + 2 * m * t * cy + t * t * b[1]]); }
        break;
      }
      case 'scurve': {
        const k = Math.max(Math.abs(dx), 20 * u) * (0.3 + S.lnBend);
        const c1 = [a[0] + k * Math.sign(dx || 1), a[1]], c2 = [b[0] - k * Math.sign(dx || 1), b[1]];
        for (let i = 0; i <= seg; i++) {
          const t = i / seg, m = 1 - t;
          pts.push([m * m * m * a[0] + 3 * m * m * t * c1[0] + 3 * m * t * t * c2[0] + t * t * t * b[0],
            m * m * m * a[1] + 3 * m * m * t * c1[1] + 3 * m * t * t * c2[1] + t * t * t * b[1]]);
        }
        break;
      }
      case 'elbow': {
        const mx = sign > 0 ? b[0] : a[0], my = sign > 0 ? a[1] : b[1];
        pts.push(a, [mx, my], b);
        break;
      }
      case 'wave': {
        const amp = S.lnBend * 40 * u, waves = Math.max(1, Math.round(len / (60 * u)));
        for (let i = 0; i <= seg * 2; i++) {
          const t = i / (seg * 2), s = Math.sin(t * Math.PI * 2 * waves) * amp * sign;
          pts.push([a[0] + dx * t + nx * s, a[1] + dy * t + ny * s]);
        }
        break;
      }
      default: pts.push(a, b);
    }
    return pts;
  }

  function dashOn(S, k, flow) {
    if (S.lnDash === 'solid') return true;
    const p = S.lnDash === 'dot' ? [1, 1] : [S.lnDashLen, Math.max(1, S.lnDashLen * 0.6 | 0)];
    const per = p[0] + p[1];
    return ((k + flow) % per + per) % per < p[0];
  }

  function drawPoly(ctx, pts, S, u, flow) {
    const lw = Math.max(1, S.lnWidth) * u;
    ctx.fillStyle = S.lnColor;
    if (!S.lnPixel) {
      ctx.save();
      ctx.strokeStyle = S.lnColor; ctx.lineWidth = lw; ctx.lineCap = 'square'; ctx.lineJoin = 'miter';
      if (S.lnDash === 'dot') ctx.setLineDash([lw, lw]);
      else if (S.lnDash === 'dash') ctx.setLineDash([S.lnDashLen * u, S.lnDashLen * 0.6 * u]);
      ctx.lineDashOffset = -flow * u;
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke(); ctx.restore();
      return;
    }
    let k = 0, last = null;
    const half = Math.floor(Math.max(1, S.lnWidth) / 2);
    for (let i = 0; i < pts.length - 1; i++) {
      let x0 = Math.round(pts[i][0] / u), y0 = Math.round(pts[i][1] / u);
      const x1 = Math.round(pts[i + 1][0] / u), y1 = Math.round(pts[i + 1][1] / u);
      const ddx = Math.abs(x1 - x0), ddy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = ddx + ddy;
      for (;;) {
        if (!last || last[0] !== x0 || last[1] !== y0) {
          if (dashOn(S, k, Math.floor(flow))) ctx.fillRect((x0 - half) * u, (y0 - half) * u, lw, lw);
          k++; last = [x0, y0];
        }
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= ddy) { err += ddy; x0 += sx; }
        if (e2 <= ddx) { err += ddx; y0 += sy; }
      }
    }
  }

  function pointAt(pts, f) {
    let tot = 0; const seg = [];
    for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); seg.push(l); tot += l; }
    let d = f * tot;
    for (let i = 0; i < seg.length; i++) {
      if (d <= seg[i] || i === seg.length - 1) { const t = seg[i] ? d / seg[i] : 0; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t, pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]]; }
      d -= seg[i];
    }
    return [pts[0][0], pts[0][1], 1, 0];
  }

  function marker(ctx, x, y, dirx, diry, S, u) {
    const s = (S.lnWidth + 2) * u;
    ctx.fillStyle = S.lnColor;
    if (S.lnEnd === 'square') { R(ctx, x - s, y - s, s * 2, s * 2, S.lnColor); R(ctx, x - s + u, y - s + u, s * 2 - 2 * u, s * 2 - 2 * u, '#fff'); }
    else if (S.lnEnd === 'dot') R(ctx, x - s * 0.6, y - s * 0.6, s * 1.2, s * 1.2, S.lnColor);
    else if (S.lnEnd === 'arrow') {
      const len = Math.hypot(dirx, diry) || 1, ux = dirx / len, uy = diry / len;
      for (let k = 0; k < 5; k++) {
        const bx = x - ux * k * u * 1.5, by = y - uy * k * u * 1.5;
        for (let j = -k; j <= k; j++) R(ctx, bx - uy * j * u - u / 2, by + ux * j * u - u / 2, u, u, S.lnColor);
      }
    }
  }

  function buildEdges(nodes, S) {
    const n = nodes.length, E = [];
    if (n < 2) return E;
    const d = (i, j) => Math.hypot(nodes[i].cx - nodes[j].cx, nodes[i].cy - nodes[j].cy);
    const seen = new Set();
    const add = (i, j) => { const k = i < j ? i + '-' + j : j + '-' + i; if (i !== j && !seen.has(k)) { seen.add(k); E.push([i, j]); } };
    switch (S.lnMode) {
      case 'chain': for (let i = 0; i < n - 1; i++) add(i, i + 1); if (S.lnLoop) add(n - 1, 0); break;
      case 'star': for (let i = 1; i < n; i++) add(0, i); break;
      case 'nearest':
        for (let i = 0; i < n; i++) {
          const o = [...Array(n).keys()].filter(j => j !== i).sort((a, b) => d(i, a) - d(i, b));
          o.slice(0, S.lnK).forEach(j => add(i, j));
        }
        break;
      case 'radius': {
        const lim = S.lnRadius * S._diag / 100;
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (d(i, j) <= lim) add(i, j);
        break;
      }
      case 'all': for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) add(i, j); break;
      default: {
        const inT = new Array(n).fill(false), best = new Array(n).fill(Infinity), par = new Array(n).fill(-1);
        best[0] = 0;
        for (let it = 0; it < n; it++) {
          let u = -1;
          for (let i = 0; i < n; i++) if (!inT[i] && (u < 0 || best[i] < best[u])) u = i;
          inT[u] = true; if (par[u] >= 0) add(par[u], u);
          for (let v = 0; v < n; v++) if (!inT[v]) { const dd = d(u, v); if (dd < best[v]) { best[v] = dd; par[v] = u; } }
        }
      }
    }
    return E;
  }

  function anchor(nd, toward, S) {
    if (S.lnAnchor !== 'edge') return [nd.cx, nd.cy];
    const dx = toward.cx - nd.cx, dy = toward.cy - nd.cy;
    const hw = nd.w / 2, hh = nd.h / 2;
    const k = Math.min(Math.abs(dx) ? hw / Math.abs(dx) : 1e9, Math.abs(dy) ? hh / Math.abs(dy) : 1e9, 1);
    return [nd.cx + dx * k, nd.cy + dy * k];
  }

  /* ---------- labels ---------- */
  function measure(ctx, lines) { let m = 0; for (const l of lines) m = Math.max(m, ctx.measureText(l).width); return m; }

  function drawLabel(ctx, lines, x, y, S, u, fs, kind) {
    if (!lines.length || (lines.length === 1 && !lines[0])) return { w: 0, h: 0 };
    const lh = Math.round(fs * 1.25), padX = 3 * u, padY = 2 * u;
    const tw = Math.ceil(measure(ctx, lines)), w = tw + padX * 2, h = lh * lines.length + padY * 2;
    const bg = kind || S.lbBg;
    let fg = S.lbColor;
    if (bg === 'face') { R(ctx, x, y, w, h, C.face); bevel(ctx, x, y, w, h, u, true); fg = '#000'; }
    else if (bg === 'sunken') { R(ctx, x, y, w, h, '#fff'); bevel(ctx, x, y, w, h, u, false); fg = '#000'; }
    else if (bg === 'tip') { R(ctx, x, y, w, h, C.tip); rectLine(ctx, x, y, w, h, u, '#000'); fg = '#000'; }
    else if (bg === 'navy') { R(ctx, x, y, w, h, C.navy); fg = '#fff'; }
    else if (bg === 'solid') { R(ctx, x, y, w, h, S.lbBgColor); }
    else if (bg === 'shadow') { ctx.fillStyle = '#000'; for (const [i, l] of lines.entries()) ctx.fillText(l, x + padX + u, y + padY + i * lh + u); }
    ctx.fillStyle = fg;
    lines.forEach((l, i) => ctx.fillText(l, Math.round(x + padX), Math.round(y + padY + i * lh)));
    return { w, h };
  }

  function sizeLabel(ctx, lines, u, fs) {
    if (!lines.length || (lines.length === 1 && !lines[0])) return { w: 0, h: 0 };
    return { w: Math.ceil(measure(ctx, lines)) + 6 * u, h: Math.round(fs * 1.25) * lines.length + 4 * u };
  }

  /* ---------- fills ---------- */
  function fillBox(ctx, x, y, w, h, S, u, src, env) {
    const mode = S.bxFill;
    if (mode === 'none' || w < 2 || h < 2) return;
    if (mode === 'tint') { ctx.globalAlpha = S.bxFillAlpha; R(ctx, x, y, w, h, S.bxFillColor); ctx.globalAlpha = 1; return; }
    if (mode === 'checker') {
      ctx.fillStyle = S.bxFillColor;
      for (let gy = 0; gy < h / u; gy++) for (let gx = (gy & 1); gx < w / u; gx += 2) ctx.fillRect(x + gx * u, y + gy * u, u, u);
      return;
    }
    if (mode === 'invert') {
      ctx.save(); ctx.globalCompositeOperation = 'difference'; R(ctx, x, y, w, h, '#fff'); ctx.restore(); return;
    }
    if (mode === 'scan') {
      ctx.globalAlpha = S.bxFillAlpha;
      for (let yy = 0; yy < h; yy += 2 * u) R(ctx, x, y + yy, w, u, S.bxFillColor);
      ctx.globalAlpha = 1; return;
    }
    if (mode === 'ascii' && src) {
      const chars = Array.from(S.charset || ' .:-=+*#%@');
      if (!chars.length) return;
      const cs = Math.max(4, S.asciiCell) * u;
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      ctx.font = `${cs}px ${S.font}`; ctx.textBaseline = 'top';
      if (S.asciiBg) { ctx.globalAlpha = S.bxFillAlpha; R(ctx, x, y, w, h, S.asciiBgColor); ctx.globalAlpha = 1; }
      const sw = src.width, sh = src.height, d = src.data;
      for (let yy = y; yy < y + h; yy += cs) for (let xx = x; xx < x + w; xx += cs * 0.62) {
        const px = Math.min(sw - 1, Math.max(0, Math.round(xx + cs * 0.3))), py = Math.min(sh - 1, Math.max(0, Math.round(yy + cs / 2)));
        const p = (py * sw + px) * 4;
        let l = (d[p] * 0.299 + d[p + 1] * 0.587 + d[p + 2] * 0.114) / 255;
        if (S.asciiInvert) l = 1 - l;
        let idx = Math.min(chars.length - 1, Math.floor(l * chars.length));
        if (env.scramble && Math.random() < 0.04) idx = Math.floor(Math.random() * chars.length);
        ctx.fillStyle = S.asciiColorMode === 'src' ? `rgb(${d[p]},${d[p + 1]},${d[p + 2]})` : S.asciiColor;
        ctx.fillText(chars[idx], Math.round(xx), Math.round(yy));
      }
      ctx.restore();
    }
  }

  /* ---------- box frames ---------- */
  function frame(ctx, x, y, w, h, S, u, t, b, env) {
    const c = S.bxColor, lw = Math.max(1, S.bxWidth) * u;
    switch (S.bxStyle) {
      case 'raised': bevel(ctx, x - 2 * u, y - 2 * u, w + 4 * u, h + 4 * u, u, true); break;
      case 'sunken': bevel(ctx, x - 2 * u, y - 2 * u, w + 4 * u, h + 4 * u, u, false); break;
      case 'focus': dottedRect(ctx, x, y, w, h, u * Math.max(1, S.bxWidth), c, S.bxAnim ? Math.floor(t * 8) % 2 : 0); break;
      case 'corners': {
        const k = Math.max(4 * u, Math.min(w, h) * S.bxCorner);
        R(ctx, x, y, k, lw, c); R(ctx, x, y, lw, k, c);
        R(ctx, x + w - k, y, k, lw, c); R(ctx, x + w - lw, y, lw, k, c);
        R(ctx, x, y + h - lw, k, lw, c); R(ctx, x, y + h - k, lw, k, c);
        R(ctx, x + w - k, y + h - lw, k, lw, c); R(ctx, x + w - lw, y + h - k, lw, k, c);
        break;
      }
      case 'cross': {
        rectLine(ctx, x, y, w, h, lw, c);
        const cx = x + w / 2, cy = y + h / 2, arm = Math.max(6 * u, Math.min(w, h) * 0.18);
        R(ctx, cx - lw / 2, y - arm, lw, arm * 2, c); R(ctx, cx - lw / 2, y + h - arm, lw, arm * 2, c);
        R(ctx, x - arm, cy - lw / 2, arm * 2, lw, c); R(ctx, x + w - arm, cy - lw / 2, arm * 2, lw, c);
        R(ctx, cx - 2 * u, cy - 2 * u, 4 * u, 4 * u, c);
        break;
      }
      case 'window': {
        const tb = Math.round(S.fontSize * 1.25 * u) + 4 * u;
        const fx = x - 4 * u, fy = y - tb - 6 * u, fw = w + 8 * u, fh = h + tb + 10 * u;
        R(ctx, fx, fy, fw, 4 * u + tb + 2 * u, C.face);
        R(ctx, fx, fy, 4 * u, fh, C.face); R(ctx, fx + fw - 4 * u, fy, 4 * u, fh, C.face); R(ctx, fx, fy + fh - 4 * u, fw, 4 * u, C.face);
        bevel(ctx, fx, fy, fw, fh, u, true);
        const g = ctx.createLinearGradient(fx, 0, fx + fw, 0);
        g.addColorStop(0, S.bxTitleA); g.addColorStop(1, S.bxTitleB);
        ctx.fillStyle = g; ctx.fillRect(fx + 3 * u, fy + 3 * u, fw - 6 * u, tb);
        bevel(ctx, x - u, y - u, w + 2 * u, h + 2 * u, u, false);
        const bs = tb - 4 * u;
        if (fw > bs * 3 + 30 * u) {
          const bx = fx + fw - 3 * u - 2 * u - bs, by = fy + 3 * u + 2 * u;
          R(ctx, bx, by, bs + 2 * u, bs - u, C.face); bevel(ctx, bx, by, bs + 2 * u, bs - u, u, true);
          ctx.fillStyle = '#000';
          const xs = Math.max(2, Math.floor(bs / u / 2) - 1);
          for (let k = 0; k < xs * 2 - 1; k++) {
            ctx.fillRect(bx + (bs + 2 * u) / 2 - xs * u + k * u, by + (bs - u) / 2 - xs * u + k * u, 2 * u, u);
            ctx.fillRect(bx + (bs + 2 * u) / 2 - xs * u + k * u, by + (bs - u) / 2 + xs * u - (k + 1) * u, 2 * u, u);
          }
        }
        const title = BT.formatTemplate(S.titleTpl, b, env);
        ctx.save(); ctx.beginPath(); ctx.rect(fx + 4 * u, fy, fw - bs - 12 * u, tb + 6 * u); ctx.clip();
        ctx.font = `bold ${S.fontSize * u}px ${S.font}`; ctx.fillStyle = '#fff';
        if (S.bxIcon) {
          const s = Math.round(tb * 0.6 / u) * u, ix = fx + 5 * u, iy = fy + 3 * u + (tb - s) / 2;
          R(ctx, ix, iy, s, s, '#fff'); R(ctx, ix + u, iy + u, s - 2 * u, s - 2 * u, S.bxTitleA);
          R(ctx, ix + 2 * u, iy + 2 * u, s - 4 * u, Math.max(u, s / 4), '#ff0');
          ctx.fillStyle = '#fff';
          ctx.fillText(title, fx + 5 * u + s + 3 * u, fy + 3 * u + 2 * u);
        } else ctx.fillText(title, fx + 6 * u, fy + 3 * u + 2 * u);
        ctx.restore();
        break;
      }
      case 'xor': ctx.save(); ctx.globalCompositeOperation = 'difference'; rectLine(ctx, x, y, w, h, lw, '#fff'); ctx.restore(); break;
      case 'double': rectLine(ctx, x, y, w, h, lw, c); rectLine(ctx, x + 2 * lw, y + 2 * lw, w - 4 * lw, h - 4 * lw, lw, c); break;
      default: rectLine(ctx, x, y, w, h, lw, c);
    }
  }

  function contour(ctx, det, kx, ky, color, alpha, pixelFill) {
    const { w, h, labels, keep } = det;
    ctx.fillStyle = color;
    const cw = Math.ceil(kx), ch = Math.ceil(ky);
    ctx.globalAlpha = alpha;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, k = keep[labels[i]];
      if (!k) continue;
      if (pixelFill) { if ((x + y) & 1) ctx.fillRect(Math.floor(x * kx), Math.floor(y * ky), cw, ch); continue; }
      const e = x === 0 || y === 0 || x === w - 1 || y === h - 1 || keep[labels[i - 1]] !== k || keep[labels[i + 1]] !== k || keep[labels[i - w]] !== k || keep[labels[i + w]] !== k;
      if (e) ctx.fillRect(Math.floor(x * kx), Math.floor(y * ky), cw, ch);
    }
    ctx.globalAlpha = 1;
  }

  BT.drawOverlay = function (ctx, W, H, det, S, env) {
    if (!det) return;
    const u = env.u, kx = W / det.w, ky = H / det.h;
    const sxs = env.srcW / det.w, sys = env.srcH / det.h;
    S._diag = Math.hypot(W, H);
    if (S.showMask) contour(ctx, det, kx, ky, S.maskColor, 0.55, true);
    if (S.showContour) contour(ctx, det, kx, ky, S.contourColor, 1, false);
    const jit = S.jitter * u;
    const nodes = det.blobs.map(b => {
      const jx = jit ? (BT.hash(b.id + Math.floor(env.t * 12) * 0.37) - 0.5) * 2 * jit : 0;
      const jy = jit ? (BT.hash(b.id * 2.3 + Math.floor(env.t * 12) * 0.61) - 0.5) * 2 * jit : 0;
      const pad = S.bxPad * u;
      const x = Math.round((b.minx * kx - pad + jx) / u) * u, y = Math.round((b.miny * ky - pad + jy) / u) * u;
      const x2 = Math.round(((b.maxx + 1) * kx + pad + jx) / u) * u, y2 = Math.round(((b.maxy + 1) * ky + pad + jy) / u) * u;
      return Object.assign({}, b, {
        x, y, w: Math.max(2 * u, x2 - x), h: Math.max(2 * u, y2 - y),
        cx: b.cx * kx + kx / 2 + jx, cy: b.cy * ky + ky / 2 + jy,
        sx0: b.minx * sxs, sy0: b.miny * sys, sw: (b.maxx - b.minx + 1) * sxs, sh: (b.maxy - b.miny + 1) * sys,
        scx: b.cx * sxs, scy: b.cy * sys, sarea: b.area * sxs * sys, pct: b.area / (det.w * det.h) * 100,
      });
    });
    ctx.textBaseline = 'top';

    if (S.lnOn && nodes.length > 1) {
      const lim = S.lnMode === 'all' ? Math.min(nodes.length, 30) : nodes.length;
      const ns = nodes.slice(0, lim);
      const E = buildEdges(ns, S);
      const flow = S.lnAnim ? env.t * S.lnFlow * 8 : 0;
      ctx.font = `${S.fontSize * u}px ${S.font}`;
      E.forEach(([i, j], idx) => {
        const a = anchor(ns[i], ns[j], S), b = anchor(ns[j], ns[i], S);
        const pts = shapePoints(a, b, S, idx, u);
        drawPoly(ctx, pts, S, u, flow);
        if (S.lnEnd !== 'none') {
          const e = pointAt(pts, 1), s0 = pointAt(pts, 0);
          marker(ctx, b[0], b[1], e[2], e[3], S, u);
          if (S.lnEnd !== 'arrow') marker(ctx, a[0], a[1], -s0[2], -s0[3], S, u);
        }
        if (S.lnPacket) {
          const f = ((env.t * S.lnFlow * 0.25 + BT.hash(idx)) % 1);
          const p = pointAt(pts, f), s = (S.lnWidth + 2) * u;
          R(ctx, p[0] - s, p[1] - s, s * 2, s * 2, S.lnPacketColor);
        }
        if (S.lnLabel !== 'none') {
          const m = pointAt(pts, 0.5);
          const txt = S.lnLabel === 'dist'
            ? String(Math.round(Math.hypot(ns[i].scx - ns[j].scx, ns[i].scy - ns[j].scy))) + 'px'
            : S.lnLabel === 'ids' ? `${ns[i].id}→${ns[j].id}` : BT.formatTemplate(S.lnLabelTpl, ns[j], env);
          drawLabel(ctx, txt.split('\n'), m[0] + 3 * u, m[1] + 3 * u, S, u, S.fontSize * u, 'tip');
        }
      });
    }

    if (S.bxOn) {
      for (const nd of nodes) {
        fillBox(ctx, nd.x, nd.y, nd.w, nd.h, S, u, env.srcData, env);
        frame(ctx, nd.x, nd.y, nd.w, nd.h, S, u, env.t, nd, env);
      }
    }

    if (S.lbOn) {
      ctx.font = `${S.fontSize * u}px ${S.font}`;
      for (const nd of nodes) {
        const lines = BT.formatTemplate(S.textTpl, nd, env).split('\n');
        const sz = sizeLabel(ctx, lines, u, S.fontSize * u);
        const g = 2 * u, winTop = S.bxOn && S.bxStyle === 'window' ? Math.round(S.fontSize * 1.25 * u) + 10 * u : 0;
        let lx = nd.x, ly = nd.y;
        switch (S.lbPos) {
          case 'top': ly = nd.y - sz.h - g - winTop; break;
          case 'inside': lx = nd.x + 3 * u; ly = nd.y + 3 * u; break;
          case 'bottom': ly = nd.y + nd.h + g + (winTop ? 4 * u : 0); break;
          case 'right': lx = nd.x + nd.w + g + (winTop ? 4 * u : 0); ly = nd.y; break;
          case 'center': lx = nd.cx - sz.w / 2; ly = nd.cy - sz.h / 2; break;
        }
        lx = Math.round(Math.max(0, Math.min(W - sz.w, lx)) / u) * u;
        ly = Math.round(Math.max(0, Math.min(H - sz.h, ly)) / u) * u;
        if (S.lbLeader && (S.lbPos === 'right' || S.lbPos === 'bottom')) R(ctx, Math.min(nd.x + nd.w, lx), ly + u * 4, Math.abs(lx - (nd.x + nd.w)), u, S.bxColor);
        drawLabel(ctx, lines, lx, ly, S, u, S.fontSize * u);
      }
    }

    if (S.bubOn && S.bubStyle === 'ascii' && env.fx) {
      const chars = Array.from(S.bubChars || 'o0O°');
      const fk = W / env.fx.w;
      ctx.fillStyle = S.bubColor;
      for (const b of env.fx.bubbles) {
        const ch = chars[Math.min(chars.length - 1, Math.floor(b.r / Math.max(1, S.bubMax) * chars.length))];
        ctx.font = `${Math.max(8, (b.r * 2 + 4) * fk)}px ${S.font}`;
        ctx.fillText(ch, b.x * fk, b.y * fk);
      }
    }

    if (S.hud) {
      ctx.font = `${S.fontSize * u}px ${S.font}`;
      const lines = BT.formatTemplate(S.hudTpl, nodes[0] || { id: 0, r: 0, g: 0, b: 0, luma: 0, sx0: 0, sy0: 0, sw: 0, sh: 0, scx: 0, scy: 0, sarea: 0, pct: 0 }, env).split('\n');
      drawLabel(ctx, lines, 6 * u, 6 * u, S, u, S.fontSize * u, 'face');
    }
  };
})();
