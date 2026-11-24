using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using System;

namespace NewCostSheet.Api.Services;

public static class UtilityService
{
    /// <summary>
    /// 從 Configuration 中建構資料庫連線字串的擴充方法
    /// </summary>
    public static string BuildConnectionString(this IConfiguration configuration, string sectionName = "Database")
    {
        var databaseConfig = configuration.GetSection(sectionName);
        
        return new SqlConnectionStringBuilder
        {
            DataSource = databaseConfig["Server"] ?? throw new InvalidOperationException("Database:Server is required."),
            InitialCatalog = databaseConfig["Name"] ?? throw new InvalidOperationException("Database:Name is required."),
            UserID = databaseConfig["User"] ?? throw new InvalidOperationException("Database:User is required."),
            Password = configuration["DB_PASSWORD"] ?? string.Empty,
            Encrypt = false,
            TrustServerCertificate = true,
            MultipleActiveResultSets = true,
            ApplicationName = "NewCostSheetApi"
        }.ConnectionString;
    }
}

/*
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
*/