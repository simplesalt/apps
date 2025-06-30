/**
 * Service Worker Registration Script
 *
 * This script registers the service worker for API call interception.
 * It's designed to be loaded independently and won't interfere with
 * Plasmic or other application code.
 */

(function () {
  "use strict";

  // Only register service worker in browsers that support it
  if ("serviceWorker" in navigator) {
    // Wait for the page to load before registering
    window.addEventListener("load", async () => {
      try {
        console.log("[SW-Register] Registering service worker...");

        // For static exports, we'll create the service worker inline
        const swCode = `
// API Interception Service Worker
// Intercepts API calls and routes them through CF Worker based on routing.json

let routingRules = [];

// Fetch routing configuration on service worker activation
self.addEventListener('activate', async (event) => {
  console.log('🔧 Service Worker activated');
  
  event.waitUntil(
    (async () => {
      try {
        const response = await fetch('apps.simplesalt.company/routing.json');
        if (response.ok) {
          routingRules = await response.json();
          console.log('📋 Loaded routing rules:', routingRules);
        } else {
          console.error('❌ Failed to load routing.json:', response.status);
        }
      } catch (error) {
        console.error('❌ Error loading routing rules:', error);
      }
    })()
  );
});

// Intercept fetch requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Find matching routing rule
  const rule = routingRules.find(r => url.hostname.includes(r.domain));
  
  if (rule && (rule.authType === 2 || rule.authType === 3)) {
    console.log('🔄 Intercepting API call to:', url.hostname);
    
    event.respondWith(
      (async () => {
        try {
          // Get CF Access token from cookie or storage
          const cfToken = await getCFAccessToken();
          
          // Route through CF Worker
          const workerUrl = 'https://nuywznihg08edfslfk29.api.simplesalt.company';
          const proxyUrl = \`\${workerUrl}/proxy\`;
          
          const modifiedRequest = new Request(proxyUrl, {
            method: event.request.method,
            headers: {
              ...Object.fromEntries(event.request.headers.entries()),
              'X-Original-URL': event.request.url,
              'X-CF-Access-Token': cfToken || '',
              'X-Auth-Type': rule.authType.toString()
            },
            body: event.request.body
          });
          
          const response = await fetch(modifiedRequest);
          console.log('✅ Proxied request completed:', response.status);
          return response;
          
        } catch (error) {
          console.error('❌ Proxy request failed:', error);
          // Fallback to direct request
          return fetch(event.request);
        }
      })()
    );
  }
});

// Helper function to get CF Access token
async function getCFAccessToken() {
  try {
    // Try to get token from cookie
    const cookies = await self.cookieStore?.getAll?.() || [];
    const cfCookie = cookies.find(c => c.name.includes('CF_Authorization'));
    
    if (cfCookie) {
      return cfCookie.value;
    }
    
    // Try to get from localStorage (if available in service worker context)
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('cf_access_token');
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error getting CF Access token:', error);
    return null;
  }
}

console.log('🚀 API Interception Service Worker loaded');
        `;

        // Create a blob URL for the service worker
        const swBlob = new Blob([swCode], { type: "application/javascript" });
        const swUrl = URL.createObjectURL(swBlob);

        const registration = await navigator.serviceWorker.register(swUrl, {
          scope: "/",
        });

        console.log(
          "[SW-Register] Service worker registered successfully:",
          registration
        );

        // Handle service worker updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          console.log("[SW-Register] New service worker found, installing...");

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed") {
              if (navigator.serviceWorker.controller) {
                console.log(
                  "[SW-Register] New service worker installed, will activate on next page load"
                );
              } else {
                console.log(
                  "[SW-Register] Service worker installed and activated"
                );
              }
            }
          });
        });

        // Listen for service worker messages
        navigator.serviceWorker.addEventListener("message", (event) => {
          console.log("[SW-Register] Message from service worker:", event.data);
        });

        // Expose utility functions to window for debugging
        window.swUtils = {
          // Reload routing configuration
          reloadRoutingConfig: async () => {
            if (navigator.serviceWorker.controller) {
              const messageChannel = new MessageChannel();

              return new Promise((resolve, reject) => {
                messageChannel.port1.onmessage = (event) => {
                  if (event.data.success) {
                    console.log("[SW-Register] Routing configuration reloaded");
                    resolve(event.data);
                  } else {
                    console.error(
                      "[SW-Register] Failed to reload routing config:",
                      event.data.error
                    );
                    reject(new Error(event.data.error));
                  }
                };

                navigator.serviceWorker.controller.postMessage(
                  { type: "RELOAD_ROUTING_CONFIG" },
                  [messageChannel.port2]
                );
              });
            } else {
              throw new Error("No active service worker");
            }
          },

          // Get service worker status
          getStatus: () => {
            return {
              supported: "serviceWorker" in navigator,
              registered: !!navigator.serviceWorker.controller,
              registration: registration,
            };
          },

          // Unregister service worker (for debugging)
          unregister: async () => {
            const result = await registration.unregister();
            console.log("[SW-Register] Service worker unregistered:", result);
            return result;
          },
        };
      } catch (error) {
        console.error(
          "[SW-Register] Service worker registration failed:",
          error
        );
      }
    });
  } else {
    console.warn(
      "[SW-Register] Service workers are not supported in this browser"
    );
  }
})();

// Add some helpful debug information
console.log("[SW-Register] Service worker registration script loaded");
console.log("[SW-Register] Current URL:", window.location.href);
console.log(
  "[SW-Register] Service worker support:",
  "serviceWorker" in navigator
);
