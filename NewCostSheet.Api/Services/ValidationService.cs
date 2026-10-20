using NewCostSheet.Api.Models;

namespace NewCostSheet.Api.Services;

public class ValidationService
{
    public List<string> ValidateHeader(CostSheetHeader header)
    {
        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(header.Vendor))
            errors.Add("Vendor is required.");
        if (string.IsNullOrWhiteSpace(header.Buyer))
            errors.Add("Buyer is required.");
        if (string.IsNullOrWhiteSpace(header.RecordStatus))
            errors.Add("Record status is required.");
        if (string.IsNullOrWhiteSpace(header.PdStyle))
            errors.Add("PD Style is required.");
        if (string.IsNullOrWhiteSpace(header.SeasonYear))
            errors.Add("Season year is required.");
        if (header.RevisionNumber < 1)
            errors.Add("Revision must be at least 1.");
        if (!new[] { "Draft", "Submitted", "Approved", "Archive" }.Contains(header.RecordStatus, StringComparer.OrdinalIgnoreCase))
            errors.Add("Record status must be Draft, Submitted, Approved, or Archive.");
        if (!new[] { "USD", "EUR", "GBP", "CNY" }.Contains(header.Currency, StringComparer.OrdinalIgnoreCase))
            errors.Add("Currency must be USD, EUR, GBP, or CNY.");
        if (header.RoyaltyRate < 0m || header.RoyaltyRate > 1m)
            errors.Add("Royalty rate must be between 0% and 100%.");

        return errors;
    }

    public List<string> ValidateRow(CostSheetLine line)
    {
        var errors = new List<string>();

        if (IsBlankRow(line))
            return errors;

        if (string.IsNullOrWhiteSpace(line.SectionCode))
            errors.Add("Section is required.");
        if (string.IsNullOrWhiteSpace(line.CategoryCode))
            errors.Add("Category code is required.");

        if (line.Quantity < 0m)
            errors.Add("Quantity cannot be negative.");
        if (line.UnitPrice < 0m)
            errors.Add("Unit price cannot be negative.");
        if (line.Quantity == 0m && line.UnitPrice > 0m)
            errors.Add("A costing row with a price requires a quantity.");
        if (line.Quantity > 0m && line.UnitPrice == 0m)
            errors.Add("A costing row with a quantity requires a price.");

        if ((!string.IsNullOrWhiteSpace(line.QuantityUnit) && !string.IsNullOrWhiteSpace(line.PriceUnit)) &&
            string.Equals(line.QuantityUnit, line.PriceUnit, StringComparison.OrdinalIgnoreCase) == false &&
            !string.Equals(line.QuantityUnit, "PCS", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(line.PriceUnit, "PCS", StringComparison.OrdinalIgnoreCase))
        {
            errors.Add($"Unit mismatch warning: quantity unit '{line.QuantityUnit}' and price unit '{line.PriceUnit}' differ.");
        }

        return errors;
    }

    public bool IsBlankRow(CostSheetLine line)
    {
        return string.IsNullOrWhiteSpace(line.Description) &&
               string.IsNullOrWhiteSpace(line.ItemName) &&
               string.IsNullOrWhiteSpace(line.CategoryName) &&
             string.IsNullOrWhiteSpace(line.CategoryCode) &&
             string.IsNullOrWhiteSpace(line.ArticleNumber) &&
             string.IsNullOrWhiteSpace(line.Supplier) &&
             string.IsNullOrWhiteSpace(line.Notes) &&
               line.Quantity == 0m &&
             line.UnitPrice == 0m;
    }
}
