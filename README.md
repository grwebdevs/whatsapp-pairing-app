# whatsapp-pairing-app
whatsapp-pairing-app

# WhatsApp Bot Pairing Service

A web application that allows users to generate WhatsApp bot credentials (creds.json) by pairing their WhatsApp device.

## Features

- Generate pairing codes for WhatsApp
- QR code scanning alternative
- Automatic credential file generation
- Clean, responsive UI
- Rate limiting for security
- Automatic session cleanup

## Deployment

This application is designed to be deployed on Coolify using Docker Compose.

## Technology Stack

- Backend: Node.js with Express and Baileys
- Frontend: React
- Deployment: Docker with Nginx










whatsapp-pairing-app/
├── backend/
│   ├── src/
│   │   └── app.js
│   ├── package.json
│   └── Dockerfile
├── frontend/
│   ├── public/
│   │   ├── index.html
│   │   └── favicon.ico
│   ├── src/
│   │   ├── App.js
│   │   ├── App.css
│   │   └── index.js
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── README.md