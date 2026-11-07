import type { VehicleKind } from '../sim/vehicle-types';

export const USER_RED = '#d32f2f';

interface Palette {
  readonly body: string;
  readonly window: string;
  readonly cargo: string;
  readonly detail: string;
}

const USER_PALETTE: Palette = { body: USER_RED, window: '#3b1414', cargo: USER_RED, detail: '#8e1c1c' };
const GREY_PALETTE: Palette = { body: '#9e9e9e', window: '#454545', cargo: '#b4b4b4', detail: '#8c8c8c' };

export function drawVehicle(context: CanvasRenderingContext2D, kind: VehicleKind, length: number, width: number): void {
  let palette = GREY_PALETTE;
  if (kind === 'user') {
    palette = USER_PALETTE;
  }
  const front = -length / 2;
  if (kind === 'semi') {
    drawSemi(context, palette, front, length, width);
    return;
  }
  if (kind === 'slowTruck') {
    drawMixer(context, palette, front, length, width);
    return;
  }
  drawCar(context, palette, front, length, width);
}

function drawCar(context: CanvasRenderingContext2D, palette: Palette, front: number, length: number, width: number): void {
  context.fillStyle = palette.body;
  roundedRect(context, -width / 2, front, width, length, width * 0.3);
  context.fillStyle = palette.window;
  roundedRect(context, -width * 0.4, front + length * 0.24, width * 0.8, length * 0.17, width * 0.12);
  roundedRect(context, -width * 0.38, front + length * 0.74, width * 0.76, length * 0.1, width * 0.1);
}

function drawSemi(context: CanvasRenderingContext2D, palette: Palette, front: number, length: number, width: number): void {
  const cab = 2.4;
  const gap = 0.4;
  context.fillStyle = palette.cargo;
  roundedRect(context, -width / 2, front + cab + gap, width, length - cab - gap, 0.3);
  context.fillStyle = palette.detail;
  for (let rib = front + cab + gap + 1.5; rib < front + length - 0.5; rib += 1.5) {
    context.fillRect(-width / 2 + 0.15, rib, width - 0.3, 0.08);
  }
  context.fillStyle = palette.body;
  roundedRect(context, -width / 2, front, width, cab, 0.4);
  context.fillStyle = palette.window;
  context.fillRect(-width * 0.42, front + 0.35, width * 0.84, 0.45);
}

function drawMixer(context: CanvasRenderingContext2D, palette: Palette, front: number, length: number, width: number): void {
  const cab = 2.3;
  context.fillStyle = palette.detail;
  roundedRect(context, -width / 2, front + cab, width, length - cab, 0.3);
  context.fillStyle = palette.cargo;
  context.beginPath();
  context.ellipse(0, front + cab + (length - cab) / 2, width * 0.47, (length - cab) * 0.46, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = palette.detail;
  context.lineWidth = 0.18;
  for (const offset of [-1.2, 1.2]) {
    const center = front + cab + (length - cab) / 2 + offset;
    context.beginPath();
    context.moveTo(-width * 0.4, center - 0.6);
    context.lineTo(width * 0.4, center + 0.6);
    context.stroke();
  }
  context.fillStyle = palette.body;
  roundedRect(context, -width / 2, front, width, cab, 0.4);
  context.fillStyle = palette.window;
  context.fillRect(-width * 0.42, front + 0.35, width * 0.84, 0.45);
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
}
