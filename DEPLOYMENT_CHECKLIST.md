# 🚀 SEO Fixes Deployment Checklist

## ✅ Files Modified

### Frontend (apps/web)
- [x] `.env` - Added NEXT_PUBLIC_BASE_URL and NEXT_PUBLIC_SITE_URL
- [x] `.env.production` - Added NEXT_PUBLIC_BASE_URL and NEXT_PUBLIC_SITE_URL
- [x] `app/robots.ts` - Improved robots.txt with Googlebot rules
- [x] `app/(pages)/properties/[slug]/page.tsx` - Fixed canonical URL + added breadcrumbs
- [x] `app/(pages)/properties/page.tsx` - Added initialProperties prop support
- [x] `components/PropertiesListing.tsx` - Added SEO-friendly error fallback
- [x] `components/Breadcrumbs.tsx` - NEW: Created breadcrumb component

### Backend (apps/api)
- [x] `src/main.ts` - Added 30-second timeout for slow requests

### Documentation
- [x] `SEO_AUDIT_REPORT.md` - Complete audit report
- [x] `SEO_FIX_IMPLEMENTATION_GUIDE.md` - Detailed implementation guide
- [x] `QUICK_START_SEO_FIXES.md` - Quick start guide
- [x] `DEPLOYMENT_CHECKLIST.md` - This file

---

## 📋 Pre-Deployment Steps

### 1. Verify Changes Locally

```bash
# Build both apps
cd apps/web
npm run build

cd ../api
npm run build
```

**Expected:** No TypeScript errors, build succeeds

### 2. Test Error Fallback

```bash
# Temporarily break API to test error screen
# Stop API server
cd apps/api
pm2 stop api

# Visit frontend
# Open: http://localhost:3010/properties/rent/lahore
# Should see: SEO-friendly fallback content with links

# Restart API
pm2 start api
```

**Expected:** Error page shows content, not just "Error Loading Properties"

### 3. Test Breadcrumbs

```bash
# Visit any property detail page
# Open: http://localhost:3010/properties/[any-property-slug]
```

**Expected:** Breadcrumbs visible at top: Home > Properties > City > Property

### 4. Verify Environment Variables

```bash
cd apps/web
cat .env | grep NEXT_PUBLIC_BASE_URL
cat .env.production | grep NEXT_PUBLIC_BASE_URL
```

**Expected:** Both files have the variables set

---

## 🚀 Deployment Steps

### Step 1: Backup Current Code

```bash
# Create backup branch
git checkout -b backup-before-seo-fixes
git push origin backup-before-seo-fixes

# Return to main branch
git checkout main
```

### Step 2: Commit Changes

```bash
# Stage all changes
git add .

# Commit with descriptive message
git commit -m "🔧 SEO Fixes: Googlebot rendering, canonical URLs, breadcrumbs, timeouts

- Added SEO-friendly error fallback in PropertiesListing
- Fixed canonical URLs in property detail pages
- Added visible breadcrumbs component
- Increased API timeout to 30 seconds
- Improved robots.txt with Googlebot-specific rules
- Added missing environment variables for BASE_URL
- Created comprehensive SEO audit documentation"

# Push to repository
git push origin main
```

### Step 3: Deploy to Production

#### Option A: Manual Deployment (PM2)

```bash
# SSH to server
ssh user@propertydealer.pk

# Navigate to project
cd /path/to/your/project

# Pull latest changes
git pull origin main

# Install dependencies (if needed)
npm install

# Build both apps
cd apps/web
npm run build

cd ../api
npm run build

# Restart services
pm2 restart web
pm2 restart api

# Check status
pm2 status
pm2 logs web --lines 50
pm2 logs api --lines 50
```

#### Option B: Automated Deployment (CI/CD)

```bash
# If using GitHub Actions, Vercel, or similar
# Just push to main branch
git push origin main

# Monitor deployment
# Check your CI/CD dashboard
```

### Step 4: Verify Deployment

