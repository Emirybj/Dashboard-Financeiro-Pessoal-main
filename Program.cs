using Microsoft.EntityFrameworkCore;
using DashboardFinanceiroPessoal.Data;
using Microsoft.AspNetCore.Authentication.Cookies;
// PARTE DO HIRO: Ele importou a biblioteca QuestPDF para gerar os relatórios.
using QuestPDF.Infrastructure;

var builder = WebApplication.CreateBuilder(args);


QuestPDF.Settings.License = LicenseType.Community;


builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));
builder.Services.AddControllers();


builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options => {
        options.Cookie.Name = "PainelFinanceiro.Auth";
        options.Cookie.HttpOnly = true; // Impede que hackers roubem o cookie via JavaScript (XSS)
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Events.OnRedirectToLogin = context => { context.Response.StatusCode = 401; return Task.CompletedTask; };
        options.Events.OnRedirectToAccessDenied = context => { context.Response.StatusCode = 403; return Task.CompletedTask; };
    });
builder.Services.AddAuthorization();
builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();


using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
}


app.UseDefaultFiles();
app.UseStaticFiles();


app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();


app.MapFallbackToFile("login.html");

app.Run();