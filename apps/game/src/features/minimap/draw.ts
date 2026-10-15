import { projectPoint, type MinimapSnapshot } from './model';

type LabelBox = { x: number; y: number; width: number; height: number };

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
  const occupied: LabelBox[] = [];
  const pointFor = (point: { x: number; y: number }) => {
    const raw = projectPoint(point, snapshot, box);
    return { x: Math.max(5, Math.min(box.width - 5, raw.x)), y: Math.max(5, Math.min(box.height - 5, raw.y)) };
  };
  for (const marker of [...snapshot.portals, ...snapshot.npcs, snapshot.player]) {
    const point = pointFor(marker);
    occupied.push({ x: point.x - 5, y: point.y - 5, width: 10, height: 10 });
  }
  const dot = (point: { x: number; y: number }, colour: string, radius: number, square = false) => {
    context.fillStyle = colour; context.strokeStyle = '#fff8e7'; context.lineWidth = 1.5;
    context.beginPath();
    if (square) context.rect(point.x - radius, point.y - radius, radius * 2, radius * 2);
    else context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fill(); context.stroke();
  };
  const label = (point: { x: number; y: number }, text: string, exit: boolean) => {
    context.font = `${exit ? 'bold ' : ''}${fontSize}px sans-serif`;
    const width = Math.min(box.width - 4, context.measureText(text).width + 6), height = fontSize + 5;
    const candidates: LabelBox[] = [];
    for (const offset of [0, 1, -1, 2, -2, 3, -3]) for (const side of [1, -1]) {
      candidates.push({ x: Math.max(2, Math.min(box.width - width - 2, point.x + (side === 1 ? 7 : -width - 7))),
        y: Math.max(2, Math.min(box.height - height - 2, point.y - height / 2 + offset * (height + 2))), width, height });
    }
    const overlap = (candidate: LabelBox) => occupied.reduce((area, other) => {
      const horizontal = Math.max(0, Math.min(candidate.x + width + 2, other.x + other.width) - Math.max(candidate.x - 2, other.x));
      const vertical = Math.max(0, Math.min(candidate.y + height + 2, other.y + other.height) - Math.max(candidate.y - 2, other.y));
      return area + horizontal * vertical;
    }, 0);
    const chosen = candidates.reduce((best, candidate) => overlap(candidate) < overlap(best) ? candidate : best, candidates[0]!);
    occupied.push(chosen);
    if (Math.abs(chosen.y + height / 2 - point.y) > height) {
      context.beginPath(); context.strokeStyle = '#315749'; context.lineWidth = 0.7;
      context.moveTo(point.x, point.y); context.lineTo(chosen.x + width / 2, chosen.y + height / 2); context.stroke();
    }
    context.fillStyle = exit ? '#315749' : 'rgba(255,248,231,0.92)';
    context.fillRect(chosen.x, chosen.y, width, height);
    context.fillStyle = exit ? '#fff8e7' : '#263630'; context.textAlign = 'left';
    context.fillText(text, chosen.x + 3, chosen.y + fontSize + 1, width - 6);
  };
  // Draw markers before labels, so later markers cannot obscure earlier names.
  for (const portal of snapshot.portals) dot(pointFor(portal), '#315749', 4, true);
  for (const npc of snapshot.npcs) dot(pointFor(npc), '#572c76', 3);
  // Reserve exit labels first; displaced NPC labels use leader lines.
  for (const portal of snapshot.portals) label(pointFor(portal), `↗ ${portal.label}`, true);
  for (const npc of snapshot.npcs) {
    const point = pointFor(npc);
    label(point, npc.name, false);
    if (npc.objective) {
      context.font = 'bold 16px sans-serif'; context.textAlign = 'center'; context.lineWidth = 3;
      context.strokeStyle = '#263630'; context.fillStyle = '#ffe08a';
      const y = Math.max(16, point.y - 6);
      context.strokeText('!', point.x, y); context.fillText('!', point.x, y);
    }
  }
  dot(pointFor(snapshot.player), '#005fc4', 5);
}
