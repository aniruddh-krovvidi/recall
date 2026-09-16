# Code review guidelines

Every change to a production repository goes through a pull request.

## Approvals

At least one approval from a listed code owner is required. Documentation-only changes may be self-merged after CI passes; everything else needs a second person.

## Size and turnaround

Pull requests over 400 changed lines should be split unless they are generated code. Reviewers are expected to respond within one business day; if you cannot, say so on the PR so the author can find someone else.

## What to look for

Correctness first, then tests, then readability. Style nits should be left as suggestions, not blockers, because the formatter already enforces layout.
