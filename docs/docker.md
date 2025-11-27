# Docker & Docker Compose

This repo includes a simple Dockerfile and `docker-compose.yml` for local or self-hosted deployments. It wires the app, MinIO (S3-compatible storage), and a local Whisper server by default. All settings can be overridden via env vars.

## Prerequisites
- Docker + Docker Compose
- Ports available: `3000` (app), `9000/9001` (MinIO), `9002` (Whisper port forwarded from 9000)

## Quick start
```bash
docker compose up --build
```
Then:
- App: http://localhost:13000
- MinIO console: http://localhost:19001 (user/pass: `minioadmin`/`minioadmin`)
- Whisper server: http://localhost:19002 (proxied to container port 9000; using `onerahmet/openai-whisper-asr-webservice:latest`)

The first account you create becomes admin. If no users exist, `/` redirects to `/signup`.

## Services
- **app**: Node 22, uses SQLite stored on the `app-data` volume. Uploads go to `uploads` volume.
- **minio**: S3-compatible storage with console on port 9001. Bucket defaults to `podcasty`.
- **whisper**: Uses `onerahmet/openai-whisper-asr-webservice:latest` (HTTP API at `/asr`) with the base model on CPU. Adjust env vars (`ASR_MODEL`, `ASR_ENGINE=openai_whisper`, etc.) or swap the image if you prefer a different model/engine.

## Environment defaults (override as needed)
In `docker-compose.yml` under `app.environment`:
- `AWS_*`, `BUCKET_NAME`: point to MinIO defaults.
- `WHISPER_ENDPOINT`: defaults to the local Whisper server (`http://whisper:9000/asr`).
- `ENABLE_WHISPER`: `"true"`; leave `OPENAI_API_KEY` empty to use local. Set `OPENAI_API_KEY` + `ENABLE_WHISPER=true` to use OpenAI instead.
- `WHISPER_AUTH_HEADER`: optional auth header for your local Whisper endpoint.
- `DATABASE_URL`, `DATABASE_PATH`, `CACHE_DATABASE_PATH`: SQLite on `/data`.
- `SESSION_SECRET`, `INTERNAL_COMMAND_TOKEN`, `HONEYPOT_SECRET`: change for real deployments.
- `ALLOW_INDEXING`: `"false"` by default.

## Switching Whisper modes
- **Local (default)**: Set `WHISPER_ENDPOINT` (and optional `WHISPER_AUTH_HEADER`). No OpenAI key needed.
- **OpenAI**: Clear `WHISPER_ENDPOINT`, set `OPENAI_API_KEY`, and `ENABLE_WHISPER=true`. Optional `OPENAI_AUDIO_MODEL` (default `whisper-1`).
The episode transcript modal shows setup guidance if Whisper isn’t configured.

## Data persistence
- `app-data`: SQLite DBs
- `uploads`: file uploads
- `minio-data`: MinIO storage
- `whisper-models`: persisted models for whisper.cpp

## Building manually
```bash
docker build -t podcasty .
docker run --rm -p 3000:3000 podcasty
```

## Notes
- The Dockerfile installs deps in the builder, copies the repo, runs `npm run build`, then installs production deps in the runtime image. Volumes are mounted for databases and uploads.
- Update secrets and consider binding to a reverse proxy with TLS for production.
- Whisper uses a prebuilt image; to change it, update the `whisper` service in `docker-compose.yml` (image/env/ports) to match your desired build.
- Whisper envs (for `onerahmet/openai-whisper-asr-webservice`):
  - `ASR_MODEL` (default `base`): smaller (`tiny`, `tiny.en`, `base`) = less RAM/CPU and faster; larger (`small`, `medium`, `large`) = more accurate but slower and higher RAM/CPU (may OOM on small hosts).
  - `ASR_ENGINE` (default `openai_whisper`): leave as-is for this image.
  - `ASR_LANGUAGE` (default `en`): set to force language; leave empty for auto-detect (may be slower).
  - `ASR_BEAM_SIZE` (default `5`): beam search width. Higher can slightly improve accuracy but increases CPU/memory and latency; set to `1-2` if resources are tight.
- Whisper endpoint path: the app expects `/asr` for this image; if you change images or ports, update `WHISPER_ENDPOINT` accordingly.
- Bucket name and creds: `BUCKET_NAME` must match MinIO. Set `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` in the `minio` service and the same values in `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` for the app.
