# API Call Interception System

## Overview

This system automatically intercepts outgoing API calls from the frontend and redirects them through a Cloudflare Worker proxy based on authentication requirements. This enables secure API access without exposing API keys in the frontend code.

## How It Works

1. **Service Worker Registration**: A service worker (`/sw.js`) is automatically registered on all pages
2. **Request Interception**: The service worker intercepts all outgoing HTTP requests
3. **Routing Logic**: Requests are checked against the configuration in `/routing.json`
4. **Conditional Redirect**: For `authType` 2 or 3, requests are redirected to the specified destination

## Files Added

### Core Files
- **`/public/sw.js`** - Service worker that intercepts API calls
- **`/public/sw-register.js`** - Service worker registration script
- **`/pages/_document.tsx`** - Custom Next.js document to load the service worker
- **`/pages/api-test.tsx`** - Test page for debugging API interception

### Configuration
- **`/public/routing.json`** - API routing configuration (already exists)

## Routing Configuration

The `/public/routing.json` file defines how API calls should be handled:

```json
[
  {
    "domain": "api.google.com",
    "authType": 1
  },
  {
    "domain": "api.hubapi.com",
    "authType": 2,
    "secretName": "6nr8n2i1ve1rdnku8d1t",
    "destination": "api.simplesalt.company"
  },
  {
    "domain": "api.notion.com",
    "authType": 3,
    "secretName": "fhwowggbohorrud2kj16",
    "destination": "api.simplesalt.company"
  }
]
```

### AuthType Behavior
- **authType 1**: Pass through (no interception)
- **authType 2**: Redirect to destination (API key authentication)
- **authType 3**: Redirect to destination (OAuth authentication)

## Request Flow

### Normal Request (authType 1)
```
Frontend → api.google.com
```

### Intercepted Request (authType 2/3)
```
Frontend → Service Worker → api.simplesalt.company → Cloudflare Worker → api.hubapi.com
```

## Headers Added by Service Worker

When redirecting requests, the service worker adds these headers:

- **`X-Original-Host`**: The original API hostname
- **`X-Auth-Type`**: The authentication type (2 or 3)
- **`X-Secret-Name`**: The secret name for the Cloudflare Worker

## Testing

### Test Page
Visit `/api-test` to test the API interception functionality:
- Test different API endpoints
- View request/response details
- Monitor service worker status
- Reload routing configuration

### Browser Console
The service worker logs all interception activity to the browser console:
```javascript
// Check service worker status
console.log(window.swUtils.getStatus());

// Reload routing configuration
await window.swUtils.reloadRoutingConfig();
```

## Debugging

### Service Worker DevTools
1. Open Chrome DevTools
2. Go to Application → Service Workers
3. View the registered service worker
4. Check console logs for interception activity

### Network Tab
1. Open Chrome DevTools
2. Go to Network tab
3. Make API calls and observe redirected requests
4. Look for requests to `api.simplesalt.company`

### Console Commands
```javascript
// Get service worker status
window.swUtils.getStatus()

// Reload routing configuration
window.swUtils.reloadRoutingConfig()

// Unregister service worker (for debugging)
window.swUtils.unregister()
```

## Plasmic Compatibility

This system is designed to be completely invisible to Plasmic:

- **No Plasmic files modified**: All changes are in separate files
- **Automatic registration**: Service worker loads automatically
- **Zero configuration**: Works out of the box
- **No interference**: Doesn't affect Plasmic GUI or code generation

## Production Deployment

The system works automatically in production:

1. **Static Export**: All files are included in the Next.js static export
2. **Cloudflare Pages**: Service worker is served from the CDN
3. **Automatic Updates**: New routing config is loaded on page refresh
4. **HTTPS Required**: Service workers only work over HTTPS (production)

## Security Considerations

- **No API Keys Exposed**: All sensitive credentials stay in Cloudflare Workers
- **CORS Handling**: Service worker manages cross-origin requests
- **Request Validation**: Only configured domains are intercepted
- **Error Handling**: Failed requests return proper error responses

## Maintenance

### Updating Routing Configuration
1. Edit `/public/routing.json`
2. Commit and deploy
3. Routing updates automatically on next page load

### Adding New APIs
1. Add entry to `routing.json` with appropriate `authType`
2. Configure corresponding secrets in Cloudflare Worker
3. Test using the `/api-test` page

### Troubleshooting
- Check browser console for service worker logs
- Use `/api-test` page to verify functionality
- Ensure HTTPS is used (required for service workers)
- Verify routing.json syntax is valid JSON