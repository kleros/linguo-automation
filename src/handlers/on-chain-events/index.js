import checkEventsHandler from './checkEvents';
import { createApiFacade } from '~/linguo-api';
import { getDefaultAccount } from '~/shared/account';

const apiPromise = getDefaultAccount().then(
  async ({ privateKey, address }) =>
    await createApiFacade({
      account: {
        privateKey,
        address,
      },
    })
);

export async function checkEvents(event) {
  await checkEventsHandler({ linguoOnChainApi: await apiPromise }, event);
}
