# bond-type

A two-line name in a pixel typeface on flat bright red that unfolds into a
*molecule*: the letters drift apart into nodes while stair-stepped runs of
square pixels grow as bonds in the spaces between adjacent letters within each
word. It re-scatters through a few more poses, folds back into plain typeset
text, and holds.

Canvas 2D, two colors, no framework.

## How it works

**The whole animation is letter positions.** Each letter interpolates between
keyposes on one global ease — zero stagger, one clock. The bonds are computed
every frame from wherever the letters currently are, so their angle, length,
birth and death all fall out of the same interpolation, with no per-bond state.

**A bond is leftover space.** It lies on the line between its two letters'
*optical* centres (`actualBoundingBox` metrics, not the em box), inset from each
letter's real ink edge by a clearance that scales with the free space. Bonds
only ever connect letters *within a word* — a proximity rule that lets any two
close letters bond stops reading as two words and becomes a lattice.

**Bonds are pixels on the type's own grid, not strokes.** A smooth round-capped
line between two bitmap glyphs reads as a different drawing pasted in. A run of
square cells stepped along the line has to stair-step on a diagonal, and that
staircase is what makes it look drawn by the same hand as the letters.

**The cell is measured, not declared.** `measureCell()` rasterizes capitals at
the card's own font size to an offscreen canvas and takes the GCD of the ink
runs across a few scanlines, recovering the face's own pixel. It survives a font
swap, a size-adjust change or a different card height, none of which a constant
would. The grid is then subdivided (half a font pixel) so a bond has enough
steps to describe a diagonal, and the bond's *thickness* is a separate constant
from its step size, so subdividing does not halve the weight.

**Bonds are counted in cells, not in pixels of free space.** A free-space
threshold feeding a round-capped stroke makes a bond spring into existence at
full weight and blink out just as hard. Counting cells means a bond is born as
exactly one square and grows by whole squares as the letters part — drawn, not
switched on, with the pop gone by construction rather than by tuning.

**The eases are small sampled tables, not analytic curves** — the curve has a
fast attack and a long uneven tail that a fitted power curve misses badly. The
unfold ease is reused for every scatter; only the refold has its own table, and
it approaches the typeset position from below and *stops*. No overshoot: on a
bitmap face any overshoot lands the glyph on a neighbouring cell and steps back,
so what should read as a settle reads as the letter arriving twice. Tables are
resampled with a fractional tick and lerped, so the timeline plays continuously
— stepped held frames read as jank on a crisp canvas, not as a flipbook.

**The cycle varies.** A library of scatter poses, a fresh random sequence and
length each time round, never the same pose twice running. Each line in each
pose has a *contour* — an arc, a vee, a rake, a wave, a two-step — rather than
independent per-letter noise; that is the difference between a row that looks
scattered and one that looks placed. The two lines never take the same contour
in the same pose, and one line's contour is centred above its baseline and the
other's below, so the lines separate *as* they scatter: a bigger amplitude
pushes them further apart rather than into each other.

**The poses are constrained and checked, not sampled and hoped over.** Poses are
authored as proportions, so a wider face squeezes the free space out of them and
the bonds vanish. At layout time each line in each pose is widened until its
tightest pair leaves room for a real bond, then clamped so no letter comes near
the frame edge.

**A one-cell twitch** adds life while the card is a molecule, gated to the
scattered state and cut the instant the fold home begins — a letter that still
steps a pixel while settling reads as a stutter. Its wave is *thresholded*
rather than rounded: rounding a sine to whole cells parks the letter at an
extreme most of the time and hops it diagonally between them. Each bond bows off
its straight line by a cell on a sine envelope that is zero at both ends and
drifts slowly, so the chain hangs instead of bracing.

Playback pauses offscreen and while the tab is hidden. Reduced motion draws the
plain typeset name, still — a frozen molecule is an accident, and the name is
the composition at rest.

## Files

- `index.html` — the card
- `src/params.js` — every value the piece is tuned by
- `src/engine.js` — layout, cell measurement, interpolation, bond drawing
- `src/main.js` — mounting, sizing, font loading, play/pause
