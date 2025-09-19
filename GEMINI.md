This is a project-level configuration and documentation file for the Gemini agent.

You can add notes, instructions, or any other project-specific information here that you want the agent to be aware of.

## Project Overview

This project is a Study Room Management System built using Vite, React, TypeScript, and Firebase. It includes a frontend for user interaction and Firebase Cloud Functions for backend logic.

## Tech Stack

- **Frontend**: Vite, React, TypeScript
- **Backend**: Firebase (Authentication, Firestore, Functions, Hosting)
- **Styling**: CSS Modules
- **Deployment**: Firebase CLI

## Project Structure

```
/Users/runadum/wiseUp/studyroom_managment_system/
├── frontend/                    # React frontend application
│   ├── src/
│   │   ├── components/          # Reusable components
│   │   ├── pages/               # Page components
│   │   ├── services/            # Firebase and other services
│   │   └── ...
│   └── package.json             # Frontend dependencies and scripts
├── functions/                   # Firebase Cloud Functions
│   ├── src/                     # Backend logic in TypeScript
│   └── package.json             # Backend dependencies and scripts
├── firebase.json                # Firebase project configuration
├── firestore.rules              # Firestore security rules
└── README.md                    # Project documentation
```

## Key Commands

### Frontend (`/frontend` directory)

- **Install dependencies**: `npm install`
- **Start development server**: `npm run dev`
- **Lint files**: `npm run lint`
- **Build for production**: `npm run build`
- **Preview production build**: `npm run preview`

### Backend (`/functions` directory)

- **Install dependencies**: `npm install`
- **Lint files**: `npm run lint`
- **Build functions**: `npm run build`
- **Run functions in emulator**: `npm run serve`
- **Deploy functions**: `npm run deploy`

## Development Workflow

1.  **Install dependencies** for both `frontend` and `functions` directories.
2.  **Set up Firebase**: Create a Firebase project and configure environment variables in `.env.*` files in the `frontend` directory.
3.  **Run development servers**:
    - Start the frontend dev server with `npm run dev` in the `frontend` directory.
    - Start the Firebase emulators with `firebase emulators:start` in the root directory (or `npm run serve` in `functions`).
4.  **Deployment** can be done manually using `firebase deploy` or via the `./deploy.sh` script.