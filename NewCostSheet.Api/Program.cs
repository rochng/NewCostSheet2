using System.Data;
using System.Text.Json;
using Dapper;
using NewCostSheet.Api.Models;
using NewCostSheet.Api.Services;
using Microsoft.Data.SqlClient;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.AllowAnyOrigin()
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddSingleton<CalculationService>();
builder.Services.AddSingleton<ValidationService>();
builder.Services.AddSingleton<ImportParserService>();

var databaseConfig = builder.Configuration.GetSection("Database");
var connectionString = new SqlConnectionStringBuilder
{
    DataSource = databaseConfig["Server"] ?? throw new InvalidOperationException("Database:Server is required."),
    InitialCatalog = databaseConfig["Name"] ?? throw new InvalidOperationException("Database:Name is required."),
    UserID = databaseConfig["User"] ?? throw new InvalidOperationException("Database:User is required."),
    Password = builder.Configuration["DB_PASSWORD"] ?? string.Empty,
    Encrypt = false,
    TrustServerCertificate = true,
    MultipleActiveResultSets = true,
    ApplicationName = "NewCostSheetApi"
}.ConnectionString;

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
        WHERE category.IsActive = 1
        """))
        .Select(category => $"{category.SectionCode}\0{category.Code}")
        .ToHashSet(StringComparer.OrdinalIgnoreCase);

    for (var index = 0; index < sheet.Lines.Count; index++)
    {
        var line = sheet.Lines[index];
        errors.AddRange(validationService.ValidateRow(line).Select(error => $"Line {index + 1}: {error}"));
        if (!validationService.IsBlankRow(line) &&
            !validCategories.Contains($"{line.SectionCode}\0{line.CategoryCode}"))
        {
            errors.Add($"Line {index + 1}: Category Code is not valid for section {line.SectionCode}.");
        }
    }

    return errors;
}

var app = builder.Build();
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowFrontend");
app.UseHttpsRedirection();

app.MapGet("/api/health", () => Results.Ok(new { status = "ok", time = DateTime.UtcNow }));

app.MapPost("/api/login", async (LoginRequest request) =>
{
    if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrEmpty(request.Password))
    {
        return Results.BadRequest(new { message = "Login name and password are required." });
    }

    try
    {
        await using var connection = new SqlConnection(connectionString);
        var parameters = new DynamicParameters();
        parameters.Add("@LoginName", request.Username.Trim(), DbType.String, size: 30);
        parameters.Add("@Password", request.Password, DbType.String, size: 20);
        using var results = await connection.QueryMultipleAsync("dbo.sys_login", parameters, commandType: CommandType.StoredProcedure);

        var login = await results.ReadFirstOrDefaultAsync<LoginProcedureRow>();
        var isValid = login?.ValidationResult == true || login?.IsValid == true;
        if (!isValid)
        {
            return Results.Unauthorized();
        }

        var role = login!.RoleRight ?? login.RoleName ?? "Viewer";
        var isAuthorized = login.IsAuthorized == true;
        var stages = results.IsConsumed
            ? new List<string>()
            : (await results.ReadAsync<LoginStageRow>()).Select(row => row.Stage ?? row.Name).Where(value => !string.IsNullOrWhiteSpace(value)).Select(value => value!).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        var vendors = results.IsConsumed
            ? new List<string>()
            : (await results.ReadAsync<LoginVendorRow>()).Select(row => row.VendorName ?? row.Vendor ?? row.Company).Where(value => !string.IsNullOrWhiteSpace(value)).Select(value => value!).Distinct(StringComparer.OrdinalIgnoreCase).ToList();

        return Results.Ok(new LoginResult
        {
            IsValid = true,
            Role = role,
            Username = login.Username ?? string.Empty,
            FullName = login.FullName ?? string.Empty,
            LoginName = request.Username.Trim(),
            IsAuthorized = isAuthorized,
            Stages = stages,
            Vendors = isAuthorized ? vendors : new List<string>()
        });
    }
    catch (SqlException exception)
    {
        app.Logger.LogError(exception, "Database login procedure failed.");
        return Results.Problem("The database login service is unavailable. Check the API database configuration and dbo.sys_login procedure.", statusCode: StatusCodes.Status503ServiceUnavailable);
    }
});

app.MapGet("/api/lookups", () => Results.Ok(new[]
{
    new LookupItem { Code = "Pretty", Name = "Pretty", Type = "Vendor" },
    new LookupItem { Code = "DB", Name = "DB", Type = "Buyer" },
    new LookupItem { Code = "1ST_PD_SAMPLE", Name = "1St PD Sample", Type = "Stage" },
    new LookupItem { Code = "USD", Name = "USD", Type = "Currency" },
    new LookupItem { Code = "DRAFT", Name = "Draft", Type = "Status" },
    new LookupItem { Code = "SUBMITTED", Name = "Submitted", Type = "Status" },
    new LookupItem { Code = "APPROVED", Name = "Approved", Type = "Status" },
    new LookupItem { Code = "ARCHIVED", Name = "Archived", Type = "Status" }
}));

app.MapPost("/api/costsheets/recalc", (CostSheetHeader sheet, CalculationService calculationService, ValidationService validationService) =>
{
    var errors = validationService.ValidateHeader(sheet);
    if (errors.Count > 0)
        return Results.ValidationProblem(errors.ToDictionary(x => "validation", x => new[] { x }));

    foreach (var line in sheet.Lines)
    {
        line.CalculatedAmount = calculationService.CalculateLineAmount(line.Quantity, line.UnitPrice);
    }

    calculationService.ApplyTotals(sheet);
    return Results.Ok(sheet);
});

app.MapPost("/api/costsheets", async (CostSheetHeader sheet, CalculationService calculationService, ValidationService validationService) =>
{
    var errors = validationService.ValidateHeader(sheet);
    if (errors.Count > 0)
        return Results.ValidationProblem(errors.ToDictionary(x => "validation", x => new[] { x }));

    foreach (var line in sheet.Lines)
        line.CalculatedAmount = calculationService.CalculateLineAmount(line.Quantity, line.UnitPrice);

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
    parameters.Add("@LinesJson", JsonSerializer.Serialize(sheet.Lines, new JsonSerializerOptions(JsonSerializerDefaults.Web)));
    parameters.Add("@OriginalCostSheetId", sheet.OriginalCostSheetId);

    await using var connection = new SqlConnection(connectionString);
    var masterErrors = await ValidateCostSheetMastersAsync(connection, sheet, validationService);
    if (masterErrors.Count > 0)
        return Results.ValidationProblem(masterErrors.Select((error, index) => (error, index)).ToDictionary(item => $"validation{item.index}", item => new[] { item.error }));

    try
    {
    var saved = await connection.QuerySingleAsync<CostSheetSaveResult>("dbo.usp_CostSheet_Create", parameters, commandType: CommandType.StoredProcedure);
    return Results.Created($"/api/costsheets/{saved.CostSheetId}", new { id = saved.CostSheetId, revisionNumber = saved.RevisionNumber });
    }
    catch (SqlException exception) when (exception.Number == 50005)
    {
        return Results.Conflict(new { message = exception.Message });
    }
});

app.MapPut("/api/costsheets/{id:int}", async (int id, CostSheetHeader sheet, CalculationService calculationService, ValidationService validationService) =>
{
    var errors = validationService.ValidateHeader(sheet);
    if (errors.Count > 0)
        return Results.ValidationProblem(errors.ToDictionary(x => "validation", x => new[] { x }));

    foreach (var line in sheet.Lines)
        line.CalculatedAmount = calculationService.CalculateLineAmount(line.Quantity, line.UnitPrice);

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
    parameters.Add("@LinesJson", JsonSerializer.Serialize(sheet.Lines, new JsonSerializerOptions(JsonSerializerDefaults.Web)));

    await using var connection = new SqlConnection(connectionString);
    var masterErrors = await ValidateCostSheetMastersAsync(connection, sheet, validationService);
    if (masterErrors.Count > 0)
        return Results.ValidationProblem(masterErrors.Select((error, index) => (error, index)).ToDictionary(item => $"validation{item.index}", item => new[] { item.error }));

    try
    {
        var saved = await connection.QuerySingleAsync<CostSheetSaveResult>("dbo.usp_CostSheet_Update", parameters, commandType: CommandType.StoredProcedure);
        return Results.Ok(new { id = saved.CostSheetId, revisionNumber = saved.RevisionNumber });
    }
    catch (SqlException exception) when (exception.Number == 50017)
    {
        return Results.Conflict(new { message = exception.Message });
    }
});

app.MapDelete("/api/costsheets/{id:int}", async (int id, [Microsoft.AspNetCore.Mvc.FromBody] CostSheetDeleteRequest request) =>
{
    await using var connection = new SqlConnection(connectionString);
    try
    {
        await connection.ExecuteAsync(
            "dbo.usp_CostSheet_Delete",
            new { CostSheetId = id, DeletedBy = string.IsNullOrWhiteSpace(request.DeletedBy) ? "unknown" : request.DeletedBy.Trim() },
            commandType: CommandType.StoredProcedure);
        return Results.NoContent();
    }
    catch (SqlException exception) when (exception.Number == 50018)
    {
        return Results.NotFound();
    }
});

app.MapPost("/api/costsheets/validate-import", (ImportValidationRequest request, ImportParserService parser) =>
{
    var rows = parser.ParseClipboard(request.ClipboardText);
    var warnings = new List<string>();

    if (rows.Count == 0)
    {
        warnings.Add("No rows were detected in the pasted clipboard text.");
    }

    return Results.Ok(new ImportValidationResponse
    {
        Rows = rows,
        Warnings = warnings,
        IsValid = rows.Count > 0
    });
});

app.MapGet("/api/costsheets/masters", async () =>
{
    await using var connection = new SqlConnection(connectionString);
    var vendors = await connection.QueryAsync<MasterOption>("""
        SELECT Vendor_code AS Code, Vendor_Name AS Name
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
        ORDER BY section.SectionCode, category.CategoryName;
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

    return Results.Ok(new { vendors, buyers, categories, sections, stages });
});

