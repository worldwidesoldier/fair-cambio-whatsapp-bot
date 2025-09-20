# Development Guide

## Getting Started

1. Clone the repository
2. Run `npm run setup` (this script)
3. Configure your .env file
4. Run `npm run deploy` for coordinated deployment

## Development Workflow

### Starting the System
```bash
# Terminal 1: Master Coordinator
npm run coordinator

# Terminal 2: WhatsApp Bot
npm start

# Terminal 3: Dashboard
npm run dashboard

# Terminal 4: Tests (watch mode)
npm run test:watch
```

### Agent Development
Each agent has specific responsibilities:

- **Agent 1 (Tests)**: Comprehensive testing framework
- **Agent 2 (Multi-Branch)**: Multi-instance bot coordination
- **Agent 3 (Logging)**: Centralized logging and monitoring
- **Agent 4 (Dashboard)**: Web administration interface

### Code Quality
- Run `npm test` before committing
- Maintain >80% test coverage
- Follow ESLint rules
- Update documentation for API changes

### Debugging
- Check logs in the `logs/` directory
- Use the health check endpoint: `/health`
- Monitor agent status via dashboard
- Check coordination API status

## Architecture
The system uses a master-coordinator pattern with shared database and configuration management.

See COORDINATION_INSTRUCTIONS.md for detailed agent coordination information.
