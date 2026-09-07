import { BondType } from "./engine.js";
import { FONT_FAMILY, FONT_WEIGHT } from "./params.js";

const canvas = document.getElementById("bond-type");
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const engine = new BondType(canvas, `${FONT_FAMILY}, monospace`);

if (engine.ok) {
  let onScreen = false;
  let hidden = document.hidden;
  let sized = false;

  // Pauses offscreen and while the tab is hidden.
  const sync = () => {
    if (reduced || !sized) return;
    if (onScreen && !hidden) engine.start();
    else engine.stop();
  };

  // A ResizeObserver, not a load handler plus a window listener: it delivers
  // the first real box whenever it appears and every later one, so the engine
  // can never measure the cell against a canvas that has no layout yet.
  let rt = 0;
  new ResizeObserver((entries) => {
    const box = entries[0] && entries[0].contentRect;
    if (!box || box.width < 2 || box.height < 2) return;
    window.clearTimeout(rt);
    rt = window.setTimeout(() => {
      engine.resize();
      sized = true;
      // Reduced motion draws the plain typeset name, still: a frozen molecule
      // is an accident, and the name is the composition at rest.
      if (reduced) engine.renderStill();
      else sync();
    }, sized ? 120 : 0);
  }).observe(canvas);

  // The face has to be resident before its pixel can be recovered off it.
  if (document.fonts && document.fonts.load) {
    document.fonts
      .load(`${FONT_WEIGHT} 100px ${FONT_FAMILY}`, "HEIL")
      .then(() => engine.setFont(`${FONT_FAMILY}, monospace`))
      .catch(() => {});
  }

  new IntersectionObserver(
    (es) => {
      onScreen = es[0] ? es[0].isIntersecting : false;
      sync();
    },
    { threshold: 0.2 },
  ).observe(canvas);

  document.addEventListener("visibilitychange", () => {
    hidden = document.hidden;
    sync();
  });
}
