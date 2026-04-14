(function () {
  const script = document.currentScript;
  const clientId = script.getAttribute('data-client-id');
  const apiBase = script.getAttribute('data-api-url') || 'http://localhost:3000';

  if (!clientId) {
    console.error('[Widget] Falta el atributo data-client-id');
    return;
  }

  // ---------------------------------------------------------------------------
  // 1. Cargar config del cliente antes de renderizar
  // ---------------------------------------------------------------------------
  fetch(apiBase + '/widget/' + clientId + '/config')
    .then(function (res) {
      if (!res.ok) throw new Error('Widget no disponible');
      return res.json();
    })
    .then(function (config) {
      init(config);
    })
    .catch(function (err) {
      console.error('[Widget] No se pudo cargar la configuración:', err.message);
    });

  // ---------------------------------------------------------------------------
  // 2. Inicializar con la config cargada
  // ---------------------------------------------------------------------------
  function init(config) {
    const color = config.color || '#2563eb';
    const nombre = config.nombre || 'Asistente virtual';
    const bienvenida = config.bienvenida || '';
    const sessionId = 'session-' + Math.random().toString(36).slice(2, 10);

    // --- Estilos ---
    const style = document.createElement('style');
    style.textContent = `
      #cw-btn {
        position: fixed; bottom: 24px; right: 24px;
        width: 56px; height: 56px; border-radius: 50%;
        background: ${color}; color: #fff; border: none;
        font-size: 26px; cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 9999;
        transition: transform 0.2s;
      }
      #cw-btn:hover { transform: scale(1.08); }
      #cw-box {
        display: none; position: fixed; bottom: 92px; right: 24px;
        width: 360px; height: 500px; background: #fff;
        border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        flex-direction: column; z-index: 9999; overflow: hidden;
      }
      #cw-box.open { display: flex; }
      #cw-header {
        background: ${color}; color: #fff; padding: 14px 16px;
        font-weight: 600; font-size: 15px; font-family: sans-serif;
        display: flex; justify-content: space-between; align-items: center;
      }
      #cw-close {
        background: none; border: none; color: #fff;
        font-size: 18px; cursor: pointer; line-height: 1; padding: 0;
      }
      #cw-messages {
        flex: 1; overflow-y: auto; padding: 12px;
        display: flex; flex-direction: column; gap: 8px;
        font-family: sans-serif; font-size: 14px;
      }
      .cw-msg {
        max-width: 80%; padding: 8px 12px; border-radius: 8px; line-height: 1.5;
        word-break: break-word;
      }
      .cw-msg.user {
        background: ${color}; color: #fff;
        align-self: flex-end; border-bottom-right-radius: 2px;
      }
      .cw-msg.bot {
        background: #f1f5f9; color: #1e293b;
        align-self: flex-start; border-bottom-left-radius: 2px;
      }
      .cw-msg.typing { color: #94a3b8; font-style: italic; }
      #cw-form {
        display: flex; border-top: 1px solid #e2e8f0; padding: 10px; gap: 8px;
      }
      #cw-input {
        flex: 1; border: 1px solid #e2e8f0; border-radius: 6px;
        padding: 8px 10px; font-size: 14px; outline: none; font-family: sans-serif;
      }
      #cw-input:focus { border-color: ${color}; }
      #cw-send {
        background: ${color}; color: #fff; border: none;
        border-radius: 6px; padding: 8px 14px; cursor: pointer; font-size: 14px;
      }
    `;
    document.head.appendChild(style);

    // --- HTML ---
    const btn = document.createElement('button');
    btn.id = 'cw-btn';
    btn.textContent = '💬';
    btn.setAttribute('aria-label', 'Abrir chat');

    const box = document.createElement('div');
    box.id = 'cw-box';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', nombre);
    box.innerHTML =
      '<div id="cw-header">' +
        '<span>' + escapeHtml(nombre) + '</span>' +
        '<button id="cw-close" aria-label="Cerrar">✕</button>' +
      '</div>' +
      '<div id="cw-messages"></div>' +
      '<form id="cw-form">' +
        '<input id="cw-input" type="text" placeholder="Escribí tu consulta..." autocomplete="off" />' +
        '<button id="cw-send" type="submit">Enviar</button>' +
      '</form>';

    document.body.appendChild(btn);
    document.body.appendChild(box);

    const messages = box.querySelector('#cw-messages');
    const form = box.querySelector('#cw-form');
    const input = box.querySelector('#cw-input');
    const closeBtn = box.querySelector('#cw-close');

    // Mensaje de bienvenida
    if (bienvenida) {
      addMessage(bienvenida, 'bot');
    }

    // --- Eventos ---
    btn.addEventListener('click', function () {
      box.classList.add('open');
      btn.style.display = 'none';
      input.focus();
    });

    closeBtn.addEventListener('click', function () {
      box.classList.remove('open');
      btn.style.display = '';
    });

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var mensaje = input.value.trim();
      if (!mensaje) return;

      input.value = '';
      input.disabled = true;
      addMessage(mensaje, 'user');
      var typing = addMessage('Escribiendo...', 'bot typing');

      try {
        var res = await fetch(apiBase + '/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-client-id': clientId,
          },
          body: JSON.stringify({ mensaje: mensaje, sessionId: sessionId }),
        });

        var data = await res.json();
        typing.remove();
        addMessage(data.respuesta || 'Error al obtener respuesta', 'bot');
      } catch (err) {
        typing.remove();
        addMessage('Error de conexión. Intentá de nuevo.', 'bot');
      } finally {
        input.disabled = false;
        input.focus();
      }
    });

    function addMessage(text, role) {
      var div = document.createElement('div');
      div.className = 'cw-msg ' + role;
      div.textContent = text;
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
      return div;
    }
  }

  function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
})();
