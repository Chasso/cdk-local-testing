import { Controller, Get } from "../../../../../testing/decorators";
import { buildResponseBody } from "../../helpers/lambda-response.helper";
import { IItem } from "../../interfaces/IItem";
import { IRequest } from "../../interfaces/IRequest";
import { DynamoDbService } from "../../services/dynamodb.service";

@Controller('items')
export class ItemsGetController {
	@Get(':id')
	async handler(request: IRequest) {
		try {
			console.log('Fetching Item.');
			const dynamoDbService = new DynamoDbService();
			const item = await dynamoDbService.get<IItem>(request.pathParameters.id, 'ITEM', 'ITEM');

			console.log('Done.');
			return buildResponseBody(200, item, 'ALLOW');
		} catch (error: any) {
			console.log(`Failed to get Item with ID ${request.pathParameters.id}:`, error);
			return buildResponseBody(500, error.message, 'ALLOW');
		}
	}
}

export const handler = async (request: IRequest) => {
	const controller = new ItemsGetController();
	return await controller.handler(request);
}