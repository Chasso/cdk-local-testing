import { Controller, Post } from "../../../../../testing/decorators";
import { buildResponseBody } from "../../helpers/lambda-response.helper";
import { INewItem } from "../../interfaces/IItem";
import { IRequest } from "../../interfaces/IRequest";
import { DynamoDbService } from "../../services/dynamodb.service";

@Controller('items')
export class ItemsCreateController {
	@Post('')
	async handler(request: IRequest) {
		try {
			console.log(`Creating a new Item.`);
			const body: INewItem = JSON.parse(request.body);

			const dynamoDbService = new DynamoDbService();
			const id = await dynamoDbService.create(body, 'ITEM', 'ITEM');

			console.log('Done.');
			return buildResponseBody(201, { id }, 'ALLOW');
		} catch (error: any) {
			console.log(`Failed to create a new Item:`, error);
			return buildResponseBody(500, error.message, 'ALLOW');
		}
	}
}

export const handler = async (request: IRequest) => {
	const controller = new ItemsCreateController();
	return await controller.handler(request);
}