import { map } from 'ramda';
import { updateBlockHeight } from '~/off-chain-storage/chainMetadata';
import { deleteAllTasks, saveTasks } from '~/off-chain-storage/tasks';
import web3 from '~/shared/web3';

export default async function fullSync({ linguoOnChainApi }) {
  await deleteAllTasks();

  const blockHeight = await web3.eth.getBlockNumber();
  const tasks = await linguoOnChainApi.fetchAllTasks();

  const stats = {
    data: map(({ contractAddress, id }) => `${contractAddress}/${id}`, tasks),
  };

  console.info(stats, 'Got tasks from Linguo contracts');

  await saveTasks(tasks);
  await updateBlockHeight({ key: 'FULL_SYNC', blockHeight });

  console.info({ blockHeight }, 'Set FULL_SYNC block height');

  console.info(stats, 'Processed all tasks');

  return stats;
}
