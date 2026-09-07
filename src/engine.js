import {
  ARRIVE_SPREAD,
  BASELINE_1,
  BOND_OFF_BEFORE_HOME,
  BOND_AIR_CELLS,
  BOND_BOW_CELLS,
  BOND_BOW_S,
  BOND_CELL_SCALE,
  BOND_MIN_CELLS,
  BOND_WEIGHT_CELLS,
  BOND_ON_TICK,
  CAP_PIXELS,
  JITTER_CELLS,
  JITTER_EASE_TICKS,
  JITTER_GATE,
  JITTER_S,
  FONT_WEIGHT,
  CAP_H,
  EASE_MOVE,
  EASE_RETURN,
  FPS,
  RED,
  HOLD_TICKS,
  LINES,
  LINE_PITCH,
  MOVE_TICKS,
  POSES,
  POSE_EDGE_MARGIN,
  POSE_MIN_FREE_CELLS,
  RETURN_TICKS,
  SCATTERS_MAX,
  SCATTERS_MIN,
  WHITE,
} from "./params.js";

// Distance from a letter's optical centre to its ink edge along (ux, uy).
function edgeDist(hw, hh, ux, uy) {
  const tx = ux !== 0 ? hw / Math.abs(ux) : Infinity;
  const ty = uy !== 0 ? hh / Math.abs(uy) : Infinity;
  return Math.min(tx, ty);
}

// Fractional read of a sampled table, so the timeline plays continuously.
function sample(table, t) {
  if (t <= 0) return table[0];
  const i = Math.floor(t);
  if (i >= table.length - 1) return table[table.length - 1];
  return table[i] + (table[i + 1] - table[i]) * (t - i);
}

export class BondType {
  constructor(canvas, family = "monospace") {
    this.canvas = canvas;
    this.family = family;
    this.ctx = canvas.getContext("2d");
    this.ok = !!this.ctx;

    this.raf = 0;
    this.t0 = 0;
    this.mounted = 0;
    this.running = false;
    this.dpr = 1;
    this.lastTick = -1;
    this.letters = [];
    this.pairs = [];
    this.seq = [];
    this.cycleTicks = 0;
    this.font = "";
    this.cell = 1;
    this.clock = 0;
    this.laidOut = false;

    if (this.ok) this.resize();
  }

  resize() {
    const c = this.canvas;
    const r = c.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(r.width * this.dpr);
    c.height = Math.round(r.height * this.dpr);
    this.layout();
    this.lastTick = -1;
    if (!this.running) this.renderStill();
  }

  setFont(family) {
    this.family = family;
    this.layout();
    if (this.running) {
      if (this.lastTick >= 0) this.render(this.lastTick);
    } else {
      this.renderStill();
    }
  }

  layout() {
    const ctx = this.ctx;
    if (!ctx) return;
    const H = this.canvas.height;
    const W = this.canvas.width;
    // No box yet: refuse rather than bake a 0px font and a bogus cell.
    if (W < 2 || H < 2) return;
    this.laidOut = true;

    // Size the face by its measured cap height, not by its em box.
    ctx.font = `${FONT_WEIGHT} 100px ${this.family}`;
    const probe = ctx.measureText("H");
    const capAt100 = probe.actualBoundingBoxAscent || 72;
    const size = (CAP_H * H * 100) / capAt100;
    this.font = `${FONT_WEIGHT} ${size}px ${this.family}`;
    ctx.font = this.font;
    this.cell = this.measureCell(size, CAP_H * H) * BOND_CELL_SCALE;

    this.letters = [];
    this.pairs = [];

    LINES.forEach((word, li) => {
      const baseline = (BASELINE_1 + li * LINE_PITCH) * H;
      const total = ctx.measureText(word).width;
      const lineLeft = (W - total) / 2;
      const start = this.letters.length;

      for (let i = 0; i < word.length; i++) {
        const x = lineLeft + ctx.measureText(word.slice(0, i)).width;
        const m = ctx.measureText(word[i]);
        this.letters.push({
          ch: word[i],
          x,
          y: baseline,
          left: -(m.actualBoundingBoxLeft || 0),
          right: m.actualBoundingBoxRight || m.width,
          top: -(m.actualBoundingBoxAscent || size * 0.5),
          bottom: m.actualBoundingBoxDescent || 0,
          px: [],
          py: [],
          line: li,
          slot: i,
        });

        // Bonds only ever connect letters WITHIN a word.
        if (i > 0) this.pairs.push([start + i - 1, start + i]);
      }

      const ls = this.letters.slice(start);
      const cx = (l) => l.x + (l.left + l.right) / 2;
      const typesetCenter = (cx(ls[0]) + cx(ls[ls.length - 1])) / 2;
      const halfInk = (l) => (l.right - l.left) / 2;
      const endHalf = Math.max(halfInk(ls[0]), halfInk(ls[ls.length - 1]));

      POSES.forEach((pose) => {
        const gaps = pose.gaps[li].map((g) => g * H);
        const shift = pose.shift[li] * H;
        const raw = gaps.reduce((a, g) => a + g, 0);

        // Widen until the tightest pair can hold a bond of real length.
        let k = 1;
        for (let i = 0; i < gaps.length; i++) {
          const need =
            POSE_MIN_FREE_CELLS * this.cell + halfInk(ls[i]) + halfInk(ls[i + 1]);
          if (gaps[i] > 0) k = Math.max(k, need / gaps[i]);
        }
        // ...but never so far that a letter approaches the frame edge. A
        // bigger amplitude has to improve the clearance, not spend it.
        const room = W / 2 - POSE_EDGE_MARGIN * W - Math.abs(shift) - endHalf;
        if (raw > 0) k = Math.min(k, (2 * room) / raw);

        const span = raw * k;
        let x = typesetCenter + shift - span / 2;
        ls.forEach((l, i) => {
          if (i > 0) x += gaps[i - 1] * k;
          l.px.push(x - cx(l));
          l.py.push(pose.dy[li][i] * H);
        });
      });
    });
  }

