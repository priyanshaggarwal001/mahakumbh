# Use an older Debian-based image to match sqlite3 prebuilds or ensure a stable environment
FROM node:20-bookworm

# Create and change to the app directory
WORKDIR /app

# Install build essentials for compiling sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy application dependency manifests to the container image.
COPY package*.json ./

# Install dependencies and FORCE REBUILD from source
RUN npm install && npm rebuild sqlite3 --build-from-source

# Copy local code to the container image.
COPY . .

# Expose the port the app runs on
EXPOSE 3001

# Run the web service on container startup.
CMD [ "npm", "start" ]
