/**
 * Service Worker for API Call Interception and Routing
 * 
 * This service worker intercepts outgoing API calls and redirects them
 * based on the routing configuration in /routing.json.
 * 
 * For authType 2 or 3, requests are redirected to the specified destination.
 * This enables API proxying through Cloudflare Workers for authentication.
 */

const CACHE_NAME = 'api-router-v1';
const ROUTING_CONFIG_URL = '/routing.json';

let routingConfig = [];

// Load routing configuration on service worker activation
self.addEventListener('activate', async (event) => {
  console.log('[SW] Service Worker activated');
  
  event.waitUntil(
    (async () => {
      try {
        const response = await fetch(ROUTING_CONFIG_URL);
        if (response.ok) {
          routingConfig = await response.json();
          console.log('[SW] Routing configuration loaded:', routingConfig);
        } else {
          console.warn('[SW] Failed to load routing configuration');
        }
      } catch (error) {
        console.error('[SW] Error loading routing configuration:', error);
      }
      
      // Clean up old caches
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })()
  );
});

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installed');
  self.skipWaiting(); // Activate immediately
});

// Fetch event - intercept all network requests
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Only process HTTP/HTTPS requests
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // Check if this request matches any routing rules
  const routingRule = findMatchingRoute(url.hostname);
  
  if (routingRule && shouldRedirect(routingRule)) {
    console.log('[SW] Intercepting request to:', url.hostname);
    event.respondWith(handleApiRequest(request, routingRule));
  }
  // For all other requests, let them pass through normally
});

/**
 * Find a matching routing rule for the given hostname
 */
function findMatchingRoute(hostname) {
  // Handle the new routing.json structure with routes array
  const routes = routingConfig.routes || routingConfig;
  return routes.find(rule => {
    // Exact match or subdomain match
    return hostname === rule.domain || hostname.endsWith('.' + rule.domain) || hostname.includes(rule.domain);
  });
}

/**
 * Check if the request should be redirected based on authType
 */
function shouldRedirect(routingRule) {
  return routingRule.authType === 2 || routingRule.authType === 3;
}

/**
 * Get CF Access token from cookies or storage
 */
async function getCFAccessToken() {
  // Try to get from cookies first
  const cookies = await self.cookieStore?.getAll?.() || [];
  for (const cookie of cookies) {
    if (cookie.name === 'CF_Authorization') {
      return cookie.value;
    }
  }
  
  // Fallback: try to communicate with main thread
  try {
    const clients = await self.clients.matchAll();
    if (clients.length > 0) {
      // Send message to main thread to get CF token
      return new Promise((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = (event) => {
          resolve(event.data.cfToken);
        };
        clients[0].postMessage({ type: 'GET_CF_TOKEN' }, [channel.port2]);
      });
    }
  } catch (error) {
    console.warn('[SW] Could not communicate with main thread for CF token:', error);
  }
  
  return null;
}

/**
 * Handle API request by redirecting to CF Worker
 */
async function handleApiRequest(request, routingRule) {
  try {
    const originalUrl = new URL(request.url);
    const cfWorkerUrl = 'https://nuywznihg08edfslfk29.api.simplesalt.company';
    
    console.log('[SW] Redirecting request through CF Worker:', {
      from: originalUrl.href,
      to: cfWorkerUrl,
      authType: routingRule.authType,
      secretName: routingRule.secretName
    });
    
    // Clone the original request body if needed
    const body = request.method !== 'GET' && request.method !== 'HEAD' ? await request.blob() : undefined;
    
    // Create new request to CF Worker
    const headers = new Headers(request.headers);
    headers.set('X-Original-URL', originalUrl.href);
    headers.set('X-Auth-Type', routingRule.authType.toString());
    if (routingRule.secretName) {
      headers.set('X-Secret-Name', routingRule.secretName);
    }
    
    // Add CF Access token if available (for Zero Trust authentication)
    try {
      const cfToken = await getCFAccessToken();
      if (cfToken) {
        headers.set('CF-Access-JWT-Assertion', cfToken);
        console.log('[SW] Added CF Access token to proxied request');
      }
    } catch (error) {
      console.warn('[SW] Could not get CF Access token:', error);
    }
    
    // Make the request to CF Worker
    const response = await fetch(cfWorkerUrl, {
      method: request.method,
      headers: headers,
      body: body,
      mode: 'cors',
      credentials: 'omit'
    });
    
    console.log('[SW] CF Worker response:', response.status);
    return response;
    
  } catch (error) {
    console.error('[SW] Error handling API request:', error);
    
    // Return error response
    return new Response(
      JSON.stringify({
        error: 'API proxy error',
        message: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 502,
        statusText: 'Bad Gateway',
        headers: {
          'Content-Type': 'application/json',
          'X-Error-Source': 'service-worker'
        }
      }
    );
  }
}

// Handle messages from the main thread
self.addEventListener('message', async (event) => {
  if (event.data && event.data.type === 'RELOAD_ROUTING_CONFIG') {
    try {
      const response = await fetch(ROUTING_CONFIG_URL);
      if (response.ok) {
        routingConfig = await response.json();
        console.log('[SW] Routing configuration reloaded:', routingConfig);
        event.ports[0].postMessage({ success: true });
      } else {
        throw new Error('Failed to fetch routing config');
      }
    } catch (error) {
      console.error('[SW] Error reloading routing configuration:', error);
      event.ports[0].postMessage({ success: false, error: error.message });
    }
  }
});

// Log service worker lifecycle
console.log('[SW] Service Worker script loaded');