# Bump the base container image

All services build from a shared base image.

## Steps

1. Edit `BASE_IMAGE_TAG` in `build/base.env`.
2. Run `ok build --no-cache` locally to make sure the new base builds.
3. Harbor mirrors the new tag within 10 minutes of the upstream push.

## Gotchas

Base image bumps that change the glibc version need a note in the release channel.
