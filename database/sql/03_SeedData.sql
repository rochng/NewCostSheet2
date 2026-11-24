USE GarmentCostingDB;
GO

SET IDENTITY_INSERT dbo.CostSection ON;
IF NOT EXISTS (SELECT 1 FROM dbo.CostSection WHERE SectionCode = 'A')
BEGIN
    INSERT INTO dbo.CostSection (SectionId, SectionCode, SectionName, CreatedBy, ModifiedBy)
    VALUES (1, 'A', 'MATERIAL', 'sa', 'sa');
END
IF NOT EXISTS (SELECT 1 FROM dbo.CostSection WHERE SectionCode = 'B')
BEGIN
    INSERT INTO dbo.CostSection (SectionId, SectionCode, SectionName, CreatedBy, ModifiedBy)
    VALUES (2, 'B', 'ACCESSORIES', 'sa', 'sa');
END
IF NOT EXISTS (SELECT 1 FROM dbo.CostSection WHERE SectionCode = 'C')
BEGIN
    INSERT INTO dbo.CostSection (SectionId, SectionCode, SectionName, CreatedBy, ModifiedBy)
    VALUES (3, 'C', 'QUOTA COST', 'sa', 'sa');
END
IF NOT EXISTS (SELECT 1 FROM dbo.CostSection WHERE SectionCode = 'D')
BEGIN
    INSERT INTO dbo.CostSection (SectionId, SectionCode, SectionName, CreatedBy, ModifiedBy)
    VALUES (4, 'D', 'CM & OVERHEAD', 'sa', 'sa');
END
SET IDENTITY_INSERT dbo.CostSection OFF;
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

GO

