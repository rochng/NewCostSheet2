IF DB_ID(N'GarmentCostingDB') IS NULL
BEGIN
    CREATE DATABASE GarmentCostingDB;
END
GO

USE GarmentCostingDB;
GO

IF OBJECT_ID(N'dbo.CostSheetAudit', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CostSheetAudit (
        AuditId int IDENTITY(1,1) NOT NULL,
        CostSheetId int NOT NULL,
        RevisionId int NULL,
        ActionType varchar(30) NOT NULL,
        ActionBy varchar(30) NOT NULL,
        ActionDate datetime NOT NULL DEFAULT GETDATE(),
        Notes varchar(500) NULL,
        CONSTRAINT PK_CostSheetAudit PRIMARY KEY (AuditId)
    );
END
GO
