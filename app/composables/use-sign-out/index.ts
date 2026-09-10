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
 * ████████████████████████████████████████ #composables/use-sign-out/index.ts █████████████████████████████████████████
 *
 * Ends the session and clears the private data cached alongside it.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * Builds the sign-out handler shared by the account menu and the profile page.
 *
 * Clearing the session is not enough on a shared browser: the private payloads already fetched stay in Nuxt's data
 * cache, so the next person to sign in here would briefly see the last person's leagues. Everything cached is dropped
 * alongside the session, and only then does the navigation happen
 * @public
 * @function
 * @returns A handler that ends the session and returns to the public landing page
 */
export function useSignOut(): () => Promise<void> {
  const { clear }: ReturnType<typeof useUserSession> = useUserSession();

  return async (): Promise<void> => {
    await clear();

    clearNuxtData();

    await navigateTo(HOME_ROUTE);
  };
}