app.MapPost("/api/maintenance/categories", async (CostCategoryMaintenanceRequest request) =>
{
    if (string.IsNullOrWhiteSpace(request.SectionCode) || string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name))
        return Results.BadRequest(new { message = "Section, category code, and category name are required." });

    await using var connection = new SqlConnection(connectionString);
    var created = await connection.QuerySingleOrDefaultAsync<CostCategoryOption>("""
        INSERT INTO dbo.CostCategory (SectionId, CategoryCode, CategoryName, IsCustom, IsActive, CreatedBy, ModifiedBy)
        OUTPUT INSERTED.CategoryId AS Id, @SectionCode AS SectionCode,
               INSERTED.CategoryCode AS Code, INSERTED.CategoryName AS Name, INSERTED.IsActive
        SELECT SectionId, @Code, @Name, 1, @IsActive, 'maintenance', 'maintenance'
        FROM dbo.CostSection WHERE SectionCode = @SectionCode;
        """, request);
    return created is null ? Results.BadRequest(new { message = "Unknown section code." }) : Results.Created("/api/costsheets/masters", created);
});

app.MapPut("/api/maintenance/categories/{id:int}", async (int id, CostCategoryMaintenanceRequest request) =>
{
    if (string.IsNullOrWhiteSpace(request.SectionCode) || string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name))
        return Results.BadRequest(new { message = "Section, category code, and category name are required." });

    await using var connection = new SqlConnection(connectionString);
    var changed = await connection.ExecuteAsync("""
        UPDATE category
        SET SectionId = section.SectionId, CategoryCode = @Code, CategoryName = @Name,
            IsActive = @IsActive, ModifiedBy = 'maintenance', ModifiedDate = GETDATE()
        FROM dbo.CostCategory AS category
        INNER JOIN dbo.CostSection AS section ON section.SectionCode = @SectionCode
        WHERE category.CategoryId = @Id;
        """, new { Id = id, request.SectionCode, request.Code, request.Name, request.IsActive });
    return changed == 0 ? Results.NotFound() : Results.NoContent();
});

