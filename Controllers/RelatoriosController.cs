using System.Globalization;
using System.Security.Claims;
using DashboardFinanceiroPessoal.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace DashboardFinanceiroPessoal.Controllers;

[Authorize]
[ApiController]
[Route("api/financeiro/relatorios")]
public sealed class RelatoriosController(AppDbContext db) : ControllerBase
{
    private static readonly CultureInfo PtBr = CultureInfo.GetCultureInfo("pt-BR");
    private static string Moeda(decimal valor) => valor.ToString("C", PtBr);

    [HttpGet("pdf")]
    public async Task<IActionResult> Pdf([FromQuery] int ano, [FromQuery] int mes)
    {
        if (ano is < 2000 or > 2100 || mes is < 1 or > 12)
            return BadRequest(new { message = "Mês inválido." });

        var usuarioId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var usuario = await db.Usuarios.Where(u => u.Id == usuarioId)
            .Select(u => new { u.Nome }).SingleAsync();
        var inicio = new DateTime(ano, mes, 1);
        var fim = inicio.AddMonths(1);
        var transacoes = await db.Transacoes
            .Where(t => t.UsuarioId == usuarioId && t.DataTransacao >= inicio && t.DataTransacao < fim)
            .OrderBy(t => t.DataTransacao).ThenBy(t => t.Id)
            .Select(t => new
            {
                t.Id, t.DataTransacao, t.Descricao, t.Valor,
                Categoria = t.Categoria.Nome, Tipo = t.Categoria.Tipo,
                Conta = t.Conta == null ? "—" : t.Conta.Nome
            }).ToListAsync();
        var reservas = await db.DepositosMeta
            .Where(d => d.Meta.UsuarioId == usuarioId && d.Data >= inicio && d.Data < fim)
            .Select(d => new { d.Id, d.MetaId, Meta = d.Meta.Nome, d.Data, d.Valor,
                Conta = d.Conta.Nome, d.Observacao }).ToListAsync();
        var movimentos = transacoes.Select(t => new Movimento(t.Id, t.DataTransacao, t.Descricao,
                t.Categoria, t.Conta, t.Tipo, t.Tipo == "Receita" ? t.Valor : -t.Valor, "", false))
            .Concat(reservas.Select(d => new Movimento(d.Id, d.Data,
                d.Observacao.Contains("excluir a meta") ? $"Reserva liberada - {d.Meta}"
                    : d.Valor > 0 ? $"Guardado na meta - {d.Meta}" : $"Retirado da meta - {d.Meta}",
                "Meta", d.Conta, d.Valor > 0 ? "Reserva" : "Liberação", -d.Valor, d.Observacao, true)))
            .OrderByDescending(m => m.Data).ThenByDescending(m => m.Meta).ThenByDescending(m => m.Id).ToList();
        var metas = reservas.GroupBy(d => new { d.MetaId, d.Meta })
            .Select(g => new { Nome = g.Key.Meta, Depositos = g.Where(d => d.Valor > 0).Sum(d => d.Valor),
                Liberacoes = -g.Where(d => d.Valor < 0).Sum(d => d.Valor), Liquido = g.Sum(d => d.Valor) })
            .OrderBy(m => m.Nome).ToList();

        var receitas = transacoes.Where(t => t.Tipo == "Receita").Sum(t => t.Valor);
        var despesas = transacoes.Where(t => t.Tipo == "Despesa").Sum(t => t.Valor);
        var destinadoMetas = reservas.Sum(d => d.Valor);
        var saldoInicial = await db.Contas.Where(c => c.UsuarioId == usuarioId)
            .SumAsync(c => (decimal?)c.SaldoInicial) ?? 0;
        var saldoMovimentos = await db.Transacoes.Where(t => t.UsuarioId == usuarioId && t.DataTransacao < fim)
            .SumAsync(t => (decimal?)(t.Categoria.Tipo == "Receita" ? t.Valor : -t.Valor)) ?? 0;
        var reservadoAteFim = await db.DepositosMeta.Where(d => d.Meta.UsuarioId == usuarioId && d.Data < fim)
            .SumAsync(d => (decimal?)d.Valor) ?? 0;
        var categorias = transacoes.Where(t => t.Tipo == "Despesa")
            .GroupBy(t => t.Categoria).Select(g => new { Nome = g.Key, Valor = g.Sum(t => t.Valor) })
            .OrderByDescending(g => g.Valor).ToList();
        var periodo = inicio.ToString("MMMM 'de' yyyy", PtBr);

        var documento = Document.Create(container => container.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(1.7f, Unit.Centimetre);
            page.DefaultTextStyle(style => style.FontSize(9).FontColor("#26372D"));
            page.Header().Column(header =>
            {
                header.Item().Text("Relatório financeiro").SemiBold().FontSize(20).FontColor("#06432F");
                header.Item().PaddingTop(4).Text($"{usuario.Nome}  -  {periodo}").FontColor("#66796E");
                header.Item().PaddingTop(8).LineHorizontal(1).LineColor("#D9E6DD");
            });
            page.Content().PaddingVertical(16).Column(col =>
            {
                col.Spacing(18);
                col.Item().Row(row =>
                {
                    row.RelativeItem().Text($"Receitas\n{Moeda(receitas)}").SemiBold().FontSize(11).FontColor("#2E805F");
                    row.RelativeItem().Text($"Despesas\n{Moeda(despesas)}").SemiBold().FontSize(11).FontColor("#B34848");
                    row.RelativeItem().Text($"Destinado às metas\n{Moeda(destinadoMetas)}").SemiBold().FontSize(11);
                });
                col.Item().Background("#E8F2EC").Padding(10).Column(summary =>
                {
                    summary.Item().Text($"Resultado do mês após metas: {Moeda(receitas - despesas - destinadoMetas)}").SemiBold().FontSize(11);
                    summary.Item().PaddingTop(4).Text($"Saldo disponível até {fim.AddDays(-1):dd/MM/yyyy}: {Moeda(saldoInicial + saldoMovimentos - reservadoAteFim)}");
                    summary.Item().PaddingTop(4).Text("Reservas reduzem o disponível; retiradas e liberações devolvem o valor à conta.").FontSize(8).FontColor("#66796E");
                });
                col.Item().Column(section =>
                {
                    section.Item().Text("Despesas por categoria").SemiBold().FontSize(12).FontColor("#06432F");
                    if (categorias.Count == 0)
                        section.Item().PaddingTop(7).Text("Nenhuma despesa registrada neste mês.");
                    foreach (var categoria in categorias)
                        section.Item().PaddingTop(6).Row(row =>
                        {
                            row.RelativeItem().Text(categoria.Nome);
                            row.AutoItem().Text(Moeda(categoria.Valor));
                        });
                });
                col.Item().Column(section =>
                {
                    section.Item().Text("Metas no mês").SemiBold().FontSize(12).FontColor("#06432F");
                    if (metas.Count == 0)
                        section.Item().PaddingTop(7).Text("Nenhuma movimentação de meta neste mês.");
                    foreach (var meta in metas)
                        section.Item().PaddingTop(7).Column(item =>
                        {
                            item.Item().Text(meta.Nome).SemiBold();
                            item.Item().PaddingTop(3).Text($"Guardado: {Moeda(meta.Depositos)}  |  Liberado: {Moeda(meta.Liberacoes)}  |  Líquido: {Moeda(meta.Liquido)}");
                        });
                });
                col.Item().Column(section =>
                {
                    section.Item().Text($"Histórico de movimentações ({movimentos.Count})").SemiBold().FontSize(12).FontColor("#06432F");
                    if (movimentos.Count == 0)
                    {
                        section.Item().PaddingTop(7).Text("Nenhuma movimentação registrada neste mês.");
                        return;
                    }
                    section.Item().PaddingTop(8).Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.ConstantColumn(64);
                            columns.RelativeColumn(2.6f);
                            columns.RelativeColumn(1);
                            columns.RelativeColumn(1.2f);
                            columns.ConstantColumn(48);
                            columns.ConstantColumn(67);
                        });
                        table.Header(header =>
                        {
                            foreach (var titulo in new[] { "Data", "Descrição", "Categoria", "Conta", "Tipo", "Valor" })
                                header.Cell().Background("#E8F2EC").Padding(5).Text(titulo).SemiBold();
                        });
                        foreach (var item in movimentos)
                        {
                            table.Cell().BorderBottom(0.5f).BorderColor("#E4E9E5").Padding(5).Text(item.Data.ToString("dd/MM/yyyy", PtBr)).FontSize(8);
                            table.Cell().BorderBottom(0.5f).BorderColor("#E4E9E5").Padding(5).Column(description =>
                            {
                                description.Item().Text(item.Descricao);
                                if (!string.IsNullOrWhiteSpace(item.Observacao))
                                    description.Item().PaddingTop(3).Text(item.Observacao).FontSize(8).FontColor("#66796E");
                            });
                            foreach (var valor in new[] { item.Categoria, item.Conta, item.Tipo,
                                (item.Valor < 0 ? "-" : "+") + Moeda(Math.Abs(item.Valor)) })
                                table.Cell().BorderBottom(0.5f).BorderColor("#E4E9E5").Padding(5).Text(valor);
                        }
                    });
                });
            });
            page.Footer().AlignRight().Text(text =>
            {
                text.Span("Página ");
                text.CurrentPageNumber();
            });
        }));

        return File(documento.GeneratePdf(), "application/pdf", $"relatorio-{ano:D4}-{mes:D2}.pdf");
    }

    private sealed record Movimento(int Id, DateTime Data, string Descricao, string Categoria,
        string Conta, string Tipo, decimal Valor, string Observacao, bool Meta);
}
