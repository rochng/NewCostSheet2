using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using System.Data;
using NewCostSheet.Api.Models;
using Dapper; // 確保你有引用 Dapper
using NewCostSheet.Api.Services;

namespace NewCostSheet.Api.Controllers; // 🎯 配合資料夾改成 Controllers

[ApiController]
[Route("api/costsheets")] // 🎯 基礎路由
public class CostSheetController : ControllerBase
{
    private readonly string _connectionString;
    private readonly IConfiguration _configuration;
    private readonly CalculationService _calculationService; // 🎯 1. 宣告服務變數
    private readonly ValidationService _validationService;

     
     public CostSheetController(IConfiguration configuration, CalculationService calculationService, ValidationService validationService)
    {
        //_connectionString = configuration.GetConnectionString("DefaultConnection") ?? "";
        _configuration = configuration;
        _connectionString = configuration.GetConnectionString("Vendor")??"";
        _calculationService = calculationService;
        _validationService = validationService;
    }

    [HttpPost("recalc")]
    public IActionResult Recalculate([FromBody] CostSheetHeader sheet)
    {
        var errors = _validationService.ValidateHeader(sheet);
        if (errors.Count > 0)
            return ValidationProblem(new ValidationProblemDetails
            (errors.ToDictionary(x => "validation", x => new[] { x })
            ));

        foreach (var line in sheet.Lines)
        {
            line.CalculatedAmount = _calculationService.CalculateLineAmount(line.Quantity, line.UnitPrice);
        }

        _calculationService.ApplyTotals(sheet);
        return Ok(sheet);
    }
    /// <summary>
    /// 解析並預洗 Excel 剪貼簿匯入的髒資料
    /// POST: /api/costsheets/validate-import
    /// </summary>
    [HttpPost("validate-import")]
    public IActionResult ValidateImport(
        [FromBody] ImportValidationRequest request,
        [FromServices] ImportParserService parser)
    {
        // 1. 透過 Parser 解析剪貼簿原始矩陣
        var rawRows = parser.ParseClipboard(request.ClipboardText);
        var warnings = new List<string>();
        
        // 🚀 【核心防爆清洗】為了對接前端網格的絕對特徵鎖定，我們在此對 Excel 髒資料進行預洗
        var sanitizedRows = new List<List<string>>();

        if (rawRows == null || rawRows.Count == 0)
        {
            warnings.Add("未在剪貼簿文字中偵測到任何有效行列。");
        }
        else
        {
            foreach (var row in rawRows)
            {
                var sanitizedRow = new List<string>();
                for (int i = 0; i < row.Count; i++)
                {
                    var cell = row[i]?.Trim() ?? string.Empty;

                    // 假設依據你的 gridFields 映射，第 8 欄是 Quantity，第 10 欄是 UnitPrice (依實際 index 調整)
                    // 這裡示範對所有可能的數值欄位進行【千分位去逗號防爆】
                    if (cell.Contains(",") && System.Text.RegularExpressions.Regex.IsMatch(cell, @"^\d{1,3}(,\d{3})+(\.\d+)?$"))
                    {
                        cell = cell.Replace(",", "");
                    }

                    sanitizedRow.Add(cell);
                }
                sanitizedRows.Add(sanitizedRow);
            }
        }

        return Ok(new ImportValidationResponse
        {
            Rows = sanitizedRows, // 回傳清洗過（去逗號、去髒空白）的安全矩陣
            Warnings = warnings,
            IsValid = sanitizedRows.Count > 0
        });
    }


