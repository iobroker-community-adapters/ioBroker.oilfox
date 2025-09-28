# ioBroker Adapter Development with GitHub Copilot

**Version:** 0.4.0
**Template Source:** https://github.com/DrozmotiX/ioBroker-Copilot-Instructions

This file contains instructions and best practices for GitHub Copilot when working on ioBroker adapter development.

## Project Context

You are working on an ioBroker adapter. ioBroker is an integration platform for the Internet of Things, focused on building smart home and industrial IoT solutions. Adapters are plugins that connect ioBroker to external systems, devices, or services.

**OilFox Adapter Specific Context:**
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
- Keep tests in the `test/` directory
- Use descriptive test names that explain what functionality is being tested
- Mock external API calls when testing adapter logic
- Test error conditions and edge cases
- Ensure tests can run without actual OilFox API credentials

### Integration Testing
- Test with actual API when developing new features (use test credentials)
- Validate state creation and updates
- Test timeout and error handling scenarios
- Verify proper cleanup in unload() method

### Testing Best Practices
```javascript
// Example test structure
describe('OilFox Adapter', () => {
    it('should create states for sensor data', async () => {
        // Test implementation
    });
    
    it('should handle API timeout gracefully', async () => {
        // Test timeout handling
    });
});
```

## Error Handling

### API Error Handling
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

## Code Style and Architecture

### Adapter Structure
- Main logic in `main.js` using adapter-core pattern
- Separate functions for API communication and state management
- Clean separation between authentication and data retrieval
- Proper resource cleanup in unload handler

### API Communication
- Use native Node.js `https` module for API calls
- Implement proper timeout handling (45s adapter timeout, 5s per request)
- Handle JSON parsing errors gracefully
- Validate API response structure before processing

### State Management
- Create states using consistent naming conventions
- Use appropriate state types (number, string, boolean)
- Set proper state roles and units for oil level measurements
- Update states only when values actually change

### Scheduling and Performance  
- Respect API rate limits and server load
- Use randomized scheduling to distribute load
- Implement watchdog timer for adapter execution timeout
- Clean up resources properly to prevent memory leaks

## Common Development Patterns

### Adapter Initialization
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

## Dependencies and Libraries

### Core Dependencies
- `@iobroker/adapter-core`: Base adapter functionality
- Node.js built-in modules: `https`, `querystring`
- No external HTTP libraries - uses native Node.js capabilities

### Development Dependencies
- Follow ioBroker community standards for testing and linting
- Use ESLint for code quality
- Use Prettier for code formatting
- Use @iobroker/testing for adapter testing utilities

## Security Considerations

### Credential Handling
- Store API credentials securely in adapter configuration
- Never log passwords or sensitive authentication data
- Handle authentication token securely in memory
- Clear sensitive data on adapter shutdown

### API Security
- Use HTTPS for all API communications
- Validate SSL certificates
- Handle authentication errors appropriately
- Implement proper session management

## Performance Optimization

### Execution Efficiency
- Minimize adapter runtime (scheduled execution model)
- Use appropriate timeout values
- Clean up resources promptly
- Avoid blocking operations

### API Usage Optimization
- Respect API rate limits
- Use efficient data structures for processing responses
- Cache authentication tokens when possible
- Minimize unnecessary API calls

## Debugging and Troubleshooting

### Common Issues
- Authentication failures: Check credentials and API status
- Timeout errors: Network connectivity or API response delays
- State update failures: Object creation issues or permission problems
- Scheduling issues: Verify cron expression and adapter configuration

### Debug Logging
```javascript
// Enable debug logging in adapter configuration
adapter.log.debug(`Processing device: ${device.id}`);
adapter.log.debug(`API response: ${JSON.stringify(response)}`);
```

### Monitoring
- Monitor adapter execution time (should complete within 45s)
- Track API response times and success rates
- Watch for memory leaks in long-running tests
- Monitor state update frequency and success

This adapter follows the ioBroker community standards and provides reliable integration with OilFox sensor systems while maintaining proper error handling, security, and performance characteristics.