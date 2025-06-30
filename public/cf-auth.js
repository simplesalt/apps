/**
 * Cloudflare Zero Trust Authentication Utilities
 * Handles automatic CF Access authentication with GSuite SSO
 */

class CFAuth {
  constructor() {
    this.cfAccessToken = null;
    this.tokenExpiry = null;
    this.authInProgress = false;
  }

  /**
   * Initialize CF Zero Trust authentication on page load
   * Attempts silent authentication if GSuite session exists
   */
  async initializeAuth() {
    console.log('🔐 Initializing CF Zero Trust authentication...');
    
    try {
      // Check if we already have a valid CF Access token
      const existingToken = this.getCFAccessToken();
      if (existingToken && this.isTokenValid()) {
        console.log('✅ Valid CF Access token found');
        return existingToken;
      }

      // Attempt silent authentication
      return await this.performSilentAuth();
    } catch (error) {
      console.error('❌ CF Auth initialization failed:', error);
      throw error;
    }
  }

  /**
   * Perform CF Zero Trust authentication for static app
   * Uses CF for Teams authentication flow
   */
  async performSilentAuth() {
    if (this.authInProgress) {
      console.log('⏳ Authentication already in progress...');
      return this.waitForAuth();
    }

    this.authInProgress = true;
    console.log('🔄 Attempting CF Zero Trust authentication...');

    try {
      // For static apps, we need to authenticate against CF for Teams
      // This creates a session that can be used for API access
      
      // Method 1: Check if we already have a CF session
      const existingSession = this.checkExistingSession();
      if (existingSession) {
        console.log('✅ Existing CF Zero Trust session found');
        this.cfAccessToken = existingSession;
        return existingSession;
      }

      // Method 2: Initiate CF Zero Trust authentication
      // This will use the user's GSuite/identity provider session
      const authResult = await this.initiateCFZeroTrustAuth();
      
      if (authResult) {
        this.cfAccessToken = authResult;
        this.tokenExpiry = this.parseTokenExpiry(authResult);
        console.log('✅ CF Zero Trust authentication successful');
        return authResult;
      }

      // Method 3: If no user auth available, continue without user context
      // The CF Worker will still handle API authentication using stored secrets
      console.log('ℹ️ No user authentication available - continuing with service auth only');
      return null;

    } catch (error) {
      console.error('❌ CF Zero Trust authentication failed:', error);
      // Don't throw - allow the app to continue without user auth
      return null;
    } finally {
      this.authInProgress = false;
    }
  }

