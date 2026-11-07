import grassUrl from '../assets/grass.webp';
import { LANE_WIDTH, relativePosition } from '../sim/road';
import { VIEW_AHEAD, VIEW_BEHIND, type Vehicle, type World } from '../sim/world';
import { drawVehicle } from './vehicle-shapes';

const VIEW_LENGTH = VIEW_BEHIND + VIEW_AHEAD;
const PANEL_GAP = 32;
const EDGE_LINE_WIDTH = 0.15;
const EDGE_LINE_INSET = 0.3;
const DASH_LENGTH = 6;
const DASH_PERIOD = 20;
const DRAW_MARGIN = 40;
const ASPHALT = '#3b3b3b';
const MARKING = '#f4f4f4';
const GRASS_FALLBACK = '#3d6b2a';

export class Renderer {
  private readonly context: CanvasRenderingContext2D;
  private grass: CanvasPattern | null = null;
  private grassHeight = 1;
  private grassScroll = 0;
  private lastUserY: number | null = null;
  private width = 0;
  private height = 0;
  private scale = 1;
  private roadCenter = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly panelWidth: number,
  ) {
    const context = canvas.getContext('2d');
    if (context === null) {
      throw new Error('the browser has no 2D canvas');
    }
    this.context = context;
    const image = new Image();
    image.addEventListener('load', () => {
      this.grass = this.context.createPattern(image, 'repeat');
      this.grassHeight = image.naturalHeight;
    });
    image.src = grassUrl;
  }

  resize(width: number, height: number, pixelRatio: number): void {
    this.width = width;
    this.height = height;
    this.canvas.width = Math.round(width * pixelRatio);
    this.canvas.height = Math.round(height * pixelRatio);
    this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    this.scale = height / VIEW_LENGTH;
    this.roadCenter = Math.max(LANE_WIDTH * this.scale + 16, (width - this.panelWidth - PANEL_GAP) / 2);
  }

  panelLeft(): number {
    return this.roadCenter + LANE_WIDTH * this.scale + PANEL_GAP;
  }

  draw(world: World): void {
    const userY = world.user.y;
    if (this.lastUserY !== null) {
      this.grassScroll += relativePosition(this.lastUserY, userY);
    }
    this.lastUserY = userY;
    this.drawGrass();
    this.drawRoad(userY);
    for (const vehicle of world.vehicles) {
      this.drawOne(vehicle, userY);
    }
  }

  private screenY(metersAboveBottom: number): number {
    return this.height - metersAboveBottom * this.scale;
  }

  private drawGrass(): void {
    const context = this.context;
    if (this.grass === null) {
      context.fillStyle = GRASS_FALLBACK;
      context.fillRect(0, 0, this.width, this.height);
      return;
    }
    const pixels = (this.grassScroll * this.scale) % this.grassHeight;
    const offset = (pixels + this.grassHeight) % this.grassHeight;
    this.grass.setTransform(new DOMMatrix().translateSelf(0, offset));
    context.fillStyle = this.grass;
    context.fillRect(0, 0, this.width, this.height);
  }

  private drawRoad(userY: number): void {
    const context = this.context;
    const scale = this.scale;
    const left = this.roadCenter - LANE_WIDTH * scale;
    context.fillStyle = ASPHALT;
    context.fillRect(left, 0, 2 * LANE_WIDTH * scale, this.height);
    context.fillStyle = MARKING;
    const edgeWidth = EDGE_LINE_WIDTH * scale;
    context.fillRect(left + EDGE_LINE_INSET * scale, 0, edgeWidth, this.height);
    context.fillRect(this.roadCenter + (LANE_WIDTH - EDGE_LINE_INSET) * scale - edgeWidth, 0, edgeWidth, this.height);
    const bottom = userY - VIEW_BEHIND - DASH_PERIOD;
    const top = userY + VIEW_AHEAD + DASH_PERIOD;
    for (let dash = Math.floor(bottom / DASH_PERIOD) * DASH_PERIOD; dash < top; dash += DASH_PERIOD) {
      const start = this.screenY(dash - userY + VIEW_BEHIND);
      const end = this.screenY(dash + DASH_LENGTH - userY + VIEW_BEHIND);
      context.fillRect(this.roadCenter - edgeWidth / 2, end, edgeWidth, start - end);
    }
  }

  private drawOne(vehicle: Vehicle, userY: number): void {
    const front = relativePosition(userY, vehicle.y);
    if (front < -VIEW_BEHIND - DRAW_MARGIN || front > VIEW_AHEAD + DRAW_MARGIN) {
      return;
    }
    const center = front - (vehicle.direction * vehicle.length) / 2;
    const home = (vehicle.direction * LANE_WIDTH) / 2;
    const eased = vehicle.lateral * vehicle.lateral * (3 - 2 * vehicle.lateral);
    const lateral = home - 2 * home * eased;
    const context = this.context;
    context.save();
    context.translate(this.roadCenter + lateral * this.scale, this.screenY(center + VIEW_BEHIND));
    context.scale(this.scale, this.scale);
    if (vehicle.direction === -1) {
      context.rotate(Math.PI);
    }
    drawVehicle(context, vehicle.kind, vehicle.length, vehicle.width);
    context.restore();
  }
}
