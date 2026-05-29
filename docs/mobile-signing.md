# Mobile App Signing Guide

This guide covers how to set up code signing for Android and iOS builds.

## Android Signing

### Generate Keystore

Run the keystore generation script:

```bash
./scripts/android/generate-android-keystore.sh
```

This creates `apps/desktop/src-tauri/keys/viben-release.keystore`.

### GitHub Actions Secrets

Add these secrets to your repository:

| Secret | Description |
|--------|-------------|
| `ANDROID_KEYSTORE_BASE64` | Base64 encoded keystore file |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Key alias (default: `viben`) |
| `ANDROID_KEY_PASSWORD` | Key password |

Generate base64 encoded keystore:

```bash
base64 -i apps/desktop/src-tauri/keys/viben-release.keystore | tr -d '\n' > keystore.base64
# Copy contents of keystore.base64 to ANDROID_KEYSTORE_BASE64 secret
```

### Tauri Android Signing Configuration

Create `apps/desktop/src-tauri/gen/android/keystore.properties`:

```properties
storePassword=<your-store-password>
keyPassword=<your-key-password>
keyAlias=viben
storeFile=../../keys/viben-release.keystore
```

Or use environment variables in CI:

```yaml
env:
  ANDROID_KEYSTORE_PASSWORD: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
  ANDROID_KEY_ALIAS: ${{ secrets.ANDROID_KEY_ALIAS }}
  ANDROID_KEY_PASSWORD: ${{ secrets.ANDROID_KEY_PASSWORD }}
```

---

## iOS Signing

iOS signing requires an Apple Developer account ($99/year).

### Prerequisites

1. **Apple Developer Account**: https://developer.apple.com/
2. **Xcode** installed on macOS
3. **Apple Developer Certificate**
4. **Provisioning Profile**

### Generate Certificates

#### 1. Create App ID

1. Go to [Apple Developer Portal](https://developer.apple.com/account/resources/identifiers/list)
2. Click "+" to register a new identifier
3. Select "App IDs" → "App"
4. Enter:
   - Description: `Viben`
   - Bundle ID: `com.viben.desktop` (Explicit)
5. Enable required capabilities (Push Notifications, etc.)

#### 2. Create Certificate

1. Open **Keychain Access** on macOS
2. Go to **Keychain Access → Certificate Assistant → Request a Certificate from a Certificate Authority**
3. Enter your email and select "Saved to disk"
4. Go to [Apple Developer Certificates](https://developer.apple.com/account/resources/certificates/list)
5. Click "+" → Select certificate type:
   - **Apple Development**: For development/testing
   - **Apple Distribution**: For App Store/Ad Hoc distribution
6. Upload the CSR file and download the certificate
7. Double-click to install in Keychain

#### 3. Create Provisioning Profile

1. Go to [Provisioning Profiles](https://developer.apple.com/account/resources/profiles/list)
2. Click "+" → Select profile type:
   - **iOS App Development**: For development
   - **Ad Hoc**: For testing on registered devices
   - **App Store Connect**: For App Store distribution
3. Select App ID (`com.viben.desktop`)
4. Select certificate(s)
5. Select devices (for Development/Ad Hoc)
6. Download and double-click to install

### Export Certificate for CI

```bash
# Export certificate and private key to .p12 file
security export -k login.keychain -t identities -f pkcs12 -o certificate.p12

# Base64 encode for GitHub secret
base64 -i certificate.p12 | tr -d '\n' > certificate.base64
```

### GitHub Actions Secrets for iOS

| Secret | Description |
|--------|-------------|
| `APPLE_CERTIFICATE` | Base64 encoded .p12 certificate |
| `APPLE_CERTIFICATE_PASSWORD` | Certificate export password |
| `APPLE_DEVELOPMENT_TEAM` | Team ID (10-character string) |
| `APPLE_ID` | Apple ID email (for notarization) |
| `APPLE_PASSWORD` | App-specific password |
| `KEYCHAIN_PASSWORD` | Temporary keychain password (any string) |

### Find Your Team ID

1. Go to [Apple Developer Membership](https://developer.apple.com/account/#!/membership)
2. Your Team ID is listed under "Membership Information"

### Tauri iOS Configuration

Update `apps/desktop/src-tauri/tauri.conf.json`:

```json
{
  "bundle": {
    "iOS": {
      "developmentTeam": "YOUR_TEAM_ID"
    }
  }
}
```

Or use `tauri.ios.conf.json` for CI-specific configuration.

---

## CI/CD Workflow Updates

### Android Signing in Workflow

```yaml
- name: Decode Android keystore
  run: |
    echo "${{ secrets.ANDROID_KEYSTORE_BASE64 }}" | base64 -d > apps/desktop/src-tauri/keys/viben-release.keystore

- name: Build Android APK (signed)
  working-directory: apps/desktop
  env:
    ANDROID_KEYSTORE_PASSWORD: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
    ANDROID_KEY_ALIAS: ${{ secrets.ANDROID_KEY_ALIAS }}
    ANDROID_KEY_PASSWORD: ${{ secrets.ANDROID_KEY_PASSWORD }}
  run: pnpm tauri android build --apk true --ci
```

### iOS Signing in Workflow

```yaml
- name: Import Apple Certificate
  env:
    APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
    APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
    KEYCHAIN_PASSWORD: ${{ secrets.KEYCHAIN_PASSWORD }}
  run: |
    echo "$APPLE_CERTIFICATE" | base64 -d > certificate.p12
    security create-keychain -p "$KEYCHAIN_PASSWORD" build.keychain
    security default-keychain -s build.keychain
    security unlock-keychain -p "$KEYCHAIN_PASSWORD" build.keychain
    security import certificate.p12 -k build.keychain -P "$APPLE_CERTIFICATE_PASSWORD" -T /usr/bin/codesign
    security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASSWORD" build.keychain

- name: Build iOS IPA (signed)
  working-directory: apps/desktop
  run: pnpm tauri ios build --export-method release-testing --ci
```

---

## Security Best Practices

1. **Never commit** keystore files or certificates to git
2. **Use GitHub Secrets** for all sensitive values
3. **Rotate keys** if they are ever exposed
4. **Use separate keys** for development and production
5. **Keep backups** of production keys in secure storage
6. **Document key owners** and expiration dates

## Troubleshooting

### Android: "keystore was tampered with"

The keystore password is incorrect. Verify with:

```bash
keytool -list -keystore viben-release.keystore
```

### iOS: "No signing certificate found"

1. Check certificate is not expired
2. Verify certificate is installed in Keychain
3. Ensure provisioning profile matches certificate

### iOS: "Provisioning profile doesn't match bundle ID"

The bundle ID in Xcode must match the App ID in the provisioning profile.
Check `apps/desktop/src-tauri/tauri.conf.json` → `identifier` field.
