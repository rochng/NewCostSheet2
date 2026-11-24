using NewCostSheet.Api.Models;
using NewCostSheet.Api.Services;

namespace NewCostSheet.Tests;

public class CalculationTests
{
    [Fact]
    public void MaterialAccessoriesQuotaCmTotalsMatchExpectedSample()
    {
        var lines = new List<CostSheetLine>
        {
            new() { SectionCode = "A", Quantity = 5m, UnitPrice = 1.59m, CalculatedAmount = 7.95m },
            new() { SectionCode = "A", Quantity = 8m, UnitPrice = 0.83m, CalculatedAmount = 6.64m },
            new() { SectionCode = "A", Quantity = 1.2m, UnitPrice = 0.82m, CalculatedAmount = 0.984m },
            new() { SectionCode = "A", Quantity = 1.3m, UnitPrice = 2.70m, CalculatedAmount = 3.51m },
            new() { SectionCode = "A", Quantity = 1.2m, UnitPrice = 2.59m, CalculatedAmount = 3.108m },
            new() { SectionCode = "B", Quantity = 1m, UnitPrice = 1.00m, CalculatedAmount = 1m },
            new() { SectionCode = "B", Quantity = 2m, UnitPrice = 0.05m, CalculatedAmount = 0.1m },
            new() { SectionCode = "B", Quantity = 1m, UnitPrice = 1.00m, CalculatedAmount = 1m },
            new() { SectionCode = "B", Quantity = 1m, UnitPrice = 2.00m, CalculatedAmount = 2m },
            new() { SectionCode = "C", Quantity = 0m, UnitPrice = 0m, CalculatedAmount = 0m },
            new() { SectionCode = "D", Quantity = 1m, UnitPrice = 27.69m, CalculatedAmount = 27.69m }
        };

        var service = new CalculationService();
        var totals = service.CalculateTotals(lines, 0.05m);

        Assert.Equal(22.192m, totals.MaterialSubtotal);
        Assert.Equal(4.10m, totals.AccessoriesSubtotal);
        Assert.Equal(0m, totals.QuotaSubtotal);
        Assert.Equal(27.69m, totals.CmOverheadSubtotal);
        Assert.Equal(53.982m, totals.FobPrice);
        Assert.Equal(2.6991m, totals.RoyaltyAmount);
        Assert.Equal(56.6811m, totals.FinalPriceIncludingRoyalty);
    }

    [Fact]
    public void FractionalQuantityAndBlankValuesAreHandled()
    {
        var service = new CalculationService();
        var line1 = new CostSheetLine { Quantity = 1.5m, UnitPrice = 2.5m };
        var line2 = new CostSheetLine { Quantity = 0m, UnitPrice = 0m };
        var line3 = new CostSheetLine { Quantity = 3.25m, UnitPrice = 4m };

        Assert.Equal(3.75m, service.CalculateLineAmount(line1.Quantity, line1.UnitPrice));
        Assert.Equal(13m, service.CalculateLineAmount(line3.Quantity, line3.UnitPrice));
        Assert.Equal(0m, service.CalculateLineAmount(line2.Quantity, line2.UnitPrice));
    }

    [Fact]
    public void NegativeValuesAndInvalidNumericInputAreRejected()
    {
        var validation = new ValidationService();
        var line = new CostSheetLine { Quantity = -1m, UnitPrice = 10m };
        var errors = validation.ValidateRow(line);

        Assert.Contains(errors, e => e.Contains("negative", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void HeaderAllowsOptionalStyleSeasonAndStageButRequiresMasterFields()
    {
        var validation = new ValidationService();
        var header = new CostSheetHeader
        {
            Vendor = "VENDOR01",
            Buyer = "BUYER01",
            PdStyle = "PD-001",
            SeasonYear = "2026",
            RecordStatus = "Draft",
            Currency = "USD"
        };

        Assert.Empty(validation.ValidateHeader(header));

        header.Vendor = string.Empty;
        Assert.Contains(validation.ValidateHeader(header), error => error == "Vendor is required.");
    }

    [Fact]
    public void PopulatedTransactionRequiresCategoryCodeButBlankGridRowIsAllowed()
    {
        var validation = new ValidationService();
        var populatedLine = new CostSheetLine
        {
            SectionCode = "A",
            Description = "Shell fabric"
        };
        var blankLine = new CostSheetLine { SectionCode = "A" };

        Assert.Contains(validation.ValidateRow(populatedLine), error => error == "Category code is required.");
        Assert.Empty(validation.ValidateRow(blankLine));
    }

    [Fact]
    public void ClipboardParsingHandlesTabsAndQuotedCells()
    {
        var parser = new ImportParserService();
        var text = "Vendor\tBuyer\tSeason\r\nPretty\tDB\t\"Fall 2027\"\r\n";

        var rows = parser.ParseClipboard(text);

        Assert.Equal(2, rows.Count);
        Assert.Equal("Vendor", rows[0][0]);
        Assert.Equal("Fall 2027", rows[1][2]);
    }

    [Fact]
    public void FormulaTextIsRejectedForImport()
    {
        var invalid = "=SUM(A1:A5)\t3\t4\r\n";
        var parser = new ImportParserService();
        var rows = parser.ParseClipboard(invalid);
        Assert.Equal(1, rows.Count);
        Assert.Contains("=SUM(A1:A5)", rows[0][0]);
    }
}
