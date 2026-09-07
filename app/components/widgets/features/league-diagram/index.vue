<script setup lang="ts">
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
 * ███████████████████████████████ #components/widgets/features/league-diagram/index.vue ███████████████████████████████
 *
 * Roster and settings illustration for the league configuration section.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { LEAGUE_MEMBERS, LEAGUE_RULES } from './constants';
</script>

<template>
  <figure
    aria-describedby="league-diagram-description"
    aria-labelledby="league-diagram-label"
    class="border-border bg-surface-raised rounded-lg border p-5 sm:p-7"
    role="img"
  >
    <p
      id="league-diagram-label"
      class="sr-only"
    >
      Fourth Floor Open league and rulebook
    </p>

    <p
      id="league-diagram-description"
      class="sr-only"
    >
      A six-member league with one commissioner, one manager, four players, and rules for formats, scoring, result
      confirmation, amendments, and who records games.
    </p>

    <div class="flex items-start justify-between gap-4">
      <div>
        <p class="text-ink-subtle text-caption font-mono tracking-widest uppercase">FFO</p>

        <h3 class="font-display text-h2 mt-2 font-medium">Fourth Floor Open</h3>
      </div>

      <span class="bg-positive-soft text-positive-soft-ink text-caption rounded-full px-3 py-1 font-medium">
        Discoverable
      </span>
    </div>

    <div class="border-border mt-6 border-t pt-5">
      <p class="text-ink-subtle text-caption font-mono tracking-widest uppercase">Members</p>

      <ul class="mt-4 grid gap-3 sm:grid-cols-2">
        <li
          v-for="member in LEAGUE_MEMBERS"
          :key="member.name"
          class="flex min-w-0 items-center gap-3"
        >
          <span
            aria-hidden="true"
            class="bg-brand-soft text-brand-soft-ink text-caption grid size-8 shrink-0 place-items-center rounded-full font-medium"
          >
            {{ member.initials }}
          </span>

          <span class="min-w-0">
            <span class="text-body-sm block truncate font-medium">{{ member.name }}</span>

            <span class="text-ink-subtle text-caption block">{{ member.role }}</span>
          </span>
        </li>
      </ul>
    </div>

    <div class="border-border bg-surface mt-6 rounded-md border p-5">
      <div class="flex items-center gap-3">
        <Icon
          aria-hidden="true"
          class="text-accent-strong size-5"
          name="lucide:notebook-tabs"
        />

        <p class="text-body font-medium">League rulebook</p>
      </div>

      <ul class="mt-4 space-y-3">
        <li
          v-for="rule in LEAGUE_RULES"
          :key="rule"
          class="text-ink-muted text-body-sm flex items-start gap-3"
        >
          <span
            aria-hidden="true"
            class="bg-accent mt-2 size-1.5 shrink-0 rounded-full"
          />

          <span>{{ rule }}</span>
        </li>
      </ul>
    </div>
  </figure>
</template>
