# Request a new Kafka topic

Topics are managed as code.

## Steps

1. Open a PR to `infra/kafka/topics.yaml` with the topic name, partition count, and retention.
2. Names follow `<domain>.<entity>`, for example `orders.created`.
3. Default retention is 7 days unless you justify more; the Data team must approve the PR.

## Gotchas

Partition counts can only be increased later, never decreased, so start small.
