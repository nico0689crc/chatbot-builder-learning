# SKILL: system-prompt

## Cuándo leer este archivo

Leé este archivo antes de escribir, revisar o adaptar un system prompt.
Aplica cuando el usuario pide:
- "Escribí el system prompt para [tipo de negocio]"
- "Revisá este system prompt"
- "Adaptá la plantilla para [cliente específico]"
- "El bot no está respondiendo bien, revisemos el prompt"

También leé [`../prompts/system-prompts.md`](../prompts/system-prompts.md)
para las plantillas base por arquetipo.

---

## Qué es el system prompt en el builder

El system prompt es la "personalidad programada" del bot. Se envía completo
en cada llamada a la IA — es el único lugar donde definís quién es el bot,
qué sabe y cómo se comporta.

**Impacto en costo:** Se paga en cada mensaje de cada usuario.
Un prompt de 800 palabras cuesta 4 veces más que uno de 200.
La disciplina es: denso y preciso, no largo y vago.

---

## Los 6 bloques obligatorios — siempre en este orden

### Bloque 1 — Identidad
```
Sos [nombre del bot], el asistente virtual de [nombre del negocio].
[Una oración sobre el rol principal del bot]
```
Reglas:
- Nombre del bot = nombre memorable, no genérico
- Siempre mencionar el negocio explícitamente
- Una sola oración de rol — si necesitás más, el rol no está claro

### Bloque 2 — Tono y personalidad
```
TONO:
- [adjetivo]: [qué significa en la práctica]
- [adjetivo]: [qué significa en la práctica]
- [palabras que usaría / palabras que nunca usaría]
```
Reglas:
- Máximo 3 características de tono
- Siempre dar ejemplos concretos, no adjetivos solos
- Incluir al menos una cosa que el bot NO haría

### Bloque 3 — Conocimiento del negocio
```
INFORMACIÓN:
[datos concretos: horarios, precios, servicios, ubicación, políticas]
```
Reglas:
- Solo hechos verificables, no opiniones
- Formato de lista para escaneabilidad
- Si hay datos que cambian frecuentemente (precios), definir proceso de actualización

### Bloque 4 — Capacidades
```
PODÉS HACER:
[lista de lo que puede responder o ejecutar]
```
Para arquetipos con tools, mencionar explícitamente cuándo consultar datos externos.

### Bloque 5 — Límites (el más importante y el más olvidado)
```
NO PODÉS HACER / LÍMITES:
[lista de lo que no responde, con instrucción exacta de qué decir en cada caso]
```
Reglas:
- Cada límite tiene una respuesta literal de qué decir
- No dejar al bot sin instrucción para casos difíciles
- Siempre incluir: insultos, urgencias, temas legales/médicos si aplica

### Bloque 6 — Escalado
```
CUÁNDO Y CÓMO ESCALAR:
[condiciones] → [qué decir exactamente] → [cómo derivar]
```
Reglas:
- Las condiciones de escalado deben ser específicas, no vagas
- Siempre incluir el texto exacto que el bot dice al escalar
- Nunca escalar sin contexto — el agente humano necesita saber de qué trata

---

## Proceso para escribir un system prompt nuevo

### 1. Extraer del discovery
Antes de escribir, identificar:
- ¿Cuáles son las 5 preguntas más frecuentes del negocio? → Bloque 3
- ¿Qué tono usa el negocio en sus comunicaciones? → Bloque 2
- ¿Qué NO quieren que responda el bot? → Bloque 5
- ¿Cuándo quieren que intervenga un humano? → Bloque 6

### 2. Escribir el borrador
Usar la plantilla del arquetipo como base.
Completar cada bloque con datos reales del cliente.

### 3. Aplicar el checklist de calidad (abajo)

### 4. Validar con el cliente
Mostrar el borrador al cliente y preguntar:
- "¿Hay algo que el bot podría decir que no querés?"
- "¿Hay algún caso que no contemplamos?"

### 5. Probar antes de publicar
```bash
# Probar al menos estos 4 casos:
# 1. Pregunta típica → el bot responde correctamente
# 2. Pregunta fuera del dominio → el bot deriva bien
# 3. Insulto o mensaje inapropiado → el bot responde con dignidad
# 4. Pedido de hablar con humano → el bot escala correctamente
```

---

## Checklist de calidad del system prompt

Antes de usar un system prompt con un cliente real:

**Estructura:**
- [ ] Tiene los 6 bloques en el orden correcto
- [ ] Cada bloque está claramente diferenciado

**Precisión:**
- [ ] Los datos del negocio son correctos y están verificados
- [ ] Los horarios, precios y servicios coinciden con la realidad actual

**Límites:**
- [ ] Tiene instrucción de qué decir cuando alguien insulta
- [ ] Tiene instrucción de qué decir cuando pide hablar con una persona
- [ ] Tiene instrucción de qué hacer con preguntas fuera del dominio
- [ ] Si el negocio tiene temas sensibles (legal, médico, etc.) están cubiertos

**Escalado:**
- [ ] Las condiciones de escalado son específicas
- [ ] Incluye el texto exacto que el bot dice al escalar
- [ ] El agente humano recibe contexto suficiente al escalar

**Eficiencia:**
- [ ] Tiene menos de 500 palabras (si tiene más, intentar condensar)
- [ ] Cada instrucción es necesaria — eliminar las redundantes
- [ ] No hay contradicciones entre bloques

**Validación:**
- [ ] El cliente lo revisó y aprobó
- [ ] Se probaron los 4 casos básicos

---

## Señales de un system prompt problemático

Si el bot se comporta mal, buscar estas señales en el prompt:

| Comportamiento del bot | Problema probable | Solución |
|----------------------|-------------------|---------|
| Inventa información | No tiene límites claros | Agregar "No inventes información que no esté aquí" |
| Ignora el tono | Tono no está definido con ejemplos | Agregar ejemplos concretos de frases |
| Responde cosas que no debería | Límites vagos | Especificar exactamente qué decir en cada caso |
| No escala cuando debería | Condiciones de escalado vagas | Definir condiciones específicas y observables |
| Respuestas muy largas | No tiene instrucción de concisión | Agregar "Respondé en máximo 3 oraciones" |
| Olvida el contexto rápido | maxHistorial muy bajo | Aumentar en ConfigCliente |
| Tono incorrecto para el negocio | Temperatura demasiado alta/baja | Ajustar temperatura en ConfigCliente |
