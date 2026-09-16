# Use the devbox CLI

devbox gives every engineer a cloud development VM.

## Steps

1. Run `devbox up` to create a VM with 4 vCPUs and 16 GB of memory.
2. Run `devbox ssh` to connect, or `devbox sync` to mirror your local checkout.
3. The VM auto-stops after 2 hours idle; `devbox up` resumes it with disk intact.

## Gotchas

A `devbox destroy` deletes the disk; commit and push before destroying.
