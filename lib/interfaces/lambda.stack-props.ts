import { StackProps } from "aws-cdk-lib";

import { StageEnum } from "../enums/stage.enum";

export interface ILambdaStackProps extends StackProps {
	stage: StageEnum;
	region: string;
	// Both of these are required for the DynamoDB access
	accountId?: string;
	dynamoDbTableName?: string;
	// Both of these are required for the AdminUser access.
	userPoolArn?: string;
	userPoolId?: string;
}
