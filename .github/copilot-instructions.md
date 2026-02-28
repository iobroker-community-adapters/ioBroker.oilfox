# ioBroker Adapter Development with GitHub Copilot

**Version:** 0.5.7  
**Template Source:** https://github.com/DrozmotiX/ioBroker-Copilot-Instructions

This file contains instructions and best practices for GitHub Copilot when working on ioBroker adapter development.

---

## 📑 Table of Contents

1. [Project Context](#project-context)
2. [Code Quality & Standards](#code-quality--standards)
   - [Code Style Guidelines](#code-style-guidelines)
   - [ESLint Configuration](#eslint-configuration)
3. [Testing](#testing)
   - [Unit Testing](#unit-testing)
   - [Integration Testing](#integration-testing)
   - [API Testing with Credentials](#api-testing-with-credentials)
4. [Development Best Practices](#development-best-practices)
   - [Dependency Management](#dependency-management)
   - [HTTP Client Libraries](#http-client-libraries)
   - [Error Handling](#error-handling)
5. [Admin UI Configuration](#admin-ui-configuration)
   - [JSON-Config Setup](#json-config-setup)
   - [Translation Management](#translation-management)
6. [Documentation](#documentation)
   - [README Updates](#readme-updates)
   - [Changelog Management](#changelog-management)
7. [CI/CD & GitHub Actions](#cicd--github-actions)
   - [Workflow Configuration](#workflow-configuration)
   - [Testing Integration](#testing-integration)

---

## Project Context

You are working on an ioBroker adapter. ioBroker is an integration platform for the Internet of Things, focused on building smart home and industrial IoT solutions. Adapters are plugins that connect ioBroker to external systems, devices, or services.

### OilFox Adapter Specific Context

This adapter integrates OilFox oil level sensors with ioBroker. OilFox is a smart oil level sensor system that allows monitoring heating oil tank levels remotely. The adapter connects to the OilFox web API to retrieve sensor data and provide it within the ioBroker ecosystem.

**Key Functionality:**
- Connects to OilFox web API using user credentials (email/password)
- Retrieves oil level data from connected OilFox sensors  
- Creates ioBroker states/objects for sensor readings (oil level, battery status, etc.)
- Handles multiple OilFox devices per user account
- Implements proper scheduling to avoid API rate limits
- Includes timeout handling for unresponsive API calls

**API Integration Details:**
- Uses HTTPS requests to OilFox API endpoints
- Implements authentication token handling
- Processes JSON responses containing sensor data
- Handles multiple sensors and device configurations
- Includes error handling for API failures and network timeouts

**Configuration Requirements:**
- User email address for OilFox account access
- User password for OilFox account access  
- Configurable execution schedule (defaults to random minute each hour)
- Automatic schedule randomization to distribute API load

---

## Code Quality & Standards

### Code Style Guidelines

- Follow JavaScript/TypeScript best practices
- Use async/await for asynchronous operations
- Implement proper resource cleanup in `unload()` method
- Use semantic versioning for adapter releases
- Include proper JSDoc comments for public methods

**Timer and Resource Cleanup Example:**
```javascript
private connectionTimer?: NodeJS.Timeout;

async onReady() {
  this.connectionTimer = setInterval(() => this.checkConnection(), 30000);
}

onUnload(callback) {
  try {
    if (this.connectionTimer) {
      clearInterval(this.connectionTimer);
      this.connectionTimer = undefined;
    }
    callback();
  } catch (e) {
    callback();
  }
}
```

**OilFox-Specific Code Style:**

- Main logic in `main.js` using adapter-core pattern
- Separate functions for API communication and state management
- Clean separation between authentication and data retrieval
- Proper resource cleanup in unload handler
- Use native Node.js `https` module for API calls
- Implement proper timeout handling (45s adapter timeout, 5s per request)
- Handle JSON parsing errors gracefully
- Validate API response structure before processing
- Create states using consistent naming conventions
- Use appropriate state types (number, string, boolean)
- Set proper state roles and units for oil level measurements
- Respect API rate limits and use randomized scheduling to distribute load
- Implement watchdog timer for adapter execution timeout

### ESLint Configuration

**CRITICAL:** ESLint validation must run FIRST in your CI/CD pipeline, before any other tests. This "lint-first" approach catches code quality issues early.

#### Setup
```bash
npm install --save-dev eslint @iobroker/eslint-config
```

#### Configuration (.eslintrc.json)
```json
{
  "extends": "@iobroker/eslint-config",
  "rules": {
    // Add project-specific rule overrides here if needed
  }
}
```

#### Package.json Scripts
```json
{
  "scripts": {
    "lint": "eslint --max-warnings 0 .",
    "lint:fix": "eslint . --fix"
  }
}
```

#### Best Practices
1. ✅ Run ESLint before committing — fix ALL warnings, not just errors
2. ✅ Use `lint:fix` for auto-fixable issues
3. ✅ Don't disable rules without documentation
4. ✅ Lint all relevant files (main code, tests, build scripts)
5. ✅ Keep `@iobroker/eslint-config` up to date
6. ✅ **ESLint warnings are treated as errors in CI** (`--max-warnings 0`). The `lint` script above already includes this flag — run `npm run lint` to match CI behavior locally

#### Common Issues
- **Unused variables**: Remove or prefix with underscore (`_variable`)
- **Missing semicolons**: Run `npm run lint:fix`
- **Indentation**: Use 4 spaces (ioBroker standard)
- **console.log**: Replace with `adapter.log.debug()` or remove

---

## Testing

### Unit Testing
- Use Jest as the primary testing framework for ioBroker adapters
- Create tests for all adapter main functions and helper methods
- Test error handling scenarios and edge cases
- Mock external API calls and hardware dependencies
- For adapters connecting to APIs/devices not reachable by internet, provide example data files to allow testing of functionality without live connections
- Example test structure:
  ```javascript
  describe('AdapterName', () => {
    let adapter;
    
    beforeEach(() => {
      // Setup test adapter instance
    });
    
    test('should initialize correctly', () => {
      // Test adapter initialization
    });
  });
  ```

**OilFox-Specific Testing:**
- Use descriptive test names that explain what functionality is being tested
- Mock external API calls when testing adapter logic
- Ensure tests can run without actual OilFox API credentials
- Example test structure:
  ```javascript
  describe('OilFox Adapter', () => {
      it('should create states for sensor data', async () => {
          // Test implementation
      });
      
      it('should handle API timeout gracefully', async () => {
          // Test timeout handling
      });
  });
  ```

### Integration Testing

**CRITICAL:** Use the official `@iobroker/testing` framework for all integration tests. This is the ONLY correct way to test ioBroker adapters.

**Official Documentation:** https://github.com/ioBroker/testing

#### Framework Structure

**Example Pattern:**
```javascript
const path = require('path');
const { tests } = require('@iobroker/testing');

tests.integration(path.join(__dirname, '..'), {
    defineAdditionalTests({ suite }) {
        suite('Test adapter with specific configuration', (getHarness) => {
            let harness;

            before(() => {
                harness = getHarness();
            });

            it('should configure and start adapter', function () {
                return new Promise(async (resolve, reject) => {
                    try {
                        // Get adapter object
                        const obj = await new Promise((res, rej) => {
                            harness.objects.getObject('system.adapter.your-adapter.0', (err, o) => {
                                if (err) return rej(err);
                                res(o);
                            });
                        });

                        if (!obj) return reject(new Error('Adapter object not found'));

                        // Configure adapter
                        Object.assign(obj.native, {
                            position: '52.520008,13.404954',
                            createHourly: true,
                        });

                        harness.objects.setObject(obj._id, obj);

                        // Start and wait
                        await harness.startAdapterAndWait();
                        await new Promise(resolve => setTimeout(resolve, 15000));

                        // Verify states
                        const stateIds = await harness.dbConnection.getStateIDs('your-adapter.0.*');

                        if (stateIds.length > 0) {
                            console.log('✅ Adapter successfully created states');
                            await harness.stopAdapter();
                            resolve(true);
                        } else {
                            reject(new Error('Adapter did not create any states'));
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            }).timeout(40000);
        });
    }
});
```

#### Testing Success AND Failure Scenarios

**IMPORTANT:** For every "it works" test, implement corresponding "it fails gracefully" tests.

**Failure Scenario Example:**
```javascript
it('should NOT create daily states when daily is disabled', function () {
    return new Promise(async (resolve, reject) => {
        try {
            harness = getHarness();
            const obj = await new Promise((res, rej) => {
                harness.objects.getObject('system.adapter.your-adapter.0', (err, o) => {
                    if (err) return rej(err);
                    res(o);
                });
            });

            if (!obj) return reject(new Error('Adapter object not found'));

            Object.assign(obj.native, {
                createDaily: false, // Daily disabled
            });

            await new Promise((res, rej) => {
                harness.objects.setObject(obj._id, obj, (err) => {
                    if (err) return rej(err);
                    res(undefined);
                });
            });

            await harness.startAdapterAndWait();
            await new Promise((res) => setTimeout(res, 20000));

            const stateIds = await harness.dbConnection.getStateIDs('your-adapter.0.*');
            const dailyStates = stateIds.filter((key) => key.includes('daily'));

            if (dailyStates.length === 0) {
                console.log('✅ No daily states found as expected');
                resolve(true);
            } else {
                reject(new Error('Expected no daily states but found some'));
            }

            await harness.stopAdapter();
        } catch (error) {
            reject(error);
        }
    });
}).timeout(40000);
```

#### Key Rules

1. ✅ Use `@iobroker/testing` framework
2. ✅ Configure via `harness.objects.setObject()`
3. ✅ Start via `harness.startAdapterAndWait()`
4. ✅ Verify states via `harness.states.getState()`
5. ✅ Allow proper timeouts for async operations
6. ❌ NEVER test API URLs directly
7. ❌ NEVER bypass the harness system

#### Workflow Dependencies

Integration tests should run ONLY after lint and adapter tests pass:

```yaml
integration-tests:
  needs: [check-and-lint, adapter-tests]
  runs-on: ubuntu-22.04
```

**OilFox-Specific Integration Testing:**
- Test with actual API when developing new features (use test credentials)
- Validate state creation and updates
- Test timeout and error handling scenarios
- Verify proper cleanup in unload() method

### API Testing with Credentials

For adapters connecting to external APIs requiring authentication:

#### Password Encryption for Integration Tests

```javascript
async function encryptPassword(harness, password) {
    const systemConfig = await harness.objects.getObjectAsync("system.config");
    if (!systemConfig?.native?.secret) {
        throw new Error("Could not retrieve system secret for password encryption");
    }

    const secret = systemConfig.native.secret;
    let result = '';
    for (let i = 0; i < password.length; ++i) {
        result += String.fromCharCode(secret[i % secret.length].charCodeAt(0) ^ password.charCodeAt(i));
    }
    return result;
}
```

#### Demo Credentials Testing Pattern

- Use provider demo credentials when available
- Create separate test file: `test/integration-demo.js`
- Add npm script: `"test:integration-demo": "mocha test/integration-demo --exit"`
- Implement clear success/failure criteria

**Example Implementation:**
```javascript
it("Should connect to API with demo credentials", async () => {
    const encryptedPassword = await encryptPassword(harness, "demo_password");

    await harness.changeAdapterConfig("your-adapter", {
        native: {
            username: "demo@provider.com",
            password: encryptedPassword,
        }
    });

    await harness.startAdapter();
    await new Promise(resolve => setTimeout(resolve, 60000));

    const connectionState = await harness.states.getStateAsync("your-adapter.0.info.connection");

    if (connectionState?.val === true) {
        console.log("✅ SUCCESS: API connection established");
        return true;
    } else {
        throw new Error("API Test Failed: Expected API connection. Check logs for API errors.");
    }
}).timeout(120000);
```

---

## Development Best Practices

### Dependency Management

- Always use `npm` for dependency management
- Use `npm ci` for installing existing dependencies (respects package-lock.json)
- Use `npm install` only when adding or updating dependencies
- Keep dependencies minimal and focused
- Only update dependencies in separate Pull Requests

**When modifying package.json:**
1. Run `npm install` to sync package-lock.json
2. Commit both package.json and package-lock.json together

**Best Practices:**
- Prefer built-in Node.js modules when possible
- Use `@iobroker/adapter-core` for adapter base functionality
- Avoid deprecated packages
- Document specific version requirements

**OilFox-Specific Dependencies:**
- Node.js built-in modules: `https`, `querystring`
- No external HTTP libraries - uses native Node.js capabilities
- Use ESLint for code quality
- Use Prettier for code formatting
- Use @iobroker/testing for adapter testing utilities

### HTTP Client Libraries

- **Preferred:** Use native `fetch` API (Node.js 20+ required)
- **Avoid:** `axios` unless specific features are required

**Example with fetch:**
```javascript
try {
  const response = await fetch('https://api.example.com/data');
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const data = await response.json();
} catch (error) {
  this.log.error(`API request failed: ${error.message}`);
}
```

**OilFox Note:** The adapter currently uses the native Node.js `https` module for API calls. This is acceptable for existing code; new code should prefer `fetch`.

### Error Handling

- Always catch and log errors appropriately
- Use adapter log levels (error, warn, info, debug)
- Provide meaningful, user-friendly error messages
- Handle network failures gracefully
- Implement retry mechanisms where appropriate
- Always clean up timers, intervals, and resources in `unload()` method

**OilFox-Specific Error Handling:**
- Always wrap API calls in try/catch blocks
- Handle network timeouts (adapter uses 5s timeout per request, 45s overall watchdog)
- Gracefully handle authentication failures
- Implement retry logic for temporary failures

```javascript
// Example error handling pattern
try {
    const response = await makeApiCall();
    await processResponse(response);
} catch (error) {
    adapter.log.error(`API call failed: ${error.message}`);
    // Handle specific error types
    if (error.code === 'TIMEOUT') {
        adapter.log.warn('API timeout occurred, will retry next cycle');
    }
}
```

### Logging Guidelines
- Use appropriate log levels:
  - `adapter.log.error()` for critical failures
  - `adapter.log.warn()` for non-critical issues
  - `adapter.log.info()` for important status messages
  - `adapter.log.debug()` for detailed debugging information

---

## Admin UI Configuration

### JSON-Config Setup

Use JSON-Config format for modern ioBroker admin interfaces.

**Example Structure:**
```json
{
  "type": "panel",
  "items": {
    "host": {
      "type": "text",
      "label": "Host address",
      "help": "IP address or hostname of the device"
    }
  }
}
```

**Guidelines:**
- ✅ Use consistent naming conventions
- ✅ Provide sensible default values
- ✅ Include validation for required fields
- ✅ Add tooltips for complex options
- ✅ Ensure translations for all supported languages (minimum English and German)
- ✅ Write end-user friendly labels, avoid technical jargon

### Translation Management

**CRITICAL:** Translation files must stay synchronized with `admin/jsonConfig.json`. Orphaned keys or missing translations cause UI issues and PR review delays.

#### Overview
- **Location:** `admin/i18n/{lang}/translations.json` for 11 languages (de, en, es, fr, it, nl, pl, pt, ru, uk, zh-cn)
- **Source of truth:** `admin/jsonConfig.json` - all `label` and `help` properties must have translations
- **Command:** `npm run translate` - auto-generates translations but does NOT remove orphaned keys

#### Critical Rules
1. ✅ Keys must match exactly with jsonConfig.json
2. ✅ No orphaned keys in translation files
3. ✅ All translations must be in native language (no English fallbacks)
4. ✅ Keys must be sorted alphabetically

#### Workflow for Translation Updates

**When modifying admin/jsonConfig.json:**

1. Make your changes to labels/help texts
2. Run automatic translation: `npm run translate`
3. Run validation to check for missing or orphaned keys
4. Remove orphaned keys manually from all translation files
5. Add missing translations in native languages
6. Run: `npm run lint && npm run test`

---

## Documentation

### README Updates

#### Required Sections
1. **Installation** - Clear npm/ioBroker admin installation steps
2. **Configuration** - Detailed configuration options with examples
3. **Usage** - Practical examples and use cases
4. **Changelog** - Version history (use "## **WORK IN PROGRESS**" for ongoing changes)
5. **License** - License information (typically MIT for ioBroker adapters)
6. **Support** - Links to issues, discussions, community support

#### Documentation Standards
- Use clear, concise language
- Include code examples for configuration
- Add screenshots for admin interface when applicable
- Maintain multilingual support (minimum English and German)
- Always reference issues in commits and PRs (e.g., "fixes #xx")

#### Mandatory README Updates for PRs

For **every PR or new feature**, always add a user-friendly entry to README.md:

- Add entries under `## **WORK IN PROGRESS**` section
- Use format: `* (author) **TYPE**: Description of user-visible change`
- Types: **NEW** (features), **FIXED** (bugs), **ENHANCED** (improvements), **TESTING** (test additions), **CI/CD** (automation)
- Focus on user impact, not technical details

**Example:**
```markdown
## **WORK IN PROGRESS**

* (DutchmanNL) **FIXED**: Adapter now properly validates login credentials (fixes #25)
* (DutchmanNL) **NEW**: Added device discovery to simplify initial setup
```

### Changelog Management

Follow the [AlCalzone release-script](https://github.com/AlCalzone/release-script) standard.

#### Format Requirements

```markdown
# Changelog

<!--
  Placeholder for the next version (at the beginning of the line):
  ## **WORK IN PROGRESS**
-->

## **WORK IN PROGRESS**

- (author) **NEW**: Added new feature X
- (author) **FIXED**: Fixed bug Y (fixes #25)

## v0.1.0 (2023-01-01)
Initial release
```

#### Workflow Process
- **During Development:** All changes go under `## **WORK IN PROGRESS**`
- **For Every PR:** Add user-facing changes to WORK IN PROGRESS section
- **Before Merge:** Version number and date added when merging to main
- **Release Process:** Release-script automatically converts placeholder to actual version

#### Change Entry Format
- Format: `- (author) **TYPE**: User-friendly description`
- Types: **NEW**, **FIXED**, **ENHANCED**
- Focus on user impact, not technical implementation
- Reference issues: "fixes #XX" or "solves #XX"

---

## CI/CD & GitHub Actions

### Workflow Configuration

#### GitHub Actions Best Practices

**Must use ioBroker official testing actions:**
- `ioBroker/testing-action-check@v1` for lint and package validation
- `ioBroker/testing-action-adapter@v1` for adapter tests
- `ioBroker/testing-action-deploy@v1` for automated releases with Trusted Publishing (OIDC)

**Configuration:**
- **Node.js versions:** Test on 20.x, 22.x, 24.x
- **Platform:** Use ubuntu-22.04
- **Automated releases:** Deploy to npm on version tags (requires NPM Trusted Publishing)

#### Critical: Lint-First Validation Workflow

**ALWAYS run ESLint checks BEFORE other tests.** Benefits:
- Catches code quality issues immediately
- Prevents wasting CI resources on tests that would fail due to linting errors
- Provides faster feedback to developers
- Enforces consistent code quality

**Workflow Dependency Configuration:**
```yaml
jobs:
  check-and-lint:
    # Runs ESLint and package validation
    # Uses: ioBroker/testing-action-check@v1

  adapter-tests:
    needs: [check-and-lint]  # Wait for linting to pass
    # Run adapter unit tests

  integration-tests:
    needs: [check-and-lint, adapter-tests]  # Wait for both
    # Run integration tests
```

**Key Points:**
- The `check-and-lint` job has NO dependencies - runs first
- ALL other test jobs MUST list `check-and-lint` in their `needs` array
- If linting fails, no other tests run, saving time
- Fix all ESLint errors before proceeding

### Testing Integration

#### API Testing in CI/CD

For adapters with external API dependencies:

```yaml
demo-api-tests:
  if: contains(github.event.head_commit.message, '[skip ci]') == false
  runs-on: ubuntu-22.04

  steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Use Node.js 20.x
      uses: actions/setup-node@v4
      with:
        node-version: 20.x
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run demo API tests
      run: npm run test:integration-demo
```

#### Testing Best Practices
- Run credential tests separately from main test suite
- Don't make credential tests required for deployment
- Provide clear failure messages for API issues
- Use appropriate timeouts for external calls (120+ seconds)

#### Package.json Integration
```json
{
  "scripts": {
    "test:integration-demo": "mocha test/integration-demo --exit"
  }
}
```

---

## Common Development Patterns

### Adapter Initialization Pattern
```javascript
function startAdapter(options) {
  options = options || {};
  Object.assign(options, {
    name: 'your-adapter',
    ready: async () => {
      // Perform initialization
      await initializeAdapter();
    },
    unload: (callback) => {
      try {
        // Clean up resources
        this.stopAllTimers();
        callback();
      } catch (e) {
        callback();
      }
    }
  });

  adapter = new utils.Adapter(options);
  return adapter;
}
```

**OilFox-Specific Adapter Initialization:**
```javascript
function startAdapter(options) {
    options = options || {};
    Object.assign(options, {
        name: adapterName,
        ready: async () => {
            // Initialization logic
            if (adapter.config.email && adapter.config.password) {
                watchdog = adapter.setTimeout(onTimeout, 45*1000);
                await main();
            } else {
                adapter.log.warn('No E-Mail or Password set');
                adapter.stop();
            }
        },
        unload: (callback) => {
            if (watchdog) adapter.clearTimeout(watchdog);
            callback && callback();
        }
    });
    adapter = new utils.Adapter(options);
    return adapter;
}
```

### State Creation Pattern
```javascript
// Basic state creation
await adapter.setObjectNotExistsAsync('stateId', {
  type: 'state',
  common: {
    name: 'State Name',
    type: 'number',
    role: 'value',
    read: true,
    write: false
  },
  native: {}
});
```

**OilFox-Specific State Creation:**
```javascript
async function createStateObjectsFromResult(summaryObject) {
    for (const device of summaryObject.items) {
        await adapter.setObjectNotExistsAsync(device.id, {
            type: 'device',
            common: {
                name: device.description
            }
        });

        // Create states for oil level, battery, etc.
        await adapter.setObjectNotExistsAsync(`${device.id}.level`, {
            type: 'state',
            common: {
                name: 'Oil Level',
                type: 'number',
                role: 'value.volume',
                unit: 'L',
                read: true,
                write: false
            }
        });
    }
}
```

---

## Security Considerations

### General Security
- Never commit credentials or API keys to the repository
- Use adapter configuration for sensitive data
- Validate all user inputs
- Use HTTPS for external communications

### OilFox-Specific Security

**Credential Handling:**
- Store API credentials securely in adapter configuration
- Never log passwords or sensitive authentication data
- Handle authentication token securely in memory
- Clear sensitive data on adapter shutdown

**API Security:**
- Use HTTPS for all API communications
- Validate SSL certificates
- Handle authentication errors appropriately
- Implement proper session management

---

## Debugging and Troubleshooting

### General Debugging
- Use appropriate log levels for different severity
- Enable debug logging when diagnosing issues
- Check adapter logs in ioBroker admin interface
- Test with minimal configuration first

### OilFox-Specific Debugging

**Common Issues:**
- Authentication failures: Check credentials and API status
- Timeout errors: Network connectivity or API response delays
- State update failures: Object creation issues or permission problems
- Scheduling issues: Verify cron expression and adapter configuration

**Debug Logging:**
```javascript
// Enable debug logging in adapter configuration
adapter.log.debug(`Processing device: ${device.id}`);
adapter.log.debug(`API response: ${JSON.stringify(response)}`);
```

**Monitoring:**
- Monitor adapter execution time (should complete within 45s)
- Track API response times and success rates
- Watch for memory leaks in long-running tests
- Monitor state update frequency and success

---

## Additional Resources

- [ioBroker Developer Documentation](https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/adapterdev.md)
- [ioBroker Adapter Testing](https://github.com/ioBroker/testing)
- [ioBroker Best Practices](https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/bestpractices.md)

---

This adapter follows the ioBroker community standards and provides reliable integration with OilFox sensor systems while maintaining proper error handling, security, and performance characteristics.
