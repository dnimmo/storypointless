import type { APIGatewayProxyHandler } from 'aws-lambda';

/**
 * $connect handler. We don't have any auth, so we just accept every
 * connection and defer all real work until the client sends create_room
 * or join_room over $default.
 */
export const handler: APIGatewayProxyHandler = async () => {
  return { statusCode: 200, body: '' };
};
