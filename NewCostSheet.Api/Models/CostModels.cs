namespace NewCostSheet.Api.Models;

public class CostSheetHeader
{
    public int Id { get; set; }
    public int? OriginalCostSheetId { get; set; }
    public string Vendor { get; set; } = string.Empty;
    public string VendorName { get; set; } = string.Empty;
    public string Buyer { get; set; } = string.Empty;
    public string BuyerName { get; set; } = string.Empty;
    public string Season { get; set; } = string.Empty;
    public string SeasonYear { get; set; } = string.Empty;
    public string Stage { get; set; } = string.Empty;
    public string PdStyle { get; set; } = string.Empty;
    public string Style { get; set; } = string.Empty;
    public int RevisionNumber { get; set; } = 1;
    public string RecordStatus { get; set; } = "Draft";
    public string Currency { get; set; } = "USD";
    public decimal RoyaltyRate { get; set; }
    public string Notes { get; set; } = string.Empty;
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    public string ModifiedBy { get; set; } = string.Empty;
    public DateTime ModifiedDate { get; set; } = DateTime.UtcNow;
    public decimal MaterialSubtotal { get; set; }
    public decimal AccessoriesSubtotal { get; set; }
    public decimal QuotaSubtotal { get; set; }
    public decimal CmOverheadSubtotal { get; set; }
    public decimal FobPrice { get; set; }
    public decimal RoyaltyAmount { get; set; }
    public decimal FinalPriceIncludingRoyalty { get; set; }
    public List<CostSheetLine> Lines { get; set; } = new();
}

public class CostSheetSaveResult
{
    public int CostSheetId { get; set; }
    public int RevisionNumber { get; set; }
}

public class CostSheetDeleteRequest
{
    public string DeletedBy { get; set; } = string.Empty;
}

public class CostSheetLine
{
    public int Id { get; set; }
    public int CostSheetId { get; set; }
    public string SectionCode { get; set; } = string.Empty;
    public string CategoryCode { get; set; } = string.Empty;
    public string CategoryName { get; set; } = string.Empty;
    public string ItemName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string ArticleNumber { get; set; } = string.Empty;
    public string Supplier { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public string QuantityUnit { get; set; } = string.Empty;
    public decimal UnitPrice { get; set; }
    public string PriceUnit { get; set; } = string.Empty;
    public decimal CalculatedAmount { get; set; }
    public string Notes { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public bool IsBlank { get; set; }
}

public class CostSheetSearchResult
{
    public int Id { get; set; }
    public string PdStyle { get; set; } = string.Empty;
    public string Style { get; set; } = string.Empty;
    public string Vendor { get; set; } = string.Empty;
    public string Season { get; set; } = string.Empty;
    public int RevisionNumber { get; set; }
    public string Stage { get; set; } = string.Empty;
    public string RecordStatus { get; set; } = string.Empty;
    public DateTime ModifiedDate { get; set; }
}

public class LookupItem
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
}

public class MasterOption
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}

public class CostCategoryOption
{
    public int Id { get; set; }
    public string SectionCode { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; }
}

public class CostStageOption
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; }
}

public class CostSectionOption
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}

public class CostCategoryMaintenanceRequest
{
    public string SectionCode { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}

public class CostStageMaintenanceRequest
{
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}

public class LoginRequest
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class LoginResult
{
    public bool IsValid { get; set; }
    public string Role { get; set; } = "Viewer";
    public string Username { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string LoginName { get; set; } = string.Empty;
    public bool IsAuthorized { get; set; }
    public List<string> Stages { get; set; } = new();
    public List<string> Vendors { get; set; } = new();
}

public class LoginProcedureRow
{
    public bool? ValidationResult { get; set; }
    public bool? IsValid { get; set; }
    public string? Username { get; set; }
    public string? FullName { get; set; }
    public string? RoleRight { get; set; }
    public string? RoleName { get; set; }
    public bool? IsAuthorized { get; set; }
}

public class LoginStageRow
{
    public string? Stage { get; set; }
    public string? Name { get; set; }
}

public class LoginVendorRow
{
    public string? VendorName { get; set; }
    public string? Vendor { get; set; }
    public string? Company { get; set; }
}

public class CostSheetSearchCriteria
{
    public string? PdStyle { get; set; }
    public string? Style { get; set; }
    public string? Season { get; set; }
    public string? Stage { get; set; }
    public string? RecordStatus { get; set; }
    public string? Vendor { get; set; }
}

public class ImportValidationRequest
{
    public string ClipboardText { get; set; } = string.Empty;
}

public class ImportValidationResponse
{
    public List<List<string>> Rows { get; set; } = new();
    public List<string> Warnings { get; set; } = new();
    public bool IsValid { get; set; }
}

public class CostSheetTotals
{
    public decimal MaterialSubtotal { get; set; }
    public decimal AccessoriesSubtotal { get; set; }
    public decimal QuotaSubtotal { get; set; }
    public decimal CmOverheadSubtotal { get; set; }
    public decimal FobPrice { get; set; }
    public decimal RoyaltyAmount { get; set; }
    public decimal FinalPriceIncludingRoyalty { get; set; }
}
