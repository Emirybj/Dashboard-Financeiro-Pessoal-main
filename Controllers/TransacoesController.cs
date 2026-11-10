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
    // O que faz: Exige token JWT válido para acessar. 
    // Se excluir: Qualquer pessoa (sem login) acessa a API e pode ver ou apagar os dados financeiros de qualquer um.
    [Authorize]
    public class TransacoesController : ControllerBase
    {
        private readonly AppDbContext _context; // Variável que guarda a conexão com o banco de dados.

        // O que faz: Injeção de dependência. O ASP.NET entrega a conexão do banco pronta aqui e nós guardamos no _context.
        // Se excluir: A variável _context fica nula. Quando tentarmos salvar ou ler algo, o sistema vai quebrar (NullReferenceException).
        public TransacoesController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/transacoes
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Transacao>>> GetTransacoes()
        {
            // O que faz: Pega o ID numérico do usuário logado de dentro do token de segurança (JWT).
            // Se excluir: Perdemos a referência de quem está acessando, e o Where abaixo vai quebrar.
            var id = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            // O que faz: Busca no banco apenas as transações deste usuário.
            // Se excluir o Where: Mistura as finanças de todo mundo, vazando dados de um usuário para o outro.
            return await _context.Transacoes.Where(t => t.UsuarioId == id)
                .ToListAsync();
        }

        // POST: api/transacoes
        [HttpPost]
        public async Task<ActionResult<Transacao>> PostTransacao(Transacao transacao)
        {
            // O que faz: Pega o ID de quem está logado para dizer de quem é essa nova transação.
            var id = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            // O que faz: Valida no banco se o valor é positivo e se a categoria/conta realmente existem.
            // Se excluir: A API aceita lixo. O Entity Framework vai tentar salvar com um ContaId fantasma, dando erro de chave estrangeira (Foreign Key Constraint) e travando a API.
            if (transacao.Valor <= 0 || !await _context.Categorias.AnyAsync(c => c.Id == transacao.CategoriaId && c.UsuarioId == id)
                || transacao.ContaId is not null && !await _context.Contas.AnyAsync(c => c.Id == transacao.ContaId && c.UsuarioId == id))
                return BadRequest();

            // O que faz: Limpa os objetos atrelados e garante que o ID é 0 (novo).
            // Se excluir: O Entity Framework pode tentar inserir um novo Usuário ou Categoria duplicada no banco de dados, em vez de apenas salvar a transação.
            transacao.Id = 0;
            transacao.UsuarioId = id;
            transacao.Usuario = null!;
            transacao.Categoria = null!;
            transacao.Conta = null;

            // O que faz: Prepara a transação na memória.
            _context.Transacoes.Add(transacao);

            // O que faz: Dispara o INSERT real no banco de dados.
            // Se excluir: O código termina, não dá erro, mas o dado evapora da memória e nunca chega a ser salvo no SQL.
            await _context.SaveChangesAsync();

            // O que faz: Retorna o status HTTP 201 (Criado) e devolve a transação com o novo ID gerado.
            // Se excluir: O front-end fica travado esperando resposta, e a interface do usuário não atualiza.
            return CreatedAtAction(nameof(GetTransacoes), new { id = transacao.Id }, transacao);
        }
    }
}