app.MapDelete("/api/maintenance/categories/{id:int}", async (int id) =>
{
    await using var connection = new SqlConnection(connectionString);
    var changed = await connection.ExecuteAsync("""
        UPDATE dbo.CostCategory
        SET IsActive = 0, ModifiedBy = 'maintenance', ModifiedDate = GETDATE()
        WHERE CategoryId = @Id AND IsActive = 1;
        """, new { Id = id });
    return changed == 0 ? Results.NotFound() : Results.NoContent();
});

app.MapPost("/api/maintenance/stages", async (CostStageMaintenanceRequest request) =>
{
    if (string.IsNullOrWhiteSpace(request.Name))
        return Results.BadRequest(new { message = "Stage name is required." });

    await using var connection = new SqlConnection(connectionString);
    var created = await connection.QuerySingleAsync<CostStageOption>("""
        INSERT INTO dbo.CostStage (StageName, IsActive, CreatedBy, ModifiedBy)
        OUTPUT INSERTED.StageId AS Id, INSERTED.StageName AS Name, INSERTED.IsActive
        VALUES (@Name, @IsActive, 'maintenance', 'maintenance');
        """, request);
    return Results.Created("/api/costsheets/masters", created);
});

app.MapPut("/api/maintenance/stages/{id:int}", async (int id, CostStageMaintenanceRequest request) =>
{
    if (string.IsNullOrWhiteSpace(request.Name))
        return Results.BadRequest(new { message = "Stage name is required." });

    await using var connection = new SqlConnection(connectionString);
    var changed = await connection.ExecuteAsync("""
        UPDATE dbo.CostStage
        SET StageName = @Name, IsActive = @IsActive,
            ModifiedBy = 'maintenance', ModifiedDate = GETDATE()
        WHERE StageId = @Id;
        """, new { Id = id, request.Name, request.IsActive });
    return changed == 0 ? Results.NotFound() : Results.NoContent();
});

