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
 * ████████████████████████████ #components/widgets/leagues/settings-form/index.vue.test.ts ████████████████████████████
 *
 * Mounted component tests for the league settings editor's save, conflict, reveal and departure behaviour.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import type { DOMWrapper, VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, nextTick } from 'vue';
import type { Router } from 'vue-router';
import { matchedRouteKey } from 'vue-router';

import { LeagueRole } from '#shared/domain';
import type { TLeagueSettings } from '#shared/league-settings';
import { STANDARD_LEAGUE_SETTINGS } from '#shared/league-settings';
import type { ILeagueConfiguration, ILeagueDetail, ISaveSettingsRequest } from '#shared/leagues';

import SettingsForm from './index.vue';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The exits a session failure takes, stubbed so a case can assert one was taken without leaving the test runtime
 * @internal
 * @constant
 */
const exits: { toSignIn: ReturnType<typeof vi.fn>; toWelcomeIfOwed: ReturnType<typeof vi.fn> } = vi.hoisted(() => ({
  toSignIn: vi.fn(),
  toWelcomeIfOwed: vi.fn(),
}));

mockNuxtImport('useSessionExit', () => (): typeof exits => exits);

/**
 * The request the page makes, held open by the suite so each case answers it itself. Nuxt auto-imports `$fetch` from
 * `ofetch`, so it is replaced at that import rather than on the global
 * @internal
 * @constant
 */
const fetcher: { call: (url: string, options?: { body?: ISaveSettingsRequest }) => Promise<unknown> } = vi.hoisted(
  () => ({ call: (): Promise<unknown> => Promise.reject(new Error('unstubbed')) }),
);

mockNuxtImport(
  '$fetch',
  () =>
    (url: string, options?: { body?: ISaveSettingsRequest }): Promise<unknown> =>
      fetcher.call(url, options),
);

mockNuxtImport('useUserSession', () => (): Record<string, unknown> => ({
  fetch: async (): Promise<void> => undefined,
  loggedIn: computed((): boolean => true),
  session: { value: {} },
  user: computed((): { needsWelcome: boolean } => ({ needsWelcome: false })),
}));

/**
 * One request the page made, held open so a case decides when and how it answers
 * @internal
 * @interface
 */
interface IPendingCall {
  /* The body sent, for a save; undefined for the re-read */
  body: ISaveSettingsRequest | undefined;

  /* Answers the request as a failure */
  reject: (error: unknown) => void;

  /* Answers the request as a success */
  resolve: (value: unknown) => void;

  /* The path the page called */
  url: string;
}

/**
 * The league the cases edit, a commissioner's view of a league at its standard settings
 * @internal
 * @constant
 */
const LEAGUE: ILeagueDetail = {
  abbreviation: 'OFF',
  configurationRevision: 1,
  description: 'Our office squad',
  id: 'league-1',
  members: [],
  name: 'Office League',
  settings: STANDARD_LEAGUE_SETTINGS,
  viewerRole: LeagueRole.COMMISSIONER,
};

/**
 * The page's own address, which the leave guard is registered against
 * @internal
 * @constant
 */
const SETTINGS_PATH: string = '/leagues/league-1/settings';

/**
 * The heading of the section every gameplay case edits
 * @internal
 * @constant
 */
const FORMATS: string = 'Formats and scoring';

/**
 * The heading of the section the profile cases edit
 * @internal
 * @constant
 */
const IDENTITY: string = 'Identity';

/**
 * The control the profile cases type into
 * @internal
 * @constant
 */
const NAME_INPUT: string = '#setting-name';

/**
 * The control the numeric cases type into
 * @internal
 * @constant
 */
const WIN_BY_INPUT: string = '#setting-winningMargin';

/**
 * The name the profile cases type, which is what makes their section dirty
 * @internal
 * @constant
 */
const RENAMED: string = 'Renamed';

