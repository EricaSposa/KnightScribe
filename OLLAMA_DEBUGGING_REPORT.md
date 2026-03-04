# Ollama API Integration Debugging Report

**Date:** February 24, 2026  
**Project:** KnightScribe (EduGrade AI)  
**Author:** Cascade AI Assistant

---

## Summary

This report documents the debugging process for connecting the KnightScribe application to a remote Ollama server running the Gemma 3 multimodal model.

---

## Original Issue

The application was migrated from using Google's Gemini API to a local Ollama API. After configuring the Vite proxy and rewriting the service layer, the "Test API" button in the application failed to connect to the Ollama server.

**Error observed:**
```
EHOSTUNREACH 10.74.18.120:11434 - Local (10.74.13.245:63382)
```

---

## Root Causes Identified

### 1. Network Routing Issue
- **Problem:** The Mac development machine (`10.74.13.245`) could not directly reach the Ollama server (`10.74.18.120`) despite both being on the same `/16` subnet.
- **Symptom:** `ping 10.74.18.120` returned "No route to host"
- **Discovery:** The user could access the Ollama server via SSH from the standard macOS Terminal, but not from the IDE terminal. Investigation revealed the user was SSH'd *into* the remote machine and accessing Ollama locally from there, not from the Mac.

### 2. Incorrect Model Name
- **Problem:** The code referenced model `gemma3`, but the installed model was `gemma3:12b`
- **Symptom:** API returned `{"error":"model 'gemma3' not found"}`
- **Discovery:** Querying `/api/tags` endpoint revealed the correct model name

### 3. SSH Tunnel Instability
- **Problem:** SSH tunnels with `-N` flag can disconnect silently
- **Symptom:** Intermittent "connection refused" errors after initial success

---

## Solution Implemented

### Step 1: SSH Tunnel
Created an SSH tunnel from the Mac to forward local port 11434 to the Ollama server:

```bash
ssh -L 11434:localhost:11434 "esports#5"@10.74.18.120 -N
```

**Important:** This command must be run from the **standard macOS Terminal**, not the IDE terminal, due to environment/network differences.

### Step 2: Update Vite Proxy Configuration
Changed `vite.config.ts` to proxy to `localhost:11434` instead of the remote IP:

```typescript
proxy: {
  '/ollama': {
    target: 'http://localhost:11434',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/ollama/, '')
  }
}
```

### Step 3: Fix Model Name
Updated `services/ollamaService.ts` to use the correct model tag:

```typescript
const MODEL_NAME = 'gemma3:12b';
```

Also updated the hardcoded model name in `testOllamaConnection()`.

---

## Verification Commands

### Test Ollama is reachable:
```bash
curl -s http://localhost:11434/
# Expected: "Ollama is running"
```

### Test API endpoint directly:
```bash
curl -s -X POST http://localhost:11434/api/chat \
  -H "Content-Type: application/json" \
  -d '{"model":"gemma3:12b","messages":[{"role":"user","content":"Say hi"}],"stream":false}'
```

### Test through Vite proxy (dev server must be running):
```bash
curl -s -X POST http://localhost:3000/ollama/api/chat \
  -H "Content-Type: application/json" \
  -d '{"model":"gemma3:12b","messages":[{"role":"user","content":"Say hi"}],"stream":false}'
```

### List available models:
```bash
curl -s http://localhost:11434/api/tags
```

---

## Possible Future Failures & Fixes

| Failure | Symptom | Fix |
|---------|---------|-----|
| SSH tunnel disconnects | "Connection refused" or timeout | Restart tunnel; use keep-alive: `ssh -L 11434:localhost:11434 user@host -N -o ServerAliveInterval=60` |
| Model not found | `{"error":"model 'X' not found"}` | Check available models with `/api/tags` and update `MODEL_NAME` |
| Vite dev server not running | curl to port 3000 fails | Run `npm run dev` |
| IDE terminal can't reach host | "No route to host" in IDE only | Use standard macOS Terminal for SSH tunnel |
| Ollama server offline | All requests fail | Verify Ollama is running on remote: `systemctl status ollama` or check Windows service |
| Wrong proxy path | 404 errors | Ensure requests use `/ollama/api/chat` prefix |
| CORS errors in browser | Blocked by CORS policy | Verify Vite proxy is configured and dev server is running |
| Slow responses / timeouts | Request hangs then fails | Check Ollama server load; model may be loading into memory |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Mac Development Machine                   │
│                          (10.74.13.245)                         │
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │   Browser   │───▶│ Vite Dev    │───▶│ SSH Tunnel          │ │
│  │ :3000       │    │ Server      │    │ localhost:11434     │ │
│  │             │    │ Proxy       │    │        │            │ │
│  └─────────────┘    │ /ollama/*   │    │        ▼            │ │
│                     └─────────────┘    │ ┌───────────────┐   │ │
│                                        │ │ SSH Client    │   │ │
│                                        │ └───────┬───────┘   │ │
│                                        └─────────┼───────────┘ │
└──────────────────────────────────────────────────┼──────────────┘
                                                   │
                                                   │ SSH Tunnel
                                                   │ Port Forward
                                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Windows Machine (Ollama Host)                │
│                          (10.74.18.120)                         │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Ollama Server                         │   │
│  │                    Port 11434                            │   │
│  │                    Model: gemma3:12b                     │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Startup Checklist

1. **Start SSH tunnel** (in standard macOS Terminal):
   ```bash
   ssh -L 11434:localhost:11434 "esports#5"@10.74.18.120 -N -o ServerAliveInterval=60
   ```

2. **Verify tunnel** (in any terminal):
   ```bash
   curl http://localhost:11434/
   ```

3. **Start dev server**:
   ```bash
   cd /Users/20263325/Documents/KnightScribe
   npm run dev
   ```

4. **Open browser**: http://localhost:3000

5. **Test connection**: Click ⚡ Test API button in header

---

## Files Modified

| File | Change |
|------|--------|
| `vite.config.ts` | Proxy target changed to `localhost:11434` |
| `services/ollamaService.ts` | Model name changed to `gemma3:12b`; added `testOllamaConnection()` function |
| `App.tsx` | Added Test API button with visual feedback |
