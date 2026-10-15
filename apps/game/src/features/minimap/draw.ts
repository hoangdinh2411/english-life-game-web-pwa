import { projectPoint, type MinimapSnapshot } from './model';

export function drawMinimap(canvas: HTMLCanvasElement, snapshot: MinimapSnapshot): void {
  const context = canvas.getContext('2d');
  if (!context || !canvas.clientWidth) return;
  // Work in CSS pixels so labels stay readable at every map size and pixel density.
  const box = { width: canvas.clientWidth, height: canvas.clientWidth * snapshot.height / snapshot.width };
  const density = window.devicePixelRatio || 1;
  const pixelWidth = Math.round(box.width * density), pixelHeight = Math.round(box.height * density);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) { canvas.width = pixelWidth; canvas.height = pixelHeight; }
  context.setTransform(density, 0, 0, density, 0, 0);
  const origin = projectPoint({ x: 0, y: 0 }, snapshot, box);
  const end = projectPoint({ x: snapshot.width, y: snapshot.height }, snapshot, box);
  context.clearRect(0, 0, box.width, box.height);
  context.drawImage(snapshot.image, origin.x, origin.y, end.x - origin.x, end.y - origin.y);
  const fontSize = Math.max(11, Math.min(14, box.width / 35));
  const pointFor = (point: { x: number; y: number }) => {
    const raw = projectPoint(point, snapshot, box);
    return { x: Math.max(5, Math.min(box.width - 5, raw.x)), y: Math.max(5, Math.min(box.height - 5, raw.y)) };
  };
  const dot = (point: { x: number; y: number }, colour: string, radius: number) => {
    context.fillStyle = colour; context.strokeStyle = '#fff8e7'; context.lineWidth = 1.5;
    context.beginPath(); context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fill(); context.stroke();
  };
  const label = (point: { x: number; y: number }, text: string, bold: boolean) => {
    context.font = `${bold ? '800 ' : ''}${fontSize + (bold ? 1 : 0)}px sans-serif`;
    const width = Math.min(context.measureText(text).width, Math.max(1, 2 * Math.min(point.x - 2, box.width - point.x - 2)));
    const y = Math.max(fontSize + (bold ? 3 : 2), point.y - (bold ? fontSize + 14 : 8));
    context.textAlign = 'center'; context.lineWidth = 3;
    context.strokeStyle = '#fff8e7'; context.fillStyle = '#263630';
    context.strokeText(text, point.x, y, width);
    context.fillText(text, point.x, y, width);
  };
  // Every name stays directly above its marker, with no boxes or leader lines.
  for (const portal of snapshot.portals) dot(pointFor(portal), '#315749', 4);
  for (const npc of snapshot.npcs) dot(pointFor(npc), '#572c76', 3);
  for (const portal of snapshot.portals) label(pointFor(portal), portal.label, true);
  for (const npc of snapshot.npcs) {
    const point = pointFor(npc);
    label(point, npc.name, false);
    if (npc.objective) {
      context.font = 'bold 16px sans-serif'; context.textAlign = 'center'; context.lineWidth = 3;
      context.strokeStyle = '#263630'; context.fillStyle = '#ffe08a';
      const y = Math.max(16, point.y - fontSize - 12);
      context.strokeText('!', point.x, y); context.fillText('!', point.x, y);
    }
  }
  dot(pointFor(snapshot.player), '#005fc4', 5);
}
