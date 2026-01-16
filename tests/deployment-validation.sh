#!/bin/bash
# EDOT Flow Visualizer - Deployment Validation Test Suite
# Run as: bash tests/deployment-validation.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNINGS=0

# Log functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED_TESTS++))
    ((TOTAL_TESTS++))
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED_TESTS++))
    ((TOTAL_TESTS++))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((WARNINGS++))
}

log_section() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

# Test Docker configuration
test_docker_config() {
    log_section "TEST 1: Docker Configuration Validation"

    # Check Dockerfile exists
    if [ -f "Dockerfile" ]; then
        log_success "Dockerfile exists"
    else
        log_fail "Dockerfile not found"
        return
    fi

    # Check multi-stage build
    if grep -q "FROM.*AS deps" Dockerfile && grep -q "FROM.*AS builder" Dockerfile && grep -q "FROM.*AS runner" Dockerfile; then
        log_success "Multi-stage build configured correctly"
    else
        log_fail "Multi-stage build not properly configured"
    fi

    # Check non-root user
    if grep -q "USER nextjs" Dockerfile; then
        log_success "Non-root user configured"
    else
        log_fail "Running as root (security risk)"
    fi

    # Check healthcheck
    if grep -q "HEALTHCHECK" Dockerfile; then
        log_success "Health check configured in Dockerfile"
    else
        log_warning "No health check in Dockerfile"
    fi

    # Check .dockerignore
    if [ -f ".dockerignore" ]; then
        log_success ".dockerignore exists"
        if grep -q "node_modules" .dockerignore; then
            log_success "node_modules excluded from build context"
        else
            log_warning "node_modules not excluded (slower builds)"
        fi
    else
        log_warning ".dockerignore not found (larger build context)"
    fi

    # Check docker-compose.yml
    if [ -f "docker-compose.yml" ]; then
        log_success "docker-compose.yml exists"
    else
        log_fail "docker-compose.yml not found"
    fi
}

# Test Next.js configuration
test_nextjs_config() {
    log_section "TEST 2: Next.js Configuration Validation"

    if [ -f "next.config.js" ]; then
        log_success "next.config.js exists"

        # Check standalone output
        if grep -q "output.*standalone" next.config.js; then
            log_success "Standalone output enabled for Docker"
        else
            log_fail "Standalone output not enabled (Docker build will fail)"
        fi
    else
        log_fail "next.config.js not found"
    fi
}

# Test Kubernetes manifests syntax
test_k8s_manifests() {
    log_section "TEST 3: Kubernetes Manifests Validation"

    local manifests=(
        "k8s/namespace.yaml"
        "k8s/configmap.yaml"
        "k8s/deployment.yaml"
        "k8s/service.yaml"
        "k8s/ingress.yaml"
        "k8s/hpa.yaml"
        "k8s/pdb.yaml"
    )

    for manifest in "${manifests[@]}"; do
        if [ -f "$manifest" ]; then
            log_success "$(basename $manifest) exists"

            # Validate YAML syntax with kubectl (if available)
            if command -v kubectl &> /dev/null; then
                if kubectl apply --dry-run=client -f "$manifest" &> /dev/null; then
                    log_success "$(basename $manifest) has valid syntax"
                else
                    log_fail "$(basename $manifest) has invalid syntax"
                fi
            fi
        else
            log_fail "$manifest not found"
        fi
    done
}

