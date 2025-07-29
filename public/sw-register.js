/**
 * API Proxy Registration Script (Simplified)
 * 
 * This file is maintained for backward compatibility.
 * New integrations should use auth-proxy-loader.js directly.
 */

(function() {
  'use strict';
  
  console.log('[API-Proxy] Loading simplified auth proxy...');
  
  // Load the new auth proxy loader
  const script = document.createElement('script');
  script.src = 'https://apps.simplesalt.company/auth-proxy-loader.js';
  script.onload = () => {
    console.log('[API-Proxy] ✅ Auth proxy loader loaded successfully');
    
    // Expose simplified API for backward compatibility
    window.apiProxy = {
      register: () => window.authProxy?.register(),
      reloadConfig: () => window.authProxy?.reloadConfig(),
      isReady: () => !!navigator.serviceWorker.controller
    };
  };
  script.onerror = () => {
    console.error('[API-Proxy] ❌ Failed to load auth proxy loader');
  };
  
  document.head.appendChild(script);
})();
