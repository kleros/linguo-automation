import {
  compose,
  evolve,
  filter,
  fromPairs,
  into,
  map,
  mergeRight,
  path,
  prop,
  propEq,
  range,
  reduceBy,
  reject,
} from 'ramda';
import DisputeRuling from '~/entities/DisputeRuling';
import TaskParty from '~/entities/TaskParty';
import TaskStatus from '~/entities/TaskStatus';
import archon from '~/shared/archon';
import * as P from '~/shared/promise';
import getPastEvents from './getPastEvents';

export default function createApiInstance({ linguo, batchSend }) {
  const contractAddress = linguo.options.address;

  async function fetchAllTasks() {
    const count = Number(await linguo.methods.getTaskCount().call());

    const allTasks = await P.allSettled(map(fetchTaskWithMetadataById, range(0, count)));
    const onlyFulfilled = compose(filter(propEq('status', 'fulfilled')), map(prop('value')));
    return into([], onlyFulfilled, allTasks);
  }

  async function fetchNewTasks({ fromBlock = 0, toBlock = 'latest' }) {
    const events = await getPastEvents(linguo, 'TaskCreated', { fromBlock, toBlock });

    const allNewTasks = await P.allSettled(
      map(
        compose(fetchTaskWithMetadataById, event => event.returnValues._taskID),
        events
      )
    );
    const onlyFulfilled = compose(filter(propEq('status', 'fulfilled')), map(prop('value')));

    return into([], onlyFulfilled, allNewTasks);
  }

  async function fetchTaskWithMetadataById(id) {
    const [task, metadata] = await Promise.all([
      fetchTaskById(id).then(data => {
        console.debug({ id: `${contractAddress}/${id}` }, 'Fetched task on-chain data');
        return data;
      }),
      _fetchTaskMetadata(id).then(data => {
        console.debug({ id: `${contractAddress}/${id}` }, 'Fetched task metadata');
        return data;
      }),
    ]);

    return {
      ...task,
      ...metadata,
    };
  }

  async function fetchTaskById(id) {
    const task = await linguo.methods.tasks(id).call();

    return normalizeTask({ contractAddress, id, ...task });
  }

  async function fetchReviewTimeout() {
    return Number(await linguo.methods.reviewTimeout().call());
  }

  async function fetchHasDispute(id) {
    const events = await getPastEvents(linguo, 'TranslationChallenged', { filter: { _taskID: String(id) } });
    return events.length > 0;
  }

  async function reimburseRequester(id) {
    return batchSend({
      args: [String(id)],
      method: linguo.methods.reimburseRequester,
      to: contractAddress,
    });
  }

  async function acceptTranslation(id) {
    return batchSend({
      args: [String(id)],
      method: linguo.methods.acceptTranslation,
      to: contractAddress,
    });
  }

  async function withdrawAllFeesAndRewards(id, beneficiary) {
    return batchSend({
      args: [beneficiary, String(id), '0', '0'],
      method: linguo.methods.batchRoundWithdraw,
      to: contractAddress,
    });
  }

  async function fetchAllContributorsWithPendingWithdrawals(id) {
    const allContributorsToWinner = await _fetchAllContributorsToWinner(id);
    const balancePairs = await Promise.all(
      map(async address => [address, await _fetchWithdrawableAmount(id, address)], allContributorsToWinner)
    );

    return compose(
      fromPairs,
      reject(([_, balance]) => balance === '0')
    )(balancePairs);
  }

  async function _fetchTaskMetadata(id) {
    const { metaEvidenceJSON } = await archon.arbitrable.getMetaEvidence(contractAddress, String(id));

    return normalizeTask({ contractAddress, id, ...metaEvidenceJSON.metadata });
  }

  async function _fetchAllContributorsToWinner(id) {
    const [ruling, contributorsByParty] = await Promise.all([_fetchFinalRuling(id), _fetchAppealContributors(id)]);

    if (ruling === DisputeRuling.RefusedToRule) {
      return [...new Set([...contributorsByParty[TaskParty.Translator], ...contributorsByParty[TaskParty.Challenger]])];
    }

    if (ruling === DisputeRuling.TranslationApproved) {
      return contributorsByParty[TaskParty.Translator];
    }

    if (ruling === DisputeRuling.TranslationRejected) {
      return contributorsByParty[TaskParty.Challenger];
    }
  }

  async function _fetchFinalRuling(id) {
    const hasDispute = await fetchHasDispute(id);
    if (!hasDispute) {
      throw new Error(`Task ${contractAddress}/${id} do not have a dispute.`);
    }

    const { ruling, status } = await fetchTaskById(id);
    if (status !== TaskStatus.Resolved) {
      throw new Error(`Task ${contractAddress}/${id} is not resolved yet.`);
    }

    return Number(ruling);
  }

  async function _fetchAppealContributors(id) {
    const { status } = await fetchTaskById(id);
    if (![TaskStatus.DisputeCreated, TaskStatus.Resolved].includes(Number(status))) {
      return {
        [TaskParty.Translator]: [],
        [TaskParty.Challenger]: [],
      };
    }

    const events = await getPastEvents(linguo, 'AppealContribution', { filter: { _taskID: String(id) } });

    const groupUniqueContributors = (set, event) => set.add(path(['returnValues', '_contributor'], event));
    const contributorSetsByParty = reduceBy(
      groupUniqueContributors,
      new Set(),
      path(['returnValues', '_party']),
      events
    );

    const defaultValues = {
      [TaskParty.Translator]: [],
      [TaskParty.Challenger]: [],
    };

    return compose(
      mergeRight(defaultValues),
      map(set => [...set])
    )(contributorSetsByParty);
  }

  async function _fetchWithdrawableAmount(id, beneficiary) {
    return linguo.methods.amountWithdrawable(id, beneficiary).call();
  }

  return {
    fetchAllTasks,
    fetchNewTasks,
    fetchTaskWithMetadataById,
    fetchTaskById,
    fetchReviewTimeout,
    fetchHasDispute,
    fetchAllContributorsWithPendingWithdrawals,
    reimburseRequester,
    acceptTranslation,
    withdrawAllFeesAndRewards,
  };
}

const normalizeTask = evolve({
  id: Number,
  submissionTimeout: Number,
  status: Number,
  lastInteraction: Number,
  disputeID: Number,
  ruling: Number,
  sumDeposit: Number,
});
