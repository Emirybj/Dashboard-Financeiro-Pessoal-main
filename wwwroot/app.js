const localDate = value => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
const state = { user: null, contas: [], categorias: [], transacoes: [], movimentosMeta: [], orcamentos: [], metas: [], chart: null,
  periodo: localDate(new Date()).slice(0, 7), busca: '', ordem: 'recentes', metaFiltro: 'todas', chartType: null, returnDrawer: null };
const $ = selector => document.querySelector(selector);
const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
const formatMoneyInput = value => {
  const digits = String(value).replace(/\D/g, '').slice(0, 11);
  return digits ? (Number(digits) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
};
const parseMoneyInput = value => Number(String(value).replace(/\./g, '').replace(',', '.'));
const date = value => new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR');
const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const monthOf = item => String(item.dataTransacao).slice(0, 7);
const currentPage = () => ['visao-geral', 'transacoes', 'orcamento', 'metas', 'categorias', 'contas', 'relatorios', 'perfil'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'visao-geral';
const titles = { 'visao-geral': ['Visão Geral', 'Acompanhe suas finanças em um só lugar.'], transacoes: ['Transações', 'Acompanhe todas as suas movimentações financeiras.'], orcamento: ['Orçamento', 'Planeje seus gastos e acompanhe seus limites mensais.'], metas: ['Metas', 'Transforme seus planos em conquistas.'], categorias: ['Categorias', 'Organize suas receitas e despesas.'], contas: ['Contas', 'Gerencie suas contas e acompanhe seus saldos.'], relatorios: ['Relatórios', 'Analise sua evolução financeira.'], perfil: ['Meu Perfil', 'Gerencie seus dados e suas preferências.'] };
async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`/api/${path}`, { credentials: 'same-origin', ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  } catch {
    throw new Error('Não foi possível conectar ao backend. Inicie o projeto pelo VS Code (F5) e atualize a página.');
  }
  if (response.status === 401) { sessionStorage.removeItem('usuario'); location.href = '/login.html'; throw new Error('Sessão encerrada.'); }
  const body = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.message || body?.title || 'Não foi possível concluir a operação.');
  return body;
}
const post = (path, data) => api(path, { method: 'POST', body: JSON.stringify(data) });
const put = (path, data) => api(path, { method: 'PUT', body: JSON.stringify(data) });
const remove = path => api(path, { method: 'DELETE' });
function toast(message, error = false) { const el = $('#toast'); el.textContent = message; el.className = `toast show${error ? ' error' : ''}`; clearTimeout(toast.timer); toast.timer = setTimeout(() => el.className = 'toast', 4200); }
function empty(message) { return `<div class="empty"><i class="bi bi-inbox"></i>${html(message)}</div>`; }
function headerAction(label, action, icon = 'plus-lg') { return `<button class="btn" data-action="${action}"><i class="bi bi-${icon}"></i>${label}</button>`; }
function selectedMonth() { return state.transacoes.filter(t => monthOf(t) === state.periodo); }
function metasNoMes() {
  const groups = new Map();
  state.movimentosMeta.filter(m => String(m.data).slice(0, 7) === state.periodo).forEach(m => {
    const item = groups.get(m.metaId) || { nome: m.meta, valor: 0 };
    item.valor += Number(m.valor); groups.set(m.metaId, item);
  });
  return [...groups.values()].filter(m => Math.abs(m.valor) > 0.001);
}
function chartCategories(type) {
  const items = Object.entries(selectedMonth().filter(t => t.tipo === type).reduce((a,t) => (a[t.categoria] = (a[t.categoria] || 0) + Number(t.valor), a), {}));
  if (type === 'Despesa') items.push(...metasNoMes().filter(m => m.valor > 0).map(m => [`Meta · ${m.nome}`, m.valor]));
  return items;
}
function activeChartType() { return state.chartType || (selectedMonth().some(t => t.tipo === 'Despesa') || !selectedMonth().some(t => t.tipo === 'Receita') ? 'Despesa' : 'Receita'); }
function sums(items) { return { receita: items.filter(t => t.tipo === 'Receita').reduce((s,t) => s + Number(t.valor), 0), despesa: items.filter(t => t.tipo === 'Despesa').reduce((s,t) => s + Number(t.valor), 0) }; }
function historico() {
  const reservas = state.movimentosMeta.map(m => ({ id: m.id, kind: 'meta', metaId: m.metaId,
    descricao: m.observacao?.includes('excluir a meta') ? `Reserva liberada · ${m.meta}` : m.valor > 0 ? `Guardado na meta · ${m.meta}` : `Retirado da meta · ${m.meta}`,
    categoria: 'Meta', conta: m.conta, contaId: m.contaId, tipo: m.valor > 0 ? 'Reserva' : 'Liberação',
    valor: Math.abs(Number(m.valor)), dataTransacao: m.data, observacao: m.observacao }));
  return [...state.transacoes.map(t => ({ ...t, kind: 'transacao' })), ...reservas]
    .sort((a,b) => String(b.dataTransacao).localeCompare(String(a.dataTransacao)) || (a.kind !== b.kind ? (a.kind === 'meta' ? -1 : 1) : b.id - a.id));
}
const entrada = item => item.tipo === 'Receita' || item.tipo === 'Liberação';
function metric(label, value, icon, tone = '') { return `<article class="card metric"><i class="bi bi-${icon} metric-icon"></i><span class="label">${label}</span><strong class="${tone}">${money(value)}</strong><small>Dados das suas movimentações</small></article>`; }
function recentList(items, limit = 5) { return items.length ? `<ul class="simple-list">${items.slice(0, limit).map(t => `<li><span class="item-icon"><i class="bi bi-${entrada(t) ? 'arrow-down-left' : 'arrow-up-right'}"></i></span><span class="item-main"><strong>${html(t.descricao)}</strong><small>${html(t.conta || 'Sem conta')} · ${date(t.dataTransacao)}${t.kind === 'meta' ? ' · movimentação de meta' : ''}</small></span><span class="amount ${entrada(t) ? 'green' : 'red'}">${entrada(t) ? '+' : '−'} ${money(t.valor)}</span></li>`).join('')}</ul>` : empty('Nenhuma movimentação registrada.'); }
function periodControl() { return `<input class="select" type="month" id="periodo" aria-label="Mês de referência" value="${state.periodo}">`; }
function pageHome() {
  const values = sums(selectedMonth()), saldo = state.contas.reduce((s,c) => s + Number(c.saldo), 0);
  const reservado = state.contas.reduce((s,c) => s + Number(c.reservado), 0);
  const chartType = activeChartType();
  const categories = chartCategories(chartType);
  return `<div class="toolbar"><span class="muted">Olá, ${html(state.user.nome.split(' ')[0])}. Veja o resumo do mês.</span><span style="margin-left:auto">${periodControl()}</span></div>
  <div class="grid metrics">${metric('Saldo Total', saldo - reservado, 'wallet2', 'green')}${metric('Receitas', values.receita, 'arrow-down-left', 'green')}${metric('Despesas', values.despesa, 'arrow-up-right', 'red')}${metric('Economia', values.receita - values.despesa, 'piggy-bank', 'green')}</div>
  <section class="card balance-breakdown"><div><span>Reservado em metas</span><strong>${money(reservado)}</strong></div><div><span>Total incluindo metas</span><strong>${money(saldo)}</strong></div><p class="balance-note">O saldo total diminui ao guardar em metas e aumenta quando você retira uma reserva.</p></section>
  ${state.contas.length ? `<section class="card account-summary"><div class="card-head"><h2>Disponível por conta</h2><a class="link" href="#contas">Ver contas</a></div><div class="account-summary-grid">${state.contas.map(c => `<div><strong>${html(c.nome)}</strong><span>Total incluindo metas ${money(c.saldo)} · reservado ${money(c.reservado)}</span><b class="${Number(c.disponivel) < 0 ? 'red' : 'green'}">Disponível ${money(c.disponivel)}</b></div>`).join('')}</div></section>` : ''}
  <section class="card" style="margin-bottom:18px"><div class="card-head"><h2>${chartType === 'Despesa' ? 'Despesas' : 'Receitas'} por categoria</h2><div class="chart-toggle" aria-label="Tipo de transação no gráfico"><button type="button" data-action="grafico" data-tipo="Despesa" aria-pressed="${chartType === 'Despesa'}" class="${chartType === 'Despesa' ? 'active' : ''}">Despesas</button><button type="button" data-action="grafico" data-tipo="Receita" aria-pressed="${chartType === 'Receita'}" class="${chartType === 'Receita' ? 'active' : ''}">Receitas</button></div></div>${categories.length ? `<p class="muted">${chartType === 'Despesa' ? 'Metas mostram o valor líquido positivo guardado no mês; retiradas reduzem esse valor.' : ''}</p><div class="chart-wrap"><canvas id="category-chart" aria-label="Gráfico de ${chartType === 'Despesa' ? 'despesas' : 'receitas'} por categoria"></canvas></div>` : empty(`Ainda não há ${chartType === 'Despesa' ? 'despesas' : 'receitas'} neste mês.`)}</section>
  <section class="card"><div class="card-head"><div><h2>Transações recentes</h2><span class="muted">Inclui dinheiro guardado e retirado de metas</span></div><a href="#transacoes" class="link">Ver todas</a></div>${recentList(historico())}</section>`;
}
function pageTransactions() {
  let items = historico().filter(t => `${t.descricao} ${t.categoria} ${t.conta || ''}`.toLocaleLowerCase('pt-BR').includes(state.busca.toLocaleLowerCase('pt-BR')));
  if (state.ordem === 'antigas') items = [...items].reverse();
  if (state.ordem === 'maior') items = [...items].sort((a,b) => Number(b.valor) - Number(a.valor));
  return `<section class="card"><div class="toolbar"><input class="search" id="busca" placeholder="Pesquise sua transação" aria-label="Pesquisar transações" value="${html(state.busca)}"><select class="select" id="ordem"><option value="recentes">Mais recentes</option><option value="antigas" ${state.ordem === 'antigas' ? 'selected' : ''}>Mais antigas</option><option value="maior" ${state.ordem === 'maior' ? 'selected' : ''}>Maior valor</option></select></div><h2>Histórico de movimentações <span class="muted">(${items.length})</span></h2><p class="muted">Reservas e retiradas de metas ficam registradas aqui. O gráfico mostra o valor líquido guardado no mês.</p>
    ${items.length ? `<div class="table-wrap"><table class="transactions"><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Conta</th><th>Tipo</th><th>Valor</th><th>Ações</th></tr></thead><tbody>${items.map(t => `<tr><td>${date(t.dataTransacao)}</td><td>${html(t.descricao)}${t.kind === 'meta' && t.observacao ? `<small class="history-note">${html(t.observacao)}</small>` : ''}</td><td>${html(t.categoria)}</td><td>${html(t.conta || '—')}</td><td><span class="pill ${entrada(t) ? '' : 'expense'}">${html(t.tipo)}</span></td><td class="${entrada(t) ? 'green' : 'red'}">${entrada(t) ? '+' : '−'} ${money(t.valor)}</td><td class="row-actions">${t.kind === 'transacao' ? `<button type="button" class="link" data-action="editar-transacao" data-id="${t.id}" aria-label="Editar transação ${html(t.descricao)}">Editar</button><button type="button" class="link red" data-action="excluir-transacao" data-id="${t.id}" aria-label="Excluir transação ${html(t.descricao)}">Excluir</button>` : '<span class="muted">Registro da meta</span>'}</td></tr>`).join('')}</tbody></table></div>` : empty(state.busca ? 'Nenhuma movimentação corresponde à pesquisa.' : 'Nenhuma movimentação registrada. Adicione sua primeira transação.')}</section>`;
}
function pageCategories() {
  return `<section class="card"><h2>Suas categorias <span class="muted">(${state.categorias.length})</span></h2>${state.categorias.length ? `<div class="table-wrap"><table class="transactions"><thead><tr><th>Nome</th><th>Tipo</th><th>Transações</th><th>Ações</th></tr></thead><tbody>${state.categorias.map(c => `<tr><td>${html(c.nome)}</td><td><span class="pill ${c.tipo === 'Despesa' ? 'expense' : ''}">${html(c.tipo)}</span></td><td>${state.transacoes.filter(t => t.categoriaId === c.id).length}</td><td class="row-actions"><button type="button" class="link" data-action="editar-categoria" data-id="${c.id}" aria-label="Editar categoria ${html(c.nome)}">Editar</button><button type="button" class="link red" data-action="excluir-categoria" data-id="${c.id}" aria-label="Excluir categoria ${html(c.nome)}">Excluir</button></td></tr>`).join('')}</tbody></table></div>` : empty('Nenhuma categoria cadastrada. Crie uma para organizar suas transações.')}</section>`;
}
function pageAccounts() {
  const total = state.contas.reduce((s,c) => s + Number(c.saldo), 0);
  const reservado = state.contas.reduce((s,c) => s + Number(c.reservado), 0);
  return `<section class="card balance-breakdown"><div><span>Saldo total das contas</span><strong>${money(total - reservado)}</strong></div><div><span>Reservado em metas</span><strong>${money(reservado)}</strong></div><div><span>Total incluindo metas</span><strong>${money(total)}</strong></div></section>
    ${state.contas.length ? `<div class="grid account-grid">${state.contas.map(c => `<article class="card account-card"><span class="muted">${html(c.nome)}</span><strong>${money(c.disponivel)}</strong><small>${html(c.instituicao || c.tipo)} · ${html(c.tipo)}</small><div class="account-availability"><span>Reservado em metas: ${money(c.reservado)}</span><span>Disponível: <b class="${Number(c.disponivel) < 0 ? 'red' : 'green'}">${money(c.disponivel)}</b></span></div></article>`).join('')}</div>` : `<section class="card" style="margin-bottom:18px">${empty('Nenhuma conta cadastrada. Crie uma conta para registrar transações.')}</section>`}
    <section class="card"><div class="card-head"><div><h2>Movimentações recentes</h2><span class="muted">Inclui reservas e retiradas de metas</span></div><a href="#transacoes" class="link">Ver todas</a></div>${recentList(historico().filter(t => t.contaId))}</section>`;
}
function progress(value, max) { const pct = max > 0 ? Math.round(value / max * 100) : 0; return `<div class="progress ${pct >= 100 ? 'over' : pct >= 80 ? 'warn' : ''}"><span style="width:${Math.min(pct,100)}%"></span></div>`; }
function ring(value, max, label = 'Utilizado') { const pct = max > 0 ? Math.round(value / max * 100) : 0; return `<div class="ring" style="--pct:${Math.max(0,Math.min(pct,100))}%"><span><strong>${pct}%</strong><small>${label}</small></span></div>`; }
function pageBudget() {
  const goals = metasNoMes(), reservado = goals.reduce((s,m) => s + m.valor, 0);
  const limit = state.orcamentos.reduce((s,o) => s + Number(o.limite), 0), spent = state.orcamentos.reduce((s,o) => s + Number(o.gasto), 0) + reservado;
  return `<div class="toolbar"><span class="muted">Visão geral do mês</span><span style="margin-left:auto">${periodControl()}</span></div>
    <section class="card" style="margin-bottom:18px"><h2>Visão Geral do Orçamento</h2>${state.orcamentos.length || goals.length ? `<div class="overview">${ring(spent,limit)}<div class="overview-details"><div><span>Orçamento mensal</span><strong class="green">${money(limit)}</strong></div><div><span>Já utilizado</span><strong>${money(spent)}</strong></div><div><span>Restante do orçamento</span><strong>${money(limit-spent)}</strong></div></div></div>` : empty('Nenhum orçamento para este mês. Crie um orçamento para acompanhar seus gastos.')}</section>
    <p class="muted">O valor utilizado inclui o saldo líquido destinado às metas no mês; os limites abaixo são os cadastrados para categorias.</p><h2 class="section-title" style="margin:0 0 12px">Gastos por Categoria e Metas</h2><div class="grid budget-grid">${state.orcamentos.map(o => `<article class="card budget-card"><h3>${html(o.categoria)}</h3><small>${money(o.gasto)} de ${money(o.limite)}</small><div class="progress-row">${progress(Number(o.gasto),Number(o.limite))}<small>${money(Number(o.limite)-Number(o.gasto))} restantes</small></div></article>`).join('')}${goals.map(m => `<article class="card budget-card"><h3>Meta · ${html(m.nome)}</h3><strong>${money(m.valor)}</strong><p class="muted">Valor líquido guardado no mês (depósitos menos retiradas)</p></article>`).join('')}</div>`;
}
function pageGoals() {
  const saved = state.metas.reduce((s,m) => s + Number(m.guardado), 0), active = state.metas.filter(m => Number(m.guardado) < Number(m.valorObjetivo)), finished = state.metas.length - active.length;
  const featured = active[0];
  const goals = state.metas.filter(m => state.metaFiltro === 'todas' || (state.metaFiltro === 'ativas' ? Number(m.guardado) < Number(m.valorObjetivo) : Number(m.guardado) >= Number(m.valorObjetivo)));
  return `<div class="grid metrics" style="grid-template-columns:repeat(3,minmax(0,1fr))"><article class="card metric"><span class="label">Total Guardado</span><strong class="green">${money(saved)}</strong><small>em todas as metas</small></article><article class="card metric"><span class="label">Metas Ativas</span><strong>${active.length}</strong></article><article class="card metric"><span class="label">Metas Concluídas</span><strong>${finished}</strong></article></div>
    ${featured ? `<div class="goal-feature">${ring(Number(featured.guardado),Number(featured.valorObjetivo),'Concluído')}<div class="grow"><h2>Meta Principal · ${html(featured.nome)}</h2><p>Valor Desejado: <strong>${money(featured.valorObjetivo)}</strong></p><p>Valor Guardado: <strong class="green">${money(featured.guardado)}</strong></p><p>Valor restante: <strong class="red">${money(Math.max(0,Number(featured.valorObjetivo)-Number(featured.guardado)))}</strong></p><p>Prazo previsto: ${date(featured.prazo)}</p></div><div class="goal-actions"><button class="btn" data-action="deposito" data-id="${featured.id}"><i class="bi bi-wallet2"></i> Guardar</button>${Number(featured.guardado) > 0 ? `<button class="btn secondary" data-action="retirada" data-id="${featured.id}">Retirar</button>` : ''}</div></div>` : ''}
    <div class="card-head"><h2>Minhas Metas</h2><select id="meta-filtro" class="select" aria-label="Filtrar metas"><option value="todas">Todas as Metas</option><option value="ativas" ${state.metaFiltro === 'ativas' ? 'selected' : ''}>Ativas</option><option value="concluidas" ${state.metaFiltro === 'concluidas' ? 'selected' : ''}>Concluídas</option></select></div>
    ${goals.length ? goals.map(m => `<article class="card goal-item"><div><h3>${html(m.nome)}</h3><small>${money(m.guardado)} de ${money(m.valorObjetivo)} · prazo ${date(m.prazo)}</small><div class="progress-row">${progress(Number(m.guardado),Number(m.valorObjetivo))}</div></div><div class="goal-actions"><button class="btn ${Number(m.guardado) >= Number(m.valorObjetivo) ? 'secondary' : ''}" data-action="${Number(m.guardado) >= Number(m.valorObjetivo) ? 'detalhes' : 'deposito'}" data-id="${m.id}">${Number(m.guardado) >= Number(m.valorObjetivo) ? 'Ver detalhes' : 'Guardar'}</button>${Number(m.guardado) > 0 ? `<button class="btn secondary" data-action="retirada" data-id="${m.id}">Retirar</button>` : ''}<button class="btn danger" data-action="excluir-meta" data-id="${m.id}">Excluir meta</button></div></article>`).join('') : `<section class="card">${empty(state.metas.length ? 'Nenhuma meta neste filtro.' : 'Nenhuma meta criada. Adicione sua primeira meta.')}</section>`}`;
}
function pageReports() {
  const transactions = selectedMonth(), values = sums(transactions), categories = Object.entries(transactions.filter(t => t.tipo === 'Despesa').reduce((a,t) => (a[t.categoria] = (a[t.categoria] || 0) + Number(t.valor), a), {})).sort((a,b) => b[1]-a[1]);
  const [year,month] = state.periodo.split('-').map(Number), months = Array.from({length:4},(_,i) => { const d = new Date(year,month-1-(3-i),1), key = localDate(d).slice(0,7), v = sums(state.transacoes.filter(t => monthOf(t) === key)); return { label: d.toLocaleDateString('pt-BR',{month:'short'}), ...v }; });
  const max = Math.max(1,...months.flatMap(m => [m.receita,m.despesa]));
  return `<div class="toolbar"><span class="muted">Análise das suas movimentações</span><span style="margin-left:auto">${periodControl()}</span></div><div class="grid metrics" style="grid-template-columns:repeat(3,minmax(0,1fr))">${metric('Receitas',values.receita,'arrow-down-left','green')}${metric('Despesas',values.despesa,'arrow-up-right','red')}${metric('Saldo do Período',values.receita-values.despesa,'wallet2')}</div>
    <section class="card" style="margin-bottom:18px"><h2>Receitas x Despesas</h2><p class="muted">Comparativo dos últimos quatro meses</p>${months.some(m => m.receita || m.despesa) ? `<div class="report-bars">${months.map(m => `<div class="bar-group"><span title="Receitas: ${money(m.receita)}" style="height:${Math.max(1,m.receita/max*100)}%"></span><span title="Despesas: ${money(m.despesa)}" style="height:${Math.max(1,m.despesa/max*100)}%"></span><small>${html(m.label)}</small></div>`).join('')}</div><div class="legend"><b>■ Receitas</b> &nbsp; <em>■ Despesas</em></div>` : empty('Ainda não há movimentações para comparar.')}</section>
    <section class="card" style="margin-bottom:18px"><h2>Gastos por Categoria</h2>${categories.length ? categories.map(([name,value]) => `<div class="progress-row"><div><strong>${html(name)}</strong><span>${money(value)}</span></div>${progress(value,values.despesa)}</div>`).join('') : empty('Ainda não há despesas neste mês.')}</section><button class="btn full" data-action="exportar"><i class="bi bi-download"></i> Exportar Relatório em PDF</button>`;
}
function pageProfile() { const u = state.user; return `<div class="profile-wrap"><section class="card profile-hero"><span class="avatar">${html(u.nome[0] || '?')}</span><span><strong>${html(u.nome)}</strong><small>${html(u.email)}</small><small>Plano Individual</small></span><a href="/plano.html" class="btn secondary" style="margin-left:auto">Alterar Plano</a></section>
  <section class="card"><h2>Dados Pessoais</h2><form class="profile-form" id="profile-form"><label class="field">Nome Completo<input name="nome" value="${html(u.nome)}" required minlength="2" maxlength="120"></label><label class="field">E-mail<input type="email" name="email" value="${html(u.email)}" required></label><label class="field">Moeda Padrão<select name="moeda"><option value="BRL">Real brasileiro (BRL – R$)</option></select></label><button class="btn full" type="submit">Salvar Alterações</button></form></section>
  <section class="card"><h2>Segurança e Preferências</h2><div class="preference"><button class="link" data-action="senha" style="border:0;background:none;padding:0">Alterar Senha <i class="bi bi-chevron-right"></i></button></div><div class="preference"><button class="link red" data-action="sair" style="border:0;background:none;padding:0">Sair da Conta <i class="bi bi-box-arrow-right"></i></button></div></section></div>`; }
