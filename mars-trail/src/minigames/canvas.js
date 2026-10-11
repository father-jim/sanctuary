// Shared setup for the mini-games: a crisp canvas sized for the screen, pointer and Space input,
// and an animation loop that stops when the game finishes.
export function stage(host, { width = 360, height = 220, help }) {
  host.innerHTML = `
    <p class="mg-help">${help}</p>
    <canvas class="mg-canvas" width="${width}" height="${height}" tabindex="0"></canvas>
    <p class="mg-status" aria-live="polite"></p>`;
  const canvas = host.querySelector('canvas');
  const status = host.querySelector('.mg-status');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.aspectRatio = `${width} / ${height}`;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  let raf = 0;
  const cleanups = [];
  return {
    ctx, canvas, width, height,
    say(text) { status.textContent = text; },
    // Calls fn(x, y) in canvas units on tap or click, and fn(null) on Space or Enter.
    onPress(fn) {
      const pointer = (e) => {
        const r = canvas.getBoundingClientRect();
        fn(((e.clientX - r.left) / r.width) * width, ((e.clientY - r.top) / r.height) * height);
      };
      const key = (e) => {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); fn(null); }
      };
      canvas.addEventListener('pointerdown', pointer);
      window.addEventListener('keydown', key);
      cleanups.push(() => { canvas.removeEventListener('pointerdown', pointer); window.removeEventListener('keydown', key); });
    },
    loop(fn) {
      let last = performance.now();
      const tick = (now) => {
        fn(Math.min(0.05, (now - last) / 1000), now);
        last = now;
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      canvas.focus({ preventScroll: true });
    },
    stop() {
      cancelAnimationFrame(raf);
      cleanups.forEach((fn) => fn());
    },
  };
}

export const COLORS = {
  sky: '#1a0f0b',
  ground: '#5a2c1c',
  groundDark: '#3b1d12',
  line: '#4a2a1f',
  text: '#f4e6dc',
  muted: '#b89a8a',
  accent: '#e2673a',
  good: '#7bd88f',
  bad: '#ff6b6b',
  ice: '#cfe9ff',
};
