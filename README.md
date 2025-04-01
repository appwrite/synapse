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

- 📦 Git Operations

  - Git repository management
  - Branch operations
  - Commit and push changes
  - Pull and merge remote changes

## Installation

```bash
npm install @appwrite.io/synapse
```

## Usage

### Basic Setup

```typescript
import { Synapse, Terminal } from "@appwrite.io/synapse";

// Initialize Synapse for WebSocket communication
const synapse = new Synapse("localhost", 8080);

// Connect to WebSocket server
await synapse.connect("/terminal");

// Create terminal instance with Synapse
const terminal = new Terminal(synapse);
```

### Terminal Operations

```typescript
// Send commands to the terminal
terminal.createCommand("ls -la");

// Handle terminal output
terminal.onData((data) => {
  console.log("Terminal output:", data);
});

// Resize terminal
terminal.updateSize(80, 24);

// Kill terminal
terminal.kill();

// Disconnect from WebSocket server
synapse.disconnect();
```

### File System Operations

```typescript
// File operations through Synapse's filesystem service
import { Synapse, Filesystem } from "@appwrite.io/synapse";

const synapse = new Synapse();
const filesystem = new Filesystem(synapse);

await filesystem.createFile("/path/to/file.txt", "Hello, World!");

const { success, data } = await filesystem.getFile("/path/to/file.txt");
const { success, data } = await filesystem.getFolder("/path/to/dir");
```

### System Monitoring

```typescript
// Get system usage statistics through Synapse's system service
import { System } from "@appwrite.io/synapse";

const system = new System(synapse);
const { success, data } = await system.getUsage();
console.log("CPU Usage:", data.cpuUsagePercent + "%");
console.log("Memory Usage:", data.memoryUsagePercent + "%");
console.log("Load Average (1m):", data.loadAverage1m);
```

### Git Operations

```typescript
// Perform Git operations through Synapse's git service
import { Synapse, Git } from "@appwrite.io/synapse";

const synapse = new Synapse();
const git = new Git(synapse);

// Get current branch
const branch = await git.getCurrentBranch();

// Check repository status
const status = await git.status();

// Stage files
await git.add(["file1.txt", "file2.txt"]);

// Commit changes
await git.commit("feat: add new features");

// Pull and push changes
await git.pull();
await git.push();
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
