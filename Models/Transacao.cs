using System;

namespace DashboardFinanceiroPessoal.Models
{
    public class Transacao
    {
        public int Id { get; set; }
        public string Descricao { get; set; } = string.Empty;
        public decimal Valor { get; set; }
        public DateTime DataTransacao { get; set; }
        
        public int CategoriaId { get; set; }
        public Categoria Categoria { get; set; } = null!;

        public int UsuarioId { get; set; }
        public Usuario Usuario { get; set; } = null!;
        public int? ContaId { get; set; }
        public Conta? Conta { get; set; }
    }
}
