module.exports = {
  apps: [
    {
      name: "my_finary",
      script: "node_modules/.bin/next",
      args: "start",
      cwd: "/home/arthur/work/my_finary",
      instances: 1,
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
