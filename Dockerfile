# ---------- Stage 1: Build ----------
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /usr/src/app

# Copy dependency definitions
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm install

# Copy application source
COPY . .

# ---------- Stage 2: Production ----------
FROM node:20-alpine AS production

# Set working directory
WORKDIR /usr/src/app

# Copy only production dependencies
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/src ./src

# Expose the port your app runs on
EXPOSE 5001

# Start the application
CMD ["node", "/usr/src/app/src/server.js"]





# 1. Use the official Node.js 20 image with Alpine
FROM node:20-alpine

# 2. Set the working directory inside the container
WORKDIR /usr/src/app

# 3. Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# 4. Install the Node.js dependencies
RUN npm install

# 5. Copy the rest of your application code to the working directory
COPY . .

# 6. Expose the port your app runs on (usually 3000 for Node.js apps)
EXPOSE 5001

# 7. Define the command to start the Node.js application
CMD ["node", "server.js"]
