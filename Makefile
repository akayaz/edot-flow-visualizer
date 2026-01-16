# Makefile for EDOT Flow Visualizer
# Simplifies Docker and Kubernetes operations

.PHONY: help build run stop clean docker-build docker-run docker-stop docker-clean k8s-deploy k8s-delete k8s-status k8s-logs

# Variables
IMAGE_NAME := edot-flow-visualizer
IMAGE_TAG := latest
REGISTRY ?= # Set your registry here (e.g., gcr.io/project-id)
FULL_IMAGE := $(if $(REGISTRY),$(REGISTRY)/,)$(IMAGE_NAME):$(IMAGE_TAG)
NAMESPACE := edot-visualizer

# Colors for output
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

##@ Help

help: ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\n$(GREEN)Usage:$(NC)\n  make $(YELLOW)<target>$(NC)\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2 } /^##@/ { printf "\n$(GREEN)%s$(NC)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Development

dev: ## Run development server (npm)
	npm run dev

build-dev: ## Build for development
	npm run build

typecheck: ## Run TypeScript type checking
	npm run typecheck

lint: ## Run linter
	npm run lint

##@ Docker

docker-build: ## Build Docker image
	@echo "$(GREEN)Building Docker image: $(FULL_IMAGE)$(NC)"
	docker build -t $(FULL_IMAGE) .

docker-run: ## Run Docker container
	@echo "$(GREEN)Starting Docker container$(NC)"
	docker run -d \
		--name $(IMAGE_NAME) \
		-p 3000:3000 \
		-e NEXT_PUBLIC_APP_URL=http://localhost:3000 \
		$(FULL_IMAGE)
	@echo "$(GREEN)Application running at http://localhost:3000$(NC)"

docker-stop: ## Stop Docker container
	@echo "$(YELLOW)Stopping Docker container$(NC)"
	docker stop $(IMAGE_NAME) || true
	docker rm $(IMAGE_NAME) || true

docker-logs: ## View Docker container logs
	docker logs -f $(IMAGE_NAME)

docker-shell: ## Open shell in Docker container
	docker exec -it $(IMAGE_NAME) sh

docker-clean: docker-stop ## Remove Docker image
	@echo "$(RED)Removing Docker image$(NC)"
	docker rmi $(FULL_IMAGE) || true

##@ Docker Compose

compose-up: ## Start with Docker Compose
	@echo "$(GREEN)Starting with Docker Compose$(NC)"
	docker compose up -d
	@echo "$(GREEN)Application running at http://localhost:3000$(NC)"

compose-down: ## Stop Docker Compose
	@echo "$(YELLOW)Stopping Docker Compose$(NC)"
	docker compose down

compose-logs: ## View Docker Compose logs
	docker compose logs -f

compose-rebuild: ## Rebuild and restart with Docker Compose
	@echo "$(GREEN)Rebuilding and restarting$(NC)"
	docker compose up -d --build

compose-clean: compose-down ## Clean Docker Compose (including volumes)
	docker compose down -v

##@ Container Registry

push: docker-build ## Build and push to registry
	@if [ -z "$(REGISTRY)" ]; then \
		echo "$(RED)Error: REGISTRY not set. Use: make push REGISTRY=your-registry$(NC)"; \
		exit 1; \
	fi
	@echo "$(GREEN)Pushing to registry: $(FULL_IMAGE)$(NC)"
	docker push $(FULL_IMAGE)

pull: ## Pull image from registry
	@if [ -z "$(REGISTRY)" ]; then \
		echo "$(RED)Error: REGISTRY not set$(NC)"; \
		exit 1; \
	fi
	@echo "$(GREEN)Pulling from registry: $(FULL_IMAGE)$(NC)"
	docker pull $(FULL_IMAGE)

##@ Kubernetes

k8s-deploy: ## Deploy to Kubernetes
	@echo "$(GREEN)Deploying to Kubernetes$(NC)"
	kubectl apply -f k8s/namespace.yaml
	kubectl apply -f k8s/configmap.yaml
	kubectl apply -f k8s/deployment.yaml
	kubectl apply -f k8s/service.yaml
	kubectl apply -f k8s/ingress.yaml
	kubectl apply -f k8s/hpa.yaml
	kubectl apply -f k8s/pdb.yaml
	@echo "$(GREEN)Deployment complete!$(NC)"
	@make k8s-status

k8s-deploy-all: ## Deploy all Kubernetes resources (including network policy)
	@echo "$(GREEN)Deploying all Kubernetes resources$(NC)"
	kubectl apply -f k8s/
	@make k8s-status

k8s-delete: ## Delete Kubernetes deployment
	@echo "$(RED)Deleting Kubernetes resources$(NC)"
	kubectl delete namespace $(NAMESPACE) || true

k8s-status: ## Check Kubernetes deployment status
	@echo "$(GREEN)Kubernetes Status:$(NC)"
	kubectl get all -n $(NAMESPACE)

k8s-pods: ## List pods
	kubectl get pods -n $(NAMESPACE)

