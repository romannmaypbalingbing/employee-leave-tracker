import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, ScanCommandInput } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyHandler } from 'aws-lambda';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const queryParams = event.queryStringParameters || {};
    const scanInput: ScanCommandInput = {
      TableName: process.env.LEAVE_TABLE_NAME,
    };

    const filterExpressions: string[] = [];
    const expressionAttributeValues: Record<string, any> = {};

    if (queryParams.status) {
      filterExpressions.push('status = :status');
      expressionAttributeValues[':status'] = queryParams.status;
    }

    if (queryParams.employee_name) {
      filterExpressions.push('contains(employee_name, :name)');
      expressionAttributeValues[':name'] = queryParams.employee_name;
    }

    if (filterExpressions.length > 0) {
      scanInput.FilterExpression = filterExpressions.join(' AND ');
      scanInput.ExpressionAttributeValues = expressionAttributeValues;
    }

    const command = new ScanCommand(scanInput);
    const result = await docClient.send(command);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, data: result.Items || [] }),
    };
  } catch (err) {
    console.error('Error in getLeaveRequests:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error fetching leave requests',
        error: (err as Error).message,
      }),
    };
  }
};
