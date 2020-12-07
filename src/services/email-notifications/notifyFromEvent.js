import IArbitrator from '@kleros/erc-792/build/contracts/IArbitrator.json';
import Linguo from '@kleros/linguo-contracts/artifacts/Linguo.json';
import { flatten } from 'ramda';
import TimeAgo from 'javascript-time-ago';
import en from 'javascript-time-ago/locale/en';
import { generateTaskUrl } from '~/linguo-api';
import { getByAddress } from '~/off-chain-storage/userSettings';
import * as P from '~/shared/promise';
import sendgrid from '~/shared/sendgrid';
import web3 from '~/shared/web3';
import getUnsubscribeSignerAccount from './getUnsubscribeSignerAccount';

TimeAgo.addDefaultLocale(en);

export default async function notifyFromEvent(event) {
  const linguo = new web3.eth.Contract(Linguo.abi, event.address);

  let notifications;
  try {
    notifications = await handlers[event.event](linguo, event);
  } catch (err) {
    console.warn('Failed to process the event', { error: err, event });
    throw err;
  }

  try {
    await P.map(
      notification =>
        sendgrid.send({
          from: {
            name: 'Linguo',
            email: 'noreply@linguo.kleros.io',
          },
          ...notification,
        }),
      notifications
    );
  } catch (err) {
    return Object.create(err, {
      cause: {
        value: err.response?.body?.errors ?? new Error('Unknown error'),
        enumerable: true,
      },
    });
  }
}

const TaskParty = {
  Requester: -1,
  None: 0,
  Translator: 1,
  Challenger: 2,
};

const DisputeRuling = {
  RefusedToRule: 0,
  TranslationApproved: 1,
  TranslationRejected: 2,
};

const ResolveReason = {
  RequesterReimbursed: 'requester-reimbursed',
  TranslationAccepted: 'translation-accepted',
  DisputeSettled: 'dispute-settled',
};

const illustrationsByKey = {
  assigned: '//ipfs.kleros.io/ipfs/QmPfRE5CWWBB6U7yuYXpgNpb5BC2CpgbD1Wh8biNGCtycQ/avatar-task-assigned.svg',
  submitted: '//ipfs.kleros.io/ipfs/QmdupLw1Y2dn9MWis8Yi8b7bQyC2q4ViS1vzmfbgjWh5Z6/avatar-task-awaiting-review.svg',
  challenged: '//ipfs.kleros.io/ipfs/QmSSKTtD7z8Go1gqUywAZpQ7pvGorrQsD2VbcdVRchySGj/challenged.svg',
  accepted: '//ipfs.kleros.io/ipfs/QmPfJBZHmwLCQrQhu6Ey1KCYJDDD7VPnGWzynCs2c3FtoY/accepted.svg',
  'appeal.funding': '//ipfs.kleros.io/ipfs/QmRyGCzhcduood3qB54Nf3ihLTKy23zDqmtQnBvknoWZRZ/appeal-funding.svg',
  'appeal.issued': '//ipfs.kleros.io/ipfs/QmU2aTSMmu7GiTh48iWujxiHeZCotsUeQ8LugZSdRanNPk/appeal-issued.svg',
  'ruling.approved': '//ipfs.kleros.io/ipfs/QmNTA7ZJb1H7eJn8Yiau3c1nCNN9t3ZzAe1zRTM5EaWbv1/resolved-approved.svg',
  'ruling.rejected': '//ipfs.kleros.io/ipfs/Qmc6Mh47dSkNVG4aPPpWXeqSVbRBbPaGsob9ZmRbzPqFPo/resolved-rejected.svg',
  'ruling.none': '//ipfs.kleros.io/ipfs/QmWevfTH2gJVRfdm7HzuZoMEoURHNSwTSEFbJrnQ8yt1FY/refused-to-rule.svg',
  incomplete: '//ipfs.kleros.io/ipfs/QmU9h6E5S41nX3ZD2NUvkvT61p2mWnBH3rMBQPtkniS6Fk/incomplete.svg',
};

async function generateUnsubscribeUrl({ address, email }) {
  const signerAccount = await getUnsubscribeSignerAccount();

  const message = JSON.stringify({ address, email });
  const { signature } = await signerAccount.sign(message);
  const params = new URLSearchParams({ message, token: signature });

  return `${process.env.UNSUBSCRIBE_ENDPOINT}?${params}`;
}

