namespace DashboardFinanceiroPessoal.Models;

public class Meta
{
    public int Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public decimal ValorObjetivo { get; set; }
    public DateTime Prazo { get; set; }
    public DateTime? ExcluidaEm { get; set; }
    public int UsuarioId { get; set; }
    public Usuario Usuario { get; set; } = null!;
    public ICollection<DepositoMeta> Depositos { get; set; } = new List<DepositoMeta>();
}

public class DepositoMeta
{
    public int Id { get; set; }
    public decimal Valor { get; set; }
    public DateTime Data { get; set; }
    public string Observacao { get; set; } = string.Empty;
    public int MetaId { get; set; }
    public Meta Meta { get; set; } = null!;
    public int ContaId { get; set; }
    public Conta Conta { get; set; } = null!;
}
