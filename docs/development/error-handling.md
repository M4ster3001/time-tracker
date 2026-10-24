# Error Handling

## Overview

The backend uses a typed error class hierarchy for consistent error handling across services and controllers. All errors extend the base `AppError` class with specific HTTP status codes.

## Error Class Hierarchy

Located in `/backend/src/app/errors/app-error.ts`:

```typescript
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string) {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string) {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}
```

---

## Error Classes

| Class | Status Code | When to Use |
|-------|-------------|-------------|
| `BadRequestError` | 400 | Invalid input, validation failure, malformed request |
| `UnauthorizedError` | 401 | Missing or invalid authentication (token) |
| `ForbiddenError` | 403 | Authenticated but lacking permission |
| `NotFoundError` | 404 | Resource not found in database |
| `ConflictError` | 409 | Resource already exists, duplicate entry |

---

## Usage in Services

Services should throw typed errors instead of generic `Error`:

### Good Examples

```typescript
// ✅ User not found
const user = await prisma.user.findUnique({ where: { id } });
if (!user) {
  throw new NotFoundError('User not found');
}

// ✅ Validation error
if (data.periodMonth < 1 || data.periodMonth > 12) {
  throw new BadRequestError('Invalid month');
}

// ✅ Duplicate entry
const existing = await prisma.client.findUnique({ where: { code } });
if (existing) {
  throw new ConflictError('Client code already exists');
}

// ✅ Permission denied
if (!isSelf && !isAdmin && !isManagerOfTarget) {
  throw new ForbiddenError('Forbidden');
}

// ✅ Invalid credentials
if (!user || !(await bcrypt.compare(password, user.password))) {
  throw new UnauthorizedError('Invalid credentials');
}
```

### Bad Examples

```typescript
// ❌ Generic Error (no type information, defaults to 400)
if (!user) {
  throw new Error('User not found');  // Should be NotFoundError
}

// ❌ String message (not an Error object)
if (invalid) {
  return 'Invalid data';  // Should throw BadRequestError
}
```

---

## Usage in Controllers

Controllers use helper functions to extract status code and message from errors:

### resolveErrorStatus

Maps error instances to HTTP status codes:

```typescript
export const resolveErrorStatus = (error: unknown): number => {
  if (error instanceof AppError) {
    return error.statusCode;
  }
  return 400; // Default for untyped errors
};
```

### getErrorMessage

Safely extracts error message:

```typescript
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
};
```

### Controller Pattern

All controllers follow this error handling pattern:

```typescript
export const someController = async (req: Request, res: Response): Promise<void> => {
  try {
    // Controller logic...
    const result = await someService();
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    const message = getErrorMessage(error);
    res.status(resolveErrorStatus(error)).json({ success: false, error: message });
  }
};
```

**Key points:**
- Always pass the **error object** to `resolveErrorStatus` (not the message)
- Use `getErrorMessage` to safely extract the message
- Return JSON with `success: false` and `error: message`

---

## Migration from String-Based Errors

### Before (String Matching)

```typescript
// ❌ Old pattern
try {
  // ...
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  let status = 400;

  // String matching (fragile)
  if (message.includes('not found')) status = 404;
  if (message.includes('already exists')) status = 409;
  if (message.includes('forbidden')) status = 403;

  res.status(status).json({ success: false, error: message });
}
```

### After (Typed Errors)

```typescript
// ✅ New pattern
try {
  // Service throws typed errors
  const result = await someService();
  res.status(200).json({ success: true, data: result });
} catch (error) {
  // Typed error resolution
  const message = getErrorMessage(error);
  res.status(resolveErrorStatus(error)).json({ success: false, error: message });
}
```

---

## Service Examples

### auth.service.ts

```typescript
// Conflict: User already exists
const existing = await prisma.user.findUnique({ where: { email } });
if (existing) {
  throw new ConflictError('User already exists');
}

// Unauthorized: Invalid credentials
const user = await prisma.user.findUnique({ where: { email } });
if (!user || !(await bcrypt.compare(password, user.password))) {
  throw new UnauthorizedError('Invalid credentials');
}

// Unauthorized: Account locked
if (user.failedAttempts >= MAX_FAILED_ATTEMPTS) {
  throw new UnauthorizedError(`Account locked. Try again after ${lockoutMinutes} minutes.`);
}
```

### timeentry.service.ts

```typescript
// NotFound: Entry not found
const entry = await prisma.timeEntry.findUnique({ where: { id } });
if (!entry) {
  throw new NotFoundError('Time entry not found');
}

// Forbidden: Entry locked
if (isEntryLocked(entry.date, lockDay) && !tempUnlock) {
  throw new ForbiddenError('Time entry month is locked');
}

// BadRequest: Invalid duration
if (duration <= 0 || duration > 1440) {
  throw new BadRequestError('Duration must be between 1 and 1440 minutes');
}
```

### admin.client.service.ts

```typescript
// Conflict: Code already exists
const existing = await prisma.client.findUnique({ where: { code } });
if (existing) {
  throw new ConflictError('Client code already exists');
}

// NotFound: Client not found
const client = await prisma.client.findUnique({ where: { id } });
if (!client) {
  throw new NotFoundError('Client not found');
}

// BadRequest: Cannot delete client with time entries
const entryCount = await prisma.timeEntry.count({ where: { clientId: id } });
if (entryCount > 0) {
  throw new BadRequestError('Cannot delete client with existing time entries');
}
```

