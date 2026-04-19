// Bridge between the Three.js portfolio shell and a Unity WebGL build.
//
// Drop your Unity WebGL build into /public/unity/ so these files resolve:
//   /unity/Build/portfolio.loader.js
//   /unity/Build/portfolio.data
//   /unity/Build/portfolio.framework.js
//   /unity/Build/portfolio.wasm
//   /unity/StreamingAssets/*
//
// In Unity, add a .jslib plugin to forward events to the page:
//
//   mergeInto(LibraryManager.library, {
//     JS_OnGameEvent: function (jsonPtr) {
//       var json = UTF8ToString(jsonPtr);
//       if (window.onUnityGameEvent) window.onUnityGameEvent(json);
//     }
//   });
//
// And from C#:
//   [DllImport("__Internal")] private static extern void JS_OnGameEvent(string json);

export interface UnityGameEvent {
  type: string;
  payload?: unknown;
}

export interface UnityHandle {
  quit: () => Promise<void>;
}

type UnityInstance = { Quit: () => Promise<void> };

declare global {
  interface Window {
    createUnityInstance?: (
      canvas: HTMLCanvasElement,
      config: Record<string, unknown>
    ) => Promise<UnityInstance>;
    onUnityGameEvent?: (json: string) => void;
  }
}

const BUILD_PATH = '/unity/Build';
const LOADER_URL = `${BUILD_PATH}/portfolio.loader.js`;

let loaderPromise: Promise<void> | null = null;
function loadLoaderScript(): Promise<void> {
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${LOADER_URL}"]`);
    if (existing) { resolve(); return; }
    const script = document.createElement('script');
    script.src = LOADER_URL;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Unity loader not found'));
    document.head.appendChild(script);
  });
  return loaderPromise;
}

export async function launchUnity(
  container: HTMLElement,
  canvas: HTMLCanvasElement,
  onEvent: (event: UnityGameEvent) => void
): Promise<UnityHandle> {
  window.onUnityGameEvent = (json) => {
    try { onEvent(JSON.parse(json) as UnityGameEvent); }
    catch { onEvent({ type: 'raw', payload: json }); }
  };

  try {
    await loadLoaderScript();
    if (!window.createUnityInstance) throw new Error('createUnityInstance missing');

    const instance = await window.createUnityInstance(canvas, {
      dataUrl: `${BUILD_PATH}/portfolio.data`,
      frameworkUrl: `${BUILD_PATH}/portfolio.framework.js`,
      codeUrl: `${BUILD_PATH}/portfolio.wasm`,
      streamingAssetsUrl: '/unity/StreamingAssets',
      companyName: 'You',
      productName: 'Portfolio',
      productVersion: '0.1',
    });

    return {
      quit: async () => {
        await instance.Quit();
        window.onUnityGameEvent = undefined;
      },
    };
  } catch (err) {
    console.warn('[unity-bridge] falling back to placeholder:', err);
    return mountPlaceholder(container, canvas, onEvent);
  }
}

function mountPlaceholder(
  container: HTMLElement,
  canvas: HTMLCanvasElement,
  onEvent: (event: UnityGameEvent) => void
): UnityHandle {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');

  const render = () => {
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;
    canvas.width = w;
    canvas.height = h;
    ctx.fillStyle = '#101820';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#eee';
    ctx.textAlign = 'center';
    ctx.font = '600 22px system-ui, sans-serif';
    ctx.fillText('Unity WebGL build mounts here', w / 2, h / 2 - 12);
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Drop your build into /public/unity/ to wire it up.', w / 2, h / 2 + 16);
  };
  render();
  const onResize = () => render();
  window.addEventListener('resize', onResize);

  setTimeout(() => onEvent({ type: 'ready', payload: { placeholder: true } }), 300);

  return {
    quit: async () => {
      window.removeEventListener('resize', onResize);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      window.onUnityGameEvent = undefined;
    },
  };
}
