//employee API -  createLeaveRequest.ts
import { APIGatewayProxyHandler } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { DynamoDB } from 'aws-sdk';
import { encryptLeaveRequest, decryptLeaveRequest } from '../utils/encryption';

const db = new DynamoDB.DocumentClient();

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    let decryptedData: any;

    const body = event.body ? JSON.parse(event.body) : {};

    if ('encrypted_data' in body) {
      try {
        decryptedData = decryptLeaveRequest(body.encrypted_data);
      } catch (error) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Invalid encrypted data', details: String(error) }),
        };
      }
    } else {
      decryptedData = body;
    }

    const id = uuidv4();
    const newLeave = {
      id,
      employee_name: decryptedData.employee_name,
      leave_type: decryptedData.leave_type,
      start_date: decryptedData.start_date,
      end_date: decryptedData.end_date,
      reason: decryptedData.reason,
      status: 'Pending',
      created_at: new Date().toISOString(),
    };

    const tableName = process.env.LEAVE_TABLE_NAME;
    if (!tableName) {
      throw new Error('LEAVE_TABLE_NAME env var is not set');
    }

    await db.put({ TableName: tableName, Item: newLeave }).promise();

    const responseData = {
      id,
      employee_name: newLeave.employee_name,
      leave_type: newLeave.leave_type,
      start_date: newLeave.start_date,
      end_date: newLeave.end_date,
      status: 'Pending',
      message: 'Leave request submitted successfully'
    };

    const encryptedResponse = encryptLeaveRequest(responseData);

    return {
      statusCode: 201,
      body: JSON.stringify({ encrypted_data: encryptedResponse, success: true }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error creating leave request', details: (err as Error).message }),
    };
  }
};
