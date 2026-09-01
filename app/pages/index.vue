<template>
  <main>
    <section class="relative overflow-hidden px-16 pt-22 pb-26">
      <div class="pointer-events-none absolute inset-y-0 right-16 w-[38%] overflow-hidden">
        <ClientOnly>
          <HeroShader />
        </ClientOnly>
      </div>

      <div class="relative z-10 max-w-[620px]">
        <!-- height is reserved for the longest line so a rotation never shifts the copy below it -->
        <h1 class="font-display text-hero min-h-[140px] font-medium tracking-tight">
          <HeroHeadline />
        </h1>

        <p class="text-ink-muted text-body-lg mt-6 max-w-[520px]">
          Start a league. Compete with your family and friends. Climb the leaderboards.
        </p>

        <div class="mt-8 flex flex-wrap items-center gap-3">
          <a
            class="bg-accent text-accent-ink hover:bg-accent-hover text-body-lg rounded-md px-6 py-3 font-medium transition-colors"
            href="#"
          >
            Get Started
          </a>

          <NuxtLink
            class="text-accent-strong hover:text-accent text-body-lg flex items-center gap-1.5 rounded-md px-4 py-3 font-medium"
            to="/features"
          >
            See how it works
            <Icon
              class="size-4"
              name="lucide:arrow-right"
            />
          </NuxtLink>
        </div>
      </div>
    </section>

    <StatsBar />

    <HowItWorks />
  </main>
</template>
