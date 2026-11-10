function initTransactionDrawerEvents() {
  const drawer = document.getElementById('transactionDrawer');
  const overlay = document.getElementById('drawerOverlay');
  const btnOpen = document.getElementById('btnOpenDrawer');
  const btnCancel = document.getElementById('btnCancel');
  const btnSave = document.getElementById('btnSave');
  const form = document.getElementById('transactionForm');

  const inputDescricao = document.getElementById('descricao');
  const inputValor = document.getElementById('valor');
  const selectCategoria = document.getElementById('categoria');
  const selectConta = document.getElementById('conta');
  const inputData = document.getElementById('data');
  const typeButtons = document.querySelectorAll('.btn-type');

  let tipoTransacaoSelecionado = 'Despesa'; // Padrão inicial

  if (!drawer || !btnOpen) return;

  // Função para buscar as contas do usuário no banco de dados via API C#
  function carregarContasDoBanco() {
    fetch('/api/contas')
      .then(res => {
        if (!res.ok) throw new Error('Erro ao buscar contas');
        return res.json();
      })
      .then(contas => {
        selectConta.innerHTML = '<option value="" disabled selected>Selecione uma conta</option>';
        if (contas && contas.length > 0) {
          contas.forEach(conta => {
            const option = document.createElement('option');
            // Assume que o objeto retornado possui id e nome/descricao da conta
            option.value = conta.id || conta.nomeConta;
            option.textContent = conta.nomeConta || conta.descricao;
            selectConta.appendChild(option);
          });
        } else {
          selectConta.innerHTML = '<option value="" disabled selected>Nenhuma conta cadastrada</option>';
        }
      })
      .catch(error => {
        console.warn('Modo Simulação / API de contas offline. Usando contas de exemplo:', error);
        // Fallback de dados locais caso a API não esteja ativa
        selectConta.innerHTML = `
          <option value="" disabled selected>Selecione uma conta</option>
          <option value="Conta Corrente Itaú">Conta Corrente Itaú</option>
          <option value="Nubank">Nubank</option>
          <option value="Carteira">Carteira</option>
        `;
      });
  }

  // Abrir Drawer e carregar as contas atualizadas
  btnOpen.addEventListener('click', () => {
    drawer.classList.add('open');
    if (overlay) overlay.classList.add('active');
    carregarContasDoBanco();
  });

  // Fechar Drawer
  function closeDrawer() {
    drawer.classList.remove('open');
    if (overlay) overlay.classList.active = false; // Corrigido para remover classe corretamente
    if (overlay) overlay.classList.remove('active');
    if (form) form.reset();
    clearAllErrors();
  }

  if (btnCancel) btnCancel.addEventListener('click', closeDrawer);
  if (overlay) overlay.addEventListener('click', closeDrawer);

  // Alternância do Tipo de Transação (Receita / Despesa)
  typeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      typeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      tipoTransacaoSelecionado = btn.getAttribute('data-type');
    });
  });

  // Máscara de Moeda (R$)
  if (inputValor) {
    inputValor.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\D/g, '');
      if (value === '') {
        e.target.value = '';
        return;
      }
      value = (parseInt(value, 10) / 100).toFixed(2);
      value = value.replace('.', ',');
      value = value.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      e.target.value = `R$ ${value}`;
      hideError('valor');
    });
  }

  // Controle de Erros Visuais
  function showError(fieldId) {
    const errorSpan = document.getElementById(`error-${fieldId}`);
    const inputElem = document.getElementById(fieldId);
    if (errorSpan) errorSpan.style.display = 'inline';
    if (inputElem) inputElem.classList.add('input-error');
  }

  function hideError(fieldId) {
    const errorSpan = document.getElementById(`error-${fieldId}`);
    const inputElem = document.getElementById(fieldId);
    if (errorSpan) errorSpan.style.display = 'none';
    if (inputElem) inputElem.classList.remove('input-error');
  }

  function clearAllErrors() {
    ['descricao', 'valor', 'categoria', 'conta', 'data'].forEach(hideError);
  }

  ['descricao', 'valor', 'categoria', 'conta', 'data'].forEach(id => {
    const elem = document.getElementById(id);
    if (elem) {
      elem.addEventListener('input', () => hideError(id));
      elem.addEventListener('change', () => hideError(id));
    }
  });

  // Validação e Envio de Dados via POST para o Banco de Dados
  if (btnSave) {
    btnSave.addEventListener('click', () => {
      clearAllErrors();
      let isValid = true;

      if (!inputDescricao || !inputDescricao.value.trim()) {
        showError('descricao');
        isValid = false;
      }

      if (!inputValor || !inputValor.value.trim()) {
        showError('valor');
        isValid = false;
      }

      if (!selectCategoria || !selectCategoria.value) {
        showError('categoria');
        isValid = false;
      }

      if (!selectConta || !selectConta.value) {
        showError('conta');
        isValid = false;
      }

      if (!inputData || !inputData.value.trim()) {
        showError('data');
        isValid = false;
      }

      if (isValid) {
        const payload = {
          tipo: tipoTransacaoSelecionado,
          descricao: inputDescricao.value.trim(),
          valor: inputValor.value,
          categoria: selectCategoria.value,
          contaId: selectConta.value,
          data: inputData.value
        };

        console.log('Enviando Transação ao Banco de Dados:', JSON.stringify(payload, null, 2));

        fetch('/api/transacoes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        .then(res => {
          if (!res.ok) throw new Error('Erro na requisição ao servidor');
          return res.json();
        })
        .then(data => {
          console.log('Transação registrada com sucesso no banco de dados!', data);
          alert('Transação salva com sucesso!');
          closeDrawer();
        })
        .catch(error => {
          console.warn('Modo Simulação / Erro ao conectar à API C#:', error);
          alert('Dados validados e prontos (Modo simulação local - API offline)!');
          closeDrawer();
        });
      }
    });
  }
}