using System;
using System.Collections.Generic;

namespace DashboardFinanceiroPessoal.Models
{
    public class Usuario
    {
        public int Id { get; set; }
        public string Nome { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string SenhaHash { get; set; } = string.Empty;
        public DateTime DataCriacao { get; set; } = DateTime.Now;
        public string Moeda { get; set; } = "BRL";
        public bool PlanoSelecionado { get; set; }

        public ICollection<Categoria> Categorias { get; set; } = new List<Categoria>();
        public ICollection<Transacao> Transacoes { get; set; } = new List<Transacao>();
    }
}
