USE GarmentCostingDB;
GO

DECLARE @RevisionGroupId int;
DECLARE @CostSheetId int;

IF NOT EXISTS (SELECT 1 FROM dbo.CostSheet WHERE PDStyle = 'xy4657')
BEGIN
    INSERT INTO dbo.CostSheetRevisionGroup (OriginalCostSheetId, CreatedBy, CreatedDate)
    VALUES (NULL, 'sa', GETDATE());

    SET @RevisionGroupId = SCOPE_IDENTITY();

    INSERT INTO dbo.CostSheet (
        RevisionGroupId, Vendor, Buyer, Season, SeasonYear, Stage, PDStyle, Style,
        RevisionNumber, RecordStatus, Currency, RoyaltyRate, Notes, CreatedBy, ModifiedBy
    )
    VALUES (
        @RevisionGroupId, 'Pretty', 'DB', 'Fall', '2027', '1St PD Sample', 'xy4657', '52XR146',
        1, 'Draft', 'USD', 0.05, 'Sample garment costing sheet', 'sa', 'sa'
    );

    SET @CostSheetId = SCOPE_IDENTITY();

    INSERT INTO dbo.CostSheetLine (
        CostSheetId, SectionCode, CategoryCode, CategoryName, ItemName, Description, ArticleNumber,
        Supplier, Quantity, QuantityUnit, UnitPrice, CalculatedAmount, Notes, DisplayOrder,
        CreatedBy, ModifiedBy
    )
    VALUES
        (@CostSheetId, 'A', 'A-1', 'Shell', 'Bodice', 'Chiffon', 'SP3449', 'Supplier 1', 5.000000, 'YDS', 1.590000, 7.950000, '', 1, 'sa', 'sa'),
        (@CostSheetId, 'A', 'A-3', 'Lining', 'Skirt', 'Lining', 'GT207', 'Supplier 1', 8.000000, 'YDS', 0.830000, 6.640000, '', 2, 'sa', 'sa'),
        (@CostSheetId, 'A', 'A-2', 'Built-in', 'Soft Tulle', 'Soft Tulle', 'SOFT TULLE', 'Supplier 1', 1.200000, 'YDS', 0.820000, 0.984000, '', 3, 'sa', 'sa'),
        (@CostSheetId, 'A', 'A-5', 'Interlining / Interfacing', 'Interfacing', 'Interfacing', 'II503', 'Supplier 1', 1.300000, 'YDS', 2.700000, 3.510000, '', 4, 'sa', 'sa'),
        (@CostSheetId, 'A', 'A-6', 'Lace / Corded Lace', 'Over Lace', 'Over Lace', 'JM-910895', 'Supplier 1', 1.200000, 'YDS', 2.590000, 3.108000, '', 5, 'sa', 'sa'),
        (@CostSheetId, 'B', 'Zipper', 'Zipper', 'Zipper', '14'' zipper', '14-1', 'Supplier 2', 1.000000, 'PCS', 1.000000, 1.000000, '', 6, 'sa', 'sa'),
        (@CostSheetId, 'B', 'Button', 'Button', 'Button', '18# Button', '18-1', 'Supplier 2', 2.000000, 'PCS', 0.050000, 0.100000, '', 7, 'sa', 'sa'),
        (@CostSheetId, 'B', 'Bra Cup', 'Bra Cup', 'Bra Cup', 'Bra Cup', 'BC-1', 'Supplier 2', 1.000000, 'PRS', 1.000000, 1.000000, '', 8, 'sa', 'sa'),
        (@CostSheetId, 'B', 'Miscellaneous', 'Miscellaneous', 'Miscellaneous', 'Labels, packing, threads', 'MISC-1', 'Supplier 2', 1.000000, 'PCS', 2.000000, 2.000000, '', 9, 'sa', 'sa'),
        (@CostSheetId, 'C', 'Quota Charge', 'Quota Cost', 'Quota Charge', 'No charge', '', '', 0.000000, 'PCS', 0.000000, 0.000000, '', 10, 'sa', 'sa'),
        (@CostSheetId, 'D', 'Gown CM + Overhead', 'CM & Overhead', 'Gown CM + Overhead', 'Labor, finance, transportation, profit, and related costs', 'CM-GOWN', 'Production', 1.000000, 'PCS', 27.690000, 27.690000, '', 11, 'sa', 'sa');
END
GO
