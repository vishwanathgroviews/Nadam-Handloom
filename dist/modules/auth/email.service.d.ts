export declare const sendEmail: (to: string, subject: string, body: string) => Promise<void>;
export declare const sendOtpEmail: (email: string, code: string) => Promise<void>;
export declare const sendInviteEmail: (email: string, resetToken: string) => Promise<void>;
export declare const sendPasswordResetEmail: (email: string, resetToken: string) => Promise<void>;
//# sourceMappingURL=email.service.d.ts.map