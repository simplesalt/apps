/**
 * Authentication Proxy Loader
 * 
 * Simple registration script that can be embedded in any webpage
 * to activate the authentication proxy service worker.
 * 
 * Usage:
 * <script src="https://apps.simplesalt.company/auth-proxy-loader.js"></script>
 * 
 * Or for Plasmic page elements:
 * <script>
 *   (function(){
 *     const script = document.createElement('script');
 *     script.src = 'https://apps.simplesalt.company/auth-proxy-loader.js';
 *     document.head.appendChild(script);
 *   })();
 * </script>
 */

(function() {
  'use strict';
  
  // Configuration
  const CONFIG = {
    serviceWorkerUrl: 'https://apps.simplesalt.company/auth-proxy-sw.js',
    scope: '/',
    enableLogging: true
  };
  
  function log(...args) {
    if (CONFIG.enableLogging) {
      console.log('[Auth Proxy]', ...args);
    }
  }
  
  function logError(...args) {
    console.error('[Auth Proxy]', ...args);
  }
  
  // Register service worker
  async function registerAuthProxy() {
    if (!('serviceWorker' in navigator)) {
      logError('Service workers not supported in this browser');
      return false;
    }
    
    try {
      log('Registering authentication proxy service worker...');
      
      const registration = await navigator.serviceWorker.register(CONFIG.serviceWorkerUrl, {
        scope: CONFIG.scope
      });
      
      log('✅ Service worker registered successfully:', registration.scope);
      
      // Handle updates
      registration.addEventListener('updatefound', () => {
        log('🔄 Service worker update found');
        const newWorker = registration.installing;
        
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              log('🔄 New service worker available. Refresh the page to use it.');
            } else {
              log('✅ Service worker installed successfully');
            }
          }
        });
      });
      
      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;
      log('✅ Authentication proxy ready on domain:', window.location.hostname);
      
      return true;
      
    } catch (error) {
      logError('❌ Failed to register service worker:', error);
      return false;
    }
  }
  
  // Initialize when DOM is ready
  function initialize() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', registerAuthProxy);
    } else {
      registerAuthProxy();
    }
  }
  
  // Auto-initialize
  initialize();
  
  // Export for manual control if needed
  window.authProxy = {
    register: registerAuthProxy,
    reloadConfig: async function() {
      if (!navigator.serviceWorker.controller) {
        logError('No active service worker to reload config');
        return false;
      }
      
      try {
        const messageChannel = new MessageChannel();
        const response = await new Promise((resolve) => {
          messageChannel.port1.onmessage = (event) => resolve(event.data);
          navigator.serviceWorker.controller.postMessage(
            { type: 'RELOAD_ROUTING_CONFIG' }, 
            [messageChannel.port2]
          );
        });
        
        if (response.success) {
          log('✅ Routing config reloaded:', response.rules, 'rules');
          return true;
        } else {
          logError('❌ Failed to reload config:', response.error);
          return false;
        }
      } catch (error) {
        logError('❌ Error reloading config:', error);
        return false;
      }
    }
  };
  
  log('🚀 Auth Proxy Loader initialized');
})();
