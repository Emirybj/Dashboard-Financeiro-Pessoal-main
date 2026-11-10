using Microsoft.EntityFrameworkCore;
using DashboardFinanceiroPessoal.Data;
using Microsoft.AspNetCore.Authentication.Cookies;
// PARTE DO HIRO: Ele importou a biblioteca QuestPDF para gerar os relatórios.
using QuestPDF.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

// PARTE DO HIRO: Configuração de licença gratuita para a biblioteca de relatórios em PDF funcionar.
QuestPDF.Settings.License = LicenseType.Community;

// =======================================================
// MINHA PARTE: CONEXÃO COM O BANCO DE DADOS (INJEÇÃO DE DEPENDÊNCIA)
// =======================================================
// O que faz: Avisa ao projeto que vamos usar o Entity Framework com o SQL Server. 
// Ele pega a "ConnectionString" (texto de conexão com senha e endereço do banco) das configurações e injeta no meu AppDbContext.
// Se excluir: Toda a API fica cega. Os Controllers não vão conseguir falar com o banco de dados e darão erro (NullReference ou de injeção).
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddControllers();

// =======================================================
// MINHA PARTE: CONFIGURAÇÃO DE SEGURANÇA E COOKIES
// =======================================================
// O que faz: Configura o sistema de autenticação para usar Cookies. Defini o nome do cookie de login, a segurança (HttpOnly) e as regras de erro (401 Não Autorizado / 403 Sem Permissão) para caso alguém tente acessar sem login.
// Se excluir: O `[Authorize]` que coloquei nos Controllers vai quebrar porque o sistema não vai saber COMO ler o login do usuário.
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

// =======================================================
// MINHA PARTE: AUTO-MIGRATION DO BANCO DE DADOS
// =======================================================
// O que faz: Assim que a API liga, esse bloco entra no AppDbContext e roda as migrations automaticamente (o MigrateAsync).
// Se excluir: Se o banco de dados não existir ou estiver desatualizado, ele não vai ser criado sozinho. Teríamos que rodar os comandos de 'update-database' manualmente no terminal do VS Code toda vez.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
}

// =======================================================
// INTEGRAÇÃO DE EQUIPE (FRONT-END)
// =======================================================
// O que faz: Permite que a nossa API em C# sirva arquivos estáticos (HTML, CSS e JS que o Schmidt criou na pasta wwwroot).
// Se excluir: A API vai funcionar por trás dos panos, mas ao acessar pelo navegador, só veremos texto puro ou erro 404, sem carregar interface nenhuma.
app.UseDefaultFiles();
app.UseStaticFiles();

// O que faz: Ativa os "seguranças" na porta da API (middlewares). Exige que as requisições passem pela autenticação.
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// O que faz: Se o usuário acessar uma rota que não existe no back-end, manda ele de volta para a tela de login (fallback).
app.MapFallbackToFile("login.html");

app.Run();