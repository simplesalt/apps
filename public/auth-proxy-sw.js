/**
 * Authentication Proxy Service Worker
 * 
 * Static service worker that intercepts API calls and routes them through
 * CF Access protected worker for authentication and proxying.
 * 
 * Supports:
 * - Automatic CF Access authentication with session management
 * - Cross-domain operation (works on any domain)
 * - Service token authentication via headers
 * - Dynamic routing configuration from routing.json
 */

let routingRules = [];
let config = {
  currentDomain: '',
  isNativeDomain: false,
  routingConfigUrl: '',
  proxyWorkerUrl: 'https://api.simplesalt.company/nuywznihg08edfslfk29',
  authDomain: 'apps.simplesalt.company'
};

// Install event
self.addEventListener('install', (event) => {
  console.log('🔧 Auth Proxy Service Worker installing...');
  self.skipWaiting();
});

// Activate and initialize
self.addEventListener('activate', async (event) => {
  console.log('🔧 Auth Proxy Service Worker activating...');
  
  event.waitUntil(
    (async () => {
      try {
        await self.clients.claim();
        await initializeConfig();
        await loadRoutingConfig();
        
        console.log('✅ Auth Proxy Service Worker ready on:', config.currentDomain);
        console.log('📋 Loaded routing rules:', routingRules.length, 'rules');
        
      } catch (error) {
        console.error('❌ Service worker initialization error:', error);
        console.log('⚠️ Service worker will continue with limited functionality');
      }
    })()
  );
});

// Initialize configuration based on current domain
async function initializeConfig() {
  const location = self.location;
  config.currentDomain = location.hostname;
  config.isNativeDomain = config.currentDomain === config.authDomain;
  
  // Set routing config URL
  // TODO: Investigate why domain detection reports apps.simplesalt.company when running on studio.plasmic.app
  // if (config.isNativeDomain) {
  //   config.routingConfigUrl = "/routing.json";
  // } else {
  //   config.routingConfigUrl = `https://${config.authDomain}/routing.json`;
  // }
  
  // Always use FQDN until domain detection issue is resolved
  config.routingConfigUrl = `https://${config.authDomain}/routing.json`;
  
  console.log('🌐 Domain detected:', config.currentDomain);
  console.log('📍 Routing config URL:', config.routingConfigUrl);
}

// Load routing configuration
async function loadRoutingConfig() {
  try {
    console.log('📥 Loading routing config from:', config.routingConfigUrl);
    
    const response = await fetch(config.routingConfigUrl, {
      mode: 'cors',
      credentials: config.isNativeDomain ? 'include' : 'omit'
    });
    
    if (response.ok) {
      routingRules = await response.json();
      console.log('✅ Routing config loaded successfully');
    } else {
      console.warn('⚠️ Failed to load routing config:', response.status);
      await loadFallbackConfig();
    }
  } catch (error) {
    console.warn('⚠️ Error loading routing config:', error.message);
    await loadFallbackConfig();
  }
}

// Fallback routing configuration
async function loadFallbackConfig() {
  console.log('🔄 Using fallback routing configuration');
  routingRules = [
    {"domain": "api.hubapi.com", "authType": 2, "secretName": "6nr8n2i1ve1rdnku8d1t"},
    {"domain": "api.notion.com", "authType": 3, "secretName": "fhwowggbohorrud2kj16"}
  ];
  console.log('📋 Fallback config loaded:', routingRules.length, 'rules');
}

