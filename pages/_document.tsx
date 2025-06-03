import { Html, Head, Main, NextScript } from 'next/document'

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
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}