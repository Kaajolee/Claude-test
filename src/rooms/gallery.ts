import * as THREE from 'three';
import { loadOptional } from '../loader';

export interface Gallery {
  pedestal: THREE.Object3D;
}

// Drop a .glb at this path and it will replace the procedural baseline.
const HERO_MODEL_URL = '/models/room.glb';

export function buildGallery(scene: THREE.Scene, renderer: THREE.WebGLRenderer): Gallery {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.85 });
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

  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(5, 10, 5);
  scene.add(key);
  const fill = new THREE.PointLight(0xff6633, 0.8, 12);
  fill.position.set(0, 2.5, -5);
  scene.add(fill);

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
    new THREE.MeshStandardMaterial({ color: 0xff6633, emissive: 0x331100, emissiveIntensity: 1 })
  );
  column.position.y = 0.7;
  pedestal.add(column);

  scene.add(pedestal);

  // Async-load the artist's hero scene if present. Falls back silently.
  void loadOptional(HERO_MODEL_URL, renderer).then((gltf) => {
    if (gltf) scene.add(gltf.scene);
  });

  return { pedestal };
}
