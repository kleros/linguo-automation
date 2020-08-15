import { DynamoDB } from 'aws-sdk';
import { compose, curry, flatten, join, map, mergeAll, pluck, splitEvery, toPairs } from 'ramda';
import * as P from '~/shared/promise';

const DYNAMO_DB_MAX_BATCH_SIZE = 25;
const splitBatches = splitEvery(DYNAMO_DB_MAX_BATCH_SIZE);

export function createEnhancedClient() {
  const params = process.env.IS_LOCAL
    ? {
        region: 'localhost',
        endpoint: 'http://localhost:8000',
      }
    : {};

  const client = new DynamoDB.DocumentClient(params);

  const writeSingleBatch = curry(function _writeSingleBatch(tableName, batch) {
    client
      .batchWrite({
        RequestItems: {
          [tableName]: batch,
        },
      })
      .promise();
  });

  const writeAllBatches = function _writeAllBatches(tableName, items) {
    return compose(P.all, map(writeSingleBatch(tableName)), splitBatches)(items);
  };

  const batchWrite = curry(async function _batchWrite(tableName, items) {
    return flatten(await writeAllBatches(tableName, items));
  });

  return {
    client,
    batchWrite,
  };
}

const buildGenericConditionExpression = curry(function _buildGenericConditionExpression(exprAttr, obj) {
  const buildDescriptors = compose(
    map(([key, value]) => ({
      expr: `#${key} = :${key}`,
      name: { [`#${key}`]: key },
      value: { [`:${key}`]: value },
    })),
    toPairs
  );
  const descriptors = buildDescriptors(obj);

  const buildExpression = compose(join(' and '), pluck('expr'));
  const buildAttrNames = compose(mergeAll, pluck('name'));
  const buildAttrValues = compose(mergeAll, pluck('value'));

  const expression = buildExpression(descriptors);
  const attrNames = buildAttrNames(descriptors);
  const attrValues = buildAttrValues(descriptors);

  return {
    [exprAttr]: expression,
    ExpressionAttributeNames: attrNames,
    ExpressionAttributeValues: attrValues,
  };
});

export const buildKeyConditionExpression = buildGenericConditionExpression('KeyConditionExpression');

export const buildConditionExpression = buildGenericConditionExpression('ConditionExpression');

export function buildSetUpdateExpression(obj) {
  const buildDescriptors = compose(
    map(([key, value]) => ({
      expr: `#${key} = :${key}`,
      name: { [`#${key}`]: key },
      value: { [`:${key}`]: value },
    })),
    toPairs
  );
  const descriptors = buildDescriptors(obj);

  const buildExpression = compose(expr => `SET ${expr}`, join(', '), pluck('expr'));
  const buildAttrNames = compose(mergeAll, pluck('name'));
  const buildAttrValues = compose(mergeAll, pluck('value'));

  const expression = buildExpression(descriptors);
  const attrNames = buildAttrNames(descriptors);
  const attrValues = buildAttrValues(descriptors);

  return {
    UpdateExpression: expression,
    ExpressionAttributeNames: attrNames,
    ExpressionAttributeValues: attrValues,
  };
}
