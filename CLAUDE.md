# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Korean study room management system built with Vite + React + TypeScript + Firebase. The system uses user-based data isolation where each authenticated user (via Google Auth) can only access their own data. Firebase handles authentication, Firestore provides data storage, and Firebase Functions manage backend logic.

**Key Architecture**: Each user has a completely isolated data space under `/users/{userId}` in Firestore, with all subcollections (students, timetables, attendance, etc.) scoped to that user. This eliminates the need for complex permission systems or custom claims.

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
- **React 19** with TypeScript and Vite 7+
- **Path aliases**: `@/*` maps to `src/*`
- **Routing**: React Router DOM v7+ with authentication-based protected routes
- **State Management**:
  - React Context for authentication
  - Zustand for UI state (attendance UI store)
  - TanStack Query (React Query) for server state management
- **Firebase Integration**: Auth, Firestore, Functions
- **Development server**: Runs on port 3000 with auto-open browser

### Key Services (`frontend/src/services/`)
- `firebase.ts`: Firebase configuration and initialization (exports `auth`, `db`, `functions`)
- `backendService.ts`: Firebase Functions integration using `httpsCallable`
- `authService.ts`: Authentication utilities and user management
- `studentService.ts`: Student data management (CRUD operations)
- `studentTimetableService.ts`: Student timetable functionality
- `editLinkService.ts`: Shared edit link management
- `userProfileService.ts`: User profile operations

**Note**: Several services have been removed or consolidated in recent refactoring:
- ❌ `apiService.ts` - Removed
- ❌ `dataIsolationService.ts` - Removed (data isolation now handled by Firestore rules)
- ❌ `errorHandlingService.ts` - Removed
- ❌ `firestoreService.ts` - Removed
- ❌ `securityService.ts` - Removed

### Type System (`frontend/src/types/`)
- `auth.ts`: User authentication and profile types
- `admin.ts`: Admin types for user management
- `student.ts`: Student data and management types
- `security.ts`: User-based security and validation types
- `firebase.ts`: Firebase configuration types
- `attendance.ts`: User attendance system types
- `index.ts`: Main type exports

### Component Structure
- **Layout components**: `MainLayout.tsx`, `MainHeader.tsx`, `Sidebar.tsx` in `components/Layout/` or `components/common/Sidebar/`
  - MainLayout includes sidebar and main content areas
  - MainHeader provides navigation and user profile
  - Sidebar provides navigation menu
- **Domain components**: Specialized components in `components/domain/Attendance/`
  - Comprehensive attendance UI components (SeatingChart, Seat, AssignSeatModal, etc.)
  - Student assignment and PIN management panels
  - Attendance records and statistics components
- **Common components**: Reusable UI components in `components/common/`
- **Buttons**: Reusable button components in `components/buttons/`

### Custom Hooks (`frontend/src/hooks/`)
- `useAttendanceQueries.ts`: TanStack Query hooks for attendance data
- `useRealtimeAttendance.ts`: Real-time Firestore subscription for attendance

### State Management (`frontend/src/stores/`)
- `useAttendanceUIStore.ts`: Zustand store for attendance UI state

### Current Pages (`frontend/src/pages/`)
- **Home**: Main dashboard and entry point
- **Login**: Authentication page
- **Student**: Student management functionality
- **TimeTable**: Schedule and timetable management
  - Complex timetable system with modular components in `pages/TimeTable/components/`
  - Student list panel, basic schedule panel, student timetable panel
  - Time slot editing and timetable creation modals
- **StudentTimetableSharedEdit**: Shared student timetable editing functionality
- **Attendance**: Student attendance management with seat layouts and PIN-based check-in (active development)
- **SubmissionComplete**: Submission completion confirmation page

### Backend Architecture (`functions/src/`)
- **Personal modules**: User-specific functionality in `modules/personal/`
  - `userProfile.ts`: User profile management and data backup
  - `attendanceManagement.ts`: Check-in/out and attendance tracking (admin self-check)
  - `studentAttendanceManagement.ts`: **NEW** - Student attendance system with PIN-based check-in/out
  - `shareScheduleManagement.ts`: Schedule sharing and collaboration
  - `seatManagement.ts`: Seat assignment and layout management
  - `settingsManagement.ts`: User settings and preferences
  - `studentManagement.ts`: Student data management (CRUD operations)
  - `studentTimetableManagement.ts`: Student-specific timetable operations
  - `index.ts`: Exports all personal module functions
- **Utils**: Helper modules in `modules/utils/`
  - `auth.ts`: Authentication middleware and user validation
  - `response.ts`: Standardized response formatting
  - `validation.ts`: Input validation utilities
- **Types**: Backend type definitions in `types/index.ts`

**Important**: All Cloud Functions must validate `request.auth.uid` matches the target `userId` to maintain data isolation.

