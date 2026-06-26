module.exports = {
  apps: [
    {
      name: 'catalogo-ventas-backend',
      script: 'server.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false
    }
  ]
};