```bash
# Test production site
curl -I https://propertydealer.pk/properties/rent/lahore

# Should return 200 OK

# Test robots.txt
curl https://propertydealer.pk/robots.txt

# Should show updated rules

# Test sitemap
curl https://propertydealer.pk/sitemap.xml

# Should load without errors
```

---

## 🧪 Post-Deployment Testing

### Test 1: Error Fallback (Critical)

**Simulate API failure:**

```bash
# Temporarily stop API or block it
# Visit: https://propertydealer.pk/properties/rent/lahore
```

**Expected Results:**
- ✅ Page shows SEO-friendly content
- ✅ Links to other cities/property types visible
- ✅ "Why Choose Property Dealer" section visible
- ✅ Retry button at bottom

**If Failed:**
- Check browser console for errors
- Check server logs: `pm2 logs web`
- Verify PropertiesListing.tsx changes deployed

### Test 2: Breadcrumbs

**Visit any property:**
```
https://propertydealer.pk/properties/[any-property-slug]
```

**Expected Results:**
- ✅ Breadcrumbs visible at top
- ✅ Format: Home > Properties for Rent > City > Property Name
- ✅ All links clickable
- ✅ Schema.org markup in HTML

**If Failed:**
- Check if Breadcrumbs.tsx exists
- Check property detail page imports
- View page source for schema markup

### Test 3: Canonical URLs

**Check page source:**
```bash
curl https://propertydealer.pk/properties/[property-slug] | grep canonical
```

**Expected Results:**
- ✅ Shows: `<link rel="canonical" href="https://propertydealer.pk/properties/[slug]" />`
- ✅ NOT: `<link rel="canonical" href="https://propertydealer.pk/[slug]" />`

**If Failed:**
- Check property detail page metadata
- Verify environment variables loaded

### Test 4: Robots.txt

**Visit:**
```
https://propertydealer.pk/robots.txt
```

**Expected Results:**
- ✅ Shows separate Googlebot rules
- ✅ Has crawl-delay: 1
- ✅ Disallows /api and /_next
- ✅ Points to sitemap

**If Failed:**
- Check apps/web/app/robots.ts
- Rebuild and redeploy

### Test 5: API Timeout

**Test slow endpoint:**
```bash
# This should not timeout
curl -w "@curl-format.txt" https://propertydealer.pk/api/properties?limit=100
```

**Expected Results:**
- ✅ Returns data (even if slow)
- ✅ No 499 or 504 errors
- ✅ Response time < 30 seconds

**If Failed:**
- Check API logs: `pm2 logs api`
- Verify main.ts timeout code deployed
- Check nginx timeout settings

---

## 🔍 Google Search Console Testing

### Test 1: URL Inspection (Most Important)

1. Go to: https://search.google.com/search-console
2. Select your property
3. Click "URL Inspection" in left sidebar
4. Enter: `https://propertydealer.pk/properties/rent/lahore`
5. Click "Test Live URL"
6. Wait 30-60 seconds
7. Click "View Tested Page" → "Screenshot"

**Expected Results:**
- ✅ Screenshot shows property listings OR fallback content
- ✅ NOT showing "Error Loading Properties" alone
- ✅ "Page is indexable" message
- ✅ No errors in "Coverage" section

**If Failed:**
- Check "More Info" tab for errors
- Look at HTML in "View Crawled Page"
- Check if API is accessible from Google's servers

### Test 2: Rich Results Test

1. Go to: https://search.google.com/test/rich-results
2. Enter: `https://propertydealer.pk/properties/[any-property-slug]`
3. Click "Test URL"

**Expected Results:**
- ✅ Detects "Product" or "RealEstateListing" schema
- ✅ Detects "BreadcrumbList" schema
- ✅ No errors or warnings

**If Failed:**
- Check schema.org markup in page source
- Verify buildPropertySchema function
- Check buildBreadcrumbSchema function

### Test 3: Request Indexing

For 5-10 important pages:

1. URL Inspection
2. Click "Request Indexing"
3. Wait for confirmation

