# Proposal: Implement Azure Queue Service and Async Worker

## Summary
Implement Azure Storage Queue service for async task communication between frontend server and dedicated worker running on a VPS, with per-client queue isolation.

## Motivation
- **Scalability**: Dedicated worker on VPS can process long-running tasks without blocking serverless functions
- **Reliability**: Azure Storage Queue provides persistent message storage with at-least-once delivery
- **Multi-tenancy**: Per-client queue isolation ensures tasks don't cross between app instances (southhaven, demo, etc.)
- **Reusability**: Uses existing Azure Storage account already configured for blob storage

## Goals
1. Implement Azure Storage Queue provider in queue service
2. Create async worker script that runs on VPS
3. Support per-client queue naming based on app instance
4. Enable task status tracking and webhook notifications
5. Maintain compatibility with existing queue service interface

## Non-Goals
- Replacing Azure Queue with other providers (AWS SQS, etc.) - focus on Azure
- Real-time task status updates (worker will notify on completion via webhook)
- Multi-worker load balancing (single dedicated worker per app instance)

## Success Criteria
- Azure Queue service submits and retrieves messages successfully
- Worker processes tasks from per-client queue and completes them
- Worker notifies frontend server on completion via webhook
- Queue names are correctly scoped per client instance
- Worker handles errors gracefully with retry logic

## Related Changes
- split-backend-serverless (created queue service abstraction, now implementing Azure provider)
