# AWS EC2 Deployment Guide

This guide will help you deploy your Flora Carbon backend to AWS EC2 with Razorpay integration.

## Prerequisites

1. AWS EC2 instance running (Ubuntu/Amazon Linux recommended)
2. Node.js and npm installed on EC2
3. MongoDB database (can be MongoDB Atlas or self-hosted)
4. Razorpay account with live API keys
5. Domain name (optional, for production)

## Step 1: Get Razorpay Live Keys

**⚠️ CRITICAL**: You MUST switch from test keys to live keys for production!

1. Log in to [Razorpay Dashboard](https://dashboard.razorpay.com/)
2. Navigate to **Settings** → **API Keys**
3. If you haven't generated live keys yet:
   - Click **Generate Live Key**
   - Complete any required verification steps
4. Copy your **Live Key ID** (starts with `rzp_live_`) and **Live Key Secret**
5. **Keep these secure** - never commit them to Git

## Step 2: Prepare Your EC2 Instance

### Connect to your EC2 instance:
```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

### Install Node.js (if not already installed):
```bash
# For Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

### Install PM2 (Process Manager - recommended):
```bash
sudo npm install -g pm2
```

## Step 3: Deploy Your Code

### Option A: Using Git (Recommended)
```bash
# Clone your repository
cd /home/ubuntu
git clone your-repo-url
cd "flora carbon/backend"

# Install dependencies
npm install --production
```

### Option B: Using SCP (Manual Upload)
```bash
# From your local machine
scp -i your-key.pem -r backend/ ubuntu@your-ec2-ip:/home/ubuntu/
```

## Step 4: Configure Environment Variables

### Create `.env` file on EC2:
```bash
cd /home/ubuntu/backend  # or wherever you deployed
nano .env
```

### Add the following (replace with your actual values):
```env
# MongoDB Connection
MONGO_URI=your_mongodb_connection_string

# Server Port
PORT=5000

# Node Environment
NODE_ENV=production

# Razorpay LIVE Keys (NOT test keys!)
RAZORPAY_KEY_ID=rzp_live_YOUR_ACTUAL_LIVE_KEY_ID
RAZORPAY_KEY_SECRET=YOUR_ACTUAL_LIVE_KEY_SECRET
```

**⚠️ IMPORTANT CHANGES FROM DEVELOPMENT:**
1. ✅ Change `RAZORPAY_KEY_ID` from `rzp_test_...` to `rzp_live_...`
2. ✅ Change `RAZORPAY_KEY_SECRET` to your live secret
3. ✅ Set `NODE_ENV=production`
4. ✅ Use production MongoDB URI (not localhost)

### Secure the .env file:
```bash
chmod 600 .env  # Restrict permissions
```

## Step 5: Start Your Application

### Using PM2 (Recommended):
```bash
# Start the application
pm2 start server.js --name "flora-carbon-backend"

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system reboot
pm2 startup
# Follow the instructions it provides
```

### Using Node directly (not recommended for production):
```bash
node server.js
```

### Verify it's running:
```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs flora-carbon-backend

# Test the endpoint
curl http://localhost:5000/health
```

## Step 6: Configure Security Group (Firewall)

In AWS EC2 Console:
1. Go to **Security Groups**
2. Select your instance's security group
3. Add **Inbound Rules**:
   - **Type**: Custom TCP
   - **Port**: 5000 (or your PORT)
   - **Source**: 0.0.0.0/0 (or restrict to specific IPs)
   - **Description**: Flora Carbon Backend

## Step 7: Configure Nginx (Optional but Recommended)

For production, use Nginx as a reverse proxy:

### Install Nginx:
```bash
sudo apt update
sudo apt install nginx -y
```

### Configure Nginx:
```bash
sudo nano /etc/nginx/sites-available/flora-carbon
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;  # or your EC2 public IP

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/flora-carbon /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl restart nginx
```

## Step 8: Setup SSL with Let's Encrypt (Optional but Recommended)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

## Step 9: Verify Razorpay Integration

### Test the payment endpoint:
```bash
# Test payment route
curl http://localhost:5000/api/payment/test
```

Expected response:
```json
{
  "message": "Payment route is working",
  "razorpayConfigured": true
}
```

### Check logs for any Razorpay errors:
```bash
pm2 logs flora-carbon-backend
```

## Step 10: Update Frontend Configuration

Update your frontend to point to the production backend URL:
- Development: `http://localhost:5000`
- Production: `http://your-ec2-ip:5000` or `https://your-domain.com`

## Troubleshooting

### Razorpay errors:
- ✅ Verify you're using **live keys** (not test keys)
- ✅ Check that keys are correctly set in `.env`
- ✅ Ensure no extra spaces in environment variables
- ✅ Restart the application after changing `.env`

### Application won't start:
```bash
# Check logs
pm2 logs flora-carbon-backend

# Check if port is in use
sudo lsof -i :5000

# Restart application
pm2 restart flora-carbon-backend
```

### MongoDB connection issues:
- ✅ Verify `MONGO_URI` is correct
- ✅ If using MongoDB Atlas, whitelist EC2 IP address
- ✅ Check MongoDB connection string format

## Security Checklist

- [ ] Using live Razorpay keys (not test keys)
- [ ] `.env` file has restricted permissions (600)
- [ ] `.env` file is in `.gitignore`
- [ ] MongoDB connection uses authentication
- [ ] Firewall configured correctly
- [ ] SSL certificate installed (if using domain)
- [ ] PM2 process manager configured
- [ ] Regular backups configured

## Monitoring

### View application logs:
```bash
pm2 logs flora-carbon-backend
```

### Monitor application:
```bash
pm2 monit
```

### Restart application:
```bash
pm2 restart flora-carbon-backend
```

## Important Notes

1. **Never use test keys in production** - they won't process real payments
2. **Keep your live keys secure** - never commit them to Git
3. **Test thoroughly** with small amounts before going fully live
4. **Monitor Razorpay dashboard** for payment activity
5. **Set up alerts** in Razorpay for failed payments or issues

## Support

If you encounter issues:
1. Check PM2 logs: `pm2 logs flora-carbon-backend`
2. Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. Verify environment variables: `pm2 env flora-carbon-backend`
4. Test Razorpay connection: `curl http://localhost:5000/api/payment/test`

