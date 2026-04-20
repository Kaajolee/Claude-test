import * as THREE from 'three';
import type { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Decoders are vendored under /public by scripts/vendor-decoders.mjs.
const DRACO_PATH = '/draco/';
const BASIS_PATH = '/basis/';

let loaderPromise: Promise<GLTFLoader> | null = null;

// All loader subclasses + the WASM/JS decoders are dynamically imported so
// they ship in a separate chunk and only download once a model actually loads.
async function buildLoader(renderer: THREE.WebGLRenderer): Promise<GLTFLoader> {
  const [
    { GLTFLoader: GLTFLoaderCtor },
    { DRACOLoader },
    { KTX2Loader },
    { MeshoptDecoder },
  ] = await Promise.all([
    import('three/examples/jsm/loaders/GLTFLoader.js'),
    import('three/examples/jsm/loaders/DRACOLoader.js'),
    import('three/examples/jsm/loaders/KTX2Loader.js'),
    import('three/examples/jsm/libs/meshopt_decoder.module.js'),
  ]);

  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_PATH);

  const ktx2 = new KTX2Loader();
  ktx2.setTranscoderPath(BASIS_PATH);
  ktx2.detectSupport(renderer);

  const loader = new GLTFLoaderCtor();
  loader.setDRACOLoader(draco);
  loader.setKTX2Loader(ktx2);
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader;
}

export function getLoader(renderer: THREE.WebGLRenderer): Promise<GLTFLoader> {
  if (!loaderPromise) loaderPromise = buildLoader(renderer);
  return loaderPromise;
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
  const loader = await getLoader(renderer);
  const gltf = await loader.loadAsync(url, opts.onProgress);
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
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
  }
}
