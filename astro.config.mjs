// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';

const SESSION_PASSWORD = process.env.SESSION_PASSWORD || 'dev-session-password-change';

// https://astro.build/config
export default defineConfig({
  adapter: cloudflare({
    platformProxy: {
      enabled: true
    },

    imageService: "cloudflare",
    sessions: { enabled: false }
  }),

  session: {
    driver: 'cookie',
    password: SESSION_PASSWORD
  },

  integrations: [preact()],

  vite: {
    plugins: [tailwindcss()]
  }
});
