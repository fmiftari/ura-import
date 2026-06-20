FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
ENV PORT=8787
EXPOSE 8787
# Persist data outside the container image — mount a volume at /app/data
# on whichever host you use (see DEPLOY.md).
ENV DATA_DIR=/app/data
CMD ["node", "src/index.js"]
