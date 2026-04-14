(function () {
  const script = document.currentScript;
  const clientId = script.getAttribute('data-client-id');
  const apiBase = script.getAttribute('data-api-url') || 'http://localhost:3000';

  if (!clientId) {
    console.error('[Widget] Falta el atributo data-client-id');
    return;
  }

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

  function init(config) {
    const color = config.color || '#2563eb';
    const nombre = config.nombre || 'Asistente virtual';
    const bienvenida = config.bienvenida || '';
    const sessionId = 'session-' + Math.random().toString(36).slice(2, 10);
    const inicial = nombre.charAt(0).toUpperCase();

    const style = document.createElement('style');
    style.textContent = `
      #cw-btn {
        position: fixed; bottom: 24px; right: 24px;
        width: 56px; height: 56px; border-radius: 50%;
        background: ${color}; color: #fff; border: none;
        font-size: 26px; cursor: pointer;
        box-shadow: 0 4px 16px rgba(0,0,0,0.25); z-index: 9999;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      #cw-btn:hover { transform: scale(1.08); box-shadow: 0 6px 20px rgba(0,0,0,0.3); }

      @keyframes cw-slidein {
        from { opacity: 0; transform: translateY(16px) scale(0.97); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
      #cw-box {
        display: none; position: fixed; bottom: 92px; right: 24px;
        width: 370px; height: 540px; background: #fff;
        border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.2);
        flex-direction: column; z-index: 9999; overflow: hidden;
      }
      #cw-box.open {
        display: flex;
        animation: cw-slidein 0.22s ease;
      }

      #cw-header {
        background: ${color}; color: #fff; padding: 14px 16px;
        font-weight: 600; font-size: 15px; font-family: system-ui, sans-serif;
        display: flex; justify-content: space-between; align-items: center;
        flex-shrink: 0;
      }
      #cw-close {
        background: none; border: none; color: #fff;
        font-size: 18px; cursor: pointer; line-height: 1; padding: 4px;
        border-radius: 4px; transition: background 0.15s; opacity: 0.85;
      }
      #cw-close:hover { background: rgba(255,255,255,0.2); opacity: 1; }

      #cw-messages {
        flex: 1; overflow-y: auto; padding: 14px 12px;
        display: flex; flex-direction: column; gap: 10px;
        font-family: system-ui, sans-serif; font-size: 14px;
        scroll-behavior: smooth;
      }
      #cw-messages::-webkit-scrollbar { width: 4px; }
      #cw-messages::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }

      .cw-row {
        display: flex; align-items: flex-end; gap: 8px;
      }
      .cw-row.user { flex-direction: row-reverse; }

      .cw-avatar {
        width: 28px; height: 28px; border-radius: 50%;
        background: ${color}; color: #fff;
        font-size: 12px; font-weight: 700; font-family: system-ui, sans-serif;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0; margin-bottom: 2px;
      }

      .cw-bubble-wrap { display: flex; flex-direction: column; max-width: 78%; }
      .cw-row.user .cw-bubble-wrap { align-items: flex-end; }

      .cw-msg {
        padding: 9px 13px; border-radius: 14px; line-height: 1.55;
        word-break: break-word; font-size: 14px;
      }
      .cw-msg.user {
        background: ${color}; color: #fff;
        border-bottom-right-radius: 3px;
      }
      .cw-msg.bot {
        background: #f1f5f9; color: #1e293b;
        border-bottom-left-radius: 3px;
      }
      .cw-msg strong { font-weight: 700; }
      .cw-msg em { font-style: italic; }
      .cw-msg ul, .cw-msg ol { margin: 4px 0 4px 16px; padding: 0; }
      .cw-msg li { margin-bottom: 2px; }

      .cw-time {
        font-size: 11px; color: #94a3b8; margin-top: 3px;
        font-family: system-ui, sans-serif;
      }

      /* Typing dots */
      .cw-typing {
        display: flex; align-items: center; gap: 4px;
        padding: 10px 14px; background: #f1f5f9;
        border-radius: 14px; border-bottom-left-radius: 3px;
      }
      @keyframes cw-bounce {
        0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
        40%            { transform: translateY(-5px); opacity: 1; }
      }
      .cw-dot {
        width: 7px; height: 7px; border-radius: 50%;
        background: #94a3b8; animation: cw-bounce 1.2s infinite;
      }
      .cw-dot:nth-child(2) { animation-delay: 0.15s; }
      .cw-dot:nth-child(3) { animation-delay: 0.3s; }

      #cw-form {
        display: flex; border-top: 1px solid #e2e8f0;
        padding: 10px; gap: 8px; align-items: flex-end; flex-shrink: 0;
        background: #fff;
      }
      #cw-input {
        flex: 1; border: 1px solid #e2e8f0; border-radius: 10px;
        padding: 9px 12px; font-size: 14px; outline: none;
        font-family: system-ui, sans-serif;
        color: #000; background: #fff;
        resize: none; max-height: 120px; overflow-y: hidden;
        line-height: 1.45; transition: border-color 0.15s;
      }
      #cw-input:focus { border-color: ${color}; }
      #cw-send {
        background: ${color}; color: #fff; border: none;
        border-radius: 10px; padding: 9px 15px; cursor: pointer;
        font-size: 14px; font-family: system-ui, sans-serif;
        transition: opacity 0.15s; flex-shrink: 0; align-self: flex-end;
      }
      #cw-send:disabled { opacity: 0.45; cursor: not-allowed; }
      #cw-send:not(:disabled):hover { opacity: 0.88; }
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
        '<textarea id="cw-input" placeholder="Escribí tu consulta..." autocomplete="off" rows="1"></textarea>' +
        '<button id="cw-send" type="submit">Enviar</button>' +
      '</form>';

    document.body.appendChild(btn);
    document.body.appendChild(box);

    const messages = box.querySelector('#cw-messages');
    const form = box.querySelector('#cw-form');
    const input = box.querySelector('#cw-input');
    const sendBtn = box.querySelector('#cw-send');
    const closeBtn = box.querySelector('#cw-close');

    // Auto-resize textarea
    input.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });

    // Submit con Enter (Shift+Enter = salto de línea)
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form.dispatchEvent(new Event('submit'));
      }
    });

    if (bienvenida) {
      addMessage(bienvenida, 'bot');
    }

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
      input.style.height = 'auto';
      input.disabled = true;
      sendBtn.disabled = true;
      addMessage(mensaje, 'user');
      var typingRow = addTyping();

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
        typingRow.remove();
        addMessage(data.respuesta || 'Error al obtener respuesta', 'bot');
      } catch (err) {
        typingRow.remove();
        addMessage('Error de conexión. Intentá de nuevo.', 'bot');
      } finally {
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
      }
    });

    function addMessage(text, role) {
      var row = document.createElement('div');
      row.className = 'cw-row ' + role;

      var wrap = document.createElement('div');
      wrap.className = 'cw-bubble-wrap';

      var bubble = document.createElement('div');
      bubble.className = 'cw-msg ' + role;
      if (role === 'bot') {
        bubble.innerHTML = parseMarkdown(text);
      } else {
        bubble.textContent = text;
      }

      var time = document.createElement('div');
      time.className = 'cw-time';
      time.textContent = getTime();

      wrap.appendChild(bubble);
      wrap.appendChild(time);

      if (role === 'bot') {
        var avatar = document.createElement('div');
        avatar.className = 'cw-avatar';
        avatar.textContent = inicial;
        row.appendChild(avatar);
      }

      row.appendChild(wrap);
      messages.appendChild(row);
      messages.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'end' });
      return row;
    }

    function addTyping() {
      var row = document.createElement('div');
      row.className = 'cw-row bot';

      var avatar = document.createElement('div');
      avatar.className = 'cw-avatar';
      avatar.textContent = inicial;

      var typing = document.createElement('div');
      typing.className = 'cw-typing';
      typing.innerHTML = '<div class="cw-dot"></div><div class="cw-dot"></div><div class="cw-dot"></div>';

      row.appendChild(avatar);
      row.appendChild(typing);
      messages.appendChild(row);
      row.scrollIntoView({ behavior: 'smooth', block: 'end' });
      return row;
    }

    function getTime() {
      var d = new Date();
      return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
    }

    function parseMarkdown(text) {
      var escaped = escapeHtml(text);

      // Listas no ordenadas
      escaped = escaped.replace(/(?:^|\n)((?:[ \t]*[-*] .+(?:\n|$))+)/g, function (_, block) {
        var items = block.trim().split('\n').map(function (line) {
          return '<li>' + line.replace(/^[ \t]*[-*] /, '') + '</li>';
        }).join('');
        return '<ul>' + items + '</ul>';
      });

      // Listas ordenadas
      escaped = escaped.replace(/(?:^|\n)((?:[ \t]*\d+\. .+(?:\n|$))+)/g, function (_, block) {
        var items = block.trim().split('\n').map(function (line) {
          return '<li>' + line.replace(/^[ \t]*\d+\. /, '') + '</li>';
        }).join('');
        return '<ol>' + items + '</ol>';
      });

      // Negrita e itálica
      escaped = escaped
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>');

      // Saltos de línea (fuera de listas)
      escaped = escaped.replace(/\n/g, '<br>');

      return escaped;
    }
  }

  function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
})();