# Test Kubernetes deployment configuration
test_k8s_deployment_config() {
    log_section "TEST 4: Kubernetes Deployment Configuration"

    if [ ! -f "k8s/deployment.yaml" ]; then
        log_fail "deployment.yaml not found"
        return
    fi

    # Check replicas
    local replicas=$(grep -A1 "replicas:" k8s/deployment.yaml | grep -v "maxReplicas\|minReplicas" | head -1 | awk '{print $2}')
    if [ "$replicas" -ge 2 ]; then
        log_success "High availability: $replicas replicas configured"
    else
        log_warning "Only $replicas replica(s) - not highly available"
    fi

    # Check resource limits
    if grep -q "resources:" k8s/deployment.yaml; then
        log_success "Resource limits configured"
        if grep -q "limits:" k8s/deployment.yaml && grep -q "requests:" k8s/deployment.yaml; then
            log_success "Both limits and requests defined"
        else
            log_warning "Missing either limits or requests"
        fi
    else
        log_fail "No resource limits (can cause resource exhaustion)"
    fi

    # Check security context
    if grep -q "securityContext:" k8s/deployment.yaml; then
        log_success "Security context configured"
        if grep -q "runAsNonRoot: true" k8s/deployment.yaml; then
            log_success "Running as non-root user"
        else
            log_fail "Not running as non-root (security risk)"
        fi
        if grep -q "allowPrivilegeEscalation: false" k8s/deployment.yaml; then
            log_success "Privilege escalation disabled"
        else
            log_warning "Privilege escalation not disabled"
        fi
    else
        log_fail "No security context defined (security risk)"
    fi

    # Check health probes
    if grep -q "livenessProbe:" k8s/deployment.yaml; then
        log_success "Liveness probe configured"
    else
        log_fail "No liveness probe (won't auto-restart on failure)"
    fi

    if grep -q "readinessProbe:" k8s/deployment.yaml; then
        log_success "Readiness probe configured"
    else
        log_fail "No readiness probe (may send traffic to unready pods)"
    fi

    if grep -q "startupProbe:" k8s/deployment.yaml; then
        log_success "Startup probe configured"
    else
        log_warning "No startup probe (may fail on slow startup)"
    fi

    # Check image pull policy
    if grep -q "imagePullPolicy:" k8s/deployment.yaml; then
        local policy=$(grep "imagePullPolicy:" k8s/deployment.yaml | awk '{print $2}')
        if [ "$policy" == "Always" ] || [ "$policy" == "IfNotPresent" ]; then
            log_success "Image pull policy: $policy"
        else
            log_warning "Unusual image pull policy: $policy"
        fi
    fi

    # Check rolling update strategy
    if grep -q "rollingUpdate:" k8s/deployment.yaml; then
        log_success "Rolling update strategy configured"
        if grep -q "maxUnavailable: 0" k8s/deployment.yaml; then
            log_success "Zero-downtime deployment configured"
        else
            log_warning "Zero-downtime not guaranteed"
        fi
    fi
}

# Test Service configuration
test_k8s_service_config() {
    log_section "TEST 5: Kubernetes Service Configuration"

    if [ ! -f "k8s/service.yaml" ]; then
        log_fail "service.yaml not found"
        return
    fi

    # Check service type
    local service_type=$(grep "type:" k8s/service.yaml | head -1 | awk '{print $2}')
    log_info "Service type: $service_type"

    # Check session affinity for SSE
    if grep -q "sessionAffinity: ClientIP" k8s/service.yaml; then
        log_success "Session affinity configured for SSE connections"
    else
        log_warning "No session affinity (SSE connections may break)"
    fi

    # Check port configuration
    if grep -q "port: 80" k8s/service.yaml; then
        log_success "Standard HTTP port configured"
    fi
}

# Test HPA configuration
test_k8s_hpa_config() {
    log_section "TEST 6: HPA (Auto-scaling) Configuration"

    if [ ! -f "k8s/hpa.yaml" ]; then
        log_warning "hpa.yaml not found - auto-scaling not configured"
        return
    fi

    # Check min/max replicas
    local min_replicas=$(grep "minReplicas:" k8s/hpa.yaml | awk '{print $2}')
    local max_replicas=$(grep "maxReplicas:" k8s/hpa.yaml | awk '{print $2}')

    if [ "$min_replicas" -ge 2 ]; then
        log_success "Minimum replicas: $min_replicas (HA enabled)"
    else
        log_warning "Minimum replicas: $min_replicas (not HA)"
    fi

    if [ "$max_replicas" -gt "$min_replicas" ]; then
        log_success "Auto-scaling range: $min_replicas-$max_replicas replicas"
    else
        log_fail "Invalid auto-scaling range"
    fi

    # Check metrics
    if grep -q "type: Resource" k8s/hpa.yaml; then
        log_success "Resource-based scaling configured"
    else
        log_warning "No resource metrics for scaling"
    fi
}

# Test Ingress configuration
test_k8s_ingress_config() {
    log_section "TEST 7: Ingress Configuration"

    if [ ! -f "k8s/ingress.yaml" ]; then
        log_warning "ingress.yaml not found - external access not configured"
        return
    fi

    # Check ingress class
    if grep -q "ingressClassName:" k8s/ingress.yaml; then
        log_success "Ingress class specified"
    else
        log_warning "No ingress class specified"
    fi

    # Check TLS configuration
    if grep -q "tls:" k8s/ingress.yaml; then
        log_success "TLS configuration present"
    else
        log_warning "No TLS configuration (HTTP only)"
    fi

    # Check host configuration
    if grep -q "host:" k8s/ingress.yaml; then
        local host=$(grep "host:" k8s/ingress.yaml | head -1 | awk '{print $2}')
        if [ "$host" == "edot-visualizer.example.com" ]; then
            log_warning "Using example domain - needs update for production"
        else
            log_success "Custom host configured: $host"
        fi
    fi
}

