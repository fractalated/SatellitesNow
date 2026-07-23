import type { SatelliteNow, SatelliteTrack } from '../../model/types';
import { clamp } from '../../utils/math';
import { ECLIPSED_TRACK_STROKE, ECLIPSED_TRACK_WIDTH, MARKER_ECLIPSED_COLOR, MARKER_SUNLIT_COLOR, SUNLIT_TRACK_STROKE, SUNLIT_TRACK_WIDTH } from '../common/track-style';
import type { DeviceHeading } from './ar-projection';
import { deriveVerticalFovDeg, horizonScreenY, projectToScreen } from './ar-projection';
import { createGroundPattern } from './ground-texture';

const TARGET_FRAME_INTERVAL_MS = 1000 / 30;
const HORIZON_LINE_STROKE = 'rgba(180, 210, 190, 0.5)';
const HIT_RADIUS_PX = 22;

interface MarkerPosition {
  satellite: SatelliteNow;
  x: number;
  y: number;
}

/** Draws satellite markers + tracks onto a canvas overlaid on the live camera feed,
 * projected using the device's current pointing direction. Redraw is capped at
 * ~30fps to leave headroom for the concurrently running camera/GPS/compass. */
export class ArRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly resizeObserver: ResizeObserver;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private hFovDeg = 65;

  private satellites: SatelliteNow[] = [];
  private tracks: SatelliteTrack[] = [];
  private heading: DeviceHeading = { headingDeg: 0, pitchDeg: 0 };
  private lastMarkers: MarkerPosition[] = [];
  private selectedId: string | null = null;
  private clickHandler: ((satellite: SatelliteNow) => void) | null = null;

  private rafId: number | null = null;
  private lastFrameTime = 0;
  private readonly groundPattern: CanvasPattern;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable.');
    this.ctx = ctx;
    this.groundPattern = createGroundPattern(ctx);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();

    this.canvas.addEventListener('click', this.handleClick);
  }

  setHorizontalFovDeg(deg: number): void {
    this.hFovDeg = deg;
  }

  updateSatellites(satellites: SatelliteNow[], tracks: SatelliteTrack[]): void {
    this.satellites = satellites;
    this.tracks = tracks;
  }

  updateHeading(heading: DeviceHeading): void {
    this.heading = heading;
  }

  onSatelliteClick(handler: (satellite: SatelliteNow) => void): void {
    this.clickHandler = handler;
  }

  setSelectedId(id: string | null): void {
    this.selectedId = id;
  }

  start(): void {
    if (this.rafId !== null) return;
    const loop = (time: number) => {
      this.rafId = requestAnimationFrame(loop);
      if (time - this.lastFrameTime < TARGET_FRAME_INTERVAL_MS) return;
      this.lastFrameTime = time;
      this.draw();
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  destroy(): void {
    this.stop();
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener('click', this.handleClick);
  }

  private readonly handleClick = (event: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    let best: MarkerPosition | null = null;
    let bestDist = HIT_RADIUS_PX;
    for (const marker of this.lastMarkers) {
      const dist = Math.hypot(marker.x - x, marker.y - y);
      if (dist <= bestDist) {
        best = marker;
        bestDist = dist;
      }
    }
    if (best) this.clickHandler?.(best.satellite);
  };

  private resize(): void {
    this.dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  private draw(): void {
    const { ctx, width, height } = this;
    ctx.clearRect(0, 0, width, height);
    if (width === 0 || height === 0) return;

    const vFovDeg = deriveVerticalFovDeg(this.hFovDeg, width, height);
    this.drawGround(vFovDeg);

    // Only satellites currently above the horizon — see the matching comment in
    // PlanisphereRenderer.render for why (tracks exist for all tracked satellites
    // regardless of current position, which would otherwise clutter the view with
    // brief rise/set arcs from objects that aren't actually up right now).
    const visibleSatellites = this.satellites.filter((satellite) => satellite.elDeg >= 0);
    const tracksById = new Map(this.tracks.map((track) => [track.id, track]));

    for (const satellite of visibleSatellites) {
      const track = tracksById.get(satellite.id);
      if (track) this.drawTrack(track, vFovDeg);
    }

    this.lastMarkers = [];
    for (const satellite of visibleSatellites) {
      this.drawMarker(satellite, vFovDeg);
    }
  }

  private drawGround(vFovDeg: number): void {
    const { ctx, width, height, heading } = this;
    const y = clamp(horizonScreenY(heading.pitchDeg, vFovDeg, height), 0, height);
    if (y >= height) return; // camera pitched down enough that no ground is in frame

    // One continuous gradient across the whole visible ground (not baked into the
    // repeating tile, which would band at every tile boundary), with the seeded
    // grass-blade pattern layered on top.
    const gradient = ctx.createLinearGradient(0, y, 0, height);
    gradient.addColorStop(0, '#0d150e');
    gradient.addColorStop(1, '#050905');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, y, width, height - y);

    ctx.fillStyle = this.groundPattern;
    ctx.fillRect(0, y, width, height - y);

    ctx.strokeStyle = HORIZON_LINE_STROKE;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  private drawTrack(track: SatelliteTrack, vFovDeg: number): void {
    const { ctx, width, height, heading, hFovDeg } = this;

    for (const segment of track.segments) {
      ctx.strokeStyle = segment.sunlit ? SUNLIT_TRACK_STROKE : ECLIPSED_TRACK_STROKE;
      ctx.lineWidth = segment.sunlit ? SUNLIT_TRACK_WIDTH : ECLIPSED_TRACK_WIDTH;

      for (let i = 0; i + 1 < segment.points.length; i++) {
        const a = segment.points[i];
        const b = segment.points[i + 1];
        // Below-horizon points are hidden by the ground graphic anyway, but skip
        // them explicitly rather than relying on that, so a track never visibly
        // dips "into the ground" for cameras pitched down.
        if (a.elDeg < 0 || b.elDeg < 0) continue;

        const pa = projectToScreen(a.azDeg, a.elDeg, heading, hFovDeg, vFovDeg, width, height);
        const pb = projectToScreen(b.azDeg, b.elDeg, heading, hFovDeg, vFovDeg, width, height);
        if (!pa || !pb) continue;

        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }
    }
  }

  private drawMarker(satellite: SatelliteNow, vFovDeg: number): void {
    const { ctx, width, height, heading, hFovDeg } = this;
    const point = projectToScreen(satellite.azDeg, satellite.elDeg, heading, hFovDeg, vFovDeg, width, height);
    if (!point) return;

    this.lastMarkers.push({ satellite, x: point.x, y: point.y });

    const color = satellite.illuminated ? MARKER_SUNLIT_COLOR : MARKER_ECLIPSED_COLOR;

    if (satellite.id === this.selectedId) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 11, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}
