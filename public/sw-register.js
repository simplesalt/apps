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

        // Register the static service worker file
        const registration = await navigator.serviceWorker.register('/api-proxy-sw.js', {
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
