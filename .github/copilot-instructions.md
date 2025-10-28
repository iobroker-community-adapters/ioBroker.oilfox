# ioBroker Adapter Development with GitHub Copilot

**Version:** 0.4.2
**Template Source:** https://github.com/DrozmotiX/ioBroker-Copilot-Instructions

This file contains instructions and best practices for GitHub Copilot when working on ioBroker adapter development.

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

**IMPORTANT**: Use the official `@iobroker/testing` framework for all integration tests. This is the ONLY correct way to test ioBroker adapters.

**Official Documentation**: https://github.com/ioBroker/testing

#### Framework Structure
Integration tests MUST follow this exact pattern:

```javascript
const path = require('path');
const { tests } = require('@iobroker/testing');

// Define test coordinates or configuration
const TEST_COORDINATES = '52.520008,13.404954'; // Berlin
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Use tests.integration() with defineAdditionalTests
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
                        harness = getHarness();
                        
                        // Get adapter object using promisified pattern
                        const obj = await new Promise((res, rej) => {
                            harness.objects.getObject('system.adapter.your-adapter.0', (err, o) => {
                                if (err) return rej(err);
                                res(o);
                            });
                        });
                        
                        if (!obj) {
                            return reject(new Error('Adapter object not found'));
                        }

                        // Configure adapter properties
                        Object.assign(obj.native, {
                            position: TEST_COORDINATES,
                            createCurrently: true,
                            createHourly: true,
                            createDaily: true,
                            // Add other configuration as needed
                        });

                        // Set the updated configuration
                        harness.objects.setObject(obj._id, obj);

                        console.log('✅ Step 1: Configuration written, starting adapter...');
                        
                        // Start adapter and wait
                        await harness.startAdapterAndWait();
                        
                        console.log('✅ Step 2: Adapter started');

                        // Wait for adapter to process data
                        const waitMs = 15000;
                        await wait(waitMs);

                        console.log('🔍 Step 3: Checking states after adapter run...');
                        
                        // Check created states
                        const states = await harness.states.getKeysAsync('your-adapter.0.*');
                        
                        if (!states || states.length === 0) {
                            return reject(new Error('No states were created'));
                        }

                        console.log(`✅ Success! Found ${states.length} states created`);
                        resolve();
                        
                    } catch (error) {
                        reject(error);
                    }
                });
            }).timeout(30000); // Adjust timeout as needed
        });
    }
});
```

#### Best Practices
- Always use `getHarness()` to access test harness
- Use promisified patterns for callback-based methods
- Set appropriate timeouts for API operations
- Check for state creation to verify adapter functionality
- Use `harness.startAdapterAndWait()` for proper adapter startup
- Clean up resources after tests

**OilFox-Specific Integration Testing:**
- Test with actual API when developing new features (use test credentials)
- Validate state creation and updates
- Test timeout and error handling scenarios
- Verify proper cleanup in unload() method

## Error Handling

### General Error Handling
- Always wrap risky operations in try/catch blocks
- Log errors with appropriate severity levels
- Implement graceful degradation when possible
- Provide meaningful error messages to users

### API Error Handling

**OilFox-Specific Error Handling:**
- Always wrap API calls in try/catch blocks
- Log appropriate error levels based on severity
- Handle network timeouts (adapter uses 5s timeout)
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

### Resource Cleanup Pattern
```javascript
unload: (callback) => {
  try {
    // Clear all timers
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = undefined;
    }
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = undefined;
    }
    // Close connections, clean up resources
    callback();
  } catch (e) {
    callback();
  }
}
```

## Code Style and Standards

- Follow JavaScript/TypeScript best practices
- Use async/await for asynchronous operations
- Implement proper resource cleanup in `unload()` method
- Use semantic versioning for adapter releases
- Include proper JSDoc comments for public methods

### OilFox-Specific Code Style

**Adapter Structure:**
- Main logic in `main.js` using adapter-core pattern
- Separate functions for API communication and state management
- Clean separation between authentication and data retrieval
- Proper resource cleanup in unload handler

**API Communication:**
- Use native Node.js `https` module for API calls
- Implement proper timeout handling (45s adapter timeout, 5s per request)
- Handle JSON parsing errors gracefully
- Validate API response structure before processing

**State Management:**
- Create states using consistent naming conventions
- Use appropriate state types (number, string, boolean)
- Set proper state roles and units for oil level measurements
- Update states only when values actually change

**Scheduling and Performance:**
- Respect API rate limits and server load
- Use randomized scheduling to distribute load
- Implement watchdog timer for adapter execution timeout
- Clean up resources properly to prevent memory leaks

