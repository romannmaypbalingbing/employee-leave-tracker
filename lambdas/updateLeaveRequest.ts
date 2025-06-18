import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyHandler } from 'aws-lambda';
import { decryptLeaveRequest } from '../utils/encryption';

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

    const body = event.body ? JSON.parse(event.body) : {};
    const decryptedData = body.encrypted_data
      ? decryptLeaveRequest(body.encrypted_data)
      : body;

    if (!decryptedData.status) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Only "status" field can be updated by HR-Admin.' }),
      };
    }

    const command = new UpdateCommand({
      TableName: tableName,
      Key: { id },
      UpdateExpression: 'SET #status = :status',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':status': decryptedData.status },
      ReturnValues: 'ALL_NEW',
    });

    const result = await docClient.send(command);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, data: result.Attributes }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error updating leave request',
        error: (err as Error).message,
      }),
    };
  }
};
