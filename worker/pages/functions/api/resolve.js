import { handleRequest } from '../../../index.js';

export function onRequest({ request, env }) {
  return handleRequest(request, env);
}
