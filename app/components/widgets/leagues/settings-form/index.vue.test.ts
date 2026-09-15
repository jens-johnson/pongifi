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
import { GameType } from '#shared/rules-engine';

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
 * The heading of the section the ratings cases edit
 * @internal
 * @constant
 */
const RATINGS: string = 'Ratings';

/**
 * The heading of the section the confirmation and amendment cases edit
 * @internal
 * @constant
 */
const RESULTS: string = 'Results';

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
 * A second name, so a case can tell a draft waiting to be sent from one that was sent and answered already
 * @internal
 * @constant
 */
const RENAMED_AGAIN: string = 'Renamed Again';

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
 * The only action a section whose re-read also failed offers, which is a read rather than a second write
 * @internal
 * @constant
 */
const RETRY_CHECK: string = 'Retry check';

/**
 * The line a section shows above a comparison, which is the one outcome a queued write must never cause
 * @internal
 * @constant
 */
const STALE_LINE: string = 'These settings changed while you were editing.';

/**
 * The confirmation a section shows once its own write is known to have committed
 * @internal
 * @constant
 */
const SAVED_LINE: string = 'Saved.';

/**
 * The control a cutthroat-only league's stored fault cases repair
 * @internal
 * @constant
 */
const CAP_INPUT: string = '#setting-cutthroatTimeCap';

/**
 * The control the ratings cases read, which a league with ratings off is not showing
 * @internal
 * @constant
 */
const PROVISIONAL_INPUT: string = '#setting-provisionalGames';

/**
 * The message the provisional game count's own bounds produce
 * @internal
 * @constant
 */
const PROVISIONAL_MESSAGE: string = 'Enter a whole number from 1 to 1,000.';

/**
 * The message the cutthroat time cap's own bounds produce, which zero is inside and a stored 9000 is not
 * @internal
 * @constant
 */
const CAP_MESSAGE: string = 'Enter a whole number from 0 to 1,440.';

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
    // In the document rather than detached, so what has focus is a question the cases can ask
    attachTo: document.body,
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

/**
 * One of the format checkboxes, found by the label a person reads.
 * @internal
 * @function
 * @param wrapper - The mounted editor
 * @param label - The format's label
 * @returns The checkbox
 */
function formatBox(wrapper: VueWrapper, label: string): DOMWrapper<HTMLInputElement> {
  return sectionOf(wrapper, FORMATS)
    .findAll('label')
    .find((box: DOMWrapper<Element>): boolean => box.text() === label)!
    .find('input');
}

/**
 * The ratings toggle, which is a bare checkbox in its own label rather than a field with an id.
 * @internal
 * @function
 * @param wrapper - The mounted editor
 * @returns The checkbox
 */
function ratingsBox(wrapper: VueWrapper): DOMWrapper<HTMLInputElement> {
  return sectionOf(wrapper, RATINGS).find('input[type="checkbox"]');
}

/**
 * Puts a section into the state a save whose answer was lost leaves behind, with its revision unmoved.
 * @internal
 * @function
 * @param wrapper - The mounted editor
 */
