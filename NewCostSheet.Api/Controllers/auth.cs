using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using System.Data;
using NewCostSheet.Api.Models;
using Dapper; // 確保你有引用 Dapper
using NewCostSheet.Api.Services;

namespace NewCostSheet.Api.Controllers
{
    
  [ApiController]
    [Route("api")] // 💡 設為 api，這樣實作 [HttpPost("login")] 就會剛好對接 /api/login
    public class AuthController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<AuthController> _logger;

        public AuthController(IConfiguration configuration, ILogger<AuthController> logger)
        {
            _configuration = configuration;
            _logger = logger;
        }

        /// <summary>
        /// 系統使用者登入驗證
        /// POST: /api/login
        /// </summary>
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrEmpty(request.Password))
            {
                return BadRequest(new { message = "Login name and password are required." });
            }

            try
            {
                // ✨ 完整保留原本手動建立 SqlConnectionStringBuilder 的邏輯
                var connectionString = new SqlConnectionStringBuilder
                {
                    DataSource = _configuration["Database:Server"] ?? throw new InvalidOperationException("Database:Server is required."),
                    InitialCatalog = _configuration["Database:Name"] ?? throw new InvalidOperationException("Database:Name is required."),
                    UserID = _configuration["Database:User"] ?? throw new InvalidOperationException("Database:User is required."),
                    Password = _configuration["DB_PASSWORD"] ?? string.Empty,
                    //Password = _configuration["DB_PASSWORD"] ?? string.Empty,
                    //Password = "1203fri",
                    Encrypt = false,
                    TrustServerCertificate = true,
                    MultipleActiveResultSets = true,
                    ApplicationName = "NewCostSheetApi"
                }.ConnectionString;
                /*
                var connectionString = new SqlConnectionStringBuilder
                {
                    DataSource = "192.168.1.8",
                    InitialCatalog = "GarmentCostingDB",
                    UserID = "sa",
                    Password = "1203fri",
                    Encrypt = false,
                    TrustServerCertificate = true,
                    MultipleActiveResultSets = true,
                    ApplicationName = "NewCostSheetApi"
                }.ConnectionString;
*/
                await using var connection = new SqlConnection(connectionString);
                var parameters = new DynamicParameters();
                parameters.Add("@LoginName", request.Username.Trim(), DbType.String, size: 30);
                parameters.Add("@Password", request.Password, DbType.String, size: 20);

                using var results = await connection.QueryMultipleAsync("dbo.sys_login", parameters, commandType: CommandType.StoredProcedure);

                var login = await results.ReadFirstOrDefaultAsync<LoginProcedureRow>();
                var isValid = login?.ValidationResult == true || login?.IsValid == true;
                if (!isValid)
                {
                    return Unauthorized(); // 401 Unauthorized
                }

                var role = login!.RoleRight ?? login.RoleName ?? "Viewer";
                var isAuthorized = login.IsAuthorized == true;

                // 讀取 Stages
                var stages = results.IsConsumed
                    ? new List<string>()
                    : (await results.ReadAsync<LoginStageRow>())
                        .Select(row => row.Stage ?? row.Name)
                        .Where(value => !string.IsNullOrWhiteSpace(value))
                        .Select(value => value!)
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToList();

                // 讀取 Vendors（包含您之前優化過去除空白、優先取簡稱的邏輯）
                var vendors = results.IsConsumed
                    ? new List<string>()
                    : (await results.ReadAsync<LoginVendorRow>())
                        .Select(row => row.Vendor ?? row.Company ?? row.VendorName)
                        .Where(value => !string.IsNullOrWhiteSpace(value))
                        .Select(value => value!.Trim())
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToList();

                return Ok(new LoginResult
                {
                    IsValid = true,
                    Role = role,
                    Username = login.Username ?? request.Username.Trim(), 
                    FullName = login.FullName ?? string.Empty, 
                    LoginName = request.Username.Trim(),
                    IsAuthorized = isAuthorized,
                    Stages = stages,
                    Vendors = isAuthorized ? vendors : new List<string>()
                });
            }
            catch (SqlException exception)
            {
                _logger.LogError(exception, "Database login procedure failed.");
                return StatusCode(StatusCodes.Status503ServiceUnavailable, 
                    "The database login service is unavailable. Check the API database configuration and dbo.sys_login procedure.");
            }
        }
    }

    #region 相關資料模型 (DTO / Row Models)
    // 💡 如果這些類別在專案其他地方有定義，可直接引用並刪除此處的重複定義
    public class LoginRequest
    {
        public string? Username { get; set; }
        public string? Password { get; set; }
    }

    public class LoginProcedureRow
    {
        public bool? ValidationResult { get; set; }
        public bool? IsValid { get; set; }
        public string? RoleRight { get; set; }
        public string? RoleName { get; set; }
        public bool? IsAuthorized { get; set; }
        public string? Username { get; set; }
        public string? FullName { get; set; }
    }

    public class LoginStageRow
    {
        public string? Stage { get; set; }
        public string? Name { get; set; }
    }

    public class LoginVendorRow
    {
        public string? Vendor { get; set; }
        public string? Company { get; set; }
        public string? VendorName { get; set; }
    }

    public class LoginResult
    {
        public bool IsValid { get; set; }
        public string? Role { get; set; }
        public string? Username { get; set; }
        public string? FullName { get; set; }
        public string? LoginName { get; set; }
        public bool IsAuthorized { get; set; }
        public List<string> Stages { get; set; } = new();
        public List<string> Vendors { get; set; } = new();
    }
    #endregion
}
