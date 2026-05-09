# ⚡ Quick Start Guide

## 🚀 Start Application (One Command)
```bash
npm run dev
```

Wait for both servers to start:
- ✅ Backend: http://localhost:3010
- ✅ Frontend: http://localhost:3000

## 🔐 Login
- URL: http://localhost:3000/login
 ## 📝 Add Material Rates

### Available Materials in Sidebar:
1. **Cement Rate** → Add Cement Rate
2. **Door Rate** → Add Door Rate
3. **Wood Rate** → Add Wood Rate
4. **Sand Rate** → Add Sand Rate
5. **Tile Rate** → Add Tile Rate
6. **Bajri Rate** → Add Bajri Rate
7. **Steel Rate** → Add Steel Rate
8. **Bricks Rate** → Add Bricks Rate

### Form Fields (All Materials):
- ✅ Brand Name (required)
- ✅ Price (required)
- ✅ City (required)
- ✅ Change (daily price change)
- ✅ Category (optional)
- ✅ Unit (e.g., "Per Door", "Per Bag")
- ✅ Main Image (upload)
- ✅ Additional Images (multiple)
- ✅ Description (rich text)
- ✅ Active checkbox (show on public page)

## 🧪 Test APIs
```bash
node scripts/test-material-apis.js
```

## 🌐 Public Pages
- http://localhost:3000/today-cement-rate-in-pakistan
- http://localhost:3000/today-door-rate-in-pakistan
- http://localhost:3000/today-wood-rate-in-pakistan
- http://localhost:3000/today-sand-rate-in-pakistan
- http://localhost:3000/today-tile-rate-in-pakistan
- http://localhost:3000/today-bajri-rate-in-pakistan
- http://localhost:3000/today-steel-rate-in-pakistan
- http://localhost:3000/today-bricks-rate-in-pakistan

## ✅ What's Fixed
- ✅ Environment variables configured for local development
- ✅ CORS configured correctly
- ✅ All 8 material APIs working
- ✅ Admin pages created for all materials
- ✅ Sidebar navigation updated
- ✅ No TypeScript errors
- ✅ Image upload working
- ✅ Rich text editor working

## 🔧 If Something Doesn't Work

### Backend not starting?
```bash
cd apps/api
npm install
npm run start:dev
```

### Frontend not starting?
```bash
cd apps/web
npm install
npm run dev
```

### Can't login?
Reset admin password:
```bash
cd apps/api
node src/scripts/reset-admin.js
```

### API not responding?
Check if backend is running:
```bash
curl http://localhost:3010/api/hello
```

## 📞 Need Help?
Read the full guide: `SETUP-AND-TEST-GUIDE.md`
