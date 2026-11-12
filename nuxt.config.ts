// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  // The pet lives entirely in the browser (IndexedDB, timers). Only /api/jev runs on the server.
  ssr: false,
  app: {
    head: {
      title: 'Browser Pet',
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    },
  },
})
