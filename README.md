# Graphene Studio

The standalone Graphene operator web app. Studio ships separately from the
server, connects to one or more installations over the public Management API,
and has both web and Electron (desktop) builds.

The user-facing features, the workspace model and the current limits are in the
[Graphene docs](https://graphene-ci.github.io/docs/studio). This README is about
developing the repository.

## Install (desktop app)

Releases: [github.com/graphene-ci/studio/releases](https://github.com/graphene-ci/studio/releases).

Download the installer for your platform from the latest release:

- **Linux** — `Graphene-Studio-<ver>-x86_64.AppImage` (chmod +x and run),
  `-amd64.deb`, or `-x86_64.rpm`.
- **Windows** — `Graphene-Studio-Setup-<ver>-x64.exe`.

Then launch Studio and point it at your installation's Management API endpoint.

## Layout

- `src/pages/` — route compositions;
- `src/components/` — UI and product components;
- `src/hooks/` — the React layer over state and the API;
- `src/stores/` — app state on nanostores;
- `src/lib/` — ConnectRPC clients and infrastructure;
- `src/proto/` — the committed TypeScript bindings of the Management API;
- `electron/` — the desktop main/preload shell;
- `public/` — static assets;
- `bin/` — repo-local tools.

Architecture rules and component boundaries are in `AGENTS.md`.

## Web development

Requires `make`, `curl` and Node.js `22.23.x`. The rest of the tools and
dependencies are installed inside the repo:

```bash
make configure
make dev
```

The dev server is at `http://localhost:5173` and proxies to
`http://localhost:7233` by default. Point it elsewhere with:

```bash
VITE_PROXY_TARGET=http://graphene.example.com:7233 make dev
```

## Desktop development

```bash
make dev-desktop
make build-desktop
make package-desktop        # installers for the current platform → dist_packaged/
```

Per-platform yarn scripts: `package:linux`, `package:win`, `package:mac`. The
desktop build reuses the same renderer and adds no separate server protocol.

## Check

```bash
make test        # TypeScript type-check
make lint        # validates easyp.yaml, runs Biome
make build
```

`make format` reformats sources.

## Server contracts

The Management API source is the `.proto` files in the `graphene-ci/graphene`
repo. The generated bindings are committed to `src/proto/`, so a normal build
does not depend on a sibling checkout.

```bash
make generate
```

This updates `easyp.lock` to a pinned Git revision and regenerates the bindings
from scratch. Generated files are not edited by hand.

## Release

A pushed semver tag (`vX.Y.Z`) builds the installers and publishes them to a
GitHub Release (Linux AppImage/deb/rpm + Windows nsis, with auto-update
metadata):

```bash
make ver v=0.1.0        # or: make bump TYPE=minor
```
