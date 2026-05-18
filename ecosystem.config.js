module.exports = {
  apps: [
    {
      name: "recall-web",
      script: "node_modules/.bin/next",
      args: "start",
      env: { PORT: 3008, NODE_ENV: "production" },
      restart_delay: 3000,
      max_restarts: 10,
    },
    {
      name: "recall-enrichment",
      script: "workers/enrichment-worker.ts",
      interpreter: "node_modules/.bin/tsx",
      instances: 1,
      restart_delay: 5000,
      max_restarts: 10,
      env: { NODE_ENV: "production" },
    },
    {
      name: "recall-reminders",
      script: "workers/reminder-worker.ts",
      interpreter: "node_modules/.bin/tsx",
      instances: 1,
      restart_delay: 10000,
      max_restarts: 10,
      env: { NODE_ENV: "production" },
    },
  ],
};
