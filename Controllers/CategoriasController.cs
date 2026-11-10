using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DashboardFinanceiroPessoal.Data;
using DashboardFinanceiroPessoal.Models;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace DashboardFinanceiroPessoal.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    // O que faz: Trava o Controller. Só quem tem um token JWT válido (usuário logado) consegue acessar.
    // Se excluir: Qualquer pessoa descobre a URL da API e consegue ver as categorias de todo mundo.
    [Authorize]
    public class CategoriasController : ControllerBase
    {
        private readonly AppDbContext _context;

        // O que faz: Injeção de dependência. Recebe a conexão com o banco de dados que foi configurada no Program.cs.
        // Se excluir: O _context fica vazio (null). Na hora de tentar buscar algo no banco, a API dá crash (NullReferenceException).
        public CategoriasController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/categorias
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Categoria>>> GetCategorias()
        {
            // O que faz: Lê o token do usuário logado e extrai o ID numérico dele.
            // Se excluir: Não saberemos de quem é a requisição e a busca no banco vai quebrar.
            var id = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            
            // O que faz: Vai no banco e traz APENAS as categorias que pertencem a esse ID específico.
            // Se excluir o Where: Mistura tudo e um usuário consegue ver a categoria criada por outra pessoa.
            return await _context.Categorias.Where(c => c.UsuarioId == id).ToListAsync();
        }

        // POST: api/categorias
        [HttpPost]
        public async Task<ActionResult<Categoria>> PostCategoria(Categoria categoria)
        {
            // O que faz: Pega o ID de quem está logado para vincular essa categoria a ele.
            var id = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            
            // O que faz: Valida no back-end se o tipo é apenas Receita ou Despesa, e se o nome não está vazio.
            // Se excluir: O usuário (ou um bug no front-end) consegue salvar uma categoria sem nome ou com um tipo inválido no banco de dados.
            if (categoria.Tipo is not ("Receita" or "Despesa") || string.IsNullOrWhiteSpace(categoria.Nome))
                return BadRequest();
            
            // O que faz: Prepara o objeto para salvar. Força o ID a ser 0 (novo registro) e vincula ao usuário logado.
            // Se excluir a limpeza do Usuario e Transacoes: O Entity Framework pode tentar duplicar o usuário logado lá na tabela de Usuários achando que é um dado novo.
            categoria.Id = 0;
            categoria.UsuarioId = id;
            categoria.Usuario = null!;
            categoria.Transacoes = new List<Transacao>();
            
            // O que faz: Prepara o comando de INSERT e depois dispara para o SQL Server.
            // Se excluir o SaveChangesAsync: A categoria some da memória e nunca chega ao banco de dados.
            _context.Categorias.Add(categoria);
            await _context.SaveChangesAsync();

            // O que faz: Retorna o status 201 (Sucesso na criação) para o front-end, devolvendo a categoria com o ID que o banco gerou.
            // Se excluir: O Front-end do R-Schmidt-dev trava sem saber se a categoria foi realmente salva.
            return CreatedAtAction(nameof(GetCategorias), new { id = categoria.Id }, categoria);
        }
    }
}