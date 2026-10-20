using NewCostSheet.Api.Models;

namespace NewCostSheet.Api.Services;

public class CalculationService
{
    public CostSheetTotals CalculateTotals(IEnumerable<CostSheetLine> lines, decimal royaltyRate)
    {
        var material = SumBySection(lines, "A");
        var accessories = SumBySection(lines, "B");
        var quota = SumBySection(lines, "C");
        var cm = SumBySection(lines, "D");

        var fob = material + accessories + quota + cm;
        var royaltyAmount = fob * royaltyRate;
        var finalPrice = fob + royaltyAmount;

        return new CostSheetTotals
        {
            MaterialSubtotal = material,
            AccessoriesSubtotal = accessories,
            QuotaSubtotal = quota,
            CmOverheadSubtotal = cm,
            FobPrice = fob,
            RoyaltyAmount = royaltyAmount,
            FinalPriceIncludingRoyalty = finalPrice
        };
    }

    public decimal CalculateLineAmount(decimal quantity, decimal unitPrice)
    {
        if (quantity < 0 || unitPrice < 0)
        {
            return 0m;
        }

        return quantity * unitPrice;
    }

    public void ApplyTotals(CostSheetHeader sheet)
    {
        var totals = CalculateTotals(sheet.Lines, sheet.RoyaltyRate);
        sheet.MaterialSubtotal = totals.MaterialSubtotal;
        sheet.AccessoriesSubtotal = totals.AccessoriesSubtotal;
        sheet.QuotaSubtotal = totals.QuotaSubtotal;
        sheet.CmOverheadSubtotal = totals.CmOverheadSubtotal;
        sheet.FobPrice = totals.FobPrice;
        sheet.RoyaltyAmount = totals.RoyaltyAmount;
        sheet.FinalPriceIncludingRoyalty = totals.FinalPriceIncludingRoyalty;
    }

    private static decimal SumBySection(IEnumerable<CostSheetLine> lines, string sectionCode)
    {
        decimal total = 0m;
        foreach (var line in lines.Where(l => l.SectionCode == sectionCode))
        {
            total += line.CalculatedAmount;
        }

        return total;
    }
}
