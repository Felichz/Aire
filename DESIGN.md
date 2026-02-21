# Belu — Design System & Visual Polish Guide

> *"Lo sutil es lo que separa algo bonito de algo que se siente mágico."*

---

## Filosofía

El principio rector es **detalles de alto impacto y bajo ruido visual**. Cada micro-detalle debe sentirse como un susurro, no como un grito. La app debe sentirse como una experiencia sensorial completa — no solo algo que miras, sino algo que *sientes*.

### La regla de oro
> Si el usuario nota el detalle conscientemente → es demasiado.  
> Si el usuario siente que "algo se siente increíble" sin saber exactamente qué → es perfecto.

---

## 1. Tipografía — El alma silenciosa

### Estado actual
- Tipografía del sistema (San Francisco en iOS)
- Pesos: 200, 300, 400, 500, 600

### Mejoras propuestas

**a) Números con personalidad**
- El countdown grande (42px, weight 200) es correcto — números ultralight dan sensación de calma.
- **Agregar**: transición animada entre números. En lugar de un cambio abrupto de "4" a "3", el número actual se desvanece hacia arriba (fade + translateY -8px) mientras el nuevo aparece desde abajo. Duración: 300ms, easing: cubic-bezier(0.25, 0.1, 0.25, 1).

**b) Labels con respiración propia**
- El label "inhala", "sostén", "exhala" dentro del círculo debería tener una opacidad que pulse muy sutilmente con la respiración (0.5 → 0.7 durante inhale, hold en 0.65, 0.7 → 0.4 durante exhale).

**c) El título "breathe"**
- Letter-spacing actual: 12. Está bien para idle.
- **Agregar**: Cuando el timer corre, el letter-spacing se reduce suavemente a 8 (Animated.timing, 800ms). Efecto psicológico: el título "se concentra" junto contigo. Al detenerse, vuelve a expandirse a 12.

---

## 2. El Círculo — Centro espiritual de la app

### Estado actual
- Escala: 1.0 → 1.15 (inhale), hold pulse, 1.15 → 1.0 (exhale)
- Glow: opacity animada
- Borde: 1px rgba blanco

### Mejoras propuestas

**a) Anillo orbital sutil**
- Agregar un segundo anillo exterior al círculo principal, muy tenue (opacity 0.04-0.08).
- Este anillo rota lentamente (360° cada 30 segundos) con CSS transform rotate.
- El anillo tiene un dash-pattern: `borderStyle: 'dashed'` con segments muy finos.
- **Efecto**: Da sensación de movimiento celestial, como un reloj astral.

**b) Gradiente radial interior**
- En lugar de un `backgroundColor` plano (`rgba(255,255,255,0.012)`), usar un gradiente radial muy sutil del color de la fase actual:
  - Centro: `${phaseColor}08`
  - Borde: `transparent`
- **Efecto**: El círculo parece tener una luz interior tenue que respira con la fase.

**c) Micro-blur en el glow**
- El glow actual es un View sólido con opacity. Agregar `filter: blur(30px)` (web) o usar `expo-blur` (native) para que el halo sea difuso en lugar de un círculo sólido con bordes definidos.
- **Efecto**: Pasa de "una mancha de color" a "una niebla luminosa".

**d) Transición de color entre fases**
- Actualmente el color del círculo cambia instantáneamente cuando la fase cambia.
- **Mejorar**: Animar el color usando `Animated.interpolate` en un valor 0→1→2 que mapee a los tres colores de fase. La transición debería durar 600ms con easing suave.
- **Efecto**: Los colores fluyen uno al otro en lugar de saltar.

---

## 3. Las Cards — Ventanas de información

### Estado actual
- Rounded corners 24px, border sutil, glassmorphism ligero
- Shimmer en card activa
- Badge de número, emoji icon

### Mejoras propuestas

**a) Profundidad diferenciada**
- Card activa: `shadowOpacity: 0.15`, `shadowRadius: 20`, `shadowOffset: { height: 8 }` — con el shadowColor del color de la fase.
- Cards inactivas: sin sombra visible — solo el borde sutil.
- **Efecto**: La card activa "flota" sobre las demás.

