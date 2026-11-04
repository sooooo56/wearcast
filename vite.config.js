// 이 파일이 하는 일: Vite 설정. 로컬 개발(npm run dev)에서도 /api/explain 서버리스 함수가 동작하게 연결한다.
// 배포(Vercel)에서는 Vercel이 api/ 폴더를 직접 실행하므로 이 연결은 개발 서버에서만 쓰인다.
// 서버용 환경변수(ANTHROPIC_API_KEY, LLM_*)는 VITE_ 접두사가 없어서 브라우저 코드에 들어가지 않는다.

import { defineConfig, loadEnv } from 'vite';

const SERVER_ENV_KEYS = ['ANTHROPIC_API_KEY', 'LLM_PROVIDER', 'LLM_MODEL', 'LLM_EFFORT'];

function devApi(env) {
  return {
    name: 'wearcast-dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/explain', async (req, res) => {
        // .env.local 값을 서버 함수에 직접 넘긴다 (process.env를 바꾸면 재시작 후에도 옛 값이 남아서 쓰지 않음)
        // .env 파일을 고치면 Vite가 개발 서버를 다시 시작하며 새 값을 읽는다
        const serverEnv = Object.fromEntries(SERVER_ENV_KEYS.map((k) => [k, env[k]]));
        const chunks = [];
        for await (const c of req) chunks.push(c);
        req.body = Buffer.concat(chunks).toString('utf8');

        // Vercel의 res.status().json() 모양을 흉내 낸다
        const vres = {
          statusCode: 200,
          status(code) {
            this.statusCode = code;
            return this;
          },
          setHeader: (k, v) => res.setHeader(k, v),
          json(obj) {
            res.statusCode = this.statusCode;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify(obj));
          },
        };
        try {
          const mod = await server.ssrLoadModule('/api/explain.js');
          await mod.handleExplain(req, vres, serverEnv);
        } catch (err) {
          console.error('[dev-api]', err);
          vres.status(500).json({ error: 'dev_api_error' });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return { plugins: [devApi(env)] };
});
