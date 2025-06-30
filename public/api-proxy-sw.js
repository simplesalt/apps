// API Interception Service Worker
// Intercepts API calls and routes them through CF Worker based on routing.json

let routingRules = [];

// Install event
self.addEventListener('install', (event) => {
  console.log('🔧 API Proxy Service Worker installing...');
  self.skipWaiting();
});

// Fetch routing configuration on service worker activation
self.addEventListener('activate', async (event) => {
  console.log('🔧 API Proxy Service Worker activated');
  
  event.waitUntil(
    (async () => {
      try {
        // Claim all clients immediately
        await self.clients.claim();
        
        // Load routing configuration
        const response = await fetch('https://apps.simplesalt.company/routing.json');
        if (response.ok) {
          routingRules = await response.json();
          console.log('📋 Loaded routing rules:', routingRules.length, 'rules');
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
          const workerUrl = 'https://nuywznihg08edfslfk29.api.simplesalt.company';
          
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

// Helper function to get CF Access token
async function getCFAccessToken() {
  try {
    // Method 1: Try to get token from main thread via message
    const clients = await self.clients.matchAll();
    if (clients.length > 0) {
      const messageChannel = new MessageChannel();
      
      return new Promise((resolve) => {
        messageChannel.port1.onmessage = (event) => {
          resolve(event.data.cfToken || null);
        };
        
        // Timeout after 1 second
        setTimeout(() => resolve(null), 1000);
        
        clients[0].postMessage({ type: 'GET_CF_TOKEN' }, [messageChannel.port2]);
      });
    }
    
    // Method 2: Try to get from cookies (if available)
    if (self.cookieStore && self.cookieStore.getAll) {
      const cookies = await self.cookieStore.getAll();
      const cfCookie = cookies.find(c => c.name === 'CF_Authorization');
      if (cfCookie) {
        return cfCookie.value;
      }
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error getting CF Access token:', error);
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