**b) Glassmorphism mejorado**
- Agregar `backdropFilter: 'blur(12px)'` (funciona en web, en native sería simulado con expo-blur).
- Background ligeramente más transparente para que las partículas se vean a través.
- **Efecto**: Las cards se sienten como cristal flotante, no como rectángulos sólidos.

**c) Micro-animación del emoji**
- Cuando una card se vuelve activa, su emoji hace un pequeño bounce:
  - 🌸 (inhala): scale 1 → 1.3 → 1.0, duración 400ms, spring friction 4
  - ✨ (sostén): fade-pulse continuo (opacity 0.7 → 1.0, loop suave)
  - 🍃 (exhala): rotate 0 → -15° → 0°, como una hoja que se mece

**d) Progress indicator en la card activa**
- Agregar una línea muy fina (2px de alto) en la parte inferior de la card activa.
- Esta línea se llena de izquierda a derecha con el color de la fase, representando el progreso del countdown.
- Background de la línea: `rgba(255,255,255,0.04)`.
- **Efecto**: Feedback visual preciso del tiempo restante, sin agregar ruido.

---

## 4. Partículas — El universo respira contigo

### Estado actual
- 22 partículas flotando aleatoriamente
- 3 colores (uno por fase)
- Opacity 0.02-0.18

### Mejoras propuestas

**a) Sincronización respiratoria**
- Durante inhale: las partículas se mueven lentamente HACIA el círculo central (como si fueran atraídas).
- Durante exhale: las partículas se alejan del centro (como si fueran expulsadas suavemente).
- Durante hold: las partículas se detienen casi por completo, solo flotan en su lugar.
- **Efecto**: Todo el universo visual respira con el usuario.

**b) Partículas dominantes por fase**
- Cuando la fase cambia, las partículas del color de esa fase se vuelven ligeramente más brillantes (opacity +0.05), y las otras se atenúan.
- **Efecto**: El ambiente cambia sutilmente de color con cada fase.

**c) Estrellas estáticas de fondo**
- Agregar 40-60 puntos estáticos de 1px, opacity 0.03-0.06, distribuidos aleatoriamente.
- Ocasionalmente (cada 5-10 segundos), una estrella hace un "twinkle" (opacity sube a 0.15 y baja, duración 800ms).
- **Efecto**: Profundidad. El fondo no es un color plano, es un cielo nocturno.

---

## 5. Botón Play — El corazón de la interacción

### Estado actual
- Glow pulsante cuando idle
- Scale bounce al presionar
- Color cambia con la fase cuando corre

### Mejoras propuestas

**a) Anillo de carga al iniciar**
- Al presionar Play, antes de que empiece la primera fase, un anillo circular (stroke, no fill) se dibuja alrededor del botón en 500ms (como un "activando...").
- El anillo se completa y luego se desvanece a medida que empieza la fase de inhale.
- **Efecto**: Feedback satisfactorio de "la acción se registró".

**b) Ripple effect al tocar**
- Además del scale bounce, agregar un pequeño ripple circular que se expande desde el punto de toque y se desvanece.
- Diámetro final: 120px, opacity: 0.15 → 0, duración: 400ms.
- Color: el color del botón pero más claro.

**c) Transición play → pause más fluida**
- En lugar de cambiar el ícono instantáneamente (▶️ → ⏸), hacer un morph:
  - El triángulo se divide en dos barras (el lado izquierdo del triángulo se vuelve la barra izquierda, el derecho la barra derecha).
  - Alternativamente: crossfade rápido (150ms) con un micro-scale (0.8 → 1.0).

---

## 6. Transiciones de fase — La coreografía

### Estado actual
- El cambio de fase es instantáneo (color cambia, card se scrollea).

### Mejoras propuestas

**a) Secuencia de transición (500ms total)**
1. **0-150ms**: El color actual se atenúa (opacity del glow baja un 20%).
2. **150-350ms**: El nuevo color emerge (crossfade). La card se scrollea.
3. **350-500ms**: Todo se estabiliza en el nuevo estado.

