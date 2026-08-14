# Reglas inmutables del proyecto

## AUTENTICACIÓN CON GOOGLE

Usar SIEMPRE Y EXCLUSIVAMENTE `signInWithPopup`. Queda terminantemente prohibido cambiar a
`signInWithRedirect` o alterar este flujo bajo cualquier circunstancia por incompatibilidad
con Safari e iOS.

- La función de login con Google (`handleGoogleLogin` en `src/context/AuthContext.jsx`) debe
  llamar a `signInWithPopup(auth, googleProvider)` directamente, sin pasar por
  `getRedirectResult` ni `signInWithRedirect`.
- El botón que dispara el login (`onGoogleLogin` en `src/components/auth/AuthScreen.jsx`) debe
  invocar el login como reacción directa al `onClick` del usuario (sin `await` previos, sin
  `setTimeout`, sin pasar primero por otra promesa), para que el navegador reconozca la
  apertura del popup como resultado de un gesto del usuario y no la bloquee.
- Esta regla no se debe modificar aunque se reporten problemas de popups bloqueados: la
  alternativa (`signInWithRedirect`) ya se probó en este proyecto y causó fallos peores en
  Safari/iOS. Cualquier problema de Google Auth se soluciona de otra forma, nunca cambiando
  este flujo.
