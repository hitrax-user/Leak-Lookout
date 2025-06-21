# Tech Context

This document outlines the technologies, dependencies, and development setup for the Leak-Lookout project.

## Core Technologies
- **Framework**: Next.js (v15.3.3) using Turbopack for development.
- **Language**: TypeScript.
- **Styling**: Tailwind CSS with `tailwind-merge` and `tailwindcss-animate`.
- **UI Components**: A combination of Radix UI primitives and custom components, likely following the shadcn/ui pattern.
- **Backend Services**: Firebase is used for backend functionality, including Firebase Functions for server-side logic and Firestore for the database.
- **AI Integration**: Google's Genkit is used for building and managing AI-powered flows, such as key validation and remediation step generation.

## Key Libraries & Dependencies
- **UI & Components**:
  - `react` & `react-dom`
  - `lucide-react` for icons.
  - `recharts` for data visualization and charts.
  - `next-themes` for theme management.
- **Forms**: `react-hook-form` for form state management and `zod` for schema validation.
- **Data Fetching**: `axios` is available, though Next.js's built-in fetching capabilities are likely used as well.
- **Utilities**: `date-fns` for date manipulation, `clsx` for conditional class names.

## Development & Tooling
- **Package Manager**: `npm` is inferred from `package-lock.json`.
- **Scripts**:
  - `npm run dev`: Starts the Next.js development server with Turbopack.
  - `npm run build`: Builds the application for production.
  - `npm run lint`: Runs Next.js's built-in linter.
  - `npm run typecheck`: Runs the TypeScript compiler to check for type errors.
- **AI Development**: Genkit has its own development server (`genkit:dev`, `genkit:watch`).
