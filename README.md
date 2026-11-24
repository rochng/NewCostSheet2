# NewCostSheet2

This repository contains a full-stack garment costing application in a runnable staged structure. The solution follows an enterprise cost-sheet workflow with a .NET 8 API, Microsoft SQL Server 2016-compatible database scripts, React + TypeScript frontend, and automated tests.

## Architecture

- Frontend: React + TypeScript + Bootstrap, desktop-first enterprise UI
- Backend: ASP.NET Core Web API with .NET 8, Dapper, SQL Server 2016-compatible patterns
- Database: SQL scripts for schema, seed data, helper procedures, and sample cost sheets
- Tests: xUnit checks for calculation accuracy, import parsing, and validation rules

## Main folders

- `NewCostSheet.Api` — backend API and costing services
- `NewCostSheet.Tests` — backend automated tests
- `frontend` — React frontend app
- `database/sql` — SQL Server database scripts and seed data
- `.env.example` — database and demo authentication env template

## Configuration

- Local database server, database, and SQL login name are configured in `NewCostSheet.Api/appsettings.Development.json` under `Database`.
- Store the database password once with .NET User Secrets: `dotnet user-secrets set "DB_PASSWORD" "<database password>" --project NewCostSheet.Api/NewCostSheet.Api.csproj`. User Secrets persist outside the project and are loaded automatically in Development.
- Do not put database passwords in `appsettings.json` or `appsettings.Development.json`.
- `.env.example` lists the required variable names; .NET does not load `.env` automatically.
- Run `database/sql/03_SeedData.sql` to install the development `dbo.sys_login` and `dbo.sys_costsheet` procedures expected by this version.

## Authentication and search

- Login calls `dbo.sys_login` with `@loginname` and `@password`.
- The first result set returns `ValidationResult`, `Username`, and `RoleRight`; subsequent result sets return stages and authorized-user vendor options.
- Search opens a criteria dialog and calls `dbo.sys_costsheet` in mode 2. Vendor users are always scoped to their resolved login vendor; authorized users can choose a vendor.
- The main page groups transactions by PD Style, Style, Vendor, and Buyer, and shows each matching revision with season, stage, status, and modified date.

## Revision workflow

- **Edit** updates the selected transaction in place. PD Style and Style are locked while editing; revision numbers are assigned by the application.
- **Save As** increments the original revision and creates an editable copy at revision 1. Only revision 1 records can be edited or saved as; higher revisions are read-only but can be copied.
- **Copy** and **New Cost Sheet** start an independent transaction at revision 1. Copy allows PD Style and Style to be changed.
- Ordinary edits do not change the revision. After a save, the transaction gets its database ID so later saves update it rather than creating another record. The write procedures also reject duplicate revision records.

## Assumptions and defaults

- The SQL Server instance is at `192.168.1.8` and the development database is `GarmentCostingDB`.
- Production auth should be replaced with a production identity provider and managed secret store.
- The system uses backend recalculation and does not trust browser-calculated totals.
- Cost-sheet create/update procedures accept line rows through `dbo.tt_CostSheetLineTableType`; apply `database/sql/05_CostSheetWriteProcedures.sql` to create the type and procedures.
- The direct Excel paste and full-sheet import flows are implemented as parsing and validation services, with a preview-based workflow in the UI.

## Local setup

1. Open the project in VS Code.
2. Restore the backend packages:
   `dotnet restore NewCostSheet.Api/NewCostSheet.Api.csproj`
3. Restore the frontend packages:
   `cd frontend && npm install`
4. Create your local environment file if needed:
   `copy .env.example .env`
5. Apply the SQL scripts to SQL Server 2016 and verify access with the provided development credentials.
6. Run the API:
   `dotnet run --project NewCostSheet.Api/NewCostSheet.Api.csproj`
7. Run the frontend:
   `cd frontend && npm run dev`
8. Browse to `http://localhost:5173`.

## Database notes

The SQL scripts in `database/sql` are written to be compatible with SQL Server 2016 and avoid features newer than that release. Varchar is used instead of nvarchar, and stored procedures are named using the required `sys_login` and `sys_costsheet` patterns described in the brief.

## Build and verification

Use the following commands:

- Backend tests: `dotnet test NewCostSheet.Tests/NewCostSheet.Tests.csproj`
- Frontend build: `cd frontend && npm run build`

## Important limitation

This repo contains a real application skeleton and cost-sheet logic, but the SQL Server instance and production identity provider must be provided in your runtime environment to connect full database-backed features end-to-end.
