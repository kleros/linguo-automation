import { ascend, map, pick, prop, sortWith } from 'ramda';
import { publish } from '~/message-bus';
import { getBlockHeight, updateBlockHeight } from '~/off-chain-storage/chainMetadata';
import * as P from '~/shared/promise';
import { getLatestBlockNumber } from '~/shared/web3';

export default async function checkEvents({ linguoOnChainApi }) {
  const [fromBlock, toBlock] = await Promise.all([getBlockHeight('EVENTS'), getLatestBlockNumber()]);
  const events = preserveBlockOrder(await linguoOnChainApi.fetchAllEvents({ fromBlock, toBlock }));

  const data = map(
    pick(['address', 'blockNumber', 'event', 'returnValues', 'transactionHash', 'transactionIndex', 'logIndex']),
    events
  );

  const stats = JSON.stringify({
    data,
    fromBlock,
    toBlock,
  });

  console.info(stats, 'Got new events from Linguo contracts');

  await P.mapSeries(publish, data);

  // Next run will start from the next block
  const blockHeight = toBlock + 1;
  await updateBlockHeight({ key: 'EVENTS', blockHeight });
  console.info({ blockHeight }, 'Set EVENTS block height');

  console.info(stats, 'Processed new tasks');

  return {
    data,
    fromBlock,
    toBlock,
  };
}

const preserveBlockOrder = sortWith([
  ascend(prop('blockNumber')),
  ascend(prop('transactionIndex')),
  ascend(prop('logIndex')),
]);
