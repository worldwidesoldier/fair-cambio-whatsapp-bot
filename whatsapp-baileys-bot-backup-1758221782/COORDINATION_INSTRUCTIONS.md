# MASTER COORDINATION INSTRUCTIONS
## Agent Integration and Communication Protocol

### OVERVIEW
This document provides detailed instructions for each of the 4 specialized agents working on the WhatsApp Baileys Bot project. The Master Coordinator ensures seamless integration and communication between all components.

### SHARED INFRASTRUCTURE

#### Database Layer
- **Primary**: MongoDB with Mongoose ODM
- **Fallback**: File-based JSON storage in `/data` directory
- **Access**: Via `src/config/database.js` singleton
- **Schemas**: To be defined by each agent as needed

#### Configuration Management
- **Location**: `src/config/shared.js`
- **Environment**: `.env` file with shared variables
- **Agent-specific**: Configuration objects in `agentConfigs`
- **Runtime Updates**: Via coordination API `/config/update`

#### Communication API
- **Base URL**: `http://localhost:3000` (configurable)
- **Health Checks**: `/health`
- **Agent Registration**: `/agents/register`
- **Inter-agent Communication**: `/agents/communicate`
- **Shared Data**: `/data/:collection`

---

## AGENT 1: TESTING FRAMEWORK COORDINATOR

### RESPONSIBILITIES
- Create comprehensive testing suite for all project components
- Validate integration between all other agents
- Ensure code quality and coverage standards
- Setup CI/CD testing pipeline

### INTEGRATION REQUIREMENTS

#### Dependencies
- **Must test**: All other agents (2, 3, 4)
- **Database**: Read/write test data via shared database layer
- **Configuration**: Use shared config for test environment settings

#### Test Categories Required
1. **Unit Tests**: Individual component testing
2. **Integration Tests**: Agent-to-agent communication
3. **End-to-End Tests**: Full WhatsApp bot workflow
4. **Performance Tests**: Load and stress testing
5. **Security Tests**: Authentication and authorization

#### Shared Resources Access
```javascript
// Example: Accessing shared database in tests
const dbManager = require('../src/config/database');
const { getAgentConfig } = require('../src/config/shared');

const testConfig = getAgentConfig('tests');
```

#### Validation Rules
- **Coverage**: Minimum 80% code coverage
- **Quality**: Zero critical violations
- **Integration**: All agents must pass communication tests
- **Performance**: Response times under defined thresholds

#### Communication Protocol
- **Register with Coordinator**: On test suite startup
- **Report Results**: After each test run via API
- **Validate Other Agents**: Before deployment approval

---

## AGENT 2: MULTI-BRANCH COORDINATOR

### RESPONSIBILITIES
- Implement multi-branch WhatsApp bot instances
- Coordinate data synchronization between branches
- Manage branch-specific configurations
- Handle load balancing and failover

### INTEGRATION REQUIREMENTS

#### Dependencies
- **Logging Agent**: For centralized audit trails
- **Database**: Shared branch data and synchronization state
- **Configuration**: Branch-specific settings from shared config

#### Multi-Branch Architecture
```javascript
// Branch registration example
const branchConfig = {
  id: 'branch-matriz',
  name: 'Fair Câmbio - Matriz',
  phone: '559185001234',
  active: true,
  syncStrategy: 'eventual-consistency'
};

await dbManager.saveData('branches', branchConfig);
```

#### Synchronization Strategy
- **Rates**: Real-time sync across all branches
- **Configurations**: Eventual consistency model
- **Logs**: Branch-specific with central aggregation
- **Sessions**: Branch-isolated with shared metadata

#### Communication with Other Agents
- **Dashboard Agent**: Provide branch status and metrics
- **Logging Agent**: Send branch-specific events
- **Testing Agent**: Accept validation requests

#### Coordination Points
- **Data Consistency**: Conflict resolution mechanisms
- **Load Distribution**: Branch selection algorithms
- **Health Monitoring**: Cross-branch status checks
- **Deployment**: Coordinated updates across branches

---

## AGENT 3: LOGGING AND MONITORING COORDINATOR

### RESPONSIBILITIES
- Centralized logging system for all components
- Real-time monitoring and alerting
- Performance metrics collection
- Audit trail management

### INTEGRATION REQUIREMENTS

#### Dependencies
- **None**: This is the foundation layer for other agents
- **Database**: Store logs, metrics, and audit trails
- **Configuration**: Logging levels and retention policies

#### Logging Infrastructure
```javascript
// Structured logging example
const logger = require('../src/logging/logger');

logger.info('Agent communication', {
  fromAgent: 'multiBranch',
  toAgent: 'dashboard',
  action: 'statusUpdate',
  correlationId: 'uuid-here'
});
```

#### Monitoring Capabilities
1. **Application Logs**: All agent activities
2. **Performance Metrics**: Response times, throughput
3. **Health Checks**: Component availability
4. **Error Tracking**: Exception monitoring
5. **Audit Trails**: Administrative actions

#### Integration Points
- **All Agents**: Receive log events and metrics
- **Dashboard**: Provide data for visualization
- **Testing**: Supply test execution logs
- **Multi-branch**: Aggregate branch-specific logs

#### Data Collection Strategy
- **Real-time**: Critical errors and security events
- **Batched**: Performance metrics and routine logs
- **Retention**: 30 days with compression after 7 days
- **Alerting**: Configurable thresholds and notifications

---

## AGENT 4: DASHBOARD COORDINATOR

