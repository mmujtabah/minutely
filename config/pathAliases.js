import path from 'path';

/**
 * Path aliases for TypeScript imports
 * Matches configuration in tsconfig.web.json and tsconfig.native.json
 */
export const pathAliases = {
  '@': path.resolve(process.cwd(), './'),
  '@/components': path.resolve(process.cwd(), './react/components'),
  '@/features': path.resolve(process.cwd(), './react/features'),
  '@/lib': path.resolve(process.cwd(), './lib'),
  '@/hooks': path.resolve(process.cwd(), './react/hooks'),
  '@/utils': path.resolve(process.cwd(), './react/utils'),
  '@/types': path.resolve(process.cwd(), './react/types'),
};
