import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';

export class RomAnnMayBalingbingCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'RomAnnMayBalingbingCdkQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
    const leaveRequestTable = new dynamodb.Table(this, 'LeaveRequestTable', {
      partitionKey: { 
        name: 'id', 
        type: dynamodb.AttributeType.STRING 
      },
      tableName: `LeaveRequest-${this.stackName}`,

      removalPolicy: cdk.RemovalPolicy.DESTROY, //check this first :V
    });

    const createLeaveLambda = new lambda.Function(this, 'CreateLeaveRequest', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'createLeaveRequest.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambdas')),
      environment: {
        LEAVE_TABLE_NAME: leaveRequestTable.tableName,
      },
    });
    leaveRequestTable.grantWriteData(createLeaveLambda);

    const api = new apigateway.RestApi(this, 'LeaveRequestApi', {
      restApiName: 'Employee Leave Request API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS
      }
    });

    // Cognito User Pool for authentication
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'ELT-UserPool',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
    });

    const userPoolDomain = userPool.addDomain('UserPoolDomain', {
      cognitoDomain: {
        domainPrefix: 'elt-userpool-domain',
      },
    })

    //App Client
    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
      authFlows: {
        userPassword: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true,
        },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID],
        callbackUrls: ['https://jwt.io'],
        logoutUrls: ['https://jwt.io'],

      }
    });

    // Define Cognito groups for access roles
    new cognito.CfnUserPoolGroup(this, 'EmployeesGroup', {
      groupName: 'employees',
      userPoolId: userPool.userPoolId,
    });

    new cognito.CfnUserPoolGroup(this, 'HrAdminsGroup', {
      groupName: 'hr-admins',
      userPoolId: userPool.userPoolId,
    });

    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
    });

    // Get leave requests
    const getLeaveRequestsLambda = new lambda.Function(this, 'GetLeaveRequests', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'getLeaveRequests.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambdas')),
      environment: {
        LEAVE_TABLE_NAME: leaveRequestTable.tableName,
      },
    });

    // Get by ID
    const getLeaveByIdLambda = new lambda.Function(this, 'GetLeaveByIdLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'getLeaveById.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambdas')),
      environment: {
        LEAVE_TABLE_NAME: leaveRequestTable.tableName,
      },
    });
    leaveRequestTable.grantReadData(getLeaveByIdLambda);

    // Update leave request
    const updateLeaveRequestLambda = new lambda.Function(this, 'UpdateLeaveRequestLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'updateLeaveRequest.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambdas')),
      environment: {
        LEAVE_TABLE_NAME: leaveRequestTable.tableName,
      },
    });
    leaveRequestTable.grantReadWriteData(updateLeaveRequestLambda);

    
    const employee = api.root.addResource('employee');
    const leaveRequests = employee.addResource('leave-requests');
    const hrAdmin = api.root.addResource('hr-admin');
    const hrLeaveRequests = hrAdmin.addResource('leave-requests');
    const leaveById = hrLeaveRequests.addResource('{id}');

    // Employee side - Create leave request
    leaveRequests.addMethod('POST', new apigateway.LambdaIntegration(createLeaveLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // HR Admin side 
    // Get all leave requests
    // GET /hr-admin/leave-requests
    hrLeaveRequests.addMethod('GET', new apigateway.LambdaIntegration(getLeaveRequestsLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // GET /hr-admin/leave-requests/{id}
    leaveById.addMethod('GET', new apigateway.LambdaIntegration(getLeaveByIdLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // PATCH /hr-admin/leave-requests/{id}
    leaveById.addMethod('PATCH', new apigateway.LambdaIntegration(updateLeaveRequestLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Grant permissions to the Lambda functions
    leaveRequestTable.grantReadData(getLeaveRequestsLambda);
    leaveRequestTable.grantReadData(getLeaveByIdLambda);
    leaveRequestTable.grantReadWriteData(updateLeaveRequestLambda);

    // Output for frontend login
    new cdk.CfnOutput(this, 'CognitoHostedUILogin', {
      value: `https://${userPoolDomain.domainName}.auth.${this.region}.amazoncognito.com/login?client_id=${userPoolClient.userPoolClientId}&response_type=token&scope=email+openid&redirect_uri=https://jwt.io`
   });
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, 'APIEndpoint', { value: api.url });
    new cdk.CfnOutput(this, 'GetLeaveRequestsLambdaName', { value: getLeaveRequestsLambda.functionName });

  }
}
