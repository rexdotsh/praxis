export {};

declare global {
  interface CustomJwtSessionClaims {
    metadata: {
      onboardingComplete?: boolean;
      name?: string;
      age?: number;
      grade?: string;
      exams?: string[];
      subjects?: string[];
    };
  }
}