**b) Haptics sincronizados**
- Inhale → Sostén: `Haptics.impactAsync(Light)` — un toque sutil.
- Sostén → Exhale: `Haptics.impactAsync(Medium)` — un toque un poco más firme.
- Exhale → Inhale (nuevo ciclo): `Haptics.notificationAsync(Success)` — patrón de "logro".
- Último ciclo completado: `Haptics.notificationAsync(Success)` × 2, con 200ms de delay.

**c) Rep dots como mini celebración**
- Cuando un ciclo se completa, el dot correspondiente no solo cambia de color — hace un pequeño "pop" (scale 1 → 1.5 → 1, spring, 300ms) y emite un mini flash de su color (un círculo que se expande y desaparece, 200ms).

---

## 7. Estado completado — El momento de orgullo

### Propuesta nueva (no existe actualmente)

Cuando los 5 ciclos terminan, en lugar de volver silenciosamente al estado idle:

**a) Pantalla de cierre (3 segundos)**
- El círculo hace un último pulse grande (scale 1.3) y se desvanece.
- Aparece un mensaje centrado: "listo ✨" con fade-in (opacity 0 → 1, 600ms).
- Debajo, en texto más pequeño: "5 ciclos · 1m 35s" (duración total).
- Background: un brillo muy tenue del último color de fase que se disipa.

**b) Haptic pattern de cierre**
- Un patrón de vibración suave: `Light, 100ms pause, Light, 100ms pause, Success`.
- Se siente como un "ta-ta-taaaa" satisfactorio.

**c) Auto-dismiss**
- Después de 3 segundos, esta pantalla se desvanece y vuelve al idle normal.
- O el usuario puede tocar en cualquier parte para volver inmediatamente.

---

## 8. Colores — La paleta emocional

### Estado actual
```
Inhale:  #8b7cf8  (violeta suave)
Hold:    #e8a065  (ámbar cálido)
Exhale:  #5cc4c8  (teal oceánico)
```

### Mejoras propuestas

**a) Gradientes en lugar de colores planos**
- En elementos clave (botón play, progress bar de card), usar gradientes sutiles en lugar de colores sólidos:
  - Inhale: `#8b7cf8` → `#a78bfa` (violeta a lavanda)
  - Hold: `#e8a065` → `#f0c27f` (ámbar a dorado)
  - Exhale: `#5cc4c8` → `#6ee7b7` (teal a menta)

**b) Color del fondo respira**
- El background no debería ser estáticamente `#08081a`.
- Durante cada fase, un tinte ULTRA sutil del color de fase se mezcla con el fondo:
  - `#08081a` + `${phaseColor}03` (3% de opacidad sobre todo el fondo).
- **Efecto**: El ambiente general cambia de tono sin que el usuario lo note conscientemente.

---

## 9. Sonido (Futuro)

No implementar ahora, pero diseñar para ello:

**a) Tono de transición**
- Un tono suave (sine wave, 200-400Hz) de 200ms que suena en cada cambio de fase.
- Pitch diferente por fase: inhale (Do), hold (Mi), exhale (Sol).

**b) Ambiente de fondo** (opcional, toggle en settings)
- Un drone pad muy bajo (casi subliminal) que cambia de tono con cada fase.
- Volumen: apenas perceptible con todo silencioso.

---

## 10. Priorización de implementación

### 🟢 Alto impacto, fácil de implementar
1. Transición animada de números en el countdown
2. Progress bar en la card activa
3. Sombra en card activa (floating effect)
4. Color del fondo que respira con la fase
5. Haptics diferenciados por transición de fase
6. Pantalla de "completado" al terminar

### 🟡 Impacto medio, esfuerzo moderado
7. Anillo orbital sutil en el círculo
8. Micro-animación de emojis
9. Partículas sincronizadas con la respiración
10. Estrellas estáticas con twinkle
11. Title letter-spacing animado
12. Label opacity que respira

### 🔵 Impacto alto, esfuerzo alto
13. Transición morph play/pause
14. Anillo de carga al iniciar
15. Crossfade de colores entre fases
16. Glassmorphism real con backdrop-filter
17. Glow con blur difuso

---

*Cada detalle es un regalo para el usuario. Ninguno es necesario por separado, pero juntos crean algo que se siente vivo.*
