# Droplet Deployment Guide (Ubuntu)

This file is for deployment on a Linux Ubuntu droplet only. Do NOT use these steps locally.

## 1) Create the droplet
- Create an Ubuntu 22.04 droplet.
- Note the public IP address.

## 2) Point your domain to the droplet
- In your DNS provider, create an A record:
  - Name: `your-domain.com`
  - Value: your droplet IP
- Wait 1 to 10 minutes for DNS to update.

## 3) Connect to the droplet
```bash
ssh root@YOUR_DROPLET_IP
```

## 4) Install Docker, Docker Compose, and Git
```bash
apt update
apt install -y ca-certificates curl gnupg git
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

Optional (recommended): allow running docker without sudo.
```bash
usermod -aG docker $USER
```
Log out and log back in if you run the command above.

## 5) Clone the repo on the droplet
```bash
git clone https://github.com/alokmaurya22/websoket-server-setup.git
cd websoket-server-setup
```

## 6) Update the domain in Nginx config
Edit `nginx/conf.d/nodejs_server.conf` and replace `localhost` with your domain in both server blocks.
```bash
nano nginx/conf.d/nodejs_server.conf
```
Change:
```
server_name localhost;
```
To:
```
server_name your-domain.com;
```
Save and exit.

## 7) Update allowed origins
Edit `docker-compose.yml` and set:
```
ALLOWED_ORIGINS: https://your-domain.com
```
```bash
nano docker-compose.yml
```

## 8) Get a real SSL certificate (Let's Encrypt)
Stop containers if they are running:
```bash
docker compose down
```

Install certbot and generate certificates:
```bash
apt install -y certbot
certbot certonly --standalone -d your-domain.com --agree-tos -m you@example.com --no-eff-email
```

## 9) Point Nginx to the Let's Encrypt certs
Edit `nginx/conf.d/nodejs_server.conf` and replace the certificate lines with:
```
ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
```
```bash
nano nginx/conf.d/nodejs_server.conf
```

## 10) Mount the certs into the Nginx container
Edit `docker-compose.yml` and replace the nginx volume with:
```
    volumes:
      - /etc/letsencrypt:/etc/letsencrypt:ro
```
```bash
nano docker-compose.yml
```

## 11) Configure firewall (UFW)
```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

## 12) Build and run
```bash
docker compose build
docker compose up -d
```

## 13) Verify
Open in browser:
```
https://your-domain.com/health
```
You should see:
```
{"status":"ok"}
```

## 14) Auto-renew SSL certificates
Test renewal:
```bash
certbot renew --dry-run
```
Note: certbot already installs a system timer to auto-renew.
