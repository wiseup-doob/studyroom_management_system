This is a project-level configuration and documentation file for the Gemini agent.

You can add notes, instructions, or any other project-specific information here that you want the agent to be aware of.

**Project Root:** `/Users/runadum/wiseUp/studyroom_managment_system`

**Project Structure:**

```
/Users/runadum/wiseUp/studyroom_managment_system/
├───.firebaserc
├───.gitignore
├───ATTENDANCE_PAGE_IMPLEMENTATION_PLAN.md
├───BACKEND_IMPLEMENTATION_PLAN.md
├───CLAUDE.md
├───DATABASE_DESIGN.md
├───deploy.sh
├───FIREBASE_SETUP.md
├───firebase.json
├───firestore.rules
├───LOGIN_IMPLEMENTATION_PLAN.md
├───LOGIN_SYSTEM_ANALYSIS.md
├───README.md
├───frontend/
│   ├───.env.production
│   ├───.env.test
│   ├───.gitignore
│   ├───eslint.config.js
│   ├───index.html
│   ├───package-lock.json
│   ├───package.json
│   ├───README.md
│   ├───tsconfig.json
│   ├───tsconfig.node.json
│   ├───vite.config.js
│   ├───vite.config.ts
│   ├───public/
│   │   └───vite.svg
│   └───src/
│       ├───App.css
│       ├───App.tsx
│       ├───index.css
│       ├───main.tsx
│       ├───vite-env.d.ts
│       ├───api/
│       │   ├───apiService.ts
│       │   └───backendService.ts
│       ├───assets/
│       │   ├───icons/
│       │   └───images/
│       │       └───react.svg
│       ├───components/
│       │   ├───auth/
│       │   │   ├───LoginForm.css
│       │   │   ├───LoginForm.tsx
│       │   │   └───ProtectedRoute.tsx
│       │   ├───common/
│       │   │   ├───Footer/
│       │   │   │   ├───Footer.css
│       │   │   │   └───Footer.tsx
│       │   │   ├───Header/
│       │   │   │   ├───Header.css
│       │   │   │   └───Header.tsx
│       │   │   ├───Loading/
│       │   │   ├───MainContent/
│       │   │   │   ├───MainContent.css
│       │   │   │   └───MainContent.tsx
│       │   │   ├───Modal/
│       │   │   └───Sidebar/
│       │   │       ├───Sidebar.css
│       │   │       └───Sidebar.tsx
│       │   ├───forms/
│       │   ├───security/
│       │   │   ├───ErrorHandler.css
│       │   │   ├───ErrorHandler.tsx
│       │   │   ├───SecurityValidation.css
│       │   │   └───SecurityValidation.tsx
│       │   └───ui/
│       ├───context/
│       │   └───AuthContext.tsx
│       ├───hooks/
│       ├───layouts/
│       │   ├───MainLayout.css
│       │   └───MainLayout.tsx
│       ├───pages/
│       │   ├───admin/
│       │   │   ├───AdminDashboard.css
│       │   │   └───AdminDashboard.tsx
│       │   ├───Attendance/
│       │   │   ├───AttendancePage.css
│       │   │   └───AttendancePage.tsx
│       │   ├───Home/
│       │   │   ├───Home.css
│       │   │   └───Home.tsx
│       │   ├───Login/
│       │   │   ├───Login.css
│       │   │   └───Login.tsx
│       │   ├───PendingPermission/
│       │   │   ├───PendingPermission.css
│       │   │   └───PendingPermission.tsx
│       │   └───Students/
│       │       ├───StudentsPage.css
│       │       └───StudentsPage.tsx
│       ├───routes/
│       │   ├───AppRoutes.tsx
│       │   └───routeConfig.ts
│       ├───services/
│       │   ├───authService.ts
│       │   ├───dataIsolationService.ts
│       │   ├───errorHandlingService.ts
│       │   ├───firebase.ts
│       │   ├───firestoreService.ts
│       │   ├───securityRuleTestService.ts
│       │   └───securityService.ts
│       ├───styles/
│       │   └───variables.css
│       ├───types/
│       │   ├───admin.ts
│       │   ├───auth.ts
│       │   ├───firebase.ts
│       │   ├───index.ts
│       │   ├───security.ts
│       │   └───student.ts
│       └───utils/
├───functions/
│   ├───.eslintrc.js
│   ├───.gitignore
│   ├───package-lock.json
│   ├───package.json
│   ├───tsconfig.dev.json
│   ├───tsconfig.json
│   ├───lib/
│   │   ├───index.js
│   │   ├───index.js.map
│   │   ├───initializeSystem.js
│   │   ├───modules/
│   │   │   ├───academy/
│   │   │   │   ├───academyFunctions.js
│   │   │   │   ├───academyFunctions.js.map
│   │   │   │   ├───academyService.js
│   │   │   │   └───academyService.js.map
│   │   │   ├───user/
│   │   │   │   ├───userFunctions.js
│   │   │   │   ├───userFunctions.js.map
│   │   │   │   ├───userService.js
│   │   │   │   └───userService.js.map
│   │   │   └───utils/
│   │   │       ├───auth.js
│   │   │       ├───auth.js.map
│   │   │       ├───response.js
│   │   │       ├───response.js.map
│   │   │       ├───validation.js
│   │   │       └───validation.js.map
│   │   └───types/
│   │       ├───index.js
│   │       └───index.js.map
│   └───src/
│       ├───index.ts
│       ├───modules/
│       │   ├───academy/
│       │   │   ├───academyFunctions.ts
│       │   │   └───academyService.ts
│       │   ├───user/
│       │   │   ├───userFunctions.ts
│       │   │   └───userService.ts
│       │   └───utils/
│       │       ├───auth.ts
│       │       ├───response.ts
│       │       └───validation.ts
│       └───types/
│           └───index.ts
├───public/
│   └───index.html
└───scripts/
    ├───initializeSystem.js
    ├───initializeSystem.ts
    ├───package-lock.json
    └───package.json
```
