import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/translate-sdk.umd.js',
      format: 'umd',
      name: 'TranslateSDK',
      sourcemap: true,
    },
    {
      file: 'dist/translate-sdk.esm.js',
      format: 'es',
      sourcemap: true,
    },
  ],
  plugins: [
    resolve({ browser: true }),
    typescript({ tsconfig: './tsconfig.json', declaration: false, declarationMap: false }),
    terser(),
  ],
};