## CI/CD and Testing Integration

### GitHub Actions for API Testing
For adapters with external API dependencies, implement separate CI/CD jobs:

```yaml
# Tests API connectivity with demo credentials (runs separately)
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

### CI/CD Best Practices
- Run credential tests separately from main test suite
- Use ubuntu-22.04 for consistency
- Don't make credential tests required for deployment
- Provide clear failure messages for API connectivity issues
- Use appropriate timeouts for external API calls (120+ seconds)

### Package.json Script Integration
Add dedicated script for credential testing:
```json
{
  "scripts": {
    "test:integration-demo": "mocha test/integration-demo --exit"
  }
}
```

### Practical Example: Complete API Testing Implementation
Here's a complete example based on lessons learned from the Discovergy adapter:

#### test/integration-demo.js
```javascript
const path = require("path");
const { tests } = require("@iobroker/testing");

// Helper function to encrypt password using ioBroker's encryption method
async function encryptPassword(harness, password) {
    const systemConfig = await harness.objects.getObjectAsync("system.config");
    
    if (!systemConfig || !systemConfig.native || !systemConfig.native.secret) {
        throw new Error("Could not retrieve system secret for password encryption");
    }
    
    const secret = systemConfig.native.secret;
    let result = '';
    for (let i = 0; i < password.length; ++i) {
        result += String.fromCharCode(secret[i % secret.length].charCodeAt(0) ^ password.charCodeAt(i));
    }
    
    return result;
}

// Run integration tests with demo credentials
tests.integration(path.join(__dirname, ".."), {
    defineAdditionalTests({ suite }) {
        suite("API Testing with Demo Credentials", (getHarness) => {
            let harness;
            
            before(() => {
                harness = getHarness();
            });

            it("Should connect to API and initialize with demo credentials", async () => {
                console.log("Setting up demo credentials...");
                
                if (harness.isAdapterRunning()) {
                    await harness.stopAdapter();
                }
                
                const encryptedPassword = await encryptPassword(harness, "demo_password");
                
                await harness.changeAdapterConfig("your-adapter", {
                    native: {
                        username: "demo@provider.com",
                        password: encryptedPassword,
                        // other config options
                    }
                });

                console.log("Starting adapter with demo credentials...");
                await harness.startAdapter();
                
                // Wait for API calls and initialization
                await new Promise(resolve => setTimeout(resolve, 60000));
                
                const connectionState = await harness.states.getStateAsync("your-adapter.0.info.connection");
                
                if (connectionState && connectionState.val === true) {
                    console.log("✅ SUCCESS: API connection established");
                    return true;
                } else {
                    throw new Error("API Test Failed: Expected API connection to be established with demo credentials. " +
                        "Check logs above for specific API errors (DNS resolution, 401 Unauthorized, network issues, etc.)");
                }
            }).timeout(120000);
        });
    }
});
```

## Dependencies and Libraries

### Core Dependencies
- `@iobroker/adapter-core`: Base adapter functionality
- Use built-in Node.js modules when possible to minimize dependencies

### Development Dependencies
- `@iobroker/testing`: Official testing framework for adapters
- `mocha` and `chai`: For unit and integration tests
- `eslint` and `prettier`: For code quality and formatting
- Follow ioBroker community standards

**OilFox-Specific Dependencies:**
- Node.js built-in modules: `https`, `querystring`
- No external HTTP libraries - uses native Node.js capabilities
- Use ESLint for code quality
- Use Prettier for code formatting
- Use @iobroker/testing for adapter testing utilities

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

## Performance Optimization

### General Performance
- Minimize polling frequency for external APIs
- Use efficient data structures
- Implement caching where appropriate
- Clean up resources promptly

### OilFox-Specific Performance

**Execution Efficiency:**
- Minimize adapter runtime (scheduled execution model)
- Use appropriate timeout values
- Clean up resources promptly
- Avoid blocking operations

**API Usage Optimization:**
- Respect API rate limits
- Use efficient data structures for processing responses
- Cache authentication tokens when possible
- Minimize unnecessary API calls

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

## Additional Resources

- [ioBroker Developer Documentation](https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/adapterdev.md)
- [ioBroker Adapter Testing](https://github.com/ioBroker/testing)
- [ioBroker Best Practices](https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/bestpractices.md)

---

This adapter follows the ioBroker community standards and provides reliable integration with OilFox sensor systems while maintaining proper error handling, security, and performance characteristics.
