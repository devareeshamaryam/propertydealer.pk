// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'api',
      cwd: './apps/api',               // important!
      script: 'dist/apps/api/src/main.js',          // or whatever your NestJS>
      // script: 'pnpm start',         // alternative if you prefer
      // args: '-- -p 4000',           // only if needed
      instances: 1,                    // or 'max' / number
      exec_mode: 'fork',               // cluster mode usually not needed for >
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5000                     // or your preferred API port
      }
    },
{
      name: 'web',
      cwd: './apps/web',
      script: './node_modules/.bin/next',
      args: 'start',
      // script: 'pnpm start',         // also works if "start": "next start"
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3010
      }
    }
  ]
};
