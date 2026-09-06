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
 * ███████████████████████████████████████████ #components/MarketingCta.vue ████████████████████████████████████████████
 *
 * Shared auth-aware marketing call to action.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */
interface IProps {
  /* Renders only the primary command, for compact placements such as a page hero */
  compact?: boolean;

  /* Offers the FAQ beside the primary command */
  showFaq?: boolean;
}

withDefaults(defineProps<IProps>(), { compact: false, showFaq: false });

/**
 *
 */
const { loggedIn } = useUserSession();

/**
 *
 */
const destination = computed<string>((): string => (loggedIn.value ? LEAGUES_ROUTE : SIGN_IN_ROUTE));

/**
 *
 */
const label = computed<string>((): string => (loggedIn.value ? 'Back to your leagues' : 'Start a league'));
</script>

<template>
  <div :class="compact ? 'mt-8' : 'border-border bg-surface rounded-lg border p-6 md:p-10'">
    <template v-if="!compact">
      <h2 class="font-display text-h2 font-medium tracking-tight">
        {{ loggedIn ? 'Back to your leagues' : 'Ready for a real leaderboard?' }}
      </h2>

      <p class="text-ink-muted text-body mt-3">
        {{
          loggedIn
            ? 'See the leagues you play in and pick up where you left off.'
            : 'Start a league, invite the people you already play against, and let the table settle it.'
        }}
      </p>
    </template>

    <div
      class="flex flex-wrap items-center gap-x-6 gap-y-4"
      :class="compact ? '' : 'mt-6'"
    >
      <NuxtLink
        class="bg-accent text-accent-ink hover:bg-accent-hover text-body-lg inline-flex items-center gap-2 rounded-md px-6 py-3 font-medium transition-colors"
        :to="destination"
      >
        {{ label }}

        <Icon
          aria-hidden="true"
          class="size-4"
          name="lucide:arrow-right"
        />
      </NuxtLink>

      <NuxtLink
        v-if="showFaq"
        class="text-accent-strong hover:text-accent text-body font-medium transition-colors"
        :to="FAQ_ROUTE"
      >
        Questions? Read the FAQ
      </NuxtLink>
    </div>
  </div>
</template>
