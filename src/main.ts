import * as THREE from 'three';
import { Player } from './player';
import { buildGallery } from './rooms/gallery';
import { Overlay, type Mode } from './ui/overlay';
import { launchUnity, type UnityHandle } from './unity-bridge';
import { AdaptiveDPR } from './perf';

interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  player: Player;
  pedestal: THREE.Object3D;
  adaptiveDpr: AdaptiveDPR;
}

const overlay = new Overlay();
let currentMode: Mode = 'gate';
overlay.setMode(currentMode);

let stage: Stage | null = null;
let unityHandle: UnityHandle | null = null;
let nearPedestal = false;
let enteringUnity = false;
let running = false;
let rafId = 0;
const clock = new THREE.Clock();

function setMode(mode: Mode) {
  currentMode = mode;
  overlay.setMode(mode);
  updateRunning();
}

// The render loop only runs when the tab is visible AND the user is in the
// gallery. Anywhere else (gate, recruiter view, Unity) we cancel the RAF so
// the GPU and main thread idle completely.
function updateRunning() {
  const shouldRun =
    stage !== null &&
    document.visibilityState === 'visible' &&
    currentMode === 'gallery';
  if (shouldRun === running) return;
  running = shouldRun;
  if (running && stage) {
    clock.start();
    stage.adaptiveDpr.reset();
    rafId = requestAnimationFrame(tick);
  } else if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
}

function tick() {
  if (!stage || !running) return;
  const dt = Math.min(clock.getDelta(), 0.1);
  stage.player.update(dt);

  const dist = stage.camera.position.distanceTo(stage.pedestal.position);
  const wasNear = nearPedestal;
  nearPedestal = dist < 2.5;
  if (nearPedestal !== wasNear && stage.player.isLocked) {
    overlay.setHint(nearPedestal ? 'Press E to play the Unity build' : '');
  }

  stage.renderer.render(stage.scene, stage.camera);
  stage.adaptiveDpr.sample(dt);
  rafId = requestAnimationFrame(tick);
}

function initStage(): Stage {
  const canvas = document.getElementById('scene') as HTMLCanvasElement;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const adaptiveDpr = new AdaptiveDPR(renderer);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0a);
  scene.fog = new THREE.Fog(0x0a0a0a, 8, 28);

  const camera = new THREE.PerspectiveCamera(
    72,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );

  const player = new Player(camera, document.body);
  const { pedestal } = buildGallery(scene, renderer);

  player.controls.addEventListener('unlock', () => {
    if (unityHandle || enteringUnity) return;
    setMode('gate');
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { renderer, scene, camera, player, pedestal, adaptiveDpr };
}

overlay.onEnter = () => {
  if (!stage) stage = initStage();
  setMode('gallery');
  stage.player.lock();
};
overlay.onRecruiter = () => setMode('recruiter');
overlay.onExitRecruiter = () => setMode('gate');
overlay.onExitGallery = () => {
  stage?.player.unlock();
  setMode('gate');
};

document.addEventListener('visibilitychange', updateRunning);

async function enterUnity() {
  if (!stage || unityHandle || enteringUnity) return;
  enteringUnity = true;
  stage.player.unlock();
  setMode('unity');
  overlay.setLoading(true);

  const container = document.getElementById('unity-container') as HTMLElement;
  const unityCanvas = document.getElementById('unity-canvas') as HTMLCanvasElement;

  unityHandle = await launchUnity(container, unityCanvas, (event) => {
    // Unity -> JS. Hook badges, scene unlocks, analytics here.
    console.log('[unity→js]', event);
  });

  overlay.setLoading(false);
  enteringUnity = false;
}

async function exitUnity() {
  if (!stage || !unityHandle) return;
  const h = unityHandle;
  unityHandle = null;
  await h.quit();
  setMode('gallery');
  stage.player.lock();
}

document.getElementById('unity-exit')!.addEventListener('click', () => {
  void exitUnity();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyE' && nearPedestal && stage?.player.isLocked) {
    void enterUnity();
  }
});
