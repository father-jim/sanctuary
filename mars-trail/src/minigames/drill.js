// Ice-drilling reflex game: tap pockets of ice as they surface through the regolith, before they sink.
// Resolves { score, hits }; the event turns hits into water and oxygen.
import { stage, COLORS } from './canvas.js';

const SECONDS = 12;
const TARGET = 10; // hits for a perfect score

export function play(host) {
  const g = stage(host, {
    width: 360, height: 230,
    help: `Tap the ice as it surfaces. You have ${SECONDS} seconds before the drill overheats.`,
  });
  const { ctx, width: W, height: H } = g;
  const top = 40;
  // Fixed rock speckle so the ground doesn't shimmer between frames.
  const speckle = Array.from({ length: 70 }, () => [Math.random() * W, top + Math.random() * (H - top), 1 + Math.random() * 2]);

  return new Promise((resolve) => {
    let left = SECONDS;
    let spawnIn = 0.3;
    let hits = 0;
    const pockets = [];
    const sparks = [];
    let done = false;

    g.say(`Ice: 0`);
    g.onPress((x, y) => {
      if (done || x === null) return;
      const p = pockets.find((p) => !p.hit && Math.hypot(p.x - x, p.y - y) < p.r * size(p) + 10);
      if (!p) return;
      p.hit = true;
      hits += 1;
      sparks.push({ x: p.x, y: p.y, age: 0 });
      g.say(`Ice: ${hits}`);
    });

    // Pockets swell up, hold, then shrink away over their lifetime.
    function size(p) {
      const k = p.age / p.life;
      return k < 0.25 ? k / 0.25 : k > 0.75 ? (1 - k) / 0.25 : 1;
    }

    g.loop((dt) => {
      if (!done) {
        left -= dt;
        spawnIn -= dt;
        if (spawnIn <= 0 && pockets.filter((p) => !p.hit).length < 3) {
          pockets.push({
            x: 30 + Math.random() * (W - 60), y: top + 30 + Math.random() * (H - top - 50),
            r: 14 + Math.random() * 8, age: 0, life: 1.1 + Math.random() * 0.6, hit: false,
          });
          spawnIn = 0.45 + Math.random() * 0.45;
        }
        if (left <= 0) {
          done = true;
          g.say(`Time! ${hits} chunk${hits === 1 ? '' : 's'} of ice.`);
          setTimeout(() => { g.stop(); resolve({ hits, score: Math.min(1, hits / TARGET) }); }, 900);
        }
      }
      for (const p of pockets) p.age += dt;
      for (const s of sparks) s.age += dt;
      for (let i = pockets.length - 1; i >= 0; i--) if (pockets[i].hit || pockets[i].age >= pockets[i].life) pockets.splice(i, 1);
      for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].age > 0.4) sparks.splice(i, 1);

      ctx.fillStyle = COLORS.sky;
      ctx.fillRect(0, 0, W, top);
      const grad = ctx.createLinearGradient(0, top, 0, H);
      grad.addColorStop(0, COLORS.ground);
      grad.addColorStop(1, COLORS.groundDark);
      ctx.fillStyle = grad;
      ctx.fillRect(0, top, W, H - top);
      ctx.fillStyle = 'rgb(0 0 0 / .18)';
      for (const [x, y, s] of speckle) ctx.fillRect(x, y, s, s);

      ctx.fillStyle = COLORS.line;
      ctx.fillRect(16, 14, W - 32, 10);
      ctx.fillStyle = left < 3 ? COLORS.bad : COLORS.accent;
      ctx.fillRect(16, 14, (W - 32) * Math.max(0, left / SECONDS), 10);

      for (const p of pockets) {
        const k = size(p);
        ctx.fillStyle = COLORS.ice;
        ctx.globalAlpha = 0.35 + 0.65 * k;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * k, 0, 2 * Math.PI); ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = COLORS.ice;
      ctx.lineWidth = 2;
      for (const s of sparks) {
        ctx.globalAlpha = 1 - s.age / 0.4;
        ctx.beginPath(); ctx.arc(s.x, s.y, 10 + s.age * 60, 0, 2 * Math.PI); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });
  });
}
