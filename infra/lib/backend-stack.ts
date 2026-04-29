import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'node:path';
import * as url from 'node:url';
import type { Construct } from 'constructs';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

export interface BackendStackProps extends StackProps {
  /** Reserved for future custom-domain mapping. */
  domainName: string;
  zoneId: string;
}

export class BackendStack extends Stack {
  public readonly wsUrl: string;

  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props);

    const table = new dynamodb.Table(this, 'RoomsTable', {
      tableName: 'storypointless-rooms',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const handlersDir = path.join(__dirname, '..', '..', 'apps', 'server', 'src', 'handlers');
    const commonFnProps = {
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 256,
      timeout: Duration.seconds(10),
      environment: { TABLE_NAME: table.tableName },
      logRetention: logs.RetentionDays.ONE_WEEK,
      bundling: {
        format: 'esm' as const,
        target: 'node22',
        mainFields: ['module', 'main'],
        externalModules: ['@aws-sdk/*'],
        banner: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
      },
    };

    const connectFn = new NodejsFunction(this, 'ConnectFn', {
      ...commonFnProps,
      entry: path.join(handlersDir, 'connect.ts'),
      functionName: 'storypointless-connect',
    });

    const disconnectFn = new NodejsFunction(this, 'DisconnectFn', {
      ...commonFnProps,
      entry: path.join(handlersDir, 'disconnect.ts'),
      functionName: 'storypointless-disconnect',
    });

    const messageFn = new NodejsFunction(this, 'MessageFn', {
      ...commonFnProps,
      entry: path.join(handlersDir, 'message.ts'),
      functionName: 'storypointless-message',
    });

    table.grantReadWriteData(disconnectFn);
    table.grantReadWriteData(messageFn);

    const wsApi = new apigwv2.CfnApi(this, 'WsApi', {
      name: 'storypointless-ws',
      protocolType: 'WEBSOCKET',
      routeSelectionExpression: '$request.body.type',
    });

    const stageName = 'prod';
    const region = this.region;
    const integrationArn = (fn: lambda.IFunction) =>
      `arn:aws:apigateway:${region}:lambda:path/2015-03-31/functions/${fn.functionArn}/invocations`;

    const mkRoute = (id: string, key: string, fn: lambda.IFunction) => {
      const integration = new apigwv2.CfnIntegration(this, `${id}Integration`, {
        apiId: wsApi.ref,
        integrationType: 'AWS_PROXY',
        integrationUri: integrationArn(fn),
      });
      new apigwv2.CfnRoute(this, `${id}Route`, {
        apiId: wsApi.ref,
        routeKey: key,
        target: `integrations/${integration.ref}`,
        authorizationType: 'NONE',
      });
      fn.addPermission(`${id}Invoke`, {
        principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
        action: 'lambda:InvokeFunction',
        sourceArn: `arn:aws:execute-api:${region}:${this.account}:${wsApi.ref}/*/*`,
      });
      return integration;
    };

    const connectIntegration = mkRoute('Connect', '$connect', connectFn);
    const disconnectIntegration = mkRoute('Disconnect', '$disconnect', disconnectFn);
    const defaultIntegration = mkRoute('Default', '$default', messageFn);

    const deployment = new apigwv2.CfnDeployment(this, 'Deployment', {
      apiId: wsApi.ref,
    });
    deployment.addDependency(connectIntegration);
    deployment.addDependency(disconnectIntegration);
    deployment.addDependency(defaultIntegration);

    new apigwv2.CfnStage(this, 'Stage', {
      apiId: wsApi.ref,
      stageName,
      deploymentId: deployment.ref,
      autoDeploy: false,
    });

    // Allow Lambdas to push messages back to clients via the WS API.
    const manageConnections = new iam.PolicyStatement({
      actions: ['execute-api:ManageConnections'],
      resources: [`arn:aws:execute-api:${region}:${this.account}:${wsApi.ref}/${stageName}/POST/@connections/*`],
    });
    disconnectFn.addToRolePolicy(manageConnections);
    messageFn.addToRolePolicy(manageConnections);

    this.wsUrl = `wss://${wsApi.ref}.execute-api.${region}.amazonaws.com/${stageName}`;

    new CfnOutput(this, 'WsUrl', { value: this.wsUrl });
    new CfnOutput(this, 'TableName', { value: table.tableName });
    new CfnOutput(this, 'ApiId', { value: wsApi.ref });
  }
}
