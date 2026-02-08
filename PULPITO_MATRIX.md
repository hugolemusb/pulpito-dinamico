# Púlpito Dinámico - Documentación Matriz (Master)

**Versión Actual:** v11.9.4 (Print Removed)
**Fecha de Actualización:** 07 Febrero 2026

## 1. Misión y Visión

Esta documentación sirve como la "Matriz" o fuente de verdad para el desarrollo continuo de Púlpito Dinámico. Todos los ajustes futuros deben alinearse con los criterios estéticos y funcionales aquí descritos para mantener la coherencia del proyecto.

## 2. Criterios de Diseño (UI/UX)

### Estilo Visual

- **Glassmorphism:** Se privilegia el uso de fondos semi-transparentes (`backdrop-blur-md`, `bg-white/90`) para dar una apariencia moderna y elegante.
- **Centrado y Legibilidad:** Los elementos flotantes importantes (como tooltips o modales) deben estar centrados en la pantalla y no depender de la posición del mouse, asegurando visibilidad en todos los dispositivos.
- **Adaptabilidad:** Todo componente debe funcionar correctamente tanto en **Modo Claro** como en **Modo Oscuro**, garantizando alto contraste.

### Interacción (Desktop & Mobile/iPad)

- **Paridad de Funciones:** Las funcionalidades de escritorio (hover) deben tener su contraparte táctil (click/tap) en iPad y móviles.
- **Eventos:** Usar `onClick` para interacciones principales en dispositivos táctiles donde `onMouseMove` no es efectivo.

## 3. Implementaciones Clave Recientes

### Visualizador de Versículos (Verse Tooltip)

- **Funcionalidad:** Al hacer clic (iPad) o pasar el cursor (Desktop) sobre una referencia bíblica (ej. "Juan 3:16"), se despliega el texto del versículo.
- **Ubicación:** Centralizada en la pantalla (`fixed`, `top: 50%`, `left: 50%`).
- **Código Clave:**
  - Componente: `BibleTooltip` en `SermonEditor.tsx`.
  - Manejador: `handleEditorClick` (asociado al `div` principal del editor).
  - Regex de detección: `BIBLE_REF_REGEX`.

## 4. Flujo de Trabajo y Despliegue

- **Repositorio:** [https://github.com/hugolemusb/pulpito-dinamico](https://github.com/hugolemusb/pulpito-dinamico)
- **Ramas:** Se trabaja sobre `main`.
- **Sincronización:** Se utilizan scripts dedicados (`sync-github.sh`) o comandos git estándar para asegurar que los cambios locales se reflejen en remoto.

## 5. Reglas para el Asistente (AI)

1. **Mantener el Hilo:** Consultar este documento antes de proponer cambios radicales de diseño.
2. **Priorizar Estabilidad:** No eliminar funcionalidades clave (como el autoguardado o la detección de versículos) al refactorizar.
3. **Idioma:** Respuesta y documentación siempre en **Español**.

---
*Este documento debe ser consultado y actualizado en cada sesión de mantenimiento.*
