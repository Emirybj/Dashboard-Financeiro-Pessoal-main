function initAccountDrawerEvents() {
  const drawer = document.getElementById('accountDrawer');
  const overlay = document.getElementById('drawerOverlay');
  const btnOpen = document.getElementById('btnOpenDrawer');
  const btnCancel = document.getElementById('btnCancel');
  const btnSave = document.getElementById('btnSave');
  const form = document.getElementById('accountForm');
  
  const inputSaldo = document.getElementById('saldoInicial');
  const inputNome = document.getElementById('nomeConta');
  const inputInstituicao = document.getElementById('instituicao');
  const selectTipo = document.getElementById('tipoConta');

  if (!drawer || !btnOpen) return;

  // Abrir Drawer
  btnOpen.addEventListener('click', () => {
    drawer.classList.add('open');
    if (overlay) overlay.classList.add('active');
  });

  // Fechar Drawer
  function closeDrawer() {
    drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
    if (form) form.reset();
    clearAllErrors();
  }

  if (btnCancel) btnCancel.addEventListener('click', closeDrawer);
  if (overlay) overlay.addEventListener('click', closeDrawer);

  // Máscara de Moeda (R$)
  if (inputSaldo) {
    inputSaldo.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\D/g, '');
      if (value === '') {
        e.target.value = '';
        return;
      }
      value = (parseInt(value, 10) / 100).toFixed(2);
      value = value.replace('.', ',');
      value = value.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      e.target.value = `R$ ${value}`;
      hideError('saldoInicial');
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
    ['nomeConta', 'instituicao', 'tipoConta', 'saldoInicial'].forEach(hideError);
  }

  ['nomeConta', 'instituicao', 'tipoConta', 'saldoInicial'].forEach(id => {
    const elem = document.getElementById(id);
    if (elem) {
      elem.addEventListener('input', () => hideError(id));
      elem.addEventListener('change', () => hideError(id));
    }
  });

  // Validação e Envio de Dados
  if (btnSave) {
    btnSave.addEventListener('click', () => {
      clearAllErrors();
      let isValid = true;

      if (!inputNome || !inputNome.value.trim()) {
        showError('nomeConta');
        isValid = false;
      }

      if (!inputInstituicao || !inputInstituicao.value.trim()) {
        showError('instituicao');
        isValid = false;
      }

      if (!selectTipo || !selectTipo.value) {
        showError('tipoConta');
        isValid = false;
      }

      if (!inputSaldo || !inputSaldo.value.trim()) {
        showError('saldoInicial');
        isValid = false;
      }

      if (isValid) {
        const payload = {
          nomeConta: inputNome.value.trim(),
          instituicaoFinanceira: inputInstituicao.value.trim(),
          tipoConta: selectTipo.value,
          saldoInicial: inputSaldo.value
        };

        console.log('Enviando Conta ao Banco de Dados:', JSON.stringify(payload, null, 2));

        fetch('/api/contas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        .then(res => {
          if (!res.ok) throw new Error('Erro na requisição ao servidor');
          return res.json();
        })
        .then(data => {
          console.log('Conta cadastrada com sucesso no banco de dados!', data);
          alert('Conta cadastrada com sucesso!');
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