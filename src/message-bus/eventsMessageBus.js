import { SNS } from 'aws-sdk';
const params = process.env.IS_LOCAL
  ? {
      endpoint: 'http://localhost:4002',
    }
  : {};

const sns = new SNS(params);

const EVENTS_TOPIC_ARN = process.env.EVENTS_TOPIC_ARN;

export async function publish(event) {
  return await sns
    .publish({
      TopicArn: EVENTS_TOPIC_ARN,
      Message: JSON.stringify(event),
      MessageGroupId: event.address,
      MessageDeduplicationId: `${event.address}/${event.blockNumber}/${event.transactionIndex}/${event.logIndex}`,
      MessageAttributes: {
        address: {
          DataType: 'String',
          StringValue: event.address,
        },
        event: {
          DataType: 'String',
          StringValue: event.event,
        },
        blockNumber: {
          DataType: 'Number',
          StringValue: String(event.blockNumber),
        },
      },
    })
    .promise();
}
