import * as cdk from 'aws-cdk-lib';
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import { Effect, Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam';

import path = require('path');

import { ILambdaStackProps } from '../../interfaces/lambda.stack-props';

export class RequestLambdaStack extends cdk.Stack {
	readonly function: NodejsFunction;

	constructor(scope: Construct, folder: string, codeFile: string, props: ILambdaStackProps) {
		const id = `${props.stage}-ProjecName-${folder}-${codeFile}`;

		super(scope, id);

		const env: any = {
			REGION: props.region,
			STAGE: props.stage,
			TABLE_NAME: props.dynamoDbTableName!
		};

		if (props.userPoolArn) env.USERPOOL_ID = props.userPoolId!;

		this.function = new NodejsFunction(this, id, {
			functionName: id,
			runtime: Runtime.NODEJS_LATEST,
			entry: path.join(__dirname, 'code', `${folder}/${codeFile}.lambda-code.ts`),
			handler: 'handler',
			timeout: cdk.Duration.seconds(30),
			environment: env
		});

		const statements: cdk.aws_iam.PolicyStatement[] = [];

		if (props.userPoolArn)
			statements.push(new PolicyStatement({
				effect: Effect.ALLOW,
				actions: ['cognito-idp:AdminCreateUser', 'cognito-idp:AdminDeleteUser', 'cognito-idp:AdminUpdateUserAttributes'],
				resources: [props.userPoolArn]
			}));

		if (props.dynamoDbTableName)
			statements.push(new PolicyStatement({
				effect: Effect.ALLOW,
				actions: ['dynamodb:PutItem', 'dynamodb:Query', 'dynamodb:GetItem', 'dynamodb:DeleteItem', 'dynamodb:UpdateItem'],
				resources: [
					`arn:aws:dynamodb:${props.region}:${props.accountId}:table/${props.dynamoDbTableName}`,
					`arn:aws:dynamodb:${props.region}:${props.accountId}:table/${props.dynamoDbTableName}/index/*`
				]
			}));

		if (statements.length > 0) {
			const policy = new Policy(this, `${id}-policy`, {
				policyName: `${id}-policy`,
				statements: statements
			});

			this.function.role!.attachInlinePolicy(policy);
		}

		cdk.Tags.of(this.function).add('app', 'ProjectName');
	}
}