export function createParticleMotion(rest) {
  const positions = rest.slice();
  const velocities = new Float32Array(rest.length);
  const awake = new Uint8Array(rest.length / 3);
  let moving = 0;
  return {
    positions,
    update(dt, touching, hit) {
      if (!touching && moving === 0) return false;
      const damping = Math.exp(-3 * dt);
      let changed = false;
      for (let index = 0; index < positions.length; index += 3) {
        const point = index / 3;
        if (touching) {
          const dx = positions[index] - hit.x, dy = positions[index + 1] - hit.y;
          const squared = dx * dx + dy * dy;
          if (squared < .32) {
            const length = Math.max(Math.sqrt(squared), .025);
            const force = (1 - length / .57) * 24 * dt;
            velocities[index] += (dx / length || .5) * force;
            velocities[index + 1] += (dy / length || .5) * force;
            velocities[index + 2] += force * .25;
            if (!awake[point]) { awake[point] = 1; moving++; }
          }
        }
        if (!awake[point]) continue;
        changed = true;
        let settled = true;
        for (let axis = 0; axis < 3; axis++) {
          const offset = index + axis;
          velocities[offset] += (rest[offset] - positions[offset]) * 4.5 * dt;
          velocities[offset] *= damping;
          positions[offset] += velocities[offset] * dt;
          if (Math.abs(velocities[offset]) > .001 || Math.abs(rest[offset] - positions[offset]) > .0005) settled = false;
        }
        if (settled) {
          for (let axis = 0; axis < 3; axis++) {
            positions[index + axis] = rest[index + axis];
            velocities[index + axis] = 0;
          }
          awake[point] = 0;
          moving--;
        }
      }
      return changed;
    },
  };
}
