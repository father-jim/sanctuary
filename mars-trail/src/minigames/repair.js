// Bolt-tightening timing game: stop the sweeping needle inside the green band, once per bolt.
// Resolves { score, hits } where hits is how many of the three bolts held.
import { stage, COLORS } from './canvas.js';

const BOLTS = 3;

export function play(host, { band = 0.2, speed = 1 } = {}) {
  const g = stage(host, {
    width: 360, height: 210,
    help: 'Tap the gauge, or press Space, when the needle is inside the green band. Three bolts.',
  });
  const { ctx, width: W } = g;
  const cx = W / 2, cy = 175, r = 130;

  return new Promise((resolve) => {
    let t = Math.random() * 3;
    let bolt = 0;
    let width = band;
    let target = newTarget();
    let pausedUntil = 0;
    const results = [];
    let flash = null;

    function newTarget() { return width / 2 + Math.random() * (1 - width); }
    const needle = () => (Math.sin(t) + 1) / 2;

    g.say(`Bolt 1 of ${BOLTS}`);
    g.onPress(() => {
      const now = performance.now();
      if (now < pausedUntil || bolt >= BOLTS) return;
      const hit = Math.abs(needle() - target) <= width / 2;
      results.push(hit);
      flash = { hit, until: now + 450 };
      bolt += 1;
      pausedUntil = now + 550;
      if (bolt === BOLTS) {
        const hits = results.filter(Boolean).length;
        g.say(`${hits} of ${BOLTS} bolts held.`);
        setTimeout(() => { g.stop(); resolve({ hits, score: hits / BOLTS }); }, 900);
        return;
      }
      g.say(`${hit ? 'Tight!' : 'Slipped.'} Bolt ${bolt + 1} of ${BOLTS}`);
      width *= 0.8;
      target = newTarget();
    });

    g.loop((dt, now) => {
      if (now >= pausedUntil) t += dt * speed * (2.4 + bolt * 0.7);
      ctx.fillStyle = COLORS.sky;
      ctx.fillRect(0, 0, W, g.height);

      const angle = (p) => Math.PI + p * Math.PI;
      ctx.lineWidth = 18;
      ctx.lineCap = 'butt';
      ctx.strokeStyle = COLORS.line;
      ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI); ctx.stroke();
      ctx.strokeStyle = COLORS.good;
      ctx.beginPath(); ctx.arc(cx, cy, r, angle(target - width / 2), angle(target + width / 2)); ctx.stroke();

      const a = angle(needle());
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.strokeStyle = flash && now < flash.until ? (flash.hit ? COLORS.good : COLORS.bad) : COLORS.text;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * (r + 12), cy + Math.sin(a) * (r + 12)); ctx.stroke();
      ctx.fillStyle = COLORS.accent;
      ctx.beginPath(); ctx.arc(cx, cy, 10, 0, 2 * Math.PI); ctx.fill();

      for (let i = 0; i < BOLTS; i++) {
        const x = 24 + i * 30, y = 24;
        ctx.fillStyle = i < results.length ? (results[i] ? COLORS.good : COLORS.bad) : COLORS.line;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const h = (k / 6) * 2 * Math.PI;
          ctx.lineTo(x + Math.cos(h) * 10, y + Math.sin(h) * 10);
        }
        ctx.fill();
        ctx.fillStyle = COLORS.sky;
        ctx.beginPath(); ctx.arc(x, y, 4, 0, 2 * Math.PI); ctx.fill();
      }
    });
  });
}
