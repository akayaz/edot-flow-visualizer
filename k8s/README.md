# Kubernetes Deployment - Quick Reference

## Prerequisites

- Kubernetes cluster (1.24+)
- kubectl configured
- Container image in accessible registry

## Files Overview

| File | Purpose | Required |
|------|---------|----------|
| `namespace.yaml` | Creates isolated namespace | Yes |
| `configmap.yaml` | Environment configuration | Yes |
| `secret.yaml` | Sensitive data (template) | Optional |
| `deployment.yaml` | Application deployment | Yes |
| `service.yaml` | Internal load balancer | Yes |
| `ingress.yaml` | External access | Optional |
| `hpa.yaml` | Auto-scaling | Optional |
| `pdb.yaml` | High availability | Optional |
| `networkpolicy.yaml` | Network security | Optional |
| `kustomization.yaml` | Kustomize config | Optional |

## Quick Deploy

### Standard Kubernetes

```bash
# 1. Update image in deployment.yaml
vi deployment.yaml  # Change line 64: image: your-registry/edot-flow-visualizer:latest

# 2. Update domain in ingress.yaml
vi ingress.yaml     # Change line 38: host: your-domain.com

# 3. Update ConfigMap
vi configmap.yaml   # Change NEXT_PUBLIC_APP_URL

# 4. Deploy everything
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f ingress.yaml
kubectl apply -f hpa.yaml
kubectl apply -f pdb.yaml

# 5. Check status
kubectl get all -n edot-visualizer
```

### Using Kustomize (Recommended)

```bash
# 1. Update image
cd k8s/
kustomize edit set image edot-flow-visualizer=your-registry/edot-flow-visualizer:v1.0.0

# 2. Preview changes
kubectl kustomize .

# 3. Deploy
kubectl apply -k .

# 4. Check status
kubectl get all -n edot-visualizer
```

## Configuration Checklist

Before deploying, update these values:

### deployment.yaml
- [ ] Line 64: Container image URL
- [ ] Line 65: imagePullPolicy (Always for production)
- [ ] Line 83-86: Resource limits (adjust for your workload)

### configmap.yaml
- [ ] Line 15: NEXT_PUBLIC_APP_URL (your public URL)
- [ ] Line 18: NEXT_PUBLIC_DEMO_MODE (true/false)

### ingress.yaml
- [ ] Line 38: Host domain
- [ ] Line 11: Ingress class (nginx, gce, etc.)
- [ ] Line 31-33: TLS configuration (uncomment and configure)

### service.yaml
- [ ] Line 12: Service type (ClusterIP, LoadBalancer, NodePort)

## GKE-Specific Setup

```bash
# 1. Push image to GCR
gcloud builds submit --tag gcr.io/PROJECT-ID/edot-flow-visualizer:latest .

# 2. Reserve static IP
gcloud compute addresses create edot-visualizer-ip --global
gcloud compute addresses describe edot-visualizer-ip --global

# 3. Update ingress.yaml - uncomment GKE section (lines 53-123)

# 4. Update domain in ManagedCertificate (line 113)

# 5. Deploy
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f ingress.yaml

# 6. Configure DNS A record pointing to static IP

# 7. Wait for certificate (takes 10-15 minutes)
kubectl describe managedcertificate edot-visualizer-cert -n edot-visualizer
```

## Common Operations

### View Logs
```bash
kubectl logs -f -n edot-visualizer -l app=edot-flow-visualizer
```

### Check Health
```bash
kubectl exec -n edot-visualizer deployment/edot-visualizer -- curl http://localhost:3000/api/health
```

### Scale Manually
```bash
kubectl scale deployment edot-visualizer -n edot-visualizer --replicas=5
```

### Update Image
```bash
kubectl set image deployment/edot-visualizer edot-visualizer=your-registry/edot-flow-visualizer:v2.0.0 -n edot-visualizer
kubectl rollout status deployment/edot-visualizer -n edot-visualizer
```

### Rollback
```bash
kubectl rollout undo deployment/edot-visualizer -n edot-visualizer
```

### Debug Pod
```bash
kubectl describe pod <pod-name> -n edot-visualizer
kubectl logs <pod-name> -n edot-visualizer --previous
```

### Port Forward (for testing)
```bash
kubectl port-forward -n edot-visualizer deployment/edot-visualizer 3000:3000
# Access at http://localhost:3000
```

## Monitoring

### Resource Usage
```bash
kubectl top pods -n edot-visualizer
kubectl top nodes
```

### HPA Status
```bash
kubectl get hpa -n edot-visualizer
kubectl describe hpa edot-visualizer -n edot-visualizer
```

### Events
```bash
kubectl get events -n edot-visualizer --sort-by='.lastTimestamp'
```

## Cleanup

```bash
# Delete everything
kubectl delete namespace edot-visualizer

# Or delete individual resources
kubectl delete -f .
```

## Security Setup (Optional)

### Create Secrets
```bash
kubectl create secret generic edot-visualizer-secrets \
  --namespace edot-visualizer \
  --from-literal=ELASTIC_APM_SECRET_TOKEN=your-token \
  --from-literal=ELASTIC_APM_ENDPOINT=https://your-endpoint.apm.cloud.es.io:443
```

### Enable Network Policy
```bash
# Requires CNI plugin with network policy support (Calico, Cilium, etc.)
kubectl apply -f networkpolicy.yaml
```

### Create Image Pull Secret
```bash
kubectl create secret docker-registry regcred \
  --docker-server=your-registry.io \
  --docker-username=your-username \
  --docker-password=your-password \
  --namespace=edot-visualizer

# Then add to deployment.yaml:
# imagePullSecrets:
#   - name: regcred
```

## Troubleshooting

**Pods not starting?**
```bash
kubectl describe pod <pod-name> -n edot-visualizer
kubectl logs <pod-name> -n edot-visualizer
```

**Ingress not working?**
```bash
kubectl get ingress -n edot-visualizer
kubectl describe ingress edot-visualizer -n edot-visualizer
```

**Service not accessible?**
```bash
kubectl get endpoints -n edot-visualizer
kubectl run test --rm -it --image=busybox -n edot-visualizer -- wget -O- http://edot-visualizer/api/health
```

**CrashLoopBackOff?**
```bash
kubectl logs <pod-name> -n edot-visualizer --previous
# Usually: insufficient resources, missing config, or app error
```

## Production Recommendations

- ✅ Use at least 2 replicas (already configured)
- ✅ Enable HPA for auto-scaling
- ✅ Configure PDB for high availability
- ✅ Use resource limits and requests
- ✅ Enable health probes (already configured)
- ✅ Use managed certificates (GKE) or cert-manager
- ✅ Enable network policies for security
- ✅ Set up monitoring and alerting
- ✅ Use private container registry
- ✅ Enable pod security policies

## Support

See [DEPLOYMENT.md](../DEPLOYMENT.md) for detailed documentation.