async function loadData() { const [contas,categorias,transacoes,metas,movimentosMeta] = await Promise.all(['contas','categorias','transacoes','metas','movimentacoes-metas'].map(x => api(`financeiro/${x}`))); Object.assign(state,{contas,categorias,transacoes,metas,movimentosMeta}); await loadBudgets(); }
async function loadBudgets() { const [ano,mes] = state.periodo.split('-'); state.orcamentos = await api(`financeiro/orcamentos?ano=${ano}&mes=${mes}`); }
function render() {
  if (!state.user) return;
  const page = currentPage();
  $('#page-title').textContent = titles[page][0]; $('#page-subtitle').textContent = titles[page][1];
  $('#sidebar-name').textContent = state.user.nome; $('#avatar-initial').textContent = state.user.nome[0] || '?';
  document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.toggle('active',a.dataset.page === page));
  const actions = { transacoes: headerAction('Adicionar transação','transacao'), orcamento: headerAction('Adicionar Orçamento','orcamento'), metas: headerAction('Adicionar Meta','meta'), categorias: headerAction('Nova Categoria','categoria'), contas: headerAction('Nova Conta','conta') };
  $('#top-actions').innerHTML = actions[page] || '';
  const pages = { 'visao-geral': pageHome, transacoes: pageTransactions, orcamento: pageBudget, metas: pageGoals, categorias: pageCategories, contas: pageAccounts, relatorios: pageReports, perfil: pageProfile };
  $('#content').innerHTML = pages[page]();
  if (page === 'visao-geral') drawCategoryChart();
  $('#sidebar').classList.remove('open');
}
function drawCategoryChart() {
  state.chart?.destroy(); const canvas = $('#category-chart'); if (!canvas) return;
  if (!window.Chart) { canvas.replaceWith(Object.assign(document.createElement('p'), { className:'muted', textContent:'Gráfico indisponível. As movimentações continuam visíveis em Relatórios.' })); return; }
  const values = chartCategories(activeChartType());
  state.chart = new Chart(canvas,{ type:'doughnut', data:{labels:values.map(x=>x[0]),datasets:[{data:values.map(x=>x[1]),backgroundColor:['#2e805f','#6386a3','#907db4','#db9635','#77a49d','#c36e76'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,cutout:'15%',plugins:{legend:{position:'right',labels:{boxWidth:11,font:{family:'Inter',size:11}}},tooltip:{callbacks:{label:ctx=>`${ctx.label}: ${money(ctx.parsed)}`}}}} });
}
function field(label,name,type='text',extra='') { return `<label class="field">${label}<input name="${name}" type="${type}" ${extra} required></label>`; }
function moneyField(label,name,initial='') { return `<label class="field">${label}<input name="${name}" type="text" inputmode="numeric" data-money placeholder="0,00" value="${initial}" required></label>`; }
function selectField(label,name,items,placeholder='Selecione') { return `<label class="field">${label}<select name="${name}" required><option value="">${placeholder}</option>${items.map(i=>`<option value="${html(i.id)}">${html(i.nome)}</option>`).join('')}</select></label>`; }
function showDrawer(type,id) {
  let title='',description='',body=''; const today = localDate(new Date());
  if (type.startsWith('excluir-')) {
    const entity = type.slice(8);
    const item = (entity === 'meta' ? state.metas : entity === 'transacao' ? state.transacoes : state.categorias).find(x => x.id === Number(id));
    if (!item) return;
    title = entity === 'meta' ? 'Excluir meta' : entity === 'transacao' ? 'Excluir transação' : 'Excluir categoria';
    description = 'Confirme a exclusão.';
    body = `<p class="delete-message">Deseja excluir <strong>${html(item.descricao || item.nome)}</strong>?</p>` + (entity === 'meta'
      ? `<p class="delete-explanation">Os ${money(item.guardado)} reservados nesta meta voltarão a ficar disponíveis nas contas de origem. As reservas e retiradas continuarão no histórico de movimentações.</p>`
      : `<p class="delete-explanation">Esta ação não pode ser desfeita.</p>`);
  }
  if (type === 'conta') { title='Criar Conta'; description='Cadastre uma conta para acompanhar seu saldo.'; body=field('Nome da Conta','nome','text','maxlength="100" placeholder="Ex.: Conta principal"')+`<label class="field">Instituição Financeira<input name="instituicao" maxlength="100" placeholder="Ex.: Banco"></label><label class="field">Tipo de Conta<select name="tipo" required><option value="Corrente">Conta Corrente</option><option value="Poupança">Poupança</option><option value="Carteira">Carteira</option><option value="Outro">Outro</option></select></label>`+moneyField('Saldo Inicial','saldoInicial','0,00'); }
  if (type === 'transacao') { title='Adicionar Transação'; description='Registre uma receita ou despesa.'; body=`<div class="type-switch"><button type="button" class="active" data-type="Receita"><i class="bi bi-graph-up-arrow"></i> Receita</button><button type="button" data-type="Despesa"><i class="bi bi-graph-down-arrow"></i> Despesa</button></div><input type="hidden" name="tipo" value="Receita">`+field('Descrição','descricao','text','maxlength="180" placeholder="Ex.: Salário"')+moneyField('Valor','valor')+`<div id="category-field"></div><button type="button" class="link" data-action="categoria" style="border:0;background:none;padding:0;margin:-6px 0 17px">+ Nova categoria</button>`+selectField('Conta','contaId',state.contas)+`<button type="button" class="link" data-action="conta" style="border:0;background:none;padding:0;margin:-6px 0 17px">+ Nova conta</button>`+field('Data','dataTransacao','date',`value="${today}"`); }
  if (type === 'categoria') { title='Nova Categoria'; description='Organize suas movimentações.'; body=field('Nome da Categoria','nome','text','maxlength="80"')+`<label class="field">Tipo<select name="tipo" required><option value="Receita">Receita</option><option value="Despesa">Despesa</option></select></label>`; }
  if (type === 'orcamento') { title='Criar Orçamento'; description='Defina um limite para controlar seus gastos.'; body=field('Nome do Orçamento','nome','text','maxlength="100"')+selectField('Categoria','categoriaId',state.categorias.filter(c=>c.tipo==='Despesa'))+`<button type="button" class="link" data-action="categoria" style="border:0;background:none;padding:0;margin:-6px 0 17px">+ Nova categoria</button>`+moneyField('Limite de Gastos','limite')+field('Mês de Referência','referencia','month',`value="${state.periodo}"`); }
  if (type === 'meta') { title='Nova Meta'; description='Defina seu objetivo financeiro.'; body=field('Nome da Meta','nome','text','maxlength="100"')+moneyField('Valor Desejado','valorObjetivo')+field('Prazo para cumprir a meta','prazo','date',`min="${today}"`); }
  if (type === 'deposito') { const goal=state.metas.find(m=>m.id===Number(id)); if (!goal) return; title='Guardar em uma meta'; description='Reserve parte do saldo de uma conta, sem registrar uma despesa.'; const saldo=state.contas.reduce((s,c)=>s+Number(c.saldo),0), reservado=state.contas.reduce((s,c)=>s+Number(c.reservado),0); body=`<div class="card" style="background:var(--accent);color:white;margin-bottom:20px"><strong>${html(goal.nome)}</strong><p style="margin-bottom:0;font-size:12px">${money(goal.guardado)} guardados de ${money(goal.valorObjetivo)}</p></div><div class="reservation-explain"><strong>De onde vem o valor disponível?</strong><span>Saldo total disponível: ${money(saldo-reservado)}</span><span>Já reservado em metas: ${money(reservado)}</span><span>Total incluindo metas: ${money(saldo)}</span><small>Ao selecionar uma conta, vale somente o disponível dela. Guardar diminui o saldo total disponível sem criar despesa.</small></div>`+`<label class="field">Conta de origem — disponível por conta<select name="contaId" required><option value="">Selecione uma conta</option>${state.contas.map(c=>`<option value="${c.id}" ${Number(c.disponivel) <= 0 ? 'disabled' : ''}>${html(c.nome)} — disponível ${money(c.disponivel)} (total incluindo metas ${money(c.saldo)}, reservado ${money(c.reservado)})</option>`).join('')}</select></label><button type="button" class="link" data-action="conta" style="border:0;background:none;padding:0;margin:-6px 0 17px">+ Nova conta</button>`+moneyField('Valor a guardar','valor')+field('Data da reserva','data','date',`value="${today}"`)+`<label class="field">Observações (opcional)<input name="observacao" maxlength="300" placeholder="Ex.: reserva mensal"></label>`; }
  if (type === 'retirada') { const goal=state.metas.find(m=>m.id===Number(id)); if (!goal) return; title='Retirar da meta'; description='Devolva uma reserva ao saldo disponível da conta.'; body=`<div class="card" style="background:var(--accent);color:white;margin-bottom:20px"><strong>${html(goal.nome)}</strong><p style="margin-bottom:0;font-size:12px">${money(goal.guardado)} reservados</p></div><label class="field">Conta da reserva<select name="contaId" required><option value="">Selecione uma conta</option>${(goal.reservas || []).map(r=>`<option value="${r.contaId}">${html(r.conta)} — reservado ${money(r.valor)}</option>`).join('')}</select></label>`+moneyField('Valor a retirar','valor')+field('Data da retirada','data','date',`value="${today}"`)+`<label class="field">Observações (opcional)<input name="observacao" maxlength="300"></label>`; }
  if (type === 'senha') { title='Alterar Senha'; description='Atualize sua senha de acesso.'; body=field('Senha atual','senhaAtual','password')+field('Nova senha','novaSenha','password','minlength="8"'); }
  if (type === 'detalhes') { const goal=state.metas.find(m=>m.id===Number(id)); if (!goal) return; title=goal.nome; description='Detalhes da meta'; body=`<p>Valor desejado: <strong>${money(goal.valorObjetivo)}</strong></p><p>Valor guardado: <strong>${money(goal.guardado)}</strong></p><p>Prazo: ${date(goal.prazo)}</p><h3>Reservas por conta</h3>${(goal.reservas || []).map(r=>`<p>${html(r.conta)}: ${money(r.valor)}</p>`).join('')}`; }
  const editing = id && (type === 'transacao' || type === 'categoria');
  if (editing) { title = type === 'transacao' ? 'Editar Transação' : 'Editar Categoria'; description = 'Atualize os dados e salve as alterações.'; }
  const buttons = type === 'detalhes' ? `<button class="btn secondary full" type="button" data-action="fechar">Fechar</button>` : `<button class="btn secondary" type="button" data-action="fechar">Cancelar</button><button class="btn ${type.startsWith('excluir-') ? 'danger' : ''}" type="submit">${type.startsWith('excluir-') ? 'Excluir' : type === 'deposito' ? 'Guardar' : type === 'retirada' ? 'Confirmar Retirada' : type === 'senha' ? 'Alterar Senha' : editing ? 'Salvar Alterações' : 'Salvar'}</button>`;
  $('#drawer-content').innerHTML=`<form class="drawer-inner" id="drawer-form" data-type="${type}" data-id="${id||''}"><div class="drawer-head"><div><h2>${html(title)}</h2><p>${description}</p></div><button type="button" class="icon-button" data-action="fechar" aria-label="Fechar"><i class="bi bi-x-lg"></i></button></div><div class="drawer-body">${body}</div><div class="drawer-footer">${buttons}</div></form>`;
  $('#drawer').classList.add('open'); $('#drawer').setAttribute('aria-hidden','false'); $('#drawer-backdrop').hidden=false;
  if (type === 'transacao') updateCategoryField();
  if (type === 'categoria' && state.returnDrawer) $('#drawer-form').elements.tipo.value = state.returnDrawer.type === 'orcamento' ? 'Despesa' : state.returnDrawer.values.tipo;
  if (editing) {
    const item = type === 'transacao' ? state.transacoes.find(t => t.id === Number(id)) : state.categorias.find(c => c.id === Number(id));
    if (!item) { closeDrawer(); return; }
    const form = $('#drawer-form');
    if (type === 'transacao') {
      form.elements.tipo.value = item.tipo;
      form.querySelectorAll('.type-switch button').forEach(button => button.classList.toggle('active', button.dataset.type === item.tipo));
      updateCategoryField();
      form.elements.descricao.value = item.descricao;
      form.elements.valor.value = formatMoneyInput(Math.round(Number(item.valor) * 100));
      form.elements.categoriaId.value = String(item.categoriaId);
      form.elements.contaId.value = String(item.contaId ?? '');
      form.elements.dataTransacao.value = String(item.dataTransacao).slice(0, 10);
    } else { form.elements.nome.value = item.nome; form.elements.tipo.value = item.tipo; }
  }
  $('#drawer input:not([type=hidden])')?.focus();
}
function updateCategoryField() { const form=$('#drawer-form'), type=form?.elements.tipo?.value; if (!type || !$('#category-field')) return; $('#category-field').innerHTML=selectField('Categoria','categoriaId',state.categorias.filter(c=>c.tipo===type)); }
function closeDrawer(clearParent = true) { $('#drawer').classList.remove('open'); $('#drawer').setAttribute('aria-hidden','true'); $('#drawer-backdrop').hidden=true; if (clearParent) state.returnDrawer = null; }
async function saveDrawer(form) {
  const data=Object.fromEntries(new FormData(form)), type=form.dataset.type, id=form.dataset.id;
  if (type.startsWith('excluir-')) {
    const entity = type.slice(8), path = { meta: 'metas', transacao: 'transacoes', categoria: 'categorias' }[entity];
    if (!path) throw new Error('Tipo de exclusão inválido.');
    await remove(`financeiro/${path}/${id}`);
    closeDrawer(); await loadData(); render();
    toast(`${{ meta: 'Meta', transacao: 'Transação', categoria: 'Categoria' }[entity]} excluída com sucesso.`);
    return;
  }
  const amountName = { transacao: 'valor', orcamento: 'limite', meta: 'valorObjetivo', deposito: 'valor', retirada: 'valor' }[type];
  if (amountName && parseMoneyInput(data[amountName]) <= 0) throw new Error('Informe um valor maior que zero.');
  let createdAccount;
  if (type === 'conta') createdAccount = await post('financeiro/contas',{...data,saldoInicial:parseMoneyInput(data.saldoInicial)});
  let createdCategory;
  if (type === 'categoria') {
    if (id) await put(`financeiro/categorias/${id}`,data);
    else createdCategory = await post('financeiro/categorias',data);
  }
  if (type === 'transacao') {
    const payload = {descricao:data.descricao,valor:parseMoneyInput(data.valor),categoriaId:Number(data.categoriaId),contaId:Number(data.contaId),dataTransacao:data.dataTransacao};
    if (id) await put(`financeiro/transacoes/${id}`,payload);
    else await post('financeiro/transacoes',payload);
  }
  if (type === 'orcamento') { const [ano,mes]=data.referencia.split('-').map(Number); await post('financeiro/orcamentos',{nome:data.nome,limite:parseMoneyInput(data.limite),categoriaId:Number(data.categoriaId),ano,mes}); state.periodo=data.referencia; }
  if (type === 'meta') await post('financeiro/metas',{nome:data.nome,valorObjetivo:parseMoneyInput(data.valorObjetivo),prazo:data.prazo});
  if (type === 'deposito') await post(`financeiro/metas/${id}/depositos`,{contaId:Number(data.contaId),valor:parseMoneyInput(data.valor),data:data.data,observacao:data.observacao});
  if (type === 'retirada') await post(`financeiro/metas/${id}/retiradas`,{contaId:Number(data.contaId),valor:parseMoneyInput(data.valor),data:data.data,observacao:data.observacao});
  if (type === 'senha') await put('auth/password',data);
  closeDrawer(false); await loadData(); render();
  if (createdCategory && state.returnDrawer) restoreParentDrawer(createdCategory.id);
  if (createdAccount && state.returnDrawer) restoreParentDrawer(undefined,createdAccount.id);
  toast('Dados salvos com sucesso.');
}
function restoreParentDrawer(categoryId,accountId) {
  const previous = state.returnDrawer;
  state.returnDrawer = null;
  if (!previous) return;
  showDrawer(previous.type, previous.id);
  const form = $('#drawer-form');
  if (previous.type === 'transacao') {
    form.elements.tipo.value = previous.values.tipo;
    form.querySelectorAll('.type-switch button').forEach(button => button.classList.toggle('active', button.dataset.type === previous.values.tipo));
    updateCategoryField();
  }
  for (const [name, value] of Object.entries(previous.values)) {
    if (name !== 'categoriaId' && form.elements.namedItem(name)) form.elements.namedItem(name).value = value;
  }
  if (form.elements.categoriaId && (categoryId || previous.values.categoriaId))
    form.elements.categoriaId.value = String(categoryId || previous.values.categoriaId);
  if (accountId) form.elements.contaId.value = String(accountId);
}
async function exportReport() {
  const [ano, mes] = state.periodo.split('-');
  let response;
  try { response = await fetch(`/api/financeiro/relatorios/pdf?ano=${ano}&mes=${mes}`, { credentials: 'same-origin' }); }
  catch { throw new Error('Não foi possível conectar ao backend.'); }
  if (response.status === 401) { sessionStorage.removeItem('usuario'); location.href = '/login.html'; throw new Error('Sessão encerrada.'); }
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body?.message || 'Não foi possível gerar o PDF.'); }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a'); link.href = url; link.download = `relatorio-${state.periodo}.pdf`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action]'); if (!button) return;
  const action=button.dataset.action;
  if (action==='fechar') { if (['categoria','conta'].includes($('#drawer-form')?.dataset.type) && state.returnDrawer) restoreParentDrawer(); else closeDrawer(); return; }
  if (action==='exportar') { button.disabled = true; try { await exportReport(); toast('Relatório em PDF gerado.'); } catch(e) { toast(e.message,true); } finally { button.disabled = false; } return; }
  if (action==='grafico') { state.chartType = button.dataset.tipo; render(); return; }
  if (action==='sair') { try { await post('auth/logout',{}); sessionStorage.removeItem('usuario'); location.href='/login.html'; } catch(e) { toast(e.message,true); } return; }
  if (action === 'editar-transacao' || action === 'editar-categoria') { showDrawer(action.slice(7), button.dataset.id); return; }
  if (['excluir-transacao','excluir-categoria','excluir-meta'].includes(action)) { showDrawer(action,button.dataset.id); return; }
  if (action === 'categoria' || action === 'conta') {
    const form = $('#drawer-form');
    if ($('#drawer').classList.contains('open') && form && (form.dataset.type === 'transacao' || action === 'conta' && form.dataset.type === 'deposito' || action === 'categoria' && form.dataset.type === 'orcamento')) state.returnDrawer = { type: form.dataset.type, id: form.dataset.id, values: Object.fromEntries(new FormData(form)) };
  }
  if (['conta','transacao','categoria','orcamento','meta','deposito','retirada','senha','detalhes'].includes(action)) showDrawer(action,button.dataset.id);
});
document.addEventListener('submit',async event=>{
  if (event.target.id==='drawer-form') { event.preventDefault(); const button=event.target.querySelector('[type=submit]');button.disabled=true;try{await saveDrawer(event.target)}catch(e){toast(e.message,true);button.disabled=false;} }
  if (event.target.id==='profile-form') { event.preventDefault();const button=event.target.querySelector('[type=submit]');button.disabled=true;try{state.user=await put('auth/profile',Object.fromEntries(new FormData(event.target)));sessionStorage.setItem('usuario',JSON.stringify(state.user));render();toast('Perfil atualizado.')}catch(e){toast(e.message,true);button.disabled=false;} }
});
document.addEventListener('input',async event=>{
  if (event.target.matches('[data-money]')) {
    event.target.value = formatMoneyInput(event.target.value);
    event.target.setSelectionRange(event.target.value.length, event.target.value.length);
  }
  if (event.target.id==='busca') { state.busca=event.target.value; const start=event.target.selectionStart;render();const input=$('#busca');input.focus();input.setSelectionRange(start,start); }
});
document.addEventListener('change',async event=>{
  if (event.target.id==='periodo') { state.periodo=event.target.value;try{await loadBudgets();render()}catch(e){toast(e.message,true)} }
  if (event.target.id==='ordem') { state.ordem=event.target.value;render(); }
  if (event.target.id==='meta-filtro') { state.metaFiltro=event.target.value;render(); }
});
document.addEventListener('click',event=>{
  const type=event.target.closest('.type-switch button[data-type]');if(!type)return;
  const form=$('#drawer-form');form.elements.tipo.value=type.dataset.type;
  form.querySelectorAll('[data-type]').forEach(b=>b.classList.toggle('active',b===type));updateCategoryField();
});
$('#drawer-backdrop').addEventListener('click',closeDrawer);
$('#menu-toggle').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
window.addEventListener('hashchange',render);
(async()=>{try{state.user=await api('auth/me');if(!state.user.planoSelecionado){location.href='/plano.html';return;}await loadData();render();}catch(e){if(!String(e.message).includes('Sessão'))toast(e.message,true);}})();
