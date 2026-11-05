import * as THREE from 'three';
import { characterPoints, heroPointToScreen, HERO_SOURCE } from './ascii-character';

const glyphs = '.,:;-=+*xX#%@';
const vertexShader = `
  attribute float tone;
  attribute vec3 sourceColor;
  attribute float glyphSize;
  varying float vTone;
  varying vec3 vColor;
  uniform float viewportHeight;
  void main() {
    vTone = tone;
    vColor = sourceColor;
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = clamp(glyphSize * viewportHeight / -viewPosition.z, 1.0, 22.0);
  }
`;
const fragmentShader = `
  uniform sampler2D atlas;
  uniform vec3 ink;
  uniform float opacity;
  uniform float glyphCount;
  uniform float dark;
  varying float vTone;
  varying vec3 vColor;
  void main() {
    float glyph = floor(clamp(vTone, 0.0, 0.999) * glyphCount);
    vec2 uv = vec2((glyph + gl_PointCoord.x) / glyphCount, 1.0 - gl_PointCoord.y);
    float alpha = texture2D(atlas, uv).a;
    if (alpha < 0.05) discard;
    vec3 characterColor = mix(vColor * 0.35, vColor * 0.85 + 0.1, dark);
    gl_FragColor = vec4(mix(ink, characterColor, 0.85), alpha * opacity * (0.55 + vTone * 0.45));
  }
`;

