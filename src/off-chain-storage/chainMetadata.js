import { createEnhancedClient } from './utils';

const chainMetadataTable = process.env.CHAIN_METADATA_TABLE_NAME;

const { client } = createEnhancedClient();

export async function getBlockHeight(key) {
  const data = await client
    .get({
      TableName: chainMetadataTable,
      Key: { key },
      AttributesToGet: ['blockHeight'],
    })
    .promise();

  return data.Item?.blockHeight ?? 0;
}

export async function updateBlockHeight({ key, blockHeight }) {
  const data = await client
    .put({
      TableName: chainMetadataTable,
      Item: { key, blockHeight },
    })
    .promise();

  return data.Item;
}
