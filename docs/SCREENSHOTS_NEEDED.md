# Screenshots Needed for Documentation

This file tracks the visual assets needed to complete the documentation.

## Priority 1: README.md Hero Section

### 1. Hero Screenshot (docs/images/hero.png)
- **Description**: Full application view showing the main canvas with a complete topology
- **Recommended scenario**: Production scenario (shows complexity and power)
- **Requirements**:
  - Canvas should show 4-5 connected nodes
  - Side panels visible (Component Palette, Config Export, Stats Panel)
  - Animated particles visible on edges
  - 1920x1080px or similar high resolution
  - Clean, professional appearance

### 2. Demo GIF (docs/images/demo.gif)
- **Description**: 20-30 second walkthrough showing key interactions
- **Storyboard**:
  1. Start with empty canvas (2s)
  2. Drag SDK node from palette (3s)
  3. Drag Collector node from palette (3s)
  4. Connect them (2s)
  5. Drag Elastic node and connect (3s)
  6. Click "Export Config" button (2s)
  7. Show YAML preview (3s)
  8. Enable Demo Mode to show particles (5s)
  9. Show stats panel updating (3s)
- **Requirements**:
  - Max 10MB file size
  - 60fps smooth animation
  - Cursor visible for clarity
  - Use screen recording tool (QuickTime, OBS, or similar)

## Priority 2: Scenario Examples

### 3. Simple Pattern (docs/images/scenario-simple.png)
- One SDK node → One Elastic node
- Clear, minimal example
- 800x600px minimum

### 4. Agent Pattern (docs/images/scenario-agent.png)
- SDK → Collector Agent → Elastic
- Show hostmetrics receiver on collector
- 800x600px minimum

### 5. Gateway Pattern (docs/images/scenario-gateway.png)
- Multiple SDKs → Gateway Collector → Elastic
- Show sampling processor on gateway
- 1200x800px minimum

### 6. Production Pattern (docs/images/scenario-production.png)
- Complex topology with agents and gateways
- Full featured example
- 1200x800px minimum

## Priority 3: Feature Highlights

### 7. Animated Particles (docs/images/feature-particles.png)
- Close-up of edges with animated particles
- Show all three types (traces=amber, metrics=blue, logs=green)
- 800x400px

### 8. Config Export Panel (docs/images/feature-config-export.png)
- Config Export panel open with YAML preview
- Show "Download YAML" and "Copy" buttons
- 600x800px

### 9. Node Configuration Panel (docs/images/feature-node-config.png)
- Node Config panel showing collector configuration
- Toggle switches for receivers/processors/exporters
- 600x800px

### 10. Validation Panel (docs/images/feature-validation.png)
- Validation panel showing warnings or suggestions
- Best practices recommendations visible
- 600x600px

### 11. Component Palette (docs/images/feature-palette.png)
- Component palette showing all available nodes
- SDK, Collector, Infrastructure, Elastic sections
- 400x800px

## Priority 4: Infrastructure Nodes

### 12. Docker Deployment (docs/images/infra-docker.png)
- Docker node with nested collector
- Show network configuration
- 800x600px

### 13. Kubernetes Deployment (docs/images/infra-k8s.png)
- K8s namespace with DaemonSet/Deployment
- Nested collectors visible
- 1200x800px

## How to Capture Screenshots

### Using the Development Server
1. Start the app: `npm run dev`
2. Navigate to http://localhost:3000/otel-flow
3. Load desired scenario using scenario selector
4. Use native screenshot tool:
   - macOS: `Cmd + Shift + 4` (select area) or `Cmd + Shift + 5` (advanced)
   - Windows: `Win + Shift + S` or Snipping Tool
   - Linux: `gnome-screenshot -a` or similar

### For GIF Recording
**macOS:**
- QuickTime Player → File → New Screen Recording
- Then convert to GIF: `ffmpeg -i demo.mov -vf "fps=30,scale=1280:-1:flags=lanczos" -loop 0 demo.gif`

**Windows/Linux:**
- OBS Studio (free, cross-platform)
- LICEcap (lightweight, direct to GIF)
- ScreenToGif (Windows, excellent control)

### Optimization
After capturing, optimize file sizes:
```bash
# PNG optimization
pngquant --quality=80-95 *.png

# GIF optimization
gifsicle -O3 --colors 256 -o demo-optimized.gif demo.gif
```

## Checklist
- [ ] 1. Hero screenshot
- [ ] 2. Demo GIF
- [ ] 3. Simple scenario
- [ ] 4. Agent scenario
- [ ] 5. Gateway scenario
- [ ] 6. Production scenario
- [ ] 7. Animated particles
- [ ] 8. Config export panel
- [ ] 9. Node config panel
- [ ] 10. Validation panel
- [ ] 11. Component palette
- [ ] 12. Docker deployment
- [ ] 13. Kubernetes deployment

## Notes
- All images should use descriptive filenames
- Keep consistent styling (same zoom level, theme)
- Ensure text is readable at displayed sizes
- Include alt text descriptions in documentation
- Store in `docs/images/` directory