async function lostTheAnswer(wrapper: VueWrapper): Promise<void> {
  await wrapper.find(NAME_INPUT).setValue(RENAMED);
  await save(wrapper, IDENTITY);
  calls.shift()!.reject({ statusCode: 500 });
  await settled();
  calls.shift()!.resolve(LEAGUE);
  await settled();
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
      await save(wrapper, RESULTS);

      expect(onlyCall().body!.section).toBe('RESULTS');
      expect(onlyCall().body!.settings.resultAmendmentWindow).toBe(72);
    });
  });

  describe('a section another section saved past', (): void => {
    it('keeps its own draft and carries it at the revision that save moved it to', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm();

      // Ratings is left dirty at a value nobody else touches, and Formats saves while it sits there
      await wrapper.find(PROVISIONAL_INPUT).setValue('25');
      await wrapper.find(WIN_BY_INPUT).setValue('5');
      await save(wrapper, FORMATS);
      calls.shift()!.resolve(configurationAt(2, { winningMargin: 5 }));
      await settled();

      // Its own baseline is still what came back, so it moves to the new revision rather than showing a comparison
      expect(sectionOf(wrapper, RATINGS).text()).not.toContain(STALE_LINE);
      expect((wrapper.find(PROVISIONAL_INPUT).element as HTMLInputElement).value).toBe('25');

      await save(wrapper, RATINGS);

      expect(onlyCall().body!.revision).toBe(2);
      expect(onlyCall().body!.settings.provisionalGames).toBe(25);
    });

    it('keeps a queued Save of its own when the answer carries values it already saved once', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm();

      // Identity saves once, so a body for it has been sent and answered before anything below is queued
      await wrapper.find(NAME_INPUT).setValue(RENAMED);
      await save(wrapper, IDENTITY);
      calls.shift()!.resolve(configurationAt(2, {}, { name: RENAMED }));
      await settled();

      // A second Identity Save, carrying a different name, waits behind a Formats save
      await wrapper.find(WIN_BY_INPUT).setValue('5');
      await save(wrapper, FORMATS);
      await wrapper.find(NAME_INPUT).setValue(RENAMED_AGAIN);
      await save(wrapper, IDENTITY);

      expect(calls).toHaveLength(1);

      // The Formats answer still holds the first name, which is the body the first save sent and nothing is waiting on
      calls.shift()!.resolve(configurationAt(3, { winningMargin: 5 }, { name: RENAMED }));
      await settled();

      // A queued Save is not an unresolved write: values a settled write of this section's put there are not its
      // outcome, so the draft waiting to go out is neither replaced by them nor called saved on their account
      expect((wrapper.find(NAME_INPUT).element as HTMLInputElement).value).toBe(RENAMED_AGAIN);
      expect(sectionOf(wrapper, IDENTITY).find('fieldset').attributes('disabled')).toBeDefined();
      expect(onlyCall().body!.identity!.name).toBe(RENAMED_AGAIN);
      expect(onlyCall().body!.revision).toBe(3);

      // And it is its own request that settles it
      calls.shift()!.resolve(configurationAt(4, { winningMargin: 5 }, { name: RENAMED_AGAIN }));
      await settled();

      expect((wrapper.find(NAME_INPUT).element as HTMLInputElement).value).toBe(RENAMED_AGAIN);
      expect(sectionOf(wrapper, IDENTITY).text()).toContain(SAVED_LINE);
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
      await save(wrapper, RESULTS);
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
      await save(wrapper, RESULTS);
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
      expect(sectionOf(wrapper, FORMATS).text()).toContain(STALE_LINE);
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
      expect(sectionOf(wrapper, RATINGS).find('fieldset').exists()).toBe(false);
      expect(sectionOf(wrapper, RATINGS).text()).toContain('Provisional games');
      expect(sectionOf(wrapper, RATINGS).text()).toContain(PROVISIONAL_MESSAGE);
    });

    it('gives a player a field the league itself is hiding, its message, and still no control', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm(
        leagueWith(LeagueRole.PLAYER, { provisionalGames: 0, ratingEnabled: false }),
      );

      // Ratings off hides the provisional count from everyone, so only the stored fault can be drawing this row
      expect(sectionOf(wrapper, RATINGS).find('fieldset').exists()).toBe(false);
      expect(sectionOf(wrapper, RATINGS).text()).toContain('Provisional games');
      expect(sectionOf(wrapper, RATINGS).text()).toContain(PROVISIONAL_MESSAGE);

      // Revealing grants nobody editing: a player reads the fault and has nothing to repair it with
      expect(wrapper.find(PROVISIONAL_INPUT).exists()).toBe(false);
      expect(buttonIn(wrapper, RATINGS, 'Save')).toBeUndefined();
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
      expect(wrapper.find(CAP_INPUT).exists()).toBe(true);
      expect(wrapper.find(PROVISIONAL_INPUT).exists()).toBe(true);

      await wrapper.find(PROVISIONAL_INPUT).setValue('10');
      await save(wrapper, RATINGS);
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
      expect(wrapper.find(PROVISIONAL_INPUT).exists()).toBe(false);
      expect(wrapper.find(CAP_INPUT).exists()).toBe(true);
      expect(sectionOf(wrapper, FORMATS).text()).toContain(CAP_MESSAGE);

      // The second repair, at the revision the first one moved the page to
      await wrapper.find(CAP_INPUT).setValue('15');
      await save(wrapper, FORMATS);

      expect(onlyCall().body!.revision).toBe(2);

      calls.shift()!.resolve(
        configurationAt(3, {
          allowedGameTypes: [LEAGUE.settings.allowedGameTypes[0]],
          cutthroatTimeCap: 15,
          provisionalGames: 10,
          ratingEnabled: false,
        }),
      );
      await settled();

      // Nothing is left revealed, said or outstanding: the league's own choices are hiding both controls again
      expect(calls).toHaveLength(0);
      expect(wrapper.find(CAP_INPUT).exists()).toBe(false);
      expect(wrapper.find(PROVISIONAL_INPUT).exists()).toBe(false);
      expect(sectionOf(wrapper, FORMATS).text()).not.toContain(CAP_MESSAGE);
      expect(sectionOf(wrapper, RATINGS).text()).not.toContain(PROVISIONAL_MESSAGE);
      expect(sectionOf(wrapper, FORMATS).text()).toContain(SAVED_LINE);
    });
  });
  describe('a retry queued behind another section', (): void => {
    it('sends one write however many times Retry is pressed, and stays saved', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm();

      await lostTheAnswer(wrapper);

      // Another section's save is in flight when Retry is pressed, which is the wait the second press used to fit in
      await wrapper.find(WIN_BY_INPUT).setValue('5');
      await save(wrapper, FORMATS);
      expect(calls).toHaveLength(1);

      await buttonIn(wrapper, IDENTITY, 'Retry')!.trigger('click');
      await settled();

      // Disarmed where it was pressed rather than where it is sent: there is no second press to make
      expect(buttonIn(wrapper, IDENTITY, 'Retry')).toBeUndefined();
      expect(calls).toHaveLength(1);

      calls.shift()!.reject({ statusCode: 400 });
      await settled();

      // One retry, carrying the body and the revision it was submitted with
      expect(onlyCall().body!.revision).toBe(1);
      expect(onlyCall().body!.identity!.name).toBe(RENAMED);

      calls.shift()!.resolve(configurationAt(2, {}, { name: RENAMED }));
      await settled();

      // Nothing follows the success: a second queued write is what turned a saved section into a false conflict
      expect(calls).toHaveLength(0);
      expect(sectionOf(wrapper, IDENTITY).text()).toContain('Saved.');
      expect(sectionOf(wrapper, IDENTITY).text()).not.toContain(STALE_LINE);
    });

    it('drops a retry the answer it waited behind proves already committed, and reads as saved', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm();

      await lostTheAnswer(wrapper);

      await wrapper.find(WIN_BY_INPUT).setValue('5');
      await save(wrapper, FORMATS);
      await buttonIn(wrapper, IDENTITY, 'Retry')!.trigger('click');
      await settled();

      // The Formats answer brings back a league that already carries the lost write, which is that write committing
      calls.shift()!.resolve(configurationAt(2, { winningMargin: 5 }, { name: RENAMED }));
      await settled();

      // Nothing more is sent, and a success is never followed by a comparison of the draft against itself
      expect(calls).toHaveLength(0);
      expect(sectionOf(wrapper, IDENTITY).text()).toContain(SAVED_LINE);
      expect(sectionOf(wrapper, IDENTITY).text()).not.toContain(STALE_LINE);
      expect(buttonIn(wrapper, IDENTITY, 'Retry')).toBeUndefined();
    });

    it('neither sends nor reads once the revision it was submitted at has been left behind', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm();

      await lostTheAnswer(wrapper);

      await wrapper.find(WIN_BY_INPUT).setValue('5');
      await save(wrapper, FORMATS);
      await buttonIn(wrapper, IDENTITY, 'Retry')!.trigger('click');
      await settled();

      // Formats commits at revision 2 without touching Identity, so the body held at revision 1 can never commit
      calls.shift()!.resolve(configurationAt(2, { winningMargin: 5 }));
      await settled();

      // The Formats answer already said what is true here. A read would only find the draft differing from values
      // nobody changed and ask about a conflict this page's own success invented
      expect(calls).toHaveLength(0);
      expect(sectionOf(wrapper, IDENTITY).text()).not.toContain(STALE_LINE);
      expect((wrapper.find(NAME_INPUT).element as HTMLInputElement).value).toBe(RENAMED);

      await save(wrapper, IDENTITY);

      // The ordinary path from here: the same draft, at the revision the Formats save carried the section to
      expect(onlyCall().body!.revision).toBe(2);
      expect(onlyCall().body!.identity!.name).toBe(RENAMED);
    });
  });

  describe('a check that could not be made', (): void => {
    it('offers another read and nothing that writes', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm();

      await wrapper.find(NAME_INPUT).setValue(RENAMED);
      await save(wrapper, IDENTITY);
      calls.shift()!.reject({ statusCode: 500 });
      await settled();
      calls.shift()!.reject({ statusCode: 500 });
      await settled();

      expect(sectionOf(wrapper, IDENTITY).text()).toContain(
        'Pongifi could not check whether these settings were saved.',
      );
      expect(buttonIn(wrapper, IDENTITY, RETRY_CHECK)).toBeDefined();
      expect(buttonIn(wrapper, IDENTITY, 'Retry')).toBeUndefined();
      expect(buttonIn(wrapper, IDENTITY, 'Save')).toBeUndefined();
    });

    it('shows the comparison when the read it finally makes finds the revision moved', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm();

      await wrapper.find(NAME_INPUT).setValue(RENAMED);
      await save(wrapper, IDENTITY);
      calls.shift()!.reject({ statusCode: 500 });
      await settled();
      calls.shift()!.reject({ statusCode: 500 });
      await settled();

      await buttonIn(wrapper, IDENTITY, RETRY_CHECK)!.trigger('click');
      await settled();

      expect(onlyCall().url).toBe('/api/leagues/league-1');

      // Someone else's save moved the league on, and the values are not the ones this section sent
      calls.shift()!.resolve({
        ...LEAGUE,
        configurationRevision: 2,
        name: 'Something Else',
      });
      await settled();

      expect(sectionOf(wrapper, IDENTITY).text()).toContain(STALE_LINE);
      expect(buttonIn(wrapper, IDENTITY, 'Use current values')).toBeDefined();
    });

    it('drops a queued check the answer it waited behind already made, and reads as saved', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm();

      await wrapper.find(NAME_INPUT).setValue(RENAMED);
      await save(wrapper, IDENTITY);
      calls.shift()!.reject({ statusCode: 500 });
      await settled();
      calls.shift()!.reject({ statusCode: 500 });
      await settled();

      await wrapper.find(WIN_BY_INPUT).setValue('5');
      await save(wrapper, FORMATS);
      await buttonIn(wrapper, IDENTITY, RETRY_CHECK)!.trigger('click');
      await settled();

      // What the check was going to ask is answered by the Formats response: the write it could not see did commit
      calls.shift()!.resolve(configurationAt(2, { winningMargin: 5 }, { name: RENAMED }));
      await settled();

      expect(calls).toHaveLength(0);
      expect(sectionOf(wrapper, IDENTITY).text()).toContain(SAVED_LINE);
      expect(sectionOf(wrapper, IDENTITY).text()).not.toContain(STALE_LINE);
      expect(buttonIn(wrapper, IDENTITY, RETRY_CHECK)).toBeUndefined();
    });

    it('makes no read at all once the revision moved under the check it was waiting to make', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm();

      await wrapper.find(NAME_INPUT).setValue(RENAMED);
      await save(wrapper, IDENTITY);
      calls.shift()!.reject({ statusCode: 500 });
      await settled();
      calls.shift()!.reject({ statusCode: 500 });
      await settled();

      await wrapper.find(WIN_BY_INPUT).setValue('5');
      await save(wrapper, FORMATS);
      await buttonIn(wrapper, IDENTITY, RETRY_CHECK)!.trigger('click');
      await settled();

      // The same rule the retry follows: Formats commits at 2 without touching Identity, so the lost write is dead
      calls.shift()!.resolve(configurationAt(2, { winningMargin: 5 }));
      await settled();

      expect(calls).toHaveLength(0);
      expect(sectionOf(wrapper, IDENTITY).text()).not.toContain(STALE_LINE);
      expect(buttonIn(wrapper, IDENTITY, RETRY_CHECK)).toBeUndefined();

      await save(wrapper, IDENTITY);

      expect(onlyCall().body!.revision).toBe(2);
      expect(onlyCall().body!.identity!.name).toBe(RENAMED);
    });
  });

  describe('a refusal the page words itself', (): void => {
    it('keeps its own rate-limit line rather than the one the server sent', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm();

      await wrapper.find(NAME_INPUT).setValue(RENAMED);
      await save(wrapper, IDENTITY);
      calls
        .shift()!
        .reject({ data: { message: 'Too many changes in a row. Try that again in a moment.' }, statusCode: 429 });
      await settled();

      expect(sectionOf(wrapper, IDENTITY).text()).toContain(
        'Pongifi could not save these settings. Wait a moment and try again.',
      );
      expect(sectionOf(wrapper, IDENTITY).text()).not.toContain('Too many changes in a row.');
    });

    it('keeps its own line for any other refusal that carries one', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm();

      await wrapper.find(NAME_INPUT).setValue(RENAMED);
      await save(wrapper, IDENTITY);
      calls.shift()!.reject({ data: { message: 'Nope.' }, statusCode: 400 });
      await settled();

      expect(sectionOf(wrapper, IDENTITY).text()).toContain('Pongifi could not save these settings. Try again.');
      expect(sectionOf(wrapper, IDENTITY).text()).not.toContain('Nope.');
    });

    it('shows the line the server sent for the one refusal that names a field', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm();

      await wrapper.find(NAME_INPUT).setValue(RENAMED);
      await save(wrapper, IDENTITY);
      calls.shift()!.reject({ data: { message: WIN_BY_MESSAGE }, statusCode: 422 });
      await settled();

      expect(sectionOf(wrapper, IDENTITY).text()).toContain(WIN_BY_MESSAGE);
    });
  });

  describe('the ratings caption', (): void => {
    it('says nothing to a league whose ratings are already on', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm();

      expect(sectionOf(wrapper, RATINGS).text()).not.toContain('Ratings start with the next game.');
    });

    it('says when ratings would start only once the draft turns them on', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm(
        leagueWith(LeagueRole.COMMISSIONER, { ratingEnabled: false }),
      );

      expect(sectionOf(wrapper, RATINGS).text()).toContain("New games will not change anyone's rating.");

      await ratingsBox(wrapper).setValue(true);
      await settled();

      expect(sectionOf(wrapper, RATINGS).text()).toContain('Ratings start with the next game.');
    });
  });

  describe('the formats a league plays', (): void => {
    it('refuses the last format inline, sends nothing, and has a group to put focus on', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm(
        leagueWith(LeagueRole.COMMISSIONER, { allowedGameTypes: [LEAGUE.settings.allowedGameTypes[0]] }),
      );

      await formatBox(wrapper, 'Singles').setValue(false);
      await settled();

      expect(calls).toHaveLength(0);
      expect(sectionOf(wrapper, FORMATS).text()).toContain('A league plays at least one format.');

      // The refusal names the group, and the rule that puts focus on a refused field queries this id
      expect(wrapper.find('#setting-allowedGameTypes').exists()).toBe(true);
      expect(wrapper.find('#setting-allowedGameTypes').attributes('tabindex')).toBe('-1');
    });

    it('saves an unchecked format target at the value it was left on, and brings that value back', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm();

      // 15 rather than the standard 7, so a save that quietly reset the hidden value would be caught
      await wrapper.find('#setting-targetScore-CUTTHROAT').setValue('15');
      await formatBox(wrapper, 'Cutthroat').setValue(false);
      await settled();

      expect(wrapper.find('#setting-targetScore-CUTTHROAT').exists()).toBe(false);

      await save(wrapper, FORMATS);

      // A hidden control's value is left exactly where it is, which means the save carries it rather than dropping it
      expect(onlyCall().body!.settings.targetScore![GameType.CUTTHROAT]).toBe(15);

      calls.shift()!.resolve(
        configurationAt(2, {
          allowedGameTypes: [GameType.SINGLES, GameType.DOUBLES],
          targetScore: { ...LEAGUE.settings.targetScore, [GameType.CUTTHROAT]: 15 },
        }),
      );
      await settled();

      await formatBox(wrapper, 'Cutthroat').setValue(true);
      await settled();

      expect((wrapper.find('#setting-targetScore-CUTTHROAT').element as HTMLSelectElement).value).toBe('15');
    });

    it('saves the hidden singles and doubles values in a cutthroat-only league, and brings them back', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm();

      // Best of 5 and a service interval of 4, neither of them the standard value the controls load at
      await wrapper.find('#setting-matchFormat').setValue('5');
      await wrapper.find('#setting-serviceInterval').setValue('4');
      await formatBox(wrapper, 'Singles').setValue(false);
      await formatBox(wrapper, 'Doubles').setValue(false);
      await settled();

      expect(wrapper.find('#setting-matchFormat').exists()).toBe(false);
      expect(wrapper.find('#setting-serviceInterval').exists()).toBe(false);

      await save(wrapper, FORMATS);

      expect(onlyCall().body!.settings.matchFormat).toBe(5);
      expect(onlyCall().body!.settings.serviceInterval).toBe(4);

      calls.shift()!.resolve(
        configurationAt(2, {
          allowedGameTypes: [GameType.CUTTHROAT],
          matchFormat: 5,
          serviceInterval: 4,
        }),
      );
      await settled();

      await formatBox(wrapper, 'Singles').setValue(true);
      await settled();

      expect((wrapper.find('#setting-matchFormat').element as HTMLSelectElement).value).toBe('5');
      expect((wrapper.find('#setting-serviceInterval').element as HTMLInputElement).value).toBe('4');
    });
  });

  describe('a role with less than every control', (): void => {
    it('gives a manager the profile, the other three read-only with their captions', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm(leagueWith(LeagueRole.MANAGER, {}));

      expect(wrapper.find(NAME_INPUT).exists()).toBe(true);
      expect(buttonIn(wrapper, IDENTITY, 'Save')).toBeDefined();

      for (const heading of [FORMATS, RESULTS, RATINGS]) {
        expect(buttonIn(wrapper, heading, 'Save')).toBeUndefined();
        expect(sectionOf(wrapper, heading).text()).toContain('Only a commissioner can change these.');
      }
    });

    it('gives a player no save in any section', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm(leagueWith(LeagueRole.PLAYER, {}));

      for (const heading of [IDENTITY, FORMATS, RESULTS, RATINGS]) {
        expect(buttonIn(wrapper, heading, 'Save')).toBeUndefined();
      }

      expect(sectionOf(wrapper, IDENTITY).text()).toContain('Only a commissioner or manager can change these.');
    });
  });

  describe('a setting hidden by another', (): void => {
    it('saves the provisional count it was left on and returns it when ratings come back on', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm();

      // 25 rather than the standard 10, so a reset to the default could not pass for the value being kept
      await wrapper.find(PROVISIONAL_INPUT).setValue('25');
      await ratingsBox(wrapper).setValue(false);
      await save(wrapper, RATINGS);

      expect(onlyCall().body!.settings.provisionalGames).toBe(25);

      calls.shift()!.resolve(configurationAt(2, { provisionalGames: 25, ratingEnabled: false }));
      await settled();

      expect(wrapper.find(PROVISIONAL_INPUT).exists()).toBe(false);

      // Turning ratings back on and saving that: the count it comes back with is the one that was stored
      await ratingsBox(wrapper).setValue(true);
      await settled();

      expect((wrapper.find(PROVISIONAL_INPUT).element as HTMLInputElement).value).toBe('25');

      await save(wrapper, RATINGS);

      expect(onlyCall().body!.settings.provisionalGames).toBe(25);

      calls.shift()!.resolve(configurationAt(3, { provisionalGames: 25, ratingEnabled: true }));
      await settled();

      expect((wrapper.find(PROVISIONAL_INPUT).element as HTMLInputElement).value).toBe('25');
      expect(sectionOf(wrapper, RATINGS).text()).toContain(SAVED_LINE);
    });
  });

  describe('a stored fault being repaired', (): void => {
    it('clears the message on a valid replacement but keeps the control until the save lands', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm(
        leagueWith(LeagueRole.COMMISSIONER, { provisionalGames: 0, ratingEnabled: false }),
      );

      expect(sectionOf(wrapper, RATINGS).text()).toContain(PROVISIONAL_MESSAGE);

      await wrapper.find(PROVISIONAL_INPUT).setValue('10');
      await settled();

      // Typing a usable value answers the message; only a save that lands puts the control back into hiding
      expect(sectionOf(wrapper, RATINGS).text()).not.toContain(PROVISIONAL_MESSAGE);
      expect(wrapper.find(PROVISIONAL_INPUT).exists()).toBe(true);
    });

    it('repairs a two-section fault in the other order', async (): Promise<void> => {
      const { wrapper }: { wrapper: VueWrapper } = await mountForm(
        leagueWith(LeagueRole.COMMISSIONER, {
          allowedGameTypes: [LEAGUE.settings.allowedGameTypes[0]!],
          cutthroatTimeCap: 9000,
          provisionalGames: 0,
          ratingEnabled: false,
        }),
      );

      await wrapper.find(CAP_INPUT).setValue('15');
      await save(wrapper, FORMATS);
      calls.shift()!.resolve(
        configurationAt(2, {
          allowedGameTypes: [LEAGUE.settings.allowedGameTypes[0]],
          cutthroatTimeCap: 15,
          provisionalGames: 0,
          ratingEnabled: false,
        }),
      );
      await settled();

      expect(wrapper.find(CAP_INPUT).exists()).toBe(false);
      expect(wrapper.find(PROVISIONAL_INPUT).exists()).toBe(true);
      expect(sectionOf(wrapper, RATINGS).text()).toContain(PROVISIONAL_MESSAGE);

      await wrapper.find(PROVISIONAL_INPUT).setValue('10');
      await save(wrapper, RATINGS);

      // The second repair carries the revision the first one moved the page to
      expect(onlyCall().body!.revision).toBe(2);

      calls.shift()!.resolve(
        configurationAt(3, {
          allowedGameTypes: [LEAGUE.settings.allowedGameTypes[0]],
          cutthroatTimeCap: 15,
          provisionalGames: 10,
          ratingEnabled: false,
        }),
      );
      await settled();

      // The same end state as the other order, reached the other way round
      expect(calls).toHaveLength(0);
      expect(wrapper.find(CAP_INPUT).exists()).toBe(false);
      expect(wrapper.find(PROVISIONAL_INPUT).exists()).toBe(false);
      expect(sectionOf(wrapper, FORMATS).text()).not.toContain(CAP_MESSAGE);
      expect(sectionOf(wrapper, RATINGS).text()).not.toContain(PROVISIONAL_MESSAGE);
      expect(sectionOf(wrapper, RATINGS).text()).toContain(SAVED_LINE);
    });
  });

  describe('the departure question keyboard', (): void => {
    it('takes focus to the safe answer and gives it back', async (): Promise<void> => {
      const { router, wrapper }: { router: Router; wrapper: VueWrapper } = await mountForm();
      const name: HTMLInputElement = wrapper.find(NAME_INPUT).element as HTMLInputElement;

      await wrapper.find(NAME_INPUT).setValue(RENAMED);
      name.focus();

      await router.push('/leagues');
      await settled();

      const stay: DOMWrapper<HTMLButtonElement> = wrapper
        .findAll('button')
        .find((button: DOMWrapper<HTMLButtonElement>): boolean => button.text() === 'Stay')!;

      expect(document.activeElement).toBe(stay.element);

      await stay.trigger('click');
      await settled();

      // Back where the departure was attempted from, rather than at the top of the document
      expect(document.activeElement).toBe(name);
    });

    it('keeps the two answers in a cycle of their own', async (): Promise<void> => {
      const { router, wrapper }: { router: Router; wrapper: VueWrapper } = await mountForm();

      await wrapper.find(NAME_INPUT).setValue(RENAMED);
      await router.push('/leagues');
      await settled();

      const leave: DOMWrapper<HTMLButtonElement> = wrapper
        .findAll('button')
        .find((button: DOMWrapper<HTMLButtonElement>): boolean => button.text() === 'Leave')!;
      const stay: DOMWrapper<HTMLButtonElement> = wrapper
        .findAll('button')
        .find((button: DOMWrapper<HTMLButtonElement>): boolean => button.text() === 'Stay')!;

      await stay.trigger('keydown.tab');

      expect(document.activeElement).toBe(leave.element);

      await leave.trigger('keydown.tab', { shiftKey: true });

      expect(document.activeElement).toBe(stay.element);
    });

    it('reads Escape as the answer that changes nothing', async (): Promise<void> => {
      const { router, wrapper }: { router: Router; wrapper: VueWrapper } = await mountForm();

      await wrapper.find(NAME_INPUT).setValue(RENAMED);
      await router.push('/leagues');
      await settled();

      await wrapper.find('[role="dialog"]').trigger('keydown.esc');
      await settled();

      expect(wrapper.text()).not.toContain(LEAVE_PROMPT);
      expect((wrapper.find(NAME_INPUT).element as HTMLInputElement).value).toBe(RENAMED);
      expect(router.currentRoute.value.path).toBe(SETTINGS_PATH);
    });
  });
});
