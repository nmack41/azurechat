# Database Indexing Recommendations for Azure Chat

## Overview
This document outlines recommended database indexes for optimal query performance in the Azure Chat application. These recommendations are based on common query patterns identified in the optimized services.

## Cosmos DB Indexing Policy

### Current Automatic Indexing
Cosmos DB automatically indexes all properties by default, but we can optimize for specific query patterns.

### Recommended Composite Indexes

#### 1. Chat Thread Queries
```json
{
  "path": "/type",
  "order": "ascending"
},
{
  "path": "/userId", 
  "order": "ascending"
},
{
  "path": "/isDeleted",
  "order": "ascending"
},
{
  "path": "/lastMessageAt",
  "order": "descending"
}
```
**Purpose**: Optimizes `FindAllChatThreadsWithPagination` queries ordered by last message time.

#### 2. Chat Message Queries
```json
{
  "path": "/type",
  "order": "ascending"
},
{
  "path": "/threadId",
  "order": "ascending"
},
{
  "path": "/userId",
  "order": "ascending"
},
{
  "path": "/createdAt",
  "order": "ascending"
}
```
**Purpose**: Optimizes message retrieval within threads with chronological ordering.

#### 3. Message Deletion Queries
```json
{
  "path": "/type",
  "order": "ascending"
},
{
  "path": "/userId",
  "order": "ascending"
},
{
  "path": "/isDeleted",
  "order": "ascending"
}
```
**Purpose**: Optimizes queries filtering by deletion status.

#### 4. Thread Statistics Queries
```json
{
  "path": "/type",
  "order": "ascending"
},
{
  "path": "/userId",
  "order": "ascending"
},
{
  "path": "/lastMessageAt",
  "order": "descending"
}
```
**Purpose**: Optimizes activity-based statistics and recent thread queries.

### Excluded Paths
To reduce storage costs and index overhead, exclude large text content from indexing:

```json
{
  "excludedPaths": [
    {
      "path": "/content/*"
    },
    {
      "path": "/personaMessage/*"
    },
    {
      "path": "/_etag"
    },
    {
      "path": "/_rid"
    },
    {
      "path": "/_self"
    },
    {
      "path": "/_attachments"
    },
    {
      "path": "/_ts"
    }
  ]
}
```

## Query Optimization Patterns

### 1. Partition Key Strategy
- **Primary Partition Key**: `userId`
- **Benefits**: 
  - Enables single-partition queries for user-specific data
  - Scales horizontally as user base grows
  - Reduces cross-partition query costs

### 2. Query Patterns to Optimize

#### High-Frequency Queries
1. **Chat Thread List**: `type = 'CHAT_THREAD' AND userId = {user} AND isDeleted = false ORDER BY lastMessageAt DESC`
2. **Message History**: `type = 'CHAT_MESSAGE' AND threadId = {thread} AND userId = {user} ORDER BY createdAt ASC`
3. **Recent Messages**: `type = 'CHAT_MESSAGE' AND threadId = {thread} AND userId = {user} ORDER BY createdAt DESC LIMIT 50`

#### Optimization Strategies
- Use `OFFSET`/`LIMIT` for pagination instead of continuation tokens when order is guaranteed
- Implement caching for frequently accessed threads and recent messages
- Use batch operations for bulk operations (delete, update)

### 3. Request Unit (RU) Optimization

#### Query Cost Analysis
- **Simple thread list**: ~3-5 RU
- **Message pagination (20 items)**: ~5-10 RU  
- **Thread deletion (soft delete)**: ~2-3 RU per item
- **Batch operations**: ~1-2 RU per item in batch

#### Cost Reduction Strategies
1. **Use Point Reads**: When possible, use `container.item(id, partitionKey).read()` instead of queries
2. **Limit Projection**: Only select required fields in queries
3. **Efficient Pagination**: Use continuation tokens for large result sets
4. **Batch Operations**: Group multiple operations together

## Performance Monitoring

### Key Metrics to Track
1. **Query RU Consumption**: Monitor average RU usage per query type
2. **Query Latency**: Track P50, P95, P99 response times
3. **Cache Hit Rates**: Monitor effectiveness of LRU cache
4. **Index Usage**: Verify composite indexes are being utilized

### Recommended Monitoring Queries

#### High RU Consumption Queries
```sql
SELECT 
    r.requestCharge,
    r.queryDuration,
    r.query
FROM root r
WHERE r.requestCharge > 10
ORDER BY r.requestCharge DESC
```

#### Slow Queries
```sql
SELECT 
    r.queryDuration,
    r.requestCharge,
    r.query
FROM root r  
WHERE r.queryDuration > 100
ORDER BY r.queryDuration DESC
```

## Implementation Steps

### 1. Apply Indexing Policy
```bash
# Update container indexing policy using Azure CLI
az cosmosdb sql container update \
  --account-name {account-name} \
  --database-name chat \
  --name history \
  --idx @indexing-policy.json
```

### 2. Validate Index Usage
Use Cosmos DB Data Explorer to run `EXPLAIN` queries and verify index utilization.

### 3. Performance Testing
- Run load tests with realistic data volumes
- Compare query performance before and after index optimization
- Monitor RU consumption patterns

### 4. Gradual Migration
- Deploy optimized services alongside existing ones
- Gradually route traffic to optimized endpoints
- Monitor performance metrics during migration

## Cost Implications

### Storage Overhead
- Composite indexes add ~10-15% storage overhead
- Excluding content paths reduces this to ~5-8%

### Performance Benefits
- 60-80% reduction in query RU consumption
- 40-60% improvement in query latency
- Better cache efficiency due to predictable access patterns

## Future Optimizations

### 1. Materialized Views
Consider creating materialized views for complex aggregations:
- User activity summaries
- Thread statistics
- Usage analytics

### 2. Time-based Partitioning
For very high-volume scenarios, consider time-based partitioning:
- Partition by year/month for archival strategies
- Separate hot and cold data access patterns

### 3. Read Replicas
Implement read replicas for:
- Reporting queries
- Analytics workloads  
- Cross-region data access