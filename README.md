# Synapse

Operating system gateway for remote serverless environments. Synapse provides a WebSocket-based interface to interact with terminal sessions, manage files, and monitor system resources remotely.

## Features

- 🖥️ Terminal Management

  - Remote terminal session control
  - Command execution and output streaming
  - Terminal customization options

- 📂 File System Operations

  - Complete CRUD operations for files and directories
  - Path and directory management
  - File system navigation and manipulation

- 📊 System Monitoring

  - Real-time CPU and memory metrics
  - System load monitoring
  - Performance statistics

## Installation

```bash
npm install synapse
```

## Usage

### Basic Setup

```typescript
import { Synapse, Terminal } from "synapse";

// Initialize Synapse for WebSocket communication
const synapse = new Synapse();

// Connect to WebSocket server
await synapse.connect("ws://your-server-url");

// Create terminal instance with Synapse
const terminal = new Terminal(synapse);
```

### Terminal Operations

```typescript
// Send commands to the terminal
terminal.write("ls -la");

// Handle terminal output
terminal.onData((data) => {
  console.log("Terminal output:", data);
});

// Resize terminal
terminal.resize(80, 24);

// Kill terminal
terminal.kill();

// Disconnect from WebSocket server
synapse.disconnect();
```

### File System Operations

```typescript
// File operations through Synapse's filesystem service
import { Synapse, Filesystem } from "synapse";

const synapse = new Synapse();
const filesystem = new Filesystem(synapse);

await filesystem.createFile("/path/to/file.txt", "Hello, World!");

const { success, data } = await filesystem.getFile("/path/to/file.txt");
const { success, data } = await filesystem.getFolder("/path/to/dir");
```

### System Monitoring

```typescript
// Get system usage statistics through Synapse's system service
import { System } from "synapse";

const system = new System(synapse);
const { success, data } = await system.getUsage();
console.log("CPU Usage:", data.cpuUsagePercent + "%");
console.log("Memory Usage:", data.memoryUsagePercent + "%");
console.log("Load Average (1m):", data.loadAverage1m);
```

### Event Handling

```typescript
synapse
  .onOpen(() => {
    console.log("Connected to WebSocket server");
  })
  .onClose(() => {
    console.log("Disconnected from WebSocket server");
  })
  .onError((error) => {
    console.error("WebSocket error:", error);
  })
  .onMessageType("customEvent", (message) => {
    console.log("Received custom event:", message);
  });
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
