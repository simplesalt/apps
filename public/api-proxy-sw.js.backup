// Universal API Interception Service Worker
// Works gracefully on any domain - detects environment and adapts

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
  console.log('🔧 Universal API Proxy Service Worker installing...');
  self.skipWaiting();
});

// Initialize configuration and load routing rules
self.addEventListener('activate', async (event) => {
  console.log('🔧 API Proxy running');
  
  event.waitUntil(
    (async () => {
      try {
        // Claim all clients immediately
        await self.clients.claim();
        
        // Detect current environment
        await initializeConfig();
        
        // Load routing configuration
        await loadRoutingConfig();
        
        console.log('✅ Service worker ready on domain:', config.currentDomain);
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
  
  // Set routing config URL based on domain
  if (config.isNativeDomain) {
    // On native domain, use relative URL (works with both static file and Pages Function)
    config.routingConfigUrl = '/routing.json';
  } else {
    // On external domains, use absolute URL with CORS
    config.routingConfigUrl = `https://${config.authDomain}/routing.json`;
  }
  
  console.log('🌐 Domain detected:', config.currentDomain);
  console.log('🏠 Native domain:', config.isNativeDomain);
  console.log('📍 Routing config URL:', config.routingConfigUrl);
}

// Load routing configuration with fallbacks
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
    {
      "domain": "api.google.com",
      "authType": 1
    },
    {
      "domain": "api.hubapi.com", 
      "authType": 2,
      "secretName": "6nr8n2i1ve1rdnku8d1t"
    },
    {
      "domain": "api.notion.com",
      "authType": 3,
      "secretName": "fhwowggbohorrud2kj16"
    }
  ];
  console.log('📋 Fallback config loaded:', routingRules.length, 'rules');
}

// Intercept fetch requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip non-HTTP requests and same-origin requests
  if (!url.protocol.startsWith('http') || url.origin === self.location.origin) {
    return;
  }
  
  // Skip if no routing rules loaded yet
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
          // Get CF Access token
          const cfToken = await getCFAccessToken();
          
          // Route through CF Worker
          const workerUrl = config.proxyWorkerUrl;
          
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
          if (cfToken) {
            proxyHeaders.set('X-CF-Access-Token', cfToken);
          }
          
          // Set origin based on current location
          const currentOrigin = self.location.origin;
          proxyHeaders.set('Origin', currentOrigin);
          proxyHeaders.set('X-Forwarded-For', currentOrigin.replace('https://', ''));
          
          // Get request body if present
          let body = null;
          if (event.request.method !== 'GET' && event.request.method !== 'HEAD') {
            try {
              body = await event.request.clone().blob();
            } catch (e) {
              console.warn('Could not clone request body:', e);
            }
          }
          
          // Make proxy request to CF Worker
          const proxyResponse = await fetch(workerUrl, {
            method: event.request.method,
            headers: proxyHeaders,
            body: body,
            mode: 'cors',
            credentials: 'omit'
          });
          
          console.log('✅ Proxy request completed:', proxyResponse.status, proxyResponse.statusText);
          return proxyResponse;
          
        } catch (error) {
          console.error('❌ Proxy request failed:', error);
          
          // Check if it's a network error (worker not deployed)
          if (error.name === 'TypeError' && error.message.includes('fetch')) {
            console.error('💡 CF Worker may not be deployed yet. Check:', workerUrl);
            return new Response(JSON.stringify({
              error: 'CF Worker not available',
              message: 'The authentication proxy is not deployed yet',
              workerUrl: workerUrl
            }), {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'application/json' }
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
  } else if (rule && rule.authType === 1) {
    console.log('ℹ️ Allowing direct access to:', url.hostname, '(authType 1)');
    // authType 1 = direct access, no proxy needed
  }
});

// Helper function to get CF Zero Trust session token
async function getCFAccessToken() {
  try {
    // Method 1: Try to get token from main thread via message
    // This allows the main thread to handle CF Zero Trust authentication
    const clients = await self.clients.matchAll();
    if (clients.length > 0) {
      const messageChannel = new MessageChannel();
      
      const token = await new Promise((resolve) => {
        messageChannel.port1.onmessage = (event) => {
          resolve(event.data.cfToken || null);
        };
        
        // Timeout after 2 seconds to allow for auth flow
        setTimeout(() => resolve(null), 2000);
        
        clients[0].postMessage({ type: 'GET_CF_TOKEN' }, [messageChannel.port2]);
      });
      
      if (token) {
        console.log('✅ CF Zero Trust token obtained from main thread');
        return token;
      }
    }
    
    // Method 2: Check for stored session token (any domain)
    if (self.cookieStore && self.cookieStore.getAll) {
      try {
        const cookies = await self.cookieStore.getAll();
        const cfCookie = cookies.find(c => 
          c.name === 'CF_Authorization' || 
          c.name.includes('cf_clearance') ||
          c.name.includes('__cf_bm')
        );
        if (cfCookie) {
          console.log('✅ CF session token found in cookies');
          return cfCookie.value;
        }
      } catch (e) {
        // Cookie access might be restricted
        console.log('ℹ️ Cookie access restricted, using main thread auth');
      }
    }
    
    // Method 3: No token available - requests will go through CF Worker without user auth
    // The CF Worker itself will handle API authentication using stored secrets
    console.log('ℹ️ No CF Zero Trust token available');
    console.log('💡 CF Worker will handle API authentication using stored secrets');
    
    return null;
  } catch (error) {
    console.error('❌ Error getting CF Zero Trust token:', error);
    return null;
  }
}

// Handle messages from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'RELOAD_ROUTING_CONFIG') {
    // Reload routing configuration
    fetch('https://apps.simplesalt.company/routing.json')
      .then(response => response.json())
      .then(rules => {
        routingRules = rules;
        console.log('📋 Routing configuration reloaded:', rules.length, 'rules');
        event.ports[0].postMessage({ success: true, rules: rules.length });
      })
      .catch(error => {
        console.error('❌ Failed to reload routing config:', error);
        event.ports[0].postMessage({ success: false, error: error.message });
      });
  }
});

console.log('🚀 API Interception Service Worker loaded');