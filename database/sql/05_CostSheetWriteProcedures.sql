USE GarmentCostingDB;
GO

IF TYPE_ID(N'dbo.tt_CostSheetLineTableType') IS NULL
BEGIN
    EXEC(N'CREATE TYPE dbo.tt_CostSheetLineTableType AS TABLE (
        TempId varchar(50) NULL,
        Id int NOT NULL,
        CostSheetId int NOT NULL,
        SectionCode varchar(10) NOT NULL,
        CategoryCode varchar(50) NULL,
        CategoryName varchar(200) NULL,
        ItemName varchar(200) NULL,
        Description varchar(500) NULL,
        ArticleNumber varchar(100) NULL,
        Supplier varchar(200) NULL,
        Quantity decimal(18,6) NOT NULL,
        QuantityUnit varchar(30) NOT NULL,
        UnitPrice decimal(18,6) NOT NULL,
        PriceUnit varchar(30) NOT NULL,
        CalculatedAmount decimal(18,6) NOT NULL,
        Notes varchar(500) NULL,
        DisplayOrder int NOT NULL,
        IsDeleted bit NOT NULL
    )');
END
GO

IF OBJECT_ID(N'dbo.usp_CostSheet_Create', N'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_CostSheet_Create;
GO

CREATE PROCEDURE dbo.usp_CostSheet_Create
    @Vendor varchar(100),
    @Buyer varchar(100),
    @Season varchar(50),
    @SeasonYear varchar(10),
    @Stage varchar(100),
    @PDStyle varchar(50),
    @Style varchar(100),
    @RevisionNumber int,
    @RecordStatus varchar(30),
    @Currency varchar(10),
    @RoyaltyRate decimal(18,6),
    @Notes varchar(2000) = NULL,
    @CreatedBy varchar(30),
    @Lines dbo.tt_CostSheetLineTableType READONLY,
    @OriginalCostSheetId int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NULLIF(LTRIM(RTRIM(@RecordStatus)), '') IS NULL
        THROW 50004, 'RecordStatus is required.', 1;

    DECLARE @RevisionGroupId int;
    DECLARE @CostSheetId int;
    DECLARE @SourceRevisionNumber int;

    BEGIN TRY
        BEGIN TRANSACTION;

        IF @OriginalCostSheetId IS NOT NULL
        BEGIN
            SELECT @RevisionGroupId = RevisionGroupId,
                   @SourceRevisionNumber = RevisionNumber
            FROM dbo.CostSheet WITH (UPDLOCK, HOLDLOCK)
            WHERE CostSheetId = @OriginalCostSheetId
              AND IsDeleted = 0;

            IF @RevisionGroupId IS NULL
                THROW 50003, 'The source cost sheet does not exist or is deleted.', 1;

            IF @SourceRevisionNumber > 1
                THROW 50006, 'Only revision 1 records can be saved as.', 1;

            UPDATE dbo.CostSheet
            SET RevisionNumber = @SourceRevisionNumber + 1,
                ModifiedBy = @CreatedBy,
                ModifiedDate = GETDATE()
            WHERE CostSheetId = @OriginalCostSheetId
              AND IsDeleted = 0;

            SET @RevisionNumber = 1;

            INSERT INTO dbo.CostSheetAudit (CostSheetId, RevisionId, ActionType, ActionBy)
            VALUES (@OriginalCostSheetId, @SourceRevisionNumber + 1, 'SAVE_AS', @CreatedBy);
        END
        ELSE
        BEGIN
            SET @RevisionNumber = 1;

            INSERT INTO dbo.CostSheetRevisionGroup (OriginalCostSheetId, CreatedBy)
            VALUES (NULL, @CreatedBy);

            SET @RevisionGroupId = CONVERT(int, SCOPE_IDENTITY());
        END

        IF EXISTS (
            SELECT 1
            FROM dbo.CostSheet WITH (UPDLOCK, HOLDLOCK)
            WHERE IsDeleted = 0
              AND Vendor = @Vendor
              AND Buyer = @Buyer
              AND PDStyle = @PDStyle
              AND Style = @Style
              AND Season = @Season
              AND SeasonYear = @SeasonYear
              AND Stage = @Stage
              AND RevisionNumber = @RevisionNumber
        )
            THROW 50005, 'A cost sheet already exists with this vendor, buyer, style, season, stage, and revision.', 1;

        INSERT INTO dbo.CostSheet (
            RevisionGroupId, Vendor, Buyer, Season, SeasonYear, Stage, PDStyle, Style,
            RevisionNumber, RecordStatus, Currency, RoyaltyRate, Notes, CreatedBy, ModifiedBy
        )
        VALUES (
            @RevisionGroupId, @Vendor, @Buyer, @Season, @SeasonYear, @Stage, @PDStyle, @Style,
            @RevisionNumber, @RecordStatus, @Currency, @RoyaltyRate, @Notes, @CreatedBy, @CreatedBy
        );

        SET @CostSheetId = CONVERT(int, SCOPE_IDENTITY());

        INSERT INTO dbo.CostSheetLine (
            CostSheetId, SectionCode, CategoryCode, CategoryName, ItemName, Description,
            ArticleNumber, Supplier, Quantity, QuantityUnit, UnitPrice, PriceUnit,
            CalculatedAmount, Notes, DisplayOrder, CreatedBy, ModifiedBy
        )
        SELECT
            @CostSheetId, SectionCode, CategoryCode, CategoryName, ItemName, Description,
            ArticleNumber, Supplier, Quantity, UPPER(LTRIM(RTRIM(QuantityUnit))), UnitPrice,
            UPPER(LTRIM(RTRIM(PriceUnit))),
            CalculatedAmount, Notes, DisplayOrder, @CreatedBy, @CreatedBy
        FROM @Lines
        WHERE IsDeleted = 0;

        INSERT INTO dbo.CostSheetAudit (CostSheetId, RevisionId, ActionType, ActionBy)
        VALUES (@CostSheetId, @RevisionNumber, 'CREATE', @CreatedBy);

        COMMIT TRANSACTION;
        SELECT @CostSheetId AS CostSheetId, @RevisionNumber AS RevisionNumber;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO

IF OBJECT_ID(N'dbo.usp_CostSheet_GetForPrint', N'P') IS NOT NULL
        DROP PROCEDURE dbo.usp_CostSheet_GetForPrint;
GO

CREATE PROCEDURE dbo.usp_CostSheet_GetForPrint
        @CostSheetId int
AS
BEGIN
        SET NOCOUNT ON;

        SELECT sheet.CostSheetId AS Id,
               sheet.Vendor,
               COALESCE(NULLIF(LTRIM(RTRIM(vendorMaster.Vendor_Name)), ''), sheet.Vendor) AS VendorName,
               sheet.Buyer,
               COALESCE(NULLIF(LTRIM(RTRIM(buyerMaster.[name])), ''), sheet.Buyer) AS BuyerName,
               sheet.Season, sheet.SeasonYear, sheet.Stage, sheet.PDStyle, sheet.Style,
               sheet.RevisionNumber, sheet.RecordStatus, sheet.Currency, sheet.RoyaltyRate,
               sheet.Notes, sheet.CreatedBy, sheet.CreatedDate, sheet.ModifiedBy, sheet.ModifiedDate
        FROM dbo.CostSheet AS sheet
        OUTER APPLY (
            SELECT TOP (1) Vendor_Name
            FROM dbo.Vendor
            WHERE Vendor_code = sheet.Vendor OR Vendor_Name = sheet.Vendor
            ORDER BY CASE WHEN Vendor_code = sheet.Vendor THEN 0 ELSE 1 END
        ) AS vendorMaster
        OUTER APPLY (
            SELECT TOP (1) [name]
            FROM ERPII.dbo.company
            WHERE company = sheet.Buyer AND IsBuyer = 1 AND edi = 1 AND st_status = 5614
        ) AS buyerMaster
        WHERE sheet.CostSheetId = @CostSheetId
          AND sheet.IsDeleted = 0;

        SELECT CostSheetLineId AS Id, CostSheetId, SectionCode, CategoryCode, CategoryName, ItemName,
                 Description, ArticleNumber, Supplier, Quantity, QuantityUnit, UnitPrice, QuantityUnit AS PriceUnit,
                     CalculatedAmount, Notes, DisplayOrder
        FROM dbo.CostSheetLine
        WHERE CostSheetId = @CostSheetId
            AND IsDeleted = 0
        ORDER BY DisplayOrder, CostSheetLineId;
END
GO

IF OBJECT_ID(N'dbo.usp_CostSheet_Update', N'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_CostSheet_Update;
GO

CREATE PROCEDURE dbo.usp_CostSheet_Update
    @CostSheetId int,
    @Vendor varchar(100),
    @Buyer varchar(100),
    @Season varchar(50),
    @SeasonYear varchar(10),
    @Stage varchar(100),
    @PDStyle varchar(50),
    @Style varchar(100),
    @RevisionNumber int,
    @RecordStatus varchar(30),
    @Currency varchar(10),
    @RoyaltyRate decimal(18,6),
    @Notes varchar(2000) = NULL,
    @ModifiedBy varchar(30),
    @Lines dbo.tt_CostSheetLineTableType READONLY
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NULLIF(LTRIM(RTRIM(@RecordStatus)), '') IS NULL
        THROW 50016, 'RecordStatus is required.', 1;

    DECLARE @UpdatedRows int;

    BEGIN TRY
        BEGIN TRANSACTION;

        IF EXISTS (
            SELECT 1
            FROM dbo.CostSheet WITH (UPDLOCK, HOLDLOCK)
            WHERE CostSheetId = @CostSheetId
              AND IsDeleted = 0
              AND RevisionNumber > 1
        )
            THROW 50019, 'Records above revision 1 are read-only.', 1;

        IF EXISTS (
            SELECT 1
            FROM dbo.CostSheet WITH (UPDLOCK, HOLDLOCK)
            WHERE CostSheetId = @CostSheetId
              AND IsDeleted = 0
              AND RevisionNumber <> @RevisionNumber
        )
            THROW 50019, 'Revision can only be changed by Save As.', 1;

        IF EXISTS (
            SELECT 1
            FROM dbo.CostSheet AS currentSheet
            WHERE currentSheet.CostSheetId = @CostSheetId
              AND (
                  currentSheet.Vendor <> @Vendor
                  OR currentSheet.Buyer <> @Buyer
                  OR currentSheet.PDStyle <> @PDStyle
                  OR currentSheet.Style <> @Style
                  OR currentSheet.Season <> @Season
                  OR currentSheet.SeasonYear <> @SeasonYear
                  OR currentSheet.Stage <> @Stage
                  OR currentSheet.RevisionNumber <> @RevisionNumber
              )
        )
        AND EXISTS (
            SELECT 1
            FROM dbo.CostSheet AS duplicate WITH (UPDLOCK, HOLDLOCK)
            WHERE duplicate.CostSheetId <> @CostSheetId
              AND duplicate.IsDeleted = 0
              AND duplicate.Vendor = @Vendor
              AND duplicate.Buyer = @Buyer
              AND duplicate.PDStyle = @PDStyle
              AND duplicate.Style = @Style
              AND duplicate.Season = @Season
              AND duplicate.SeasonYear = @SeasonYear
              AND duplicate.Stage = @Stage
              AND duplicate.RevisionNumber = @RevisionNumber
        )
            THROW 50017, 'Another cost sheet already exists with this vendor, buyer, style, season, stage, and revision.', 1;

        UPDATE dbo.CostSheet
        SET Vendor = @Vendor,
            Buyer = @Buyer,
            Season = @Season,
            SeasonYear = @SeasonYear,
            Stage = @Stage,
            PDStyle = @PDStyle,
            Style = @Style,
            RevisionNumber = @RevisionNumber,
            RecordStatus = @RecordStatus,
            Currency = @Currency,
            RoyaltyRate = @RoyaltyRate,
            Notes = @Notes,
            ModifiedBy = @ModifiedBy,
            ModifiedDate = GETDATE()
        WHERE CostSheetId = @CostSheetId
          AND IsDeleted = 0;

        SET @UpdatedRows = @@ROWCOUNT;
        IF @UpdatedRows = 0
            THROW 50013, 'The cost sheet does not exist or is deleted.', 1;

        IF EXISTS (
            SELECT Id
            FROM @Lines
            WHERE Id > 0
            GROUP BY Id
            HAVING COUNT(*) > 1
        )
            THROW 50014, 'The submitted lines contain a duplicate line ID.', 1;

        IF EXISTS (
            SELECT 1
            FROM @Lines AS incoming
            LEFT JOIN dbo.CostSheetLine AS existing
              ON existing.CostSheetLineId = incoming.Id
             AND existing.CostSheetId = @CostSheetId
            WHERE incoming.Id > 0
              AND existing.CostSheetLineId IS NULL
        )
            THROW 50015, 'A submitted line ID does not belong to this cost sheet.', 1;

        MERGE dbo.CostSheetLine AS target
        USING @Lines AS source
          ON target.CostSheetLineId = source.Id
         AND source.Id > 0
         AND target.CostSheetId = @CostSheetId
        WHEN MATCHED THEN
            UPDATE SET
                SectionCode = source.SectionCode,
                CategoryCode = source.CategoryCode,
                CategoryName = source.CategoryName,
                ItemName = source.ItemName,
                Description = source.Description,
                ArticleNumber = source.ArticleNumber,
                Supplier = source.Supplier,
                Quantity = source.Quantity,
                QuantityUnit = UPPER(LTRIM(RTRIM(source.QuantityUnit))),
                UnitPrice = source.UnitPrice,
                PriceUnit = UPPER(LTRIM(RTRIM(source.PriceUnit))),
                CalculatedAmount = source.CalculatedAmount,
                Notes = source.Notes,
                DisplayOrder = source.DisplayOrder,
                IsDeleted = source.IsDeleted,
                ModifiedBy = @ModifiedBy,
                ModifiedDate = GETDATE()
        WHEN NOT MATCHED BY TARGET AND source.Id = 0 AND source.IsDeleted = 0 THEN
            INSERT (
                CostSheetId, SectionCode, CategoryCode, CategoryName, ItemName, Description,
                ArticleNumber, Supplier, Quantity, QuantityUnit, UnitPrice, PriceUnit,
                CalculatedAmount, Notes, DisplayOrder, IsDeleted, CreatedBy, ModifiedBy,
                CreatedDate, ModifiedDate
            )
            VALUES (
                @CostSheetId, source.SectionCode, source.CategoryCode, source.CategoryName,
                source.ItemName, source.Description, source.ArticleNumber, source.Supplier,
                source.Quantity, UPPER(LTRIM(RTRIM(source.QuantityUnit))), source.UnitPrice,
                UPPER(LTRIM(RTRIM(source.PriceUnit))), source.CalculatedAmount, source.Notes,
                source.DisplayOrder, 0, @ModifiedBy, @ModifiedBy, GETDATE(), GETDATE()
            )
        WHEN NOT MATCHED BY SOURCE
             AND target.CostSheetId = @CostSheetId
             AND target.IsDeleted = 0 THEN
            UPDATE SET
                IsDeleted = 1,
                ModifiedBy = @ModifiedBy,
                ModifiedDate = GETDATE();

        INSERT INTO dbo.CostSheetAudit (CostSheetId, RevisionId, ActionType, ActionBy)
        VALUES (@CostSheetId, @RevisionNumber, 'UPDATE', @ModifiedBy);

        COMMIT TRANSACTION;
        SELECT @CostSheetId AS CostSheetId, @RevisionNumber AS RevisionNumber;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO

IF OBJECT_ID(N'dbo.usp_CostSheet_Delete', N'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_CostSheet_Delete;
GO

CREATE PROCEDURE dbo.usp_CostSheet_Delete
    @CostSheetId int,
    @DeletedBy varchar(30)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @RevisionNumber int;

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT @RevisionNumber = RevisionNumber
        FROM dbo.CostSheet WITH (UPDLOCK, HOLDLOCK)
        WHERE CostSheetId = @CostSheetId
          AND IsDeleted = 0;

        IF @RevisionNumber IS NULL
            THROW 50018, 'The cost sheet does not exist or is already deleted.', 1;

        UPDATE dbo.CostSheet
        SET IsDeleted = 1,
            ModifiedBy = @DeletedBy,
            ModifiedDate = GETDATE()
        WHERE CostSheetId = @CostSheetId
          AND IsDeleted = 0;

        UPDATE dbo.CostSheetLine
        SET IsDeleted = 1,
            ModifiedBy = @DeletedBy,
            ModifiedDate = GETDATE()
        WHERE CostSheetId = @CostSheetId
          AND IsDeleted = 0;

        INSERT INTO dbo.CostSheetAudit (CostSheetId, RevisionId, ActionType, ActionBy)
        VALUES (@CostSheetId, @RevisionNumber, 'DELETE', @DeletedBy);

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO
