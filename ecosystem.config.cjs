module.exports = {
  apps: [
    {
      name: "vacation-bot",
      script: "src/index.js",
      watch: false,
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};