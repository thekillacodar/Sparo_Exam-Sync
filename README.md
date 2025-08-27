# ExamSync - Examination Management System

A full-stack web application for managing examination timetables with real-time notifications, conflict detection, and calendar integration.

## 🚀 Features

- **🔐 Authentication**: JWT-based login with role-based access (Student/Lecturer/Admin)
- **📅 Exam Management**: Create, edit, delete, and view examinations
- **⚠️ Conflict Detection**: Automatic detection of scheduling conflicts
- **🔔 Notifications**: Real-time notifications with database storage
- **📊 Dashboard**: Live statistics and upcoming exam overview
- **📄 Export**: PDF and CSV export functionality
- **📱 Responsive**: Mobile-friendly design
- **🐳 Docker Ready**: Fully containerized for easy deployment
- **🌐 Render Deployed**: Optimized for Render platform

## 🛠️ Tech Stack

### Backend
- **Node.js** 20.19.2 LTS
- **Express.js** 5.1.0
- **SQLite** 5.1.7
- **JWT** 9.0.2
- **bcryptjs** 3.0.2

### Frontend (Upcoming)
- **React** 18.2.x
- **Vite** 5.1.x
- **Tailwind CSS** 3.4.x
- **Axios** 1.6.x

### DevOps
- **Docker** & Docker Compose
- **Render** (Cloud Platform)
- **Nginx** (Production Frontend)

## 📋 Prerequisites

- **Node.js** 20.x or higher
- **npm** 10.x or higher
- **Docker** & Docker Compose (optional, for local development)
- **Git** for version control

## 🚀 Quick Start

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone <your-repo-url>
cd exam-sync

# Start all services
docker-compose up --build

# Access the application:
# Backend API: http://localhost:5000
# Frontend: http://localhost:3000 (when implemented)
```

### Option 2: Manual Setup

```bash
# Backend setup
cd backend
npm install
cp .env.template .env  # Configure environment variables
npm run init-db        # Initialize database with sample data
npm run dev           # Start development server

# Frontend setup (when implemented)
cd ../frontend
npm install
npm run dev
```

## 🔧 Configuration

### Environment Variables

Create `.env` file in the `backend/` directory:

```env
# Environment
NODE_ENV=development
PORT=5000

# Database
DB_PATH=./data/exam-sync.db

# JWT (CHANGE THIS IN PRODUCTION!)
JWT_SECRET=your-super-secret-jwt-key-change-in-production-make-it-very-long-and-secure
JWT_EXPIRES_IN=7d

# CORS (for production)
FRONTEND_URL=https://your-frontend-domain.com

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 🎯 Demo Credentials

After running the initialization script, use these credentials:

- **Student**: `student@exam.com` / `demo123`
- **Admin**: `admin@exam.com` / `demo123`
- **Lecturer**: `lecturer@exam.com` / `demo123`

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/verify` - Verify JWT token

### Exam Management
- `GET /api/exams` - Get all exams
- `POST /api/exams` - Create new exam
- `PUT /api/exams/:id` - Update exam
- `DELETE /api/exams/:id` - Delete exam

### Notifications
- `GET /api/notifications` - Get notifications
- `POST /api/notifications` - Create notification
- `PUT /api/notifications/:id/read` - Mark as read

### Health Check
- `GET /health` - Server health status

## 🚀 Deployment on Render

### Backend Deployment

1. **Create Render Account**: Sign up at [render.com](https://render.com)

2. **Connect Repository**: Link your GitHub repository

3. **Create Web Service**:
   - **Name**: `exam-sync-backend`
   - **Environment**: `Node.js 20.x`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

4. **Environment Variables**: Set all required environment variables

5. **Persistent Disk**: Configure for SQLite database storage
   - **Mount Path**: `/opt/render/project/src/backend/data`
   - **Size**: 1GB (adjust as needed)

6. **Deploy**: Push to your repository to trigger deployment

### Frontend Deployment (Future)

1. **Create Static Site**:
   - **Name**: `exam-sync-frontend`
   - **Build Command**: `npm run build`
   - **Publish Directory**: `dist`

2. **Environment Variables**: Set `VITE_API_URL` to your backend URL

## 🏗️ Project Structure

```
exam-sync/
├── backend/                 # Node.js/Express backend
│   ├── config/             # Database and environment configuration
│   ├── routes/             # API route handlers
│   ├── middleware/         # Custom middleware
│   ├── controllers/        # Business logic
│   ├── scripts/            # Database initialization scripts
│   ├── Dockerfile          # Docker configuration
│   ├── package.json        # Dependencies and scripts
│   └── README.md           # Backend documentation
├── frontend/               # React frontend (upcoming)
│   ├── src/
│   ├── public/
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml      # Docker Compose configuration
└── README.md              # This file
```

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Integration tests
npm run test:integration
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues:

1. Check the [Backend README](backend/README.md) for detailed setup instructions
2. Review the [Docker Documentation](backend/README.md#docker-deployment)
3. Check the [Render Deployment Guide](backend/README.md#render-deployment)

## 🎓 Academic Project Note

This project is designed as an undergraduate final year project demonstrating:
- Full-stack web development
- Database design and management
- API development with authentication
- Containerization and deployment
- Modern JavaScript/Node.js development practices
- Production-ready application architecture

---

**Happy coding! 🎉**
