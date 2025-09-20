# Fair Câmbio Bot - API Documentation

## Overview
This document describes the API endpoints and coordination system for the Fair Câmbio WhatsApp Bot.

## Master Coordination API

### Base URL
`http://localhost:3000`

### Endpoints

#### Health Check
`GET /health`

Returns the health status of all system components.

#### Agent Registration
`POST /agents/register`

Register a new agent with the coordination system.

#### Inter-Agent Communication
`POST /agents/communicate`

Send messages between agents.

## Agent-Specific APIs

### Agent 1: Testing Framework
- Endpoint: TBD
- Purpose: Test execution and validation

### Agent 2: Multi-Branch System
- Endpoint: TBD
- Purpose: Branch coordination and synchronization

### Agent 3: Logging System
- Endpoint: TBD
- Purpose: Centralized logging and monitoring

### Agent 4: Dashboard
- Endpoint: `http://localhost:3001`
- Purpose: Web-based administration interface

## Authentication
Admin endpoints require authentication using the credentials defined in the .env file.

## Rate Limiting
API endpoints are rate-limited to prevent abuse. See coordination/api.js for configuration.
