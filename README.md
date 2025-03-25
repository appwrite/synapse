# Synapse

Operating system gateway for remote serverless environments. Synapse provides a WebSocket-based interface to interact with terminal sessions, manage files, and monitor system resources remotely.

## Features

- 🖥️ Terminal Management

  - Create and control terminal sessions
  - Execute commands remotely
  - Resize terminal windows
  - Real-time terminal output streaming

- 📂 File System Operations

  - Create, read, update, and delete files
  - Create, list, rename, and delete directories
  - Move files and directories
  - Path management

- 📊 System Monitoring
  - CPU usage per core and overall
  - Memory usage statistics
  - System load averages
  - Real-time system metrics

## Installation

```bash
npm install synapse
```

## Usage

### Basic Setup

```typescript
import Synapse from "synapse";

const synapse = new Synapse({
  shell: "bash", // Default: 'powershell.exe' on Windows, 'bash' otherwise
  cols: 80, // Terminal columns
  rows: 24, // Terminal rows
  workdir: process.cwd(), // Working directory
  logger: console.log, // Custom logger function
});

// Connect to WebSocket server
await synapse.connect("ws://your-server-url");
```

### Terminal Operations

```typescript
// Send a command to the terminal
synapse.sendCommand("ls -la");

// Resize the terminal
synapse.resizeTerminal(100, 30);

// Handle terminal output
synapse.onMessageType("terminalOutput", (message) => {
  console.log("Terminal output:", message.data);
});
```

### File System Operations

```typescript
// Create a file
await synapse.createFile("/path/to/file.txt", "Hello, World!");

// Read a file
const { success, data } = await synapse.getFile("/path/to/file.txt");

// Update a file
await synapse.updateFile("/path/to/file.txt", "Updated content");

// Delete a file
await synapse.deleteFile("/path/to/file.txt");

// List directory contents
const { success, data } = await synapse.getFolder("/path/to/dir");
```

### System Monitoring

```typescript
// Get system usage statistics
const { success, data } = await synapse.getSystemUsage();
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

## API Reference

### Constructor Options

```typescript
interface SynapseOptions {
  shell?: string; // Shell to use for terminal
  cols?: number; // Terminal columns
  rows?: number; // Terminal rows
  workdir?: string; // Working directory
  logger?: (message: string) => void; // Custom logger
}
```

For detailed API documentation, please refer to the source code and type definitions.

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
