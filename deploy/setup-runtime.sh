#!/usr/bin/env bash
set -euo pipefail

# Run as root after checking out the repository and installing Node 24.
getent passwd areium-blog >/dev/null || useradd --system --user-group --home-dir /var/lib/areium-blog --shell /sbin/nologin areium-blog
install -d -m 0750 -o areium-blog -g areium-blog /var/lib/areium-blog

if [[ ! -f /etc/areium-blog.env ]]; then
  (
  umask 077
  {
    printf '%s\n' 'SITE_URL=http://120.53.103.157:8080' 'BLOG_DATA_DIR=/var/lib/areium-blog' 'GITHUB_CLIENT_ID=' 'GITHUB_CLIENT_SECRET='
    printf 'AUTH_SECRET='
    openssl rand -hex 32
  } > /etc/areium-blog.env
  )
fi

export PATH=/opt/areium-blog/node/bin:$PATH
export NEXT_TELEMETRY_DISABLED=1
export NODE_OPTIONS=--max-old-space-size=768
set -a
source /etc/areium-blog.env
set +a
cd /www/wwwroot/areium-blog
pnpm test
pnpm build
chgrp -R areium-blog .next
chmod -R g+rX .next
install -d -m 0750 -o areium-blog -g areium-blog .next/cache
install -m 0644 /opt/areium-blog/areium-blog.service /etc/systemd/system/areium-blog.service
systemctl daemon-reload
systemctl enable areium-blog
systemctl restart areium-blog
for attempt in {1..20}; do
  if curl -fsS -o /dev/null http://127.0.0.1:3000/; then
    systemctl is-active areium-blog
    exit 0
  fi
  sleep 1
done
systemctl is-active areium-blog
exit 1