    // <summary>
    /// POST /api/costsheets
    /// 驗證、重新計算並寫入資料庫 (建立新 CostSheet)
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateCostSheet([FromBody] CostSheetHeader sheet)
    {
        var errors = _validationService.ValidateHeader(sheet);
        if (errors.Count > 0){
        return ValidationProblem(new ValidationProblemDetails(
                    errors.ToDictionary(x => "validation", x => new[] { x })
                ));
        }

        // 重新清洗衍生金額計算
        foreach (var line in sheet.Lines)
            line.CalculatedAmount = _calculationService.CalculateLineAmount(line.Quantity, line.UnitPrice);

        var lineTable = CreateLineTableParameter(sheet.Lines, 0, includePersistedDeletes: false);

        var parameters = new DynamicParameters();
        parameters.Add("@Vendor", sheet.Vendor);
        parameters.Add("@Buyer", sheet.Buyer);
        parameters.Add("@Season", sheet.Season);
        parameters.Add("@SeasonYear", sheet.SeasonYear);
        parameters.Add("@Stage", sheet.Stage);
        parameters.Add("@PDStyle", sheet.PdStyle);
        parameters.Add("@Style", sheet.Style);
        parameters.Add("@RevisionNumber", sheet.RevisionNumber);
        parameters.Add("@RecordStatus", sheet.RecordStatus);
        parameters.Add("@Currency", sheet.Currency);
        parameters.Add("@RoyaltyRate", sheet.RoyaltyRate);
        parameters.Add("@Notes", sheet.Notes);
        parameters.Add("@CreatedBy", string.IsNullOrWhiteSpace(sheet.CreatedBy) ? "unknown" : sheet.CreatedBy.Trim());
        
        parameters.Add("@Lines", lineTable.AsTableValuedParameter("dbo.tt_CostSheetLineTableType"));
        parameters.Add("@OriginalCostSheetId", sheet.OriginalCostSheetId);

        await using var connection = new SqlConnection(_connectionString);
        var masterErrors = await ValidateCostSheetMastersAsync(connection, sheet, _validationService);
         if (masterErrors.Count > 0)
        {
            var errorDict = masterErrors
                .Select((error, index) => (error, index))
                .ToDictionary(item => $"validation{item.index}", item => new[] { item.error });
            
            return ValidationProblem(new ValidationProblemDetails(errorDict));
        }

      // 5. 執行寫入
        try
        {
            var saved = await connection.QuerySingleAsync<CostSheetSaveResult>(
                "dbo.usp_CostSheet_Create", 
                parameters, 
                commandType: CommandType.StoredProcedure
            );
            
            // 返回 201 Created，並附帶 Location Header 指向 GET 端點
            return Created($"/api/costsheets/{saved.CostSheetId}", new { id = saved.CostSheetId, revisionNumber = saved.RevisionNumber });
        }
        catch (SqlException exception) when (exception.Number is 50005 or 50006)
        {
            // 當發生特定 business error時返回 409 Conflict
            return Conflict(new { message = exception.Message });
        }
        catch (Exception exception)
        {
            // 其他未預期的錯誤返回 500 Internal Server Error
            return StatusCode(500, new { message = exception.Message });
        }
    }

    [HttpGet("search")]
    public async Task<IActionResult> SearchCostSheets([FromQuery] CostSheetSearchCriteria criteria)
    {
        // 💡 防呆調試：如果 criteria 本身變成了 null，直接回傳錯誤，方便知道是不是它在崩潰
        if (criteria == null) return BadRequest("Search criteria is null.");
        await using var connection = new SqlConnection(_connectionString);
        var results = await connection.QueryAsync<CostSheetSearchResult>("dbo.sys_costsheet", new
        {
            mode = 2,
            pdStyle = criteria.PdStyle,
            style = criteria.Style,
            season = criteria.Season,
            stage = criteria.Stage,
            vendor = criteria.Vendor,
            buyer = (string?)null,
            recordStatus = criteria.RecordStatus,
            revisionNo = (int?)null,
            id = (int?)null
        }, commandType: CommandType.StoredProcedure);
        
        return Ok(results);
    }

