# Mortality Service Usage Guide

## Overview

The MortalityService provides functions to compute updated chicks count by subtracting total mortality from initial count.

## Functions

### 1. `computeChicksCount(batchId, userId)`

Computes the updated chicks count for a specific batch.

**Parameters:**

- `batchId` (string): The batch ID to compute for
- `userId` (string, optional): The user ID for filtering

**Returns:**

```javascript
{
  "batchId": "batch123",
  "initialCount": 100,
  "totalMortality": 15,
  "chicksCount": 85
}
```

**Example Usage:**

```javascript
import { computeChicksCount } from "../services/MortalityService";

// In a component or function
const fetchBatchData = async () => {
  try {
    const result = await computeChicksCount("batch123", currentUser.uid);
    console.log(`Batch ${result.batchId}:`);
    console.log(`Initial Count: ${result.initialCount}`);
    console.log(`Total Mortality: ${result.totalMortality}`);
    console.log(`Current Chicks Count: ${result.chicksCount}`);
  } catch (error) {
    console.error("Error:", error);
  }
};
```

### 2. `computeAllBatchesChicksCount(userId)`

Computes chicks count for all batches belonging to a user.

**Parameters:**

- `userId` (string): The user ID

**Returns:** Array of batch objects

```javascript
[
  {
    batchId: "batch123",
    initialCount: 100,
    totalMortality: 15,
    chicksCount: 85,
  },
  {
    batchId: "batch456",
    initialCount: 50,
    totalMortality: 5,
    chicksCount: 45,
  },
];
```

**Example Usage:**

```javascript
import { computeAllBatchesChicksCount } from "../services/MortalityService";

const fetchAllBatches = async () => {
  try {
    const batches = await computeAllBatchesChicksCount(currentUser.uid);
    batches.forEach((batch) => {
      console.log(
        `Batch ${batch.batchId}: ${batch.chicksCount} chicks remaining`
      );
    });
  } catch (error) {
    console.error("Error:", error);
  }
};
```

### 3. `getMortalityLogs(batchId)`

Retrieves all mortality log entries for a specific batch.

**Parameters:**

- `batchId` (string): The batch ID

**Returns:** Array of mortality log objects

```javascript
[
  {
    id: "log1",
    batchId: "batch123",
    mortalityCount: 5,
    mortalityDate: Timestamp,
    userId: "user123",
    createdAt: Timestamp,
  },
  {
    id: "log2",
    batchId: "batch123",
    mortalityCount: 10,
    mortalityDate: Timestamp,
    userId: "user123",
    createdAt: Timestamp,
  },
];
```

**Example Usage:**

```javascript
import { getMortalityLogs } from "../services/MortalityService";

const fetchLogs = async () => {
  try {
    const logs = await getMortalityLogs("batch123");
    console.log(`Total logs: ${logs.length}`);
    logs.forEach((log) => {
      console.log(`Date: ${log.mortalityDate}, Count: ${log.mortalityCount}`);
    });
  } catch (error) {
    console.error("Error:", error);
  }
};
```

## Integration Example in a React Component

```javascript
import React, { useState, useEffect } from "react";
import { computeChicksCount } from "../services/MortalityService";
import { auth } from "../config/firebaseconfig";

export default function BatchStats({ batchId }) {
  const [batchData, setBatchData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBatchData = async () => {
      try {
        const currentUser = auth.currentUser;
        if (currentUser && batchId) {
          const data = await computeChicksCount(batchId, currentUser.uid);
          setBatchData(data);
        }
      } catch (error) {
        console.error("Error loading batch data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadBatchData();
  }, [batchId]);

  if (loading) return <Text>Loading...</Text>;
  if (!batchData) return <Text>No data found</Text>;

  return (
    <View>
      <Text>Batch: {batchData.batchId}</Text>
      <Text>Initial Count: {batchData.initialCount}</Text>
      <Text>Total Mortality: {batchData.totalMortality}</Text>
      <Text>Current Count: {batchData.chicksCount}</Text>
    </View>
  );
}
```

## Database Schema

### brooderInfo Collection

```javascript
{
  userId: "user123",
  batchId: "batch123",
  chicksCount: 100,  // or initialCount
  // ... other fields
}
```

### mortality Collection

```javascript
{
  userId: "user123",
  batchId: "batch123",
  mortalityCount: 5,
  mortalityDate: Timestamp,
  createdAt: Timestamp
}
```

## Notes

- The function automatically sums all mortality logs for a batch
- If total mortality exceeds initial count, chicksCount is clamped to 0
- The service handles both `chicksCount` and `initialCount` field names in brooderInfo
- All functions include error handling and logging
