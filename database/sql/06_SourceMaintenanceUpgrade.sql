USE GarmentCostingDB;
GO

IF OBJECT_ID(N'dbo.CostCategory', N'U') IS NULL
    THROW 51000, 'Run 02_CreateTables.sql before this source maintenance upgrade.', 1;
GO

IF COL_LENGTH(N'dbo.CostCategory', N'IsActive') IS NULL
    ALTER TABLE dbo.CostCategory ADD IsActive bit NOT NULL CONSTRAINT DF_CostCategory_IsActive DEFAULT 1;
GO

ALTER TABLE dbo.CostCategory ALTER COLUMN CategoryCode varchar(50) NOT NULL;
GO

IF OBJECT_ID(N'dbo.CostStage', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CostStage (
        StageId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_CostStage PRIMARY KEY,
        StageName varchar(100) NOT NULL,
        IsActive bit NOT NULL CONSTRAINT DF_CostStage_IsActive DEFAULT 1,
        CreatedBy varchar(30) NOT NULL,
        CreatedDate datetime NOT NULL CONSTRAINT DF_CostStage_CreatedDate DEFAULT GETDATE(),
        ModifiedBy varchar(30) NOT NULL,
        ModifiedDate datetime NOT NULL CONSTRAINT DF_CostStage_ModifiedDate DEFAULT GETDATE(),
        RowVersion rowversion NOT NULL
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.CostStage WHERE StageName = '1St PD Sample')
    INSERT INTO dbo.CostStage (StageName, CreatedBy, ModifiedBy) VALUES ('1St PD Sample', 'seed', 'seed');
IF NOT EXISTS (SELECT 1 FROM dbo.CostStage WHERE StageName = '2nd PD Sample')
    INSERT INTO dbo.CostStage (StageName, CreatedBy, ModifiedBy) VALUES ('2nd PD Sample', 'seed', 'seed');
IF NOT EXISTS (SELECT 1 FROM dbo.CostStage WHERE StageName = 'Production')
    INSERT INTO dbo.CostStage (StageName, CreatedBy, ModifiedBy) VALUES ('Production', 'seed', 'seed');
GO

INSERT INTO dbo.CostCategory (SectionId, CategoryCode, CategoryName, IsCustom, CreatedBy, ModifiedBy)
SELECT DISTINCT section.SectionId, line.CategoryCode,
       COALESCE(NULLIF(LTRIM(RTRIM(line.CategoryName)), ''), line.CategoryCode), 0, 'seed', 'seed'
FROM dbo.CostSheetLine AS line
INNER JOIN dbo.CostSection AS section ON section.SectionCode = line.SectionCode
WHERE line.IsDeleted = 0
  AND NULLIF(LTRIM(RTRIM(line.CategoryCode)), '') IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM dbo.CostCategory AS category
      WHERE category.SectionId = section.SectionId
        AND category.CategoryCode = line.CategoryCode
  );
GO
