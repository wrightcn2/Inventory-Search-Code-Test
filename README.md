# Inventory Search Code Test

Repo that includes:
- **Inventory-Search**: Angular 18 frontend for inventory lookup.
- **InventoryServer**: .NET 8 API with mock data, search, and peak availability.
- **inventory-mock-api**: JS mock server (optional) for testing.

## Quick start

### Frontend (Angular)
```bash
cd Inventory-Search
npm install
npm start  # http://localhost:4200
```
API base is set to `http://localhost:3001/api` in `src/app/app.module.ts`. Ensure the C# API (or your preferred backend) is running there.

### Backend (C# API)
```bash
cd InventoryServer/InventoryServer
dotnet restore
dotnet test
dotnet run --project InventoryServer/InventoryServer.csproj --urls "http://localhost:3001"
```

### Mock API
```bash
cd inventory-mock-api
npm install
npm start
```

## Tests
- Frontend: `cd Inventory-Search && npm test`
- Backend: `cd InventoryServer/InventoryServer && dotnet test`

## Repo layout
- `Inventory-Search/` — Angular app
- `InventoryServer/` — .NET API + tests
- `inventory-mock-api/` — JS mock server

