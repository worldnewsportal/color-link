/**
 * particles.js - tiny lightweight particle system for success feedback.
 */

export class Particles {
  constructor(max = 220) {
    this.items = [];
    this.max = max;
  }

  burst(x, y, count = 26, colors = ['#7c5cff', '#25c8d8', '#ffc93c', '#ff6fb5']) {
    for (let i = 0; i < count; i++) {
      if (this.items.length >= this.max) break;
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const sp = 90 + Math.random() * 190;
      this.items.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        life: 0.55 + Math.random() * 0.5,
        age: 0,
        size: 3 + Math.random() * 5,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 8,
        color: colors[i % colors.length],
      });
    }
  }

  update(dt) {
    const d = Math.min(dt, 0.05);
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.age += d;
      if (p.age >= p.life) { this.items.splice(i, 1); continue; }
      p.vy += 520 * d;
      p.x += p.vx * d;
      p.y += p.vy * d;
      p.rot += p.vr * d;
    }
  }

  draw(ctx) {
    for (const p of this.items) {
      const k = 1 - p.age / p.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, k);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      const s = p.size * (0.4 + k * 0.8);
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
    }
  }

  clear() { this.items.length = 0; }
}

export default Particles;
