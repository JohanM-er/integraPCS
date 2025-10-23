# Spikes / Prototypes

This directory is for non-production experiments, demos, and prototypes:
- Temporary Storybook stories and experimental UI components
- One-off explorations that should not affect production builds
- Scratch code used during design discovery

Rules:
- No apps or libraries should import code from here.
- No Nx project.json is provided for spikes to keep them out of the workspace graph.
- Do not promote code from here into production without proper ownership, tests, and documentation.

Cleanup:
- Regularly prune outdated spikes to reduce noise in the repository.