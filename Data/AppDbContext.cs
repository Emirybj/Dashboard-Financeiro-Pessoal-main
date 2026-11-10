using Microsoft.EntityFrameworkCore;
using DashboardFinanceiroPessoal.Models;

namespace DashboardFinanceiroPessoal.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext() { }

        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<Usuario> Usuarios { get; set; }
        public DbSet<Categoria> Categorias { get; set; }
        public DbSet<Transacao> Transacoes { get; set; }
        public DbSet<Conta> Contas { get; set; }
        public DbSet<Orcamento> Orcamentos { get; set; }
        public DbSet<Meta> Metas { get; set; }
        public DbSet<DepositoMeta> DepositosMeta { get; set; }

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            if (!optionsBuilder.IsConfigured)
            {
                optionsBuilder.UseSqlServer("Server=(localdb)\\mssqllocaldb;Database=PainelFinanceiroDb;Trusted_Connection=True;MultipleActiveResultSets=true");
            }
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Transacao>()
                .Property(t => t.Valor)
                .HasColumnType("decimal(18,2)");

            modelBuilder.Entity<Transacao>()
                .HasOne(t => t.Categoria)
                .WithMany(c => c.Transacoes)
                .HasForeignKey(t => t.CategoriaId)
                .OnDelete(DeleteBehavior.NoAction);
            modelBuilder.Entity<Transacao>().HasOne(t => t.Conta).WithMany()
                .HasForeignKey(t => t.ContaId).OnDelete(DeleteBehavior.NoAction);
            modelBuilder.Entity<Conta>().Property(c => c.SaldoInicial).HasColumnType("decimal(18,2)");
            modelBuilder.Entity<Orcamento>().Property(o => o.Limite).HasColumnType("decimal(18,2)");
            modelBuilder.Entity<Orcamento>().HasOne(o => o.Categoria).WithMany()
                .HasForeignKey(o => o.CategoriaId).OnDelete(DeleteBehavior.NoAction);
            modelBuilder.Entity<Meta>().Property(m => m.ValorObjetivo).HasColumnType("decimal(18,2)");
            modelBuilder.Entity<DepositoMeta>().Property(d => d.Valor).HasColumnType("decimal(18,2)");
            modelBuilder.Entity<DepositoMeta>().HasOne(d => d.Conta).WithMany()
                .HasForeignKey(d => d.ContaId).OnDelete(DeleteBehavior.NoAction);
        }
    }
}