export async function createAsciiScene(container, signal, onFailure, getSourceRect) {
  const response = await fetch(HERO_SOURCE, { signal });
  if (!response.ok) throw new Error('Hero image unavailable');
  const bitmap = await createImageBitmap(await response.blob());
  if (signal.aborted) { bitmap.close(); return () => {}; }
  const sample = document.createElement('canvas');
  sample.width = 1280;
  sample.height = 550;
  const context = sample.getContext('2d', { willReadFrequently: true });
  if (!context) { bitmap.close(); throw new Error('Canvas unavailable'); }
  context.drawImage(bitmap, 0, 0, sample.width, sample.height);
  bitmap.close();
  const data = characterPoints(context.getImageData(0, 0, sample.width, sample.height).data, sample.width, sample.height, 4);

  const resources = [];
  const listeners = new AbortController();
  let renderer, observer, disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    listeners.abort();
    observer?.disconnect();
    renderer?.setAnimationLoop(null);
    for (const resource of resources) resource.dispose();
    renderer?.dispose();
    renderer?.forceContextLoss();
    renderer?.domElement.remove();
  }

  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power' });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, .1, 100);
    const geometry = new THREE.BufferGeometry();
    resources.push(geometry);
    const positions = data.positions.slice();
    const velocities = new Float32Array(positions.length);
    const positionAttribute = new THREE.BufferAttribute(positions, 3);
    positionAttribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', positionAttribute);
    geometry.setAttribute('tone', new THREE.BufferAttribute(data.tones, 1));
    geometry.setAttribute('sourceColor', new THREE.BufferAttribute(data.colors, 3));
    geometry.setAttribute('glyphSize', new THREE.BufferAttribute(data.sizes, 1));

    const atlasCanvas = document.createElement('canvas');
    atlasCanvas.width = glyphs.length * 32;
    atlasCanvas.height = 32;
    const atlasContext = atlasCanvas.getContext('2d');
    atlasContext.font = 'bold 27px monospace';
    atlasContext.textAlign = 'center';
    atlasContext.textBaseline = 'middle';
    atlasContext.fillStyle = '#ffffff';
    for (let index = 0; index < glyphs.length; index++) atlasContext.fillText(glyphs[index], index * 32 + 16, 16);
    const atlas = new THREE.CanvasTexture(atlasCanvas);
    atlas.minFilter = THREE.LinearFilter;
    atlas.magFilter = THREE.LinearFilter;
    resources.push(atlas);
    const material = new THREE.ShaderMaterial({
      uniforms: { atlas: { value: atlas }, glyphCount: { value: glyphs.length }, ink: { value: new THREE.Color() }, dark: { value: 0 }, opacity: { value: .78 }, viewportHeight: { value: 1000 } },
      vertexShader, fragmentShader, transparent: true, depthWrite: false,
    });
    resources.push(material);
    const character = new THREE.Points(geometry, material);
    character.frustumCulled = false;
    scene.add(character);

    // Small geometric fragments occupy different depths around the character.
    const shards = [];
    const shardMaterial = new THREE.MeshBasicMaterial({ color: '#8c8c8c', transparent: true, opacity: .22, depthWrite: false, side: THREE.DoubleSide });
    resources.push(shardMaterial);
    for (let index = 0; index < 44; index++) {
      const sides = 3 + index % 4;
      const points = [];
      const radius = .10 + Math.random() * .26;
      for (let side = 0; side < sides; side++) {
        const angle = side / sides * Math.PI * 2;
        const scale = radius * (.5 + Math.random() * .7);
        points.push(new THREE.Vector3(Math.cos(angle) * scale, Math.sin(angle) * scale, 0));
      }
      const shardGeometry = new THREE.ShapeGeometry(new THREE.Shape(points.map(point => new THREE.Vector2(point.x, point.y))));
      resources.push(shardGeometry);
      const shard = new THREE.Mesh(shardGeometry, shardMaterial);
      shard.position.set((Math.random() - .5) * 17, (Math.random() - .5) * 9, -2 + Math.random() * 4);
      shard.rotation.set(Math.random(), Math.random(), Math.random() * Math.PI);
      shards.push({
        mesh: shard, phase: Math.random() * Math.PI * 2, speed: .25 + Math.random() * .45,
        velocity: new THREE.Vector3((Math.random() - .5) * .8, (Math.random() - .5) * .6, (Math.random() - .5) * .12),
      });
      scene.add(shard);
    }

    const darkInk = new THREE.Color('#9bc5e8');
    const lightInk = new THREE.Color('#426a83');
    const targetInk = new THREE.Color();
    let targetDark = 0;
    function syncTheme() {
      targetDark = document.documentElement.dataset.theme === 'dark' ? 1 : 0;
      targetInk.copy(targetDark ? darkInk : lightInk);
    }
    syncTheme();
    material.uniforms.ink.value.copy(targetInk);
    material.uniforms.dark.value = targetDark;
    observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let distance = 10, yaw = 0, pitch = 0, targetYaw = 0, targetPitch = 0;
    let drag = null, pointerActive = false, lastTime = null;
    const pointer = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const hit = new THREE.Vector3();
    const blocked = 'a,button,input,textarea,select,label,[role="button"],[contenteditable],.hero-copy,.post-card,.profile-panel,header,footer';
    const blank = 'body,main,.page-content,.shell,.section,.reading-layout,.home-reading,.post-card-grid,.areium-hero,.hero-wallpaper,.hero-wallpaper-image';
    function resize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      distance = camera.aspect < 1 ? 8.8 : 10.5;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      material.uniforms.viewportHeight.value = window.innerHeight * renderer.getPixelRatio() / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    }
    resize();
    const introDuration = reducedMotion.matches ? 0 : 1.8;
    let introElapsed = 0;
    const origins = data.positions.slice();
    const sourceRect = getSourceRect?.();
    if (sourceRect && introDuration > 0) {
      const visibleHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      for (let index = 0; index < origins.length; index += 3) {
        const screen = heroPointToScreen(data.positions[index], data.positions[index + 1], sourceRect);
        origins[index] = (screen.x / window.innerWidth - .5) * visibleHeight * camera.aspect;
        origins[index + 1] = (.5 - screen.y / window.innerHeight) * visibleHeight;
        origins[index + 2] = 0;
      }
      positions.set(origins);
    }
    const eventOptions = { signal: listeners.signal };
    window.addEventListener('resize', resize, eventOptions);
    window.addEventListener('pointermove', event => {
      if (event.pointerType !== 'mouse') return;
      pointer.set(event.clientX / window.innerWidth * 2 - 1, 1 - event.clientY / window.innerHeight * 2);
      pointerActive = !event.target.closest(blocked);
      if (drag && event.pointerId === drag.id) {
        targetYaw = THREE.MathUtils.clamp(drag.yaw + (event.clientX - drag.x) * .0007, -.18, .18);
        targetPitch = THREE.MathUtils.clamp(drag.pitch + (event.clientY - drag.y) * .0005, -.10, .10);
      }
    }, eventOptions);
    window.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'mouse' || event.button !== 0 || event.target.closest(blocked) || !event.target.matches(blank)) return;
      event.preventDefault();
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw: targetYaw, pitch: targetPitch };
    }, eventOptions);
    const release = () => { drag = null; };
    window.addEventListener('pointerup', release, eventOptions);
    window.addEventListener('pointercancel', release, eventOptions);
    window.addEventListener('blur', () => { release(); pointerActive = false; }, eventOptions);
    document.documentElement.addEventListener('pointerleave', () => { pointerActive = false; release(); }, eventOptions);
    renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      dispose();
      onFailure();
    }, eventOptions);

    function animate(time) {
      if (document.hidden) { lastTime = null; return; }
      const elapsed = (time - (lastTime ?? time)) / 1000;
      const dt = Math.min(elapsed, .035);
      lastTime = time;
      introElapsed = Math.min(introDuration, introElapsed + elapsed);
      const entering = introElapsed < introDuration;
      const smoothing = 1 - Math.exp(-dt * 6);
      yaw += (targetYaw - yaw) * smoothing;
      pitch += (targetPitch - pitch) * smoothing;
      camera.position.set(Math.sin(yaw) * distance, Math.sin(pitch) * distance, Math.cos(yaw) * distance);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      material.uniforms.ink.value.lerp(targetInk, smoothing);
      material.uniforms.dark.value += (targetDark - material.uniforms.dark.value) * smoothing;
      shardMaterial.opacity += ((targetDark ? .25 : .18) - shardMaterial.opacity) * smoothing;
      let touching = false;
      if (pointerActive && !entering) {
        raycaster.setFromCamera(pointer, camera);
        touching = raycaster.ray.intersectPlane(plane, hit) !== null;
      }
      for (let index = 0; index < positions.length; index += 3) {
        if (entering) {
          const progress = THREE.MathUtils.clamp((introElapsed - data.tones[index / 3] * .15) / 1.65, 0, 1);
          const eased = progress * progress * (3 - 2 * progress);
          for (let axis = 0; axis < 3; axis++) {
            const offset = index + axis;
            positions[offset] = origins[offset] + (data.positions[offset] - origins[offset]) * eased;
          }
          positions[index + 2] += Math.sin(progress * Math.PI) * .35;
          continue;
        }
        const dx = positions[index] - hit.x, dy = positions[index + 1] - hit.y;
        const squared = dx * dx + dy * dy;
        if (touching && squared < .32) {
          const length = Math.max(Math.sqrt(squared), .025);
          const force = (1 - length / .57) * 24 * dt;
          velocities[index] += (dx / length || .5) * force;
          velocities[index + 1] += (dy / length || .5) * force;
          velocities[index + 2] += force * .25;
        }
        for (let axis = 0; axis < 3; axis++) {
          const offset = index + axis;
          velocities[offset] += (data.positions[offset] - positions[offset]) * 4.5 * dt;
          velocities[offset] *= Math.exp(-3 * dt);
          positions[offset] += velocities[offset] * dt;
        }
      }
      positionAttribute.needsUpdate = true;
      if (!reducedMotion.matches) {
        for (const shard of shards) {
          shard.mesh.position.addScaledVector(shard.velocity, dt);
          shard.mesh.position.y += Math.sin(time * .001 + shard.phase) * dt * .12;
          if (shard.mesh.position.x > 10) shard.mesh.position.x = -10;
          if (shard.mesh.position.x < -10) shard.mesh.position.x = 10;
          if (shard.mesh.position.y > 6) shard.mesh.position.y = -6;
          if (shard.mesh.position.y < -6) shard.mesh.position.y = 6;
          if (Math.abs(shard.mesh.position.z) > 3) shard.velocity.z *= -1;
          shard.mesh.rotation.z += dt * shard.speed;
          shard.mesh.rotation.y += dt * shard.speed * .3;
        }
      }
      renderer.render(scene, camera);
    }
    renderer.setAnimationLoop(animate);
    return dispose;
  } catch (error) {
    dispose();
    throw error;
  }
}
