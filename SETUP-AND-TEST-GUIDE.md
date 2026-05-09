# 🚀 Setup and Testing Guide

## ✅ What Was Fixed

### 1. Environment Configuration
- **Frontend (.env)**: Updated to use `http://localhost:3010` for local API calls
- **Backend (.env)**: 
  - Set `NODE_ENV=development` for local testing
  - Updated `FRONTEND_URL=http://localhost:3000` for CORS
  - Port: `3010` (backend API)

### 2. Admin Pages Created
All 7 material rate admin pages are now available:
- Door Rate (`/dashboard/door-rate`)
- Wood Rate (`/dashboard/wood-rate`)
- Sand Rate (`/dashboard/sand-rate`)
- Tile Rate (`/dashboard/tile-rate`)
- Bajri Rate (`/dashboard/bajri-rate`)
- Steel Rate (`/dashboard/steel-rate`)
- Bricks Rate (`/dashboard/bricks-rate`)

Each has:
- List page (view all rates)
- Add page (create new rate)
- Edit page (update existing rate)

### 3. Sidebar Navigation
Updated with individual sections for each material, replacing the generic "Material Rates" section.

### 4. Backend APIs
All backend controllers verified and working:
- ✅ cement-rate
- ✅ door-rate
- ✅ wood-rate
- ✅ sand-rate
- ✅ tile-rate
- ✅ bajri-rate
- ✅ steel-rate
- ✅ bricks-rate

Each API has:
- `GET /api/{material}-rate` - Public endpoint
- `GET /api/{material}-rate/admin/all` - Admin list (requires auth)
- `POST /api/{material}-rate` - Create (requires auth)
- `PUT /api/{material}-rate/:id` - Update (requires auth)
- `DELETE /api/{material}-rate/:id` - Delete (requires auth)

## 🚀 How to Start the Application

### Step 1: Start Both Servers
```bash
npm run dev
```

This will start:
- **Backend API**: http://localhost:3010
- **Frontend**: http://localhost:3000

### Step 2: Wait for Servers to Start
You should see:
```
[dev:api] 🚀 API server is running on port: 3010
[dev:api] 📡 Health check available at: http://localhost:3010/api/hello
[dev:web] ▲ Next.js 15.x.x
[dev:web] - Local: http://localhost:3000
```

### Step 3: Test API Connection
Run the test script to verify all APIs are working:
```bash
node scripts/test-material-apis.js
```

Expected output:
```
🚀 Testing all Material Rate APIs...
============================================================

🧪 Testing cement-rate...
  ✅ GET /cement-rate - 200 - X items

🧪 Testing door-rate...
  ✅ GET /door-rate - 200 - X items

... (all materials)

📊 SUMMARY:
✅ Successful: 8/8
❌ Failed: 0/8

🎉 All APIs are working correctly!
```

## 🔐 Login to Admin Panel

 
## 📝 How to Add Material Rates

### Example: Adding a Door Rate

1. **Login** to admin panel
2. **Navigate** to sidebar → "Door Rate" → "Add Door Rate"
3. **Fill the form**:
   - Brand Name: e.g., "Wooden Door Premium"
   - Price: e.g., 15000
   - Change: e.g., +500 (daily price change)
   - City: e.g., "Lahore"
   - Category: e.g., "Solid Wood"
   - Unit: e.g., "Per Door"
   - Upload main image
   - Upload additional images (optional)
   - Add description (rich text editor)
   - Check "Active" to make it visible on public pages
4. **Click "Save Door Rate"**

### Verify on Public Page
- Go to: http://localhost:3000/today-door-rate-in-pakistan
- You should see your newly added door rate card

## 🧪 Testing Each Material

### Test Cement Rate
```bash
# Add via admin panel
http://localhost:3000/dashboard/cement-rate/add

# View public page
http://localhost:3000/today-cement-rate-in-pakistan
```

