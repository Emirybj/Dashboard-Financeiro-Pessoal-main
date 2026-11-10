using System.ComponentModel.DataAnnotations;
using System.Data;
using System.Security.Claims;
using DashboardFinanceiroPessoal.Data;
using DashboardFinanceiroPessoal.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DashboardFinanceiroPessoal.Controllers;

[Authorize]
[ApiController]
[Route("api/financeiro")]
public sealed class FinanceiroController(AppDbContext db) : ControllerBase
{
    private int UsuarioId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("categorias")]
    public async Task<IActionResult> Categorias() => Ok(await db.Categorias
        .Where(c => c.UsuarioId == UsuarioId).OrderBy(c => c.Nome)
        .Select(c => new { c.Id, c.Nome, c.Tipo }).ToListAsync());

    [HttpPost("categorias")]
    public async Task<IActionResult> CriarCategoria(CategoriaInput input)
    {
        if (input.Tipo is not ("Receita" or "Despesa")) return BadRequest(new { message = "Tipo inválido." });
        if (string.IsNullOrWhiteSpace(input.Nome)) return BadRequest(new { message = "Informe o nome da categoria." });
        var nome = input.Nome.Trim();
        if (await db.Categorias.AnyAsync(c => c.UsuarioId == UsuarioId && c.Nome == nome && c.Tipo == input.Tipo))
            return Conflict(new { message = "Esta categoria já existe." });
        var categoria = new Categoria { Nome = nome, Tipo = input.Tipo, UsuarioId = UsuarioId };
        db.Categorias.Add(categoria);
        await db.SaveChangesAsync();
        return Ok(new { categoria.Id, categoria.Nome, categoria.Tipo });
    }

    [HttpPut("categorias/{id:int}")]
    public async Task<IActionResult> EditarCategoria(int id, CategoriaInput input)
    {
        var categoria = await db.Categorias.SingleOrDefaultAsync(c => c.Id == id && c.UsuarioId == UsuarioId);
        if (categoria is null) return NotFound();
        if (input.Tipo is not ("Receita" or "Despesa")) return BadRequest(new { message = "Tipo inválido." });
        if (string.IsNullOrWhiteSpace(input.Nome)) return BadRequest(new { message = "Informe o nome da categoria." });
        var nome = input.Nome.Trim();
        if (await db.Categorias.AnyAsync(c => c.Id != id && c.UsuarioId == UsuarioId && c.Nome == nome && c.Tipo == input.Tipo))
            return Conflict(new { message = "Esta categoria já existe." });
        if (categoria.Tipo != input.Tipo && (await db.Transacoes.AnyAsync(t => t.CategoriaId == id)
            || await db.Orcamentos.AnyAsync(o => o.CategoriaId == id)))
            return Conflict(new { message = "Uma categoria em uso não pode mudar de tipo. Você pode alterar o nome." });
        categoria.Nome = nome;
        categoria.Tipo = input.Tipo;
        await db.SaveChangesAsync();
        return Ok(new { categoria.Id, categoria.Nome, categoria.Tipo });
    }

    [HttpDelete("categorias/{id:int}")]
    public async Task<IActionResult> ExcluirCategoria(int id)
    {
        var categoria = await db.Categorias.SingleOrDefaultAsync(c => c.Id == id && c.UsuarioId == UsuarioId);
        if (categoria is null) return NotFound();
        if (await db.Transacoes.AnyAsync(t => t.CategoriaId == id) || await db.Orcamentos.AnyAsync(o => o.CategoriaId == id))
            return Conflict(new { message = "Esta categoria está em uso por transações ou orçamentos. Remova esses vínculos antes de excluí-la." });
        db.Categorias.Remove(categoria);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("contas")]
    public async Task<IActionResult> Contas()
    {
        var contas = await db.Contas.Where(c => c.UsuarioId == UsuarioId).OrderBy(c => c.Nome)
            .Select(c => new { c.Id, c.Nome, c.Instituicao, c.Tipo, c.SaldoInicial }).ToListAsync();
        var movimentos = await db.Transacoes.Where(t => t.UsuarioId == UsuarioId && t.ContaId != null)
            .Select(t => new { t.ContaId, t.Valor, Tipo = t.Categoria.Tipo }).ToListAsync();
        var reservas = await db.DepositosMeta.Where(d => d.Meta.UsuarioId == UsuarioId)
            .GroupBy(d => d.ContaId).Select(g => new { ContaId = g.Key, Valor = g.Sum(d => d.Valor) })
            .ToListAsync();
        return Ok(contas.Select(c =>
        {
            var saldo = c.SaldoInicial + movimentos.Where(m => m.ContaId == c.Id)
                .Sum(m => m.Tipo == "Receita" ? m.Valor : -m.Valor);
            var reservado = reservas.FirstOrDefault(r => r.ContaId == c.Id)?.Valor ?? 0;
            return new { c.Id, c.Nome, c.Instituicao, c.Tipo,
                Saldo = saldo, Reservado = reservado, Disponivel = saldo - reservado };
        }));
    }

    [HttpPost("contas")]
    public async Task<IActionResult> CriarConta(ContaInput input)
    {
        if (input.Tipo is not ("Corrente" or "Poupança" or "Carteira" or "Outro"))
            return BadRequest(new { message = "Tipo de conta inválido." });
        var conta = new Conta { Nome = input.Nome.Trim(), Instituicao = input.Instituicao.Trim(),
            Tipo = input.Tipo, SaldoInicial = input.SaldoInicial, UsuarioId = UsuarioId };
        db.Contas.Add(conta);
        await db.SaveChangesAsync();
        return Ok(new { conta.Id, conta.Nome, conta.Instituicao, conta.Tipo,
            Saldo = conta.SaldoInicial, Reservado = 0, Disponivel = conta.SaldoInicial });
    }

    [HttpGet("transacoes")]
    public async Task<IActionResult> Transacoes() => Ok(await db.Transacoes
        .Where(t => t.UsuarioId == UsuarioId).OrderByDescending(t => t.DataTransacao).ThenByDescending(t => t.Id)
        .Select(t => new { t.Id, t.Descricao, t.Valor, t.DataTransacao, t.CategoriaId,
            Categoria = t.Categoria.Nome, Tipo = t.Categoria.Tipo, t.ContaId,
            Conta = t.Conta == null ? null : t.Conta.Nome }).ToListAsync());

    [HttpPost("transacoes")]
    public async Task<IActionResult> CriarTransacao(TransacaoInput input)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var categoria = await db.Categorias.SingleOrDefaultAsync(c => c.Id == input.CategoriaId && c.UsuarioId == UsuarioId);
        if (categoria is null)
            return BadRequest(new { message = "Selecione uma categoria da sua conta." });
        var conta = await db.Contas.SingleOrDefaultAsync(c => c.Id == input.ContaId && c.UsuarioId == UsuarioId);
        if (conta is null)
            return BadRequest(new { message = "Selecione uma conta válida." });
        if (categoria.Tipo == "Despesa")
        {
            var movimentos = await db.Transacoes.Where(t => t.UsuarioId == UsuarioId && t.ContaId == input.ContaId)
                .Select(t => new { t.Valor, Tipo = t.Categoria.Tipo }).ToListAsync();
            var reservado = await db.DepositosMeta.Where(d => d.ContaId == input.ContaId && d.Meta.UsuarioId == UsuarioId)
                .SumAsync(d => (decimal?)d.Valor) ?? 0;
            var disponivel = conta.SaldoInicial + movimentos.Sum(m => m.Tipo == "Receita" ? m.Valor : -m.Valor) - reservado;
            if (input.Valor > disponivel)
                return BadRequest(new { message = "A despesa excede o saldo disponível. Retire uma reserva da meta ou escolha outra conta." });
        }
        var transacao = new Transacao { Descricao = input.Descricao.Trim(), Valor = input.Valor,
            DataTransacao = input.DataTransacao.Date, CategoriaId = input.CategoriaId,
            ContaId = input.ContaId, UsuarioId = UsuarioId };
        db.Transacoes.Add(transacao);
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return Ok(new { transacao.Id });
    }

    [HttpPut("transacoes/{id:int}")]
    public async Task<IActionResult> EditarTransacao(int id, TransacaoInput input)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var item = await db.Transacoes.Include(t => t.Categoria)
            .SingleOrDefaultAsync(t => t.Id == id && t.UsuarioId == UsuarioId);
        if (item is null) return NotFound();
        var categoria = await db.Categorias.SingleOrDefaultAsync(c => c.Id == input.CategoriaId && c.UsuarioId == UsuarioId);
        if (categoria is null) return BadRequest(new { message = "Selecione uma categoria da sua conta." });
        if (!await db.Contas.AnyAsync(c => c.Id == input.ContaId && c.UsuarioId == UsuarioId))
            return BadRequest(new { message = "Selecione uma conta válida." });
        var oldEffect = item.Categoria.Tipo == "Receita" ? item.Valor : -item.Valor;
        var newEffect = categoria.Tipo == "Receita" ? input.Valor : -input.Valor;
        foreach (var contaId in new[] { item.ContaId, (int?)input.ContaId }.Where(x => x.HasValue).Distinct())
        {
            var disponivel = await SaldoDisponivel(contaId!.Value);
            var resultado = disponivel - (item.ContaId == contaId ? oldEffect : 0)
                + (input.ContaId == contaId ? newEffect : 0);
            if (resultado < 0)
                return Conflict(new { message = "A alteração deixaria uma conta com saldo disponível negativo. Ajuste o valor ou as reservas em metas." });
        }
        item.Descricao = input.Descricao.Trim();
        item.Valor = input.Valor;
        item.DataTransacao = input.DataTransacao.Date;
        item.CategoriaId = input.CategoriaId;
        item.ContaId = input.ContaId;
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return NoContent();
    }

    [HttpDelete("transacoes/{id:int}")]
    public async Task<IActionResult> ExcluirTransacao(int id)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var item = await db.Transacoes.Include(t => t.Categoria)
            .SingleOrDefaultAsync(t => t.Id == id && t.UsuarioId == UsuarioId);
        if (item is null) return NotFound();
        if (item.ContaId is int contaId)
        {
            var effect = item.Categoria.Tipo == "Receita" ? item.Valor : -item.Valor;
            if (await SaldoDisponivel(contaId) - effect < 0)
                return Conflict(new { message = "Excluir esta receita deixaria a conta com saldo disponível negativo. Ajuste as despesas ou reservas primeiro." });
        }
        db.Transacoes.Remove(item);
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return NoContent();
    }

    private async Task<decimal> SaldoDisponivel(int contaId)
    {
        var inicial = await db.Contas.Where(c => c.Id == contaId && c.UsuarioId == UsuarioId)
            .Select(c => c.SaldoInicial).SingleAsync();
        var movimentos = await db.Transacoes.Where(t => t.ContaId == contaId && t.UsuarioId == UsuarioId)
            .Select(t => new { t.Valor, Tipo = t.Categoria.Tipo }).ToListAsync();
        var reservado = await db.DepositosMeta.Where(d => d.ContaId == contaId && d.Meta.UsuarioId == UsuarioId)
            .SumAsync(d => (decimal?)d.Valor) ?? 0;
        return inicial + movimentos.Sum(m => m.Tipo == "Receita" ? m.Valor : -m.Valor) - reservado;
    }

    [HttpGet("orcamentos")]
    public async Task<IActionResult> Orcamentos([FromQuery] int? ano, [FromQuery] int? mes)
    {
        var a = ano ?? DateTime.Today.Year;
        var m = mes ?? DateTime.Today.Month;
        if (m < 1 || m > 12 || a < 2000 || a > 2100) return BadRequest(new { message = "Mês inválido." });
        var itens = await db.Orcamentos.Where(o => o.UsuarioId == UsuarioId && o.Ano == a && o.Mes == m)
            .Select(o => new { o.Id, o.Nome, o.Limite, o.CategoriaId, Categoria = o.Categoria.Nome }).ToListAsync();
        var inicio = new DateTime(a, m, 1);
        var gastos = await db.Transacoes.Where(t => t.UsuarioId == UsuarioId && t.DataTransacao >= inicio
            && t.DataTransacao < inicio.AddMonths(1) && t.Categoria.Tipo == "Despesa")
            .GroupBy(t => t.CategoriaId).Select(g => new { CategoriaId = g.Key, Valor = g.Sum(t => t.Valor) }).ToListAsync();
        return Ok(itens.Select(o => new { o.Id, o.Nome, o.Limite, o.CategoriaId, o.Categoria,
            Gasto = gastos.FirstOrDefault(g => g.CategoriaId == o.CategoriaId)?.Valor ?? 0 }));
    }

    [HttpPost("orcamentos")]
    public async Task<IActionResult> CriarOrcamento(OrcamentoInput input)
    {
        if (!await db.Categorias.AnyAsync(c => c.Id == input.CategoriaId && c.UsuarioId == UsuarioId && c.Tipo == "Despesa"))
            return BadRequest(new { message = "Selecione uma categoria de despesa." });
        if (await db.Orcamentos.AnyAsync(o => o.UsuarioId == UsuarioId && o.CategoriaId == input.CategoriaId
            && o.Ano == input.Ano && o.Mes == input.Mes))
            return Conflict(new { message = "Já existe orçamento para esta categoria neste mês." });
        var item = new Orcamento { Nome = input.Nome.Trim(), Limite = input.Limite, Mes = input.Mes,
            Ano = input.Ano, CategoriaId = input.CategoriaId, UsuarioId = UsuarioId };
        db.Orcamentos.Add(item);
        await db.SaveChangesAsync();
        return Ok(new { item.Id });
    }

    [HttpGet("metas")]
    public async Task<IActionResult> Metas()
    {
        var metas = await db.Metas.Where(m => m.UsuarioId == UsuarioId && m.ExcluidaEm == null)
            .OrderBy(m => m.Prazo).Select(m => new { m.Id, m.Nome, m.ValorObjetivo, m.Prazo,
                Guardado = m.Depositos.Sum(d => (decimal?)d.Valor) ?? 0 }).ToListAsync();
        var reservas = await db.DepositosMeta.Where(d => d.Meta.UsuarioId == UsuarioId)
            .GroupBy(d => new { d.MetaId, d.ContaId, Conta = d.Conta.Nome })
            .Select(g => new { g.Key.MetaId, g.Key.ContaId, g.Key.Conta, Valor = g.Sum(d => d.Valor) })
            .ToListAsync();
        return Ok(metas.Select(m => new { m.Id, m.Nome, m.ValorObjetivo, m.Prazo, m.Guardado,
            Reservas = reservas.Where(r => r.MetaId == m.Id && r.Valor > 0)
                .Select(r => new { r.ContaId, r.Conta, r.Valor }) }));
    }

    [HttpPost("metas")]
    public async Task<IActionResult> CriarMeta(MetaInput input)
    {
        var meta = new Meta { Nome = input.Nome.Trim(), ValorObjetivo = input.ValorObjetivo,
            Prazo = input.Prazo.Date, UsuarioId = UsuarioId };
        db.Metas.Add(meta);
        await db.SaveChangesAsync();
        return Ok(new { meta.Id });
    }

    [HttpGet("movimentacoes-metas")]
    public async Task<IActionResult> MovimentacoesMetas() => Ok(await db.DepositosMeta
        .Where(d => d.Meta.UsuarioId == UsuarioId)
        .OrderByDescending(d => d.Data).ThenByDescending(d => d.Id)
        .Select(d => new { d.Id, d.MetaId, Meta = d.Meta.Nome, d.ContaId,
            Conta = d.Conta.Nome, d.Valor, d.Data, d.Observacao }).ToListAsync());

    [HttpDelete("metas/{id:int}")]
    public async Task<IActionResult> ExcluirMeta(int id)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var meta = await db.Metas.SingleOrDefaultAsync(m => m.Id == id && m.UsuarioId == UsuarioId && m.ExcluidaEm == null);
        if (meta is null) return NotFound();
        var reservas = await db.DepositosMeta.Where(d => d.MetaId == id)
            .GroupBy(d => d.ContaId).Select(g => new { ContaId = g.Key, Valor = g.Sum(d => d.Valor) })
            .ToListAsync();
        foreach (var reserva in reservas.Where(r => r.Valor > 0))
            db.DepositosMeta.Add(new DepositoMeta { MetaId = id, ContaId = reserva.ContaId,
                Valor = -reserva.Valor, Data = DateTime.Today,
                Observacao = "Reserva liberada ao excluir a meta." });
        meta.ExcluidaEm = DateTime.UtcNow;
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return NoContent();
    }

    [HttpPost("metas/{id:int}/depositos")]
    public async Task<IActionResult> Depositar(int id, DepositoInput input)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var meta = await db.Metas.Where(m => m.Id == id && m.UsuarioId == UsuarioId && m.ExcluidaEm == null)
            .Select(m => new { m.ValorObjetivo, Guardado = m.Depositos.Sum(d => (decimal?)d.Valor) ?? 0 })
            .SingleOrDefaultAsync();
        if (meta is null) return NotFound();
        if (input.Valor > meta.ValorObjetivo - meta.Guardado)
            return BadRequest(new { message = "O valor excede o que falta para concluir a meta." });

        var conta = await db.Contas.SingleOrDefaultAsync(c => c.Id == input.ContaId && c.UsuarioId == UsuarioId);
        if (conta is null) return BadRequest(new { message = "Selecione uma conta válida." });
        var movimentos = await db.Transacoes.Where(t => t.UsuarioId == UsuarioId && t.ContaId == input.ContaId)
            .Select(t => new { t.Valor, Tipo = t.Categoria.Tipo }).ToListAsync();
        var reservado = await db.DepositosMeta.Where(d => d.ContaId == input.ContaId && d.Meta.UsuarioId == UsuarioId)
            .SumAsync(d => (decimal?)d.Valor) ?? 0;
        var saldo = conta.SaldoInicial + movimentos.Sum(m => m.Tipo == "Receita" ? m.Valor : -m.Valor);
        if (input.Valor > saldo - reservado)
            return BadRequest(new { message = "O valor excede o saldo disponível dessa conta." });

        var deposito = new DepositoMeta { MetaId = id, ContaId = input.ContaId,
            Valor = input.Valor, Data = input.Data.Date,
            Observacao = input.Observacao?.Trim() ?? string.Empty };
        db.DepositosMeta.Add(deposito);
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return Ok(new { deposito.Id });
    }

    [HttpPost("metas/{id:int}/retiradas")]
    public async Task<IActionResult> Retirar(int id, DepositoInput input)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        if (!await db.Metas.AnyAsync(m => m.Id == id && m.UsuarioId == UsuarioId && m.ExcluidaEm == null)) return NotFound();
        if (!await db.Contas.AnyAsync(c => c.Id == input.ContaId && c.UsuarioId == UsuarioId))
            return BadRequest(new { message = "Selecione uma conta válida." });
        var reservado = await db.DepositosMeta.Where(d => d.MetaId == id && d.ContaId == input.ContaId)
            .SumAsync(d => (decimal?)d.Valor) ?? 0;
        if (input.Valor > reservado)
            return BadRequest(new { message = "O valor excede a reserva dessa meta nessa conta." });
        var retirada = new DepositoMeta { MetaId = id, ContaId = input.ContaId,
            Valor = -input.Valor, Data = input.Data.Date,
            Observacao = input.Observacao?.Trim() ?? string.Empty };
        db.DepositosMeta.Add(retirada);
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return Ok(new { retirada.Id });
    }
}

