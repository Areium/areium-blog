// A small header followed by contiguous float attributes. Decoding creates views,
// not per-particle JS objects, and preserves the original character's detail.
const MAGIC = 0x31435341; // ASC1
const attributes = [['positions', 3], ['tones', 1], ['colors', 3], ['sizes', 1]];

export function encodeAsciiPoints(data) {
  const count = data.tones.length;
  const buffer = new ArrayBuffer(8 + count * 32);
  new Uint32Array(buffer, 0, 2).set([MAGIC, count]);
  let offset = 8;
  for (const [name, width] of attributes) {
    if (data[name].length !== count * width) throw new Error(`Invalid ${name}`);
    new Float32Array(buffer, offset, count * width).set(data[name]);
    offset += count * width * 4;
  }
  return buffer;
}

export function decodeAsciiPoints(buffer) {
  if (buffer.byteLength < 8) throw new Error('Incomplete ASCII data');
  const [magic, count] = new Uint32Array(buffer, 0, 2);
  if (magic !== MAGIC || !count || buffer.byteLength !== 8 + count * 32) {
    throw new Error('Invalid ASCII data');
  }
  const data = {};
  let offset = 8;
  for (const [name, width] of attributes) {
    data[name] = new Float32Array(buffer, offset, count * width);
    offset += count * width * 4;
  }
  return data;
}
