# Dashboard-Financeiro-Pessoal

Aplicação ASP.NET Core 10 com SQL Server LocalDB e interface em HTML, CSS e JavaScript.

## Executar

```powershell
dotnet run --urls http://127.0.0.1:5150
```

Abra `http://127.0.0.1:5150`. Na primeira execução, o Entity Framework aplica as migrações ao banco `PainelFinanceiroDb` configurado em `appsettings.json`.

Após criar a conta e entrar, escolha o plano para acessar a Visão Geral. A escolha libera a navegação local; não processa cobrança. O menu reúne Transações, Orçamento, Metas, Contas, Relatórios e Meu Perfil.

Cadastre uma conta e uma categoria antes de adicionar transações. Todos os valores e gráficos são calculados a partir dos dados salvos para o usuário autenticado. Não há lançamentos de demonstração no banco principal. O relatório do mês pode ser exportado em PDF.

O envio de e-mail para recuperação de senha e a cobrança do plano ainda não têm integração externa.
