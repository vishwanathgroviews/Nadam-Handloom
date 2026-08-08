"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
// Centralized error handler
const errorHandler = (err, req, res, next) => {
    console.error(`[ERROR] ${new Date().toISOString()}:`, err);
    // Default to 500 server error
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';
    // Security: Never leak database or unhandled server errors to the client
    if (statusCode >= 500) {
        message = 'An unexpected error occurred. Please try again later.';
    }
    // Generic message for authentication issues
    if (err.name === 'AuthError') {
        statusCode = 401;
        message = 'Invalid credentials';
    }
    res.status(statusCode).json({
        error: message,
    });
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=errorHandler.js.map