// ---------------------------------------------------------------------------
// Every value the card is tuned by. Positions are fractions of card HEIGHT so
// the whole composition scales with the card and never with the viewport.
// ---------------------------------------------------------------------------

export const TICKS = 61;
export const FPS = 32;

// Sampled tables, not analytic curves: the attack is fast and the tail is long
// and uneven, and a fitted power curve misses the tail badly.
export const EASE_MOVE = [
  0, 0.014, 0.044, 0.193, 0.317, 0.545, 0.621, 0.735, 0.777, 0.838, 0.868,
  0.908, 0.924, 0.95, 0.962, 0.979, 0.985, 0.994, 0.996, 1,
];

// The fold home gets its own table, and it approaches 1 from below and STOPS.
// No overshoot: on a bitmap face any overshoot lands the glyph on a neighbouring
// cell and steps back, which reads as the letter arriving twice.
export const EASE_RETURN = [
  0.0, 0.0115, 0.023, 0.0475, 0.072, 0.1835, 0.295, 0.3645,
  0.434, 0.534, 0.634, 0.667, 0.7, 0.7495, 0.799, 0.8175,
  0.836, 0.862, 0.888, 0.8995, 0.911, 0.9275, 0.944, 0.949,
  0.954, 0.9685, 0.983, 0.985, 0.987, 0.9915, 0.996, 0.998,
  1.0,
];

export const MOVE2_AT = 20;
export const MOVE3_AT = 40;

export const RED = "#f5333f";
export const WHITE = "#fdfefd";

export const CAP_H = 56 / 304;

export const FONT_FAMILY = '"Silkscreen"';
export const FONT_WEIGHT = 400;

export const BASELINE_1 = 140 / 304;
export const LINE_PITCH = 67.5 / 304;

// --- twitch ----------------------------------------------------------------
export const JITTER_CELLS = 1;
export const JITTER_S = 5.2;
// Threshold the wave rather than round it: a sine is only briefly near zero, so
// rounding parks the letter at an extreme and hops it diagonally between them.
export const JITTER_GATE = 0.975;
export const JITTER_EASE_TICKS = 6;

// --- bonds -----------------------------------------------------------------
// Half a font pixel, so a bond has enough steps to describe a diagonal.
export const BOND_CELL_SCALE = 0.5;
// Fallback only. The real cell is recovered by GCD of the face's ink runs.
export const CAP_PIXELS = 5;
export const BOND_AIR_CELLS = 2;
export const BOND_MIN_CELLS = 1;
// Weight is its own constant: subdividing the grid must not halve the stem.
export const BOND_WEIGHT_CELLS = 2;
export const BOND_BOW_CELLS = 1;
export const BOND_BOW_S = 7;
export const BOND_ON_TICK = 3;
export const BOND_OFF_BEFORE_HOME = 2;

// A line may hold more than one word. Bonds never cross the space.
export const LINES = ["Just", "Do It"];

// --- contours --------------------------------------------------------------
// A line in a pose takes a CONTOUR, not independent per-letter noise: that is
// the whole difference between a row that looks scattered and one that looks
// placed. Each maps u in [0,1] across the line to a signed shape in [-1,1].
export const CONTOURS = {
  arc: (u) => Math.sin(Math.PI * u) * 2 - 1,
  vee: (u) => 1 - Math.sin(Math.PI * u) * 2,
  rake: (u) => 2 * u - 1,
  wave: (u) => Math.sin(2 * Math.PI * u),
  twoStep: (u) => (u < 0.5 ? -1 : 1) * (0.75 + 0.25 * Math.cos(Math.PI * u)),
};

// Centre-to-centre spacing a scattered line starts from, before it is fitted
// to the face actually in use. A gap that straddles a word is opened up, so
// the two molecules on a line stay legibly separate.
export const BASE_GAP = 74 / 304;
export const WORD_SPACE_MULT = 1.7;

// One contour is centred above its baseline and the other below, so the lines
// separate AS they scatter: a bigger amplitude pushes them further apart
// rather than into each other.
export const DY_BIAS = 30 / 304;
export const DY_AMP = 26 / 304;

// Each pose gives every line a contour, an amplitude, how much that contour
// also shapes the gaps, how much of the card width the line reaches for, and a
// shift expressed as a fraction of the line's OWN span. No two lines take the
// same contour in the same pose, and no pose gives both lines the same fill.
export const POSES = [
  { contour: ["arc", "rake"], amp: [0.95, 0.85], gapAmp: [0.16, 0.12], fill: [0.72, 0.8], shift: [0.03, -0.05] },
  { contour: ["vee", "wave"], amp: [1.1, 0.9], gapAmp: [0.2, 0.18], fill: [0.79, 0.68], shift: [-0.025, 0.06] },
  { contour: ["rake", "arc"], amp: [0.8, 1.05], gapAmp: [0.1, 0.2], fill: [0.67, 0.78], shift: [-0.06, 0.035] },
  { contour: ["wave", "twoStep"], amp: [1.0, 0.95], gapAmp: [0.22, 0.14], fill: [0.76, 0.7], shift: [-0.03, -0.02] },
  { contour: ["twoStep", "vee"], amp: [0.9, 1.15], gapAmp: [0.12, 0.21], fill: [0.7, 0.77], shift: [0.035, -0.055] },
  { contour: ["arc", "wave"], amp: [0.75, 1.0], gapAmp: [0.18, 0.16], fill: [0.81, 0.73], shift: [-0.015, 0.045] },
];

export const SCATTERS_MIN = 2;
export const SCATTERS_MAX = 4;

export const MOVE_TICKS = 20;
export const RETURN_TICKS = 17;
export const HOLD_TICKS = 8;

export const ARRIVE_SPREAD = 0.08;

// --- pose fit --------------------------------------------------------------
// Poses are authored as proportions, so a wider face squeezes the free space
// out of them and the bonds vanish. Each line in each pose is widened at
// layout time until its tightest pair leaves room for a real bond, then
// clamped so no letter comes near the frame edge. Checked, not sampled.
export const POSE_MIN_FREE_CELLS = 8;
export const POSE_EDGE_MARGIN = 0.06;
