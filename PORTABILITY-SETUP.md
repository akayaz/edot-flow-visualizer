# EDOT Flow Visualizer - Portability & Deployment Setup

This document summarizes the portability and deployment infrastructure added to the EDOT Flow Visualizer.

## What Was Created

### 1. Docker Support ✅

**Files Created:**
- `Dockerfile` - Multi-stage production-optimized build
- `.dockerignore` - Efficient Docker builds
- `docker-compose.yml` - One-command local deployment
- `.env.docker` - Docker environment configuration
- `DOCKER-QUICKSTART.md` - Quick start guide

**Features:**
- Multi-stage build (deps → builder → runner)
- Optimized image size using Alpine Linux
- Non-root user for security
- Health checks built-in
- Production-ready configuration
- Resource limits configured

**Usage:**
```bash
# Quick start
docker compose up -d

# Or manual
docker build -t edot-visualizer .
docker run -p 3000:3000 edot-visualizer
```

---

### 2. Kubernetes Manifests ✅

**Files Created:**
- `k8s/namespace.yaml` - Isolated namespace
- `k8s/configmap.yaml` - Environment configuration
- `k8s/secret.yaml` - Secrets template
- `k8s/deployment.yaml` - Application deployment
- `k8s/service.yaml` - Load balancing
- `k8s/ingress.yaml` - External access (NGINX + GKE)
- `k8s/hpa.yaml` - Auto-scaling
- `k8s/pdb.yaml` - High availability
- `k8s/networkpolicy.yaml` - Network security
- `k8s/kustomization.yaml` - Kustomize config
- `k8s/README.md` - Quick reference

**Features:**
- Production-ready deployment with 2 replicas
- Horizontal Pod Autoscaler (2-10 pods based on CPU/memory)
- Zero-downtime rolling updates
- Health probes (liveness, readiness, startup)
- Pod disruption budget for HA
- Network policies for security
- Resource limits and requests
- Anti-affinity for pod distribution
- Security contexts (non-root, no privilege escalation)
- Both standard and GKE-optimized ingress
- Support for GKE ManagedCertificate (auto TLS)

**Usage:**
```bash
# Standard deployment
kubectl apply -f k8s/

# With Kustomize
kubectl apply -k k8s/

# Check status
kubectl get all -n edot-visualizer
```

---

### 3. Health Check Endpoint ✅

**File Created:**
- `app/api/health/route.ts` - Health check API

**Features:**
- Returns JSON health status
- Includes uptime and version
- Used by Docker healthcheck
- Used by Kubernetes probes

**Endpoint:**
```bash
GET /api/health

Response:
{
  "status": "healthy",
  "timestamp": "2024-12-24T12:00:00.000Z",
  "uptime": 3600,
  "service": "edot-flow-visualizer",
  "version": "0.1.0"
}
```

---

### 4. Documentation ✅

**Files Created:**
- `DEPLOYMENT.md` - Comprehensive 500+ line deployment guide
- `DOCKER-QUICKSTART.md` - 2-minute Docker guide
- `k8s/README.md` - Kubernetes quick reference
- `PORTABILITY-SETUP.md` - This file

**Coverage:**
- Docker deployment (local and production)
- Kubernetes deployment (self-managed and GKE)
- Configuration management
- Monitoring and operations
- Troubleshooting common issues
- Security best practices
- Backup and disaster recovery

---

### 5. Automation (Makefile) ✅

**File Created:**
- `Makefile` - 50+ automation commands

**Categories:**
- Development (`make dev`, `make typecheck`)
- Docker (`make docker-build`, `make compose-up`)
- Container Registry (`make push`, `make pull`)
- Kubernetes (`make k8s-deploy`, `make k8s-logs`)
- Kustomize (`make kustomize-deploy`)
- GKE (`make gke-create-cluster`, `make gke-build-push`)
- Monitoring (`make health-check`, `make k8s-top-pods`)
- Testing (`make test-docker`, `make test-k8s`)

**Usage:**
```bash
make help  # Show all available commands
```

---

### 6. Configuration Updates ✅

**Modified Files:**
- `next.config.js` - Added `output: 'standalone'` for Docker optimization

---

## Deployment Options Summary

### Option 1: Docker (Local/Development)
**Best for:** Team sharing, consistent environments

```bash
docker compose up -d
```

**Access:** http://localhost:3000

---

### Option 2: Kubernetes (Self-Managed)
**Best for:** Production deployments, self-managed clusters

```bash
# Update image in k8s/deployment.yaml
kubectl apply -f k8s/
```

**Access:** Via Ingress (configure domain)

---

### Option 3: GKE (Google Cloud)
**Best for:** Google Cloud deployments with managed infrastructure

```bash
# Build and push to GCR
gcloud builds submit --tag gcr.io/PROJECT-ID/edot-visualizer .

# Deploy with GKE-optimized ingress
kubectl apply -f k8s/
```

**Features:**
- Managed certificates (auto TLS)
- Global load balancer
- Cloud Armor integration ready
- Stackdriver logging

---

## Key Features

### High Availability
- ✅ Multiple replicas (2 default, up to 10 with HPA)
- ✅ Pod disruption budget (min 1 pod always available)
- ✅ Anti-affinity rules (spread across nodes)
- ✅ Health probes (auto-restart unhealthy pods)
- ✅ Zero-downtime rolling updates

### Security
- ✅ Non-root containers
- ✅ Read-only root filesystem (where possible)
- ✅ Drop all capabilities
- ✅ Network policies (traffic control)
- ✅ Secret management
- ✅ Security contexts configured

### Performance
- ✅ Multi-stage Docker builds (small images)
- ✅ Resource limits and requests
- ✅ Horizontal pod autoscaling
- ✅ Next.js standalone output
- ✅ Alpine-based images

