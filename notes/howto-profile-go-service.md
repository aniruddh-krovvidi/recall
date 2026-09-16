# Profile a Go service

Every Go service can expose pprof on a separate port.

## Steps

1. Set `PPROF_ADDR=:6060` on the pod and restart it.
2. Collect a CPU profile with `go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30`.
3. Open a flame graph with `go tool pprof -http=:8081 <profile-file>`.

## Gotchas

Do not leave `PPROF_ADDR` set in production for more than the profiling session.