  // Recover the face's own pixel: rasterize caps and take the GCD of the ink
  // runs across a few scanlines. Survives a font swap or a card resize, which
  // a declared constant would not.
  measureCell(fontSize, capPx) {
    const fallback = Math.max(1, Math.round(capPx / CAP_PIXELS));
    try {
      const w = Math.ceil(fontSize * 4);
      const h = Math.ceil(fontSize * 1.6);
      const off = document.createElement("canvas");
      off.width = w;
      off.height = h;
      const o = off.getContext("2d", { willReadFrequently: true });
      if (!o) return fallback;
      o.fillStyle = "#000";
      o.fillRect(0, 0, w, h);
      o.fillStyle = "#fff";
      o.font = `${FONT_WEIGHT} ${fontSize}px ${this.family}`;
      o.textBaseline = "alphabetic";
      o.fillText("HEIL", 4, h * 0.8);
      const runs = [];

      for (const fy of [0.45, 0.55, 0.65]) {
        const y = Math.floor(h * 0.8 - capPx * fy);
        if (y < 0 || y >= h) continue;
        const d = o.getImageData(0, y, w, 1).data;
        let run = 0;
        for (let x = 0; x < w; x++) {
          if (d[x * 4] > 127) run++;
          else {
            if (run > 0) runs.push(run);
            run = 0;
          }
        }
        if (run > 0) runs.push(run);
      }
      if (!runs.length) return fallback;
      const gcd = (a, b) => (b ? gcd(b, a % b) : a);
      let g = runs[0];
      for (const r of runs) g = gcd(g, r);

      return g >= 2 ? g : fallback;
    } catch {
      return fallback;
    }
  }

  // Fresh random sequence and length each time round, never the same pose twice
  // running, so the molecule re-forms differently instead of replaying.
  newCycle() {
    const n =
      SCATTERS_MIN +
      Math.floor(Math.random() * (SCATTERS_MAX - SCATTERS_MIN + 1));
    const seq = [];
    let last = -1;
    for (let k = 0; k < n; k++) {
      let p = Math.floor(Math.random() * POSES.length);
      if (p === last) p = (p + 1) % POSES.length;
      seq.push(p);
      last = p;
    }
    this.seq = seq;
    this.cycleTicks = seq.length * MOVE_TICKS + RETURN_TICKS + HOLD_TICKS;
  }

  arrive(i) {
    const h = Math.sin(i * 12.9898) * 43758.5453;
    return (h - Math.floor(h)) * ARRIVE_SPREAD;
  }

  // One global clock. Every letter reads the same table at the same tick.
  offsetAt(l, i, t) {
    const spread = this.arrive(i);
    const moves = this.seq.length;
    const scatterEnd = moves * MOVE_TICKS;

    if (t < scatterEnd) {
      const k = Math.min(moves - 1, Math.floor(t / MOVE_TICKS));
      const local = t - k * MOVE_TICKS;
      const p = sample(EASE_MOVE, (local / (1 + spread)) * (EASE_MOVE.length - 1) / MOVE_TICKS);
      const from = k === 0 ? [0, 0] : [l.px[this.seq[k - 1]], l.py[this.seq[k - 1]]];
      const to = [l.px[this.seq[k]], l.py[this.seq[k]]];
      return [from[0] + (to[0] - from[0]) * p, from[1] + (to[1] - from[1]) * p];
    }

    const local = t - scatterEnd;
    if (local >= RETURN_TICKS) return [0, 0];
    const p = sample(
      EASE_RETURN,
      (local / (1 + spread)) * (EASE_RETURN.length - 1) / RETURN_TICKS,
    );
    const last = this.seq[moves - 1];
    return [l.px[last] * (1 - p), l.py[last] * (1 - p)];
  }

  // Gate the twitch to the scattered state and cut it the instant the fold
  // home begins: a letter that still steps while settling reads as a stutter.
  unrest(t) {
    const on = BOND_ON_TICK;
    const offAt = this.seq.length * MOVE_TICKS;
    if (t <= on || t >= offAt) return 0;
    const e = Math.min(t - on, offAt - t) / JITTER_EASE_TICKS;
    const u = Math.min(1, Math.max(0, e));
    return u * u * (3 - 2 * u);
  }

