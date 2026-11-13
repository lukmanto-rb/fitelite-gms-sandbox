# Fitelite GMS (Gym Management System) web app

React + Vite + TypeScript. Tests use Vitest and React Testing Library. There is no backend: classes come from sample data in `src/data/sampleClasses.ts`.

## Requirements

- Node.js 20.19+ (or 22.12+) and npm

## Setup

```sh
npm ci        # or `npm install` if there is no package-lock.json
```

## Run

```sh
npm run dev   # starts the dev server; open the URL it prints (normally http://localhost:5173)
```

Production build: `npm run build`, then `npm run preview`.

## Test

```sh
npm test            # single run
npm run test:watch  # watch mode
```

Tests run in UTC (set in `vite.config.ts`), so start times format the same on every machine.

## What's in it

- `src/components/NextClassCard.tsx`: the "Next class" card. It shows the name, start time and studio of the class with the earliest start time after now, or "No upcoming classes." if there is none.
- `src/nextClass.ts`: picks the next class and formats its start time.
- `src/data/sampleClasses.ts`: sample classes only. It is not connected to real gym or member data.
