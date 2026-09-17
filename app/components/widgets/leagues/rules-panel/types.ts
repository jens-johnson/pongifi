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
 * █████████████████████████████████ #components/widgets/leagues/rules-panel/types.ts ██████████████████████████████████
 *
 * Types for a league's rules card and the rows it lays out.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { LeagueRole } from '#shared/domain';
import type { TLeagueSettings } from '#shared/league-settings';

/**
 * Inputs for a league's rules card.
 * @public
 * @interface
 */
export interface ILeaguesRulesPanelProps {
  /* The league's stored settings */
  settings: TLeagueSettings;

  /* Where the commissioner's Edit settings link goes */
  settingsRoute: string;

  /* The signed-in viewer's own role, which decides whether the card offers an action */
  viewerRole: LeagueRole;
}

/**
 * One labelled row of the expanded card, worded as the settings page words it so a commissioner reads the same words
 * in both places.
 * @public
 * @interface
 */
export interface ILeagueRuleRow {
  /* The label the settings page puts above the same control */
  label: string;

  /* The value as a person reads it, carrying its unit */
  value: string;
}

/**
 * A run of rows inside a group, optionally under a sub-heading naming whose rules they are.
 * @public
 * @interface
 */
export interface ILeagueRuleBlock {
  /* The block's key within its group; two blocks of one group are never keyed alike */
  id: string;

  /* The sub-heading the rows sit under, or null when they sit directly under the group heading */
  label: string | null;

  /* The rows, in display order */
  rows: ILeagueRuleRow[];
}

/**
 * One of the four groups the expanded card lays its rows out in.
 * @public
 * @interface
 */
export interface ILeagueRuleGroup {
  /* The blocks, in display order */
  blocks: ILeagueRuleBlock[];

  /* The group's heading */
  heading: string;
}