  jitter(i, amount) {
    if (JITTER_CELLS <= 0 || amount <= 0) return [0, 0];
    if (amount < 0.5) return [0, 0];
    const w = (Math.PI * 2) / JITTER_S;
    const sy = Math.sin(this.clock * w + i * 2.9);
    if (Math.abs(sy) >= JITTER_GATE) {
      return [0, Math.sign(sy) * JITTER_CELLS * this.cell];
    }
    const sx = Math.sin(this.clock * w * 0.73 + i * 1.7);
    if (Math.abs(sx) >= JITTER_GATE) {
      return [Math.sign(sx) * JITTER_CELLS * this.cell, 0];
    }
    return [0, 0];
  }

  render(t) {
    const ctx = this.ctx;
    if (!ctx || !this.laidOut) return;
    const H = this.canvas.height;
    const W = this.canvas.width;

    ctx.fillStyle = RED;
    ctx.fillRect(0, 0, W, H);
    ctx.font = this.font;
    ctx.fillStyle = WHITE;

    const unrest = this.unrest(t);
    const off = this.letters.map((l, i) => {
      const [ox, oy] = this.offsetAt(l, i, t);
      const [jx, jy] = this.jitter(i, unrest);
      return [ox + jx, oy + jy];
    });
    this.letters.forEach((l, i) => {
      ctx.fillText(l.ch, l.x + off[i][0], l.y + off[i][1]);
    });

    const on = BOND_ON_TICK;
    const offAt =
      this.seq.length * MOVE_TICKS + RETURN_TICKS - BOND_OFF_BEFORE_HOME;
    if (t < on || t > offAt) return;

    // Bonds are computed every frame from wherever the letters currently are:
    // angle, length, birth and death all fall out of the same interpolation.
    const cen = this.letters.map((l, i) => [
      l.x + (l.left + l.right) / 2 + off[i][0],
      l.y + (l.top + l.bottom) / 2 + off[i][1],
    ]);

    ctx.fillStyle = WHITE;
    const cell = this.cell;
    for (const [ia, ib] of this.pairs) {
      const A = this.letters[ia];
      const B = this.letters[ib];
      const dx = cen[ib][0] - cen[ia][0];
      const dy = cen[ib][1] - cen[ia][1];
      const L = Math.hypot(dx, dy);
      if (L < 1) continue;
      const ux = dx / L;
      const uy = dy / L;
      const ea = edgeDist((A.right - A.left) / 2, (A.bottom - A.top) / 2, ux, uy);
      const eb = edgeDist((B.right - B.left) / 2, (B.bottom - B.top) / 2, ux, uy);

      // Count the bond in CELLS, not in pixels of free space: it is born as
      // exactly one square and grows by whole squares, so there is no pop.
      const free = L - ea - eb;
      const air = BOND_AIR_CELLS * cell;
      const usable = free - 2 * air;
      const n = Math.floor(usable / cell);
      if (n < BOND_MIN_CELLS) continue;

      const s0 = ea + air + (usable - n * cell) / 2;

      // Bow off the straight line by a cell, zero at both ends, drifting
      // slowly per bond, so the chain hangs instead of bracing.
      const bow =
        BOND_BOW_CELLS *
        cell *
        Math.sin(this.clock * ((Math.PI * 2) / BOND_BOW_S) + ia * 1.1);

      const nx = -uy;
      const ny = ux;
      for (let k = 0; k < n; k++) {
        const d = s0 + (k + 0.5) * cell;
        const e = n > 1 ? Math.sin((Math.PI * (k + 0.5)) / n) : 0;
        const px = cen[ia][0] + ux * d + nx * bow * e;
        const py = cen[ia][1] + uy * d + ny * bow * e;

        // Snapped to the type's own grid, so a diagonal has to stair-step.
        const w = BOND_WEIGHT_CELLS * cell;
        ctx.fillRect(
          Math.round((px - w / 2) / cell) * cell,
          Math.round((py - w / 2) / cell) * cell,
          w,
          w,
        );
      }
    }
  }

  start() {
    if (this.running || !this.ok || !this.laidOut) return;
    this.running = true;
    this.t0 = performance.now();

    if (!this.mounted) this.mounted = this.t0;
    if (!this.seq.length) this.newCycle();
    const tick = (now) => {
      if (!this.running) return;

      this.clock = (now - this.mounted) / 1000;
      const t = ((now - this.t0) / 1000) * FPS;

      if (t >= this.cycleTicks) {
        this.t0 = now;
        this.newCycle();
        this.lastTick = 0;
        this.render(0);
      } else {
        this.lastTick = t;
        this.render(t);
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  // The name is the composition at rest.
  renderStill() {
    if (!this.laidOut) return;
    if (!this.seq.length) this.newCycle();
    this.render(this.cycleTicks - 1);
  }

  destroy() {
    this.stop();
  }
}
