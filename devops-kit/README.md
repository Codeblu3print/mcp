# MCP DevOps Kit

A Model Context Protocol (MCP) server providing DevOps tools integration.

## Features

### GitHub Tools
- `github_list_repos` - List repositories for a user/organization
- `github_create_issue` - Create a new issue
- `github_get_repo_info` - Get repository information

### Docker Tools
- `docker_ps` - List running containers
- `docker_logs` - Get container logs
- `docker_stats` - Get container resource statistics

### Filesystem Tools
- `fs_ls` - List directory contents
- `fs_read` - Read file contents
- `fs_stats` - Get file/directory statistics

## Installation

```bash
npm install
npm run build
```

## Configuration

### Environment Variables

```bash
GITHUB_TOKEN=your_github_token_here
GITHUB_ORG=your_default_org (optional)
```

### Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "devops-kit": {
      "command": "node",
      "args": ["path/to/devops-kit/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "your_token"
      }
    }
  }
}
```

## Usage

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## License

MIT
