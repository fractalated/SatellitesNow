const TILE_SIZE = 128;

/**
 * A small, stably-seeded "grassy field at night" tile (transparent background,
 * just the grass-blade strokes), turned into a repeating canvas pattern. Seeded
 * (not Math.random per frame) so it doesn't flicker — drawn once and reused every
 * frame. Deliberately has no baked-in gradient: tiling a gradient would repeat it
 * every tile and produce visible banding, so the smooth dark-at-night gradient is
 * drawn separately, once, across the full ground area, with this pattern layered
 * on top of it.
 */
export function createGroundPattern(ctx: CanvasRenderingContext2D): CanvasPattern {
  const tile = document.createElement('canvas');
  tile.width = TILE_SIZE;
  tile.height = TILE_SIZE;
  const tileCtx = tile.getContext('2d');
  if (!tileCtx) throw new Error('Could not create ground texture.');

  let seed = 42;
  const random = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  tileCtx.strokeStyle = 'rgba(95, 145, 95, 0.3)';
  tileCtx.lineWidth = 1;
  for (let i = 0; i < 70; i++) {
    const x = random() * TILE_SIZE;
    const y = random() * TILE_SIZE;
    const bladeHeight = 3 + random() * 5;
    const lean = (random() - 0.5) * 3;
    tileCtx.beginPath();
    tileCtx.moveTo(x, y);
    tileCtx.lineTo(x + lean, y - bladeHeight);
    tileCtx.stroke();
  }

  const pattern = ctx.createPattern(tile, 'repeat');
  if (!pattern) throw new Error('Could not create ground pattern.');
  return pattern;
}
