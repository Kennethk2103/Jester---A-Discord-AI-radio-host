FROM node:12
FROM ubuntu:20.04
FROM python:3.8

WORKDIR /app

COPY package*.json ./

RUN apt-get update && apt-get install -y ffmpeg

RUN apt-get install -y nodejs npm

RUN npm install

RUN pip install edge-tts

RUN pip install diffusers invisible_watermark transformers accelerate safetensors torch

COPY . .

CMD ["sh", "-c", "node src/register-commands.js && node src/index.js"]