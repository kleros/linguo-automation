import {
  compose,
  evolve,
  filter,
  fromPairs,
  into,
  map,
  mergeRight,
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

export default function createApiInstance({ linguo, batchSend }) {
  const contractAddress = linguo.options.address;

  async function fetchAllTasks() {
    const count = Number(await linguo.methods.getTaskCount().call());

    const allTasks = await P.allSettled(map(fetchTaskWithMetadataById, range(0, count)));
    const onlyFulfilled = compose(filter(propEq('status', 'fulfilled')), map(prop('value')));
    return into([], onlyFulfilled, allTasks);
  }

  async function fetchNewTasks({ fromBlock = 0, toBlock = 'latest' }) {
    const events = await _getPastEvents(linguo, 'TaskCreated', { fromBlock, toBlock });

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
    const events = await _getPastEvents(linguo, 'TranslationChallenged', { filter: { _taskID: String(id) } });
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

  async function fetchAllContributorsWithPendingWithdraws(id) {
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

    return ruling;
  }

  async function _fetchAppealContributors(id) {
    // TODO: use AppealContribution event after upgrading Linguo version to obtain this.
    const taskId = String(id);

    const { status } = await fetchTaskById(id);
    if (![TaskStatus.DisputeCreated, TaskStatus.Resolved].includes(Number(status))) {
      return {
        [TaskParty.Translator]: [],
        [TaskParty.Challenger]: [],
      };
    }

    const eventFixtures = [
      { _taskID: taskId, _contributor: '0xceB4c079Dd21494E0bc99DA732EAdf220b727389', _party: 1 },
      { _taskID: taskId, _contributor: '0xA3eA2B441Ed9698E3053ec8848B69E9ce5f25158', _party: 1 },
      { _taskID: taskId, _contributor: '0xBdB4A1d8D0F0c228519828630379A1223666dcba', _party: 1 },
      { _taskID: taskId, _contributor: '0xBEC2BfE740EEE9FA9A1E08aD0579188CF3cc0758', _party: 1 },
      { _taskID: taskId, _contributor: '0xceB4c079Dd21494E0bc99DA732EAdf220b727389', _party: 2 },
      { _taskID: taskId, _contributor: '0xA3eA2B441Ed9698E3053ec8848B69E9ce5f25158', _party: 2 },
      { _taskID: taskId, _contributor: '0xBdB4A1d8D0F0c228519828630379A1223666dcba', _party: 2 },
      { _taskID: taskId, _contributor: '0xBEC2BfE740EEE9FA9A1E08aD0579188CF3cc0758', _party: 2 },
    ];

    const groupUniqueContributors = (set, { _contributor }) => set.add(_contributor);
    const contributorSetsByParty = reduceBy(groupUniqueContributors, new Set(), prop('_party'), eventFixtures);

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

  async function _getPastEvents(contract, eventName, { filter, fromBlock = 0, toBlock = 'latest' } = {}) {
    const events = await contract.getPastEvents(eventName, {
      fromBlock,
      toBlock,
      filter,
    });

    if (events.some(({ event }) => event === undefined)) {
      console.info({ eventName, filter, events }, 'Failed to get log values for event');
      throw new Error('Failed to get log values for event');
    }

    return events;
  }

  return {
    fetchAllTasks,
    fetchNewTasks,
    fetchTaskWithMetadataById,
    fetchTaskById,
    fetchReviewTimeout,
    fetchHasDispute,
    fetchAllContributorsWithPendingWithdraws,
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
