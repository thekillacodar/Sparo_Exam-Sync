# ExamSync Backend

Node.js/Express backend for the ExamSync examination management system.

## Features

- **Authentication**: JWT-based authentication with role-based access control
- **Exam Management**: Full CRUD operations for examination scheduling
- **Notifications**: Real-time notification system
- **Database**: SQLite with proper schema design
- **Security**: Helmet, CORS, rate limiting, and input validation
- **Docker Ready**: Fully containerized for easy deployment

## Tech Stack

- **Runtime**: Node.js 20.19.2 LTS
- **Framework**: Express.js 5.1.0
- **Database**: SQLite 5.1.7
- **Authentication**: JWT 9.0.2
- **Password Hashing**: bcryptjs 3.0.2
- **Security**: Helmet 7.1.0, CORS 2.8.5
- **Rate Limiting**: express-rate-limit 7.4.0

## Quick Start

### Prerequisites

- Node.js 20.x or higher
- npm 10.x or higher

### Installation

1. **Clone the repository and navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.template .env
   # Edit .env with your configuration
   ```

4. **Initialize the database:**
   ```bash
   npm run init-db
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:5000`

## Environment Variables

Create a `.env` file in the backend directory:

```env
# Environment Configuration
NODE_ENV=development
PORT=5000

# Database Configuration
DB_PATH=./data/exam-sync.db

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production-make-it-very-long-and-secure
JWT_EXPIRES_IN=7d

# CORS Configuration (for production)
FRONTEND_URL=https://your-frontend-domain.com

# Security Configuration
BCRYPT_ROUNDS=12

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/verify` - Verify JWT token

### Exams
- `GET /api/exams` - Get all exams
- `GET /api/exams/:id` - Get exam by ID
- `POST /api/exams` - Create new exam
- `PUT /api/exams/:id` - Update exam
- `DELETE /api/exams/:id` - Delete exam
- `GET /api/exams/range/:startDate/:endDate` - Get exams in date range

### Notifications
- `GET /api/notifications` - Get all notifications
- `POST /api/notifications` - Create notification
- `PUT /api/notifications/:id/read` - Mark as read
- `DELETE /api/notifications/:id` - Delete notification

### Health Check
- `GET /health` - Server health status

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'lecturer', 'admin')),
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### Exams Table
```sql
CREATE TABLE exams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_code TEXT NOT NULL,
  course_name TEXT NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  venue TEXT NOT NULL,
  duration INTEGER NOT NULL CHECK (duration > 0),
  status TEXT DEFAULT 'upcoming',
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users (id)
)
```

### Notifications Table
```sql
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  is_read BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id)
)
```

## Docker Deployment

### Build and run with Docker Compose:

```bash
# From project root
docker-compose up --build
```

### Manual Docker build:

```bash
# Build the image
docker build -t exam-sync-backend ./backend

# Run the container
docker run -p 5000:5000 -v $(pwd)/backend/data:/app/data exam-sync-backend
```

## Render Deployment

### Web Service Configuration:
- **Runtime**: Node.js 20.x
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Environment Variables**: Set all required environment variables in Render dashboard

### Database Persistence:
- SQLite database will be stored in the `data/` directory
- Use Render's persistent disks to maintain data between deployments
- Configure the `DB_PATH` environment variable to point to the persistent disk

### Important Notes for Render:
- Set `NODE_ENV=production`
- Configure proper `JWT_SECRET` (never use default)
- Set `FRONTEND_URL` to your frontend URL
- Enable persistent disk for database storage

## Development Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with auto-reload
- `npm test` - Run tests
- `npm run init-db` - Initialize database with sample data

## Demo Credentials

After running `npm run init-db`, you can use these credentials:

- **Student**: student@exam.com / demo123
- **Admin**: admin@exam.com / demo123
- **Lecturer**: lecturer@exam.com / demo123

## Security Features

- **Helmet.js**: Security headers
- **CORS**: Cross-origin resource sharing control
- **Rate Limiting**: API request throttling
- **Password Hashing**: bcrypt with configurable rounds
- **JWT Authentication**: Secure token-based authentication
- **Input Validation**: Joi schema validation

## License

MIT License - see LICENSE file for details.