  /**
   * Check for existing CF Zero Trust session
   */
  checkExistingSession() {
    // Check for CF session cookies
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'CF_Authorization' || 
          name.includes('cf_clearance') ||
          name.includes('__cf_bm')) {
        return value;
      }
    }
    
    // Check localStorage for stored session
    try {
      const stored = localStorage.getItem('cf_zero_trust_session');
      if (stored) {
        const session = JSON.parse(stored);
        if (session.token && session.expiry > Date.now()) {
          return session.token;
        }
      }
    } catch (e) {
      // Ignore localStorage errors
    }
    
    return null;
  }

  /**
   * Initiate CF Zero Trust authentication flow
   */
  async initiateCFZeroTrustAuth() {
    try {
      // Create a hidden iframe to handle the auth flow
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.style.width = '1px';
      iframe.style.height = '1px';
      
      // Use CF for Teams authentication endpoint
      // This will redirect through the identity provider (GSuite) and back
      const authUrl = 'https://simplesalt.cloudflareaccess.com/cdn-cgi/access/login';
      iframe.src = authUrl;
      
      document.body.appendChild(iframe);

      // Wait for authentication to complete
      const token = await new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds timeout
        
        const checkAuth = () => {
          attempts++;
          
          // Check if we got a token
          const session = this.checkExistingSession();
          if (session) {
            document.body.removeChild(iframe);
            resolve(session);
            return;
          }
          
          // Timeout after 30 seconds
          if (attempts >= maxAttempts) {
            document.body.removeChild(iframe);
            resolve(null);
            return;
          }
          
          // Check again in 1 second
          setTimeout(checkAuth, 1000);
        };
        
        // Start checking after 2 seconds to allow iframe to load
        setTimeout(checkAuth, 2000);
      });

      return token;
      
    } catch (error) {
      console.error('❌ CF Zero Trust auth flow failed:', error);
      return null;
    }
  }

  /**
   * Redirect to CF Access login page
   * Will redirect back to current page after authentication
   */
  async redirectToLogin() {
    const currentUrl = encodeURIComponent(window.location.href);
    const loginUrl = `https://${window.location.hostname}/cdn-cgi/access/login?redirect_url=${currentUrl}`;
    
    console.log('🔄 Redirecting to CF Access login...');
    window.location.href = loginUrl;
    
    // This won't return as we're redirecting
    return new Promise(() => {});
  }

  /**
   * Extract CF Access JWT token from response
   */
  extractCFAccessToken(response) {
    // Method 1: Check CF-Access-Jwt-Assertion header
    let token = response.headers.get('CF-Access-Jwt-Assertion');
    if (token) return token;

    // Method 2: Check cookies for CF_Authorization
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'CF_Authorization') {
        return value;
      }
    }

    // Method 3: Check for token in response body
    try {
      const responseText = response.text();
      const tokenMatch = responseText.match(/CF_Authorization=([^;]+)/);
      if (tokenMatch) return tokenMatch[1];
    } catch (e) {
      // Ignore parsing errors
    }

    return null;
  }

  /**
   * Get current CF Access token
   */
  getCFAccessToken() {
    if (this.cfAccessToken && this.isTokenValid()) {
      return this.cfAccessToken;
    }

    // Try to get from cookies
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'CF_Authorization') {
        this.cfAccessToken = value;
        this.tokenExpiry = this.parseTokenExpiry(value);
        return value;
      }
    }

    return null;
  }

  /**
   * Check if current token is valid (not expired)
   */
  isTokenValid() {
    if (!this.tokenExpiry) return false;
    return Date.now() < this.tokenExpiry - 60000; // 1 minute buffer
  }

  /**
   * Parse token expiry from JWT
   */
  parseTokenExpiry(jwt) {
    try {
      const payload = JSON.parse(atob(jwt.split('.')[1]));
      return payload.exp * 1000; // Convert to milliseconds
    } catch (error) {
      console.warn('Could not parse JWT expiry:', error);
      return Date.now() + 3600000; // Default to 1 hour
    }
  }

  /**
   * Wait for ongoing authentication to complete
   */
  async waitForAuth() {
    return new Promise((resolve) => {
      const checkAuth = () => {
        if (!this.authInProgress) {
          resolve(this.cfAccessToken);
        } else {
          setTimeout(checkAuth, 100);
        }
      };
      checkAuth();
    });
  }

  /**
   * Add CF Access token to API requests
   */
  addAuthHeaders(headers = {}) {
    const token = this.getCFAccessToken();
    if (token) {
      headers['CF-Access-Jwt-Assertion'] = token;
    }
    return headers;
  }

  /**
   * Make authenticated request to CF-protected endpoint
   */
  async authenticatedFetch(url, options = {}) {
    const token = await this.initializeAuth();
    
    const authHeaders = this.addAuthHeaders(options.headers || {});
    
    return fetch(url, {
      ...options,
      headers: authHeaders,
      credentials: 'include'
    });
  }
}

// Global instance
window.cfAuth = new CFAuth();

// Handle service worker messages for CF token
navigator.serviceWorker?.addEventListener('message', (event) => {
  if (event.data.type === 'GET_CF_TOKEN') {
    const token = window.cfAuth.getCFAccessToken();
    event.ports[0].postMessage({ cfToken: token });
  }
});

// Auto-initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.cfAuth.initializeAuth().catch(console.error);
  });
} else {
  window.cfAuth.initializeAuth().catch(console.error);
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CFAuth;
}