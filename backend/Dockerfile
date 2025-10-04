FROM node:18-alpine

WORKDIR /app

# Install Git and other build tools
RUN apk add --no-cache git

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy source code
COPY . .

# Create sessions directory
RUN mkdir -p sessions

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "src/app.js"]