### Firebase Configuration
- **Emulators**: Auth (9099), Functions (5001), Firestore (8080), Hosting (5000), UI (4343)
- **Build optimization**: Code splitting for vendor, firebase, and router bundles
- **Multi-project**: Supports test and production Firebase projects
- **Region**: Functions deployed to asia-northeast3

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
- **Firebase**: Uses v12+ modular SDK with proper tree-shaking, Node.js 22 for Functions
- **User Isolation**: All data operations respect user-based data isolation (users can only access their own data)
- **Authentication**: Uses Firebase Auth with user-specific data access (no custom claims needed)
- **Data Structure**: Firestore structure uses `/users/{userId}` for complete user data isolation
- **Error Handling**: Built into component-level error boundaries and service-level error management
- **Testing**: Firebase emulators required for local development - no formal testing framework currently configured
- **State Management**:
  - TanStack Query for server state, caching, and mutations
  - Zustand for client-side UI state
  - Real-time subscriptions via custom hooks
- **CSS**: Component-scoped styling with CSS files alongside components
- **Build**: Vite with code splitting (vendor, firebase, router bundles), source maps enabled
- **Development**: Auto-open browser on port 3000, hot module replacement
- **QR Codes**: Uses `qrcode.react` library for generating QR codes (attendance check links)
- **Icons**: Uses `@heroicons/react` for UI icons
- **Current State**: Core features stable, attendance system in active development

## Current Development Focus

The system is a personal user-based management system:

- **Personal Management**: Each authenticated user manages their own students, schedules, and attendance
- **Data Isolation**: Complete separation of data between users using Firestore security rules
- **User-Centric Architecture**: Direct user ownership of all data and operations
- **Active Features**: Student management, timetable functionality, shared timetable editing, and **student attendance system (in development)**
- **Backend Integration**: Comprehensive Firebase Functions for all user operations

### Attendance System (Active Development)

A comprehensive student attendance management system with the following features:
- **PIN-based Check-in/out**: Students use unique 4-6 digit PINs for self-service attendance
- **Seat Layout Integration**: Visual seat management with group-based layouts (rows × columns)
- **Attendance Tracking**: Automated tracking of arrival/departure times with late/early-leave detection
- **Timetable Integration**: Uses `student_timetables.basicSchedule.dailySchedules` for expected times
- **Security**: bcrypt hashing for PINs, automatic locking after 5 failed attempts
- **Real-time Updates**: Live attendance status using Firestore subscriptions
- **Design Document**: See `ATTENDANCE_DATABASE_DESIGN.md` for complete system architecture
- **Implementation Plans**: See `ATTENDANCE_FRONTEND_IMPLEMENTATION_PLAN.md` and `ATTENDANCE_INTEGRATION_PLAN.md`

**Key Collections** (all under `/users/{userId}/`):
- `student_attendance_records`: Daily attendance records with 5 status types
- `attendance_check_links`: Shareable links with UUID tokens for PIN entry
- `attendance_student_pins`: Hashed student PINs with security features
- `seat_layouts`: Extended with optional `groups` field for attendance layouts
- `seat_assignments`: Extended with student info and expected schedules

**Current Status**: Phase 1-3 deployment completed, see `PHASE_1_2_3_DEPLOYMENT_SUMMARY.md` for details

**Future Architecture**: Plan to migrate from session-based to event-based attendance system (see `EVENT_BASE_ATTENDANCE_PLAN.md`):
- **Event-based Design**: Moving from fixed session records to flexible event streams
- **Time Range Support**: Enable partial attendance tracking (e.g., absent 09:00-14:00, present 14:00-20:00)
- **Complex Scenarios**: Support external activities, partial attendance, and multi-segment days
- **Event Types**: `CHECK_IN`, `CHECK_OUT`, `MARK_ABSENT`, `START_EXTERNAL`, `END_EXTERNAL`
- **Status Calculation**: Compute attendance status from event timeline at query time
- **New Collection**: `/users/{userId}/attendance_events` will replace session-based records

## Build Process

The build process uses environment-specific variables and creates optimized bundles with code splitting. The deploy script handles environment selection and builds with appropriate configuration.

## Database Design

The system follows a user-based data isolation architecture documented in `DATABASE_DESIGN.md`. Each authenticated user has their own data space under `/users/{userId}` with complete isolation from other users' data.

**Collections**:
1. `users` - Root collection with user profiles (Google Auth)
2. `users/{userId}/students` - Student records (managed by each user)
3. `users/{userId}/student_timetables` - Student-specific timetables with 2-layer system
4. `users/{userId}/attendance_records` - Admin self check-in/out tracking
5. `users/{userId}/student_attendance_records` - **NEW** Student attendance tracking (separate from admin)
6. `users/{userId}/attendance_check_links` - **NEW** Shareable PIN entry links
7. `users/{userId}/attendance_student_pins` - **NEW** Hashed student PINs
8. `users/{userId}/shared_schedules` - Timetable sharing links
9. `users/{userId}/schedule_contributions` - External schedule contributions
10. `users/{userId}/seats` - Seat information
11. `users/{userId}/seat_assignments` - Seat assignments (extended for students)
12. `users/{userId}/seat_layouts` - Seat layout configurations (extended with groups)
13. `users/{userId}/class_sections` - Class information
14. `users/{userId}/attendance_summaries` - Attendance statistics
15. `users/{userId}/settings` - User preferences

**Student Timetables**: The system supports both basic user timetables and individual student timetables. The `basicSchedule.dailySchedules` structure provides arrival/departure times used by the attendance system for automated late/early-leave detection.