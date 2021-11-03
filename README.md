# Linguo Automation

A suite of automation utilities for Linguo as serverless functions (AWS Lambda).

## Deploy

This serverless application is composed of 2 stages, namely:

- `kovan`
- `mainnet`

As the names probably give away, each stage is wired into an specific Ethereum network.

To deploy all functions for a given stage at once, ru:

```sh
yarn deploy:<stage> # e.g.: yarn deploy:mainnet
```

The process might take a while.

## Contributing

TODO.
