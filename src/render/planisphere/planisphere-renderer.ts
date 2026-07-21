import type { SatelliteNow, SatelliteTrack } from '../../model/types';
import { splitAboveHorizon } from '../common/horizon-clip';
import {
  ECLIPSED_TRACK_STROKE,
  ECLIPSED_TRACK_WIDTH,
  LABEL_COLOR,
  MARKER_ECLIPSED_COLOR,
  MARKER_SUNLIT_COLOR,
  SUNLIT_TRACK_STROKE,
  SUNLIT_TRACK_WIDTH,
} from '../common/track-style';
import { azElToScreen } from './projection';

const HORIZON_STROKE = 'rgba(199, 211, 222, 0.4)';
const GRID_STROKE = 'rgba(199, 211, 222, 0.15)';

export class PlanisphereRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly resizeObserver: ResizeObserver;
  private width = 0;
  private height = 0;
  private dpr = 1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable.');
    this.ctx = ctx;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  destroy(): void {
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

  render(satellites: SatelliteNow[], tracks: SatelliteTrack[]): void {
    const { ctx, width, height } = this;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 24;

    ctx.clearRect(0, 0, width, height);
    this.drawSkyDome(centerX, centerY, radius);

    // Only draw satellites that are actually above the horizon right now. Tracks are
    // built for all tracked satellites regardless of current position, so without this
    // filter dozens of objects that are mostly below horizon and only briefly grazing
    // it sometime in the next 20 minutes would clutter the chart with short arcs near
    // the rim, swamping the few satellites genuinely passing overhead.
    const visibleSatellites = satellites.filter((satellite) => satellite.elDeg >= 0);
    const tracksById = new Map(tracks.map((track) => [track.id, track]));
    for (const satellite of visibleSatellites) {
      const track = tracksById.get(satellite.id);
      if (track) this.drawTrack(track, centerX, centerY, radius);
    }
    for (const satellite of visibleSatellites) {
      this.drawMarker(satellite, centerX, centerY, radius);
    }
  }

  private drawSkyDome(centerX: number, centerY: number, radius: number): void {
    const { ctx } = this;

    ctx.strokeStyle = HORIZON_STROKE;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = GRID_STROKE;
    ctx.lineWidth = 1;
    for (const fraction of [1 / 3, 2 / 3]) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * fraction, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = LABEL_COLOR;
    ctx.font = '13px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const compassMargin = 14;
    ctx.fillText('N', centerX, centerY - radius - compassMargin / 2);
    ctx.fillText('S', centerX, centerY + radius + compassMargin / 2);
    // East on the left, West on the right — matches azElToScreen's convention.
    ctx.fillText('E', centerX - radius - compassMargin / 2, centerY);
    ctx.fillText('W', centerX + radius + compassMargin / 2, centerY);
  }

  private drawTrack(track: SatelliteTrack, centerX: number, centerY: number, radius: number): void {
    const { ctx } = this;

    for (const segment of track.segments) {
      ctx.strokeStyle = segment.sunlit ? SUNLIT_TRACK_STROKE : ECLIPSED_TRACK_STROKE;
      ctx.lineWidth = segment.sunlit ? SUNLIT_TRACK_WIDTH : ECLIPSED_TRACK_WIDTH;

      for (const run of splitAboveHorizon(segment.points)) {
        if (run.length < 2) continue;
        ctx.beginPath();
        run.forEach((point, index) => {
          const { x, y } = azElToScreen(point.azDeg, point.elDeg, centerX, centerY, radius);
          if (index === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
    }
  }

  private drawMarker(satellite: SatelliteNow, centerX: number, centerY: number, radius: number): void {
    const { ctx } = this;
    const { x, y } = azElToScreen(satellite.azDeg, satellite.elDeg, centerX, centerY, radius);
    const color = satellite.illuminated ? MARKER_SUNLIT_COLOR : MARKER_ECLIPSED_COLOR;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = LABEL_COLOR;
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${satellite.name} (${satellite.magnitude.toFixed(1)})`, x + 8, y);
  }
}
