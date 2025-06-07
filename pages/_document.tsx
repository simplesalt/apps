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
        
        {/* Simple Service Worker Registration */}
        <script dangerouslySetInnerHTML={{
          __html: `
            // Service Worker Registration - Simple file-based approach
            console.log('🔧 Starting service worker registration');
            
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js')
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