### temporary-unlock.service.ts

```typescript
// BadRequest: Validation
if (data.periodMonth < 1 || data.periodMonth > 12) {
  throw new BadRequestError('Invalid month');
}

if (!data.reason || data.reason.trim().length < 5) {
  throw new BadRequestError('Reason must be at least 5 characters');
}

// NotFound: User not found or inactive
const user = await prisma.user.findUnique({ where: { id: data.userId } });
if (!user || !user.isActive) {
  throw new NotFoundError('User not found or inactive');
}

// BadRequest: Duplicate unlock
if (existing) {
  throw new BadRequestError('An active unlock already exists for this user/client/period');
}
```

---

## Testing Error Handling

### Service Tests

```typescript
import { NotFoundError, BadRequestError, ConflictError } from '../app/errors/app-error.js';

it('deve lancar NotFoundError se usuario nao existe', async () => {
  vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

  await expect(getUserById(999)).rejects.toThrow(NotFoundError);
  await expect(getUserById(999)).rejects.toThrow('User not found');
});

it('deve lancar ConflictError se email ja existe', async () => {
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 1 } as any);

  await expect(createUser({ email: 'existing@test.com', ... }))
    .rejects.toThrow(ConflictError);
});
```

### Controller Tests

```typescript
it('deve retornar 404 se recurso nao encontrado', async () => {
  vi.mocked(someService.getResource).mockRejectedValue(
    new NotFoundError('Resource not found')
  );

  await someController(req, res);

  expect(res.status).toHaveBeenCalledWith(404);
  expect(res.json).toHaveBeenCalledWith({
    success: false,
    error: 'Resource not found'
  });
});
```

---

## Best Practices

### 1. Use Specific Error Classes

```typescript
// ✅ Specific and clear
throw new NotFoundError('User not found');
throw new ConflictError('Email already in use');

// ❌ Generic and unclear
throw new Error('User not found');  // Defaults to 400 (Bad Request)
```

### 2. Descriptive Error Messages

```typescript
// ✅ Helpful message
throw new BadRequestError('Duration must be between 1 and 1440 minutes');

// ❌ Vague message
throw new BadRequestError('Invalid input');
```

### 3. Consistent Controller Pattern

```typescript
// ✅ Always pass error object
res.status(resolveErrorStatus(error)).json({ ... });

// ❌ Never pass string
res.status(resolveErrorStatus(message)).json({ ... });
```

### 4. Don't Swallow Errors

```typescript
// ✅ Re-throw or handle properly
try {
  await riskyOperation();
} catch (error) {
  logger.error({ err: error }, 'Operation failed');
  throw error;  // Let controller handle it
}

// ❌ Silent failure
try {
  await riskyOperation();
} catch (error) {
  // Nothing - error is lost
}
```

### 5. Validate Early

```typescript
// ✅ Validate at service entry
export const createUser = async (data: CreateUserData) => {
  if (!data.email || !data.password) {
    throw new BadRequestError('Email and password are required');
  }
  // ... rest of logic
};

// ❌ Validate late (after DB queries)
export const createUser = async (data: CreateUserData) => {
  const existing = await prisma.user.findMany();
  if (!data.email) {
    throw new BadRequestError('Email required');  // Wasted DB query
  }
};
```

---

## Security Considerations

### 1. Don't Leak Sensitive Info

```typescript
// ✅ Generic message for auth failures
throw new UnauthorizedError('Invalid credentials');

// ❌ Reveals which part failed
throw new UnauthorizedError('Password is incorrect');  // Don't reveal if user exists
```

### 2. Avoid Stack Traces in Production

Controllers automatically hide stack traces in responses. Only log them:

```typescript
catch (error) {
  logger.error({ err: error }, 'Request failed');  // Logs stack trace
  res.status(resolveErrorStatus(error)).json({
    success: false,
    error: getErrorMessage(error)  // Only message to client
  });
}
```

### 3. Rate Limit Error Responses

Use rate limiters (already implemented) to prevent error-based attacks.

---

## Common Patterns

### Chain Validation

```typescript
if (!data.name || data.name.length < 2) {
  throw new BadRequestError('Name must be at least 2 characters');
}
if (!data.email || !data.email.includes('@')) {
  throw new BadRequestError('Valid email is required');
}
if (!data.password || data.password.length < 8) {
  throw new BadRequestError('Password must be at least 8 characters');
}
```

### Resource Existence Checks

```typescript
const user = await prisma.user.findUnique({ where: { id } });
if (!user) throw new NotFoundError('User not found');

const client = await prisma.client.findUnique({ where: { id } });
if (!client) throw new NotFoundError('Client not found');
```

### Permission Checks

```typescript
if (!req.user) {
  throw new UnauthorizedError('Unauthorized');
}
if (req.user.roleId !== 1) {
  throw new ForbiddenError('Admin access required');
}
```

---

## Error Response Format

All API errors follow this format:

```json
{
  "success": false,
  "error": "Resource not found"
}
```

**Status code** is determined by the error class (404 for NotFoundError, etc.)

---

## References

- Error classes: `/backend/src/app/errors/app-error.ts`
- Service examples: `/backend/src/services/*.service.ts`
- Controller examples: `/backend/src/controllers/*.controller.ts`
- Test examples: `/backend/src/services/*.test.ts`
