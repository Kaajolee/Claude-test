import * as THREE from 'three';
import { loadOptional } from '../loader';

export interface Gallery {
  pedestal: THREE.Object3D;
}

// Drop a .glb at this path and it will replace the procedural baseline.
const HERO_MODEL_URL = '/models/room.glb';

export function buildGallery(scene: THREE.Scene, renderer: THREE.WebGLRenderer): Gallery {
  scene.background = new THREE.Color(0x12141a);
  scene.fog = new THREE.Fog(0x12141a, 10, 35);

  // Floor with a subtle grid so depth is legible without any glTF assets.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({ color: 0x3a3d44, roughness: 0.9 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(30, 30, 0x888888, 0x555555);
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.35;
  grid.position.y = 0.01;
  scene.add(grid);

  // Walls.
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x5a5d66, roughness: 0.8 });
  const wallGeo = new THREE.BoxGeometry(20, 4, 0.2);
  const walls: Array<[number, number, number, number]> = [
    [0, 2, -10, 0],
    [0, 2, 10, 0],
    [-10, 2, 0, Math.PI / 2],
    [10, 2, 0, Math.PI / 2],
  ];
  for (const [x, y, z, ry] of walls) {
    const w = new THREE.Mesh(wallGeo, wallMat);
    w.position.set(x, y, z);
    w.rotation.y = ry;
    scene.add(w);
  }

  // Placeholder "project frames" on the walls so it's obvious this is a
  // gallery even before real assets are dropped in.
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x222222,
    emissive: 0x3366ff,
    emissiveIntensity: 0.4,
  });
  const frameGeo = new THREE.BoxGeometry(2.5, 1.6, 0.05);
  const framePositions: Array<[number, number, number, number]> = [
    [-6, 2, -9.88, 0],
    [0, 2, -9.88, 0],
    [6, 2, -9.88, 0],
    [-9.88, 2, -3, Math.PI / 2],
    [-9.88, 2, 3, Math.PI / 2],
    [9.88, 2, -3, -Math.PI / 2],
    [9.88, 2, 3, -Math.PI / 2],
  ];
  for (const [x, y, z, ry] of framePositions) {
    const f = new THREE.Mesh(frameGeo, frameMat);
    f.position.set(x, y, z);
    f.rotation.y = ry;
    scene.add(f);
  }

  // Lighting — brighter so the procedural fallback is clearly visible.
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 1.3);
  key.position.set(5, 10, 5);
  scene.add(key);
  const fill = new THREE.PointLight(0xff6633, 1.2, 14);
  fill.position.set(0, 2.5, -5);
  scene.add(fill);
  const back = new THREE.PointLight(0x3366ff, 0.8, 20);
  back.position.set(0, 3, 8);
  scene.add(back);

  // Arcade pedestal: the Unity launcher.
  const pedestal = new THREE.Group();
  pedestal.position.set(0, 0, -5);

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.2, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x222222 })
  );
  base.position.y = 0.1;
  pedestal.add(base);

  const column = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 1.0, 0.8),
    new THREE.MeshStandardMaterial({
      color: 0xff6633,
      emissive: 0x331100,
      emissiveIntensity: 1,
    })
  );
  column.position.y = 0.7;
  pedestal.add(column);

  scene.add(pedestal);

  console.log('[gallery] procedural baseline ready (floor, 4 walls, 7 frames, pedestal)');

  // Async-load the artist's hero scene if present.
  void loadOptional(HERO_MODEL_URL, renderer).then((gltf) => {
    if (gltf) {
      console.log(`[gallery] loaded ${HERO_MODEL_URL}`);
      scene.add(gltf.scene);
    } else {
      console.log(`[gallery] no ${HERO_MODEL_URL} found — using procedural baseline`);
    }
  });

  return { pedestal };
}
