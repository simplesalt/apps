import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Service Worker Registration - API Call Interception */}
        <script 
          src="/sw-register.js" 
          defer
          // Add comment to explain purpose without affecting Plasmic
          data-purpose="api-call-interception"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}