(function () {
  const script = document.currentScript;
  const clientId = script.getAttribute('data-client-id');
  const apiBase = script.getAttribute('data-api-url') || window.location.origin;

  if (!clientId) {
    console.error('[Widget] Falta el atributo data-client-id');
    return;
  }

  // ---------------------------------------------------------------------------
  // Estilos
  // ---------------------------------------------------------------------------
  const style = document.createElement('style');
  style.textContent = `
    #chatbot-widget-btn {
      position: fixed; bottom: 24px; right: 24px;
      width: 56px; height: 56px; border-radius: 50%;
      background: #2563eb; color: #fff; border: none;
      font-size: 26px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 9999;
    }
    #chatbot-widget-box {
      display: none; position: fixed; bottom: 92px; right: 24px;
      width: 360px; height: 480px; background: #fff;
      border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.15);
      flex-direction: column; z-index: 9999; overflow: hidden;
    }
    #chatbot-widget-box.open { display: flex; }
    #chatbot-widget-header {
      background: #2563eb; color: #fff; padding: 14px 16px;
      font-weight: 600; font-size: 15px; font-family: sans-serif;
    }
    #chatbot-widget-messages {
      flex: 1; overflow-y: auto; padding: 12px;
      display: flex; flex-direction: column; gap: 8px;
      font-family: sans-serif; font-size: 14px;
    }
    .cw-msg { max-width: 80%; padding: 8px 12px; border-radius: 8px; line-height: 1.4; }
    .cw-msg.user { background: #2563eb; color: #fff; align-self: flex-end; border-bottom-right-radius: 2px; }
    .cw-msg.bot  { background: #f1f5f9; color: #1e293b; align-self: flex-start; border-bottom-left-radius: 2px; }
    .cw-msg.typing { color: #94a3b8; font-style: italic; }
    #chatbot-widget-form {
      display: flex; border-top: 1px solid #e2e8f0; padding: 10px;
      gap: 8px;
    }
    #chatbot-widget-input {
      flex: 1; border: 1px solid #e2e8f0; border-radius: 6px;
      padding: 8px 10px; font-size: 14px; outline: none; font-family: sans-serif;
    }
    #chatbot-widget-send {
      background: #2563eb; color: #fff; border: none;
      border-radius: 6px; padding: 8px 14px; cursor: pointer; font-size: 14px;
    }
  `;
  document.head.appendChild(style);

  // ---------------------------------------------------------------------------
  // HTML
  // ---------------------------------------------------------------------------
  const sessionId = 'session-' + Math.random().toString(36).slice(2, 10);

  const btn = document.createElement('button');
  btn.id = 'chatbot-widget-btn';
  btn.textContent = '💬';

  const box = document.createElement('div');
  box.id = 'chatbot-widget-box';
  box.innerHTML = `
    <div id="chatbot-widget-header">Asistente virtual</div>
    <div id="chatbot-widget-messages"></div>
    <form id="chatbot-widget-form">
      <input id="chatbot-widget-input" type="text" placeholder="Escribí tu consulta..." autocomplete="off" />
      <button id="chatbot-widget-send" type="submit">Enviar</button>
    </form>
  `;

  document.body.appendChild(btn);
  document.body.appendChild(box);

  // ---------------------------------------------------------------------------
  // Lógica
  // ---------------------------------------------------------------------------
  btn.addEventListener('click', () => box.classList.toggle('open'));

  const messages = box.querySelector('#chatbot-widget-messages');
  const form = box.querySelector('#chatbot-widget-form');
  const input = box.querySelector('#chatbot-widget-input');

  function addMessage(text, role) {
    const div = document.createElement('div');
    div.className = 'cw-msg ' + role;
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mensaje = input.value.trim();
    if (!mensaje) return;

    input.value = '';
    addMessage(mensaje, 'user');
    const typing = addMessage('Escribiendo...', 'bot typing');

    try {
      const res = await fetch(apiBase + '/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': clientId,
        },
        body: JSON.stringify({ mensaje, sessionId }),
      });

      const data = await res.json();
      typing.remove();
      addMessage(data.respuesta || 'Error al obtener respuesta', 'bot');
    } catch (err) {
      typing.remove();
      addMessage('Error de conexión. Intentá de nuevo.', 'bot');
    }
  });
})();