// Intercept and proxy API requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip non-HTTP requests and same-origin requests
  if (!url.protocol.startsWith('http') || url.origin === self.location.origin) {
    return;
  }
  
  // Skip if no routing rules loaded
  if (!routingRules.length) {
    return;
  }
  
  // Find matching routing rule
  const rule = routingRules.find(r => 
    url.hostname === r.domain || 
    url.hostname.endsWith('.' + r.domain) || 
    url.hostname.includes(r.domain)
  );
  
  // Only intercept if rule exists and requires proxying (authType 2 or 3)
  if (rule && (rule.authType === 2 || rule.authType === 3)) {
    console.log('🔄 Intercepting API call to:', url.hostname, 'via rule:', rule);
    
    event.respondWith(
      (async () => {
        try {
          // Prepare headers for proxy request
          const proxyHeaders = new Headers();
          
          // Copy safe headers from original request
          for (const [key, value] of event.request.headers.entries()) {
            const lowerKey = key.toLowerCase();
            if (!lowerKey.startsWith('cf-') && 
                !lowerKey.startsWith('x-') &&
                lowerKey !== 'host' &&
                lowerKey !== 'origin' &&
                lowerKey !== 'referer') {
              proxyHeaders.set(key, value);
            }
          }
          
          // Add proxy-specific headers
          proxyHeaders.set('X-Original-URL', event.request.url);
          proxyHeaders.set('X-Auth-Type', rule.authType.toString());
          if (rule.secretName) {
            proxyHeaders.set('X-Secret-Name', rule.secretName);
          }
          
          // Set origin for CORS
          proxyHeaders.set('Origin', self.location.origin);
          
          // Get request body if present
          let body = null;
          if (event.request.method !== 'GET' && event.request.method !== 'HEAD') {
            try {
              body = await event.request.clone().blob();
            } catch (e) {
              console.warn('Could not clone request body:', e);
            }
          }
          
          // Make proxy request to CF Worker (CF Access protected)
          const proxyResponse = await fetch(config.proxyWorkerUrl, {
            method: event.request.method,
            headers: proxyHeaders,
            body: body,
            mode: 'cors',
            credentials: 'include'  // Critical: includes CF_Authorization cookie
          });
          
          // Handle CF Access authentication responses
          if (proxyResponse.status === 401 || proxyResponse.status === 403) {
            console.log('🔐 CF Access authentication required');
            
            // Check if response has redirect location (CF Access login)
            const location = proxyResponse.headers.get('Location');
            if (location) {
              console.log('🔄 CF Access redirecting to:', location);
              // Return response with redirect - browser will handle automatically
              return proxyResponse;
            }
            
            // If no redirect, return auth error
            return new Response(JSON.stringify({
              error: 'Authentication required',
              message: 'Please authenticate with CF Access',
              loginUrl: `https://${config.proxyWorkerUrl.split('/')[2]}`
            }), {
              status: 401,
              statusText: 'Authentication Required',
              headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': self.location.origin
              }
            });
          }
          
          console.log('✅ Proxy request completed:', proxyResponse.status);
          return proxyResponse;
          
        } catch (error) {
          console.error('❌ Proxy request failed:', error);
          
          // Check if it's a network error (worker not available)
          if (error.name === 'TypeError' && error.message.includes('fetch')) {
            console.error('💡 CF Worker may not be available. Check:', config.proxyWorkerUrl);
            return new Response(JSON.stringify({
              error: 'Proxy service unavailable',
              message: 'The authentication proxy is not available',
              workerUrl: config.proxyWorkerUrl
            }), {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': self.location.origin
              }
            });
          }
          
          // Fallback to direct request
          console.log('🔄 Falling back to direct request...');
          try {
            return await fetch(event.request);
          } catch (fallbackError) {
            console.error('❌ Fallback request also failed:', fallbackError);
            return new Response('Service temporarily unavailable', { 
              status: 503,
              statusText: 'Service Unavailable'
            });
          }
        }
      })()
    );
  }
});

// Handle reload routing config message
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'RELOAD_ROUTING_CONFIG') {
    loadRoutingConfig()
      .then(() => {
        event.ports[0].postMessage({ 
          success: true, 
          rules: routingRules.length 
        });
      })
      .catch(error => {
        console.error('❌ Failed to reload routing config:', error);
        event.ports[0].postMessage({ 
          success: false, 
          error: error.message 
        });
      });
  }
});

console.log('🚀 Auth Proxy Service Worker loaded');