k8s-logs: ## View pod logs
	kubectl logs -f -n $(NAMESPACE) -l app=edot-flow-visualizer

k8s-describe: ## Describe deployment
	kubectl describe deployment edot-visualizer -n $(NAMESPACE)

k8s-events: ## Show recent events
	kubectl get events -n $(NAMESPACE) --sort-by='.lastTimestamp'

k8s-shell: ## Open shell in pod
	kubectl exec -it -n $(NAMESPACE) deployment/edot-visualizer -- sh

k8s-port-forward: ## Port forward to pod
	@echo "$(GREEN)Port forwarding to http://localhost:3000$(NC)"
	kubectl port-forward -n $(NAMESPACE) deployment/edot-visualizer 3000:3000

k8s-scale: ## Scale deployment (use: make k8s-scale REPLICAS=3)
	kubectl scale deployment edot-visualizer -n $(NAMESPACE) --replicas=$(or $(REPLICAS),2)

k8s-restart: ## Restart deployment
	kubectl rollout restart deployment/edot-visualizer -n $(NAMESPACE)

k8s-update-image: ## Update deployment image (use: make k8s-update-image IMAGE=registry/image:tag)
	@if [ -z "$(IMAGE)" ]; then \
		echo "$(RED)Error: IMAGE not set. Use: make k8s-update-image IMAGE=your-image:tag$(NC)"; \
		exit 1; \
	fi
	kubectl set image deployment/edot-visualizer edot-visualizer=$(IMAGE) -n $(NAMESPACE)
	kubectl rollout status deployment/edot-visualizer -n $(NAMESPACE)

k8s-rollback: ## Rollback deployment
	kubectl rollout undo deployment/edot-visualizer -n $(NAMESPACE)

##@ Kustomize

kustomize-preview: ## Preview Kustomize output
	kubectl kustomize k8s/

kustomize-deploy: ## Deploy with Kustomize
	@echo "$(GREEN)Deploying with Kustomize$(NC)"
	kubectl apply -k k8s/
	@make k8s-status

kustomize-set-image: ## Set image with Kustomize
	@if [ -z "$(IMAGE)" ]; then \
		echo "$(RED)Error: IMAGE not set$(NC)"; \
		exit 1; \
	fi
	cd k8s && kustomize edit set image edot-flow-visualizer=$(IMAGE)

##@ GKE

gke-create-cluster: ## Create GKE cluster
	gcloud container clusters create edot-visualizer-cluster \
		--zone us-central1-a \
		--num-nodes 3 \
		--machine-type e2-standard-2 \
		--enable-autoscaling \
		--min-nodes 2 \
		--max-nodes 10

gke-get-credentials: ## Get GKE credentials
	gcloud container clusters get-credentials edot-visualizer-cluster --zone us-central1-a

gke-reserve-ip: ## Reserve static IP for GKE
	gcloud compute addresses create edot-visualizer-ip --global
	@echo "$(GREEN)Static IP created:$(NC)"
	gcloud compute addresses describe edot-visualizer-ip --global

gke-build-push: ## Build and push to GCR
	@if [ -z "$(PROJECT_ID)" ]; then \
		echo "$(RED)Error: PROJECT_ID not set. Use: make gke-build-push PROJECT_ID=your-project$(NC)"; \
		exit 1; \
	fi
	gcloud builds submit --tag gcr.io/$(PROJECT_ID)/$(IMAGE_NAME):$(IMAGE_TAG) .

##@ Monitoring

health-check: ## Check application health
	@curl -s http://localhost:3000/api/health | jq . || echo "$(RED)Health check failed$(NC)"

k8s-top-pods: ## Show pod resource usage
	kubectl top pods -n $(NAMESPACE)

k8s-top-nodes: ## Show node resource usage
	kubectl top nodes

k8s-hpa-status: ## Show HPA status
	kubectl get hpa -n $(NAMESPACE)
	kubectl describe hpa edot-visualizer -n $(NAMESPACE)

##@ Cleanup

clean-all: docker-clean compose-clean k8s-delete ## Clean everything
	@echo "$(GREEN)Cleanup complete$(NC)"

##@ Testing

test-docker: docker-build docker-run ## Test Docker setup
	@echo "$(YELLOW)Waiting for container to start...$(NC)"
	@sleep 5
	@echo "$(GREEN)Testing health endpoint...$(NC)"
	@curl -s http://localhost:3000/api/health || echo "$(RED)Health check failed$(NC)"
	@make docker-stop

test-k8s: k8s-deploy ## Test Kubernetes deployment
	@echo "$(YELLOW)Waiting for deployment to be ready...$(NC)"
	kubectl wait --for=condition=available --timeout=300s deployment/edot-visualizer -n $(NAMESPACE)
	@echo "$(GREEN)Testing health endpoint via port-forward...$(NC)"
	kubectl port-forward -n $(NAMESPACE) deployment/edot-visualizer 3000:3000 &
	@sleep 3
	@curl -s http://localhost:3000/api/health || echo "$(RED)Health check failed$(NC)"
	@pkill -f "kubectl port-forward"

##@ Default

.DEFAULT_GOAL := help
