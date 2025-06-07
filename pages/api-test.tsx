import { useState } from 'react';
import Head from 'next/head';

export default function ApiTest() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const testApiCall = async (domain: string, endpoint: string = '') => {
    setLoading(true);
    const url = `https://${domain}${endpoint}`;
    
    try {
      console.log('Making API call to:', url);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const result: any = {
        url,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        timestamp: new Date().toISOString(),
        redirected: response.redirected,
        finalUrl: response.url
      };
      
      // Try to get response body (might fail for CORS)
      try {
        const text = await response.text();
        result.body = text.substring(0, 500); // Limit body size
      } catch (e) {
        result.body = 'Could not read response body (CORS)';
      }
      
      setResults(prev => [result, ...prev]);
      console.log('API call result:', result);
      
    } catch (error) {
      const result = {
        url,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      };
      setResults(prev => [result, ...prev]);
      console.error('API call error:', error);
    }
    
    setLoading(false);
  };

  const clearResults = () => setResults([]);

  const reloadServiceWorker = async () => {
    try {
      if (window.swUtils) {
        await window.swUtils.reloadRoutingConfig();
        alert('Service worker routing config reloaded!');
      } else {
        alert('Service worker utilities not available');
      }
    } catch (error) {
      alert('Error reloading service worker: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  return (
    <>
      <Head>
        <title>API Interception Test - SimpleSalt Apps</title>
      </Head>
      
      <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
        <h1>API Call Interception Test</h1>
        <p>This page tests the service worker API interception functionality.</p>
        
        <div style={{ marginBottom: '20px' }}>
          <h2>Test API Calls</h2>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <button 
              onClick={() => testApiCall('api.google.com', '/test')}
              disabled={loading}
              style={{ padding: '8px 16px', backgroundColor: '#4285f4', color: 'white', border: 'none', borderRadius: '4px' }}
            >
              Test Google API (authType: 1)
            </button>
            
            <button 
              onClick={() => testApiCall('api.hubapi.com', '/test')}
              disabled={loading}
              style={{ padding: '8px 16px', backgroundColor: '#ff7a59', color: 'white', border: 'none', borderRadius: '4px' }}
            >
              Test HubSpot API (authType: 2)
            </button>
            
            <button 
              onClick={() => testApiCall('api.notion.com', '/v1/users')}
              disabled={loading}
              style={{ padding: '8px 16px', backgroundColor: '#000', color: 'white', border: 'none', borderRadius: '4px' }}
            >
              Test Notion API (authType: 3)
            </button>
          </div>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <button 
              onClick={clearResults}
              style={{ padding: '8px 16px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px' }}
            >
              Clear Results
            </button>
            
            <button 
              onClick={reloadServiceWorker}
              style={{ padding: '8px 16px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px' }}
            >
              Reload SW Config
            </button>
          </div>
          
          {loading && <p>Making API call...</p>}
        </div>

        <div>
          <h2>Service Worker Status</h2>
          <div style={{ backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '4px', marginBottom: '20px' }}>
            <p><strong>Supported:</strong> {'serviceWorker' in navigator ? 'Yes' : 'No'}</p>
            <p><strong>Registered:</strong> {navigator.serviceWorker?.controller ? 'Yes' : 'No'}</p>
            <p><strong>Current URL:</strong> {window.location.href}</p>
          </div>
        </div>

        <div>
          <h2>API Call Results</h2>
          {results.length === 0 ? (
            <p>No API calls made yet. Click the buttons above to test.</p>
          ) : (
            <div>
              {results.map((result, index) => (
                <div 
                  key={index} 
                  style={{ 
                    backgroundColor: result.error ? '#f8d7da' : '#d4edda', 
                    border: `1px solid ${result.error ? '#f5c6cb' : '#c3e6cb'}`,
                    borderRadius: '4px',
                    padding: '10px',
                    marginBottom: '10px'
                  }}
                >
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>
                    {result.error ? '❌' : '✅'} {result.url}
                  </h3>
                  <p><strong>Timestamp:</strong> {result.timestamp}</p>
                  
                  {result.error ? (
                    <p><strong>Error:</strong> {result.error}</p>
                  ) : (
                    <>
                      <p><strong>Status:</strong> {result.status} {result.statusText}</p>
                      <p><strong>Redirected:</strong> {result.redirected ? 'Yes' : 'No'}</p>
                      {result.finalUrl !== result.url && (
                        <p><strong>Final URL:</strong> {result.finalUrl}</p>
                      )}
                      <details>
                        <summary>Response Headers</summary>
                        <pre style={{ fontSize: '12px', overflow: 'auto' }}>
                          {JSON.stringify(result.headers, null, 2)}
                        </pre>
                      </details>
                      <details>
                        <summary>Response Body (first 500 chars)</summary>
                        <pre style={{ fontSize: '12px', overflow: 'auto' }}>
                          {result.body}
                        </pre>
                      </details>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// Add type declaration for window.swUtils
declare global {
  interface Window {
    swUtils?: {
      reloadRoutingConfig: () => Promise<any>;
      getStatus: () => any;
      unregister: () => Promise<boolean>;
    };
  }
}