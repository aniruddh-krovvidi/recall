# Restore an archived object from Glacier

Archived objects are not readable until restored.

## Steps

1. Run `glacierctl restore s3://bucket/path/to/object`; the command prints a request id.
2. Poll with `glacierctl status <request-id>`; restores take up to 4 hours.
3. The object stays in the hot tier for the configured hot-retention period after it lands.

## Gotchas

Bulk restores of more than 1,000 objects should be filed as a ticket to the Data team so they can batch them.
