function initOrcamentoDrawerEvents() {
  const drawer = document.getElementById('orcamentoDrawer');
  const overlay = document.getElementById('drawerOverlay');
  const btnOpen = document.getElementById('btnOpenDrawer');
  const btnCancel = document.getElementById('btnCancel');
  const btnSave = document.getElementById('btnSave');
  const form = document.getElementById('orcamentoForm');
  
  const inputNome = document.getElementById('nomeOrcamento');
  const selectCategoria = document.getElementById('categoriaOrcamento');
  const inputLimite = document.getElementById('limiteGastos');
  const selectMes = document.getElementById('mesReferencia');

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
  if (inputLimite) {
    inputLimite.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\D/g, '');
      if (value === '') {
        e.target.value = '';
        return;
      }
      value = (parseInt(value, 10) / 100).toFixed(2);
      value = value.replace('.', ',');
      value = value.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      e.target.value = `R$ ${value}`;
      hideError('limiteGastos');
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
    ['nomeOrcamento', 'categoriaOrcamento', 'limiteGastos', 'mesReferencia'].forEach(hideError);
  }

  ['nomeOrcamento', 'categoriaOrcamento', 'limiteGastos', 'mesReferencia'].forEach(id => {
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
        showError('nomeOrcamento');
        isValid = false;
      }

      if (!selectCategoria || !selectCategoria.value) {
        showError('categoriaOrcamento');
        isValid = false;
      }

      if (!inputLimite || !inputLimite.value.trim()) {
        showError('limiteGastos');
        isValid = false;
      }

      if (!selectMes || !selectMes.value) {
        showError('mesReferencia');
        isValid = false;
      }

      if (isValid) {
        const payload = {
          nomeOrcamento: inputNome.value.trim(),
          categoria: selectCategoria.value,
          limiteGastos: inputLimite.value,
          mesReferencia: selectMes.value
        };

        console.log('Enviando Orçamento ao Banco de Dados:', JSON.stringify(payload, null, 2));

        fetch('/api/orcamentos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        .then(res => {
          if (!res.ok) throw new Error('Erro na requisição ao servidor');
          return res.json();
        })
        .then(data => {
          console.log('Orçamento cadastrado com sucesso no banco de dados!', data);
          alert('Orçamento criado com sucesso!');
          closeDrawer();
        })
        .catch(error => {
          console.warn('Erro ao conectar à API C#:', error);
          alert('Dados validados e prontos (API offline)!');
          closeDrawer();
        });
      }
    });
  }
}