# Wiring a Unity WebGL Build

This document covers everything needed to connect a Unity build to the portfolio shell.

---

## 1. Build from Unity

1. Open **File → Build Settings** in Unity.
2. Switch platform to **WebGL**.
3. In **Player Settings → Publishing Settings**, set:
   - Compression Format: **Gzip** (Cloudflare Pages decompresses it automatically)
   - **Decompression Fallback**: enabled (safe default)
4. Set the **Product Name** to `portfolio` (must match — the loader script is named from this).
5. Click **Build** and choose an output folder (e.g. `unity-build/`).

---

## 2. Drop the build into `/public/unity/`

After building, the Unity output folder contains:

```
unity-build/
  Build/
    portfolio.loader.js
    portfolio.data
    portfolio.framework.js
    portfolio.wasm
  StreamingAssets/     ← only if you use it
  index.html           ← ignore this, we have our own shell
  TemplateData/        ← ignore this
```

Copy the contents into:

```
public/
  unity/
    Build/
      portfolio.loader.js
      portfolio.data
      portfolio.framework.js
      portfolio.wasm
    StreamingAssets/   ← optional
```

The shell expects exactly these paths. If your Product Name differs from `portfolio`, update the four `BUILD_PATH` references in `src/unity-bridge.ts`.

---

## 3. Add the `.jslib` plugin in Unity

This is the bridge that lets Unity fire events back to the JavaScript shell.

In your Unity project, create a file at:

```
Assets/Plugins/WebGL/PortfolioBridge.jslib
```

With this content:

```js
mergeInto(LibraryManager.library, {
  JS_OnGameEvent: function (jsonPtr) {
    var json = UTF8ToString(jsonPtr);
    if (window.onUnityGameEvent) {
      window.onUnityGameEvent(json);
    }
  }
});
```

This exposes one function, `JS_OnGameEvent`, that the JS shell already listens for via `window.onUnityGameEvent`.

---

## 4. Call the bridge from C#

In any C# script that needs to send events to the shell:

```csharp
using System.Runtime.InteropServices;
using UnityEngine;

public class PortfolioBridge : MonoBehaviour
{
    // Import the jslib function declared above.
    [DllImport("__Internal")]
    private static extern void JS_OnGameEvent(string json);

    // Helper: send any typed event to the Three.js shell.
    public static void Send(string type, string payload = null)
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        var json = payload != null
            ? $"{{\"type\":\"{type}\",\"payload\":{payload}}}"
            : $"{{\"type\":\"{type}\"}}";
        JS_OnGameEvent(json);
#else
        Debug.Log($"[bridge] {type} {payload}");
#endif
    }
}
```

> The `#if UNITY_WEBGL && !UNITY_EDITOR` guard prevents a crash in the Unity editor, which cannot call `__Internal` imports.

---

## 5. Events you can fire and what the shell does with them

The shell receives every event here (`src/main.ts`):

```ts
unityHandle = await launchUnity(container, unityCanvas, (event) => {
    console.log('[unity→js]', event);   // ← extend this
});
```

`event` is typed as:

```ts
interface UnityGameEvent {
  type: string;
  payload?: unknown;
}
```

### Built-in events (fired automatically)

| `type` | When | Shell behaviour |
|---|---|---|
| `ready` | Unity loader initialises | Logged to console |

### Suggested events to add in your C# scripts

| `type` | When to fire | Extend shell to... |
|---|---|---|
| `room_entered` | Player enters a scene/room | Unlock a new frame/badge in Three.js |
| `collectible_found` | Player picks up an item | Show a toast notification in HTML overlay |
| `game_complete` | End of experience | Open a project detail panel |
| `score` | Score updates | Display a score HUD element |

**Example from C#:**

```csharp
// When the player discovers a hidden area:
PortfolioBridge.Send("room_entered", "\"ancient-ruins\"");

// When something is collected:
PortfolioBridge.Send("collectible_found", "{\"id\":\"rune_01\",\"name\":\"Ancient Rune\"}");
```

**Handling in the shell** (`src/main.ts`):

```ts
unityHandle = await launchUnity(container, unityCanvas, (event) => {
    console.log('[unity→js]', event);

    if (event.type === 'room_entered') {
        console.log('Player entered:', event.payload);
        // e.g. unlock a gallery frame
    }

    if (event.type === 'collectible_found') {
        const item = event.payload as { id: string; name: string };
        // e.g. show toast or persist to localStorage
    }
});
```

---

## 6. Send messages from JavaScript → Unity

Use Unity's built-in `SendMessage`. The shell exposes the Unity instance as `window.__unityInstance` if you need to reach it from outside the bridge file — but the cleaner approach is to extend `unity-bridge.ts`.

Add a `send` method to `UnityHandle`:

```ts
// src/unity-bridge.ts — extend the real launcher block
return {
    quit: async () => { await instance.Quit(); },
    send: (object: string, method: string, value?: string) => {
        instance.SendMessage(object, method, value ?? '');
    },
};
```

Then in C# expose a receiver:

```csharp
// On a GameObject named "GameManager":
public void SetPlayerName(string name) { ... }
public void TriggerCutscene(string id) { ... }
```

Call it from the shell:

```ts
unityHandle.send('GameManager', 'SetPlayerName', 'Visitor');
unityHandle.send('GameManager', 'TriggerCutscene', 'intro');
```

---

## 7. Proximity prefetch (already wired)

`src/main.ts` fires `<link rel="prefetch">` for all four Unity build files as soon as the player crosses **6 metres** of the pedestal — before they press E. By the time they press E (at 2.5m), the files should already be in the browser cache.

If your build files are renamed or at a different path, update `PREFETCH_RADIUS` and the URL list in `main.ts`:

```ts
const PREFETCH_RADIUS = 6;   // metres — how far out to start prefetching
const INTERACT_RADIUS = 2.5; // metres — how close to trigger the E prompt

// Update these if your build path changes:
prefetchMany([
    ['/unity/Build/portfolio.loader.js', 'script'],
    '/unity/Build/portfolio.data',
    '/unity/Build/portfolio.wasm',
    ['/unity/Build/portfolio.framework.js', 'script'],
]);
```

---

## 8. Testing without a build

If no build files exist, `src/unity-bridge.ts` falls back to a placeholder canvas that:
- Fills the overlay with a dark background + instructional text
- Fires a synthetic `{ type: 'ready', payload: { placeholder: true } }` event after 300ms
- Responds to Exit game normally

This means the entire UI flow — Enter gallery → walk to pedestal → press E → Exit game — is testable before you have a Unity build ready.

---

## 9. Service worker caching

The Workbox service worker (generated at build time) caches `/unity/*` under a `CacheFirst` strategy with a 30-day TTL. On repeat visits, the Unity build loads from the local cache — no network round-trip.

If you ship an updated build, bump the Unity **Product Version** in Player Settings. The loader URL stays the same so you need to **clear the `unity` cache name** or increment a cache-busting query string. Alternatively, fingerprint the build files in your CI pipeline and update the paths in `unity-bridge.ts` accordingly.
