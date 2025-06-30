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
    cfWorkerUrl: 'https://api.simplesalt.company/nuywznihg08edfslfk29',
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

      // For external domains, use fetch interceptor instead of service worker
      if (!CONFIG.isNativeDomain) {
        console.log('[API-Proxy] External domain detected, using fetch interceptor...');
        await setupFetchInterceptor();
        return;
      }

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
   * Setup fetch interceptor for external domains (Plasmic Studio, etc.)
   */
  async function setupFetchInterceptor() {
    console.log('[API-Proxy] Setting up fetch interceptor for external domain...');
    
    // Check for existing CF Zero Trust authentication
    const authResult = await checkCFAuth();
    
    if (!authResult.authenticated) {
      console.log('[API-Proxy] CF Zero Trust authentication required');
      createAuthUI();
      return;
    }
    
    console.log('[API-Proxy] Already authenticated, setting up interceptor...');
    await initializeFetchInterceptor(authResult);
  }

  /**
   * Check CF Zero Trust authentication status
   */
  async function checkCFAuth() {
    try {
      const response = await fetch(`https://${CONFIG.authDomain}/cdn-cgi/access/get-identity`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const identity = await response.json();
        console.log('[API-Proxy] ✅ CF Zero Trust authenticated as:', identity.email || identity.name || 'User');
        return {
          authenticated: true,
          identity: identity,
          jwt: response.headers.get('CF-Access-Jwt-Assertion')
        };
      } else {
        console.log('[API-Proxy] ❌ CF Zero Trust not authenticated');
        return { authenticated: false };
      }
    } catch (error) {
      console.log('[API-Proxy] ❌ CF Zero Trust auth check failed:', error.message);
      return { authenticated: false };
    }
  }

  /**
   * Create CF Zero Trust authentication UI
   */
  function createAuthUI() {
    // Remove existing auth UI if present
    const existing = document.getElementById('cf-auth-ui');
    if (existing) existing.remove();
    
    const authUI = document.createElement('div');
    authUI.id = 'cf-auth-ui';
    authUI.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #fff;
      border: 2px solid #0066cc;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      max-width: 300px;
    `;
    
    authUI.innerHTML = `
      <div style="margin-bottom: 15px;">
        <h3 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">
          🔐 API Authentication Required
        </h3>
        <p style="margin: 0; color: #666; font-size: 14px;">
          Sign in with Cloudflare Zero Trust to access APIs
        </p>
      </div>
      
      <button id="cf-auth-login" style="
        background: #0066cc;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        width: 100%;
        margin-bottom: 10px;
      ">
        🚀 Sign In with CF Zero Trust
      </button>
      
      <button id="cf-auth-close" style="
        background: #f5f5f5;
        color: #666;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        width: 100%;
      ">
        ✕ Close
      </button>
      
      <div id="cf-auth-status" style="
        margin-top: 10px;
        font-size: 12px;
        color: #666;
      "></div>
    `;
    
    document.body.appendChild(authUI);
    
    // Add event listeners
    document.getElementById('cf-auth-login').onclick = () => {
      const statusDiv = document.getElementById('cf-auth-status');
      statusDiv.textContent = '🔄 Opening authentication...';
      
      const authWindow = window.open(
        `https://${CONFIG.authDomain}/cdn-cgi/access/login`,
        'cf-auth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );
      
      // Poll for authentication completion
      const pollAuth = setInterval(async () => {
        try {
          if (authWindow.closed) {
            clearInterval(pollAuth);
            statusDiv.textContent = '🔄 Checking authentication...';
            
            const authResult = await checkCFAuth();
            if (authResult.authenticated) {
              statusDiv.textContent = '✅ Authentication successful!';
              setTimeout(async () => {
                authUI.remove();
                await initializeFetchInterceptor(authResult);
              }, 1500);
            } else {
              statusDiv.textContent = '❌ Authentication failed. Try again.';
            }
          }
        } catch (error) {
          console.log('[API-Proxy] Auth polling error:', error);
        }
      }, 1000);
      
      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(pollAuth);
        if (!authWindow.closed) {
          authWindow.close();
          statusDiv.textContent = '⏰ Authentication timeout. Try again.';
        }
      }, 300000);
    };
    
    document.getElementById('cf-auth-close').onclick = () => {
      authUI.remove();
    };
  }

  /**
   * Initialize fetch interceptor with authentication
   */
  async function initializeFetchInterceptor(authResult) {
    console.log('[API-Proxy] Setting up authenticated fetch interceptor...');
    
    // Load routing configuration
    let routingRules = [];
    try {
      const response = await fetch('https://apps.simplesalt.company/routing.json');
      routingRules = await response.json();
      console.log('[API-Proxy] ✅ Loaded routing rules:', routingRules.length);
    } catch (error) {
      console.error('[API-Proxy] ❌ Failed to load routing rules:', error);
      return;
    }
    
    // Store original fetch function
    const originalFetch = window.fetch;
    
    // Create intercepted fetch function
    window.fetch = async function(input, init = {}) {
      // Parse the URL
      let url;
      if (typeof input === 'string') {
        url = new URL(input);
      } else if (input instanceof URL) {
        url = input;
      } else if (input instanceof Request) {
        url = new URL(input.url);
      } else {
        return originalFetch.call(this, input, init);
      }
      
      // Only intercept external API calls (not same-origin)
      if (url.origin === window.location.origin) {
        return originalFetch.call(this, input, init);
      }
      
      // Check if this URL matches any routing rules
      const matchingRule = routingRules.find(rule => {
        if (rule.authType === 2 || rule.authType === 3) {
          return url.hostname === rule.domain || url.hostname.endsWith('.' + rule.domain);
        }
        return false;
      });
      
      if (matchingRule) {
        console.log('[API-Proxy] 🔄 Intercepting API call to:', url.hostname, 'via rule:', matchingRule);
        
        try {
          // Prepare headers for proxy request
          const proxyHeaders = new Headers(init.headers || {});
          
          // Remove problematic headers
          proxyHeaders.delete('sec-fetch-site');
          proxyHeaders.delete('sec-fetch-mode');
          proxyHeaders.delete('sec-fetch-dest');
          proxyHeaders.delete('origin');
          proxyHeaders.delete('referer');
          
          // Add headers expected by CF Worker
          proxyHeaders.set('X-Original-URL', url.toString());
          proxyHeaders.set('X-Auth-Type', matchingRule.authType.toString());
          proxyHeaders.set('X-Secret-Name', matchingRule.secretName || '');
          
          // Add CF Access JWT if available
          if (authResult && authResult.jwt) {
            proxyHeaders.set('CF-Access-Jwt-Assertion', authResult.jwt);
          }
          
          // Make proxy request
          const proxyResponse = await originalFetch(CONFIG.cfWorkerUrl, {
            method: init.method || 'GET',
            headers: proxyHeaders,
            body: init.body || null,
            credentials: 'include',
            mode: 'cors'
          });
          
          console.log('[API-Proxy] ✅ Proxy request completed:', proxyResponse.status, proxyResponse.statusText);
          
          // If we get 403, might need to re-authenticate
          if (proxyResponse.status === 403) {
            console.log('[API-Proxy] ⚠️ Authentication may have expired. Consider re-authenticating.');
          }
          
          return proxyResponse;
          
        } catch (error) {
          console.error('[API-Proxy] ❌ Proxy request failed:', error);
          
          return new Response(JSON.stringify({
            error: 'Proxy request failed',
            message: error.message,
            target: url.toString(),
            rule: matchingRule
          }), {
            status: 500,
            statusText: 'Proxy Error',
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
      }
      
      // If no matching rule, use original fetch
      return originalFetch.call(this, input, init);
    };
    
    // Set up API proxy utilities for external domains
    setupExternalAPIProxy(authResult, originalFetch);
    
    console.log('[API-Proxy] 🎉 Authenticated fetch interceptor ready!');
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
   * Set up API proxy utilities for external domains (fetch interceptor)
   */
  function setupExternalAPIProxy(authResult, originalFetch) {
    window.apiProxy = {
      test: async (url, options = {}) => {
        console.log('[API-Proxy] 🧪 Testing API call to:', url);
        try {
          const response = await fetch(url, options);
          console.log('[API-Proxy] ✅ Response:', response.status, response.statusText);
          console.log('[API-Proxy] 📋 Headers:', [...response.headers.entries()]);
          
          try {
            const text = await response.clone().text();
            console.log('[API-Proxy] 📄 Response body preview:', text.substring(0, 200) + (text.length > 200 ? '...' : ''));
          } catch (bodyError) {
            console.log('[API-Proxy] ⚠️ Could not read response body:', bodyError.message);
          }
          
          return response;
        } catch (error) {
          console.log('[API-Proxy] ❌ Error:', error.message);
          throw error;
        }
      },

      status: () => ({
        supported: true,
        registered: true,
        mode: 'fetch-interceptor',
        domain: CONFIG.currentDomain,
        isNativeDomain: CONFIG.isNativeDomain,
        authenticated: authResult.authenticated,
        user: authResult.identity?.email || authResult.identity?.name || 'Unknown'
      }),

      restoreOriginalFetch: () => {
        window.fetch = originalFetch;
        console.log('[API-Proxy] ✅ Original fetch function restored');
      },

      recheckAuth: async () => {
        const newAuthResult = await checkCFAuth();
        if (newAuthResult.authenticated) {
          console.log('[API-Proxy] ✅ Still authenticated as:', newAuthResult.identity.email || 'User');
        } else {
          console.log('[API-Proxy] ❌ Authentication expired. Showing login UI...');
          createAuthUI();
        }
        return newAuthResult;
      },

      authenticate: () => {
        createAuthUI();
      }
    };

    console.log('[API-Proxy] 🔧 External API Proxy utilities available:');
    console.log('  - window.apiProxy.test(url, options) - Test API call');
    console.log('  - window.apiProxy.status() - Get status');
    console.log('  - window.apiProxy.restoreOriginalFetch() - Restore original fetch');
    console.log('  - window.apiProxy.recheckAuth() - Check authentication status');
    console.log('  - window.apiProxy.authenticate() - Show login UI');
  }

  /**
   * Set up API proxy utilities for native domain (service worker)
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
