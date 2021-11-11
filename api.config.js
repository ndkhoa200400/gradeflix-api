module.exports = {
  apps: [{
    name: 'gradeflix',
    script: 'node -r source-map-support/register .',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '4G'
  }]
}