     [HttpGet("transactions")] // 🎯 網址會變成 /api/costsheets/transactions
    public async Task<IActionResult> GetTransactions(string pdStyle, string style, string vendor, string buyer)
    {
        if (new[] { pdStyle, style, vendor, buyer }.Any(string.IsNullOrWhiteSpace))
            return Ok(Array.Empty<CostSheetSearchResult>());

        await using var connection = new SqlConnection(_connectionString);
        var results = await connection.QueryAsync<CostSheetSearchResult>("""
            SELECT CostSheetId AS Id, PDStyle AS PdStyle, Style, Vendor, Buyer, Season,
                   RevisionNumber, Stage, RecordStatus, ModifiedDate
            FROM dbo.CostSheet
            WHERE IsDeleted = 0
              AND PDStyle = @PdStyle
              AND Style = @Style
              AND Vendor = @Vendor
              AND Buyer = @Buyer
            ORDER BY RevisionNumber, ModifiedDate, CostSheetId;
            """, new { PdStyle = pdStyle.Trim(), Style = style.Trim(), Vendor = vendor.Trim(), Buyer = buyer.Trim() });
        
        return Ok(results);
    }

    [HttpGet("{id:int}")] // 🎯 網址會變成 /api/costsheets/{id}
    public async Task<IActionResult> GetCostSheetById(int id)
    {
        await using var connection = new SqlConnection(_connectionString);
        var sheet = await connection.QuerySingleOrDefaultAsync<CostSheetHeader>("""
            SELECT CostSheetId AS Id, Vendor, Buyer, Season, SeasonYear, Stage, PDStyle, Style,
                   RevisionNumber, RecordStatus, Currency, RoyaltyRate, Notes, CreatedBy, CreatedDate,
                   ModifiedBy, ModifiedDate
            FROM dbo.CostSheet
            WHERE CostSheetId = @Id AND IsDeleted = 0;
            """, new { Id = id });

        if (sheet is null)
            return NotFound();

        // 🚀【核心加固 1】注入 TempId 以對接前端 UUID 鎖定機制，並對單位執行強制去除空白與大寫清洗
        var lines = await connection.QueryAsync<CostSheetLine>("""
             SELECT 
                 CAST(CostSheetLineId AS VARCHAR(50)) AS TempId, -- ✨ 給予既有行絕對特徵，防止前端打字失焦與貼上錯位
                 CostSheetLineId AS Id, 
                 CostSheetId, 
                 SectionCode, 
                 CategoryCode, 
                 CategoryName, 
                 ItemName,
                 Description, 
                 ArticleNumber, 
                 Supplier, 
                 Quantity, 
                 UPPER(LTRIM(RTRIM(QuantityUnit))) AS QuantityUnit, -- ✨ SQL 2016 影子單位安全預洗
                 UnitPrice, 
                 UPPER(LTRIM(RTRIM(QuantityUnit))) AS PriceUnit,    -- ✨ 確保雙向影子單位絕對連動一致
                 CalculatedAmount, 
                 Notes, 
                 DisplayOrder,
                 CONVERT(bit, 0) AS IsDeleted                       -- ✨ 初始化載入的資料 IsDeleted 預設為 false
            FROM dbo.CostSheetLine
            WHERE CostSheetId = @Id AND IsDeleted = 0
            ORDER BY DisplayOrder, CostSheetLineId;
            """, new { Id = id });
            
        sheet.Lines = lines.ToList();

        return Ok(sheet);
    }

    [HttpGet("{id:int}/print")] // 🎯 網址會變成 /api/costsheets/{id}/print
    public async Task<IActionResult> GetCostSheetForPrint(int id)
    {
        await using var connection = new SqlConnection(_connectionString);
        using var results = await connection.QueryMultipleAsync(
            "dbo.usp_CostSheet_GetForPrint",
            new { CostSheetId = id },
            commandType: CommandType.StoredProcedure);

        var sheet = await results.ReadSingleOrDefaultAsync<CostSheetHeader>();
        if (sheet is null)
            return NotFound();

        sheet.Lines = (await results.ReadAsync<CostSheetLine>()).ToList();
        
        // 🎯 使用建構子注入的服務，不需要像以前一樣寫在參數列
        _calculationService.ApplyTotals(sheet);
        
        return Ok(sheet);
    }

