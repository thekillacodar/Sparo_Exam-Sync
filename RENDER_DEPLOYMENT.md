# Render Deployment Guide (Free Tier)

This guide explains how to deploy ExamSync to Render using the free tier services.

## 🚀 Quick Deployment

### Step 1: Deploy Backend (Automatic via render.yaml)

1. **Connect Repository to Render**
   - Go to [render.com](https://render.com)
   - Connect your GitHub repository
   - Render will automatically detect the `render.yaml` file

2. **Automatic Backend Service Creation**
   - Render will create one service automatically:
     - `exam-sync-backend` (Node.js web service - free tier)

3. **Environment Variables**
   - Backend will auto-generate: `JWT_SECRET`, `PORT`
   - Database will be stored locally: `./data/exam-sync.db`

### Step 2: Deploy Frontend (Manual Static Site)

1. **Create Static Site Service**
   - Go to Render Dashboard
   - Click "New" → "Static Site"
   - Connect to your GitHub repository

2. **Configure Static Site**
   - **Name**: `exam-sync-frontend`
   - **Build Command**: `npm run build`
   - **Publish Directory**: `dist`
   - **Branch**: `main`

3. **Environment Variables**
   ```
   VITE_API_URL=https://your-backend-service.onrender.com
   ```

## 🧪 Testing the Authentication System

### Local Testing (Before Render Deployment)

1. **Start Backend Locally**
   ```bash
   cd backend
   npm install
   npm run init-db  # Creates demo users
   npm run dev
   ```

2. **Test Authentication Endpoints**

   **Register a new user:**
   ```bash
   curl -X POST http://localhost:5000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "password": "testpass123",
       "firstName": "Test",
       "lastName": "User",
       "role": "student"
     }'
   ```

   **Login with demo credentials:**
   ```bash
   curl -X POST http://localhost:5000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "student@exam.com",
       "password": "demo123"
     }'
   ```

   **Access protected route:**
   ```bash
   curl -X GET http://localhost:5000/api/profile \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

### Demo Credentials

After running `npm run init-db`, these credentials are available:

- **Student**: `student@exam.com` / `demo123`
- **Admin**: `admin@exam.com` / `demo123`
- **Lecturer**: `lecturer@exam.com` / `demo123`

### Testing Script

Run the authentication test script:
```bash
cd backend
node scripts/test-auth.js
```

## 🔧 Configuration

### Database Setup on Render (Free Tier)

The SQLite database will be stored in the application directory:
```
./data/exam-sync.db
```

**Note**: On free tier, the database will be reset when the service restarts. For persistent data, consider upgrading to a paid plan.

### CORS Configuration

For production, update the CORS settings in `backend/config/environment.js`:

```javascript
FRONTEND_URL: process.env.FRONTEND_URL || 'https://your-frontend.onrender.com'
```

### Environment Variables Checklist

**Backend:**
- ✅ `NODE_ENV=production`
- ✅ `JWT_SECRET` (secure random string)
- ✅ `DB_PATH=./data/exam-sync.db`
- ✅ `FRONTEND_URL` (your frontend URL)

**Frontend:**
- ✅ `VITE_API_URL` (your backend URL)

## 🚀 Deployment Steps

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Ready for Render deployment"
   git push origin main
   ```

2. **Deploy Backend**
   - Go to Render Dashboard
   - Click "New" → "Blueprint"
   - Select your repository
   - Deploy the backend service

3. **Deploy Frontend**
   - Go to Render Dashboard
   - Click "New" → "Static Site"
   - Connect to your repository
   - Set build command: `npm run build`
   - Set publish directory: `dist`
   - Add environment variable: `VITE_API_URL=https://your-backend-url.onrender.com`

4. **Initialize Database**
   - SSH into your backend service or use Render shell
   - Run: `npm run init-db`

## 🔍 Troubleshooting

### Common Issues

**Database Connection Issues:**
- Check that DB_PATH environment variable is set correctly
- Ensure the data directory exists and is writable

**CORS Errors:**
- Verify FRONTEND_URL is set to your frontend service URL
- Check that backend allows requests from frontend domain

**Build Failures:**
- Ensure all dependencies are in package.json
- Check Node.js version compatibility

### Logs and Debugging

**View Render Logs:**
- Go to your service dashboard
- Click "Logs" tab
- Check for error messages

**Shell Access:**
- Use Render's shell to debug issues
- Run commands like `npm run init-db` manually

## 📱 Mobile Testing

The application is designed mobile-first and will work well on mobile devices when deployed.

## 🔒 Security Notes

- JWT secrets are auto-generated on Render
- HTTPS is enabled by default on Render
- CORS is configured for your frontend domain

## 🎯 Next Steps

After successful deployment:

1. Test all authentication endpoints
2. Verify database initialization worked
3. Test role-based access control
4. Check mobile responsiveness
5. Monitor performance and usage

## 📞 Support

If you encounter issues:
1. Check Render logs
2. Verify environment variables
3. Test locally first
4. Check this documentation

## 💡 Free Tier Limitations

- **Database**: SQLite database resets on service restart
- **Uptime**: Services may sleep after inactivity
- **Bandwidth**: Limited monthly bandwidth
- **Build Time**: Limited build minutes per month
- **Services**: One web service per blueprint (hence separate frontend deployment)

For production use, consider upgrading to a paid plan for persistent database storage and better performance.

## 🎯 Simplified Deployment Strategy

**Why This Approach:**
- **Backend**: Single web service (free tier compatible)
- **Frontend**: Separate static site deployment (also free tier)
- **Avoids**: Payment requirements for multiple services in one blueprint
- **Maintains**: All functionality for academic project demonstration

Happy deploying! 🚀