public sealed class CategoriaInput
{
    [Required, StringLength(80)] public string Nome { get; init; } = string.Empty;
    [Required] public string Tipo { get; init; } = string.Empty;
}
public sealed class ContaInput
{
    [Required, StringLength(100)] public string Nome { get; init; } = string.Empty;
    [StringLength(100)] public string Instituicao { get; init; } = string.Empty;
    [Required] public string Tipo { get; init; } = string.Empty;
    public decimal SaldoInicial { get; init; }
}
public sealed class TransacaoInput
{
    [Required, StringLength(180)] public string Descricao { get; init; } = string.Empty;
    [Range(0.01, 999999999)] public decimal Valor { get; init; }
    [Range(1, int.MaxValue)] public int CategoriaId { get; init; }
    [Range(1, int.MaxValue)] public int ContaId { get; init; }
    [Required] public DateTime DataTransacao { get; init; }
}
public sealed class OrcamentoInput
{
    [Required, StringLength(100)] public string Nome { get; init; } = string.Empty;
    [Range(0.01, 999999999)] public decimal Limite { get; init; }
    [Range(1, 12)] public int Mes { get; init; }
    [Range(2000, 2100)] public int Ano { get; init; }
    [Range(1, int.MaxValue)] public int CategoriaId { get; init; }
}
public sealed class MetaInput
{
    [Required, StringLength(100)] public string Nome { get; init; } = string.Empty;
    [Range(0.01, 999999999)] public decimal ValorObjetivo { get; init; }
    [Required] public DateTime Prazo { get; init; }
}
public sealed class DepositoInput
{
    [Range(0.01, 999999999)] public decimal Valor { get; init; }
    [Range(1, int.MaxValue)] public int ContaId { get; init; }
    [Required] public DateTime Data { get; init; }
    [StringLength(300)] public string? Observacao { get; init; }
}
