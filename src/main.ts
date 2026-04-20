import * as THREE from 'three';
import { Player } from './player';
import { buildGallery } from './rooms/gallery';
import { Overlay, type Mode } from './ui/overlay';
import { launchUnity, type UnityHandle } from './unity-bridge';
import { AdaptiveDPR } from './perf';
import { prefetchMany } from './prefetch';

console.log('[app] booted');

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
let prefetchedUnity = false;
let enteringUnity = false;
let running = false;
let rafId = 0;
const clock = new THREE.Clock();

const INTERACT_RADIUS = 2.5;
const PREFETCH_RADIUS = 6;

function setMode(mode: Mode) {
  currentMode = mode;
  overlay.setMode(mode);
  updateRunning();
}

function updateRunning() {
  const shouldRun =
    stage !== null &&
    document.visibilityState === 'visible' &&
    currentMode === 'gallery';
  if (shouldRun === running) return;
  running = shouldRun;
  console.log(`[runloop] ${running ? 'resumed' : 'paused'} (mode=${currentMode}, visible=${document.visibilityState === 'visible'})`);
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
  nearPedestal = dist < INTERACT_RADIUS;
  if (nearPedestal !== wasNear && stage.player.isLocked) {
    console.log(`[pedestal] ${nearPedestal ? 'entered' : 'left'} interact range (${dist.toFixed(2)}m)`);
    overlay.setHint(nearPedestal ? 'Press E to play the Unity build' : '');
  }

  if (!prefetchedUnity && dist < PREFETCH_RADIUS) {
    prefetchedUnity = true;
    console.log('[pedestal] crossed prefetch radius → prefetching Unity build');
    prefetchMany([
      ['/unity/Build/portfolio.loader.js', 'script'],
      '/unity/Build/portfolio.data',
      '/unity/Build/portfolio.wasm',
      ['/unity/Build/portfolio.framework.js', 'script'],
    ]);
  }

  stage.renderer.render(stage.scene, stage.camera);
  stage.adaptiveDpr.sample(dt);
  rafId = requestAnimationFrame(tick);
}

function initStage(): Stage {
  console.log('[stage] initializing WebGL renderer + scene');
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

  player.controls.addEventListener('lock', () => {
    console.log('[player] pointer locked');
  });
  player.controls.addEventListener('unlock', () => {
    console.log('[player] pointer unlocked');
    if (unityHandle || enteringUnity) return;
    setMode('gate');
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  console.log(`[stage] ready (DPR=${adaptiveDpr.current})`);
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

document.addEventListener('visibilitychange', () => {
  console.log(`[visibility] ${document.visibilityState}`);
  updateRunning();
});

async function enterUnity() {
  if (!stage || unityHandle || enteringUnity) return;
  console.log('[unity] pressing E → launching');
  enteringUnity = true;
  stage.player.unlock();
  setMode('unity');
  overlay.setLoading(true);

  const container = document.getElementById('unity-container') as HTMLElement;
  const unityCanvas = document.getElementById('unity-canvas') as HTMLCanvasElement;

  unityHandle = await launchUnity(container, unityCanvas, (event) => {
    console.log('[unity→js]', event);
  });

  overlay.setLoading(false);
  enteringUnity = false;
  console.log('[unity] launched');
}

async function exitUnity() {
  if (!stage || !unityHandle) return;
  console.log('[unity] exiting');
  const h = unityHandle;
  unityHandle = null;
  await h.quit();
  setMode('gallery');
  stage.player.lock();
}

document.getElementById('unity-exit')!.addEventListener('click', () => {
  console.log('[ui] click: Exit game');
  void exitUnity();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyE' && nearPedestal && stage?.player.isLocked) {
    void enterUnity();
  }
});
