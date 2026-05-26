import { Request, Response, NextFunction, RequestHandler } from 'express';
import { z, ZodSchema, ZodError } from 'zod';

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Returns an Express middleware that validates req.body against the given
 * Zod schema. On failure it returns 400 with a field-level error array so
 * the React frontend can highlight individual form fields.
 *
 * Usage:
 *   router.post('/register', validate(registerSchema), authController.register)
 */
export function validate<T>(schema: ZodSchema<T>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = formatZodErrors(result.error);
      res.status(400).json({
        success: false,
        error: 'Validation failed.',
        fields: errors,
      });
      return;
    }

    // Replace req.body with the parsed (and coerced) data
    req.body = result.data;
    next();
  };
}

// ─── Error formatter ──────────────────────────────────────────────────────────

interface FieldError {
  field: string;
  message: string;
}

function formatZodErrors(error: ZodError): FieldError[] {
  return error.errors.map((issue) => ({
    field: issue.path.join('.') || 'body',
    message: issue.message,
  }));
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

/**
 * Password must be at least 8 characters and contain:
 *  - at least one uppercase letter
 *  - at least one lowercase letter
 *  - at least one digit
 *  - at least one special character
 */
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter.')
  .regex(/[0-9]/, 'Password must contain at least one number.')
  .regex(
    /[^A-Za-z0-9]/,
    'Password must contain at least one special character.'
  );

// ── Register ──────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  email: z
    .string({ required_error: 'Email is required.' })
    .email('Please enter a valid email address.')
    .toLowerCase()
    .trim(),

  password: passwordSchema,

  first_name: z
    .string({ required_error: 'First name is required.' })
    .min(2, 'First name must be at least 2 characters.')
    .trim(),

  last_name: z
    .string({ required_error: 'Last name is required.' })
    .min(1, 'Last name is required.')
    .trim(),

  gender: z.enum(['Male', 'Female'], {
    required_error: 'Gender is required.',
    invalid_type_error: 'Gender must be Male or Female.',
  }),

  date_of_birth: z
    .string({ required_error: 'Date of birth is required.' })
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      'Date of birth must be in YYYY-MM-DD format.'
    )
    .refine((dob) => {
      const date = new Date(dob);
      if (isNaN(date.getTime())) return false;
      const today = new Date();
      const age = today.getFullYear() - date.getFullYear();
      const monthDiff = today.getMonth() - date.getMonth();
      const dayDiff = today.getDate() - date.getDate();
      const actualAge =
        monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
      return actualAge >= 18;
    }, 'You must be at least 18 years old to register.'),

  phone: z
    .string()
    .regex(/^\+?[0-9]{7,15}$/, 'Please enter a valid phone number.')
    .optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

// ── Login ─────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required.' })
    .email('Please enter a valid email address.')
    .toLowerCase()
    .trim(),

  password: z
    .string({ required_error: 'Password is required.' })
    .min(1, 'Password is required.'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ── Send Interest ─────────────────────────────────────────────────────────────

export const sendInterestSchema = z.object({
  receiver_id: z
    .string({ required_error: 'Receiver ID is required.' })
    .uuid('Receiver ID must be a valid UUID.')
    .trim(),
});

export type SendInterestInput = z.infer<typeof sendInterestSchema>;

// ── Send Message ──────────────────────────────────────────────────────────────

export const sendMessageSchema = z.object({
  content: z
    .string({ required_error: 'Message content is required.' })
    .min(1, 'Message cannot be empty.')
    .max(2000, 'Message cannot exceed 2000 characters.')
    .trim(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
