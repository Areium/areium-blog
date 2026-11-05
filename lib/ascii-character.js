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
export function characterPoints(pixels, width, height) {
  const positions = [], tones = [], colors = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = x / width, ny = y / height;
      if (!silhouette.some(polygon => inside(nx, ny, polygon))) continue;
      const index = (y * width + x) * 4;
      const tone = (pixels[index] * .2126 + pixels[index + 1] * .7152 + pixels[index + 2] * .0722) / 255;
      if (tone < .30) continue;
      positions.push((nx - .48) * 14, (.50 - ny) * 6, (tone - .5) * .45);
      tones.push(Math.min(1, (tone - .30) / .65));
      colors.push(pixels[index] / 255, pixels[index + 1] / 255, pixels[index + 2] / 255);
    }
  }
  return { positions: new Float32Array(positions), tones: new Float32Array(tones), colors: new Float32Array(colors) };
}
