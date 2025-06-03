# CF Worker Zero Trust Protection Setup

## Current Status
- ✅ CF Zero Trust authentication system implemented in apps
- ✅ Service worker integration with CF Access tokens
- ⚠️ Need to configure CF Access protection for API worker

## API Worker Details
- **URL**: `nuywznihg08edfslfk29.api.simplesalt.company`
- **Purpose**: API authentication proxy
- **Current Status**: Unprotected (needs Zero Trust)

## Required CF Access Configuration

### 1. Create Access Application for API Worker

You'll need to create a CF Access application in the Cloudflare dashboard:

#### Application Settings:
- **Name**: `API Authentication Proxy`
- **Subdomain**: `nuywznihg08edfslfk29`
- **Domain**: `api.simplesalt.company`
- **Application Type**: `Self-hosted`

#### Policy Configuration:
- **Policy Name**: `GSuite Domain Users`
- **Action**: `Allow`
- **Include**: 
  - Rule Type: `Emails ending in`
  - Value: `@simplesalt.company` (or your GSuite domain)

#### Session Settings:
- **Session Duration**: `24h`
- **Auto-redirect to Identity Provider**: `Yes` (for seamless auth)

### 2. Manual Steps Required

Since the API key has limited permissions, you'll need to configure this manually:

1. **Go to Cloudflare Dashboard**
   - Navigate to your account → Zero Trust → Access → Applications

2. **Add Application**
   - Click "Add an application"
   - Choose "Self-hosted"

3. **Configure Application**
   ```
   Application name: API Authentication Proxy
   Subdomain: nuywznihg08edfslfk29
   Domain: api.simplesalt.company
   ```

4. **Create Policy**
   ```
   Policy name: GSuite Domain Users
   Action: Allow
   Include: Emails ending in @simplesalt.company
   ```

5. **Advanced Settings**
   ```
   Session duration: 24h
   Auto-redirect to identity: Yes
   Skip identity provider selection: Yes
   ```

### 3. Test the Configuration

After setup, test with:

```bash
# This should redirect to GSuite login if not authenticated
curl -v https://nuywznihg08edfslfk29.api.simplesalt.company/

# After authentication, should work normally
curl -H "CF-Access-Jwt-Assertion: YOUR_JWT_TOKEN" \
     https://nuywznihg08edfslfk29.api.simplesalt.company/
```

## Integration with Apps

The apps frontend is already configured to:

1. **Auto-authenticate** with CF Zero Trust on page load
2. **Extract CF Access JWT** from cookies/headers  
3. **Pass JWT to service worker** for API calls
4. **Include JWT in proxied requests** to the API worker

## Expected Flow

```
User loads apps.simplesalt.company
    ↓
CF Zero Trust auth (silent if GSuite session exists)
    ↓
CF Access JWT stored in browser
    ↓
API call made from frontend
    ↓
Service worker intercepts call
    ↓
Service worker adds CF Access JWT header
    ↓
Request sent to nuywznihg08edfslfk29.api.simplesalt.company
    ↓
CF Access validates JWT
    ↓
Request forwarded to worker
    ↓
Worker processes with stored secrets
```

## Next Steps

1. **Configure CF Access application** (manual step above)
2. **Test authentication flow** 
3. **Verify service worker integration**
4. **Set up regression testing** with service account

Would you like me to proceed with the regression testing setup while you configure the CF Access application?