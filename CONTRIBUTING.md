# Contributing Guide

Thank you for your interest in contributing to **Synapse**! We welcome all contributions and are excited to collaborate with you.

## Getting Started

Follow these steps to set up your development environment:

1. **Fork the Repository**
   - Click the "Fork" button at the top right of the repository page.

2. **Clone Your Fork**

   ```bash
   git clone https://github.com/<your-username>/synapse.git
   cd synapse
   ```

3. **Install Dependencies**

   ```bash
   npm install
   ```

4. **Create a Feature Branch**

   ```bash
   git checkout -b my-feature
   ```

5. **Make Your Changes**
   - Implement your improvements or bug fixes.

6. **Build and Test**
   - Build for testing:
     ```bash
     npm run build:test
     ```
   - Run tests:
     ```bash
     npm run test
     ```

## Running Tests in a Container

Our tests are designed to run in a containerized environment for consistency. You can execute them locally with Docker:

```bash
docker run -it --rm -v $(pwd):/app -w /app node:20-alpine sh -c "npm install && npm run build:test && npm run test"
```

Alternatively, use the [act](https://github.com/nektos/act) tool to simulate GitHub Actions locally:

```bash
act -j 'test'
act -j 'test' --container-architecture linux/amd64   # For macOS (Apple Silicon)
```

## Development Guidelines

- Follow the existing code style and conventions.
- Add or update tests for any new features or bug fixes.
- Update documentation as necessary.
- Ensure **all tests pass** before submitting your changes.

## Submitting a Pull Request

1. **Push Your Branch**

   ```bash
   git push origin my-feature
   ```

2. **Open a Pull Request**
   - Go to your fork on GitHub and click "Compare & pull request".
   - Provide a clear description of your changes and reference any related issues.

3. **Review Process**
   - Address feedback and make additional commits as needed.
   - Ensure your branch stays up to date with `main` by rebasing or merging.

## Need Help?

If you have any questions or need clarification, please [open an issue](https://github.com/appwrite/synapse/issues). We’re happy to help!

We appreciate your contributions and effort to make Synapse better for everyone!
