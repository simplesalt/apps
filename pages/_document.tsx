import { Html, Head, Main, NextScript } from 'next/document'

// Force rebuild - ensure service worker scripts are included
export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Service Worker Registration - API Call Interception */}
        <script 
          src="/sw-register.js" 
          defer
          data-purpose="api-call-interception"
        />
        
        {/* CF Zero Trust Authentication */}
        <script 
          src="/cf-auth.js" 
          defer
          data-purpose="cf-zero-trust-auth"
        />
        
        {/* Inline Service Worker Registration - Guaranteed to be in static HTML */}
        <script dangerouslySetInnerHTML={{
          __html: `
            // Service Worker Registration - Inline for static export compatibility
            console.log('🔧 Inline Script: Starting service worker registration');
            
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                // Service worker code
                const serviceWorkerCode = \`
                  // API Interception Service Worker
                  console.log('🔧 Service Worker: Starting API Interception Service Worker');

                  // Cache for routing configuration
                  let routingConfig = null;
                  let cfAuthToken = null;

                  // Fetch routing configuration
                  async function loadRoutingConfig() {
                    try {
                      const response = await fetch('/routing.json');
                      routingConfig = await response.json();
                      console.log('📋 Service Worker: Loaded routing config:', routingConfig);
                    } catch (error) {
                      console.error('❌ Service Worker: Failed to load routing config:', error);
                    }
                  }

                  // Get CF auth token
                  async function getCFAuthToken() {
                    try {
                      const response = await fetch('/cdn-cgi/access/get-identity');
                      if (response.ok) {
                        const identity = await response.json();
                        cfAuthToken = identity.token || identity.access_token;
                        console.log('🔐 Service Worker: Got CF auth token');
                      }
                    } catch (error) {
                      console.log('ℹ️ Service Worker: No CF auth token available:', error.message);
                    }
                  }

                  // Initialize
                  self.addEventListener('install', (event) => {
                    console.log('🚀 Service Worker: Installing');
                    event.waitUntil(Promise.all([
                      loadRoutingConfig(),
                      getCFAuthToken()
                    ]));
                    self.skipWaiting();
                  });

                  self.addEventListener('activate', (event) => {
                    console.log('✅ Service Worker: Activated');
                    event.waitUntil(self.clients.claim());
                  });

                  // Intercept fetch requests
                  self.addEventListener('fetch', (event) => {
                    const url = new URL(event.request.url);
                    
                    // Only intercept external API calls
                    if (!routingConfig || url.origin === self.location.origin) {
                      return;
                    }

                    // Check if this URL matches any routing rules
                    const matchingRule = routingConfig.routes?.find(route => {
                      return url.hostname.includes(route.domain) || url.href.includes(route.domain);
                    });

                    if (matchingRule) {
                      console.log('🎯 Service Worker: Intercepting API call to', url.href, 'with rule:', matchingRule);
                      
                      event.respondWith(
                        (async () => {
                          try {
                            const cfWorkerUrl = 'https://nuywznihg08edfslfk29.api.simplesalt.company';
                            
                            const originalRequest = event.request.clone();
                            const body = originalRequest.method !== 'GET' ? await originalRequest.blob() : null;
                            
                            const headers = new Headers(originalRequest.headers);
                            headers.set('X-Original-URL', url.href);
                            headers.set('X-Auth-Type', matchingRule.authType.toString());
                            headers.set('X-Secret-Name', matchingRule.secretName);
                            
                            if (cfAuthToken) {
                              headers.set('CF-Access-JWT-Assertion', cfAuthToken);
                            }

                            const cfResponse = await fetch(cfWorkerUrl, {
                              method: originalRequest.method,
                              headers: headers,
                              body: body
                            });

                            console.log('📡 Service Worker: CF Worker response:', cfResponse.status);
                            return cfResponse;
                            
                          } catch (error) {
                            console.error('❌ Service Worker: Error proxying request:', error);
                            return fetch(event.request);
                          }
                        })()
                      );
                    }
                  });
                \`;

                // Register service worker from blob
                const blob = new Blob([serviceWorkerCode], { type: 'application/javascript' });
                const serviceWorkerUrl = URL.createObjectURL(blob);
                
                navigator.serviceWorker.register(serviceWorkerUrl)
                  .then(function(registration) {
                    console.log('✅ Service Worker registered successfully:', registration);
                  })
                  .catch(function(error) {
                    console.error('❌ Service Worker registration failed:', error);
                  });
              });
            }
          `
        }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}