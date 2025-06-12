import { Controller, Delete } from "../../../../../testing/decorators";
import { buildResponseBody } from "../../helpers/lambda-response.helper";
import { IRequest } from "../../interfaces/IRequest";
import { DynamoDbService } from "../../services/dynamodb.service";

@Controller('items')
export class ItemsDeleteController {
	@Delete(':id')
	async handler(request: IRequest) {
		try {
			console.log('Deleting Item from DynamoDB.');
			const dynamoDbService = new DynamoDbService();
			await dynamoDbService.delete(request.pathParameters.id, 'ITEM', 'ITEM');

			console.log('Done.');
			return buildResponseBody(204, undefined, 'ALLOW');
		} catch (error: any) {
			console.log(`Failed to delete the Item with ID ${request.pathParameters.id}:`, error);
			return buildResponseBody(500, error.message, 'ALLOW');
		}
	}
}

export const handler = async (request: IRequest) => {
	const controller = new ItemsDeleteController();
	return await controller.handler(request);
}