    [HttpGet("/api/demo/costsheets/{id:int}")] // 🎯 這裡用全路徑蓋掉預設的路由，保持網址完全一致
    public IActionResult GetDemoCostSheet(int id)
    {
        var sheet = new CostSheetHeader
        {
            Id = id,
            Vendor = "Pretty",
            Buyer = "DB",
            Season = "Fall",
            SeasonYear = "2027",
            Stage = "1St PD Sample",
            PdStyle = "xy4657",
            Style = "52XR146",
            RevisionNumber = 1,
            RecordStatus = "Draft",
            Currency = "USD",
            RoyaltyRate = 0.05m,
            Notes = "Sample cost sheet",
            Lines = new List<CostSheetLine>
            {
                new() { SectionCode = "A", CategoryCode = "A-1", CategoryName = "Shell", ItemName = "Bodice", Description = "Chiffon", ArticleNumber = "SP3449", Supplier = "Supplier 1", Quantity = 5m, QuantityUnit = "YDS", UnitPrice = 1.59m, PriceUnit = "YD", CalculatedAmount = 7.95m, DisplayOrder = 1 },
                new() { SectionCode = "A", CategoryCode = "A-3", CategoryName = "Lining", ItemName = "Bodice", Description = "Lining", ArticleNumber = "GT207", Supplier = "Supplier 1", Quantity = 8m, QuantityUnit = "YDS", UnitPrice = 0.83m, PriceUnit = "YD", CalculatedAmount = 6.64m, DisplayOrder = 2 },
                new() { SectionCode = "B", CategoryCode = "Zipper", CategoryName = "Zipper", ItemName = "Zipper", Description = "Zipper", ArticleNumber = "ZP-14", Supplier = "Supplier 2", Quantity = 1m, QuantityUnit = "PCS", UnitPrice = 1m, PriceUnit = "PC", CalculatedAmount = 1m, DisplayOrder = 3 },
                new() { SectionCode = "D", CategoryCode = "Gown CM + Overhead", CategoryName = "CM & Overhead", ItemName = "Gown CM + Overhead", Description = "Labor, finance, transportation, and margin", ArticleNumber = "CM-1", Supplier = "Production", Quantity = 1m, QuantityUnit = "PCS", UnitPrice = 27.69m, PriceUnit = "PC", CalculatedAmount = 27.69m, DisplayOrder = 4 }
            }
        };

        // 🎯 這裡也可以直接沿用注入的服務
        _calculationService.ApplyTotals(sheet);
        
        return Ok(sheet);
    }

// 🎯 將第一個參數型態從 List<CostSheetLine> 改為 IEnumerable<CostSheetLine>
    private DataTable CreateLineTableParameter(IEnumerable<CostSheetLine> lines, int costSheetId, bool includePersistedDeletes)
    {
        var table = new DataTable();
        table.Columns.Add("TempId", typeof(string));
        table.Columns.Add("Id", typeof(int));
        table.Columns.Add("CostSheetId", typeof(int));
        table.Columns.Add("SectionCode", typeof(string));
        table.Columns.Add("CategoryCode", typeof(string));
        table.Columns.Add("CategoryName", typeof(string));
        table.Columns.Add("ItemName", typeof(string));
        table.Columns.Add("Description", typeof(string));
        table.Columns.Add("ArticleNumber", typeof(string));
        table.Columns.Add("Supplier", typeof(string));
        table.Columns.Add("Quantity", typeof(decimal));
        table.Columns.Add("QuantityUnit", typeof(string));
        table.Columns.Add("UnitPrice", typeof(decimal));
        table.Columns.Add("PriceUnit", typeof(string));
        table.Columns.Add("CalculatedAmount", typeof(decimal));
        table.Columns.Add("Notes", typeof(string));
        table.Columns.Add("DisplayOrder", typeof(int));
        table.Columns.Add("IsDeleted", typeof(bool));

        foreach (var line in lines)
        {
            if (line.IsDeleted && (line.Id == 0 || !includePersistedDeletes))
                continue;

            table.Rows.Add(
                string.IsNullOrWhiteSpace(line.TempId) ? DBNull.Value : line.TempId.Trim(),
                line.Id,
                costSheetId,
                line.SectionCode ?? string.Empty,
                line.CategoryCode ?? string.Empty,
                line.CategoryName ?? string.Empty,
                line.ItemName ?? string.Empty,
                line.Description ?? string.Empty,
                line.ArticleNumber ?? string.Empty,
                line.Supplier ?? string.Empty,
                line.Quantity,
                (string.IsNullOrWhiteSpace(line.QuantityUnit) ? "PCS" : line.QuantityUnit).Trim().ToUpperInvariant(),
                line.UnitPrice,
                (string.IsNullOrWhiteSpace(line.PriceUnit) ? "PCS" : line.PriceUnit).Trim().ToUpperInvariant(),
                line.CalculatedAmount,
                line.Notes ?? string.Empty,
                line.DisplayOrder,
                line.IsDeleted);
        }

        return table;
    }

