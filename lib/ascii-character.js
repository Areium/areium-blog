// Coordinates refer to the original 3360 × 1440 hero artwork.
export const HERO_SOURCE = '/images/hero/wallhaven-yqkyyx.jpg';
export function headBounds(width, height) {
  const scale = Math.max(width / 3360, height / 1440);
  return { left: (width - 3360 * scale) / 2 + 1700 * scale, top: 325 * scale, width: 270 * scale, height: 245 * scale };
}

const silhouette = [
  [[.50,.46],[.46,.34],[.39,.24],[.31,.33],[.21,.44],[.11,.58],[.04,.78],[.17,.71],[.14,.87],[.25,.70],[.30,1],[.42,1],[.44,.76]],
  [[.58,.32],[.62,.16],[.62,0],[.77,.04],[.99,.1],[.98,.22],[.88,.29],[.90,.40],[.77,.36],[.72,.44],[.79,.66],[.89,1],[.58,1],[.55,.75],[.62,.61]],
  [[.513,.255],[.520,.237],[.540,.233],[.560,.250],[.572,.283],[.575,.330],[.593,.352],[.605,.397],[.610,.435],[.600,.480],[.577,.510],[.566,.600],[.547,.650],[.538,.680],[.533,.800],[.508,.810],[.490,.790],[.493,.710],[.500,.610],[.512,.510],[.523,.460],[.540,.400],[.529,.370],[.515,.350],[.509,.310]],
];
function inside(x, y, polygon) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) result = !result;
  }
  return result;
}
export function characterPoints(pixels, width, height, step = 1) {
  const positions = [], tones = [], colors = [], sizes = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = x / width, ny = y / height;
      const face = nx > .507 && nx < .582 && ny > .225 && ny < .385;
      const sourceX = nx * 3360, sourceY = ny * 1440;
      const ring = Math.abs(Math.hypot((sourceX - 1875) / 280, (sourceY - 360) / 280) - 1) < .12;
      const horns = inside(sourceX, sourceY, [[1585,180],[1655,180],[1765,375],[1730,405],[1610,290]]) ||
        inside(sourceX, sourceY, [[1735,130],[1780,145],[1820,370],[1780,385],[1740,260]]);
      const detailStep = Math.max(1, Math.floor(step / 2));
      const stride = face ? 1 : ring || horns ? detailStep : step;
      if (x % stride !== 0 || y % stride !== 0) continue;
      const index = (y * width + x) * 4;
      const tone = (pixels[index] * .2126 + pixels[index + 1] * .7152 + pixels[index + 2] * .0722) / 255;
      const decoration = (ring || horns) && tone > .78 && pixels[index] > pixels[index + 2] * 1.02 && pixels[index + 1] > pixels[index + 2] * .99;
      if (!decoration && !silhouette.some(polygon => inside(nx, ny, polygon))) continue;
      if (tone < .30) continue;
      positions.push((nx - .48) * 14, (.50 - ny) * 6, (tone - .5) * .45);
      tones.push(Math.max(0, Math.min(1, face ? (tone - .50) * 3 : (tone - .30) / .65)));
      for (let channel = 0; channel < 3; channel++) {
        const value = decoration ? [1, .84, .52][channel] : pixels[index + channel] / 255;
        colors.push(face ? Math.max(0, Math.min(1, (value - .5) * 1.9 + .5)) : value);
      }
      sizes.push(14 / width * stride * 1.18);
    }
  }
  return { positions: new Float32Array(positions), tones: new Float32Array(tones), colors: new Float32Array(colors), sizes: new Float32Array(sizes) };
}

export function heroPointToScreen(x, y, rect) {
  const scale = Math.max(rect.width / 3360, rect.height / 1440);
  return {
    x: rect.left + (rect.width - 3360 * scale) / 2 + (x / 14 + .48) * 3360 * scale,
    y: rect.top + (.50 - y / 6) * 1440 * scale,
  };
}