const linguoEventHandlers = {
  async TaskAssigned(linguo, event) {
    const taskId = event.returnValues?._taskID;

    const { requester } = await linguo.methods.tasks(taskId).call();
    const settings = await getByAddress(requester);

    if (!settings?.emailPreferences?.requester?.assignment) {
      return [];
    }

    return [
      {
        to: settings.email,
        templateId: 'd-f17ff369120e4ca2a4003eefea4cbf5b',
        dynamicTemplateData: {
          subject: 'Your translation was assigned to a translator',
          text:
            'The translation task was assigned to a translator. You will be informed once the translation is delivered.',
          greeting: settings.fullName ? `Hi there, ${settings.fullName}` : 'Hi there!',
          taskUrl: generateTaskUrl({
            address: event.address,
            id: taskId,
          }),
          unsubscribe: await generateUnsubscribeUrl(settings),
          illustration: illustrationsByKey.assigned,
        },
      },
    ];
  },
  async TranslationSubmitted(linguo, event) {
    const taskId = event.returnValues?._taskID;

    const { requester } = await linguo.methods.tasks(taskId).call();

    const settings = await getByAddress(requester);

    if (!settings?.emailPreferences?.requester?.delivery) {
      return [];
    }

    const reviewTimeout = 1000 * Number(await linguo.methods.reviewTimeout().call());
    const timeAgo = new TimeAgo('en-US');
    const formattedReviewDeadline = timeAgo.format(reviewTimeout, {
      future: true,
      now: 0,
    });

    return [
      {
        to: settings.email,
        templateId: 'd-f17ff369120e4ca2a4003eefea4cbf5b',
        dynamicTemplateData: {
          subject: 'The translator delivered a translation',
          text: `The translation was delivered. The review phase ends <strong>${formattedReviewDeadline}</strong>. During this period anyone (including yourself) can challenge the translation if they think it does not fulfill the quality requirements.`,
          greeting: settings.fullName ? `Hi there, ${settings.fullName}` : 'Hi there!',
          taskUrl: generateTaskUrl({
            address: event.address,
            id: taskId,
          }),
          unsubscribe: await generateUnsubscribeUrl(settings),
          illustration: illustrationsByKey.submitted,
        },
      },
    ];
  },
  async TranslationChallenged(linguo, event) {
    const taskId = event.returnValues?._taskID;
    const taskUrl = generateTaskUrl({
      address: event.address,
      id: taskId,
    });

    const { requester } = await linguo.methods.tasks(taskId).call();
    const { [TaskParty.Translator]: translator } = await linguo.methods.getTaskParties(taskId).call();

    const illustration = illustrationsByKey.submitted;

    const handlersByParty = {
      async requester(address) {
        const settings = await getByAddress(address);

        if (!settings?.emailPreferences?.requester?.challenge) {
          return [];
        }

        return [
          {
            to: settings.email,
            templateId: 'd-f17ff369120e4ca2a4003eefea4cbf5b',
            dynamicTemplateData: {
              subject: 'A translation was challenged',
              text:
                'Someone challenged a translation you requested. The case is now being evaluated by specialized jurors on Kleros Court.',
              greeting: settings.fullName ? `Hi there, ${settings.fullName}` : 'Hi there!',
              taskUrl,
              unsubscribe: await generateUnsubscribeUrl(settings),
              illustration,
            },
          },
        ];
      },
      async translator(address) {
        const settings = await getByAddress(address);

        if (!settings?.emailPreferences?.translator?.challenge) {
          return [];
        }

        return [
          {
            to: settings.email,
            templateId: 'd-f17ff369120e4ca2a4003eefea4cbf5b',
            dynamicTemplateData: {
              subject: 'Your translation was challenged',
              text:
                'Someone challenged a translation you submitted. The case is now being evaluated by specialized jurors on Kleros Court.',
              greeting: settings.fullName ? `Hi there, ${settings.fullName}` : 'Hi there!',
              taskUrl,
              unsubscribe: await generateUnsubscribeUrl(settings),
              illustration,
            },
          },
        ];
      },
    };

    return flatten(await P.all([handlersByParty.requester(requester), handlersByParty.translator(translator)]));
  },
  async HasPaidAppealFee(linguo, event) {
    const taskId = event.returnValues?._taskID;

    const taskUrl = generateTaskUrl({
      address: event.address,
      id: taskId,
    });

    const task = await linguo.methods.tasks(taskId).call();
    const disputeId = task.disputeID;

    const internalHandlers = {
      async appealIssued(address, role) {
        const settings = await getByAddress(address);

        if (!settings?.emailPreferences?.[role]?.ruling) {
          return [];
        }

        return [
          {
            to: settings.email,
            templateId: 'd-f17ff369120e4ca2a4003eefea4cbf5b',
            dynamicTemplateData: {
              subject: 'An appeal was issued',
              text: `Case #${disputeId} has been appealed. Both parties have extra time to add evidence and a new round of jurors will be drawn.`,
              greeting: settings.fullName ? `Hi there, ${settings.fullName}` : 'Hi there!',
              taskUrl,
              unsubscribe: await generateUnsubscribeUrl(settings),
              illustration: illustrationsByKey['appeal.issued'],
            },
          },
        ];
      },
      async appealSideFunded(address, role) {
        const settings = await getByAddress(address);
        if (!settings?.emailPreferences?.[role]?.appealFunding) {
          return [];
        }

        const counterPartyRole = role === 'translator' ? 'challenger' : 'translator';

        return [
          {
            to: settings.email,
            templateId: 'd-f17ff369120e4ca2a4003eefea4cbf5b',
            dynamicTemplateData: {
              subject: '[Action Required] An appeal is in course',
              text: `The ${counterPartyRole} fully funded their side of the appeal. <strong>In order to not lose the case you must also fund yours</strong>.`,
              greeting: settings.fullName ? `Hi there, ${settings.fullName}` : 'Hi there!',
              taskUrl,
              unsubscribe: await generateUnsubscribeUrl(settings),
              illustration: illustrationsByKey['appeal.funded'],
            },
          },
        ];
      },
    };

    const currentParty = Number(event.returnValues?._party);
    const totalOfRounds = await linguo.methods.getNumberOfRounds(taskId).call();
    const currentRound = await linguo.methods.getRoundInfo(taskId, totalOfRounds - 1).call();

    const wasAppealIssued = currentRound.hasPaid[currentParty] === false;

    const requester = task.requester;
    const {
      [TaskParty.Translator]: translator,
      [TaskParty.Challenger]: challenger,
    } = await linguo.methods.getTaskParties(taskId).call();

    if (wasAppealIssued) {
      // Notify all
      return flatten(
        await P.all([
          requester === challenger ? P.resolve([]) : internalHandlers.appealIssued(requester, 'requester'),
          internalHandlers.appealIssued(translator, 'translator'),
          internalHandlers.appealIssued(challenger, 'challenger'),
        ])
      );
    } else {
      // Notify only the counter party
      const args = currentParty === TaskParty.Translator ? [challenger, 'challenger'] : [translator, 'translator'];
      return internalHandlers.appealSideFunded(...args);
    }
  },
  async TaskResolved(linguo, event) {
    const taskId = event.returnValues?._taskID;

    const handlersByReason = {
      async [ResolveReason.RequesterReimbursed]() {
        const illustration = illustrationsByKey.incomplete;

        const handlersByParty = {
          async requester(address, hasTranslator) {
            const settings = await getByAddress(address);

            if (!settings?.emailPreferences?.requester?.resolution) {
              return [];
            }

            return [
              {
                to: settings.email,
                templateId: 'd-f17ff369120e4ca2a4003eefea4cbf5b',
                dynamicTemplateData: {
                  subject: 'The deadline for your translation has passed',
                  text: hasTranslator
                    ? 'The translator failed to deliver the translation on time. You received your Requester Depoist back + the Translator Deposit.'
                    : 'No translator was interested in translating your content this time. You were fully reimbursed of your Requester Deposit. Requesting the same task again with a higher payout might draw more attention.',
                  greeting: settings.fullName ? `Hi there, ${settings.fullName}` : 'Hi there!',
                  taskUrl: generateTaskUrl({
                    address: event.address,
                    id: taskId,
                  }),
                  unsubscribe: await generateUnsubscribeUrl(settings),
                  illustration,
                },
              },
            ];
          },
          async translator(address) {
            const settings = await getByAddress(address);

            if (!settings?.emailPreferences?.translator?.resolution) {
              return [];
            }

            return [
              {
                to: settings.email,
                templateId: 'd-f17ff369120e4ca2a4003eefea4cbf5b',
                dynamicTemplateData: {
                  subject: 'You missed the deadline for a translation',
                  text:
                    'You did not deliver the translation in time. Your Translator Deposit was sent to the requester as a compensation.',
                  greeting: settings.fullName ? `Hi there, ${settings.fullName}` : 'Hi there!',
                  taskUrl: generateTaskUrl({
                    address: event.address,
                    id: taskId,
                  }),
                  unsubscribe: await generateUnsubscribeUrl(settings),
                  illustration,
                },
              },
            ];
          },
        };

        const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';

        const { requester } = await linguo.methods.tasks(taskId).call();
        const { [TaskParty.Translator]: translator } = await linguo.methods.getTaskParties(taskId).call();

        return flatten(
          await P.all([
            handlersByParty.requester(requester, translator !== ADDRESS_ZERO),
            handlersByParty.translator(translator),
          ])
        );
      },
      async [ResolveReason.TranslationAccepted]() {
        const illustration = illustrationsByKey.accepted;

        const handlersByParty = {
          async requester(address) {
            const settings = await getByAddress(address);

            if (!settings?.emailPreferences?.requester?.resolution) {
              return [];
            }

            return [
              {
                to: settings.email,
                templateId: 'd-f17ff369120e4ca2a4003eefea4cbf5b',
                dynamicTemplateData: {
                  subject: 'A translation task was accepted',
                  text:
                    'The translation was accepted without any challenges. Your Requester Deposit was sent to the translator.',
                  greeting: settings.fullName ? `Hi there, ${settings.fullName}` : 'Hi there!',
                  taskUrl: generateTaskUrl({
                    address: event.address,
                    id: taskId,
                  }),
                  unsubscribe: await generateUnsubscribeUrl(settings),
                  illustration,
                },
              },
            ];
          },
          async translator(address) {
            const settings = await getByAddress(address);

            if (!settings?.emailPreferences?.translator?.resolution) {
              return [];
            }

            return [
              {
                to: settings.email,
                templateId: 'd-f17ff369120e4ca2a4003eefea4cbf5b',
                dynamicTemplateData: {
                  subject: 'Your translation was accepted',
                  text: 'The translation was accepted without any challenges. You received your payment.',
                  greeting: settings.fullName ? `Hi there, ${settings.fullName}` : 'Hi there!',
                  taskUrl: generateTaskUrl({
                    address: event.address,
                    id: taskId,
                  }),
                  unsubscribe: await generateUnsubscribeUrl(settings),
                  illustration,
                },
              },
            ];
          },
        };

        const { requester } = await linguo.methods.tasks(taskId).call();
        const { [TaskParty.Translator]: translator } = await linguo.methods.getTaskParties(taskId).call();

        return flatten(await P.all([handlersByParty.requester(requester), handlersByParty.translator(translator)]));
      },
      async [ResolveReason.DisputeSettled]() {
        const task = await linguo.methods.tasks(taskId).call();
        const { ruling } = task;

        const illustration =
          Number(ruling) === 0
            ? illustrationsByKey['ruling.none']
            : Number(ruling) === 1
            ? illustrationsByKey['ruling.approved']
            : Number(ruling) === 2
            ? illustrationsByKey['ruling.rejected']
            : '';

        const taskUrl = generateTaskUrl({
          address: event.address,
          id: taskId,
        });

        const subjectsByRuling = {
          [DisputeRuling.RefusedToRule]: 'Final decision: jurors refused to rule about a translation',
          [DisputeRuling.TranslationApproved]: 'Final decision: jurors approved a translation',
          [DisputeRuling.TranslationRejected]: 'Final decision: jurors rejected a translation',
        };

        const handlersByParty = {
          async requester(address) {
            const settings = await getByAddress(address);
            if (!settings?.emailPreferences?.requester?.ruling) {
              return [];
            }

            const textsByRuling = {
              [DisputeRuling.RefusedToRule]: `The jurors refused to rule about the translation. You received your Requester Deposit back.`,
              [DisputeRuling.TranslationApproved]: `The jurors approved the translation. Your Requester Deposit was sent to the translator.`,
              [DisputeRuling.TranslationRejected]: `The jurors rejected the translation. You received your Requester Deposit back.`,
            };

            return [
              {
                to: settings.email,
                templateId: 'd-f17ff369120e4ca2a4003eefea4cbf5b',
                dynamicTemplateData: {
                  subject: subjectsByRuling[ruling],
                  text: textsByRuling[ruling],
                  greeting: settings.fullName ? `Hi there, ${settings.fullName}` : 'Hi there!',
                  taskUrl,
                  unsubscribe: await generateUnsubscribeUrl(settings),
                  illustration,
                },
              },
            ];
          },
          async translator(address) {
            const settings = await getByAddress(address);
            if (!settings?.emailPreferences?.translator?.ruling) {
              return [];
            }

            const textsByRuling = {
              [DisputeRuling.RefusedToRule]: `The jurors refused to rule about the translation. You received your Translator Deposit back.`,
              [DisputeRuling.TranslationApproved]: `The jurors approved the translation. You received your payment + the Challenger Deposit.`,
              [DisputeRuling.TranslationRejected]: `The jurors rejected the translation. Your Translator Deposit was sent to the challenger..`,
            };

            return [
              {
                to: settings.email,
                templateId: 'd-f17ff369120e4ca2a4003eefea4cbf5b',
                dynamicTemplateData: {
                  subject: subjectsByRuling[ruling],
                  text: textsByRuling[ruling],
                  greeting: settings.fullName ? `Hi there, ${settings.fullName}` : 'Hi there!',
                  taskUrl,
                  unsubscribe: await generateUnsubscribeUrl(settings),
                  illustration,
                },
              },
            ];
          },
          async challenger(address, challengerIsRequester) {
            const settings = await getByAddress(address);
            if (!settings?.emailPreferences?.challenger?.ruling) {
              return [];
            }

            const textsByRuling = {
              [DisputeRuling.RefusedToRule]: `The jurors refused to rule about the translation.${
                challengerIsRequester ? ' You received your Requester Deposit back.' : ''
              } `,
              [DisputeRuling.TranslationApproved]: `The jurors approved the translation. Your Requester Deposit${
                challengerIsRequester ? ' + your Challenger Deposit' : ''
              } was sent to the translator.`,
              [DisputeRuling.TranslationRejected]: `The jurors rejected the translation. You received back your Requester Deposit${
                challengerIsRequester ? ' + your Challenger Deposit' : ''
              } and also the Translator Deposit.`,
            };

            return [
              {
                to: settings.email,
                templateId: 'd-f17ff369120e4ca2a4003eefea4cbf5b',
                dynamicTemplateData: {
                  subject: subjectsByRuling[ruling],
                  text: textsByRuling[ruling],
                  greeting: settings.fullName ? `Hi there, ${settings.fullName}` : 'Hi there!',
                  taskUrl,
                  unsubscribe: await generateUnsubscribeUrl(settings),
                  illustration,
                },
              },
            ];
          },
        };

        const { requester } = task;
        const {
          [TaskParty.Translator]: translator,
          [TaskParty.Challenger]: challenger,
        } = await linguo.methods.getTaskParties(taskId).call();

        return flatten(
          await P.all([
            requester === challenger ? P.resolve([]) : handlersByParty.requester(requester),
            handlersByParty.translator(translator),
            handlersByParty.challenger(challenger, challenger === requester),
          ])
        );
      },
    };

    const reason = event.returnValues?._reason;
    return handlersByReason[reason]();
  },
};