### RESPONSIBILITIES
- Web-based administration interface
- Real-time data visualization
- Multi-agent system monitoring
- Administrative controls for all components

### INTEGRATION REQUIREMENTS

#### Dependencies
- **Logging Agent**: Display logs and metrics
- **Multi-branch Agent**: Branch management interface
- **Database**: All system data access
- **Testing Agent**: Test results and coverage reports

#### Dashboard Architecture
```javascript
// Dashboard data aggregation example
const dashboardData = {
  system: await getSystemHealth(),
  branches: await getBranchStatus(),
  logs: await getRecentLogs(),
  metrics: await getPerformanceMetrics(),
  tests: await getTestResults()
};
```

#### Features Required
1. **System Overview**: Health status of all agents
2. **Branch Management**: Multi-branch control panel
3. **Rate Management**: Currency rate administration
4. **Log Viewer**: Real-time log streaming
5. **Metrics Dashboard**: Performance visualization
6. **Test Results**: Testing status and coverage
7. **Configuration**: System settings management

#### Real-time Updates
- **WebSocket**: Live data streaming
- **Update Frequency**: 2-second intervals
- **Event-driven**: Immediate critical notifications
- **Data Caching**: Optimized performance

#### Security Requirements
- **Authentication**: Admin user management
- **Authorization**: Role-based access control
- **Session Management**: Secure session handling
- **Audit Logging**: All administrative actions

---

## COORDINATION PROTOCOL

### Agent Registration Process
1. **Startup**: Agent registers with master coordinator
2. **Configuration**: Receive agent-specific config
3. **Dependencies**: Validate required dependencies
4. **Health Check**: Establish monitoring connection
5. **Ready State**: Signal readiness for coordination

### Inter-Agent Communication
```javascript
// Communication example
const message = {
  fromAgent: 'tests',
  toAgent: 'multiBranch',
  type: 'validation_request',
  payload: { testSuite: 'integration' }
};

await fetch('/agents/communicate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(message)
});
```

### Deployment Coordination
1. **Pre-deployment**: All agents validate readiness
2. **Deployment Order**: Logging → Multi-branch → Dashboard → Tests
3. **Validation**: Each agent validates previous deployments
4. **Rollback**: Coordinated rollback on any failure

### Shared Data Access Patterns
```javascript
// Standardized data access
const sharedData = {
  rates: await dbManager.getData('rates'),
  branches: await dbManager.getData('branches'),
  logs: await dbManager.getData('logs', { date: today }),
  metrics: await dbManager.getData('metrics', { agent: 'multiBranch' })
};
```

### Health Monitoring
- **Heartbeat**: Every 30 seconds
- **Status Updates**: Real-time via API
- **Failure Detection**: 2 missed heartbeats
- **Recovery**: Automatic restart coordination

### Configuration Synchronization
- **Initial**: On agent registration
- **Updates**: Real-time propagation
- **Validation**: Schema-based validation
- **Rollback**: Previous configuration on failure

---

## ERROR HANDLING AND RECOVERY

### Agent Failure Scenarios
1. **Graceful Degradation**: System continues with reduced functionality
2. **Automatic Restart**: Failed agents restart automatically
3. **Data Consistency**: Maintain integrity during failures
4. **User Notification**: Dashboard alerts for failures

### Communication Failures
- **Retry Logic**: Exponential backoff for API calls
- **Circuit Breaker**: Prevent cascade failures
- **Fallback Modes**: Local operation when coordination unavailable
- **Recovery**: Automatic synchronization on reconnection

### Data Integrity
- **Transactions**: ACID compliance where possible
- **Backup**: Regular automated backups
- **Validation**: Schema and business rule validation
- **Conflict Resolution**: Last-write-wins for eventual consistency

---

## DEPLOYMENT PIPELINE

### Development Environment
```bash
# Start coordination system
npm run coordinator

# Start individual agents (in separate terminals)
npm run test:watch          # Agent 1
npm run start:multibranch   # Agent 2
npm run start:logging       # Agent 3
npm run dashboard           # Agent 4
```

### Production Deployment
1. **Infrastructure**: Database and dependencies
2. **Configuration**: Environment-specific settings
3. **Coordinator**: Start master coordination system
4. **Agents**: Deploy in dependency order
5. **Validation**: Full system integration tests
6. **Monitoring**: Activate health checks and alerting

### Monitoring and Maintenance
- **Health Dashboards**: Real-time system status
- **Performance Metrics**: Response times and throughput
- **Log Analysis**: Error patterns and trends
- **Capacity Planning**: Resource utilization tracking

---

## SUCCESS CRITERIA

### Integration Validation
- [ ] All 4 agents register successfully with coordinator
- [ ] Inter-agent communication working
- [ ] Shared database access functioning
- [ ] Configuration synchronization active
- [ ] Health monitoring operational

### Functional Validation
- [ ] WhatsApp bot functioning with multi-branch support
- [ ] Comprehensive test suite with >80% coverage
- [ ] Centralized logging capturing all events
- [ ] Dashboard displaying real-time system status
- [ ] Administrative functions working

### Performance Validation
- [ ] Response times under 2 seconds
- [ ] System handles expected load
- [ ] Failover mechanisms working
- [ ] Data synchronization within SLA
- [ ] Resource utilization optimized

### Security Validation
- [ ] Authentication and authorization working
- [ ] Audit trails complete
- [ ] Data encryption in place
- [ ] Security scanning passed
- [ ] Access controls enforced

This coordination framework ensures all agents work together seamlessly to deliver a robust, scalable WhatsApp bot system with comprehensive management capabilities.