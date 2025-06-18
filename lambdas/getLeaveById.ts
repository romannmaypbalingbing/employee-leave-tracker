import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyHandler } from 'aws-lambda';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const id = event.pathParameters?.id;
    const tableName = process.env.LEAVE_TABLE_NAME;

    if (!id || !tableName) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing ID or table name' }),
      };
    }

    const command = new GetCommand({
      TableName: tableName,
      Key: { id },
    });

    const result = await docClient.send(command);

    if (!result.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Leave request not found' }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, data: result.Item }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error retrieving leave request',
        error: (err as Error).message,
      }),
    };
  }
};
