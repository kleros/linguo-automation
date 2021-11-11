# Linguo Automation

A suite of automation utilities for Linguo as serverless functions (AWS Lambda), that will:

- Watch on-chain events regarding all Linguo contracts in a timely fashion.
- Advance task state through the known task life-cycle.
- Securely store and retrieve notification settings for users.
- Send e-mail notifications for users based on on-chain events.

## Deploy

This serverless application is composed of 4 stages, namely:

- `kovan` (DEPRECATED)
- `mainnet` (DEPRECATED)
- `sokol`
- `xdai`

As the names probably give away, each stage is wired into an specific Ethereum network.

To deploy all functions for a given stage at once, run:

```sh
yarn deploy:<stage> # e.g.: yarn deploy:mainnet
```

The process might take a while.

## Contributing

### Removing the deprecated stages

Once Linguo on Mainnet is sunset, one can safely remove the `mainnet` stage to save up some AWS costs by running:

```sh
yarn sls destroy --stage mainnet
```
