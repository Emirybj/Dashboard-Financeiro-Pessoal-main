namespace DashboardFinanceiroPessoal.Models;

public class Orcamento
{
    public int Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public decimal Limite { get; set; }
    public int Mes { get; set; }
    public int Ano { get; set; }
    public int CategoriaId { get; set; }
    public Categoria Categoria { get; set; } = null!;
    public int UsuarioId { get; set; }
    public Usuario Usuario { get; set; } = null!;
}
