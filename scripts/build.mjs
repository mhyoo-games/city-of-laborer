// dist/ 에 묶어 내기: src/main.ts → main.js, index.html·public 복사
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
await build({ entryPoints: ['src/main.ts'], bundle: true, format: 'esm', target: 'es2022', minify: true, outfile: 'dist/main.js', loader: { '.ts': 'ts' } });
// 캐시 때문에 옛 파일이 섞이지 않게 버전 꼬리표
const v = Date.now().toString(36);
writeFileSync('dist/index.html', readFileSync('index.html', 'utf8').replaceAll('__V__', v));
cpSync('public', 'dist', { recursive: true });
console.log('dist 준비됨');
