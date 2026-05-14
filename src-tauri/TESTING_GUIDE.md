# SkillVault Backend Testing Guide

## Overview

This guide explains how to use the configured test environment for the SkillVault Rust backend.

## Test Environment Features

1. **In-memory SQLite database**: Each test runs in an isolated in-memory database, so tests don't affect each other or production data.
2. **Test utilities**: Pre-built functions for setting up test databases and loading environment variables.
3. **Mock support**: Uses `mockall` crate for creating mock objects.
4. **Parallel test support**: Uses `serial_test` for tests that need to run sequentially.

## Configuration Files

### 1. Cargo.toml Dependencies

Added the following dev dependencies:

- `tokio-test`: Async testing support for Tokio
- `tempfile`: Temporary file support for tests
- `mockall`: Mock object framework
- `serial_test`: Serial test execution for non-thread-safe tests
- `dotenv`: Environment variable loading from .env files

### 2. .env.test

Test environment configuration file. Copy this to `.env.test` and customize as needed:

```bash
# LLM Configuration for testing
LLM_API_KEY=test-api-key-123
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-3.5-turbo

# Test environment flags
TEST_MODE=true
RUST_LOG=debug
```

### 3. src/test_utils.rs

Test utility module providing:

- `create_test_db()`: Creates and initializes an in-memory SQLite database
- `load_test_env()`: Loads test environment variables from .env.test or uses defaults
- `get_test_llm_config()`: Gets LLM configuration from environment variables

## Writing Tests

### Basic Test Structure

```rust
use crate::test_utils::{create_test_db, load_test_env};
use serial_test::serial;

#[tokio::test]
#[serial] // Use this if your test needs to run sequentially
async fn test_my_feature() {
    // Load test environment
    load_test_env();

    // Create test database
    let pool = create_test_db().await.unwrap();

    // Your test logic here
    // ...
}
```

### Example: Testing Database Operations

See `tests/example_test.rs` for complete examples of:

- Basic CRUD operations testing
- LLM configuration testing
- Database isolation verification

## Running Tests

### Run all tests

```bash
cd src-tauri
cargo test
```

### Run a specific test

```bash
cargo test test_name
```

### Run tests with output

```bash
cargo test -- --nocapture
```

### Run tests with custom environment

```bash
LLM_API_KEY=your-custom-key cargo test
```

## Troubleshooting

### Compilation Errors

If you encounter Tauri-related compilation errors when running tests:

1. Make sure you have the latest Tauri CLI: `npm install -g @tauri-apps/cli`
2. Update Rust dependencies: `cargo update`
3. For Tauri version mismatches, check https://tauri.app/v1/guides/development/updating-dependencies/

### Database Tests Failing

- Make sure your tests use the `serial` attribute if they share resources
- Each test gets a fresh database instance, so data doesn't leak between tests

## Best Practices

1. **Isolate tests**: Each test should create its own database instance
2. **Use mocks**: Mock external dependencies (LLM APIs, Git operations) for unit tests
3. **Clean up**: The in-memory database is automatically deleted after each test
4. **Test naming**: Use descriptive test names that explain what's being tested
5. **Test coverage**: Aim for high coverage of business logic, especially critical operations

## Next Steps

1. Add unit tests for your core business logic
2. Add integration tests for API endpoints
3. Add mock implementations for external services
4. Set up CI/CD pipeline to run tests automatically
