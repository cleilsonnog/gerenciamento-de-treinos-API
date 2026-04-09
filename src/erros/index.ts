export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class WorkoutPlanNotActiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkoutPlanNotActiveError";
  }
}

export class SessionAlreadyStartedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionAlreadyStartedError";
  }
}

export class SubscriptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubscriptionError";
  }
}

export class NoActiveSubscriptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoActiveSubscriptionError";
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}
