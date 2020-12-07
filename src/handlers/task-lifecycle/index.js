import fullSyncHandler from './fullSync';
import checkIncompleteTasksHandler from './checkIncompleteTasks';
import checkTasksAwaitingReviewHandler from './checkTasksAwaitingReview';
import checkNewTasksHandler from './checkNewTasks';
import checkTasksInDisputeHandler from './checkTasksInDispute';
import checkResolvedTasksHandler from './checkResolvedTasks';
import { createApiFacade } from '~/linguo-api';
import { getDefaultAccount } from '~/shared/account';

const apiPromise = getDefaultAccount().then(({ privateKey, address }) =>
  createApiFacade({
    account: {
      privateKey,
      address,
    },
  })
);

export async function fullSync(event) {
  await fullSyncHandler({ linguoOnChainApi: await apiPromise }, event);
}

export async function checkIncompleteTasks(event) {
  await checkIncompleteTasksHandler({ linguoOnChainApi: await apiPromise }, event);
}

export async function checkTasksAwaitingReview(event) {
  await checkTasksAwaitingReviewHandler({ linguoOnChainApi: await apiPromise }, event);
}

export async function checkNewTasks(event) {
  await checkNewTasksHandler({ linguoOnChainApi: await apiPromise }, event);
}

export async function checkTasksInDispute(event) {
  await checkTasksInDisputeHandler({ linguoOnChainApi: await apiPromise }, event);
}

export async function checkResolvedTasks(event) {
  await checkResolvedTasksHandler({ linguoOnChainApi: await apiPromise }, event);
}
