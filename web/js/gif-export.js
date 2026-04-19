/**
 * gif-export.js — Capture Three.js animation frames and export as animated GIF
 *
 * Renders each animation state into a WebGLRenderTarget, quantizes colors,
 * and produces a downloadable GIF via the GIFEncoder.
 */
import * as THREE from 'three';
import { GIFEncoder } from '../lib/gif-encoder.js';

/**
 * Export the Cube animation as an animated GIF.
 *
 * @param {CubeScene} cubeScene         - The Three.js scene wrapper
 * @param {AnimationController} anim    - The animation state controller
 * @param {object}  opts
 * @param {number}  [opts.width=640]             - GIF width in pixels
 * @param {number}  [opts.height=480]            - GIF height in pixels
 * @param {number}  [opts.framesPerTransition=10] - Interpolated frames per state transition
 * @param {number}  [opts.restDelay=60]          - Delay at each resting state (centiseconds)
 * @param {number}  [opts.frameDelay=10]         - Delay per transition frame (centiseconds)
 * @param {function} [opts.onProgress]           - Progress callback({phase, progress, detail})
 * @param {AbortSignal} [opts.signal]            - AbortSignal for cancellation
 * @returns {Promise<Blob|null>} GIF blob, or null if cancelled
 */
export async function exportGIF(cubeScene, anim, opts = {}) {
  const {
    width = 640,
    height = 480,
    framesPerTransition = 10,
    restDelay = 60,
    frameDelay = 10,
    onProgress = () => {},
    signal = null,
  } = opts;

  // ---- Save current state ----
  const wasPlaying = anim.playing;
  const savedState = anim.currentState;
  anim.pause();

  const savedPositions = cubeScene.rooms.map(r => [...r.currentPos]);

  // ---- Set up render target ----
  // Use sRGB color space so captured pixels match the on-screen appearance.
  // Without this, pixels are in linear space and appear much darker.
  const renderTarget = new THREE.WebGLRenderTarget(width, height);
  renderTarget.texture.colorSpace = THREE.SRGBColorSpace;
  const encoder = new GIFEncoder(width, height);

  const totalStates = anim.totalStates;
  const totalFrameCount = totalStates + totalStates * framesPerTransition;
  let framesDone = 0;

  function cancelled() { return signal && signal.aborted; }

  function cleanup() {
    renderTarget.dispose();
    // Restore room positions
    for (let i = 0; i < cubeScene.rooms.length && i < savedPositions.length; i++) {
      const [x, y, z] = savedPositions[i];
      cubeScene.rooms[i].currentPos = [x, y, z];
      cubeScene.rooms[i].mesh.position.set(x, y, z);
    }
    cubeScene.updateFeaturedStar();
    if (wasPlaying) anim.play();
  }

  try {
    // ---- Phase 1: Sample colors from key states ----
    onProgress({ phase: 'sampling', progress: 0, detail: '' });
    const samples = [];
    const sampleIndices = [0, 3, 6, 9].filter(i => i < totalStates);
    for (const idx of sampleIndices) {
      if (cancelled()) { cleanup(); return null; }
      _applyPositions(cubeScene, anim.states[idx]);
      samples.push(_captureFrame(cubeScene, renderTarget, width, height));
    }
    encoder.buildPalette(samples);
    // Free sample pixel data
    samples.length = 0;
    await _yieldToUI();

    if (cancelled()) { cleanup(); return null; }

    // ---- Phase 2: Capture & quantize all frames ----
    const frames = [];

    for (let s = 0; s < totalStates; s++) {
      if (cancelled()) { cleanup(); return null; }

      // Resting frame at state s
      _applyPositions(cubeScene, anim.states[s]);
      const restPx = _captureFrame(cubeScene, renderTarget, width, height);
      frames.push({ indexed: encoder.quantize(restPx), delay: restDelay });
      framesDone++;
      onProgress({
        phase: 'capturing',
        progress: framesDone / totalFrameCount,
        detail: `${framesDone} / ${totalFrameCount}`,
      });
      await _yieldToUI();

      // Transition frames: state s → state (s+1) % totalStates
      const nextS = (s + 1) % totalStates;
      const from = anim.states[s];
      const to = anim.states[nextS];

      for (let f = 1; f <= framesPerTransition; f++) {
        if (cancelled()) { cleanup(); return null; }

        let t = f / framesPerTransition;
        // Cubic ease in-out (matching the animation controller)
        t = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        const interp = _interpolate(from, to, t);
        _applyPositions(cubeScene, interp);

        const px = _captureFrame(cubeScene, renderTarget, width, height);
        frames.push({ indexed: encoder.quantize(px), delay: frameDelay });
        framesDone++;
        onProgress({
          phase: 'capturing',
          progress: framesDone / totalFrameCount,
          detail: `${framesDone} / ${totalFrameCount}`,
        });
        await _yieldToUI();
      }
    }

    if (cancelled()) { cleanup(); return null; }

    // ---- Phase 3: Encode GIF ----
    onProgress({ phase: 'encoding', progress: 0.95, detail: '' });
    await _yieldToUI();

    const gifBytes = encoder.encode(frames);

    cleanup();
    onProgress({ phase: 'done', progress: 1, detail: '' });

    return new Blob([gifBytes], { type: 'image/gif' });

  } catch (err) {
    cleanup();
    throw err;
  }
}

// ---- Internal helpers ----

function _applyPositions(scene, positions) {
  for (let i = 0; i < scene.rooms.length && i < positions.length; i++) {
    const [x, y, z] = positions[i];
    scene.rooms[i].currentPos = [x, y, z];
    scene.rooms[i].mesh.position.set(x, y, z);
  }
  scene.updateFeaturedStar();
}

function _interpolate(from, to, t) {
  const result = [];
  for (let i = 0; i < from.length; i++) {
    result.push([
      from[i][0] + (to[i][0] - from[i][0]) * t,
      from[i][1] + (to[i][1] - from[i][1]) * t,
      from[i][2] + (to[i][2] - from[i][2]) * t,
    ]);
  }
  return result;
}

function _captureFrame(scene, renderTarget, w, h) {
  const renderer = scene.renderer;
  const camera = scene.camera;

  // Temporarily adjust camera aspect ratio for GIF dimensions
  const origAspect = camera.aspect;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  // Render to the off-screen target
  renderer.setRenderTarget(renderTarget);
  renderer.render(scene.scene, camera);

  // Read pixels
  const pixels = new Uint8Array(w * h * 4);
  renderer.readRenderTargetPixels(renderTarget, 0, 0, w, h, pixels);

  // Restore default render target and camera
  renderer.setRenderTarget(null);
  camera.aspect = origAspect;
  camera.updateProjectionMatrix();

  // WebGL reads bottom-up; flip to top-down for GIF
  _flipY(pixels, w, h);

  return pixels;
}

function _flipY(pixels, w, h) {
  const stride = w * 4;
  const tmp = new Uint8Array(stride);
  const half = h >> 1;
  for (let y = 0; y < half; y++) {
    const topOff = y * stride;
    const botOff = (h - 1 - y) * stride;
    tmp.set(pixels.subarray(topOff, topOff + stride));
    pixels.set(pixels.subarray(botOff, botOff + stride), topOff);
    pixels.set(tmp, botOff);
  }
}

function _yieldToUI() {
  return new Promise(resolve => setTimeout(resolve, 0));
}
