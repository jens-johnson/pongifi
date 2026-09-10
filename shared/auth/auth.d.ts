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
 * ██████████████████████████████████████████████ #shared/auth/auth.d.ts ███████████████████████████████████████████████
 *
 * Augments the Nuxt Auth Utils session user with Pongifi's identity fields.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { ISessionUser } from '#shared/auth';

declare module '#auth-utils' {
  /**
   * The Pongifi user exposed through Nuxt Auth Utils.
   * @public
   * @interface
   */
  interface User {
    /* The user's current Google profile image, or null when none is available */
    avatarUrl: ISessionUser['avatarUrl'];

    /* The user's current Google display name */
    displayName: ISessionUser['displayName'];

    /* The user's verified Google email address */
    email: ISessionUser['email'];

    /* Pongifi's stable user identifier */
    id: ISessionUser['id'];

    /* Whether the player still has to complete /welcome */
    needsWelcome: ISessionUser['needsWelcome'];
  }
}

export {};
