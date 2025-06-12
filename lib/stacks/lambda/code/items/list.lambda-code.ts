import 'reflect-metadata';

import { buildResponseBody } from "../../helpers/lambda-response.helper";
import { IItem } from "../../interfaces/IItem";
import { DynamoDbService } from "../../services/dynamodb.service";
import { Controller, Get } from '../../../../../testing/decorators';

@Controller('items')
export class ItemsListController {
	@Get('')
	async handler() {
		try {
			console.log('Fetching list of Items.');
			const dynamoDbService = new DynamoDbService();

			const items = await dynamoDbService.list<IItem>('ITEM', 'ITEM');

			console.log('Done.');
			return buildResponseBody(200, items, 'ALLOW');
		} catch (error: any) {
			console.log(`Failed to get a list of Items:`, error);
			return buildResponseBody(500, error.message, 'ALLOW');
		}
	}
}

export const handler = async () => {
	const controller = new ItemsListController();
	return await controller.handler();
}