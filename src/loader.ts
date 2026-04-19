import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// Decoder paths. For production, vendor these into /public/ and update the
// paths to '/draco/' and '/basis/'. The CDN versions work for local dev.
const DRACO_PATH = 'https://www.gstatic.com/draco/v1/decoders/';
const BASIS_PATH = 'https://unpkg.com/three@0.160.0/examples/jsm/libs/basis/';

let cached: GLTFLoader | null = null;

export function getLoader(renderer: THREE.WebGLRenderer): GLTFLoader {
  if (cached) return cached;

  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_PATH);

  const ktx2 = new KTX2Loader();
  ktx2.setTranscoderPath(BASIS_PATH);
  ktx2.detectSupport(renderer);

  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  loader.setKTX2Loader(ktx2);
  loader.setMeshoptDecoder(MeshoptDecoder);

  cached = loader;
  return loader;
}

export interface LoadOptions {
  position?: THREE.Vector3Tuple;
  rotation?: THREE.Vector3Tuple;
  scale?: number | THREE.Vector3Tuple;
  shadows?: boolean;
  onProgress?: (event: ProgressEvent) => void;
}

export async function loadModel(
  url: string,
  renderer: THREE.WebGLRenderer,
  opts: LoadOptions = {}
): Promise<GLTF> {
  const gltf = await getLoader(renderer).loadAsync(url, opts.onProgress);
  applyOptions(gltf.scene, opts);
  return gltf;
}

// Returns null if the file is missing — keeps dev unblocked when the artist
// hasn't dropped a model in yet.
export async function loadOptional(
  url: string,
  renderer: THREE.WebGLRenderer,
  opts: LoadOptions = {}
): Promise<GLTF | null> {
  try {
    const head = await fetch(url, { method: 'HEAD' });
    if (!head.ok) return null;
    return await loadModel(url, renderer, opts);
  } catch (err) {
    console.warn(`[loader] failed to load ${url}:`, err);
    return null;
  }
}

function applyOptions(root: THREE.Object3D, opts: LoadOptions) {
  if (opts.position) root.position.fromArray(opts.position);
  if (opts.rotation) root.rotation.fromArray(opts.rotation);
  if (opts.scale !== undefined) {
    if (typeof opts.scale === 'number') root.scale.setScalar(opts.scale);
    else root.scale.fromArray(opts.scale);
  }
  if (opts.shadows ?? true) {
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
    });
  }
}
