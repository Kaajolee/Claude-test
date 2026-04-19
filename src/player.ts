import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

export class Player {
  readonly controls: PointerLockControls;
  private keys = new Set<string>();
  private speed = 4;

  constructor(camera: THREE.Camera, domElement: HTMLElement) {
    this.controls = new PointerLockControls(camera, domElement);
    camera.position.set(0, 1.6, 5);

    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  lock() { this.controls.lock(); }
  unlock() { this.controls.unlock(); }
  get isLocked() { return this.controls.isLocked; }

  update(dt: number) {
    if (!this.controls.isLocked) return;

    let forward = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
    let right   = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);

    if (forward && right) {
      forward *= Math.SQRT1_2;
      right *= Math.SQRT1_2;
    }

    const step = this.speed * dt;
    this.controls.moveForward(forward * step);
    this.controls.moveRight(right * step);
  }
}
