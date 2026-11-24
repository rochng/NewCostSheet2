USE GarmentCostingDB;
GO

IF OBJECT_ID(N'dbo.Vendor', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Vendor (
        VendorId int IDENTITY(1,1) NOT NULL,
        Company varchar(100) NOT NULL,
        IsActive bit NOT NULL DEFAULT 1,
        CreatedBy varchar(30) NOT NULL,
        CreatedDate datetime NOT NULL DEFAULT GETDATE(),
        ModifiedBy varchar(30) NOT NULL,
        ModifiedDate datetime NOT NULL DEFAULT GETDATE(),
        RowVersion rowversion NOT NULL,
        CONSTRAINT PK_Vendor PRIMARY KEY (VendorId)
    );
END
GO

IF OBJECT_ID(N'dbo.Buyer', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Buyer (
        BuyerId int IDENTITY(1,1) NOT NULL,
        Company varchar(100) NOT NULL,
        IsActive bit NOT NULL DEFAULT 1,
        CreatedBy varchar(30) NOT NULL,
        CreatedDate datetime NOT NULL DEFAULT GETDATE(),
        ModifiedBy varchar(30) NOT NULL,
        ModifiedDate datetime NOT NULL DEFAULT GETDATE(),
        RowVersion rowversion NOT NULL,
        CONSTRAINT PK_Buyer PRIMARY KEY (BuyerId)
    );
END
GO

IF OBJECT_ID(N'dbo.CostSection', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CostSection (
        SectionId int IDENTITY(1,1) NOT NULL,
        SectionCode varchar(10) NOT NULL,
        SectionName varchar(100) NOT NULL,
        CreatedBy varchar(30) NOT NULL,
        CreatedDate datetime NOT NULL DEFAULT GETDATE(),
        ModifiedBy varchar(30) NOT NULL,
        ModifiedDate datetime NOT NULL DEFAULT GETDATE(),
        RowVersion rowversion NOT NULL,
        CONSTRAINT PK_CostSection PRIMARY KEY (SectionId)
    );
END
GO

IF OBJECT_ID(N'dbo.CostCategory', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CostCategory (
        CategoryId int IDENTITY(1,1) NOT NULL,
        SectionId int NOT NULL,
        CategoryCode varchar(50) NOT NULL,
        CategoryName varchar(200) NOT NULL,
        IsCustom bit NOT NULL DEFAULT 0,
        IsActive bit NOT NULL DEFAULT 1,
        CreatedBy varchar(30) NOT NULL,
        CreatedDate datetime NOT NULL DEFAULT GETDATE(),
        ModifiedBy varchar(30) NOT NULL,
        ModifiedDate datetime NOT NULL DEFAULT GETDATE(),
        RowVersion rowversion NOT NULL,
        CONSTRAINT PK_CostCategory PRIMARY KEY (CategoryId),
        CONSTRAINT FK_CostCategory_CostSection FOREIGN KEY (SectionId) REFERENCES dbo.CostSection(SectionId)
    );
END
GO

IF COL_LENGTH(N'dbo.CostCategory', N'IsActive') IS NULL
    ALTER TABLE dbo.CostCategory ADD IsActive bit NOT NULL CONSTRAINT DF_CostCategory_IsActive DEFAULT 1;
GO

IF COL_LENGTH(N'dbo.CostCategory', N'CategoryCode') IS NOT NULL
    ALTER TABLE dbo.CostCategory ALTER COLUMN CategoryCode varchar(50) NOT NULL;
GO

IF OBJECT_ID(N'dbo.CostStage', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CostStage (
        StageId int IDENTITY(1,1) NOT NULL,
        StageName varchar(100) NOT NULL,
        IsActive bit NOT NULL DEFAULT 1,
        CreatedBy varchar(30) NOT NULL,
        CreatedDate datetime NOT NULL DEFAULT GETDATE(),
        ModifiedBy varchar(30) NOT NULL,
        ModifiedDate datetime NOT NULL DEFAULT GETDATE(),
        RowVersion rowversion NOT NULL,
        CONSTRAINT PK_CostStage PRIMARY KEY (StageId)
    );
END
GO

IF OBJECT_ID(N'dbo.CostSheetRevisionGroup', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CostSheetRevisionGroup (
        RevisionGroupId int IDENTITY(1,1) NOT NULL,
        OriginalCostSheetId int NULL,
        CreatedBy varchar(30) NOT NULL,
        CreatedDate datetime NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_CostSheetRevisionGroup PRIMARY KEY (RevisionGroupId)
    );
END
GO

IF OBJECT_ID(N'dbo.CostSheet', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CostSheet (
        CostSheetId int IDENTITY(1,1) NOT NULL,
        RevisionGroupId int NOT NULL,
        Vendor varchar(100) NOT NULL,
        Buyer varchar(100) NOT NULL,
        Season varchar(50) NOT NULL,
        SeasonYear varchar(10) NOT NULL,
        Stage varchar(100) NOT NULL,
        PDStyle varchar(50) NOT NULL,
        Style varchar(100) NOT NULL,
        RevisionNumber int NOT NULL DEFAULT 1,
        RecordStatus varchar(30) NOT NULL DEFAULT 'Draft',
        Currency varchar(10) NOT NULL DEFAULT 'USD',
        RoyaltyRate decimal(18,6) NOT NULL DEFAULT 0,
        Notes varchar(2000) NULL,
        CreatedBy varchar(30) NOT NULL,
        CreatedDate datetime NOT NULL DEFAULT GETDATE(),
        ModifiedBy varchar(30) NOT NULL,
        ModifiedDate datetime NOT NULL DEFAULT GETDATE(),
        RowVersion rowversion NOT NULL,
        IsDeleted bit NOT NULL DEFAULT 0,
        CONSTRAINT PK_CostSheet PRIMARY KEY (CostSheetId),
        CONSTRAINT FK_CostSheet_RevisionGroup FOREIGN KEY (RevisionGroupId) REFERENCES dbo.CostSheetRevisionGroup(RevisionGroupId)
    );
END
GO

IF OBJECT_ID(N'dbo.CostSheetLine', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CostSheetLine (
        CostSheetLineId int IDENTITY(1,1) NOT NULL,
        CostSheetId int NOT NULL,
        SectionCode varchar(10) NOT NULL,
        CategoryCode varchar(50) NULL,
        CategoryName varchar(200) NULL,
        ItemName varchar(200) NULL,
        Description varchar(500) NULL,
        ArticleNumber varchar(100) NULL,
        Supplier varchar(200) NULL,
        Quantity decimal(18,6) NULL,
        QuantityUnit varchar(30) NULL,
        UnitPrice decimal(18,6) NULL,
        PriceUnit varchar(30) NULL,
        CalculatedAmount decimal(18,6) NULL,
        Notes varchar(500) NULL,
        DisplayOrder int NOT NULL DEFAULT 0,
        CreatedBy varchar(30) NOT NULL,
        CreatedDate datetime NOT NULL DEFAULT GETDATE(),
        ModifiedBy varchar(30) NOT NULL,
        ModifiedDate datetime NOT NULL DEFAULT GETDATE(),
        RowVersion rowversion NOT NULL,
        IsDeleted bit NOT NULL DEFAULT 0,
        CONSTRAINT PK_CostSheetLine PRIMARY KEY (CostSheetLineId),
        CONSTRAINT FK_CostSheetLine_CostSheet FOREIGN KEY (CostSheetId) REFERENCES dbo.CostSheet(CostSheetId)
    );
END
GO

CREATE INDEX IX_CostSheet_Search ON dbo.CostSheet (Vendor, Buyer, Season, SeasonYear, Stage, RecordStatus, RevisionNumber, ModifiedDate);
CREATE INDEX IX_CostSheet_PdStyle ON dbo.CostSheet (PDStyle, Style, Vendor);
CREATE INDEX IX_CostSheetLine_CostSheet ON dbo.CostSheetLine (CostSheetId, SectionCode, DisplayOrder);
CREATE INDEX IX_CostSheetLine_Section ON dbo.CostSheetLine (SectionCode, CategoryName);
GO
