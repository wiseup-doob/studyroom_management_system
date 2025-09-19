# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Korean study room management system built with Vite + React + TypeScript + Firebase. The system uses user-based data isolation where each authenticated user can only access their own data. Firebase handles authentication, Firestore provides data storage, and Firebase Functions manage backend logic.

## Development Commands

### Frontend Development
```bash
cd frontend
npm install              # Install dependencies
npm run dev             # Start development server (port 3000)
npm run build           # Build for production
npm run lint            # Run ESLint
npm run preview         # Preview production build
```

### Firebase Functions
```bash
cd functions
npm install              # Install dependencies
npm run build           # Compile TypeScript
npm run build:watch     # Watch mode for development
npm run lint            # Run ESLint
npm run serve           # Start Functions emulator
npm run shell           # Interactive Functions shell
npm run start           # Alias for shell
npm run deploy          # Deploy functions only
npm run logs            # View function logs
```

### Firebase Development
```bash
firebase emulators:start # Start all Firebase emulators
firebase use <project>   # Switch Firebase project
firebase deploy          # Deploy everything
firebase deploy --only hosting    # Deploy frontend only
firebase deploy --only functions  # Deploy backend only
```

### Deployment
```bash
./deploy.sh             # Interactive deployment script with environment selection
```

## Architecture

### Multi-Environment Setup
- **Local**: `.env.local` for development
- **Test**: `.env.test` for test environment (studyroommanagementsystemtest)  
- **Production**: `.env.production` for production (studyroommanagementsyste-7a6c6)

### Frontend Architecture
- **React 19** with TypeScript and Vite
- **Path aliases**: `@/*` maps to `src/*`
- **Routing**: React Router DOM with authentication-based protected routes
- **State Management**: React Context for authentication
- **Firebase Integration**: Auth, Firestore, Functions
- **Development server**: Runs on port 3000 with auto-open browser

### Key Services (`frontend/src/services/`)
- `authService.ts`: User authentication and profile management
- `firestoreService.ts`: Database operations
- `securityService.ts`: User-based security validation and access control
- `dataIsolationService.ts`: User-based data isolation validation
- `errorHandlingService.ts`: Centralized error handling
- `backendService.ts`: Firebase Functions integration
- `apiService.ts`: API communication service
- `firebase.ts`: Firebase configuration and initialization

### Type System (`frontend/src/types/`)
- `auth.ts`: User authentication and profile types
- `admin.ts`: Admin types for user management
- `student.ts`: Student data and management types
- `security.ts`: User-based security and validation types
- `firebase.ts`: Firebase configuration types
- `attendance.ts`: User attendance system types
- `index.ts`: Main type exports

### Component Structure
- **Domain components**: Specialized components in `components/domain/Attendance/`
- **Layout components**: MainLayout with sidebar and main content areas in `components/layout/`
- **Common components**: Sidebar, MainContent in `components/common/`
- **Security components**: Error handling and validation components in `components/security/`
- **Authentication**: Protected routes and login forms in `components/auth/`

### Current Pages (`frontend/src/pages/`)
- **Home**: Main dashboard and entry point
- **Student**: Student management functionality (new implementation)
- **TimeTable**: Schedule and timetable management (new implementation)
- **Removed**: Attendance, PendingPermission, Students, AdminDashboard pages deleted during refactoring

### Backend Architecture (`functions/src/`)
- **Personal modules**: User-specific functionality in `modules/personal/`
  - `userProfile.ts`: User profile management and data backup
  - `attendanceManagement.ts`: Check-in/out and attendance tracking
  - `timetableManagement.ts`: Advanced 2-layer timetable structure
  - `shareScheduleManagement.ts`: Schedule sharing and collaboration
  - `seatManagement.ts`: Seat assignment and layout management
  - `settingsManagement.ts`: User settings and preferences
  - `studentManagement.ts`: Student data management
- **Utils**: Authentication, response formatting, validation in `modules/utils/`
- **Types**: Backend type definitions in `types/`

### Firebase Configuration
- **Emulators**: Auth (9099), Functions (5001), Firestore (8080), Hosting (5000), UI (4343)
- **Build optimization**: Code splitting for vendor, firebase, and router bundles
- **Multi-project**: Supports test and production Firebase projects

### Security Features
- User-based data isolation (each user can only access their own data)
- Individual user authentication and data segregation
- User-specific data validation and access control
- Comprehensive error handling and security validation

## Environment Variables Required

Each environment file needs:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_APP_NAME`
- `VITE_APP_VERSION`
- `VITE_BASE_URL`

## Key Development Notes

- **TypeScript**: Strict mode enabled with comprehensive type checking, path aliases (`@/*` → `src/*`)
- **Firebase**: Uses v9 modular SDK with proper tree-shaking, Node.js 22 for Functions
- **User Isolation**: All data operations respect user-based data isolation (users can only access their own data)
- **Authentication**: Uses Firebase Auth with user-specific data access (no custom claims needed)
- **Data Structure**: Firestore structure uses `/users/{userId}` for complete user data isolation
- **Error Handling**: Centralized through ErrorHandler component and errorHandlingService
- **Testing**: Firebase emulators required for local development
- **Attendance System**: User-specific attendance tracking and management
- **CSS Modules**: Component-scoped styling with CSS files alongside components
- **Build**: Vite with code splitting (vendor, firebase, router bundles), source maps enabled
- **Development**: Auto-open browser on port 3000, hot module replacement
- **Current State**: Major refactoring in progress - many components deleted, core system simplified

## Current Development Focus

The project is transitioning from an academy-based multi-user system to a personal user-based management system:

- **Personal Management**: Each authenticated user manages their own students, schedules, and attendance
- **Data Isolation**: Complete separation of data between users using Firestore security rules
- **Simplified Architecture**: Removed complex admin/academy hierarchy in favor of direct user ownership
- **New Features**: Student management and timetable functionality being implemented
- **Backend Integration**: Comprehensive Firebase Functions for all user operations

## Build Process

The build process uses environment-specific variables and creates optimized bundles with code splitting. The deploy script handles environment selection and builds with appropriate configuration.