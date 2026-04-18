/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Question {
  id: string;
  text: string;
  type: 'multiple-choice' | 'single-choice' | 'open-ended';
  options?: string[];
  correctAnswer: string | string[];
  explanation?: string;
  points: number;
  imageUrl?: string;
}

export interface Test {
  id: string;
  title: string;
  subject: 'MAT' | 'CJL';
  year: number;
  term: 'řádný' | 'náhradní' | 'ilustrační';
  durationMinutes: number;
  totalPoints: number;
  questions: Question[];
}

export interface TestResult {
  id: string;
  testId: string;
  userId: string;
  score: number;
  maxScore: number;
  completedAt: string;
  answers: Record<string, any>;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  stats: {
    testsTaken: number;
    averageScore: number;
    totalPoints: number;
    lastActive: string;
  };
}
