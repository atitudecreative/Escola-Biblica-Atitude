/**
 * Erros de domínio. Mensagens são seguras para exibir ao usuário;
 * detalhes técnicos vão apenas para o log.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string = "APP_ERROR",
    public readonly status: number = 400,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(message = "Verifique os campos destacados.", fieldErrors?: Record<string, string>) {
    super(message, "VALIDATION", 422, fieldErrors);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Sua sessão expirou. Entre novamente.") {
    super(message, "UNAUTHORIZED", 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Você não tem permissão para realizar esta ação.") {
    super(message, "FORBIDDEN", 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Não encontramos o que você procurava.") {
    super(message, "NOT_FOUND", 404);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Muitas tentativas. Aguarde alguns minutos e tente novamente.") {
    super(message, "RATE_LIMITED", 429);
  }
}
