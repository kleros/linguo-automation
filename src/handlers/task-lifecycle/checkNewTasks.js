import { map } from 'ramda';
import { getBlockHeight, updateBlockHeight } from '~/off-chain-storage/chainMetadata';
import { saveTasks } from '~/off-chain-storage/tasks';
import { getLatestBlockNumber } from '~/shared/web3';

export default async function checkNewTasks({ linguoOnChainApi }) {
  const [fromBlock, toBlock] = await Promise.all([getBlockHeight('NEW_TASKS'), getLatestBlockNumber()]);

  const newTasks = await linguoOnChainApi.fetchNewTasks({ fromBlock, toBlock });

  const stats = {
    data: map(
      ({ contractAddress, id, status, deadline }) => ({
        contractAddress,
        id,
        status,
        deadline,
      }),
      newTasks
    ),
    fromBlock,
    toBlock,
  };

  console.info(stats, 'Got new tasks from Linguo contracts');

  await saveTasks(newTasks);

  // Next run will start from the next block
  const blockHeight = toBlock + 1;
  await updateBlockHeight({ key: 'NEW_TASKS', blockHeight });
  console.info({ blockHeight }, 'Set NEW_TASKS block height');

  console.info(stats, 'Processed new tasks');

  return stats;
}
