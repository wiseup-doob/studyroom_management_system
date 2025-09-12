# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Korean study room management system built with Vite + React + TypeScript + Firebase. The system supports multi-tenancy with role-based access control (student, admin, super_admin) and uses Firebase for authentication, Firestore for data storage, and Firebase Functions for backend logic.

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
npm run lint            # Run ESLint
npm run serve           # Start Functions emulator
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
- **Routing**: React Router DOM with role-based protected routes
- **State Management**: React Context for authentication
- **Firebase Integration**: Auth, Firestore, Functions
- **Development server**: Runs on port 3000 with auto-open browser

### Key Services (`frontend/src/services/`)
- `authService.ts`: User authentication and profile management
- `firestoreService.ts`: Database operations
- `securityService.ts`: Security validation and rule enforcement
- `securityRuleTestService.ts`: Security rule testing
- `dataIsolationService.ts`: Multi-tenant data isolation
- `errorHandlingService.ts`: Centralized error handling
- `backendService.ts`: Firebase Functions integration
- `apiService.ts`: API communication service
- `firebase.ts`: Firebase configuration and initialization

### Type System (`frontend/src/types/`)
- `auth.ts`: Authentication and user profile types
- `admin.ts`: Admin-specific types
- `student.ts`: Student-specific types
- `security.ts`: Security and validation types
- `firebase.ts`: Firebase configuration types
- `attendance.ts`: Attendance system types
- `mockData.ts`: Mock data type definitions
- `index.ts`: Main type exports

### Component Structure
- **Domain components**: Specialized components in `components/domain/Attendance/`
- **Layout components**: `MainLayout` with sidebar and main content areas
- **Common components**: Header, Footer, Sidebar in `components/common/`
- **Security components**: Error handling and validation components
- **Authentication**: Protected routes and login forms

### Firebase Configuration
- **Emulators**: Auth (9099), Functions (5001), Firestore (8080), Hosting (5000), UI (4343)
- **Build optimization**: Code splitting for vendor, firebase, and router bundles
- **Multi-project**: Supports test and production Firebase projects

### Security Features
- Multi-tenant data isolation with academy-based access control
- Role-based authentication (student, admin, super_admin)
- Security rule testing and validation services
- Comprehensive error handling and validation

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

- **TypeScript**: Strict mode enabled with comprehensive type checking
- **Firebase**: Uses v9 modular SDK with proper tree-shaking
- **Multi-tenancy**: All data operations must respect academy-based isolation
- **Authentication**: Uses Firebase Auth with custom claims for role management
- **Error Handling**: Centralized through ErrorHandler component and errorHandlingService
- **Testing**: Firebase emulators required for local development
- **Attendance System**: Features seating charts, student search, and classroom management
- **CSS Modules**: Component-scoped styling with CSS files alongside components

## Build Process

The build process uses environment-specific variables and creates optimized bundles with code splitting. The deploy script handles environment selection and builds with appropriate configuration.