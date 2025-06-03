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
   * Perform silent authentication against CF Zero Trust
   * Leverages existing GSuite session in browser
   */
  async performSilentAuth() {
    if (this.authInProgress) {
      console.log('⏳ Authentication already in progress...');
      return this.waitForAuth();
    }

    this.authInProgress = true;
    console.log('🔄 Attempting silent CF Zero Trust authentication...');

    try {
      // CF Access authentication endpoint
      const authUrl = `https://${window.location.hostname}/cdn-cgi/access/login`;
      
      // Attempt silent authentication with existing GSuite session
      const response = await fetch(authUrl, {
        method: 'GET',
        credentials: 'include', // Include existing cookies
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      if (response.ok) {
        // Extract CF Access JWT from response headers or cookies
        const cfAccessJwt = this.extractCFAccessToken(response);
        
        if (cfAccessJwt) {
          this.cfAccessToken = cfAccessJwt;
          this.tokenExpiry = this.parseTokenExpiry(cfAccessJwt);
          console.log('✅ Silent CF authentication successful');
          return cfAccessJwt;
        }
      }

      // If silent auth fails, redirect to CF Access login
      console.log('🔄 Silent auth failed, redirecting to CF Access login...');
      return await this.redirectToLogin();

    } catch (error) {
      console.error('❌ Silent authentication failed:', error);
      throw error;
    } finally {
      this.authInProgress = false;
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