const showNotice = (id, message, type = 'error') => {
  const notice = document.getElementById(id);
  if (!notice) return;
  notice.textContent = message;
  notice.className = `notice show ${type}`;
};

const send = async (path, payload) => {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.message || 'Não foi possível concluir. Tente novamente.');
    error.status = response.status;
    throw error;
  }
  return result;
};

document.getElementById('login-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const user = await send('/api/auth/login', {
      email: form.email.value,
      senha: form.senha.value
    });
    sessionStorage.setItem('usuario', JSON.stringify(user));
    window.location.href = user.planoSelecionado ? '/app.html#visao-geral' : '/plano.html';
  } catch (error) {
    showNotice('login-notice', error.message);
  } finally {
    button.disabled = false;
  }
});

document.getElementById('register-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  if (form.senha.value !== form.confirmarSenha.value) {
    showNotice('register-notice', 'As senhas não coincidem.');
    form.confirmarSenha.focus();
    return;
  }
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    await send('/api/auth/register', {
      nome: form.nome.value,
      email: form.email.value,
      senha: form.senha.value
    });
    window.location.href = '/login.html?cadastro=sucesso';
  } catch (error) {
    showNotice('register-notice', error.message);
  } finally {
    button.disabled = false;
  }
});

document.getElementById('forgot-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    await send('/api/auth/forgot-password', { email: form.email.value });
    window.location.href = '/confirmacao-senha.html';
  } catch (error) {
    showNotice('forgot-notice', error.message);
  } finally {
    button.disabled = false;
  }
});

document.getElementById('choose-plan')?.addEventListener('click', async () => {
  const user = sessionStorage.getItem('usuario');
  if (!user) {
    window.location.href = '/cadastro.html?plano=individual';
    return;
  }
  const button = document.getElementById('choose-plan');
  button.disabled = true;
  try {
    await send('/api/auth/plan', {});
    window.location.href = '/app.html#visao-geral';
  } catch (error) {
    if (error.status === 401) {
      window.location.href = '/login.html';
      return;
    }
    document.getElementById('plan-message').textContent = error.message;
    button.disabled = false;
  }
});

if (window.location.search.includes('cadastro=sucesso')) {
  showNotice('login-notice', 'Conta criada com sucesso. Entre para continuar.', 'success');
}
