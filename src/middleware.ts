import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { 
  createRequestContext, 
  addCorrelationHeaders, 
  logRequest 
} from "@/features/common/observability/correlation-middleware";
import { securityAudit } from "@/features/common/observability/security-audit";

const requireAuth: string[] = [
  "/chat",
  "/api",
  "/reporting",
  "/unauthorized",
  "/persona",
  "/prompt"
];
const requireAdmin: string[] = ["/reporting"];

export async function middleware(request: NextRequest) {
  // Create request context for correlation tracking
  const context = createRequestContext(request);
  
  try {
    const res = NextResponse.next();
    const pathname = request.nextUrl.pathname;

    if (requireAuth.some((path) => pathname.startsWith(path))) {
      const token = await getToken({
        req: request,
      });

      // Add user ID to context if available
      if (token?.email) {
        context.userId = token.email;
        
        // Record successful authentication for protected routes
        securityAudit.recordAuthSuccess(token.email, {
          method: 'jwt_token',
          correlationId: context.correlationId,
          ipAddress: request.ip || request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        });
      }

      //check not logged in
      if (!token) {
        const url = new URL(`/`, request.url);
        const redirectResponse = NextResponse.redirect(url);
        
        // Log unauthorized access attempt
        logRequest(context, 401);
        
        // Record security event for unauthorized access
        securityAudit.recordSecurityEvent(
          'UNAUTHORIZED_ACCESS',
          'MEDIUM',
          'authentication',
          'access_denied',
          {
            attemptedPath: pathname,
            reason: 'no_token',
          },
          {
            correlationId: context.correlationId,
            ipAddress: request.ip || request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
            userAgent: request.headers.get('user-agent') || 'unknown',
            route: pathname,
            method: request.method,
          }
        );
        
        return addCorrelationHeaders(redirectResponse, context.correlationId);
      }

      if (requireAdmin.some((path) => pathname.startsWith(path))) {
        //check if not authorized
        if (!token.isAdmin) {
          const url = new URL(`/unauthorized`, request.url);
          const rewriteResponse = NextResponse.rewrite(url);
          
          // Log insufficient privileges
          logRequest(context, 403);
          
          // Record privilege escalation attempt
          securityAudit.recordPrivilegeEscalation(
            token.email || 'unknown',
            `access_admin_route_${pathname}`,
            {
              role: 'user',
              requiredRole: 'admin',
              correlationId: context.correlationId,
              route: pathname,
              method: request.method,
            }
          );
          
          return addCorrelationHeaders(rewriteResponse, context.correlationId);
        }
      }
    }

    // Log successful request
    logRequest(context, 200);

    // Add correlation ID to response headers
    return addCorrelationHeaders(res, context.correlationId);
    
  } catch (error) {
    // Log error and add correlation ID to response
    logRequest(context, 500, error);
    
    const errorResponse = NextResponse.json(
      { error: 'Internal server error', correlationId: context.correlationId },
      { status: 500 }
    );
    
    return addCorrelationHeaders(errorResponse, context.correlationId);
  }
}

// note that middleware is not applied to api/auth as this is required to logon (i.e. requires anon access)
export const config = {
  matcher: [
    "/unauthorized/:path*",
    "/reporting/:path*", 
    "/api/chat/:path*",
    "/api/document/:path*",
    "/api/images/:path*",
    "/chat/:path*",
    "/persona/:path*",
    "/prompt/:path*",
    "/extensions/:path*"
  ],
};
