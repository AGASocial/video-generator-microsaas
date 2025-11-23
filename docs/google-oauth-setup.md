# Google OAuth Setup Guide

## Problem
When users try to sign in with Google, they may encounter errors like:
- `redirect_uri_mismatch` - The redirect URL is not in the allowed list
- `invalid_request` - Malformed redirect URL
- `access_denied` - User canceled the consent
- `invalid request: both auth code and code verifier should be non-empty` - PKCE flow issue

## Solution: Configure Redirect URLs in Supabase

Your application uses the following redirect URL format:
```
{origin}/{locale}/auth/callback?redirect={encoded_redirect_path}
```

### Step 1: Configure Site URL in Supabase

**CRITICAL**: The Site URL must match your production domain exactly.

1. Go to your **Supabase Dashboard**
2. Navigate to **Authentication** → **URL Configuration**
3. Under **Site URL**, set it to:
   ```
   https://cctvmagic.aga.social
   ```
   ⚠️ **Important**: 
   - No trailing slash
   - Must use HTTPS for production
   - Must match your actual domain exactly

### Step 2: Add Redirect URLs to Supabase

1. In the same **URL Configuration** page
2. Under **Redirect URLs**, add the following URLs:

#### Production URLs (Required)
```
https://cctvmagic.aga.social/en/auth/callback
https://cctvmagic.aga.social/es/auth/callback
```

#### Development URLs (Optional, for local testing)
```
http://localhost:3000/en/auth/callback
http://localhost:3000/es/auth/callback
```

### Step 3: Configure Google OAuth Provider

1. In Supabase Dashboard, go to **Authentication** → **Providers**
2. Click on **Google**
3. Enable the provider if not already enabled
4. Add your Google OAuth credentials:
   - **Client ID** (from Google Cloud Console)
   - **Client Secret** (from Google Cloud Console)

### Step 4: Configure Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** → **Credentials**
4. Click on your OAuth 2.0 Client ID
5. Under **Authorized JavaScript origins**, add:
   ```
   https://cctvmagic.aga.social
   ```
   ⚠️ **Important**: This is required for PKCE flows that happen in the browser. Add your production domain (and localhost for development if needed).
6. Under **Authorized redirect URIs**, add:
   ```
   https://uxskkfvndzoojxucjmxg.supabase.co/auth/v1/callback
   ```
   (Replace `uxskkfvndzoojxucjmxg` with your actual Supabase project reference)
   ⚠️ **Note**: This is the Supabase callback URL, not your app's callback URL. Supabase handles the OAuth flow and then redirects to your app.

### Step 5: Verify the Configuration

1. Test the Google sign-in flow:
   - Go to `https://cctvmagic.aga.social/es/auth/login`
   - Click "Sign in with Google"
   - Complete the OAuth flow
   - You should be redirected back to your app

## Troubleshooting

### Error: `redirect_uri_mismatch`
- **Cause**: The redirect URL is not in Supabase's allowed list
- **Fix**: Add the exact redirect URL to Supabase Dashboard → Authentication → URL Configuration

### Error: `invalid_request`
- **Cause**: Malformed redirect URL or missing parameters
- **Fix**: Check that the redirect URL format matches exactly: `{origin}/{locale}/auth/callback`

### Error: `access_denied`
- **Cause**: User canceled the Google consent screen
- **Fix**: This is expected behavior, not an error. User can try again.

### Error: `invalid request: both auth code and code verifier should be non-empty`
- **Cause**: PKCE (Proof Key for Code Exchange) flow is failing. This happens when:
  1. **Additional parameters in callback URL**: If you add query parameters (like `?redirect=...`) to the callback URL, Supabase cannot parse its PKCE parameters (`code` and `code_verifier`)
  2. **Site URL mismatch**: The Site URL in Supabase doesn't match your domain exactly
  3. **Cookie issues**: Browser cookies are blocked or cleared during the OAuth flow
  
- **Fix**: 
  1. **✅ CRITICAL - Clean Callback URL**: The callback URL must be clean with NO additional parameters:
     - ❌ **WRONG**: `/es/auth/callback?redirect=/es/generate`
     - ✅ **CORRECT**: `/es/auth/callback`
     - Store the redirect destination in `sessionStorage` before OAuth, then retrieve it in the callback page after session creation
  2. **Verify Site URL**: Ensure the Site URL in Supabase is exactly `https://cctvmagic.aga.social` (no trailing slash, no path)
  3. **Clear Browser Data**: Clear cookies and sessionStorage for your domain, then try again
  4. **Check Cookie Settings**: Ensure cookies are enabled in the browser
  5. **Domain Match**: The Site URL must match the domain where the OAuth flow is initiated
  6. **HTTPS Required**: Production must use HTTPS for secure cookies

### Callback Page Shows Error
- **Cause**: The `exchangeCodeForSession` call is failing
- **Fix**: 
  - Check browser console for detailed error messages
  - Verify Supabase environment variables are set correctly
  - Ensure the code parameter is present in the URL
  - Clear browser cookies and try again

## Current Redirect URL Format

**⚠️ IMPORTANT**: The callback URL must be clean with NO additional parameters to allow PKCE to work.

The application constructs redirect URLs as:
```typescript
// Store redirect destination in sessionStorage (NOT in the URL)
sessionStorage.setItem("auth_redirect", redirect);

// Callback URL must be clean - no parameters!
const redirectTo = `${origin}/${locale}/auth/callback`;
```

Where:
- `origin` = Current domain (e.g., `https://cctvmagic.aga.social`)
- `locale` = Current locale (`en` or `es`)
- `redirect` = Where to redirect after successful login (stored in sessionStorage, not in URL)

The redirect destination is retrieved in the callback page after the session is created:
```typescript
const redirect = sessionStorage.getItem("auth_redirect") || `/${locale}/generate`;
sessionStorage.removeItem("auth_redirect");
router.push(redirect);
```

## Important Notes

1. **Wildcards**: Supabase does NOT support wildcards in redirect URLs. You must add each exact URL.
2. **Query Parameters**: The redirect URL includes query parameters (`?redirect=...`), but Supabase only matches the base path. The query parameters are preserved automatically.
3. **HTTPS Required**: Production URLs must use HTTPS.
4. **Locale Support**: Since your app supports multiple locales, you need to add redirect URLs for each locale.

## Testing Checklist

- [ ] Added production redirect URLs to Supabase
- [ ] Added development redirect URLs (if testing locally)
- [ ] Configured Google OAuth in Supabase
- [ ] Added Supabase callback URL to Google Cloud Console
- [ ] Tested sign-in flow on production
- [ ] Tested sign-in flow on development (if applicable)
- [ ] Verified redirect works for both locales (en/es)

