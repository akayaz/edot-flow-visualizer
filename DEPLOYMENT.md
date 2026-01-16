# EDOT Flow Visualizer - Deployment Guide

Complete guide for deploying the EDOT Flow Visualizer using Docker and Kubernetes.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Docker Deployment](#docker-deployment)
3. [Kubernetes Deployment](#kubernetes-deployment)
4. [GKE-Specific Deployment](#gke-specific-deployment)
5. [Configuration](#configuration)
6. [Monitoring & Operations](#monitoring--operations)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Prerequisites

- **Docker**: Docker Engine 20.10+ and Docker Compose 2.0+
- **Kubernetes**: kubectl 1.24+ and a running cluster
- **Optional**: Helm 3.0+ for advanced deployments

### 5-Minute Local Setup (Docker)

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd edot-flow-visualizer

# 2. Build and run with Docker Compose
docker compose up -d

# 3. Access the application
open http://localhost:3000
```

---

## Docker Deployment

### Building the Image

```bash
# Build the Docker image
docker build -t edot-flow-visualizer:latest .

# Verify the build
docker images | grep edot-flow-visualizer
```

### Running with Docker Run

```bash
# Run the container
docker run -d \
  --name edot-visualizer \
  -p 3000:3000 \
  -e NEXT_PUBLIC_APP_URL=http://localhost:3000 \
  edot-flow-visualizer:latest

# Check logs
docker logs -f edot-visualizer

# Stop the container
docker stop edot-visualizer
docker rm edot-visualizer
```

### Running with Docker Compose (Recommended)

```bash
# Start in detached mode
docker compose up -d

# View logs
docker compose logs -f

# Stop the application
docker compose down

# Rebuild and restart
docker compose up -d --build
```

### Docker Compose Configuration

Edit `.env.docker` to customize the deployment:

```bash
# Application URL
NEXT_PUBLIC_APP_URL=http://your-domain.com

# Port mapping (change host port if 3000 is in use)
HOST_PORT=8080

# Optional: Elastic APM configuration
ELASTIC_APM_ENDPOINT=https://your-deployment.apm.cloud.es.io:443
ELASTIC_APM_SECRET_TOKEN=your-secret-token

# Demo mode
NEXT_PUBLIC_DEMO_MODE=true
```

### Pushing to Container Registry

```bash
# For Docker Hub
docker tag edot-flow-visualizer:latest your-username/edot-flow-visualizer:latest
docker push your-username/edot-flow-visualizer:latest

# For GCR (Google Container Registry)
docker tag edot-flow-visualizer:latest gcr.io/your-project/edot-flow-visualizer:latest
docker push gcr.io/your-project/edot-flow-visualizer:latest

# For AWS ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
docker tag edot-flow-visualizer:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/edot-flow-visualizer:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/edot-flow-visualizer:latest
```

---

## Kubernetes Deployment

### Prerequisites

1. A running Kubernetes cluster (self-managed, GKE, EKS, AKS)
2. `kubectl` configured to connect to your cluster
3. Container image pushed to a registry accessible by your cluster

### Quick Deploy (All-in-One)

```bash
# Deploy all resources
kubectl apply -f k8s/

# Check deployment status
kubectl get all -n edot-visualizer

# Get the service URL (if using LoadBalancer)
kubectl get svc -n edot-visualizer
```

### Step-by-Step Deployment

#### 1. Create Namespace

```bash
kubectl apply -f k8s/namespace.yaml
```

#### 2. Configure Environment Variables

Edit `k8s/configmap.yaml` to set your configuration:

```yaml
data:
  NEXT_PUBLIC_APP_URL: "https://your-domain.com"  # UPDATE THIS
  NEXT_PUBLIC_DEMO_MODE: "true"
```

Apply the ConfigMap:

```bash
kubectl apply -f k8s/configmap.yaml
```

#### 3. (Optional) Configure Secrets

For Elastic APM integration:

```bash
kubectl create secret generic edot-visualizer-secrets \
  --namespace edot-visualizer \
  --from-literal=ELASTIC_APM_SECRET_TOKEN=your-secret-token \
  --from-literal=ELASTIC_APM_ENDPOINT=https://your-deployment.apm.cloud.es.io:443
```

#### 4. Update Deployment Image

Edit `k8s/deployment.yaml` to reference your container image:

```yaml
containers:
  - name: edot-visualizer
    image: your-registry/edot-flow-visualizer:latest  # UPDATE THIS
    imagePullPolicy: Always  # Use Always for production
```

Apply the deployment:

```bash
kubectl apply -f k8s/deployment.yaml
```

#### 5. Deploy Service

```bash
kubectl apply -f k8s/service.yaml
```

#### 6. Configure Ingress

Edit `k8s/ingress.yaml` to set your domain:

```yaml
spec:
  rules:
    - host: edot-visualizer.your-domain.com  # UPDATE THIS
```

Apply the ingress:

```bash
kubectl apply -f k8s/ingress.yaml
```

#### 7. Enable Autoscaling

```bash
# Deploy HPA (requires metrics-server)
kubectl apply -f k8s/hpa.yaml

# Deploy PodDisruptionBudget for high availability
kubectl apply -f k8s/pdb.yaml
```

#### 8. (Optional) Network Policy

For enhanced security:

```bash
kubectl apply -f k8s/networkpolicy.yaml
```

### Using Kustomize (Recommended)

```bash
# Preview what will be deployed
kubectl kustomize k8s/

# Deploy with kustomize
kubectl apply -k k8s/

# Update image version
cd k8s/
kustomize edit set image edot-flow-visualizer=your-registry/edot-flow-visualizer:v1.0.0
kubectl apply -k .
```

---

## GKE-Specific Deployment

### 1. Create GKE Cluster

```bash
# Create a GKE cluster
gcloud container clusters create edot-visualizer-cluster \
  --zone us-central1-a \
  --num-nodes 3 \
  --machine-type e2-standard-2 \
  --enable-autoscaling \
  --min-nodes 2 \
  --max-nodes 10 \
  --enable-autorepair \
  --enable-autoupgrade

# Get credentials
gcloud container clusters get-credentials edot-visualizer-cluster --zone us-central1-a
```

### 2. Build and Push to GCR

```bash
# Enable GCR API
gcloud services enable containerregistry.googleapis.com

# Build with Cloud Build (recommended)
gcloud builds submit --tag gcr.io/YOUR-PROJECT-ID/edot-flow-visualizer:latest .

# Or push local image
docker tag edot-flow-visualizer:latest gcr.io/YOUR-PROJECT-ID/edot-flow-visualizer:latest
docker push gcr.io/YOUR-PROJECT-ID/edot-flow-visualizer:latest
```

### 3. Reserve Static IP (for Ingress)

```bash
# Reserve global static IP
gcloud compute addresses create edot-visualizer-ip --global

# Get the IP address
gcloud compute addresses describe edot-visualizer-ip --global
```

### 4. Deploy with GKE-Optimized Ingress

Edit `k8s/ingress.yaml` and uncomment the GKE-specific section:

```yaml
annotations:
  kubernetes.io/ingress.class: "gce"
  kubernetes.io/ingress.global-static-ip-name: "edot-visualizer-ip"
  networking.gke.io/managed-certificates: "edot-visualizer-cert"
```

Update domain in ManagedCertificate:

```yaml
spec:
  domains:
    - edot-visualizer.your-domain.com
```

Deploy:

```bash
kubectl apply -f k8s/ingress.yaml
```

### 5. Configure DNS

Point your domain to the static IP:

```bash
# Get the IP
gcloud compute addresses describe edot-visualizer-ip --global --format="value(address)"

# Add DNS A record
# edot-visualizer.your-domain.com -> IP_ADDRESS
```

### 6. Verify GKE Deployment

```bash
# Check ingress status
kubectl get ingress -n edot-visualizer

# Check managed certificate status
kubectl describe managedcertificate edot-visualizer-cert -n edot-visualizer

# Access the application
curl https://edot-visualizer.your-domain.com/api/health
```

---

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Node environment | `production` | Yes |
| `PORT` | Application port | `3000` | Yes |
| `NEXT_PUBLIC_APP_URL` | Public URL | `http://localhost:3000` | Yes |
| `NEXT_PUBLIC_DEMO_MODE` | Enable demo animations | `true` | No |
| `ELASTIC_APM_ENDPOINT` | Elastic APM endpoint | - | No |
| `ELASTIC_APM_SECRET_TOKEN` | APM authentication token | - | No |

### Resource Requirements

**Minimum (Development):**
- CPU: 0.1 cores
- Memory: 256 Mi

**Recommended (Production):**
- CPU: 0.5 cores (request) / 1 core (limit)
- Memory: 512 Mi (request) / 1 Gi (limit)

**High Traffic:**
- CPU: 1 core (request) / 2 cores (limit)
- Memory: 1 Gi (request) / 2 Gi (limit)

### Scaling Configuration

Edit `k8s/hpa.yaml`:

```yaml
spec:
  minReplicas: 2      # Minimum pods
  maxReplicas: 10     # Maximum pods
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          averageUtilization: 70  # Target CPU %
```

---

## Monitoring & Operations

### Health Checks

The application exposes a health endpoint:

```bash
# Check health
curl http://localhost:3000/api/health

# Example response
{
  "status": "healthy",
  "timestamp": "2024-12-24T12:00:00.000Z",
  "uptime": 3600,
  "service": "edot-flow-visualizer",
  "version": "0.1.0"
}
```

### Kubernetes Health Probes

The deployment includes:
- **Liveness Probe**: Restarts unhealthy pods
- **Readiness Probe**: Removes unready pods from service
- **Startup Probe**: Allows slow startup without false failures

### Viewing Logs

```bash
# Docker Compose
docker compose logs -f

# Kubernetes - all pods
kubectl logs -f -n edot-visualizer -l app=edot-flow-visualizer

# Kubernetes - specific pod
kubectl logs -f -n edot-visualizer <pod-name>

# Kubernetes - previous pod logs (after crash)
kubectl logs -n edot-visualizer <pod-name> --previous
```

### Monitoring Metrics

```bash
# Check HPA status
kubectl get hpa -n edot-visualizer

# Check pod resource usage
kubectl top pods -n edot-visualizer

# Check node resource usage
kubectl top nodes
```

### Scaling Operations

```bash
# Manual scaling
kubectl scale deployment edot-visualizer -n edot-visualizer --replicas=5

# Check autoscaler events
kubectl describe hpa edot-visualizer -n edot-visualizer
```

### Rolling Updates

```bash
# Update image
kubectl set image deployment/edot-visualizer \
  edot-visualizer=your-registry/edot-flow-visualizer:v2.0.0 \
  -n edot-visualizer

# Check rollout status
kubectl rollout status deployment/edot-visualizer -n edot-visualizer

# Rollback if needed
kubectl rollout undo deployment/edot-visualizer -n edot-visualizer
```

---

## Troubleshooting

### Docker Issues

**Problem: Container exits immediately**

```bash
# Check logs
docker logs edot-visualizer

# Common causes:
# - Missing environment variables
# - Port already in use
# - Build errors
```

**Problem: Cannot access on localhost:3000**

```bash
# Check if container is running
docker ps

# Check port mapping
docker port edot-visualizer

# Test from inside container
docker exec edot-visualizer curl http://localhost:3000/api/health
```

### Kubernetes Issues

**Problem: Pods not starting**

```bash
# Check pod status
kubectl get pods -n edot-visualizer

# Describe pod for events
kubectl describe pod <pod-name> -n edot-visualizer

# Common causes:
# - Image pull errors (check imagePullPolicy and registry access)
# - Resource limits too low
# - Missing ConfigMap or Secret
```

**Problem: Image pull errors**

```bash
# Check if image exists
kubectl describe pod <pod-name> -n edot-visualizer | grep Image

# For private registries, create image pull secret
kubectl create secret docker-registry regcred \
  --docker-server=<your-registry> \
  --docker-username=<username> \
  --docker-password=<password> \
  -n edot-visualizer

# Update deployment to use the secret
# Add to deployment.yaml:
# imagePullSecrets:
#   - name: regcred
```

**Problem: Service not accessible**

```bash
# Check service
kubectl get svc -n edot-visualizer

# Check endpoints
kubectl get endpoints -n edot-visualizer

# Test from within cluster
kubectl run test-pod --rm -it --image=busybox -n edot-visualizer -- sh
wget -O- http://edot-visualizer/api/health
```

**Problem: Ingress not working**

```bash
# Check ingress status
kubectl get ingress -n edot-visualizer
kubectl describe ingress edot-visualizer -n edot-visualizer

# Verify ingress controller is running
kubectl get pods -n ingress-nginx  # or your ingress namespace

# Check DNS resolution
nslookup edot-visualizer.your-domain.com

# For GKE, check managed certificate
kubectl describe managedcertificate -n edot-visualizer
```

**Problem: Pods crashing (CrashLoopBackOff)**

```bash
# Check pod logs
kubectl logs <pod-name> -n edot-visualizer --previous

# Check resource limits
kubectl describe pod <pod-name> -n edot-visualizer | grep -A 10 Resources

# Increase resources if OOMKilled
# Edit deployment.yaml and increase memory limits
```

### Performance Issues

**Problem: Slow response times**

```bash
# Check resource usage
kubectl top pods -n edot-visualizer

# Check HPA scaling
kubectl get hpa -n edot-visualizer

# Manually scale if needed
kubectl scale deployment edot-visualizer --replicas=5 -n edot-visualizer
```

---

## Security Best Practices

1. **Use non-root user**: Already configured in Dockerfile
2. **Enable network policies**: Apply `networkpolicy.yaml`
3. **Use secrets for sensitive data**: Store tokens in Kubernetes Secrets
4. **Scan images**: Use `docker scan` or container security tools
5. **Keep dependencies updated**: Regularly rebuild images with updated packages
6. **Use RBAC**: Limit pod service account permissions
7. **Enable TLS**: Always use HTTPS in production

---

## Backup & Disaster Recovery

### Configuration Backup

```bash
# Export all resources
kubectl get all -n edot-visualizer -o yaml > backup.yaml

# Export ConfigMaps and Secrets
kubectl get configmap,secret -n edot-visualizer -o yaml > config-backup.yaml
```

### Restore from Backup

```bash
# Restore namespace and resources
kubectl apply -f backup.yaml
kubectl apply -f config-backup.yaml
```

---

## Next Steps

1. **Set up monitoring**: Integrate with Prometheus/Grafana
2. **Configure alerting**: Set up alerts for pod failures, high resource usage
3. **Implement CI/CD**: Automate builds and deployments
4. **Add observability**: Integrate with Elastic APM or OpenTelemetry
5. **Performance testing**: Load test the application
6. **Documentation**: Create runbooks for common operations

---

## Support

For issues and questions:
- GitHub Issues: [Your repository issues page]
- Documentation: See `CLAUDE.md` and `README.md`
- EDOT Documentation: https://www.elastic.co/docs/reference/opentelemetry

---

**Last Updated**: January 2024
**Version**: 0.1.0
