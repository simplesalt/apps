/**
 * Universal API Proxy Registration Script
 * 
 * Works gracefully on any domain - detects environment and adapts
 * Registers the service worker and provides utilities for API proxying
 */

(function () {
  "use strict";

  // Configuration
  const CONFIG = {
    serviceWorkerUrl: 'https://apps.simplesalt.company/api-proxy-sw.js',
    authDomain: 'apps.simplesalt.company',
    currentDomain: window.location.hostname,
    isNativeDomain: false
  };

  // Detect if we're on the native domain
  CONFIG.isNativeDomain = CONFIG.currentDomain === CONFIG.authDomain;

  console.log('[API-Proxy] Initializing on domain:', CONFIG.currentDomain);
  console.log('[API-Proxy] Native domain:', CONFIG.isNativeDomain);

  // Only proceed if service workers are supported
  if (!("serviceWorker" in navigator)) {
    console.warn('[API-Proxy] Service workers not supported');
    window.apiProxy = {
      error: "Service workers not supported",
      supported: false
    };
    return;
  }

  // Initialize when page loads
  window.addEventListener("load", async () => {
    try {
      console.log('[API-Proxy] Registering service worker...');

      // Use relative URL on native domain, absolute URL elsewhere
      const swUrl = CONFIG.isNativeDomain ? '/api-proxy-sw.js' : CONFIG.serviceWorkerUrl;
      
      const registration = await navigator.serviceWorker.register(swUrl, {
        scope: "/",
      });

      console.log('[API-Proxy] Service worker registered successfully');

      // Wait for service worker to be ready
      await waitForServiceWorker(registration);

      // Initialize authentication if on native domain
      if (CONFIG.isNativeDomain) {
        await initializeAuthentication();
      }

      // Set up API proxy utilities
      setupAPIProxy(registration);

      console.log('🎉 Universal API proxy ready!');

    } catch (error) {
      console.error('[API-Proxy] Initialization failed:', error);
      setupErrorState(error);
    }
  });

  /**
   * Wait for service worker to be active
   */
  async function waitForServiceWorker(registration) {
    return new Promise((resolve) => {
      if (registration.active) {
        resolve();
      } else {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              resolve();
            }
          });
        });
      }
    });
  }

  /**
   * Initialize CF Zero Trust authentication (native domain only)
   */
  async function initializeAuthentication() {
    try {
      console.log('[API-Proxy] Initializing CF Zero Trust authentication...');
      
      // Load CF auth script if not already loaded
      if (!window.cfAuth) {
        await loadScript(CONFIG.isNativeDomain ? '/cf-auth.js' : 'https://apps.simplesalt.company/cf-auth.js');
      }

      // Initialize authentication
      if (window.cfAuth) {
        await window.cfAuth.initializeAuth();
        console.log('✅ CF Zero Trust authentication initialized');
      }
    } catch (error) {
      console.warn('⚠️ CF authentication failed, continuing without user auth:', error.message);
    }
  }

  /**
   * Load external script
   */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Set up API proxy utilities
   */
  function setupAPIProxy(registration) {
    // Maintain backward compatibility with existing swUtils
    window.swUtils = {
      reloadRoutingConfig: async () => {
        if (navigator.serviceWorker.controller) {
          const messageChannel = new MessageChannel();
          return new Promise((resolve, reject) => {
            messageChannel.port1.onmessage = (event) => {
              if (event.data.success) {
                console.log('[API-Proxy] Routing configuration reloaded');
                resolve(event.data);
              } else {
                console.error('[API-Proxy] Failed to reload routing config:', event.data.error);
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
      getStatus: () => ({
        supported: "serviceWorker" in navigator,
        registered: !!navigator.serviceWorker.controller,
        registration: registration,
        domain: CONFIG.currentDomain,
        isNativeDomain: CONFIG.isNativeDomain
      }),
      unregister: async () => {
        const result = await registration.unregister();
        console.log('[API-Proxy] Service worker unregistered:', result);
        return result;
      }
    };

    // New universal API proxy interface
    window.apiProxy = {
      test: async (url) => {
        console.log('🧪 Testing API call to:', url);
        try {
          const response = await fetch(url);
          console.log('✅ API call successful:', response.status, response.statusText);
          
          try {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const data = await response.clone().json();
              console.log('📄 Response preview:', JSON.stringify(data, null, 2).substring(0, 500) + '...');
            } else {
              const text = await response.clone().text();
              console.log('📄 Response preview:', text.substring(0, 200) + '...');
            }
          } catch (e) {
            console.log('📄 Response preview not available');
          }
          
          return response;
        } catch (error) {
          console.error('❌ API call failed:', error);
          throw error;
        }
      },

      status: () => window.swUtils.getStatus(),
      reloadConfig: () => window.swUtils.reloadRoutingConfig(),
      unregister: () => window.swUtils.unregister(),

      authenticate: async () => {
        if (!CONFIG.isNativeDomain) {
          throw new Error("Authentication only available on native domain");
        }
        if (window.cfAuth) {
          return await window.cfAuth.initializeAuth();
        } else {
          throw new Error("CF authentication not available");
        }
      }
    };

    // Handle service worker messages
    navigator.serviceWorker.addEventListener("message", (event) => {
      console.log('[API-Proxy] Message from service worker:', event.data);
      
      if (event.data.type === 'GET_CF_TOKEN') {
        let token = null;
        if (window.cfAuth) {
          token = window.cfAuth.getCFAccessToken();
        }
        event.ports[0].postMessage({ cfToken: token });
      }
    });

    // Handle service worker updates
    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      console.log('[API-Proxy] New service worker found, installing...');

      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed") {
          if (navigator.serviceWorker.controller) {
            console.log('[API-Proxy] New service worker installed, will activate on next page load');
          } else {
            console.log('[API-Proxy] Service worker installed and activated');
          }
        }
      });
    });

    console.log('🔧 API Proxy utilities available:');
    console.log('  - window.apiProxy.test(url) - Test API call');
    console.log('  - window.apiProxy.status() - Get status');
    console.log('  - window.apiProxy.reloadConfig() - Reload routing');
    if (CONFIG.isNativeDomain) {
      console.log('  - window.apiProxy.authenticate() - Force authentication');
    }
    console.log('  - window.swUtils.* - Legacy utilities (backward compatibility)');
  }

  /**
   * Set up error state
   */
  function setupErrorState(error) {
    window.apiProxy = {
      error: error.message,
      test: () => { throw new Error("API proxy not available: " + error.message); },
      status: () => ({ 
        error: error.message, 
        supported: "serviceWorker" in navigator, 
        registered: false,
        domain: CONFIG.currentDomain,
        isNativeDomain: CONFIG.isNativeDomain
      })
    };
    
    window.swUtils = {
      getStatus: () => window.apiProxy.status(),
      error: error.message
    };
  }

  console.log('[API-Proxy] Universal registration script loaded');
  console.log('[API-Proxy] Current URL:', window.location.href);
  console.log('[API-Proxy] Service worker support:', "serviceWorker" in navigator);

})();
