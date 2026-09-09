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
 * █████████████████████████████████ #composables/use-account-read-state/utils.test.ts █████████████████████████████████
 *
 * Unit tests for the private account read state and its sign-in handoff.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComputedRef, EffectScope, Ref } from 'vue';
import { computed, effectScope, nextTick, ref, watch } from 'vue';

import { symbolName } from '#shared/utils/symbol';
import { AccountReadState, type IAccountReadStateInput } from '~/utils/account/read-state';
import { resolveSignInRedirect } from '~/utils/sign-in/redirect';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * One `navigateTo` call, paired with what the client's session looked like at the moment it was made.
 *
 * The session is captured rather than read afterwards because the ordering is the whole point: sign-in reads the
 * session as it arrives, so a session emptied after the navigation is no better than one never emptied at all
 * @internal
 * @interface
 */
interface IRecordedNavigation {
  /* Whether the client still claimed a session when the navigation was handed over */
  loggedIn: boolean;

  /* The options the navigation was made with */
  options: unknown;

  /* Where the composable sent the visitor */
  to: string;
}

/**
 * The pieces of a driven composable a case makes its assertions against.
 * @internal
 * @interface
 */
interface ISession {
  /* The session's own reactive state, the ref `nuxt-auth-utils` hands out */
  session: Ref<{ user: { id: string } } | null>;

  /* Whether the client claims a session, derived exactly as `nuxt-auth-utils` derives it */
  loggedIn: ComputedRef<boolean>;
}

/**
 * The signed-in account every case starts from
 * @internal
 * @constant
 */
const USER: { id: string } = { id: 'a4f1c0de-0000-4000-8000-000000000001' };

/**
 * A read that came back 401, which is the only state the composable acts on
 * @internal
 * @constant
 */
const UNAUTHORIZED_READ: IAccountReadStateInput = {
  errorStatusCode: 401,
  hasData: false,
  status: 'error',
};

/**
 * A read that failed for a reason the player can retry
 * @internal
 * @constant
 */
const FAILED_READ: IAccountReadStateInput = {
  errorStatusCode: 502,
  hasData: false,
  status: 'error',
};

/**
 * A read still in flight
 * @internal
 * @constant
 */
const PENDING_READ: IAccountReadStateInput = {
  errorStatusCode: null,
  hasData: false,
  status: 'pending',
};

/**
 * A read that returned the player's data
 * @internal
 * @constant
 */
const READY_READ: IAccountReadStateInput = {
  errorStatusCode: null,
  hasData: true,
  status: 'success',
};

/**
 * Every navigation the composable asked for, in order, emptied before each case
 * @internal
 * @constant
 */
const navigations: IRecordedNavigation[] = [];

/**
 * The session the stubbed `useUserSession` hands the composable, rebuilt per case
 * @internal
 */
let current: ISession;

/**
 * The route the stubbed `useRoute` hands the composable, rebuilt per case
 * @internal
 */
let fullPath: string;

/**
 * Builds a session in the shape `nuxt-auth-utils` returns, so `loggedIn` is derived rather than asserted about.
 *
 * `useUserSession` computes `loggedIn` as `Boolean(session.value?.user)` over a `useState` ref; reproducing that here
 * keeps this suite honest about the value `sign-in.vue` actually gates its bounce on
 * @internal
 * @function
 * @returns A signed-in session
 */
function signedIn(): ISession {
  const session: ISession['session'] = ref<{ user: { id: string } } | null>({ user: USER });

  return { loggedIn: computed((): boolean => Boolean(session.value?.user)), session };
}

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

// Nuxt's auto-imports are globals at runtime; this suite runs standalone, so the ones the composable reaches for are
// stubbed with the real Vue reactivity and doubles for the framework's own
vi.stubGlobal('computed', computed);
vi.stubGlobal('watch', watch);
vi.stubGlobal('useRoute', (): { fullPath: string } => ({ fullPath }));
vi.stubGlobal('useUserSession', (): ISession => current);
vi.stubGlobal('navigateTo', async (to: string, options: unknown): Promise<void> => {
  navigations.push({
    loggedIn: current.loggedIn.value,
    options,
    to,
  });
});

