namespace DashboardFinanceiroPessoal.Models;

public class Conta
{
    public int Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string Instituicao { get; set; } = string.Empty;
    public string Tipo { get; set; } = string.Empty;
    public decimal SaldoInicial { get; set; }
    public int UsuarioId { get; set; }
    public Usuario Usuario { get; set; } = null!;
}
