# Design QA

## Referência e implementação

As dez fotos do protótipo Figma enviadas em 28/10/2026 mostram Visão Geral, Transações, Orçamento, Metas, Contas, Relatórios e Perfil. A implementação correspondente está em `wwwroot/app.html`, `app.css` e `app.js` e usa o backend ASP.NET Core.

## Verificação

- `dotnet build --no-restore`: passou.
- `node --check wwwroot/app.js`: passou.
- Migração `FinanceiroCompleto`: aplicada ao LocalDB.
- Teste de integração em banco isolado: cadastro, login, conta, categoria, transação, orçamento, depósito em meta, isolamento entre usuários e seleção do plano passaram. O banco de teste foi removido.
- `GET /app.html`: HTTP 200; `GET /api/auth/me` sem sessão: HTTP 401.

## Pendência visual

A integração local do navegador está desativada nas configurações do Work. O controle do Chrome foi interrompido porque não conseguiu identificar a URL atual com confiança. Não foi possível capturar as páginas renderizadas e compará-las visualmente com as fotos do Figma no mesmo viewport. Também não foi possível exercitar os formulários pelo navegador. A verificação visual precisa ser repetida quando o navegador estiver acessível.

**Final result: blocked**
