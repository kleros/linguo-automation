import {
  andThen,
  cond,
  filter,
  fromPairs,
  isEmpty,
  map,
  mergeAll,
  pipeWith,
  pluck,
  reduceBy,
  tap,
  toPairs,
} from 'ramda';
import TaskStatus from '~/entities/TaskStatus';
import { fetchTasksByStatus, removeTask } from '~/off-chain-storage/tasks';
import * as P from '~/shared/promise';

const asyncPipe = pipeWith((f, res) => andThen(f, P.resolve(res)));

export default async function checkResolvedTasks({ linguoOnChainApi }) {
  async function fetchHasDispute(task) {
    const { contractAddress, id } = task;
    return linguoOnChainApi.fetchHasDispute(contractAddress, id);
  }

  async function fetchOnChainCounterpart(offChainTask) {
    const { contractAddress, id } = offChainTask;

    const [onChainTask, hasDispute] = await await Promise.all([
      linguoOnChainApi.fetchTaskById(contractAddress, id),
      fetchHasDispute(offChainTask),
    ]);
    const pendingWithdraws = hasDispute
      ? await linguoOnChainApi.fetchAllContributorsWithPendingWithdraws(contractAddress, id)
      : {};

    return [
      offChainTask,
      mergeAll([
        offChainTask,
        onChainTask,
        {
          hasDispute,
          pendingWithdraws,
        },
      ]),
    ];
  }

  async function batchWithdrawFeesAndRewards(task) {
    const { contractAddress, id, pendingWithdraws } = task;

    const logResult = map(
      tap(p => {
        if (p.status === 'fulfilled') {
          const [beneficiary, amount] = p.value;
          console.info(
            {
              id: `${contractAddress}/${id}`,
              beneficiary,
              withdraw: amount,
            },
            'Successfully withdrew fees and rewards'
          );
        } else {
          console.warn(
            {
              id: `${contractAddress}/${id}`,
              error: p.reason.message,
              ...p.reason.context,
            },
            'Failed to withdraw fees and rewards'
          );
        }
      })
    );

    const withdrawAllFeesAndRewards = async ([beneficiary, amount]) => {
      try {
        await linguoOnChainApi.withdrawAllFeesAndRewards(contractAddress, id, beneficiary);
        return [beneficiary, amount];
      } catch (err) {
        return Object.create(err, {
          context: {
            value: { beneficiary, amount },
          },
        });
      }
    };

    const successfulWithdraws = await asyncPipe([
      toPairs,
      map(withdrawAllFeesAndRewards),
      P.allSettled,
      logResult,
      filter(p => p.status === 'fulfilled'),
      pluck('value'),
      fromPairs,
    ])(pendingWithdraws);

    return {
      ...task,
      successfulWithdraws,
    };
  }

  const hasPendingWithdraws = ([_, { pendingWithdraws }]) => !isEmpty(pendingWithdraws);
  const submitBatchWithdrawTx = asyncPipe([
    ([_, onChainTask]) => onChainTask,
    batchWithdrawFeesAndRewards,
    task => ({
      action: 'WITHDRAW_FEES_AND_REWARDS_SUBMITTED',
      payload: task,
    }),
  ]);

  const removeOffchainTaskCache = asyncPipe([
    ([_, onChainTask]) => onChainTask,
    removeTask,
    task => ({
      action: 'OFFCHAIN_CACHE_REMOVED',
      payload: task,
    }),
  ]);

  const pipeline = asyncPipe([
    fetchOnChainCounterpart,
    cond([
      [hasPendingWithdraws, submitBatchWithdrawTx],
      [() => true, removeOffchainTaskCache],
    ]),
  ]);

  const resolvedTasks = await fetchTasksByStatus(TaskStatus.Resolved);

  console.info(
    { data: map(({ contractAddress, id }) => `${contractAddress}/${id}`, resolvedTasks) },
    'Fetched resolved tasks'
  );

  const results = await P.allSettled(map(pipeline, resolvedTasks));

  const groupTaskIdsOrErrorMessage = (acc, r) => {
    if (r.status === 'rejected') {
      return acc.concat(r.reason?.message);
    }

    const { contractAddress, id } = r.value.payload ?? {};
    return acc.concat(`${contractAddress}/${id}`);
  };
  const toTag = r => (r.status === 'rejected' ? 'FAILURE' : r.value.action);
  const stats = reduceBy(groupTaskIdsOrErrorMessage, [], toTag, results);

  console.info(stats, 'Processed resolved tasks');

  return stats;
}
