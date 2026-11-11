# Rust read-only Provider Component

This API v3 example implements the frozen `yaqmc:provider@0.1.0/provider`
world. It exposes deterministic search, song, album, and artist responses and
requests no network, account, filesystem, environment, or process access.

Build the cross-platform Component with the repository-pinned Rust guest
dependency:

```bash
rustup target add wasm32-wasip2
npm run provider:catalog
npm run provider:catalog
```

The build command writes `component/provider.wasm`; the pack command also writes
`plugins/packages/dev.yaqmc.example.catalog-1.0.0.yaqmc-plugin`. The
generated Component runs unchanged on supported Windows and Linux architectures;
it contains no native DLL, shared object, or executable.
