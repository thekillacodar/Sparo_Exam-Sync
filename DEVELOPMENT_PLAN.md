# ExamSync Development Plan & Flow

**Updated for Undergraduate Final Year Project with Render Deployment**

This plan transforms ExamSync from a simulated single-page app into a functional, dockerized full-stack application suitable for an undergraduate final year project. The entire project will be containerized and deployable on Render from the beginning.

## **Development Flow Structure**

### **Phase 1: Docker Foundation & Backend Setup**
1. **Docker Environment + Node.js Backend** - Containerized Express.js with SQLite database
2. **Real User Authentication** - JWT-based authentication with bcrypt password hashing
3. **Database Schema** - SQLite tables for users, exams, and notifications
4. **REST API Endpoints** - CRUD operations for exams with proper error handling

### **Phase 2: Core Functionality**
5. **Role-Based Access Control** - Student/Lecturer/Admin permissions
6. **Functional Calendar Navigation** - Working month navigation and clickable days
7. **Exam Creation/Editing Forms** - Real forms with validation and date/time pickers
8. **Real Conflict Detection** - Working algorithm for overlapping exams

### **Phase 3: Enhanced Features**
9. **Database Notification System** - Stored, trackable notifications
10. **Live Dashboard Statistics** - Real data from database
11. **Functional Export (PDF/CSV)** - Working export functionality
12. **Basic AI Assistant** - Simple NLP responses for exam queries

### **Phase 4: Integration & Optimization**
13. **Google Calendar Integration** - Basic API sync for exam events
14. **Offline Data Storage** - localStorage with sync mechanism
15. **Mobile Responsiveness** - Optimized for different screen sizes
16. **Core Functionality Testing** - Unit tests for API endpoints

### **Phase 5: Docker Production**
17. **Frontend Docker Setup** - Complete containerization with nginx
18. **Docker Documentation** - Deployment guide for Render and local development

## **Technology Stack & Latest Versions**

### **Backend:**
- **Node.js**: 20.x LTS (Latest stable)
- **Express.js**: 4.19.x (Latest stable)
- **SQLite3**: 5.1.x (Latest stable)
- **JWT (jsonwebtoken)**: 9.0.x (Latest stable)
- **bcryptjs**: 2.4.x (Latest stable)
- **CORS**: 2.8.x (Latest stable)

### **Frontend:**
- **React**: 18.2.x (Latest stable)
- **Vite**: 5.1.x (Latest stable - for fast development)
- **Tailwind CSS**: 3.4.x (Latest stable)
- **Axios**: 1.6.x (Latest stable)
- **React Router**: 6.21.x (Latest stable)

### **Development & Deployment:**
- **Docker**: Latest stable
- **Docker Compose**: Latest stable
- **Nginx**: Latest stable (for production frontend)
- **Render**: Cloud platform for deployment

### **Additional Libraries:**
- **jsPDF**: 2.5.x (for PDF export)
- **date-fns**: 3.3.x (for date manipulation)
- **Jest**: 29.7.x (for testing)

## **Render Deployment Strategy**

The application will be designed for **Render deployment from day one**:

### **Render Services:**
- **Web Service**: Node.js backend (Express server)
- **Static Site**: Frontend React application
- **Database**: SQLite file-based (suitable for Render's persistent disks)

### **Environment Configuration:**
- Environment variables for production
- Proper CORS configuration for cross-origin requests
- Optimized build settings for production

### **Development Workflow:**
- Local development with Docker
- Git-based deployment to Render
- Automatic builds and deployments
- Environment-specific configurations

## **Key Benefits of This Approach:**

- **Render-Optimized**: Designed specifically for Render's platform constraints
- **Educational Value**: Demonstrates full-stack development skills
- **Deployable**: Working application from early stages
- **Professional**: Shows DevOps understanding appropriate for undergraduates
- **Maintainable**: Clean architecture with proper separation of concerns

## **Project Milestones:**

- **Milestone 1**: Working backend with authentication (Tasks 1-4)
- **Milestone 2**: Functional core features (Tasks 5-8)
- **Milestone 3**: Enhanced user experience (Tasks 9-12)
- **Milestone 4**: Integration and optimization (Tasks 13-16)
- **Milestone 5**: Production deployment (Tasks 17-18)

The task manager contains 18 focused tasks that will transform the simulated application into a fully functional, deployable system suitable for an undergraduate final year project.
