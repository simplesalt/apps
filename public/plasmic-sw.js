/**
 * Plasmic Service Worker Registration
 * Load this script in Plasmic to enable API proxying
 */

(function() {
  'use strict';
  
  // Prevent multiple registrations
  if (window.plasmicSWLoaded) {
    console.log('Plasmic service worker already loaded');
    return;
  }
  window.plasmicSWLoaded = true;
  
  // Configuration
  const CONFIG = {
    workerUrl: 'https://nuywznihg08edfslfk29.api.simplesalt.company',
    routingUrl: 'https://apps.simplesalt.company/routing.json'
  };
  
  console.log('🚀 Initializing Plasmic API Proxy...');
  
  if (!('serviceWorker' in navigator)) {
    console.warn('⚠️ Service workers not supported');
    return;
  }
  
  // Wait for page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initServiceWorker);
  } else {
    initServiceWorker();
  }
  
  async function initServiceWorker() {
    try {
      console.log('📋 Fetching routing configuration...');
      
      // Fetch routing rules
      const response = await fetch(CONFIG.routingUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch routing config: ${response.status}`);
      }
      
      const routingRules = await response.json();
      console.log('✅ Routing rules loaded:', routingRules.length, 'rules');
      
      // Create service worker code
      const serviceWorkerCode = createServiceWorkerCode(routingRules, CONFIG.workerUrl);
      
      // Register service worker
      const blob = new Blob([serviceWorkerCode], { type: 'application/javascript' });
      const swUrl = URL.createObjectURL(blob);
      
      const registration = await navigator.serviceWorker.register(swUrl, {
        scope: '/'
      });
      
      console.log('✅ Plasmic service worker registered successfully');
      console.log('📍 Scope:', registration.scope);
      
      // Set up message handling
      setupMessageHandling();
      
      // Expose utilities
      window.plasmicAPI = {
        test: testAPI,
        getStatus: () => ({
          registered: true,
          scope: registration.scope,
          active: !!registration.active
        }),
        reload: () => location.reload()
      };
      
      console.log('🎉 Plasmic API proxy ready!');
      console.log('💡 Test with: window.plasmicAPI.test("https://api.hubapi.com/contacts/v1/lists")');
      
    } catch (error) {
      console.error('❌ Failed to initialize Plasmic service worker:', error);
    }
  }
  
  function createServiceWorkerCode(rules, workerUrl) {
    return `
      // Plasmic API Proxy Service Worker
      const routingRules = ${JSON.stringify(rules)};
      const proxyWorkerUrl = '${workerUrl}';
      
      console.log('🔧 Plasmic Service Worker starting with', routingRules.length, 'routing rules');
      
      self.addEventListener('install', (event) => {
        console.log('📦 Plasmic Service Worker installing...');
        self.skipWaiting();
      });
      
      self.addEventListener('activate', (event) => {
        console.log('🔄 Plasmic Service Worker activating...');
        event.waitUntil(self.clients.claim());
      });
      
      self.addEventListener('fetch', (event) => {
        const url = new URL(event.request.url);
        
        // Skip non-HTTP requests
        if (!url.protocol.startsWith('http')) {
          return;
        }
        
        // Find matching routing rule
        const rule = routingRules.find(r => 
          url.hostname === r.domain || 
          url.hostname.endsWith('.' + r.domain) || 
          url.hostname.includes(r.domain)
        );
        
        // Only intercept if rule exists and requires proxying
        if (rule && (rule.authType === 2 || rule.authType === 3)) {
          console.log('🔄 Intercepting API call to:', url.hostname, 'via rule:', rule);
          
          event.respondWith(
            handleProxyRequest(event.request, rule, proxyWorkerUrl)
          );
        }
      });
      
      async function handleProxyRequest(request, rule, workerUrl) {
        try {
          // Prepare headers for proxy request
          const proxyHeaders = new Headers();
          
          // Copy safe headers from original request
          for (const [key, value] of request.headers.entries()) {
            if (!key.toLowerCase().startsWith('cf-') && 
                !key.toLowerCase().startsWith('x-') &&
                key.toLowerCase() !== 'host') {
              proxyHeaders.set(key, value);
            }
          }
          
          // Add proxy-specific headers
          proxyHeaders.set('X-Original-URL', request.url);
          proxyHeaders.set('X-Auth-Type', rule.authType.toString());
          if (rule.secretName) {
            proxyHeaders.set('X-Secret-Name', rule.secretName);
          }
          proxyHeaders.set('Origin', 'https://studio.plasmic.app');
          
          // Get request body if present
          let body = null;
          if (request.method !== 'GET' && request.method !== 'HEAD') {
            body = await request.blob();
          }
          
          // Make proxy request
          const proxyResponse = await fetch(workerUrl, {
            method: request.method,
            headers: proxyHeaders,
            body: body,
            mode: 'cors'
          });
          
          console.log('✅ Proxy request completed:', proxyResponse.status, proxyResponse.statusText);
          return proxyResponse;
          
        } catch (error) {
          console.error('❌ Proxy request failed:', error);
          
          // Fallback to direct request
          console.log('🔄 Falling back to direct request...');
          return fetch(request);
        }
      }
    `;
  }
  
  function setupMessageHandling() {
    // Handle messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      console.log('📨 Message from service worker:', event.data);
    });
  }
  
  async function testAPI(url) {
    try {
      console.log('🧪 Testing API call:', url);
      const response = await fetch(url);
      console.log('✅ API test response:', response.status, response.statusText);
      
      const data = await response.json();
      console.log('📄 API test data:', data);
      return data;
    } catch (error) {
      console.error('❌ API test failed:', error);
      throw error;
    }
  }
  
})();