/**
 * The question the page asks before a departure would take unsaved changes with it
 * @internal
 * @constant
 */
const LEAVE_PROMPT: string = 'Leave without saving?';

/**
 * The message the winning margin's own bounds produce, which the page shows rather than wording again
 * @internal
 * @constant
 */
const WIN_BY_MESSAGE: string = 'Enter a whole number from 1 to 21.';

/**
 * The message the provisional game count's own bounds produce
 * @internal
 * @constant
 */
const PROVISIONAL_MESSAGE: string = 'Enter a whole number from 1 to 1,000.';

/**
 * Every request the page has made, in order, each still waiting for its answer
 * @internal
 * @constant
 */
let calls: IPendingCall[] = [];

/**
 * The editors a case mounted, unmounted afterwards so their leave guards stop answering the next case's navigation
 * @internal
 * @constant
 */
let mounted: VueWrapper[] = [];

/* ─── Helpers ────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * A configuration as the server would return it.
 * @internal
 * @function
 * @param revision - The revision it is at
 * @param overrides - The stored settings this case changes
 * @param identity - The identity fields this case changes
 * @returns The configuration
 */
function configurationAt(
  revision: number,
  overrides: Partial<Record<string, unknown>> = {},
  identity: Partial<ILeagueConfiguration> = {},
): ILeagueConfiguration {
  return {
    abbreviation: LEAGUE.abbreviation,
    configurationRevision: revision,
    description: LEAGUE.description,
    name: LEAGUE.name,
    settings: { ...STANDARD_LEAGUE_SETTINGS, ...overrides } as TLeagueSettings,
    ...identity,
  };
}

/**
 * A league whose stored settings a case has put outside their bounds, as a hand-edited row would arrive.
 * @internal
 * @function
 * @param role - The viewer's role
 * @param overrides - The stored settings this case faults
 * @returns The league
 */
function leagueWith(role: LeagueRole, overrides: Partial<Record<string, unknown>>): ILeagueDetail {
  return {
    ...LEAGUE,
    settings: { ...STANDARD_LEAGUE_SETTINGS, ...overrides } as TLeagueSettings,
    viewerRole: role,
  };
}

/**
 * Lets every queued promise and every render settle, so an assertion reads the page as a person would see it.
 * @internal
 * @function
 */
async function settled(): Promise<void> {
  // Twice: a navigation the page starts itself resolves its own guards on the round after the click
  for (let round: number = 0; round < 2; round += 1) {
    await new Promise((resolve: (value: unknown) => void): void => {
      setTimeout(resolve, 0);
    });
    await nextTick();
  }
}

/**
 * Waits for a navigation the page started itself to finish, which takes as long as resolving the page it goes to.
 * @internal
 * @function
 * @param router - The router
 * @param path - Where it should end up
 */
async function arrivedAt(router: Router, path: string): Promise<void> {
  await vi.waitFor((): void => {
    expect(router.currentRoute.value.path).toBe(path);
  });
}

/**
 * Mounts the editor at the settings route, with the leave guard registered against that route's own record.
 * @internal
 * @function
 * @param league - The league to edit
 * @returns The mounted editor and the router it is guarding
 */
async function mountForm(league: ILeagueDetail = LEAGUE): Promise<{
  router: Router;
  wrapper: VueWrapper;
}> {
  const router: Router = useNuxtApp().$router as Router;

  await router.replace(SETTINGS_PATH);

  const wrapper: VueWrapper = await mountSuspended(SettingsForm, {
    global: {
      provide: {
        // What a `<RouterView>` provides in the running app, so `onBeforeRouteLeave` registers on the real record
        [matchedRouteKey as unknown as string]: computed(() => router.currentRoute.value.matched[0]),
      },
    },
    props: { league },
    route: SETTINGS_PATH,
  });

  mounted.push(wrapper);

  return { router, wrapper };
}

/**
 * One section of the page, found by the heading a person reads.
 * @internal
 * @function
 * @param wrapper - The mounted editor
 * @param heading - The section's heading
 * @returns The section
 */