    async Task<List<string>> ValidateCostSheetMastersAsync(SqlConnection connection, CostSheetHeader sheet, ValidationService validationService)
    {
        var errors = new List<string>();
        var vendorExists = await connection.ExecuteScalarAsync<bool>("""
            SELECT CONVERT(bit, CASE WHEN EXISTS (
                SELECT 1 FROM dbo.Vendor
                WHERE Vendor_code = @Vendor AND Vendor_code > ''
            ) THEN 1 ELSE 0 END);
            """, new { sheet.Vendor });
        if (!vendorExists)
            errors.Add("Vendor is not in the vendor master.");

        var buyerExists = await connection.ExecuteScalarAsync<bool>("""
            SELECT CONVERT(bit, CASE WHEN EXISTS (
                SELECT 1 FROM ERPII.dbo.company
                WHERE company = @Buyer AND IsBuyer = 1 AND edi = 1 AND st_status = 5614
            ) THEN 1 ELSE 0 END);
            """, new { sheet.Buyer });
        if (!buyerExists)
            errors.Add("Buyer is not in the buyer master.");

        if (!string.IsNullOrWhiteSpace(sheet.Stage))
        {
            var stageExists = await connection.ExecuteScalarAsync<bool>("""
                SELECT CONVERT(bit, CASE WHEN EXISTS (
                    SELECT 1 FROM dbo.CostStage WHERE StageName = @Stage AND IsActive = 1
                ) THEN 1 ELSE 0 END);
                """, new { sheet.Stage });
            if (!stageExists)
                errors.Add("Stage is not in the active stage master.");
        }

        var validCategories = (await connection.QueryAsync<CostCategoryOption>("""
            SELECT section.SectionCode, category.CategoryCode AS Code
            FROM dbo.CostCategory AS category
            INNER JOIN dbo.CostSection AS section ON section.SectionId = category.SectionId
            WHERE category.IsActive = 1
            """))
            .Select(category => $"{category.SectionCode}\0{category.Code}")
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        for (var index = 0; index < sheet.Lines.Count; index++)
        {
            var line = sheet.Lines[index];
            if (line.IsDeleted) continue; 
            errors.AddRange(validationService.ValidateRow(line).Select(error => $"Line {index + 1}: {error}"));
            if (!validationService.IsBlankRow(line) &&
                !validCategories.Contains($"{line.SectionCode}\0{line.CategoryCode}"))
            {
                errors.Add($"Line {index + 1}: Category Code is not valid for section {line.SectionCode}.");
            }
        }

        return errors;
    }

