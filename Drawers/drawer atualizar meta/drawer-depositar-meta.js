function initDepositarMetaDrawerEvents() {
  const drawer = document.getElementById('depositarMetaDrawer');
  const overlay = document.getElementById('drawerOverlay');
  
  const btnCancel = document.getElementById('btnCancel');
  const btnSave = document.getElementById('btnSave');
  const form = document.getElementById('depositarMetaForm');

  const inputValor = document.getElementById('valorDeposito');
  const inputData = document.getElementById('dataDeposito');
  const inputObs = document.getElementById('observacoesDeposito');


  const displayNome = document.getElementById('displayMetaNome');
  const displayValores = document.getElementById('displayMetaValores');


  let selectedMetaId = null;

  if (!drawer) return;

  document.addEventListener('click', (e) => {
    const triggerBtn = e.target.closest('.btn-depositar-trigger');
    
    if (triggerBtn) {
      // Extrai os dados embutidos no botão clicado
      selectedMetaId = triggerBtn.getAttribute('data-meta-id');
      const metaNome = triggerBtn.getAttribute('data-meta-nome');
      const metaValores = triggerBtn.getAttribute('data-meta-valores');

      // Atualiza dinamicamente o visual do drawer com a meta correta
      if (displayNome) displayNome.textContent = metaNome;
      if (displayValores) displayValores.textContent = metaValores;

      // Abre o drawer e ativa o overlay
      drawer.classList.add('open');
      if (overlay) overlay.classList.add('active');
    }
  });

  // Fechar Drawer
  function closeDrawer() {
    drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
    if (form) form.reset();
    clearAllErrors();
    selectedMetaId = null;
  }

  if (btnCancel) btnCancel.addEventListener('click', closeDrawer);
  if (overlay) overlay.addEventListener('click', closeDrawer);

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
      hideError('valorDeposito');
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
    ['valorDeposito', 'dataDeposito'].forEach(hideError);
  }

  ['valorDeposito', 'dataDeposito'].forEach(id => {
    const elem = document.getElementById(id);
    if (elem) {
      elem.addEventListener('input', () => hideError(id));
      elem.addEventListener('change', () => hideError(id));
    }
  });

  // Validação e Envio de Dados para o Banco de Dados
  if (btnSave) {
    btnSave.addEventListener('click', () => {
      clearAllErrors();
      let isValid = true;

      if (!inputValor || !inputValor.value.trim()) {
        showError('valorDeposito');
        isValid = false;
      }

      if (!inputData || !inputData.value.trim()) {
        showError('dataDeposito');
        isValid = false;
      }

      if (isValid) {
        // O payload envia o ID da meta que o usuário escolheu
        const payload = {
          metaId: selectedMetaId,
          valorDeposito: inputValor.value,
          dataDeposito: inputData.value,
          observacoes: inputObs ? inputObs.value.trim() : ''
        };

        console.log('Enviando Depósito ao Banco de Dados:', JSON.stringify(payload, null, 2));

        fetch('/api/metas/depositos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        .then(res => {
          if (!res.ok) throw new Error('Erro na requisição ao servidor');
          return res.json();
        })
        .then(data => {
          console.log('Depósito registrado com sucesso no banco de dados!', data);
          alert('Depósito realizado com sucesso!');
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
