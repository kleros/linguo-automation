import dayjs from 'dayjs';
import { andThen, cond, isNil, map, mergeAll, pipeWith, reduceBy } from 'ramda';
import TaskStatus from '~/entities/TaskStatus';
import { fetchTasksByStatus, updateTask } from '~/off-chain-storage/tasks';
import * as P from '~/shared/promise';

const asyncPipe = pipeWith((f, res) => andThen(f, P.resolve(res)));

export default async function checkTasksAwaitingReview({ linguoOnChainApi }) {
  async function fetchReviewTimeout(task) {
    const { contractAddress } = task;

    if (isNil(fetchReviewTimeout.cache[contractAddress])) {
      const reviewTimeout = await linguoOnChainApi.fetchReviewTimeout(contractAddress);
      fetchReviewTimeout.cache[contractAddress] = reviewTimeout;
    }

    return fetchReviewTimeout.cache[contractAddress];
  }
  fetchReviewTimeout.cache = {};

  async function fetchOnChainCounterpart(offChainTask) {
    const { contractAddress, id } = offChainTask;

    const [onChainTask, reviewTimeout] = await Promise.all([
      linguoOnChainApi.fetchTaskById(contractAddress, id),
      fetchReviewTimeout(offChainTask),
    ]);

    return [offChainTask, mergeAll([offChainTask, onChainTask, { reviewTimeout }])];
  }

  async function acceptTranslation(task) {
    const { contractAddress, id } = task;
    await linguoOnChainApi.acceptTranslation(contractAddress, id);
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

  const reviewPeriodFinished = currentDate => ([_, { lastInteraction, reviewTimeout }]) => {
    const reviewDeadline = dayjs.unix(lastInteraction + reviewTimeout);
    return dayjs(currentDate).isAfter(reviewDeadline);
  };
  const submitAcceptTx = asyncPipe([
    ([_, onChainTask]) => onChainTask,
    acceptTranslation,
    task => ({
      action: 'ACCEPT_TRANSLATION_SUBMITTED',
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
      [reviewPeriodFinished(dayjs()), submitAcceptTx],
      [() => true, noop],
    ]),
  ]);

  const tasksAwaitingReview = await fetchTasksByStatus(TaskStatus.AwaitingReview);

  console.info(
    { data: map(({ contractAddress, id }) => `${contractAddress}/${id}`, tasksAwaitingReview) },
    'Fetched tasks awaiting review'
  );

  const results = await P.allSettled(map(pipeline, tasksAwaitingReview));

  const groupTaskIdsOrErrorMessage = (acc, r) => {
    if (r.status === 'rejected') {
      return acc.concat(r.reason?.message);
    }

    const { contractAddress, id } = r.value.payload ?? {};
    return acc.concat(`${contractAddress}/${id}`);
  };
  const toTag = r => (r.status === 'rejected' ? 'FAILURE' : r.value.action);
  const stats = reduceBy(groupTaskIdsOrErrorMessage, [], toTag, results);

  console.info(stats, 'Processed tasks awaiting review');

  return stats;
}
