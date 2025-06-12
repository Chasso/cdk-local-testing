import { Controller, Put } from "../../../../../testing/decorators";
import { buildResponseBody } from "../../helpers/lambda-response.helper";
import { IItem } from "../../interfaces/IItem";
import { IRequest } from "../../interfaces/IRequest";
import { DynamoDbService } from "../../services/dynamodb.service";

@Controller('items')
export class ItemsUpdateController {
	@Put(':id')
	async handler(request: IRequest) {
		try {
			console.log('Updating Item.');
			const body: IItem = JSON.parse(request.body);

			const dynamoDbService = new DynamoDbService();
			await dynamoDbService.update(body, 'ITEM', 'ITEM');

			console.log('Done.');
			return buildResponseBody(204, undefined, 'ALLOW');
		} catch (error: any) {
			console.log(`Failed to update Item with ID ${request.pathParameters.id}:`, error);
			return buildResponseBody(500, error.message, 'ALLOW');
		}
	}
}

export const handler = async (request: IRequest) => {
	const controller = new ItemsUpdateController();
	return await controller.handler(request);
}