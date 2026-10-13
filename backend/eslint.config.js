// Flat config for the Seti backend.
//
// Kept intentionally small: type-aware linting only. The repo has no
// formatting standard of its own, so this does not impose one — it enforces
// correctness (strict-type-checked rules) and leaves style alone.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'src/generated/**'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Console output is the Fastify logger's job, not the code's.
      'no-console': 'warn',

      // Unused args are legitimate when a signature is imposed by an interface
      // (e.g. Fastify handlers taking `reply` they do not use).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // Floating promises are real bugs in an async codebase: a failed write
      // that nobody awaits will vanish silently.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',

      // Fastify route registration and handlers are idiomatically `async`
      // even when a given handler does no awaiting of its own (Fastify treats
      // a returned promise as "handled"). Flagging that is pure noise.
      '@typescript-eslint/require-await': 'off',
    },
  },

  {
    // CLI tools and the check suites are console programs: stdout *is* their
    // interface, so the "the logger's job, not the code's" rule does not apply.
    // Leaving it on buries the app-code warnings that do matter.
    files: ['src/cli/**/*.ts', 'src/**/*.check.ts'],
    rules: {
      'no-console': 'off',
    },
  },

  {
    // Test files may need looser rules; keep them aligned with src for now.
    files: ['**/*.ts'],
  },
);