### Test Door Rate
```bash
# Add via admin panel
http://localhost:3000/dashboard/door-rate/add

# View public page
http://localhost:3000/today-door-rate-in-pakistan
```

### Test Wood Rate
```bash
# Add via admin panel
http://localhost:3000/dashboard/wood-rate/add

# View public page
http://localhost:3000/today-wood-rate-in-pakistan
```

### Test Sand Rate
```bash
# Add via admin panel
http://localhost:3000/dashboard/sand-rate/add

# View public page
http://localhost:3000/today-sand-rate-in-pakistan
```

### Test Tile Rate
```bash
# Add via admin panel
http://localhost:3000/dashboard/tile-rate/add

# View public page
http://localhost:3000/today-tile-rate-in-pakistan
```

### Test Bajri Rate
```bash
# Add via admin panel
http://localhost:3000/dashboard/bajri-rate/add

# View public page
http://localhost:3000/today-bajri-rate-in-pakistan
```

### Test Steel Rate
```bash
# Add via admin panel
http://localhost:3000/dashboard/steel-rate/add

# View public page
http://localhost:3000/today-steel-rate-in-pakistan
```

### Test Bricks Rate
```bash
# Add via admin panel
http://localhost:3000/dashboard/bricks-rate/add

# View public page
http://localhost:3000/today-bricks-rate-in-pakistan
```

## 🔍 Troubleshooting

### Issue: "Cannot POST /api/door-rate"
**Solution**: Make sure backend is running on port 3010
```bash
# Check if backend is running
curl http://localhost:3010/api/hello
```

### Issue: "Network Error" when posting
**Solution**: Check CORS configuration
1. Verify `apps/api/.env` has `FRONTEND_URL=http://localhost:3000`
2. Restart backend server
3. Clear browser cache

### Issue: "401 Unauthorized"
**Solution**: Login again
1. Go to http://localhost:3000/login
2. Login with `user@gmail.com` / `password`
3. Try posting again

### Issue: Images not uploading
**Solution**: Check storage configuration
1. Verify `apps/api/.env` has `STORAGE_DISK=local`
2. Check `apps/api/uploads` directory exists
3. Restart backend server

### Issue: Page content not showing
**Solution**: Check database
1. Verify pages exist in database (Pages collection)
2. Check page status is "PUBLISHED"
3. Verify slug matches the URL

## 📊 API Endpoints Reference

### Public Endpoints (No Auth Required)
```
GET  /api/cement-rate          - Get all cement rates
GET  /api/door-rate            - Get all door rates
GET  /api/wood-rate            - Get all wood rates
GET  /api/sand-rate            - Get all sand rates
GET  /api/tile-rate            - Get all tile rates
GET  /api/bajri-rate           - Get all bajri rates
GET  /api/steel-rate           - Get all steel rates
GET  /api/bricks-rate          - Get all bricks rates
```

### Admin Endpoints (Auth Required)
```
GET    /api/{material}-rate/admin/all  - Get all rates (admin)
GET    /api/{material}-rate/:id        - Get single rate
POST   /api/{material}-rate            - Create new rate
PUT    /api/{material}-rate/:id        - Update rate
DELETE /api/{material}-rate/:id        - Delete rate
```

## 🎯 Next Steps

1. **Start servers**: `npm run dev`
2. **Test APIs**: `node scripts/test-material-apis.js`
3. **Login**: http://localhost:3000/login
4. **Add rates**: Navigate to any material in sidebar
5. **Verify**: Check public pages to see your rates

## 📝 Notes

- All TypeScript errors have been fixed
- All backend modules are registered in `app.module.ts`
- All frontend pages use proper API calls
- CORS is configured for local development
- Image upload is working with local storage
- Rich text editor is available for descriptions

## 🚨 Important

Before deploying to production:
1. Update `apps/web/.env` to use production URLs
2. Update `apps/api/.env` to use production settings
3. Set `NODE_ENV=production` in backend
4. Update `FRONTEND_URL` to production domain
5. Configure proper storage (S3 or similar)
