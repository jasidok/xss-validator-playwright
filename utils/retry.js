/**
 * Utility functions for retrying operations
 */

/**
 * Retries an async function until it succeeds or reaches the maximum number of attempts
 * @param {Function} fn - The async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxAttempts - Maximum number of attempts (default: 3)
 * @param {number} options.delay - Delay between attempts in milliseconds (default: 1000)
 * @param {boolean} options.exponentialBackoff - Whether to use exponential backoff for delays (default: true)
 * @param {Function} options.onRetry - Function to call before each retry attempt (default: null)
 * @param {Function} options.shouldRetry - Function to determine if a retry should be attempted based on the error (default: always retry)
 * @returns {Promise<any>} - The result of the function
 * @throws {Error} - The last error encountered if all attempts fail
 */
async function retry(fn, options = {}) {
    const {
        maxAttempts = 3,
        delay = 1000,
        exponentialBackoff = true,
        onRetry = null,
        shouldRetry = () => true
    } = options;
    
    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn(attempt);
        } catch (error) {
            lastError = error;
            
            // Check if we should retry based on the error
            if (!shouldRetry(error)) {
                throw error;
            }
            
            // If this was the last attempt, throw the error
            if (attempt === maxAttempts) {
                throw new Error(`All ${maxAttempts} retry attempts failed. Last error: ${error.message}`);
            }
            
            // Calculate delay for next attempt
            const nextDelay = exponentialBackoff ? delay * Math.pow(2, attempt - 1) : delay;
            
            // Call onRetry callback if provided
            if (onRetry) {
                onRetry(attempt, nextDelay, error);
            }
            
            // Wait before next attempt
            await new Promise(resolve => setTimeout(resolve, nextDelay));
        }
    }
}

/**
 * Creates a retryable version of an async function
 * @param {Function} fn - The async function to make retryable
 * @param {Object} options - Retry options (see retry function)
 * @returns {Function} - A new function that will retry the original function
 */
function makeRetryable(fn, options = {}) {
    return async (...args) => {
        return retry(() => fn(...args), options);
    };
}

/**
 * Retries a Playwright page operation until it succeeds or reaches the maximum number of attempts
 * @param {Object} page - Playwright page object
 * @param {Function} operation - Function that performs the operation on the page
 * @param {Object} options - Retry options (see retry function)
 * @returns {Promise<any>} - The result of the operation
 */
async function retryPageOperation(page, operation, options = {}) {
    const defaultOptions = {
        maxAttempts: 3,
        delay: 1000,
        exponentialBackoff: true,
        onRetry: (attempt, delay, error) => {
            console.log(`Retrying page operation (attempt ${attempt}/${options.maxAttempts}) after ${delay}ms delay. Error: ${error.message}`);
        },
        shouldRetry: (error) => {
            // Common Playwright errors that should be retried
            const retryableErrors = [
                'timeout',
                'navigation',
                'network',
                'element not visible',
                'element not stable',
                'element not found'
            ];
            
            return retryableErrors.some(errType => error.message.toLowerCase().includes(errType));
        }
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    return retry(async () => {
        return await operation(page);
    }, mergedOptions);
}

module.exports = {
    retry,
    makeRetryable,
    retryPageOperation
};