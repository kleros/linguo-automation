import { andThen, cond, map, mergeRight, pipeWith, reduceBy } from 'ramda';
import TaskStatus from '~/entities/TaskStatus';
import { fetchTasksByStatus, updateTask } from '~/off-chain-storage/tasks';
import * as P from '~/shared/promise';

const asyncPipe = pipeWith((f, res) => andThen(f, P.resolve(res)));

export default async function checkTasksInDispute({ linguoOnChainApi }) {
  async function fetchOnChainCounterpart(offChainTask) {
    const { contractAddress, id } = offChainTask;
    return [offChainTask, mergeRight(offChainTask, await linguoOnChainApi.fetchTaskById(contractAddress, id))];
  }

  const taskStatusChanged = ([offChainTask, onChainTask]) => offChainTask.status !== onChainTask.status;
  const updateOffChainTask = asyncPipe([
    ([_, onChainTask]) => onChainTask,
    updateTask,
    task => ({
      action: 'STATUS_CHANGED',
      payload: task,
    }),
  ]);

  const noop = asyncPipe([
    ([_, onChainTask]) => onChainTask,
    task => ({
      action: 'NO_OP',
      payload: task,
    }),
  ]);

  const pipeline = asyncPipe([
    fetchOnChainCounterpart,
    cond([
      [taskStatusChanged, updateOffChainTask],
      [() => true, noop],
    ]),
  ]);

  const tasksInDispute = await fetchTasksByStatus(TaskStatus.DisputeCreated);

  console.info(
    { data: map(({ contractAddress, id }) => `${contractAddress}/${id}`, tasksInDispute) },
    'Fetched tasks in dispute'
  );

  const results = await P.allSettled(map(pipeline, tasksInDispute));

  const groupTaskIdsOrErrorMessage = (acc, r) => {
    if (r.status === 'rejected') {
      return acc.concat(r.reason?.message);
    }

    const { contractAddress, id } = r.value.payload ?? {};
    return acc.concat(`${contractAddress}/${id}`);
  };
  const toTag = r => (r.status === 'rejected' ? 'FAILURE' : r.value.action);
  const stats = reduceBy(groupTaskIdsOrErrorMessage, [], toTag, results);

  console.info(stats, 'Processed tasks in dispute');

  return stats;
}
