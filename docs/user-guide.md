# User Guide - EDOT Flow Visualizer

Welcome to the EDOT Flow Visualizer user guide! This comprehensive tutorial will help you get the most out of the tool, whether you're learning OpenTelemetry basics or designing production architectures.

## Table of Contents

- [Getting Started](#getting-started)
- [Understanding the Interface](#understanding-the-interface)
- [Tutorial 1: Exploring Preset Scenarios](#tutorial-1-exploring-preset-scenarios)
- [Tutorial 2: Building Your First Topology](#tutorial-2-building-your-first-topology)
- [Tutorial 3: Configuring Collectors](#tutorial-3-configuring-collectors)
- [Tutorial 4: Using Demo Mode](#tutorial-4-using-demo-mode)
- [Tutorial 5: Exporting Configurations](#tutorial-5-exporting-configurations)
- [Tutorial 6: Infrastructure Context](#tutorial-6-infrastructure-context)
- [Advanced Features](#advanced-features)
- [Tips and Tricks](#tips-and-tricks)
- [Common Patterns](#common-patterns)
- [FAQ](#faq)

---

## Getting Started

### Accessing the Visualizer

1. **Start the application**:
   ```bash
   npm run dev
   ```

2. **Open your browser** to [http://localhost:3000](http://localhost:3000)

3. **Navigate to the visualizer** by clicking "Try It Now" or going to `/otel-flow`

You should see the main canvas with several panels around it.

### First Impressions

When you first load the visualizer, you'll see:
- **Canvas (center)**: The main workspace where you build topologies
- **Component Palette (left)**: Drag-and-drop components
- **Control Panel (top-right)**: Scenario selector, demo mode, zoom controls
- **Config Export (bottom-right)**: Export configurations
- **Validation Panel (may appear)**: Real-time feedback on your topology

---

## Understanding the Interface

### The Canvas

The canvas is your workspace for building EDOT architectures. You can:
- **Pan**: Click and drag on empty space
- **Zoom**: Use mouse wheel or zoom controls
- **Select**: Click on nodes or edges
- **Connect**: Drag from output handle (right) to input handle (left)

### Component Palette

The palette organizes components into categories:

#### 📱 SDK Components
Language-specific SDKs for instrumenting applications:
- Node.js, Python, Java, .NET, Go, PHP, Ruby
- Android, iOS for mobile apps

#### 🔧 Collector Components
EDOT Collectors in different modes:
- **Agent Mode**: Per-host deployment with infrastructure metrics
- **Gateway Mode**: Centralized deployment with sampling and transformation

#### 🏗️ Infrastructure Components
Deployment context:
- **Host**: Physical or virtual machines
- **Docker**: Container runtime
- **Kubernetes**: Namespace, DaemonSet, Deployment

#### 📊 Elastic Components
Destination for telemetry:
- **Elastic Observability**: APM, Logs, Metrics, Traces

### Control Panel

Located at the top-right, provides:
- **Scenario Selector**: Load preset architectures
- **Demo Mode Toggle**: Enable animated telemetry flow
- **Zoom Controls**: Fit view, zoom in/out
- **Reset Button**: Clear canvas

### Node Configuration Panel

Click any node to see its configuration:
- **SDK Nodes**: Language, service name, auto-instrumentation
- **Collector Nodes**: Receivers, processors, exporters
- **Elastic Nodes**: Features (APM, logs, metrics)
- **Infrastructure Nodes**: Deployment details

### Validation Panel

Appears when there are issues or suggestions:
- **❌ Errors**: Critical issues that must be fixed
- **⚠️ Warnings**: Potential problems
- **💡 Suggestions**: Best practice recommendations

---

## Tutorial 1: Exploring Preset Scenarios

Let's start by exploring the built-in scenarios to understand EDOT patterns.

### Step 1: Load the Simple Scenario

1. **Click the scenario selector** (top-right)
2. **Select "Simple"**
3. **Observe the topology**:
   - One SDK node (My Application)
   - One Elastic node (Elastic Observability)
   - Direct connection between them

**What you're seeing**: This is the simplest EDOT setup - SDK sends telemetry directly to Elastic via OTLP.

**When to use**:
- Learning and experimentation
- Small applications with low volume
- Development environments

### Step 2: Load the Agent Scenario

1. **Select "Agent" from scenario selector**
2. **Notice the new component**: EDOT Collector (Agent mode)
3. **Observe the flow**: SDK → Collector → Elastic

**What's different**:
- Collector sits between SDK and Elastic
- Collector includes `hostmetrics` receiver for infrastructure data
- Collector has `batch` and `memory_limiter` processors

**When to use**:
- Production applications on VMs or bare metal
- Need host-level metrics (CPU, memory, disk)
- Want to buffer telemetry during outages

### Step 3: Load the Gateway Scenario

1. **Select "Gateway"**
2. **Notice**:
   - Multiple SDK nodes (Frontend, API, Worker)
   - Single Gateway collector
   - All SDKs route through gateway

**What's different**:
- Gateway has `tail_sampling` processor
- Gateway has `transform` processor
- Centralized point for data processing

**When to use**:
- Multiple services
- Need intelligent sampling
- Want to reduce data volume
- Centralized transformation

### Step 4: Load the Production Scenario

1. **Select "Production"**
2. **Observe the complexity**:
   - Multiple services
   - Multiple agents (one per service)
   - Multiple gateways (load balanced)
   - Full HA setup

**When to use**: Production at scale (10+ services)

### Step 5: Explore Docker and Kubernetes Scenarios

Load each and observe:
- **Docker**: Collectors in containers with network isolation
- **Kubernetes**: DaemonSets (agents) and Deployments (gateways)

---

## Tutorial 2: Building Your First Topology

Let's build a simple Agent pattern from scratch.

### Step 1: Clear the Canvas

1. **Click the Reset button** (or select "Empty" scenario)
2. **Confirm** when prompted

You now have a blank canvas.

### Step 2: Add an SDK Node

1. **Locate the SDK section** in Component Palette
2. **Drag "Node.js SDK"** onto the canvas
3. **Drop it** on the left side (around x: 100, y: 200)

You should see a green-bordered node with the Node.js icon.

### Step 3: Add a Collector Node

1. **Locate the Collector section** in Component Palette
2. **Drag "Collector Agent"** onto canvas
3. **Drop it** in the middle (around x: 400, y: 200)

You should see a cyan-bordered node labeled "EDOT Collector".

### Step 4: Add an Elastic Node

1. **Locate the Elastic section**
2. **Drag "Elastic Observability"** onto canvas
3. **Drop it** on the right (around x: 700, y: 200)

You should see a node with Elastic's teal gradient.

### Step 5: Connect the Nodes

1. **Hover over the SDK node**
2. **Locate the output handle** (small circle on right side)
3. **Click and drag** from SDK output to Collector input (left side)
4. **Release** to create connection

Repeat to connect Collector → Elastic.

**Result**: You should see two edges connecting your nodes.

### Step 6: Verify Your Topology

Check the Validation Panel:
- Should show ✅ or minimal warnings
- If you see errors, ensure all connections are made

**Congratulations!** You've built your first EDOT topology.

---

## Tutorial 3: Configuring Collectors

Collectors are the heart of EDOT architecture. Let's customize one.

### Step 1: Select the Collector

1. **Click on the Collector node** you created
2. **Node Config Panel opens** on the right

### Step 2: Review Current Configuration

The panel shows three sections:
- **📥 Receivers**: What inputs the collector accepts
- **⚙️ Processors**: How data is transformed
- **📤 Exporters**: Where data is sent

**Default Agent Config**:
- Receivers: OTLP, Host Metrics
- Processors: Memory Limiter, Batch
- Exporters: Elasticsearch

### Step 3: Add a Receiver

1. **Scroll to Receivers section**
2. **Toggle on "File Log"** receiver
3. **Observe**: YAML preview updates in real-time

**What happened**: Your collector now reads log files in addition to OTLP.

### Step 4: Add a Processor

1. **Scroll to Processors section**
2. **Toggle on "Transform"** processor
3. **Notice**: It appears in the processor list

**Important**: Processor order matters!
- `memory_limiter` should always be first
- `batch` should typically be last
- The visualizer enforces best practices

### Step 5: Review YAML Output

1. **Scroll down** to see the YAML preview
2. **Observe** the full configuration:

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318
  hostmetrics:
    collection_interval: 10s
    scrapers:
      - cpu
      - memory
      - disk
      - network
  filelog:
    include:
      - /var/log/*.log

processors:
  memory_limiter:
    check_interval: 1s
    limit_mib: 512
  transform:
    # Add your transform rules here
  batch:
    timeout: 10s
    send_batch_size: 1024

exporters:
  elasticsearch:
    endpoints: ["${ELASTIC_ENDPOINT}"]
    api_key: "${ELASTIC_API_KEY}"

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, transform, batch]
      exporters: [elasticsearch]
    metrics:
      receivers: [otlp, hostmetrics]
      processors: [memory_limiter, transform, batch]
      exporters: [elasticsearch]
    logs:
      receivers: [otlp, filelog]
      processors: [memory_limiter, transform, batch]
      exporters: [elasticsearch]
```

### Step 6: Understand the Validation

The Validation Panel may show:
- **💡 Suggestion**: "Consider adding resource detection for cloud metadata"
- **✅ Info**: "Configuration follows EDOT best practices"

---

## Tutorial 4: Using Demo Mode

Demo Mode shows animated telemetry flow through your topology.

### Step 1: Load a Scenario

1. **Select "Agent" scenario** (or use the topology you built)
2. **Ensure all nodes are connected**

### Step 2: Enable Demo Mode

1. **Click the ⚡ Demo Mode button** in Control Panel
2. **Watch the canvas**:
   - Colored particles appear on edges
   - Particles animate from source to target
   - Colors represent telemetry types:
     - 🟠 Amber = Traces
     - 🔵 Blue = Metrics
     - 🟢 Green = Logs

### Step 3: Observe the Telemetry Stats Panel

A new panel appears showing:
- **Traces/sec**: Real-time trace throughput
- **Metrics/sec**: Real-time metric throughput
- **Logs/sec**: Real-time log throughput
- **Per-component stats**: Each node's throughput

### Step 4: Understand Particle Behavior

- **Particle count**: Reflects throughput volume
- **Particle speed**: Consistent for visual clarity
- **Particle types**: Different telemetry types flow simultaneously

### Step 5: Experiment

Try:
- Adding more SDK nodes (more particles)
- Changing scenario (different flow patterns)
- Watching how data flows through gateways

### Step 6: Disable Demo Mode

Click ⚡ button again to pause telemetry generation.

---

## Tutorial 5: Exporting Configurations

Export production-ready configs from your visual design.

### Step 1: Build or Load a Topology

Ensure you have:
- At least one Collector node
- Valid connections

### Step 2: Open Config Export Panel

1. **Click "Export Config"** button (bottom-right)
2. **Config Export Panel opens**

### Step 3: Choose Export Format

You have three options:

#### Option 1: YAML Config

1. **Select "Collector YAML" tab**
2. **Review** the generated configuration
3. **Click "Download YAML"** or **"Copy to Clipboard"**

**Use case**: Deploy collector to any environment

#### Option 2: Docker Compose

1. **Select "Docker Compose" tab**
2. **Review** the `docker-compose.yml`
3. **Download** or copy

**What you get**:
```yaml
version: '3.8'
services:
  collector-agent:
    image: docker.elastic.co/beats/elastic-agent:8.x.x
    volumes:
      - ./otel-config.yaml:/etc/otel/config.yaml
    environment:
      - ELASTIC_ENDPOINT=${ELASTIC_ENDPOINT}
      - ELASTIC_API_KEY=${ELASTIC_API_KEY}
    ports:
      - "4317:4317"  # OTLP gRPC
      - "4318:4318"  # OTLP HTTP
```

**Use case**: Quick local deployment with Docker

#### Option 3: Kubernetes Manifests

1. **Select "Kubernetes" tab**
2. **Review** the manifests:
   - DaemonSet (for agents)
   - Deployment (for gateways)
   - ConfigMap (collector config)
   - Service (network exposure)
   - RBAC (permissions)
3. **Download** all manifests as ZIP

**Use case**: Production Kubernetes deployment

### Step 4: Use the Exported Config

#### For YAML:
```bash
# Save to file
# Edit environment variables
# Deploy with otelcol
otelcol --config=otel-config.yaml
```

#### For Docker Compose:
```bash
# Save docker-compose.yml
# Create .env file with ELASTIC_ENDPOINT and ELASTIC_API_KEY
# Deploy
docker-compose up -d
```

#### For Kubernetes:
```bash
# Extract manifests
# Create secret with Elastic credentials
kubectl create secret generic elastic-secret \
  --from-literal=endpoint=$ELASTIC_ENDPOINT \
  --from-literal=api-key=$ELASTIC_API_KEY

# Apply manifests
kubectl apply -f collector-daemonset.yaml
kubectl apply -f collector-deployment.yaml
```

---

## Tutorial 6: Infrastructure Context

Show where EDOT components run.

### Step 1: Add a Host Node

1. **Drag "Host" from Infrastructure section**
2. **Drop on canvas**
3. **Resize it** (drag corner) to make it larger

### Step 2: Place Components Inside

1. **Drag a Collector node**
2. **Drop it INSIDE the Host node**
3. **Notice**: Collector becomes a child of Host

**Result**: The topology now shows "Collector runs on Host A"

### Step 3: Try Docker Context

1. **Clear canvas**
2. **Add a Docker node**
3. **Add Collector inside Docker**
4. **Configure Docker network** via Node Config Panel

**Export**: Generates docker-compose.yml automatically

### Step 4: Try Kubernetes Context

1. **Select "Kubernetes" scenario**
2. **Observe**:
   - K8s Namespace node (outer container)
   - DaemonSet node (for agents)
   - Deployment node (for gateways)
   - Collectors inside DaemonSet/Deployment

**Export**: Generates full K8s manifests

---

## Advanced Features

### Validation System

The visualizer validates your topology in real-time:

#### Connection Validation
- **Invalid**: SDK → SDK (no direct SDK connections)
- **Valid**: SDK → Collector or SDK → Elastic
- **Invalid**: Elastic → anything (Elastic is always a sink)

#### Configuration Validation
- Warns if `memory_limiter` not first
- Suggests `tail_sampling` for gateways
- Checks for disconnected nodes

### Real-time YAML Preview

Every configuration change updates YAML instantly:
- Toggle receiver → YAML updates
- Reorder processor → YAML reflects new order
- Add exporter → YAML includes new exporter

### Environment Variable Management

All exports use environment variables for secrets:
- `${ELASTIC_ENDPOINT}` - Elastic cluster endpoint
- `${ELASTIC_API_KEY}` - Authentication key
- Never hardcode credentials

---

## Tips and Tricks

### Keyboard and Mouse

- **Pan**: Click-drag on empty space
- **Zoom**: Mouse wheel or +/- buttons
- **Select**: Click node or edge
- **Multi-select**: Hold Shift + click (coming soon)
- **Delete**: Select + Delete key (coming soon)

### Layout Tips

- **Organize left-to-right**: SDKs → Collectors → Elastic
- **Use vertical spacing**: Separate parallel flows
- **Group related components**: Use infrastructure nodes
- **Label clearly**: Use meaningful node labels

### Performance

- **Limit particle count**: Too many nodes = laggy animations
- **Disable demo mode**: When building complex topologies
- **Use scenarios**: Start with preset, then customize

### Configuration

- **Start simple**: Add components incrementally
- **Follow warnings**: Validation knows best practices
- **Test exports**: Verify YAML before deployment

---

## Common Patterns

### Pattern 1: Development Setup
```
[App + SDK] → [Elastic]
```
- No collector needed
- Direct OTLP to Elastic
- Fast iteration

### Pattern 2: Single Host Production
```
[App + SDK] → [Agent Collector] → [Elastic]
         ↑
    hostmetrics
```
- Collector on same host as app
- Collects infrastructure metrics
- Buffers during outages

### Pattern 3: Microservices with Gateway
```
[Service A + SDK] ─┐
[Service B + SDK] ─┼→ [Gateway] → [Elastic]
[Service C + SDK] ─┘
```
- Centralized sampling decisions
- Reduced data volume
- Consistent transformation

### Pattern 4: Full HA Production
```
[Service 1 + SDK] → [Agent 1] ─┬→ [Gateway 1] ─┬→ [Elastic]
[Service 2 + SDK] → [Agent 2] ─┤               │
[Service 3 + SDK] → [Agent 3] ─┼→ [Gateway 2] ─┘
[Service 4 + SDK] → [Agent 4] ─┘
```
- Agents per host/service
- Load-balanced gateways
- High availability
- Production-ready

---

## FAQ

### General Questions

**Q: Do I need to install anything besides Node.js?**
A: No, just `npm install` and you're ready.

**Q: Can I use this in production?**
A: The visualizer is for design and learning. Export configs are production-ready, but test before deploying.

**Q: Does this work with generic OTel (non-EDOT)?**
A: It's EDOT-focused but configs are compatible with standard OTel Collector.

### Usage Questions

**Q: Why can't I connect SDK to SDK?**
A: SDKs don't accept telemetry from other SDKs. Use SDK → Collector or SDK → Elastic.

**Q: Can I import existing YAML configs?**
A: Not yet, but it's on the roadmap (v0.2.0).

**Q: How do I delete a node?**
A: Click to select, then use Delete key (coming soon). For now, use Reset and rebuild.

**Q: Can I save my topology?**
A: Export configs save the collector configuration. Saving full topology is planned (v0.2.0).

### Configuration Questions

**Q: Why is memory_limiter always first?**
A: Prevents OOM by rejecting data before processing. EDOT best practice.

**Q: What's the difference between Agent and Gateway mode?**
A:
- **Agent**: Per-host, collects infrastructure metrics, simpler processing
- **Gateway**: Centralized, handles sampling/transformation, processes data from multiple agents

**Q: Do I need both Agent and Gateway?**
A: For production at scale (10+ services), yes. For smaller deployments, Agent alone is fine.

**Q: What's tail_sampling?**
A: Intelligent sampling that waits for entire trace before deciding to keep/drop. Only works in Gateway mode.

### Export Questions

**Q: Are exported configs ready for production?**
A: They're a great starting point but:
- Review and adjust resource limits
- Configure authentication properly
- Test in staging first
- Tune batch sizes for your volume

**Q: Can I customize the exported YAML?**
A: Yes! The export is a template. Edit as needed for your environment.

**Q: What version of EDOT Collector do exports target?**
A: Latest stable version (8.x). Check Elastic docs for specific version compatibility.

---

## Next Steps

Now that you've completed the user guide:

1. **Experiment**: Try building different topologies
2. **Learn EDOT**: Read the [EDOT Reference](./edot-reference.md) (coming soon)
3. **Deploy**: Export and test configurations in your environment
4. **Contribute**: Found a bug or have ideas? See [CONTRIBUTING.md](../CONTRIBUTING.md)

**Happy visualizing!** 🎉

---

**Questions?** Open an issue on GitHub or check the [FAQ section](#faq).

**Want to learn more?** Check out:
- [Elastic EDOT Documentation](https://www.elastic.co/docs/reference/opentelemetry)
- [OpenTelemetry Documentation](https://opentelemetry.io/)
- [EDOT Collector Configuration](https://www.elastic.co/docs/reference/edot-collector)
