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
 * ███████████████████████████████ #components/widgets/leagues/create-form/utils.test.ts ███████████████████████████████
 *
 * Unit tests for the create-league submission settler.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { describe, expect, it } from 'vitest';

import { symbolName } from '#shared/utils/symbol';
import { WriteFailure } from '~/utils/leagues/write-failure';

import { CreateLeagueAlert, CreateLeaguePhase } from './enums';
import { settleCreateSubmission } from './utils';

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  describe(symbolName(settleCreateSubmission), (): void => {
    it('freezes the form on an unanswered submission', (): void => {
      expect(settleCreateSubmission(WriteFailure.UNCERTAIN, false)).toStrictEqual({
        alert: CreateLeagueAlert.UNCERTAIN,
        phase: CreateLeaguePhase.UNCERTAIN,
      });
    });

    it('returns the form to editable on every definite refusal of a first attempt', (): void => {
      expect(settleCreateSubmission(WriteFailure.RATE_LIMITED, false)).toStrictEqual({
        alert: CreateLeagueAlert.RATE_LIMITED,
        phase: CreateLeaguePhase.IDLE,
      });
      expect(settleCreateSubmission(WriteFailure.CONFLICT, false)).toStrictEqual({
        alert: CreateLeagueAlert.CONFLICT,
        phase: CreateLeaguePhase.IDLE,
      });
      expect(settleCreateSubmission(WriteFailure.REFUSED, false)).toStrictEqual({
        alert: CreateLeagueAlert.REFUSED,
        phase: CreateLeaguePhase.IDLE,
      });
    });

    /* The retry of an unanswered submission cannot rule the first attempt out, so a definite refusal of the retry must
       not unfreeze the values or say the league was not created */
    it('keeps an uncertain submission uncertain whatever its retry answers', (): void => {
      for (const failure of [
        WriteFailure.RATE_LIMITED,
        WriteFailure.CONFLICT,
        WriteFailure.REFUSED,
        WriteFailure.UNAUTHORIZED,
        WriteFailure.FORBIDDEN,
        WriteFailure.NOT_FOUND,
        WriteFailure.UNCERTAIN,
      ]) {
        expect(settleCreateSubmission(failure, true)).toStrictEqual({
          alert: CreateLeagueAlert.UNCERTAIN,
          phase: CreateLeaguePhase.UNCERTAIN,
        });
      }
    });

    it('reads an exit that never navigated as a plain refusal, so the form is never stranded', (): void => {
      expect(settleCreateSubmission(WriteFailure.UNAUTHORIZED, false)).toStrictEqual({
        alert: CreateLeagueAlert.REFUSED,
        phase: CreateLeaguePhase.IDLE,
      });
      expect(settleCreateSubmission(WriteFailure.FORBIDDEN, false)).toStrictEqual({
        alert: CreateLeagueAlert.REFUSED,
        phase: CreateLeaguePhase.IDLE,
      });
    });
  });
});
