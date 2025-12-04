# Inventory Search

Angular 18 implementation of the inventory search experience with mock API + UI polish.

## Prereqs
- Node 18+ (for Angular app and mock server)
- npm

## Quick start
1) Install deps
   - `cd Inventory-Search`
   - `npm install`
2) Start the mock API (separate terminal)
   - `cd ../inventory-mock-api`
   - `npm install`
   - `npm start`
3) Run the Angular app (from `Inventory-Search`)
   - `npm start`
   - App: http://localhost:4200

## Features implemented
- Reactive form with validation and custom branch multi-select
- Loading indicator, error messaging, cancel-on-new-search via `switchMap`
- Sorting, pagination, expandable rows with tabbed “Lots” / “Peak Availability” details
- Caching: last 5 unique searches and peak calls cached for 60s (see `inventory-search-api.service.ts`)
- Peak availability fetched on-demand when the tab is opened

## Tools and choices
- Angular 18 + HttpClient + RxJS for cancellation and caching (`shareReplay`)
- TypeScript interfaces for all models
- SCSS for layout/visual refresh
- Mock API: `inventory-mock-api` (included) for local data

## Testing
- Frontend: `npm test` (Karma/Jasmine)