function sectionOf(wrapper: VueWrapper, heading: string): DOMWrapper<Element> {
  return wrapper
    .findAll('section')
    .find((section: DOMWrapper<Element>): boolean => section.find('h2').text() === heading)!;
}

/**
 * One of a section's footer buttons, found by the label a person reads.
 * @internal
 * @function
 * @param wrapper - The mounted editor
 * @param heading - The section's heading
 * @param label - The button's label
 * @returns The button, or undefined when the section is not offering it
 */
function buttonIn(wrapper: VueWrapper, heading: string, label: string): DOMWrapper<HTMLButtonElement> | undefined {
  return sectionOf(wrapper, heading)
    .findAll('button')
    .find((button: DOMWrapper<HTMLButtonElement>): boolean => button.text() === label);
}

/**
 * Clicks a section's own Save and lets the request leave.
 * @internal
 * @function
 * @param wrapper - The mounted editor
 * @param heading - The section's heading
 */
async function save(wrapper: VueWrapper, heading: string): Promise<void> {
  await buttonIn(wrapper, heading, 'Save')!.trigger('click');
  await settled();
}

/**
 * The single request the page has outstanding, asserted to be the only one.
 * @internal
 * @function
 * @returns The request
 */
function onlyCall(): IPendingCall {
  expect(calls).toHaveLength(1);

  return calls[0]!;
}

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  beforeEach((): void => {
    calls = [];
    mounted = [];
    exits.toSignIn.mockReset().mockResolvedValue(undefined);
    exits.toWelcomeIfOwed.mockReset().mockResolvedValue(false);

    fetcher.call = (url: string, options?: { body?: ISaveSettingsRequest }): Promise<unknown> =>
      new Promise((resolve: (value: unknown) => void, reject: (error: unknown) => void): void => {
        calls.push({
          body: options?.body,
          reject,
          resolve,
          url,
        });
      });
  });

  afterEach((): void => {
    // The guards are registered on the route record the whole file shares, so an editor left mounted would keep
    // answering the next case's navigation in place of the editor that case mounted
    for (const wrapper of mounted) {
      wrapper.unmount();
    }
  });

  describe('a plain number control', (): void => {
    it('keeps what was typed as text, so the save carries the number the person meant', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm();

      // Typing into the control is what broke the draft when it was a number input
      await wrapper.find(WIN_BY_INPUT).setValue('3');
      await save(wrapper, FORMATS);

      expect(onlyCall().body!.settings.winningMargin).toBe(3);
    });

    it('refuses a typed thousands separator with the field message rather than coercing it', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm();

      // A number input would have parsed this to 1 and saved it; the text draft hands "1,440" to the validator
      await wrapper.find('#setting-walkoverGracePeriod').setValue('1,440');
      await save(wrapper, FORMATS);

      expect(calls).toHaveLength(0);
      expect(sectionOf(wrapper, FORMATS).text()).toContain('Enter a whole number from 1 to 1,440.');
    });

    it('lets another gameplay section save while an edited number sits in this one', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm();

      // Every gameplay save builds the whole candidate first, so an edit here used to break the other section's Save
      await wrapper.find(WIN_BY_INPUT).setValue('3');
      await wrapper.find('#setting-resultAmendmentWindow').setValue('72');
      await save(wrapper, 'Results');

      expect(onlyCall().body!.section).toBe('RESULTS');
      expect(onlyCall().body!.settings.resultAmendmentWindow).toBe(72);
    });
  });

  describe('a section resolving its comparison', (): void => {
    it('reviews its draft at the revision it was shown, not one a later conflict moved the page to', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm();

      // Formats is refused against revision 2, and is shown Win by 2 as the current value
      await wrapper.find(WIN_BY_INPUT).setValue('5');
      await save(wrapper, FORMATS);
      calls.shift()!.reject({ data: configurationAt(2), statusCode: 409 });
      await settled();

      // Results is then refused against revision 3, which moves the page's own idea of where the league stands
      await wrapper.find('#setting-resultAmendmentWindow').setValue('72');
      await save(wrapper, 'Results');
      calls.shift()!.reject({ data: configurationAt(3, { winningMargin: 3 }), statusCode: 409 });
      await settled();

      await buttonIn(wrapper, FORMATS, 'Review draft')!.trigger('click');
      await settled();
      await save(wrapper, FORMATS);

      // Revision 2 is what Formats compared against; revision 3 would have written over a value it never saw
      expect(onlyCall().body!.revision).toBe(2);
    });

    it('takes the current values at their own revision, not at a later one', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm();

      await wrapper.find(WIN_BY_INPUT).setValue('5');
      await save(wrapper, FORMATS);
      calls.shift()!.reject({ data: configurationAt(2, { winningMargin: 4 }), statusCode: 409 });
      await settled();

      await wrapper.find('#setting-resultAmendmentWindow').setValue('72');
      await save(wrapper, 'Results');
      calls.shift()!.reject({ data: configurationAt(3, { winningMargin: 9 }), statusCode: 409 });
      await settled();

      await buttonIn(wrapper, FORMATS, 'Use current values')!.trigger('click');
      await settled();

      // The values it adopted are the ones it was shown, and its baseline is the revision those values are at
      expect((wrapper.find(WIN_BY_INPUT).element as HTMLInputElement).value).toBe('4');

      await wrapper.find(WIN_BY_INPUT).setValue('6');
      await save(wrapper, FORMATS);

      expect(onlyCall().body!.revision).toBe(2);
    });
  });

  describe('a save queued behind another', (): void => {
    it('locks its own section the moment it is queued, so nothing can be cancelled out from under it', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm();

      await wrapper.find(NAME_INPUT).setValue(RENAMED);
      await save(wrapper, IDENTITY);

      await wrapper.find(WIN_BY_INPUT).setValue('5');
      await save(wrapper, FORMATS);

      // Queued, not sent: one request is in flight, and the waiting section offers nothing that could change it
      expect(calls).toHaveLength(1);
      expect(buttonIn(wrapper, FORMATS, 'Cancel')!.attributes('disabled')).toBeDefined();
      expect(sectionOf(wrapper, FORMATS).find('fieldset').attributes('disabled')).toBeDefined();
    });

    it('sends the body it queued, unchanged, once the save ahead of it is refused', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm();

      await wrapper.find(NAME_INPUT).setValue(RENAMED);
      await save(wrapper, IDENTITY);
      await wrapper.find(WIN_BY_INPUT).setValue('5');
      await save(wrapper, FORMATS);

      // The first is refused without moving the revision, which is what let a cancelled body commit
      calls.shift()!.reject({ data: { message: 'Nope.' }, statusCode: 400 });
      await settled();

      expect(onlyCall().body!.settings.winningMargin).toBe(5);
      expect(onlyCall().body!.revision).toBe(1);
    });

    it('drops a queued body rather than pushing it through a comparison it now has to show', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm();

      await wrapper.find(NAME_INPUT).setValue(RENAMED);
      await wrapper.find(WIN_BY_INPUT).setValue('5');
      await save(wrapper, IDENTITY);
      await save(wrapper, FORMATS);

      // Identity's save succeeds and brings back a Win by that moved underneath the queued Formats save
      calls.shift()!.resolve(configurationAt(2, { winningMargin: 9 }, { name: RENAMED }));
      await settled();

      expect(calls).toHaveLength(0);
      expect(sectionOf(wrapper, FORMATS).text()).toContain('These settings changed while you were editing.');
    });
  });

  describe('the departure question', (): void => {
    it('refuses a second navigation while it is still unanswered', async (): Promise<void> => {
      const { router, wrapper }: { router: Router; wrapper: VueWrapper } = await mountForm();

      await wrapper.find(NAME_INPUT).setValue(RENAMED);

      await router.push('/leagues');
      await settled();

      expect(wrapper.text()).toContain(LEAVE_PROMPT);
      expect(router.currentRoute.value.path).toBe(SETTINGS_PATH);

      // The question standing is not an answer to it
      await router.push('/profile');
      await settled();

      expect(router.currentRoute.value.path).toBe(SETTINGS_PATH);
      expect(wrapper.text()).toContain(LEAVE_PROMPT);
    });

    it('keeps the draft when the answer is Stay', async (): Promise<void> => {
      const { router, wrapper }: { router: Router; wrapper: VueWrapper } = await mountForm();

      await wrapper.find(NAME_INPUT).setValue(RENAMED);
      await router.push('/leagues');
      await settled();

      await wrapper
        .findAll('button')
        .find((button: DOMWrapper<HTMLButtonElement>): boolean => button.text() === 'Stay')!
        .trigger('click');
      await settled();

      expect(wrapper.text()).not.toContain(LEAVE_PROMPT);
      expect((wrapper.find(NAME_INPUT).element as HTMLInputElement).value).toBe(RENAMED);
      expect(router.currentRoute.value.path).toBe(SETTINGS_PATH);
    });

    it('departs only when the answer is Leave', async (): Promise<void> => {
      const { router, wrapper }: { router: Router; wrapper: VueWrapper } = await mountForm();

      await wrapper.find(NAME_INPUT).setValue(RENAMED);
      await router.push('/leagues');
      await settled();

      await wrapper
        .findAll('button')
        .find((button: DOMWrapper<HTMLButtonElement>): boolean => button.text() === 'Leave')!
        .trigger('click');

      await arrivedAt(router, '/leagues');

      expect(wrapper.text()).not.toContain(LEAVE_PROMPT);
    });
  });

  describe('a write the session refused', (): void => {
    it('leaves without asking about unsaved changes, and is not aborted by the page itself', async (): Promise<void> => {
      const { router, wrapper }: { router: Router; wrapper: VueWrapper } = await mountForm();
      let departure: unknown = 'not attempted';

      // The real exit is a `navigateTo`; where it goes does not matter here, only that the page's own guard, which
      // used to abort it and then read the abort as a departure, lets it through
      exits.toSignIn.mockImplementation(async (): Promise<void> => {
        departure = await router.push('/leagues');
      });

      await wrapper.find(NAME_INPUT).setValue(RENAMED);
      await save(wrapper, IDENTITY);
      calls.shift()!.reject({ statusCode: 401 });
      await settled();

      await arrivedAt(router, '/leagues');

      expect(exits.toSignIn).toHaveBeenCalledOnce();
      expect(departure).toBeUndefined();
      expect(wrapper.text()).not.toContain(LEAVE_PROMPT);
    });

    it('settles the section rather than leaving it saving when the exit does not apply', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm();

      await wrapper.find(NAME_INPUT).setValue(RENAMED);
      await save(wrapper, IDENTITY);
      calls.shift()!.reject({ statusCode: 403 });
      await settled();

      expect(exits.toWelcomeIfOwed).toHaveBeenCalledOnce();
      expect(wrapper.text()).not.toContain(LEAVE_PROMPT);
      expect(buttonIn(wrapper, IDENTITY, 'Save')).toBeDefined();
      expect(sectionOf(wrapper, IDENTITY).text()).toContain('Only a commissioner can change these.');
    });
  });

  describe('a save whose answer was lost', (): void => {
    it('offers nothing to send while the re-read that decides is still in flight', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm();

      await wrapper.find(NAME_INPUT).setValue(RENAMED);
      await save(wrapper, IDENTITY);
      calls.shift()!.reject({ statusCode: 500 });
      await settled();

      // The re-read is out; Retry belongs to what it finds, not to the wait
      expect(onlyCall().url).toBe('/api/leagues/league-1');
      expect(buttonIn(wrapper, IDENTITY, 'Retry')).toBeUndefined();
      expect(buttonIn(wrapper, IDENTITY, 'Checking…')!.attributes('disabled')).toBeDefined();
    });

    it('settles as saved without ever having offered a retry', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm();

      await wrapper.find(NAME_INPUT).setValue(RENAMED);
      await save(wrapper, IDENTITY);
      calls.shift()!.reject({ statusCode: 500 });
      await settled();

      calls.shift()!.resolve({
        ...LEAGUE,
        configurationRevision: 2,
        name: RENAMED,
      });
      await settled();

      expect(sectionOf(wrapper, IDENTITY).text()).toContain('Saved.');
      expect(buttonIn(wrapper, IDENTITY, 'Retry')).toBeUndefined();
    });

    it('offers the identical request once the re-read finds the revision unmoved', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm();

      await wrapper.find(NAME_INPUT).setValue(RENAMED);
      await save(wrapper, IDENTITY);
      calls.shift()!.reject({ statusCode: 500 });
      await settled();

      calls.shift()!.resolve(LEAGUE);
      await settled();

      await buttonIn(wrapper, IDENTITY, 'Retry')!.trigger('click');
      await settled();

      expect(onlyCall().body!.revision).toBe(1);
      expect(onlyCall().body!.identity!.name).toBe(RENAMED);
    });
  });

  describe('a stored value outside its bounds', (): void => {
    it('gives a manager the field message beneath the row it revealed', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm(
        leagueWith(LeagueRole.MANAGER, { provisionalGames: 0, ratingEnabled: false }),
      );

      // A manager has no controls in Ratings, and the fault still has to read as a fault
      expect(sectionOf(wrapper, 'Ratings').find('fieldset').exists()).toBe(false);
      expect(sectionOf(wrapper, 'Ratings').text()).toContain('Provisional games');
      expect(sectionOf(wrapper, 'Ratings').text()).toContain(PROVISIONAL_MESSAGE);
    });

    it('gives a player the same message, and still no control', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm(
        leagueWith(LeagueRole.PLAYER, { ratingEnabled: false, winningMargin: 0 }),
      );

      expect(sectionOf(wrapper, FORMATS).find('fieldset').exists()).toBe(false);
      expect(sectionOf(wrapper, FORMATS).text()).toContain(WIN_BY_MESSAGE);
      expect(wrapper.find(WIN_BY_INPUT).exists()).toBe(false);
    });

    it('repairs one fault and leaves the other revealed until its own save', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm(
        leagueWith(LeagueRole.COMMISSIONER, {
          allowedGameTypes: [LEAGUE.settings.allowedGameTypes[0]!],
          cutthroatTimeCap: 9000,
          provisionalGames: 0,
          ratingEnabled: false,
        }),
      );

      // Both controls are hidden by the league's own choices and drawn anyway, because both stored values are faults
      expect(wrapper.find('#setting-cutthroatTimeCap').exists()).toBe(true);
      expect(wrapper.find('#setting-provisionalGames').exists()).toBe(true);

      await wrapper.find('#setting-provisionalGames').setValue('10');
      await save(wrapper, 'Ratings');
      calls.shift()!.resolve(
        configurationAt(2, {
          allowedGameTypes: [LEAGUE.settings.allowedGameTypes[0]],
          cutthroatTimeCap: 9000,
          provisionalGames: 10,
          ratingEnabled: false,
        }),
      );
      await settled();

      // The repaired control goes back into hiding; the one still stored outside its bounds stays out
      expect(wrapper.find('#setting-provisionalGames').exists()).toBe(false);
      expect(wrapper.find('#setting-cutthroatTimeCap').exists()).toBe(true);
      expect(sectionOf(wrapper, FORMATS).text()).toContain('Enter a whole number from 0 to 1,440.');
    });
  });
});
