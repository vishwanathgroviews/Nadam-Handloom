"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const auth_routes_1 = require("./modules/auth/auth.routes");
const admin_routes_1 = require("./modules/admin/admin.routes");
const errorHandler_1 = require("./middleware/errorHandler");
const swagger_1 = require("./config/swagger");
exports.app = (0, express_1.default)();
exports.app.use((0, helmet_1.default)());
exports.app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    credentials: true // Important for HTTP-Only Refresh Token cookies
}));
exports.app.use(express_1.default.json());
exports.app.use((0, cookie_parser_1.default)());
exports.app.use((0, morgan_1.default)('dev'));
// Routes
exports.app.use('/api/v1/auth', auth_routes_1.authRoutes);
exports.app.use('/api/v1/admin', admin_routes_1.adminRoutes);
if (process.env.NODE_ENV !== 'production') {
    exports.app.use('/api/docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.swaggerSpec));
}
// Global Error Handler (must be registered last)
exports.app.use(errorHandler_1.errorHandler);
//# sourceMappingURL=app.js.map