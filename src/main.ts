import * as THREE from 'three';
import { Player } from './player';
import { buildGallery } from './rooms/gallery';
import { Overlay } from './ui/overlay';
import { launchUnity, type UnityHandle } from './unity-bridge';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

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
const overlay = new Overlay();
overlay.setMode('gate');

let unityHandle: UnityHandle | null = null;
let nearPedestal = false;
let enteringUnity = false;

overlay.onEnter = () => {
  overlay.setMode('gallery');
  player.lock();
};
overlay.onRecruiter = () => overlay.setMode('recruiter');
overlay.onExitRecruiter = () => overlay.setMode('gate');
overlay.onExitGallery = () => {
  player.unlock();
  overlay.setMode('gate');
};

player.controls.addEventListener('unlock', () => {
  if (unityHandle || enteringUnity) return;
  // Esc pressed during gallery — surface the gate so visitors can exit.
  overlay.setMode('gate');
});

async function enterUnity() {
  if (unityHandle || enteringUnity) return;
  enteringUnity = true;
  player.unlock();
  overlay.setMode('unity');
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
  if (!unityHandle) return;
  const h = unityHandle;
  unityHandle = null;
  await h.quit();
  overlay.setMode('gallery');
  player.lock();
}

document.getElementById('unity-exit')!.addEventListener('click', () => {
  void exitUnity();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyE' && nearPedestal && player.isLocked) {
    void enterUnity();
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.1);
  player.update(dt);

  const dist = camera.position.distanceTo(pedestal.position);
  const wasNear = nearPedestal;
  nearPedestal = dist < 2.5;
  if (nearPedestal !== wasNear && player.isLocked) {
    overlay.setHint(nearPedestal ? 'Press E to play the Unity build' : '');
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
