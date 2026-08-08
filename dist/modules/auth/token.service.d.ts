import jwt from 'jsonwebtoken';
export declare const generateAccessToken: (payload: object) => string;
export declare const verifyAccessToken: (token: string) => string | jwt.JwtPayload;
export declare const generateRefreshToken: () => {
    token: string;
    hash: string;
};
export declare const hashRefreshToken: (token: string) => string;
//# sourceMappingURL=token.service.d.ts.map