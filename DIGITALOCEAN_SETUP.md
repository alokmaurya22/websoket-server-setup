# DigitalOcean Droplet Setup (Step-by-Step)

This guide shows how to deploy this server on a DigitalOcean Ubuntu droplet.
It is written for non-technical users and uses copy/paste commands.

## What you need before starting
- A domain name you control (example: `your-domain.com`)
- A DigitalOcean droplet running Ubuntu 22.04
- The droplet public IP address
- An email address for SSL certificate registration

## 1) Create the droplet
1. In DigitalOcean, create a new droplet.
2. Choose: Ubuntu 22.04, and a plan like 2 vCPU / 4 GB RAM.
3. Save the droplet IP address.

## 2) Open firewall ports
In DigitalOcean Firewall (recommended), allow inbound:
- TCP 22 (SSH)
- TCP 80 (HTTP)
- TCP 443 (HTTPS)

## 3) Point your domain to the droplet
At your DNS provider, create an A record:
- Name: `your-domain.com`
- Value: your droplet IP

Wait 1 to 10 minutes for DNS to update.

## 4) Connect to the droplet
From your computer terminal:
```bash
ssh root@YOUR_DROPLET_IP
```

## 5) Install Docker, Docker Compose, and Git
Copy/paste:
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
If you run the command above, log out and log back in.

## 6) Clone the repo
Copy/paste (replace the URL if your repo is different):
```bash
git clone https://github.com/alokmaurya22/websoket-server-setup.git
cd websoket-server-setup
```

## 7) Set your domain in Nginx config
Edit the file and replace `localhost` with your domain in both places.
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
Save and exit (Ctrl+O, Enter, Ctrl+X).

## 8) Set allowed origins
Edit `docker-compose.yml` and update the origin to your domain:
```bash
nano docker-compose.yml
```
Set:
```
ALLOWED_ORIGINS: https://your-domain.com
```
Save and exit.

## 9) Get a real SSL certificate (Let's Encrypt)
Install certbot:
```bash
apt install -y certbot
```
Generate a certificate (replace domain and email):
```bash
certbot certonly --standalone -d your-domain.com --agree-tos -m you@example.com --no-eff-email
```

## 10) Point Nginx to the Let's Encrypt certs
Edit the same Nginx file and update the cert paths:
```bash
nano nginx/conf.d/nodejs_server.conf
```
Replace:
```
ssl_certificate /etc/nginx/ssl/localhost.crt;
ssl_certificate_key /etc/nginx/ssl/localhost.key;
```
With:
```
ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
```
Save and exit.

## 11) Mount the certs into the Nginx container
Edit `docker-compose.yml` and replace the nginx volume with:
```
    volumes:
      - /etc/letsencrypt:/etc/letsencrypt:ro
```
```bash
nano docker-compose.yml
```
Save and exit.

## 12) Start the server
```bash
docker compose build
docker compose up -d
```

## 13) Verify it works
Open in your browser:
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
Note: certbot installs a system timer to auto-renew.

## 15) Helpful commands (optional)
Check status:
```bash
docker compose ps
```
View logs:
```bash
docker compose logs -f nginx
docker compose logs -f nodejs_server
```
Stop everything:
```bash
docker compose down
```

## Troubleshooting
- If Docker says the build context folder does not exist, open `docker-compose.yml`
  and make sure the `build.context` path matches the actual folder name.
