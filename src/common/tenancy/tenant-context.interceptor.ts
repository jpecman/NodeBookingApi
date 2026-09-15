import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tenantContext } from './tenant-context';

/** Structural, so common/ doesn't have to depend on auth/ — JwtStrategy's return value. */
interface RequestWithUser {
  user?: { id: string; tenantId: string };
}

/**
 * Opens the tenant context around the rest of the request.
 *
 * This has to be an interceptor rather than `enterWith()` inside JwtStrategy.validate():
 * validate() runs inside the promise callback that AuthGuard awaits, and an awaited frame
 * resumes with the async context captured at the await, so a store entered below it is
 * gone by the time the controller runs. Interceptors are the first hook that can *wrap*
 * the downstream handler, and they run after guards, so `request.user` is already set.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const { user } = context.switchToHttp().getRequest<RequestWithUser>();

    // @Public() routes have no user; they must not see a tenant context at all.
    if (!user) {
      return next.handle();
    }

    // The controller runs synchronously inside subscribe(), so it and everything it
    // awaits inherit the store.
    return new Observable((subscriber) =>
      tenantContext.run({ userId: user.id, tenantId: user.tenantId }, () =>
        next.handle().subscribe(subscriber),
      ),
    );
  }
}
