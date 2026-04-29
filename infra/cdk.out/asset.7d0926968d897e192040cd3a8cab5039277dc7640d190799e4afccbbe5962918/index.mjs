import { createRequire } from 'module'; const require = createRequire(import.meta.url);

// apps/server/src/handlers/connect.ts
var handler = async () => {
  return { statusCode: 200, body: "" };
};
export {
  handler
};
