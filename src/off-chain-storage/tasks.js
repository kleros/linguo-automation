import { compose, map, pick } from 'ramda';
import { buildKeyConditionExpression, buildSetUpdateExpression, createEnhancedClient } from './utils';

const { client, batchWrite } = createEnhancedClient();

const tasksTable = process.env.TASKS_TABLE_NAME;

const extractStoredData = pick(['contractAddress', 'id', 'status', 'deadline']);

export async function saveTasks(tasks) {
  const createPutRequest = item => ({
    PutRequest: {
      Item: item,
    },
  });

  const createBatchItem = compose(createPutRequest, extractStoredData);

  return compose(batchWrite(tasksTable), map(createBatchItem))(tasks);
}

export async function fetchAllTaskIds() {
  const data = await client
    .scan({
      TableName: tasksTable,
      ProjectionExpression: 'id, contractAddress',
    })
    .promise();

  return data.Items;
}

export async function deleteAllTasks() {
  const createDeleteRequest = item => ({
    DeleteRequest: {
      Key: item,
    },
  });

  const taskIds = await fetchAllTaskIds();

  if (taskIds.length === 0) {
    return;
  }

  return compose(batchWrite(tasksTable), map(createDeleteRequest))(taskIds);
}

export async function fetchTasksByStatus(status) {
  const data = await client
    .query({
      TableName: tasksTable,
      IndexName: 'byStatus',
      ...buildKeyConditionExpression({ status }),
    })
    .promise();

  return data.Items;
}

export async function updateTask({ contractAddress, id, ...attrs }) {
  const data = await client
    .update({
      TableName: tasksTable,
      Key: {
        contractAddress,
        id,
      },
      ReturnValues: 'ALL_NEW',
      ...buildSetUpdateExpression(extractStoredData(attrs)),
    })
    .promise();

  return data.Attributes;
}

export async function removeTask({ contractAddress, id }) {
  const data = await client
    .delete({
      TableName: tasksTable,
      Key: {
        contractAddress,
        id,
      },
      ReturnValues: 'ALL_OLD',
    })
    .promise();

  return data.Attributes;
}
