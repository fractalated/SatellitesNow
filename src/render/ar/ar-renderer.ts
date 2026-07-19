import type { SatelliteNow, SatelliteTrack } from '../../model/types';
import { ECLIPSED_TRACK_STROKE, ECLIPSED_TRACK_WIDTH, MARKER_ECLIPSED_COLOR, MARKER_SUNLIT_COLOR, SUNLIT_TRACK_STROKE, SUNLIT_TRACK_WIDTH } from '../common/track-style';
import type { DeviceHeading } from './ar-projection';
import { projectToScreen } from './ar-projection';

const TARGET_FRAME_INTERVAL_MS = 1000 / 30;

/** Draws satellite labels + tracks onto a canvas overlaid on the live camera feed,
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

  private rafId: number | null = null;
  private lastFrameTime = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable.');
    this.ctx = ctx;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
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
  }

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

    const vFovDeg = this.hFovDeg * (height / width);
    const tracksById = new Map(this.tracks.map((track) => [track.id, track]));

    for (const satellite of this.satellites) {
      const track = tracksById.get(satellite.id);
      if (track) this.drawTrack(track, vFovDeg);
    }
    for (const satellite of this.satellites) {
      this.drawMarker(satellite, vFovDeg);
    }
  }

  private drawTrack(track: SatelliteTrack, vFovDeg: number): void {
    const { ctx, width, height, heading, hFovDeg } = this;

    for (const segment of track.segments) {
      ctx.strokeStyle = segment.sunlit ? SUNLIT_TRACK_STROKE : ECLIPSED_TRACK_STROKE;
      ctx.lineWidth = segment.sunlit ? SUNLIT_TRACK_WIDTH : ECLIPSED_TRACK_WIDTH;

      for (let i = 0; i + 1 < segment.points.length; i++) {
        const a = segment.points[i];
        const b = segment.points[i + 1];
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

    const color = satellite.illuminated ? MARKER_SUNLIT_COLOR : MARKER_ECLIPSED_COLOR;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '13px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillText(satellite.name, point.x + 9, point.y + 1);
    ctx.fillStyle = color;
    ctx.fillText(satellite.name, point.x + 8, point.y);
  }
}