    [HttpGet("masters")]
    public async Task<IActionResult> GetMasters()
    {
        // 💡 建議透過注入的 IConfiguration 取得連線字串，或是換成您目前使用的 hard-code 連線字串
        var connStr = _configuration.GetConnectionString("Vendor"); 

        await using var connection = new SqlConnection(connStr);
        
        var vendors = await connection.QueryAsync<MasterOption>("""
            SELECT Vendor_code AS Code, ltrim(rtrim(Vendor_Name)) AS Name
            FROM dbo.Vendor
            WHERE Vendor_code > ''
            ORDER BY Vendor_Name;
            """);
            
        var buyers = await connection.QueryAsync<MasterOption>("""
            SELECT company AS Code, COALESCE(NULLIF(LTRIM(RTRIM([name])), ''), company) AS Name
            FROM ERPII.dbo.company
            WHERE IsBuyer = 1 AND edi = 1 AND st_status = 5614
            ORDER BY company;
            """);
            
        var categories = await connection.QueryAsync<CostCategoryOption>("""
            SELECT category.CategoryId AS Id, section.SectionCode, category.CategoryCode AS Code,
                category.CategoryName AS Name, category.IsActive
            FROM dbo.CostCategory AS category
            INNER JOIN dbo.CostSection AS section ON section.SectionId = category.SectionId
            ORDER BY section.SectionCode, category.CategoryCode, category.CategoryName;
            """);
            
        var sections = await connection.QueryAsync<CostSectionOption>("""
            SELECT SectionCode AS Code, SectionName AS Name
            FROM dbo.CostSection
            ORDER BY SectionId;
            """);
            
        var stages = await connection.QueryAsync<CostStageOption>("""
            SELECT StageId AS Id, StageName AS Name, IsActive
            FROM dbo.CostStage
            ORDER BY StageName;
            """);

        return Ok(new { vendors, buyers, categories, sections, stages });
    }



    /// <summary>
    /// 修改 / 更新現有的成本計算單
    /// PUT: /api/costsheets/{id}
    /// </summary>
    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateCostSheet(
        int id, 
        [FromBody] CostSheetHeader sheet,
        [FromServices] CalculationService calculationService,
        [FromServices] ValidationService validationService)
    {
        // 1. 驗證 Header 基礎欄位
        var errors = validationService.ValidateHeader(sheet);
        if (errors.Count > 0)
        {
            var errorDict = errors.ToDictionary(x => "validation", x => new[] { x });
            return ValidationProblem(new ValidationProblemDetails(errorDict));
        }

        // 2. 重新清洗與計算明細衍生金額
        foreach (var line in sheet.Lines)
        {
            line.CalculatedAmount = calculationService.CalculateLineAmount(line.Quantity, line.UnitPrice);
        }

        // 3. 建立 TVP 參數 (修改模式下 includePersistedDeletes 必須為 true)
        var lineTable = CreateLineTableParameter(sheet.Lines, id, includePersistedDeletes: true);

        // 4. 設定預存程序參數
        var parameters = new DynamicParameters();
        parameters.Add("@CostSheetId", id);
        parameters.Add("@Vendor", sheet.Vendor);
        parameters.Add("@Buyer", sheet.Buyer);
        parameters.Add("@Season", sheet.Season);
        parameters.Add("@SeasonYear", sheet.SeasonYear);
        parameters.Add("@Stage", sheet.Stage);
        parameters.Add("@PDStyle", sheet.PdStyle);
        parameters.Add("@Style", sheet.Style);
        parameters.Add("@RevisionNumber", sheet.RevisionNumber);
        parameters.Add("@RecordStatus", sheet.RecordStatus);
        parameters.Add("@Currency", sheet.Currency);
        parameters.Add("@RoyaltyRate", sheet.RoyaltyRate);
        parameters.Add("@Notes", sheet.Notes);
        parameters.Add("@ModifiedBy", string.IsNullOrWhiteSpace(sheet.ModifiedBy) ? "unknown" : sheet.ModifiedBy.Trim());
        
        parameters.Add("@Lines", lineTable.AsTableValuedParameter("dbo.tt_CostSheetLineTableType"));

        // 5. 跨庫 / 主檔關聯驗證
        await using var connection = new SqlConnection(_connectionString);
        var masterErrors = await ValidateCostSheetMastersAsync(connection, sheet, validationService);
        if (masterErrors.Count > 0)
        {
            var errorDict = masterErrors
                .Select((error, index) => (error, index))
                .ToDictionary(item => $"validation{item.index}", item => new[] { item.error });
            
            return ValidationProblem(new ValidationProblemDetails(errorDict));
        }

        // 6. 執行更新預存程序
        try
        {
            var saved = await connection.QuerySingleAsync<CostSheetSaveResult>(
                "dbo.usp_CostSheet_Update", 
                parameters, 
                commandType: CommandType.StoredProcedure
            );
            
            return Ok(new { id = saved.CostSheetId, revisionNumber = saved.RevisionNumber });
        }
        catch (SqlException exception) when (exception.Number is 50017 or 50019)
        {
            // 阻擋商業邏輯衝突 (例如版號不對或狀態不允許修改)
            return Conflict(new { message = exception.Message });
        }
        catch (Exception exception)
        {
            return StatusCode(500, new { message = exception.Message });
        }
    }