IF OBJECT_ID(N'dbo.sys_login', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sys_login;
GO

CREATE PROCEDURE dbo.sys_login
    @LoginName varchar(30),
    @Password varchar(20),
    @moduleName varchar(30) = ''
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @role varchar(100) = 'vendor';
    DECLARE @resolvedUsername varchar(50);
    DECLARE @isAuthorized bit = 0;
    DECLARE @isValid bit = 0;
    DECLARE @rowcount int;

    SELECT @resolvedUsername = vl.Vendor_name
    FROM ERPII.dbo.vendor_login AS vl
    WHERE vl.Vendor_code = @LoginName AND vl.Pwd = @Password;
    SET @rowcount = @@ROWCOUNT;

    IF @rowcount = 1
        SET @isValid = 1;

    IF @rowcount = 0
    BEGIN
        SELECT @resolvedUsername = s.fullName
        FROM ERPII.dbo.SysUser AS s
        INNER JOIN ERPII.dbo.SysDivision AS sd ON s.divisionID = sd.id
        LEFT JOIN ERPII.dbo.system_table AS st ON s.titleID = st.sysno
        WHERE s.[name] = @LoginName AND s.[password] = @Password;
        SET @rowcount = @@ROWCOUNT;

        IF @rowcount = 1
        BEGIN
            SET @role = 'user';
            SET @isAuthorized = 1;
            SET @isValid = 1;
        END
    END

        SELECT @moduleName AS moduleName,
            @LoginName AS Username,
            @resolvedUsername AS FullName,
            @role AS RoleRight,
           @isAuthorized AS isAuthorized,
           @isValid AS ValidationResult;

    IF @isValid = 1
    BEGIN
        SELECT DISTINCT Stage
        FROM dbo.CostSheet
        WHERE IsDeleted = 0 AND Stage IS NOT NULL
        ORDER BY Stage;

        IF @isAuthorized = 1
            SELECT Vendor_code AS Vendor, Vendor_Name AS VendorName
            FROM dbo.Vendor
            WHERE Vendor_code > ''
            ORDER BY Vendor_Name;
        ELSE
            SELECT CAST(NULL AS varchar(100)) AS VendorName WHERE 1 = 0;
    END
END
GO

IF OBJECT_ID(N'dbo.sys_costsheet', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sys_costsheet;
GO

CREATE PROCEDURE dbo.sys_costsheet
    @mode int,
    @pdStyle varchar(50) = NULL,
    @style varchar(100) = NULL,
    @season varchar(50) = NULL,
    @stage varchar(100) = NULL,
    @vendor varchar(100) = NULL,
    @buyer varchar(100) = NULL,
    @recordStatus varchar(30) = NULL,
    @revisionNo int = NULL,
    @id int = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @mode = 1
    BEGIN
        SELECT Vendor_Name as company, 'vendor' as sourceType FROM dbo.Vendor
        UNION ALL
        SELECT Buyer as company, 'buyer' as sourceType FROM dbo.Buyer
        UNION ALL
        SELECT Stage AS company, 'stage' as sourceType FROM (
            SELECT DISTINCT Stage FROM dbo.CostSheet
        ) s;
    END

    IF @mode = 2
    BEGIN
        SELECT cs.CostSheetId AS Id, cs.PDStyle, cs.Style, cs.Stage, cs.Vendor, cs.Buyer,
               cs.Season + ' ' + cs.SeasonYear AS Season, cs.RecordStatus, cs.RevisionNumber, cs.ModifiedDate
        FROM dbo.CostSheet cs
        WHERE cs.IsDeleted = 0
          AND (@pdStyle IS NULL OR LTRIM(RTRIM(@pdStyle)) = '' OR cs.PDStyle LIKE '%' + LTRIM(RTRIM(@pdStyle)) + '%')
          AND (@style IS NULL OR LTRIM(RTRIM(@style)) = '' OR cs.Style LIKE '%' + LTRIM(RTRIM(@style)) + '%')
          AND (@season IS NULL OR LTRIM(RTRIM(@season)) = '' OR cs.Season = LTRIM(RTRIM(@season)) OR (cs.Season + ' ' + cs.SeasonYear) LIKE '%' + LTRIM(RTRIM(@season)) + '%')
          AND (
              ((@stage IS NULL OR LTRIM(RTRIM(@stage)) = '' OR UPPER(LTRIM(RTRIM(@stage))) IN ('ALL STAGE', 'ALL STAGES'))
                  AND cs.Stage IN (SELECT StageName FROM dbo.CostStage WHERE IsActive = 1))
              OR (NULLIF(LTRIM(RTRIM(@stage)), '') IS NOT NULL
                  AND UPPER(LTRIM(RTRIM(@stage))) NOT IN ('ALL STAGE', 'ALL STAGES')
                  AND cs.Stage = LTRIM(RTRIM(@stage)))
          )
          AND (@vendor IS NULL OR LTRIM(RTRIM(@vendor)) = '' OR cs.Vendor = LTRIM(RTRIM(@vendor)))
          AND (
              ((@recordStatus IS NULL OR LTRIM(RTRIM(@recordStatus)) = '' OR UPPER(LTRIM(RTRIM(@recordStatus))) IN ('ALL STATUS', 'ALL STATUSES'))
                  AND cs.RecordStatus IN ('Draft', 'Submitted', 'Approved', 'Archive', 'Archived'))
              OR (NULLIF(LTRIM(RTRIM(@recordStatus)), '') IS NOT NULL
                  AND UPPER(LTRIM(RTRIM(@recordStatus))) NOT IN ('ALL STATUS', 'ALL STATUSES')
                  AND (
                      (UPPER(LTRIM(RTRIM(@recordStatus))) IN ('ARCHIVE', 'ARCHIVED') AND cs.RecordStatus IN ('Archive', 'Archived'))
                      OR cs.RecordStatus = LTRIM(RTRIM(@recordStatus))
                  ))
          )
        ORDER BY cs.PDStyle, cs.RevisionNumber DESC, cs.ModifiedDate DESC;
    END

    IF @mode = 3
    BEGIN
        SELECT *
        FROM dbo.CostSheet cs
        WHERE cs.CostSheetId = @id;

        SELECT *
        FROM dbo.CostSheetLine cl
        WHERE cl.CostSheetId = @id
        ORDER BY cl.DisplayOrder;
    END
END
GO
