import { andThen, compose, curry, flatten, map, omit, pick, values } from 'ramda';
import * as P from '~/shared/promise';
import { createApiInstancesByAddress } from './apiInstancesByAddress';

const publicApiSkeleton = {
  // Methods bellow target all contracts
  fetchAllTasks() {},
  fetchNewTasks() {},
  fetchAllEvents() {},

  // Methods bellow target a specific contract

  /* eslint-disable no-unused-vars */
  fetchTaskWithMetadataById(contractAddress, id) {},
  fetchTaskById(contractAddress, id) {},
  fetchReviewTimeout(contractAddress) {},
  fetchTaskHasDispute(contractAddress, id) {},
  fetchAllContributorsWithPendingWithdrawals(contractAddress, id) {},
  reimburseRequester(contractAddress, id) {},
  acceptTranslation(contractAddress, id) {},
  withdrawAllFeesAndRewards(contractAddress, id, beneficiary) {},
  /* eslint-enable */
};

const createProxy = curry((handler, target) => new Proxy(target, handler));

export default async function createApiFacade({ account }) {
  const apiInstances = await createApiInstancesByAddress({ account });
  const apiInstancesList = values(apiInstances);

  const callAllContractsAndMergeResultsHandler = {
    apply: (target, thisArg, args) => {
      return compose(
        andThen(flatten),
        P.all,
        map(instance => instance[target.name].apply(instance, args))
      )(apiInstancesList);
    },
  };

  const deriveContractFromParamsHandler = {
    apply: (target, thisArg, args) => {
      const [contractAddress, ...restArgs] = args;

      const instance = apiInstances[contractAddress];
      if (!instance) {
        throw new Error(`Cannot find Linguo contract with address ${contractAddress}`);
      }

      return instance[target.name].apply(instance, restArgs);
    },
  };

  const callAllMethods = ['fetchAllTasks', 'fetchNewTasks', 'fetchAllEvents'];

  const { fetchAllTasks, fetchNewTasks, fetchAllEvents } = compose(
    map(createProxy(callAllContractsAndMergeResultsHandler)),
    pick(callAllMethods)
  )(publicApiSkeleton);

  const remainingMethods = compose(
    map(createProxy(deriveContractFromParamsHandler)),
    omit(callAllMethods)
  )(publicApiSkeleton);

  return { fetchAllTasks, fetchNewTasks, fetchAllEvents, ...remainingMethods };
}
