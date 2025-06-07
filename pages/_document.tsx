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
        
        {/* Inline Service Worker Registration - Fixed syntax */}
        <script dangerouslySetInnerHTML={{
          __html: `
            // Service Worker Registration - Inline for static export compatibility
            console.log('🔧 Inline Script: Starting service worker registration');
            
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                // Service worker code - using string concatenation to avoid nested template literals
                const serviceWorkerCode = 
                  '// API Interception Service Worker\\n' +
                  'console.log("🔧 Service Worker: Starting API Interception Service Worker");\\n' +
                  '\\n' +
                  '// Cache for routing configuration\\n' +
                  'let routingConfig = null;\\n' +
                  'let cfAuthToken = null;\\n' +
                  '\\n' +
                  '// Fetch routing configuration\\n' +
                  'async function loadRoutingConfig() {\\n' +
                  '  try {\\n' +
                  '    const response = await fetch("/routing.json");\\n' +
                  '    routingConfig = await response.json();\\n' +
                  '    console.log("📋 Service Worker: Loaded routing config:", routingConfig);\\n' +
                  '  } catch (error) {\\n' +
                  '    console.error("❌ Service Worker: Failed to load routing config:", error);\\n' +
                  '  }\\n' +
                  '}\\n' +
                  '\\n' +
                  '// Get CF auth token\\n' +
                  'async function getCFAuthToken() {\\n' +
                  '  try {\\n' +
                  '    const response = await fetch("/cdn-cgi/access/get-identity");\\n' +
                  '    if (response.ok) {\\n' +
                  '      const identity = await response.json();\\n' +
                  '      cfAuthToken = identity.token || identity.access_token;\\n' +
                  '      console.log("🔐 Service Worker: Got CF auth token");\\n' +
                  '    }\\n' +
                  '  } catch (error) {\\n' +
                  '    console.log("ℹ️ Service Worker: No CF auth token available:", error.message);\\n' +
                  '  }\\n' +
                  '}\\n' +
                  '\\n' +
                  '// Initialize\\n' +
                  'self.addEventListener("install", (event) => {\\n' +
                  '  console.log("🚀 Service Worker: Installing");\\n' +
                  '  event.waitUntil(Promise.all([\\n' +
                  '    loadRoutingConfig(),\\n' +
                  '    getCFAuthToken()\\n' +
                  '  ]));\\n' +
                  '  self.skipWaiting();\\n' +
                  '});\\n' +
                  '\\n' +
                  'self.addEventListener("activate", (event) => {\\n' +
                  '  console.log("✅ Service Worker: Activated");\\n' +
                  '  event.waitUntil(self.clients.claim());\\n' +
                  '});\\n' +
                  '\\n' +
                  '// Intercept fetch requests\\n' +
                  'self.addEventListener("fetch", (event) => {\\n' +
                  '  const url = new URL(event.request.url);\\n' +
                  '  \\n' +
                  '  // Only intercept external API calls\\n' +
                  '  if (!routingConfig || url.origin === self.location.origin) {\\n' +
                  '    return;\\n' +
                  '  }\\n' +
                  '\\n' +
                  '  // Check if this URL matches any routing rules\\n' +
                  '  const matchingRule = routingConfig.routes?.find(route => {\\n' +
                  '    return url.hostname.includes(route.domain) || url.href.includes(route.domain);\\n' +
                  '  });\\n' +
                  '\\n' +
                  '  if (matchingRule) {\\n' +
                  '    console.log("🎯 Service Worker: Intercepting API call to", url.href, "with rule:", matchingRule);\\n' +
                  '    \\n' +
                  '    event.respondWith(\\n' +
                  '      (async () => {\\n' +
                  '        try {\\n' +
                  '          const cfWorkerUrl = "https://nuywznihg08edfslfk29.api.simplesalt.company";\\n' +
                  '          \\n' +
                  '          const originalRequest = event.request.clone();\\n' +
                  '          const body = originalRequest.method !== "GET" ? await originalRequest.blob() : null;\\n' +
                  '          \\n' +
                  '          const headers = new Headers(originalRequest.headers);\\n' +
                  '          headers.set("X-Original-URL", url.href);\\n' +
                  '          headers.set("X-Auth-Type", matchingRule.authType.toString());\\n' +
                  '          headers.set("X-Secret-Name", matchingRule.secretName);\\n' +
                  '          \\n' +
                  '          if (cfAuthToken) {\\n' +
                  '            headers.set("CF-Access-JWT-Assertion", cfAuthToken);\\n' +
                  '          }\\n' +
                  '\\n' +
                  '          const cfResponse = await fetch(cfWorkerUrl, {\\n' +
                  '            method: originalRequest.method,\\n' +
                  '            headers: headers,\\n' +
                  '            body: body\\n' +
                  '          });\\n' +
                  '\\n' +
                  '          console.log("📡 Service Worker: CF Worker response:", cfResponse.status);\\n' +
                  '          return cfResponse;\\n' +
                  '          \\n' +
                  '        } catch (error) {\\n' +
                  '          console.error("❌ Service Worker: Error proxying request:", error);\\n' +
                  '          return fetch(event.request);\\n' +
                  '        }\\n' +
                  '      })()\\n' +
                  '    );\\n' +
                  '  }\\n' +
                  '});';

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