const arbitratorEventHandlers = {
  async AppealPossible(_, event) {
    const disputeId = event.returnValues._disputeID;
    const address = event.returnValues._arbitrable;
    const linguo = new web3.eth.Contract(Linguo.abi, address);

    let taskId;
    let task;

    try {
      taskId = await linguo.methods.disputeIDtoTaskID(disputeId).call();
      task = await linguo.methods.tasks(taskId).call();
    } catch (err) {
      // Probably not a Linguo contract, so we just skip the event
      return [];
    }

    if (task.disputeID !== disputeId) {
      return [];
    }

    const taskUrl = generateTaskUrl({
      address: linguo.options.address,
      id: taskId,
    });

    const arbitrator = new web3.eth.Contract(IArbitrator.abi, await linguo.methods.arbitrator().call());
    const ruling = await arbitrator.methods.currentRuling(disputeId).call();

    let appealDeadlineAppendedText = '';
    try {
      const now = Date.now();
      const appealPeriod = await arbitrator.methods.appealPeriod(disputeId).call();
      const appealDeadline = new Date(appealPeriod.end * 1000).getTime();

      const timeAgo = new TimeAgo('en-US');
      const formattedAppealDeadline = timeAgo.format(appealDeadline, {
        future: true,
        now,
      });

      appealDeadlineAppendedText = ` Appeal period ends <strong>${formattedAppealDeadline}</strong>.`;
    } catch (err) {
      console.warn('Error getting the appeal deadline:', err);
    }

    const subjectsByRuling = {
      [DisputeRuling.RefusedToRule]: 'Juros refused to rule about a translation',
      [DisputeRuling.TranslationApproved]: 'Jurors approved a translation',
      [DisputeRuling.TranslationRejected]: 'Jurors rejected a translation',
    };

    const illustration =
      Number(ruling) === 0
        ? illustrationsByKey['ruling.none']
        : Number(ruling) === 1
        ? illustrationsByKey['ruling.approved']
        : Number(ruling) === 2
        ? illustrationsByKey['ruling.rejected']
        : '';

    const handlersByParty = {
      async requester(address) {
        const settings = await getByAddress(address);

        if (!settings?.emailPreferences?.requester?.ruling) {
          return [];
        }

        const textsByRuling = {
          [DisputeRuling.RefusedToRule]: `The jurors refused to rule about the translation.${appealDeadlineAppendedText}`,
          [DisputeRuling.TranslationApproved]: `The jurors approved the translation.${appealDeadlineAppendedText}`,
          [DisputeRuling.TranslationRejected]: `The jurors rejected the translation.${appealDeadlineAppendedText}`,
        };

        return [
          {
            to: settings.email,
            templateId: 'd-f17ff369120e4ca2a4003eefea4cbf5b',
            dynamicTemplateData: {
              subject: subjectsByRuling[ruling],
              text: textsByRuling[ruling],
              greeting: settings.fullName ? `Hi there, ${settings.fullName}` : 'Hi there!',
              taskUrl,
              unsubscribe: await generateUnsubscribeUrl(settings),
              illustration,
            },
          },
        ];
      },
      async translator(address) {
        const settings = await getByAddress(address);

        if (!settings?.emailPreferences?.translator?.ruling) {
          return [];
        }

        const textsByRuling = {
          [DisputeRuling.RefusedToRule]: `The jurors refused to rule about the translation.${
            appealDeadlineAppendedText && ` You can still appeal the decision.${appealDeadlineAppendedText}`
          }`,
          [DisputeRuling.TranslationApproved]: `The jurors approved the translation.${
            appealDeadlineAppendedText && ` The decision can still be appealed though.${appealDeadlineAppendedText}`
          }`,
          [DisputeRuling.TranslationRejected]: `The jurors rejected the translation.${
            appealDeadlineAppendedText && ` You can still appeal the decision.${appealDeadlineAppendedText}`
          }`,
        };

        return [
          {
            to: settings.email,
            templateId: 'd-f17ff369120e4ca2a4003eefea4cbf5b',
            dynamicTemplateData: {
              subject: subjectsByRuling[ruling],
              text: textsByRuling[ruling],
              greeting: settings.fullName ? `Hi there, ${settings.fullName}` : 'Hi there!',
              taskUrl,
              unsubscribe: await generateUnsubscribeUrl(settings),
              illustration,
            },
          },
        ];
      },
      async challenger(address) {
        const settings = await getByAddress(address);

        if (!settings?.emailPreferences?.challenger?.ruling) {
          return [];
        }

        const textsByRuling = {
          [DisputeRuling.RefusedToRule]: `The jurors refused to rule about the translation.${
            appealDeadlineAppendedText && `You can still appeal the decision.${appealDeadlineAppendedText}`
          }`,
          [DisputeRuling.TranslationApproved]: `The jurors approved the translation.${
            appealDeadlineAppendedText && ` You can still appeal the decision.${appealDeadlineAppendedText}`
          }`,
          [DisputeRuling.TranslationRejected]: `The jurors rejected the translation.${
            appealDeadlineAppendedText && ` The decision can still be appealed though.${appealDeadlineAppendedText}`
          }`,
        };

        return [
          {
            to: settings.email,
            templateId: 'd-f17ff369120e4ca2a4003eefea4cbf5b',
            dynamicTemplateData: {
              subject: subjectsByRuling[ruling],
              text: textsByRuling[ruling],
              greeting: settings.fullName ? `Hi there, ${settings.fullName}` : 'Hi there!',
              taskUrl,
              unsubscribe: await generateUnsubscribeUrl(settings),
              illustration,
            },
          },
        ];
      },
    };

    const requester = task.requester;
    const {
      [TaskParty.Translator]: translator,
      [TaskParty.Challenger]: challenger,
    } = await linguo.methods.getTaskParties(taskId).call();

    return flatten(
      await P.all([
        requester === challenger ? P.resolve([]) : handlersByParty.requester(requester),
        handlersByParty.translator(translator),
        handlersByParty.challenger(challenger),
      ])
    );
  },
};

const handlers = {
  ...linguoEventHandlers,
  ...arbitratorEventHandlers,
};
