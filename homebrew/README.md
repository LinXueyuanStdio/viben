# Homebrew Tap for Viben

This directory contains the Homebrew formula template for Viben CLI.

## Setup Instructions

To enable `brew install viben`, you need to create a separate Homebrew tap repository:

### 1. Create the tap repository

Create a new GitHub repository named `homebrew-viben` at:
`https://github.com/LinXueyuanStdio/homebrew-viben`

### 2. Repository structure

```
homebrew-viben/
├── Formula/
│   └── viben.rb
└── README.md
```

### 3. Copy the formula

Copy `viben.rb` from this directory to `Formula/viben.rb` in the tap repository.

### 4. Update the SHA256

After publishing to npm, get the SHA256:

```bash
# Get the tarball URL and SHA256
npm view viben dist.tarball
curl -sL "$(npm view viben dist.tarball)" | shasum -a 256
```

Update the `sha256` field in the formula.

### 5. Usage

Users can then install via:

```bash
# Add the tap
brew tap LinXueyuanStdio/viben

# Install
brew install viben
```

Or in one command:

```bash
brew install LinXueyuanStdio/viben/viben
```

## Automated Updates

The release workflow can automatically update the formula. See `.github/workflows/release-cli.yml` for the automation setup.

## Manual Formula Update

To manually update the formula after a new release:

1. Get the new version's tarball SHA256:
   ```bash
   VERSION="0.2.0"  # Replace with new version
   curl -sL "https://registry.npmjs.org/viben/-/viben-${VERSION}.tgz" | shasum -a 256
   ```

2. Update `Formula/viben.rb`:
   - Update the `url` with new version
   - Update the `sha256` with new hash

3. Commit and push to the tap repository.
