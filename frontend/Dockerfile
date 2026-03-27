# Dockerfile for Baymax Career Coach Frontend
# Build: docker build -t baymax-frontend:latest .
# Run: docker run -p 5173:5173 baymax-frontend

FROM node:20-alpine as build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application code
COPY . .

# Build the app
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install serve to run the built app
RUN npm install -g serve

# Copy built app from build stage
COPY --from=build /app/dist ./dist

# Expose port
EXPOSE 5173

# Set environment
ENV HOST=0.0.0.0
ENV PORT=5173

# Serve the app
CMD ["serve", "-s", "dist", "-l", "5173", "-H"]