const { useAccountReadState }: typeof import('./utils') = await import('./utils');

describe(getTestFileName(import.meta.url), (): void => {
  beforeEach((): void => {
    navigations.length = 0;
    current = signedIn();
    fullPath = '/profile';
  });

  describe(symbolName(useAccountReadState), (): void => {
    it('empties the client session before handing the visitor to sign-in', (): void => {
      const scope: EffectScope = effectScope();

      const state: ComputedRef<AccountReadState> | undefined = scope.run((): ComputedRef<AccountReadState> =>
        useAccountReadState((): IAccountReadStateInput => UNAUTHORIZED_READ),
      );

      expect(state?.value).toBe(AccountReadState.UNAUTHORIZED);

      /* The ordering is the regression. `sign-in.vue` bounces a visitor it believes is signed in straight back to the
         private page it was handed, which reads again, answers 401 again and returns here: a loop rather than a wrong
         hop. It is closed by the session already being empty when the navigation is handed over */
      expect(navigations).toEqual([
        {
          loggedIn: false,
          options: { replace: true },
          to: '/sign-in?redirect=%2Fprofile',
        },
      ]);

      scope.stop();
    });

    it('leaves sign-in reachable, because the session it reads on arrival is empty', (): void => {
      const scope: EffectScope = effectScope();

      scope.run((): ComputedRef<AccountReadState> =>
        useAccountReadState((): IAccountReadStateInput => UNAUTHORIZED_READ),
      );

      // The exact value `sign-in.vue`'s mount gate reads; false is what keeps the visitor on the page
      expect(current.loggedIn.value).toBe(false);
      expect(current.session.value).toBeNull();

      scope.stop();
    });

    it('carries the whole path back, so a welcome continuation survives the round trip', (): void => {
      fullPath = '/welcome?redirect=/invite/abc';

      const scope: EffectScope = effectScope();

      scope.run((): ComputedRef<AccountReadState> =>
        useAccountReadState((): IAccountReadStateInput => UNAUTHORIZED_READ),
      );

      expect(navigations[0]?.to).toBe('/sign-in?redirect=%2Fwelcome%3Fredirect%3D%2Finvite%2Fabc');

      // The continuation is still a path sign-in will hand back once the visitor comes through it, not a default
      const carried: string | null = new URL(`https://pongifi.com${navigations[0]?.to}`).searchParams.get('redirect');

      expect(resolveSignInRedirect(carried)).toBe('/welcome?redirect=/invite/abc');

      scope.stop();
    });

    it('leaves a session alone while the read is only failing, which a retry can still fix', async (): Promise<void> => {
      const read: Ref<IAccountReadStateInput> = ref(PENDING_READ);
      const scope: EffectScope = effectScope();

      const state: ComputedRef<AccountReadState> | undefined = scope.run((): ComputedRef<AccountReadState> =>
        useAccountReadState((): IAccountReadStateInput => read.value),
      );

      for (const input of [FAILED_READ, READY_READ]) {
        read.value = input;
        await nextTick();
      }

      expect(state?.value).toBe(AccountReadState.READY);
      expect(navigations).toEqual([]);
      expect(current.loggedIn.value).toBe(true);

      scope.stop();
    });

    it('acts once when a read that was working answers 401', async (): Promise<void> => {
      const read: Ref<IAccountReadStateInput> = ref(READY_READ);
      const scope: EffectScope = effectScope();

      scope.run((): ComputedRef<AccountReadState> => useAccountReadState((): IAccountReadStateInput => read.value));

      expect(navigations).toEqual([]);

      read.value = UNAUTHORIZED_READ;
      await nextTick();

      expect(navigations).toHaveLength(1);
      expect(navigations[0]?.loggedIn).toBe(false);

      scope.stop();
    });
  });
});
