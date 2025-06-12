export interface IRequest {
	pathParameters: {
		id: string;
		competitionId: string;
		eventId: string;
		judgeId: string;
		choirId: string;
	},
	body: string;
	requestContext: {
		authorizer: {
			claims: {
				email: string;
				'custom:userType'?: string;
			}
		}
	};
}

export interface IListRequest extends IRequest {
	queryStringParameters: {
		[key: string]: string | number;
	}
}