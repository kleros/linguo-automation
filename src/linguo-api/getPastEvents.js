export default async function _getPastEvents(contract, eventName, { filter, fromBlock = 0, toBlock = 'latest' } = {}) {
  return contract
    .getPastEvents(eventName, {
      fromBlock,
      toBlock,
      filter,
    })
    .then(events => {
      if (events.some(({ event }) => event === undefined)) {
        console.warn('Failed to get log values for event', { eventName, filter, events });
        throw new Error('Failed to get log values for event');
      }

      return events;
    });
}
