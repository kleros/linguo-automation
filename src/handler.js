import fullSyncHandler from './handlers/fullSync';
import checkIncompleteTasksHandler from './handlers/checkIncompleteTasks';
import checkTasksAwaitingReviewHandler from './handlers/checkTasksAwaitingReview';
import checkNewTasksHandler from './handlers/checkNewTasks';
import checkTasksInDisputeHandler from './handlers/checkTasksInDispute';
import checkResolvedTasksHandler from './handlers/checkResolvedTasks';
import { createApiFacade } from './linguo-api';
import { getDefaultAccount } from './shared/account';

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