    [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id, [FromBody] CostSheetDeleteRequest request)
        {
            // 💡 運用專案標準擴充方法動態取得 Vendor 資料庫連線字串
            string connectionString = _configuration.GetConnectionString("Vendor") ?? "";

            await using var connection = new SqlConnection(connectionString);
            try
            {
                // ✨ 保留高可靠性預存程序呼叫，並落實乾淨的去空白清洗
                await connection.ExecuteAsync("dbo.usp_CostSheet_Delete",
                    new 
                    { CostSheetId = id, DeletedBy = string.IsNullOrWhiteSpace(request.DeletedBy) ? "unknown" : request.DeletedBy.Trim() },
                    commandType: CommandType.StoredProcedure
                );

                return NoContent(); // 204 NoContent
            }
            catch (SqlException exception) when (exception.Number == 50018)
            {
                return NotFound(); // 404 NotFound
            }
        }

    /*
    DataTable CreateLineTableParameter_(List<CostSheetLine> lines, int costSheetId, bool includePersistedDeletes)
    {
        var table = new DataTable();
        table.Columns.Add("TempId", typeof(string));
        table.Columns.Add("Id", typeof(int));
        table.Columns.Add("CostSheetId", typeof(int));
        table.Columns.Add("SectionCode", typeof(string));
        table.Columns.Add("CategoryCode", typeof(string));
        table.Columns.Add("CategoryName", typeof(string));
        table.Columns.Add("ItemName", typeof(string));
        table.Columns.Add("Description", typeof(string));
        table.Columns.Add("ArticleNumber", typeof(string));
        table.Columns.Add("Supplier", typeof(string));
        table.Columns.Add("Quantity", typeof(decimal));
        table.Columns.Add("QuantityUnit", typeof(string));
        table.Columns.Add("UnitPrice", typeof(decimal));
        table.Columns.Add("PriceUnit", typeof(string));
        table.Columns.Add("CalculatedAmount", typeof(decimal));
        table.Columns.Add("Notes", typeof(string));
        table.Columns.Add("DisplayOrder", typeof(int));
        table.Columns.Add("IsDeleted", typeof(bool));

        foreach (var line in lines)
        {
            if (line.IsDeleted && (line.Id == 0 || !includePersistedDeletes))
                continue;

            table.Rows.Add(
                string.IsNullOrWhiteSpace(line.TempId) ? DBNull.Value : line.TempId.Trim(),
                line.Id,
                costSheetId,
                line.SectionCode ?? string.Empty,
                line.CategoryCode ?? string.Empty,
                line.CategoryName ?? string.Empty,
                line.ItemName ?? string.Empty,
                line.Description ?? string.Empty,
                line.ArticleNumber ?? string.Empty,
                line.Supplier ?? string.Empty,
                line.Quantity,
                (string.IsNullOrWhiteSpace(line.QuantityUnit) ? "PCS" : line.QuantityUnit).Trim().ToUpperInvariant(),
                line.UnitPrice,
                (string.IsNullOrWhiteSpace(line.PriceUnit) ? "PCS" : line.PriceUnit).Trim().ToUpperInvariant(),
                line.CalculatedAmount,
                line.Notes ?? string.Empty,
                line.DisplayOrder,
                line.IsDeleted);
        }

        return table;
    }
    */

    public class CostSheetDeleteRequest
    {
        public string? DeletedBy { get; set; }
    }
}