### Observability
- ✅ Health check endpoints
- ✅ Structured logging
- ✅ Resource monitoring (kubectl top)
- ✅ HPA metrics
- ✅ Prometheus annotations ready

### Developer Experience
- ✅ One-command deployment (Docker Compose)
- ✅ Makefile automation (50+ commands)
- ✅ Comprehensive documentation
- ✅ Quick start guides
- ✅ Troubleshooting guides

---

## Architecture

### Docker Architecture
```
┌─────────────────────────────────────┐
│     Multi-Stage Dockerfile          │
├─────────────────────────────────────┤
│ Stage 1: deps (dependencies)        │
│   - Install production deps         │
│   - Cache for faster rebuilds       │
├─────────────────────────────────────┤
│ Stage 2: builder (build app)        │
│   - Copy source code                │
│   - Run Next.js build               │
│   - Generate standalone output      │
├─────────────────────────────────────┤
│ Stage 3: runner (production)        │
│   - Minimal Alpine image            │
│   - Non-root user (nextjs:1001)     │
│   - Health checks enabled           │
│   - Port 3000 exposed               │
└─────────────────────────────────────┘
```

### Kubernetes Architecture
```
┌──────────────────────────────────────────────┐
│            Ingress Controller                 │
│  (NGINX or GKE Load Balancer + TLS)          │
└────────────────┬─────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────┐
│              Service (ClusterIP)              │
│        edot-visualizer (port 80)              │
│     Session Affinity: ClientIP (SSE)          │
└────────────────┬─────────────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
┌──────────────┐  ┌──────────────┐
│   Pod 1      │  │   Pod 2      │
│ (replica 1)  │  │ (replica 2)  │
│              │  │              │
│ Container:   │  │ Container:   │
│  - Next.js   │  │  - Next.js   │
│  - Port 3000 │  │  - Port 3000 │
│  - Health ✓  │  │  - Health ✓  │
└──────────────┘  └──────────────┘
        │                 │
        └────────┬────────┘
                 ▼
        ┌─────────────────┐
        │       HPA        │
        │  Min: 2 pods     │
        │  Max: 10 pods    │
        │  Target: 70% CPU │
        └─────────────────┘
```

---

## Quick Reference

### Docker Commands
```bash
# Build
docker build -t edot-visualizer .

# Run
docker run -p 3000:3000 edot-visualizer

# Compose
docker compose up -d
docker compose logs -f
docker compose down

# Push to registry
docker tag edot-visualizer registry/edot-visualizer:v1
docker push registry/edot-visualizer:v1
```

### Kubernetes Commands
```bash
# Deploy
kubectl apply -f k8s/
kubectl apply -k k8s/  # with Kustomize

# Status
kubectl get all -n edot-visualizer
kubectl get pods -n edot-visualizer

# Logs
kubectl logs -f -n edot-visualizer -l app=edot-flow-visualizer

# Scale
kubectl scale deployment edot-visualizer -n edot-visualizer --replicas=5

# Update
kubectl set image deployment/edot-visualizer \
  edot-visualizer=registry/edot-visualizer:v2 \
  -n edot-visualizer

# Debug
kubectl describe pod <pod-name> -n edot-visualizer
kubectl exec -it -n edot-visualizer deployment/edot-visualizer -- sh

# Port forward
kubectl port-forward -n edot-visualizer deployment/edot-visualizer 3000:3000

# Delete
kubectl delete namespace edot-visualizer
```

### Make Commands
```bash
# See all commands
make help

# Docker
make compose-up
make docker-build
make push REGISTRY=gcr.io/my-project

# Kubernetes
make k8s-deploy
make k8s-status
make k8s-logs
make k8s-scale REPLICAS=5

# GKE
make gke-build-push PROJECT_ID=my-project
make gke-create-cluster
```

---

## Next Steps

1. **Test Docker locally:**
   ```bash
   docker compose up -d
   open http://localhost:3000
   ```

2. **Push to container registry:**
   ```bash
   # For GCR
   docker tag edot-visualizer gcr.io/PROJECT-ID/edot-visualizer:latest
   docker push gcr.io/PROJECT-ID/edot-visualizer:latest
   ```

3. **Deploy to Kubernetes:**
   ```bash
   # Update k8s/deployment.yaml with your image
   # Update k8s/ingress.yaml with your domain
   kubectl apply -f k8s/
   ```

4. **Configure monitoring:**
   - Set up Prometheus for metrics
   - Configure Grafana dashboards
   - Set up alerting rules

5. **Set up CI/CD:**
   - Automate Docker builds
   - Automate Kubernetes deployments
   - Add automated testing

---

## Support

- **Documentation:** See `DEPLOYMENT.md` for comprehensive guide
- **Docker Help:** See `DOCKER-QUICKSTART.md`
- **Kubernetes Help:** See `k8s/README.md`
- **Issues:** Report at GitHub issues page

---

## Summary

Your EDOT Flow Visualizer is now fully portable and production-ready with:

✅ **Docker support** - Run anywhere Docker runs
✅ **Kubernetes manifests** - Production-grade deployment
✅ **GKE optimization** - Google Cloud ready
✅ **Auto-scaling** - Handle variable load
✅ **High availability** - Multiple replicas + PDB
✅ **Security hardened** - Non-root, network policies
✅ **Health checks** - Kubernetes probes + Docker healthcheck
✅ **Documentation** - 3 comprehensive guides
✅ **Automation** - Makefile with 50+ commands

**Deployment time:**
- Docker: 1 minute
- Kubernetes: 15 minutes
- GKE: 30 minutes

🚀 Your application is ready for production deployment!
