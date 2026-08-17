const VERSION = "ebdaa-media-pwa-v1";
const CACHE_NAME = VERSION + "-core";

const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    for (const url of CORE) {
      try {
        const res = await fetch(url, { cache: "no-store" });

        if (res && res.ok) {
          await cache.put(url, res.clone());
        }
      } catch (_) {}
    }

    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    await Promise.all(
      keys
        .filter(
          key =>
            key.startsWith("ebdaa-media-pwa-") &&
            key !== CACHE_NAME
        )
        .map(key => caches.delete(key))
    );

    await self.clients.claim();
  })());
});

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request, {
      cache: "no-store"
    });

    if (response && response.ok) {
      await cache.put(
        request,
        response.clone()
      );

      if (
        fallbackUrl &&
        request.mode === "navigate"
      ) {
        await cache.put(
          fallbackUrl,
          response.clone()
        );
      }
    }

    return response;

  } catch (_) {

    return (
      (await cache.match(request)) ||

      (
        fallbackUrl
          ? await cache.match(fallbackUrl)
          : undefined
      ) ||

      new Response(
        "Offline",
        {
          status: 503,
          statusText: "Offline"
        }
      )
    );
  }
}

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // نخلي Firebase والملفات الخارجية تشتغل مباشرة من الإنترنت
  if (url.origin !== self.location.origin) {
    return;
  }

  // دائماً جيب أحدث نسخة من Service Worker
  if (
    url.pathname.endsWith(
      "/service-worker.js"
    )
  ) {
    event.respondWith(
      fetch(
        request,
        {
          cache: "no-store"
        }
      )
    );

    return;
  }

  // صفحات الموقع: الإنترنت أولاً ثم الكاش عند انقطاع النت
  if (request.mode === "navigate") {
    event.respondWith(
      networkFirst(
        request,
        "./index.html"
      )
    );

    return;
  }

  // باقي الملفات المحلية
  event.respondWith(
    networkFirst(request)
  );
});
