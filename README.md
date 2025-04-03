# Synapse

Operating system gateway for remote serverless environments. Synapse provides a WebSocket-based interface to interact with terminal sessions, manage files, monitor system resources, perform Git operations, and more.

## Features

- 🖥️ Terminal management

  - Remote terminal session control
  - Command execution and output streaming
  - Terminal customization options

- 📂 File system operations

  - Complete CRUD operations for files and directories
  - Path and directory management
  - File system navigation and manipulation

- 📊 System monitoring

  - Real-time CPU and memory metrics
  - System load monitoring
  - Performance statistics

- 📦 Git operations

  - Git repository management
  - Branch operations
  - Commit and push changes
  - Pull and merge remote changes

- 📝 Code style management

  - Linting and formatting
  - Error detection and correction
  - Code formatting options

## Installation

```bash
npm install @appwrite.io/synapse
```

## Usage

### Basic setup

```typescript
import { Synapse, Terminal } from "@appwrite.io/synapse";

// Initialize Synapse for WebSocket communication
const synapse = new Synapse("localhost", 8080);

// Connect to WebSocket server
await synapse.connect("/");

// Create terminal instance with Synapse
const terminal = new Terminal(synapse);
```

### Terminal operations

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

### File system operations

```typescript
// File operations through Synapse's filesystem service
import { Synapse, Filesystem } from "@appwrite.io/synapse";

const synapse = new Synapse();
const filesystem = new Filesystem(synapse);

await filesystem.createFile("/path/to/file.txt", "Hello, World!");

const { success, data } = await filesystem.getFile("/path/to/file.txt");
const { success, data } = await filesystem.getFolder("/path/to/dir");
```

### System monitoring

```typescript
// Get system usage statistics through Synapse's system service
import { System } from "@appwrite.io/synapse";

const system = new System(synapse);
const { success, data } = await system.getUsage();
console.log("CPU Usage:", data.cpuUsagePercent + "%");
console.log("Memory Usage:", data.memoryUsagePercent + "%");
console.log("Load Average (1m):", data.loadAverage1m);
```

### Git operations

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

### Code style management

```typescript
// Lint and format code
import { Synapse, Code } from "@appwrite.io/synapse";

const synapse = new Synapse();
const code = new Code(synapse);

// Format code with specific options
const code = `function hello(name) {
return "Hello, " + name;
}`;

const formatResult = await code.format(code, {
  language: "javascript",
  indent: 2,
  singleQuote: true,
  semi: true,
});

console.log("Formatted code:", formatResult.data);

// Lint code for potential issues
const lintResult = await code.lint(code, {
  language: "javascript",
  rules: {
    semi: "error",
    "no-unused-vars": "warn",
  },
});

if (lintResult.issues.length > 0) {
  console.log("Linting issues found:", lintResult.issues);
}
```

### Event handling

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
