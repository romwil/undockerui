# Docker Build Optimization

## Changes Made

### 1. Added `.dockerignore`
Excludes unnecessary files from build context:
- Python cache (`__pycache__/`, `*.pyc`)
- Virtual environments (`.venv/`, `venv/`)
- Runtime data (`data/` - mounted as volume)
- IDE/OS files (`.DS_Store`, `.vscode/`)
- Documentation files
- Environment files (handled via `env_file` in compose)

**Impact**: Reduces build context size by ~3MB+ and speeds up context transfer to Docker daemon.

### 2. Optimized Dockerfile Layer Caching
- Combined `apt-get` commands into single RUN layer
- Added `pip upgrade` before installing requirements
- Better layer ordering: dependencies → code (dependencies change less frequently)

**Impact**: Subsequent builds are faster when only code changes (dependencies layer is cached).

### 3. Build Context Optimization
The `.dockerignore` prevents sending:
- `.venv/` (2.8MB) - not needed in container
- `__pycache__/` (16KB) - regenerated in container
- `data/` (72KB) - mounted as volume at runtime

## Build Performance Tips

### First Build (No Cache)
```bash
docker-compose build --no-cache
```
This will be slow as it downloads base image, installs system packages, and Python dependencies.

### Subsequent Builds (With Cache)
```bash
docker-compose build
```
Much faster! Only rebuilds layers that changed:
- If only `app.py` or templates changed → only final COPY layer rebuilds
- If `requirements.txt` changed → pip install layer rebuilds
- If Dockerfile changed → affected layers rebuild

### Force Rebuild Specific Layer
If you want to rebuild from a specific point:
```bash
# Rebuild from requirements.txt layer
docker-compose build --no-cache vault1848
```

## Further Optimization Ideas (Future)

1. **Multi-stage build**: Separate build and runtime stages (minimal benefit for this app)
2. **Pin dependency versions**: Use exact versions in `requirements.txt` for reproducible builds
3. **Use BuildKit cache mounts**: For pip cache (requires Docker BuildKit)
4. **Pre-built base image**: Create a custom base with system deps pre-installed (if rebuilding frequently)

## Current Build Time Estimates

- **First build (no cache)**: ~3-5 minutes (downloads base image, installs deps)
- **Code-only change**: ~10-30 seconds (only final COPY layer)
- **Requirements change**: ~1-2 minutes (pip install layer rebuilds)
