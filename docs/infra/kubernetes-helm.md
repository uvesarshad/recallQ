# Kubernetes and Helm Deployment

> Scope: Minimal Kubernetes deployment path for RecallQ.
> Rendering context: Server-side
> Project tier: 4
> Last updated: 2026-07-07

## Overview
`deploy/helm/recallq` contains a small Helm chart for the web app, enrichment worker, reminders worker, jobs worker, shared file volume, service, optional ingress, ConfigMap, and Secret.

## Usage
Build and push an image from `Dockerfile.selfhost`, then install:

```bash
helm upgrade --install recallq deploy/helm/recallq \
  --set image.repository=registry.example.com/recallq \
  --set image.tag=latest \
  --set secretEnv.DATABASE_URL='postgres://...' \
  --set secretEnv.AUTH_SECRET='...' \
  --set secretEnv.GEMINI_API_KEY='...'
```

Set `ingress.enabled=true` plus `ingress.host` and `ingress.tlsSecretName` when the cluster provides ingress/TLS. File uploads and archive assets mount at `/data/files` through the chart PVC.

## Operational Notes
- Run migrations before rolling traffic to a new image.
- Keep one replica for each worker until job handlers are audited for idempotency.
- Use external PostgreSQL/pgvector in production; the chart intentionally does not install a database.
- Keep `.well-known` mobile link files valid at the public host when app links are enabled.

AGENT UPDATE: docs/overview.md, docs/infra/deployment.md