# Test PDB configuration
test_k8s_pdb_config() {
    log_section "TEST 8: Pod Disruption Budget Configuration"

    if [ ! -f "k8s/pdb.yaml" ]; then
        log_warning "pdb.yaml not found - no disruption protection"
        return
    fi

    if grep -q "minAvailable:" k8s/pdb.yaml; then
        local min_available=$(grep "minAvailable:" k8s/pdb.yaml | awk '{print $2}')
        log_success "PDB configured: minimum $min_available pod(s) available"
    elif grep -q "maxUnavailable:" k8s/pdb.yaml; then
        local max_unavailable=$(grep "maxUnavailable:" k8s/pdb.yaml | awk '{print $2}')
        log_success "PDB configured: maximum $max_unavailable pod(s) unavailable"
    else
        log_fail "Invalid PDB configuration"
    fi
}

# Test documentation
test_documentation() {
    log_section "TEST 9: Documentation Validation"

    local docs=(
        "README.md"
        "DEPLOYMENT.md"
        "DOCKER-QUICKSTART.md"
        "k8s/README.md"
    )

    for doc in "${docs[@]}"; do
        if [ -f "$doc" ]; then
            log_success "$doc exists"
            local lines=$(wc -l < "$doc")
            log_info "  └─ $lines lines"
        else
            log_fail "$doc not found"
        fi
    done

    # Check Makefile
    if [ -f "Makefile" ]; then
        log_success "Makefile exists"
        local targets=$(grep "^[a-zA-Z_-]*:.*##" Makefile | wc -l)
        log_success "  └─ $targets documented targets"
    else
        log_warning "Makefile not found"
    fi
}

# Test health endpoint
test_health_endpoint() {
    log_section "TEST 10: Health Endpoint Validation"

    if [ -f "app/api/health/route.ts" ]; then
        log_success "Health endpoint exists"

        # Check if it returns proper JSON
        if grep -q "NextResponse.json" app/api/health/route.ts; then
            log_success "Returns JSON response"
        else
            log_fail "Does not return JSON"
        fi

        # Check if it includes required fields
        if grep -q "status.*timestamp.*uptime" app/api/health/route.ts; then
            log_success "Includes required health check fields"
        else
            log_warning "Missing some health check fields"
        fi
    else
        log_fail "Health endpoint not implemented"
    fi
}

# Test Kustomize configuration
test_kustomize_config() {
    log_section "TEST 11: Kustomize Configuration"

    if [ -f "k8s/kustomization.yaml" ]; then
        log_success "kustomization.yaml exists"

        # Validate with kustomize if available
        if command -v kustomize &> /dev/null; then
            if kustomize build k8s/ &> /dev/null; then
                log_success "Kustomize build successful"
            else
                log_fail "Kustomize build failed"
            fi
        elif command -v kubectl &> /dev/null; then
            if kubectl kustomize k8s/ &> /dev/null; then
                log_success "Kustomize build successful (via kubectl)"
            else
                log_fail "Kustomize build failed"
            fi
        fi
    else
        log_warning "kustomization.yaml not found"
    fi
}

# Test CI/CD workflows
test_cicd_workflows() {
    log_section "TEST 12: CI/CD Workflows Validation"

    if [ -f ".github/workflows/docker-build.yml" ]; then
        log_success "Docker build workflow exists"
    else
        log_warning "Docker build workflow not found"
    fi

    if [ -f ".github/workflows/k8s-deploy.yml" ]; then
        log_success "Kubernetes deploy workflow exists"
    else
        log_warning "Kubernetes deploy workflow not found"
    fi
}

# Generate test report
generate_report() {
    log_section "TEST SUMMARY"

    echo ""
    echo -e "${BLUE}Total Tests:${NC}    $TOTAL_TESTS"
    echo -e "${GREEN}Passed:${NC}         $PASSED_TESTS"
    echo -e "${RED}Failed:${NC}         $FAILED_TESTS"
    echo -e "${YELLOW}Warnings:${NC}       $WARNINGS"
    echo ""

    local pass_rate=0
    if [ $TOTAL_TESTS -gt 0 ]; then
        pass_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    fi

    echo -e "${BLUE}Pass Rate:${NC}      $pass_rate%"
    echo ""

    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}✓ All critical tests passed!${NC}"
        if [ $WARNINGS -gt 0 ]; then
            echo -e "${YELLOW}⚠ There are $WARNINGS warning(s) to review${NC}"
        fi
        return 0
    else
        echo -e "${RED}✗ $FAILED_TESTS test(s) failed${NC}"
        echo -e "${RED}Please fix the issues before deploying to production${NC}"
        return 1
    fi
}

# Main execution
main() {
    echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  EDOT Flow Visualizer - Deployment Tests      ║${NC}"
    echo -e "${BLUE}║  QA Validation Suite v1.0                      ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
    echo ""

    test_docker_config
    test_nextjs_config
    test_k8s_manifests
    test_k8s_deployment_config
    test_k8s_service_config
    test_k8s_hpa_config
    test_k8s_ingress_config
    test_k8s_pdb_config
    test_documentation
    test_health_endpoint
    test_kustomize_config
    test_cicd_workflows

    echo ""
    generate_report
}

# Run tests
main
exit $?