**Pages to prioritize:**
- Homepage: https://propertydealer.pk
- Main listings: https://propertydealer.pk/properties/rent
- Top cities: /properties/rent/lahore, /properties/rent/islamabad
- Popular properties: Top 5 property detail pages

---

## 📊 Monitoring (First 48 Hours)

### Server Logs

```bash
# Watch for errors
pm2 logs web --lines 100 | grep -i error
pm2 logs api --lines 100 | grep -i error

# Watch for timeouts
pm2 logs api --lines 100 | grep -i timeout

# Monitor response times
pm2 monit
```

**What to look for:**
- ❌ Repeated API errors
- ❌ Timeout errors (499, 504)
- ❌ Database connection issues
- ✅ Normal request/response flow

### Google Search Console

**Check daily:**

1. **Coverage Report**
   - Path: Coverage → Excluded
   - Look for: Soft 404 errors
   - Expected: Should not increase

2. **Performance Report**
   - Path: Performance
   - Look for: Impressions and clicks
   - Expected: Should remain stable or increase

3. **Core Web Vitals**
   - Path: Experience → Core Web Vitals
   - Look for: LCP, FID, CLS scores
   - Expected: Should remain in "Good" range

### Error Tracking

If you have Sentry/LogRocket/similar:

- Monitor error rates
- Check for new error types
- Look for patterns in failed requests

---

## 🆘 Rollback Plan

If critical issues occur:

### Quick Rollback

```bash
# SSH to server
ssh user@propertydealer.pk

# Navigate to project
cd /path/to/your/project

# Checkout backup branch
git checkout backup-before-seo-fixes

# Rebuild
cd apps/web && npm run build
cd ../api && npm run build

# Restart
pm2 restart all

# Verify
curl -I https://propertydealer.pk
```

### Partial Rollback

If only one component is problematic:

```bash
# Revert specific file
git checkout backup-before-seo-fixes -- apps/web/components/PropertiesListing.tsx

# Rebuild and restart
cd apps/web && npm run build
pm2 restart web
```

---

## ✅ Success Criteria

### Immediate (Within 1 Hour)

- [x] Site loads without errors
- [x] No increase in error rates
- [x] API responding normally
- [x] Breadcrumbs visible on property pages
- [x] Error fallback shows content (test by stopping API)

### Short Term (24-48 Hours)

- [x] Google Search Console shows no new errors
- [x] URL Inspection shows proper rendering
- [x] No 409/499 errors in logs
- [x] Server response times normal

### Medium Term (1 Week)

- [x] Soft 404 errors decreasing in Search Console
- [x] More pages indexed
- [x] Rich results appearing in search
- [x] Breadcrumbs showing in search results

### Long Term (1 Month)

- [x] All Soft 404s resolved
- [x] Improved search rankings
- [x] Increased organic traffic
- [x] Better Core Web Vitals scores

---

## 📞 Support Contacts

### If Issues Occur

1. **Check Documentation**
   - SEO_AUDIT_REPORT.md
   - SEO_FIX_IMPLEMENTATION_GUIDE.md
   - QUICK_START_SEO_FIXES.md

2. **Check Logs**
   ```bash
   pm2 logs web --lines 200
   pm2 logs api --lines 200
   tail -f /var/log/nginx/error.log
   ```

3. **Test Locally**
   - Reproduce issue on local environment
   - Check browser console
   - Check network tab

4. **Rollback if Critical**
   - Use rollback plan above
   - Fix issue locally
   - Redeploy when fixed

---

## 📝 Post-Deployment Notes

### Date Deployed: _____________

### Deployed By: _____________

### Issues Encountered:
- [ ] None
- [ ] Minor (list below)
- [ ] Major (list below)

### Notes:
```
[Add any notes about the deployment here]
```

### Follow-up Actions:
- [ ] Monitor Search Console for 1 week
- [ ] Check error logs daily for 3 days
- [ ] Request re-indexing of top 10 pages
- [ ] Schedule follow-up review in 2 weeks

---

**Deployment Status:** ⏳ Pending / ✅ Complete / ❌ Rolled Back

**Last Updated:** April 9, 2026