app.MapDelete("/api/maintenance/stages/{id:int}", async (int id) =>
{
    await using var connection = new SqlConnection(connectionString);
    var changed = await connection.ExecuteAsync("""
        UPDATE dbo.CostStage
        SET IsActive = 0, ModifiedBy = 'maintenance', ModifiedDate = GETDATE()
        WHERE StageId = @Id AND IsActive = 1;
        """, new { Id = id });
    return changed == 0 ? Results.NotFound() : Results.NoContent();
});

app.MapGet("/api/costsheets/search", async ([AsParameters] CostSheetSearchCriteria criteria) =>
{
    await using var connection = new SqlConnection(connectionString);
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
    return Results.Ok(results);
});

app.MapGet("/api/costsheets/{id:int}", async (int id) =>
{
    await using var connection = new SqlConnection(connectionString);
    var sheet = await connection.QuerySingleOrDefaultAsync<CostSheetHeader>("""
        SELECT CostSheetId AS Id, Vendor, Buyer, Season, SeasonYear, Stage, PDStyle, Style,
               RevisionNumber, RecordStatus, Currency, RoyaltyRate, Notes, CreatedBy, CreatedDate,
               ModifiedBy, ModifiedDate
        FROM dbo.CostSheet
        WHERE CostSheetId = @Id AND IsDeleted = 0;
        """, new { Id = id });

    if (sheet is null)
        return Results.NotFound();

    var lines = await connection.QueryAsync<CostSheetLine>("""
         SELECT CostSheetLineId AS Id, CostSheetId, SectionCode, CategoryCode, CategoryName, ItemName,
             Description, ArticleNumber, Supplier, Quantity, QuantityUnit, UnitPrice, QuantityUnit AS PriceUnit,
               CalculatedAmount, Notes, DisplayOrder
        FROM dbo.CostSheetLine
        WHERE CostSheetId = @Id AND IsDeleted = 0
        ORDER BY DisplayOrder, CostSheetLineId;
        """, new { Id = id });
    sheet.Lines = lines.ToList();

    return Results.Ok(sheet);
});

app.MapGet("/api/costsheets/{id:int}/print", async (int id, CalculationService calculationService) =>
{
    await using var connection = new SqlConnection(connectionString);
    using var results = await connection.QueryMultipleAsync(
        "dbo.usp_CostSheet_GetForPrint",
        new { CostSheetId = id },
        commandType: CommandType.StoredProcedure);

    var sheet = await results.ReadSingleOrDefaultAsync<CostSheetHeader>();
    if (sheet is null)
        return Results.NotFound();

    sheet.Lines = (await results.ReadAsync<CostSheetLine>()).ToList();
    calculationService.ApplyTotals(sheet);
    return Results.Ok(sheet);
});

app.MapGet("/api/demo/costsheets/{id:int}", (int id) =>
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

    var calculationService = new CalculationService();
    calculationService.ApplyTotals(sheet);
    return Results.Ok(sheet);
});

app.Run();
