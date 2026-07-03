# AGENTS.md

Este archivo le da contexto al agente de IA (OpenCode u otro) sobre cómo trabajar en este repositorio.

## Contexto del proyecto

- **Nombre**: the-factory
- **Stack**: Vite + TypeScript + React + shadcn-ui + Tailwind CSS
- **Origen**: proyecto creado con Lovable
- **Deploy**: Vercel, conectado a este repositorio → https://the-factory-seven.vercel.app
- **Rama principal**: `master` (⚠️ no `main`)

## Flujo de trabajo con Git

Cada vez que hagas un cambio en el código que yo apruebe, debes:

1. Ejecutar `git add .`
2. Hacer `git commit` con un mensaje corto y descriptivo del cambio (en español, tipo: `fix: corrige validación de formulario`, `feat: agrega editor WYSIWYG`)
3. Hacer `git push origin master`

No me pidas confirmación cada vez — hazlo automáticamente después de cada cambio funcional y probado, para que Vercel despliegue automáticamente y yo pueda ver los cambios reflejados en la URL de producción.

### Excepciones
- Si el cambio es experimental, riesgoso, o puede romper producción, avísame antes de hacer push y espera mi confirmación.
- Si hay conflictos de merge, detente y explícamelos en vez de forzar el push.

## Convenciones de código

- Usar TypeScript estricto, evitar `any` cuando sea posible.
- Seguir la estructura de componentes ya existente en `src/`.
- Usar los componentes de `shadcn-ui` ya instalados en vez de crear componentes de UI desde cero, cuando aplique.
- Mantener el estilo de Tailwind ya usado en el proyecto (clases utilitarias, sin CSS-in-JS adicional).

## Notas adicionales
- Cualquier variable de entorno o configuración sensible no debe subirse al repo (verificar `.gitignore`).
