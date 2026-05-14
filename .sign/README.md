# Signature Configuration

This directory contains signing configuration and certificates for building signed releases of SkillVault.

## Prerequisites

1. Install Tauri CLI signer:

```bash
cargo install tauri-cli --features signer
```

## Generating Signing Keys

### Updater Signing Key

Generate a key pair for signing application updates:

```bash
tauri signer generate
```

- Save the private key securely (never commit it to version control)
- Paste the public key into `src-tauri/tauri.conf.json` under `plugins.updater.pubkey`

## Platform-Specific Signing

### macOS

1. Obtain an Apple Developer ID certificate from [Apple Developer Portal](https://developer.apple.com/)
2. Install the certificate in your Keychain
3. Set the signing identity in `src-tauri/tauri.conf.json` under `bundle.macOS.signingIdentity`
4. Configure notarization credentials:
   - Set `bundle.macOS.notarization.teamId` (your Apple Developer Team ID)
   - Set `bundle.macOS.notarization.appleId` (your Apple ID email)
   - Set `bundle.macOS.notarization.appleIdPassword` (app-specific password)

### Windows

1. Obtain a code signing certificate from a trusted CA (DigiCert, Sectigo, etc.)
2. Install the certificate on your build machine
3. Set the certificate thumbprint in `src-tauri/tauri.conf.json` under `bundle.windows.certificateThumbprint`
4. (Optional) Set `bundle.windows.certificatePassword` if your certificate is password protected

### Linux

Linux packages are typically not required to be signed, but you can sign DEB/RPM packages using your GPG key:

```bash
# For DEB packages
dpkg-sig --sign builder release/bundle/deb/*.deb

# For RPM packages
rpm --addsign release/bundle/rpm/*.rpm
```

## Environment Variables (Recommended)

Instead of hardcoding sensitive values in config files, use environment variables:

- `TAURI_SIGNING_IDENTITY`: macOS signing identity
- `TAURI_WINDOWS_CERTIFICATE_THUMBPRINT`: Windows certificate thumbprint
- `TAURI_WINDOWS_CERTIFICATE_PASSWORD`: Windows certificate password
- `TAURI_APPLE_ID`: Apple ID for notarization
- `TAURI_APPLE_ID_PASSWORD`: Apple ID app-specific password
- `TAURI_APPLE_TEAM_ID`: Apple Developer Team ID
- `TAURI_SIGNER_PRIVATE_KEY`: Updater private key
- `TAURI_SIGNER_PRIVATE_KEY_PASSWORD`: Updater private key password

## Important Notes

- \*\*Never commit private keys, certificates, or passwords to version control
- Add all files in this directory (except this README) are ignored by Git
- Use CI/CD pipelines should load signing credentials from secure secrets management
