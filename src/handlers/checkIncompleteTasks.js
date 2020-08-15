import dayjs from 'dayjs';
import { andThen, cond, flatten, map, mergeRight, pipeWith, reduceBy } from 'ramda';
import TaskStatus from '~/entities/TaskStatus';
import { fetchTasksByStatus, updateTask } from '~/off-chain-storage/tasks';
import * as P from '~/shared/promise';

const asyncPipe = pipeWith((f, res) => andThen(f, P.resolve(res)));

export default async function checkIncompleteTasks({ linguoOnChainApi }) {
  async function fetchOnChainCounterpart(offChainTask) {
    const { contractAddress, id } = offChainTask;
    return [offChainTask, mergeRight(offChainTask, await linguoOnChainApi.fetchTaskById(contractAddress, id))];
  }

  async function reimburseRequester(task) {
    const { contractAddress, id } = task;
    await linguoOnChainApi.reimburseRequester(contractAddress, id);
    return task;
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

  const taskExpired = currentDate => ([_, onChainTask]) => onChainTask.deadline < dayjs(currentDate).unix();
  const submitReimburseTx = asyncPipe([
    ([_, onChainTask]) => onChainTask,
    reimburseRequester,
    task => ({
      action: 'REIMBURSE_REQUEST_SUBMITTED',
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
      [taskExpired(dayjs()), submitReimburseTx],
      [() => true, noop],
    ]),
  ]);

  const incompleteTasks = flatten(
    await Promise.all([fetchTasksByStatus(TaskStatus.Created), fetchTasksByStatus(TaskStatus.Assigned)])
  );

  console.info(
    { tasks: map(({ contractAddress, id }) => `${contractAddress}/${id}`, incompleteTasks) },
    'Fetched incomplete tasks'
  );

  const results = await P.allSettled(map(pipeline, incompleteTasks));

  const groupTaskIdsOrErrorMessage = (acc, r) => {
    if (r.status === 'rejected') {
      return acc.concat(r.reason?.message);
    }

    const { contractAddress, id } = r.value.payload ?? {};
    return acc.concat(`${contractAddress}/${id}`);
  };
  const toTag = r => (r.status === 'rejected' ? 'FAILURE' : r.value.action);
  const stats = reduceBy(groupTaskIdsOrErrorMessage, [], toTag, results);

  console.info(stats, 'Processed incomplete tasks');

  return stats;
}
