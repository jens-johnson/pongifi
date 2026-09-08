/**
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 *
 *                                  ██████╗  ██████╗ ███╗   ██╗ ██████╗ ██╗███████╗██╗
 *                                  ██╔══██╗██╔═══██╗████╗  ██║██╔════╝ ██║██╔════╝██║
 *                                  ██████╔╝██║   ██║██╔██╗ ██║██║  ███╗██║█████╗  ██║
 *                                  ██╔═══╝ ██║   ██║██║╚██╗██║██║   ██║██║██╔══╝  ██║
 *                                  ██║     ╚██████╔╝██║ ╚████║╚██████╔╝██║██║     ██║
 *                                  ╚═╝      ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝ ╚═╝╚═╝     ╚═╝
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 * ███████████████████████████████████████████ #middleware/session.global.ts ███████████████████████████████████████████
 *
 * Routes every request according to the session behind it, before the page renders.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { RouteLocationNormalized } from 'vue-router';

export default defineNuxtRouteMiddleware((to: RouteLocationNormalized): ReturnType<typeof navigateTo> | undefined => {
  const { loggedIn, user }: ReturnType<typeof useUserSession> = useUserSession();

  const destination: string | null = resolveSessionGate({
    fullPath: to.fullPath,
    loggedIn: loggedIn.value,
    needsWelcome: user.value?.needsWelcome ?? false,
    path: to.path,
    redirect: to.query.redirect,
  });

  if (destination === null) {
    return undefined;
  }

  // Replace rather than push: a gated route should not sit in history for the back button to return to
  return navigateTo(destination, { replace: true });
});
