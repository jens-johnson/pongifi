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
 * ██████████████████████████████████████████ #components/FeaturesLeague.vue ███████████████████████████████████████████
 *
 * League configuration section for the Features page.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */
interface ICapability {
  description: string;
  title: string;
}

/**
 *
 */
const CAPABILITIES: readonly ICapability[] = [
  {
    description:
      'Which formats the league plays, points to win for each, winning margin, service interval, best-of format, expedite, and the cutthroat time cap.',
    title: 'Formats and rules',
  },
  {
    description:
      'Three roles: commissioner, manager, player. Decide whether players or managers create games and record results.',
    title: 'Who does what',
  },
  {
    description:
      'Invite by link or email, with expiry dates and use limits. Private by default; discoverable if you want people to find you.',
    title: 'Invitations and visibility',
  },
  {
    description:
      'Whether results need confirmation and how long they wait before automatic acceptance, how long they stay open for amendment, whether the league is rated, and how long a new player is provisional.',
    title: 'Results and ratings policy',
  },
];
</script>

<template>
  <section
    id="league"
    class="scroll-mt-16 px-6 py-16 md:px-16 md:py-24"
  >
    <div class="mx-auto grid max-w-[1120px] gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center">
      <FeaturesLeagueDiagram />

      <div>
        <h2
          id="league-heading"
          class="font-display text-h1 font-medium tracking-tight"
          tabindex="-1"
        >
          Your league, your rules.
        </h2>

        <p class="text-ink-muted text-body-lg mt-6">
          Set the rules once when you create the league. Every game after that inherits them, so nobody relitigates “win
          by two” at the table.
        </p>

        <dl class="mt-10 grid gap-x-8 gap-y-7 sm:grid-cols-2">
          <div
            v-for="capability in CAPABILITIES"
            :key="capability.title"
          >
            <dt class="text-body font-medium">{{ capability.title }}</dt>

            <dd class="text-ink-muted text-body-sm mt-2">{{ capability.description }}</dd>
          </div>
        </dl>
      </div>
    </div>
  </section>
</template>
