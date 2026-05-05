#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# MockMate — HTTPS Setup Script for AWS EC2
# 
# Prerequisites:
#   1. A domain name pointing to your EC2 IP (3.19.239.13)
#      - Add an A record: yourdomain.com → 3.19.239.13
#      - Wait 5–10 minutes for DNS propagation
#   2. EC2 Security Group allows inbound port 443 (HTTPS)
#
# Usage:
#   ssh -i your-key.pem ec2-user@3.19.239.13
#   cd ~/MockMate
#   chmod +x aws/setup-https.sh
#   sudo bash aws/setup-https.sh yourdomain.com
# ─────────────────────────────────────────────────────────────────────────────
set -e

DOMAIN="${1:?Usage: sudo bash setup-https.sh yourdomain.com}"
EMAIL="${2:-admin@$DOMAIN}"

echo "═══════════════════════════════════════════════════════════"
echo "  MockMate HTTPS Setup"
echo "  Domain: $DOMAIN"
echo "  Email:  $EMAIL"
echo "═══════════════════════════════════════════════════════════"

# ── Step 1: Install Certbot ──────────────────────────────────────────────────
echo ""
echo "▶ Step 1: Installing Certbot..."
if command -v certbot &>/dev/null; then
    echo "  Certbot already installed: $(certbot --version 2>&1)"
else
    # Amazon Linux 2023 / AL2
    if command -v dnf &>/dev/null; then
        dnf install -y certbot python3-certbot-nginx
    elif command -v yum &>/dev/null; then
        amazon-linux-extras install epel -y 2>/dev/null || true
        yum install -y certbot python3-certbot-nginx
    elif command -v apt &>/dev/null; then
        apt update && apt install -y certbot python3-certbot-nginx
    else
        echo "ERROR: Unsupported package manager. Install certbot manually."
        exit 1
    fi
    echo "  ✓ Certbot installed"
fi

# ── Step 2: Open port 443 in EC2 Security Group ─────────────────────────────
echo ""
echo "▶ Step 2: Checking port 443..."
echo "  ⚠ Make sure your EC2 Security Group allows inbound TCP 443 (HTTPS)"
echo "    AWS Console → EC2 → Security Groups → Inbound Rules → Add Rule:"
echo "    Type: HTTPS | Port: 443 | Source: 0.0.0.0/0"
echo ""

# ── Step 3: Update nginx config with domain ──────────────────────────────────
echo "▶ Step 3: Updating nginx config with domain: $DOMAIN"
NGINX_CONF="/etc/nginx/conf.d/mockmate.conf"

cat > "$NGINX_CONF" << NGINX_EOF
# HTTP → HTTPS redirect
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$host\$request_uri;
}

# Keep IP-based HTTP access for health checks during setup
server {
    listen 80 default_server;
    server_name _;

    location = /health {
        proxy_pass http://localhost:8000;
        proxy_set_header Host \$host;
    }
    location / {
        return 301 https://$DOMAIN\$request_uri;
    }
}

# HTTPS server (Certbot will add ssl_certificate directives)
server {
    listen 443 ssl;
    server_name $DOMAIN;

    # Certbot will populate these:
    # ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    # Serve React SPA static files
    root /home/ec2-user/MockMate/frontend/dist;
    index index.html;

    # ─── API routes ──────────────────────────────────────────────────────
    location = /health {
        proxy_pass http://localhost:8000;
        proxy_set_header Host \$host;
    }

    location = /warmup {
        proxy_pass http://localhost:8000;
        proxy_set_header Host \$host;
    }

    location ~ ^/auth(/|$) {
        proxy_pass http://localhost:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
        client_max_body_size 500M;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
    location ~ ^/users(/|$) {
        proxy_pass http://localhost:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
        client_max_body_size 500M;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
    location ~ ^/profile(/|$) {
        proxy_pass http://localhost:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
        client_max_body_size 500M;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
    location ~ ^/interviews(/|$) {
        proxy_pass http://localhost:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
        client_max_body_size 500M;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
    location ~ ^/questions(/|$) {
        proxy_pass http://localhost:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
        client_max_body_size 500M;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
    location ~ ^/evaluation(/|$) {
        proxy_pass http://localhost:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
        client_max_body_size 500M;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    # ─── React SPA fallback ──────────────────────────────────────────────
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
NGINX_EOF

echo "  ✓ Nginx config written"

# ── Step 4: Test nginx config ────────────────────────────────────────────────
echo ""
echo "▶ Step 4: Testing nginx config..."
nginx -t
echo "  ✓ Nginx config valid"

# ── Step 5: Obtain SSL certificate ───────────────────────────────────────────
echo ""
echo "▶ Step 5: Obtaining SSL certificate from Let's Encrypt..."
certbot --nginx \
    -d "$DOMAIN" \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    --redirect

echo "  ✓ SSL certificate obtained and installed"

# ── Step 6: Reload nginx ────────────────────────────────────────────────────
echo ""
echo "▶ Step 6: Reloading nginx..."
systemctl reload nginx
echo "  ✓ Nginx reloaded with HTTPS"

# ── Step 7: Set up auto-renewal ──────────────────────────────────────────────
echo ""
echo "▶ Step 7: Setting up certificate auto-renewal..."
# Certbot installs a timer/cron by default, but let's verify
if systemctl list-timers | grep -q certbot; then
    echo "  ✓ Certbot auto-renewal timer already active"
else
    # Add cron job as fallback
    (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && systemctl reload nginx") | crontab -
    echo "  ✓ Auto-renewal cron job added (runs daily at 3 AM)"
fi

# ── Step 8: Verify ──────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ HTTPS Setup Complete!"
echo ""
echo "  Your site is now live at: https://$DOMAIN"
echo ""
echo "  Next steps:"
echo "  1. Update VITE_API_URL in GitHub Secrets to https://$DOMAIN"
echo "  2. Update FRONTEND_URL in backend .env to https://$DOMAIN"
echo "  3. Rebuild frontend: push to main or run CI/CD"
echo "  4. Test camera: https://$DOMAIN/setup → should work now!"
echo "═══════════════════════════════════════════════════════════"
